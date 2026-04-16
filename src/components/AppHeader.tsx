"use client";

import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { useParams, useSearchParams } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { useMemo } from 'react';
import { User, LogOut } from 'lucide-react';

export default function AppHeader() {
  const t = useTranslations('common');
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const loading = useAuthStore((state) => state.loading);
  const signOut = useAuthStore((state) => state.signOut);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams<{ locale?: string | string[] }>();
  const locale = Array.isArray(params?.locale) ? params?.locale[0] : params?.locale || 'ja';

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'User';
  const search = searchParams?.toString();
  const pathnameWithoutLocale = useMemo(() => {
    const path = pathname || '/';
    const escaped = routing.locales.map((loc) => loc.replace('-', '\\-')).join('|');
    const localePattern = new RegExp(`^/(${escaped})(?=/|$)`);
    const stripped = path.replace(localePattern, '');
    return stripped || '/';
  }, [pathname]);
  const href = search ? `${pathnameWithoutLocale}?${search}` : pathnameWithoutLocale;

  const handleLocaleChange = (nextLocale: string) => {
    router.push(href, { locale: nextLocale });
  };

  return (
    <header className="w-full border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-gray-900">
            {t('app_name')}
          </Link>

          <nav className="flex items-center gap-3">
            <div className="flex items-center">
              <select
                value={locale}
                onChange={(event) => handleLocaleChange(event.target.value)}
                className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Select language"
              >
                <option value="ja">{t('locale_ja')}</option>
                <option value="zh-CN">{t('locale_zh_cn')}</option>
                <option value="en">{t('locale_en')}</option>
              </select>
            </div>
            <Link href="/courses">
              <Button variant="ghost">{t('courses')}</Button>
            </Link>
            <Link href="/practice/3">
              <Button variant="ghost">{t('practice')}</Button>
            </Link>

            {user ? (
              <div className="flex items-center gap-3">
                <Link href="/history">
                  <Button variant="ghost">{t('history')}</Button>
                </Link>
                <div className="hidden sm:flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="max-w-[160px] truncate">{displayName}</span>
                </div>
                <Button
                  variant="outline"
                  onClick={signOut}
                  disabled={loading}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  {t('logout')}
                </Button>
              </div>
            ) : (
              <Link href="/login">
                <Button>{t('login')}</Button>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
