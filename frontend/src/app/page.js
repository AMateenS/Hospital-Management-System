'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ROLE_HOME } from '@/lib/nav';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading) router.replace(user ? ROLE_HOME[user.role] : '/login'); }, [user, loading, router]);
  return null;
}
