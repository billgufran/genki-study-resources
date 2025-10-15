export class AuthController {
    constructor() {
        this.supabase = null;
        this.state = {
            status: 'loading',
            session: null,
            user: null
        };
        this.listeners = new Set();
        this.initialized = false;
    }
    async init() {
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
    get currentState() {
        return this.state;
    }
    get client() {
        if (!this.supabase) {
            throw new Error('Supabase client is not initialised yet.');
        }
        return this.supabase;
    }
    onChange(callback) {
        this.listeners.add(callback);
        callback(this.state);
        return () => {
            this.listeners.delete(callback);
        };
    }
    async signInWithOtp(email) {
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
    async signOut() {
        const supabaseClient = this.client;
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            throw new Error(error.message);
        }
    }
    updateState(status, session) {
        this.state = {
            status,
            session,
            user: session?.user ?? null
        };
        this.listeners.forEach((listener) => {
            try {
                listener(this.state);
            }
            catch (error) {
                console.error('Auth listener error', error);
            }
        });
    }
    getConfig() {
        const config = window.GENKI_CONFIG;
        if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
            throw new Error('Supabase credentials are missing. Ensure config.js is loaded.');
        }
        return config;
    }
    createClient(config) {
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
