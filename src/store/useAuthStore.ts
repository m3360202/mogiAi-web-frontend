"use client";

import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { apiRequest } from '@/lib/apiClient';

type BackendUser = {
  id: string;
  supabase_id: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  preferred_language?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
};

type AuthState = {
  initialized: boolean;
  loading: boolean;
  error: string | null;
  session: Session | null;
  user: User | null;
  profile: BackendUser | null;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<Session | null>;
  signUp: (email: string, password: string, fullName?: string) => Promise<Session | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  syncUser: (session: Session) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  initialized: false,
  loading: false,
  error: null,
  session: null,
  user: null,
  profile: null,

  init: async () => {
    const { initialized } = get();
    if (initialized) {
      return;
    }

    set({ loading: true, error: null });

    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const session = data.session ?? null;
      const user = session?.user ?? null;
      set({ session, user, initialized: true });

      if (session?.access_token) {
        await get().syncUser(session);
        await get().refreshProfile();
      }

      supabase.auth.onAuthStateChange(async (_event, nextSession) => {
        const nextUser = nextSession?.user ?? null;
        set({ session: nextSession, user: nextUser });

        if (nextSession?.access_token) {
          await get().syncUser(nextSession);
          await get().refreshProfile();
        } else {
          set({ profile: null });
        }
      });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    const supabase = getSupabaseClient();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      set({ session: data.session ?? null, user: data.user ?? null });

      if (data.session?.access_token) {
        await get().syncUser(data.session);
        await get().refreshProfile();
      }
      return data.session ?? null;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (email, password, fullName) => {
    set({ loading: true, error: null });
    const supabase = getSupabaseClient();

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: fullName ? { full_name: fullName } : undefined
        }
      });

      if (error) {
        throw error;
      }

      set({ session: data.session ?? null, user: data.user ?? null });

      if (data.session?.access_token) {
        await get().syncUser(data.session);
        await get().refreshProfile();
      }
      return data.session ?? null;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });
    const supabase = getSupabaseClient();

    try {
      await supabase.auth.signOut();
      set({ session: null, user: null, profile: null });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  refreshProfile: async () => {
    const session = get().session;
    if (!session?.access_token) {
      return;
    }

    try {
      const profile = await apiRequest<BackendUser>('/auth/me', {
        accessToken: session.access_token
      });
      set({ profile });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
  syncUser: async (session: Session) => {
    const user = session.user;
    if (!user) {
      return;
    }

    const payload = {
      supabase_id: user.id,
      email: user.email ?? '',
      full_name: user.user_metadata?.full_name ?? null,
      phone: user.phone ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? null,
      preferred_language: user.user_metadata?.preferred_language ?? 'ja'
    };

    await apiRequest<BackendUser>('/auth/sync', {
      method: 'POST',
      body: payload,
      accessToken: session.access_token
    });
  }
}));
