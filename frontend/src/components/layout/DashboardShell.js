import { Card, PageHeader, StatCard } from '@/components/ui';

// Phase 2 shell: real layout + the exact stat cards each role will have.
// Values show "-" until the data modules land; nothing is faked.
export default function DashboardShell({ title, subtitle, stats, phase, children }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map((s) => <StatCard key={s.label} {...s} />)}</div>
      <Card className="mt-6" title="Workspace">
        <p className="text-sm text-slate-500">{children || `This dashboard is connected to live data in ${phase}.`}</p>
      </Card>
    </>
  );
}
