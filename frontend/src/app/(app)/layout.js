'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canAccess, ROLE_HOME } from '@/lib/nav';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';

// Auth + role guard for every authenticated page. (The API enforces the same rules server-side.)
export default function AppLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.mustChangePassword && path !== '/change-password') router.replace('/change-password');
  }, [user, loading, path, router]);

  if (loading || !user) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>;
  const allowed = canAccess(user.role, path);

  return (
    <div className="min-h-screen">
      <Sidebar open={menu} onClose={() => setMenu(false)} />
      <div className="lg:pl-64 print-reset">
        <Topbar onMenu={() => setMenu(true)} />
        <main className="p-4 sm:p-6">
          {allowed ? children : (
            <div className="mx-auto mt-20 max-w-md text-center"><ShieldAlert className="mx-auto h-12 w-12 text-red-500" />
              <h2 className="mt-3 text-xl font-bold">Access denied</h2><p className="text-slate-500">Your role does not have permission to view this page.</p>
              <button className="mt-4 text-teal-600 underline" onClick={() => router.replace(ROLE_HOME[user.role])}>Go to my dashboard</button></div>
          )}
        </main>
      </div>
    </div>
  );
}
