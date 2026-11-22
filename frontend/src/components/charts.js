'use client';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui';

const COLORS = ['#0d9488', '#2563eb', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b', '#10b981'];
const short = (d) => d.slice(5);   // MM-DD
const Empty = () => <p className="grid h-full place-items-center text-sm text-slate-400">No data for this period</p>;
const Box = ({ title, children, empty }) => <Card title={title}><div className="h-64 w-full">{empty ? <Empty /> : children}</div></Card>;

export function VisitsChart({ daily }) {
  return (<Box title="Patient visits per day" empty={!daily.some((d) => d.visits)}>
    <ResponsiveContainer><BarChart data={daily}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={short} fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Bar dataKey="visits" name="Visits" fill="#0d9488" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></Box>);
}
export function RevenueChart({ daily }) {
  return (<Box title="Revenue per day" empty={!daily.some((d) => d.revenue)}>
    <ResponsiveContainer><LineChart data={daily}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={short} fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend />
      <Line type="monotone" dataKey="consultationRevenue" name="Consultation" stroke="#2563eb" dot={false} strokeWidth={2} /><Line type="monotone" dataKey="pharmacyRevenue" name="Pharmacy" stroke="#0d9488" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer></Box>);
}
export function PieCard({ title, data }) {
  return (<Box title={title} empty={!data.length}>
    <ResponsiveContainer><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></Box>);
}
export function DeptChart({ data }) {
  return (<Box title="Visits by department" empty={!data.length}>
    <ResponsiveContainer><BarChart data={data} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} fontSize={11} /><YAxis type="category" dataKey="name" width={110} fontSize={11} /><Tooltip /><Bar dataKey="visits" fill="#2563eb" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></Box>);
}
