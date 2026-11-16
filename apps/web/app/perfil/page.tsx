'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BellIcon, FilterIcon, MapPinIcon, ShieldCheckIcon, SparklesIcon, TargetIcon, WalletIcon,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Preferences, Profile } from '@/lib/types';
import { CvCard } from '@/components/cv-card';
import { ProfileForm } from '@/components/profile-form';
import { PreferencesForm } from '@/components/preferences-form';
import { SecurityCard } from '@/components/security-card';
import { PageHeader, CardSkeleton } from '@/components/page';

const SECTIONS = [
  { id: 'cv', label: 'Perfil', icon: SparklesIcon },
  { id: 'procura', label: 'O que procuras', icon: TargetIcon },
  { id: 'local', label: 'Onde', icon: MapPinIcon },
  { id: 'salario', label: 'Salário', icon: WalletIcon },
  { id: 'emails', label: 'Emails', icon: BellIcon },
  { id: 'filtros', label: 'Filtros', icon: FilterIcon },
  { id: 'seguranca', label: 'Segurança', icon: ShieldCheckIcon },
];

/** Índice lateral (ecrãs largos) que acompanha a secção visível. */
function SectionNav({ ready }: { ready: boolean }) {
  const [active, setActive] = useState('cv');

  useEffect(() => {
    if (!ready) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ready]);

  return (
    <nav aria-label="Secções do perfil" className="sticky top-24 space-y-0.5">
      {SECTIONS.map(({ id, label, icon: Icon }) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={active === id ? 'true' : undefined}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
            active === id ? 'bg-secondary font-medium text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Icon className="size-4" /> {label}
        </a>
      ))}
    </nav>
  );
}

export default function PerfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [prefsVersion, setPrefsVersion] = useState(0);

  /** Depois de um CV novo, a área e as funções podem ter sido preenchidas: recarrega o formulário. */
  async function onCvSaved(p: Profile) {
    setProfile(p);
    const next = await api<Preferences>('/preferences').catch(() => null);
    if (next) {
      setPrefs(next);
      setPrefsVersion((v) => v + 1);
    }
  }

  useEffect(() => {
    api<Profile>('/profile')
      .then(setProfile)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        // 404 = ainda não enviou CV, fica null
      })
      .finally(() => setProfileLoaded(true));
    api<Preferences>('/preferences').then(setPrefs).catch(() => {});
  }, [router]);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 xl:grid xl:max-w-6xl xl:grid-cols-[200px_minmax(0,1fr)] xl:gap-10">
      <aside className="hidden xl:block">
        <SectionNav ready={profileLoaded && !!prefs} />
      </aside>
      <main className="min-w-0 space-y-6 xl:max-w-4xl">
        <PageHeader title="Perfil" description="A tua área, experiência e o que procuras. CV opcional." />
        <div id="cv" className="scroll-mt-20 space-y-6">
          {profileLoaded ? <CvCard profile={profile} onSaved={onCvSaved} /> : <CardSkeleton />}
          {profileLoaded && !profile && <ProfileForm onSaved={onCvSaved} />}
        </div>
        {prefs ? <PreferencesForm key={prefsVersion} initial={prefs} cvRoles={profile?.suggestedRoles ?? []} /> : <CardSkeleton lines={6} />}
        <div id="seguranca" className="scroll-mt-20">
          <SecurityCard />
        </div>
      </main>
    </div>
  );
}
