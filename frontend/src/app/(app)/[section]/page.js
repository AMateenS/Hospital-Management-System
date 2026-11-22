'use client';
import { useParams } from 'next/navigation';
import { Card, PageHeader } from '@/components/ui';

const PHASE = { patients: 'Phase 3', doctors: 'Phase 5', appointments: 'Phase 3', reports: 'Phase 9', settings: 'Phase 10' };
export default function Section() {
  const { section } = useParams();
  return (
    <>
      <PageHeader title={section.charAt(0).toUpperCase() + section.slice(1)} />
      <Card><p className="text-sm text-slate-500">This module is built in {PHASE[section] || 'a later phase'}.</p></Card>
    </>
  );
}
