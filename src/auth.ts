import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
}

export class AuthController {
  private supabase: SupabaseClient | null = null;
  private state: AuthState = {
    status: 'loading',
    session: null,
    user: null
  };
  private listeners = new Set<(state: AuthState) => void>();
  private initialized = false;

  async init(): Promise<AuthState> {
    if (this.initialized) {
      return this.state;
    }

    const config = this.getConfig();
    const supabaseClient = this.createClient(config);

    this.supabase = supabaseClient;
    this.initialized = true;

    const { data } = await supabaseClient.auth.getSession();
    const session = data.session ?? null;
    this.updateState(session ? 'authenticated' : 'unauthenticated', session);

    supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      this.updateState(nextSession ? 'authenticated' : 'unauthenticated', nextSession);
    });

    return this.state;
  }

  get currentState(): AuthState {
    return this.state;
  }

  get client(): SupabaseClient {
    if (!this.supabase) {
      throw new Error('Supabase client is not initialised yet.');
    }
    return this.supabase;
  }

  onChange(callback: (state: AuthState) => void): () => void {
    this.listeners.add(callback);
    callback(this.state);
    return () => {
      this.listeners.delete(callback);
    };
  }

  async signInWithOtp(email: string): Promise<void> {
    const supabaseClient = this.client;
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + '/',
        shouldCreateUser: false
      }
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async signOut(): Promise<void> {
    const supabaseClient = this.client;
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }

  private updateState(status: AuthStatus, session: Session | null): void {
    this.state = {
      status,
      session,
      user: session?.user ?? null
    };
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Auth listener error', error);
      }
    });
  }

  private getConfig(): GenkiConfig {
    const config = window.GENKI_CONFIG;
    if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
      throw new Error('Supabase credentials are missing. Ensure config.js is loaded.');
    }
    return config;
  }

  private createClient(config: GenkiConfig): SupabaseClient {
    const supabaseGlobal = window.supabase;
    if (!supabaseGlobal || typeof supabaseGlobal.createClient !== 'function') {
      throw new Error('Supabase library is not available on window.supabase.');
    }

    return supabaseGlobal.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'genki-supabase-auth'
      }
    });
  }
}

export const authController = new AuthController();
