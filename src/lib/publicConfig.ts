/**
 * 前端公共配置（可直接提交到仓库，不依赖 NEXT_PUBLIC_* 环境变量）。
 *
 * 说明：
 * - 这些值本质上是“公开信息”（会被打包进浏览器端 bundle），写在代码里是可以的。
 * - 如果你后续要区分 dev/staging/prod，再把这里改成按 hostname 或 build-time 注入即可。
 */

export const PUBLIC_CONFIG = {
  /**
   * Backend API base (must include `/api/v1`)
   * Example: https://<cloudrun-backend>/api/v1
   */
  apiBaseUrl: 'http://localhost:8000/api/v1',

  /**
   * Backend origin for WebSocket base (no `/api/v1` suffix required)
   * Example: http://localhost:8000
   */
  wsBaseUrl: 'http://localhost:8000',

  /**
   * Supabase
   */
  supabaseUrl: 'https://cagqgsnbdfwqwvmjllpj.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhZ3Fnc25iZGZ3cXd2bWpsbHBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MDE2NzIsImV4cCI6MjA3NTk3NzY3Mn0.0Zc8L1PB31ay_AS0Y8R9GPMcCJDnYbDlW1JC7ssymfs',
} as const;

export function getApiBaseUrl(): string {
  return PUBLIC_CONFIG.apiBaseUrl;
}

export function getWsBaseUrl(): string {
  return PUBLIC_CONFIG.wsBaseUrl;
}

export function getSupabaseUrl(): string {
  return PUBLIC_CONFIG.supabaseUrl;
}

export function getSupabaseAnonKey(): string {
  return PUBLIC_CONFIG.supabaseAnonKey;
}

