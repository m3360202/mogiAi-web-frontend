"use client";

import { useEffect } from 'react';
import AppHeader from '@/components/AppHeader';
import { useAuthStore } from '@/store/useAuthStore';

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const init = useAuthStore((state) => state.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="min-h-screen bg-gray-50/50">
      <AppHeader />
      <main className="w-full">{children}</main>
    </div>
  );
}
