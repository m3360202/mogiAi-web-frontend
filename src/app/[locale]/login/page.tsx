"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from '@/i18n/routing';

export default function LoginPage() {
  const t = useTranslations('login');
  const router = useRouter();
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const initialized = useAuthStore((state) => state.initialized);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [info, setInfo] = useState<string | null>(null);
  
  // Only disable button when actually loading (not during init)
  const isButtonDisabled = loading && initialized;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInfo(null);
    try {
    if (mode === 'login') {
        const session = await signIn(email, password);
        if (session?.access_token) {
          router.push('/courses');
        }
        return;
      }

      const session = await signUp(email, password, fullName);
      // Supabase may require email confirmation, resulting in no session
      if (!session?.access_token) {
        setInfo(t('signup_success'));
        setMode('login');
        return;
    }
    router.push('/courses');
    } catch {
      // store.error will render; keep user on page
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle>{mode === 'login' ? t('welcome_back') : t('create_account')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Input
                placeholder={t('full_name')}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            )}
            <Input
              type="email"
              placeholder={t('email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder={t('password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {info && <p className="text-sm text-emerald-600">{info}</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full" disabled={isButtonDisabled}>
              {isButtonDisabled ? t('loading') : (mode === 'login' ? t('login') : t('sign_up'))}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-600">
            {mode === 'login' ? (
              <button
                type="button"
                className="text-indigo-600 hover:underline"
                onClick={() => setMode('signup')}
              >
                {t('create_new_account')}
              </button>
            ) : (
              <button
                type="button"
                className="text-indigo-600 hover:underline"
                onClick={() => setMode('login')}
              >
                {t('already_have_account')}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
