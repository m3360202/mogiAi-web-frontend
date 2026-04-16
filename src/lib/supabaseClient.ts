"use client";

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/publicConfig';

let supabase: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (supabase) {
    return supabase;
  }

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    const missing = [];
    if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    throw new Error(`Missing Supabase environment variables: ${missing.join(', ')}. Please configure them in your environment.`);
  }

  supabase = createClient(url, anonKey);
  return supabase;
}
