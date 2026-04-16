import { useTranslations } from 'next-intl';

export default function NotFoundPage() {
  const t = useTranslations('common');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">{t('404_not_found')}</h1>
    </div>
  );
}
