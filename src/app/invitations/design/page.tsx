'use client';

import Link from 'next/link';
import { StandaloneInvitationStudio } from '@/components/occasion/DigitalInviteGenerator';
import { useT } from '@/components/i18n/LocaleProvider';

export default function DesignCardPage() {
  const t = useT();
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-4">
      <Link href="/invitations" className="text-sm underline text-saudi-green-800">{t('العودة إلى البطاقات والدعوات الرقمية')}</Link>
      <StandaloneInvitationStudio />
    </div>
  );
}
