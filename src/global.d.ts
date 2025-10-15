import type { SupabaseClient } from '@supabase/supabase-js';

declare global {
  interface GenkiConfig {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
  }

  interface Window {
    supabase: {
      createClient: (url: string, key: string, options?: Record<string, unknown>) => SupabaseClient;
    };
    GENKI_CONFIG?: GenkiConfig;
  }

  interface ServiceWorkerGlobalScope {
    GENKI_CONFIG?: GenkiConfig;
  }
}

export {};
