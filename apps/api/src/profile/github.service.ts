import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type GithubRepo = {
  name: string;
  description: string | null;
  topics: string[];
  languages: string[];
  stars: number;
  updatedAt: string;
  academic: boolean;
};

type ApiRepo = {
  name: string;
  description: string | null;
  topics?: string[];
  fork: boolean;
  archived: boolean;
  stargazers_count: number;
  pushed_at: string;
  languages_url: string;
};

/**
 * Lê repositórios públicos do GitHub (opcional, só IT).
 * Usado ao analisar o CV para enriquecer skills.
 */
@Injectable()
export class GithubService {
  constructor(private readonly config: ConfigService) {}

  private async get<T>(url: string): Promise<T> {
    const token = this.config.get<string>('GITHUB_TOKEN');
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'radar-app',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new BadGatewayException(`GitHub respondeu ${res.status}.`);
    return (await res.json()) as T;
  }

  async repos(user: string): Promise<GithubRepo[]> {
    const all = await this.get<ApiRepo[]>(
      `https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=pushed`,
    );
    const mine = all.filter((r) => !r.fork && !r.archived);

    const repos = await Promise.all(
      mine.map(async (r) => {
        const langs = await this.get<Record<string, number>>(r.languages_url);
        return {
          name: r.name,
          description: r.description,
          topics: r.topics ?? [],
          languages: Object.entries(langs)
            .sort((a, b) => b[1] - a[1])
            .map(([l]) => l),
          stars: r.stargazers_count,
          updatedAt: r.pushed_at,
          academic: /_\d{4}_\d{4}$/.test(r.name),
        };
      }),
    );
    return repos.filter((r) => r.languages.length > 0);
  }
}