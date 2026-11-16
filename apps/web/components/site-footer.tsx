'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquareWarningIcon } from 'lucide-react';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { PUBLIC } from '@/components/nav';

/** Rodapé das páginas com sessão (as públicas têm os seus próprios links). */
export function SiteFooter() {
  const pathname = usePathname();
  if (PUBLIC.includes(pathname)) return null;
  return (
    <footer className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-between gap-3 border-t px-4 py-6 text-sm text-muted-foreground md:px-8">
      <nav aria-label="Rodapé" className="flex gap-4">
        <Link href="/termos" className="hover:text-foreground hover:underline">Termos</Link>
        <Link href="/privacidade" className="hover:text-foreground hover:underline">Privacidade</Link>
      </nav>
      <FeedbackDialog>
        <button type="button" className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline">
          <MessageSquareWarningIcon className="size-4" /> Reportar um problema
        </button>
      </FeedbackDialog>
    </footer>
  );
}
