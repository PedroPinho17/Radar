/** Reacção do utilizador a uma oferta avaliada. */
export type Decision = 'like' | 'dislike' | 'applied';

/** Oferta de emprego (shape da API → UI). */
export type Job = {
  id: string;
  /** `itjobs` | `landing` | `netempregos` | `wwr` | `jooble` */
  source: string;
  /** Área Radar, se a API a tiver etiquetado. */
  area?: string | null;
  title: string;
  company: string;
  location: string | null;
  workModel: 'remote' | 'hybrid' | 'onsite' | null;
  url: string;
  publishedAt: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
};

/** Resultado da IA para uma oferta × utilizador. */
export type Match = {
  id: string;
  /** Nota 0–100. */
  score: number;
  reasons: string[];
  /** Requisitos em falta (carta, certificado, inglês…). */
  missingSkills: string[];
  englishRequired: boolean;
  minYears: number | null;
  /** Horário extraído pela IA (ex. "manhã"). */
  schedule: string | null;
  /** Contrato extraído pela IA (ex. "termo certo"). */
  contractType: string | null;
  decision: Decision | null;
  decisionReason: string | null;
  coverLetter: string | null;
  /** Salário anual estimado pelo salary-predictor (€), só quando a oferta não diz. */
  estimatedSalary?: number | null;
  job: Job;
};

/** Resumo do perfil (CV ou formulário). */
export type Profile = {
  title: string;
  yearsExperience: number;
  seniority: string;
  skills: string[];
  languages: string[];
  location: string | null;
  summary: string;
  sector: string | null;
  suggestedRoles: string[];
  education?: string | null;
  drivingLicense?: string | null;
  /** `cv` = veio de PDF; `form` = formulário sem CV. */
  source?: 'cv' | 'form';
};

/** Preferências de procura e emails (espelho da API). */
export type Preferences = {
  currentSalary: number | null;
  targetSalaryMin: number | null;
  targetSalaryMax: number | null;
  areas: string[];
  /** @deprecated preferir `areas` */
  sector: string | null;
  roles: string[];
  avoid: string[];
  excludeKeywords: string[];
  district: string | null;
  city: string | null;
  /** Informativo — o filtro real é por distrito/cidade. */
  maxDistanceKm: number | null;
  shifts: string[];
  contractTypes: string[];
  workTime: 'full_time' | 'part_time' | 'ambos' | null;
  onsiteLocations: string[];
  hybridLocations: string[];
  remoteAnywhere: boolean;
  maxYears: number;
  notes: string | null;
  githubUsername: string | null;
  dailyEmail: boolean;
  digestMinScore: number;
  /** 0 = domingo … 6 = sábado */
  emailDays: number[];
  emailTimes: string[];
  emailMaxJobs: number;
};

export type AppStatus = 'applied' | 'interview' | 'offer' | 'accepted' | 'rejected' | 'withdrawn';

/** Candidatura com histórico e flag de “parada”. */
export type Application = {
  id: string;
  status: AppStatus;
  /** Sem novidades há 14 dias e ainda em curso. */
  stale: boolean;
  createdAt: string;
  updatedAt: string;
  job: Job;
  events: { id: string; status: AppStatus; note: string | null; createdAt: string }[];
};
