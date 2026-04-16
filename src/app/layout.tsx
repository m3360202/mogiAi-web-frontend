import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { routing } from '@/i18n/routing';

export const metadata: Metadata = {
  title: 'CareerFace',
  description: 'AI-Powered Interview Practice Platform',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const normalized = routing.locales.find(
    (candidate) => candidate.toLowerCase() === String(cookieLocale || '').toLowerCase()
  );
  const lang = normalized ?? routing.defaultLocale;
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
