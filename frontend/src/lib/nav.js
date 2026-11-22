import { LayoutDashboard, Users, Stethoscope, CalendarDays, FlaskConical, Pill, BarChart3, Settings, UserCog, FileText, ShieldCheck } from 'lucide-react';

export const ROLE_HOME = { admin: '/admin', reception: '/reception', doctor: '/doctor', laboratory: '/laboratory', pharmacy: '/pharmacy' };
export const ROLE_LABEL = { admin: 'Administrator', reception: 'Reception', doctor: 'Doctor', laboratory: 'Laboratory', pharmacy: 'Pharmacy' };

// Single source of truth for sidebar items AND route permissions.
export const NAV = [
  { label: 'Patients', href: '/patients', icon: Users, roles: ['admin', 'reception', 'doctor'] },
  { label: 'Doctors', href: '/doctors', icon: Stethoscope, roles: ['admin', 'reception'] },
  { label: 'Appointments', href: '/appointments', icon: CalendarDays, roles: ['admin', 'reception', 'doctor'] },
  { label: 'Laboratory', href: '/laboratory', icon: FlaskConical, roles: ['admin', 'laboratory'] },
  { label: 'Pharmacy', href: '/pharmacy', icon: Pill, roles: ['admin', 'pharmacy'] },
  { label: 'Users', href: '/admin/users', icon: UserCog, roles: ['admin'] },
  { label: 'Templates', href: '/admin/templates', icon: FileText, roles: ['admin'] },
  { label: 'Audit Log', href: '/admin/audit', icon: ShieldCheck, roles: ['admin'] },
  { label: 'Reports', href: '/reports', icon: BarChart3, roles: ['admin'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['admin', 'reception', 'doctor', 'laboratory', 'pharmacy'] },
];
export const DASH_ICON = LayoutDashboard;

export function navFor(role) {
  const home = ROLE_HOME[role];
  return [{ label: 'Dashboard', href: home, icon: LayoutDashboard }, ...NAV.filter((n) => n.roles.includes(role) && n.href !== home)];
}
// Which roles may open a top-level path (e.g. /patients). Dashboards are role-specific; admin can open all.
export function canAccess(role, pathname) {
  const seg = '/' + pathname.split('/')[1];
  if (seg === '/change-password') return true;
  if (Object.values(ROLE_HOME).includes(seg)) return role === 'admin' || ROLE_HOME[role] === seg;
  const item = NAV.find((n) => n.href === seg);
  return item ? item.roles.includes(role) : true;
}
