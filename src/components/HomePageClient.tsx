"use client";

import { useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useAuthStore } from '@/store/useAuthStore';
import HomeStartButton from '@/components/HomeStartButton';

export default function HomePageClient({ title }: { title: string }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    // 等待认证初始化完成后再检查登录状态
    if (initialized && user) {
      router.push('/courses');
    }
  }, [initialized, user, router]);

  // 如果已登录，在重定向前不显示内容（避免闪烁）
  if (initialized && user) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-4xl font-bold">{title}</h1>
      <HomeStartButton />
    </main>
  );
}
