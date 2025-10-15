const META_STORAGE_KEY = '__genki_sync_meta__';
const PROGRESS_KEYS = new Set(['Results', 'customVocab', 'customSpelling', 'customQuiz', 'customWrittenQuiz']);
const PROGRESS_PREFIXES = ['progress_', 'study_', 'genkiResults_', 'customResults_'];
export class SyncController {
    constructor() {
        this.supabase = null;
        this.user = null;
        this.meta = {
            preferenceHash: null,
            progressHash: null,
            preferenceLastSyncedAt: null,
            progressLastSyncedAt: null,
            preferenceRemoteUpdatedAt: null,
            progressRemoteUpdatedAt: null
        };
        this.pollHandle = null;
        this.isPushing = false;
        this.handleCrossTabUpdate = () => {
            void this.pushChanges();
        };
        this.handleOnline = () => {
            void this.pushChanges();
        };
    }
    init(client, user) {
        this.supabase = client;
        this.user = user;
        this.meta = this.loadMeta();
        void this.pullRemote();
        this.startPolling();
        window.addEventListener('storage', this.handleCrossTabUpdate);
        window.addEventListener('online', this.handleOnline);
    }
    destroy() {
        if (this.pollHandle !== null) {
            window.clearInterval(this.pollHandle);
            this.pollHandle = null;
        }
        window.removeEventListener('storage', this.handleCrossTabUpdate);
        window.removeEventListener('online', this.handleOnline);
        this.supabase = null;
        this.user = null;
    }
    manualSync() {
        void this.pushChanges();
    }
    startPolling() {
        if (this.pollHandle !== null) {
            return;
        }
        this.pollHandle = window.setInterval(() => {
            void this.pushChanges();
        }, 10000);
    }
    async pullRemote() {
        const client = this.supabase;
        const user = this.user;
        if (!client || !user) {
            return;
        }
        try {
            const [{ data: preferenceData, error: preferenceError }, { data: progressData, error: progressError }] = await Promise.all([
                client
                    .from('profile_settings')
                    .select('settings, updated_at')
                    .eq('user_id', user.id)
                    .maybeSingle(),
                client
                    .from('progress_snapshots')
                    .select('payload, updated_at')
                    .eq('user_id', user.id)
                    .eq('key', 'local_storage')
                    .maybeSingle()
            ]);
            if (preferenceError && !isRowNotFound(preferenceError)) {
                console.warn('Failed loading preferences from Supabase', preferenceError.message);
            }
            if (progressError && !isRowNotFound(progressError)) {
                console.warn('Failed loading progress from Supabase', progressError.message);
            }
            if (preferenceData?.settings) {
                this.applyRemotePreferences(preferenceData.settings, preferenceData.updated_at);
            }
            if (progressData?.payload) {
                this.applyRemoteProgress(progressData.payload, progressData.updated_at);
            }
        }
        catch (error) {
            console.warn('Unexpected error while pulling remote data', error);
        }
    }
    async pushChanges() {
        if (this.isPushing) {
            return;
        }
        const client = this.supabase;
        const user = this.user;
        if (!client || !user) {
            return;
        }
        const { preferences, progress } = this.captureLocalState();
        const preferenceHash = computeHash(preferences);
        const progressHash = computeHash(progress);
        const meta = this.meta;
        const preferenceChanged = preferenceHash !== meta.preferenceHash;
        const progressChanged = progressHash !== meta.progressHash;
        if (!preferenceChanged && !progressChanged) {
            return;
        }
        this.isPushing = true;
        const now = new Date().toISOString();
        try {
            if (preferenceChanged) {
                const { error } = await client.from('profile_settings').upsert({
                    user_id: user.id,
                    settings: preferences,
                    updated_at: now
                }, {
                    onConflict: 'user_id'
                });
                if (error) {
                    throw error;
                }
                meta.preferenceHash = preferenceHash;
                meta.preferenceLastSyncedAt = now;
                meta.preferenceRemoteUpdatedAt = now;
            }
            if (progressChanged) {
                const { error } = await client.from('progress_snapshots').upsert({
                    user_id: user.id,
                    key: 'local_storage',
                    payload: progress,
                    updated_at: now
                }, {
                    onConflict: 'user_id,key'
                });
                if (error) {
                    throw error;
                }
                meta.progressHash = progressHash;
                meta.progressLastSyncedAt = now;
                meta.progressRemoteUpdatedAt = now;
            }
            this.saveMeta(meta);
        }
        catch (error) {
            console.warn('Failed pushing local changes, they will retry when connectivity returns.', error);
        }
        finally {
            this.isPushing = false;
        }
    }
    applyRemotePreferences(payload, updatedAtIso) {
        const meta = this.meta;
        const updatedAt = new Date(updatedAtIso).toISOString();
        if (meta.preferenceLastSyncedAt && updatedAt <= meta.preferenceLastSyncedAt) {
            return;
        }
        Object.entries(payload).forEach(([key, value]) => {
            try {
                localStorage.setItem(key, value);
            }
            catch (storageError) {
                console.warn(`Failed applying preference ${key}`, storageError);
            }
        });
        meta.preferenceHash = computeHash(payload);
        meta.preferenceRemoteUpdatedAt = updatedAt;
        this.saveMeta(meta);
    }
    applyRemoteProgress(payload, updatedAtIso) {
        const meta = this.meta;
        const updatedAt = new Date(updatedAtIso).toISOString();
        if (meta.progressLastSyncedAt && updatedAt <= meta.progressLastSyncedAt) {
            return;
        }
        Object.entries(payload).forEach(([key, value]) => {
            try {
                localStorage.setItem(key, value);
            }
            catch (storageError) {
                console.warn(`Failed applying progress ${key}`, storageError);
            }
        });
        meta.progressHash = computeHash(payload);
        meta.progressRemoteUpdatedAt = updatedAt;
        this.saveMeta(meta);
    }
    captureLocalState() {
        const preferences = {};
        const progress = {};
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key) {
                continue;
            }
            const value = localStorage.getItem(key);
            if (typeof value !== 'string') {
                continue;
            }
            if (isProgressKey(key)) {
                progress[key] = value;
            }
            else {
                preferences[key] = value;
            }
        }
        return {
            preferences,
            progress
        };
    }
    loadMeta() {
        const fallback = {
            preferenceHash: null,
            progressHash: null,
            preferenceLastSyncedAt: null,
            progressLastSyncedAt: null,
            preferenceRemoteUpdatedAt: null,
            progressRemoteUpdatedAt: null
        };
        try {
            const raw = localStorage.getItem(META_STORAGE_KEY);
            if (!raw) {
                return fallback;
            }
            const parsed = JSON.parse(raw);
            return { ...fallback, ...parsed };
        }
        catch (error) {
            console.warn('Failed reading sync metadata, resetting state.', error);
            return fallback;
        }
    }
    saveMeta(meta) {
        try {
            localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
        }
        catch (error) {
            console.warn('Unable to persist sync metadata.', error);
        }
    }
}
function isRowNotFound(error) {
    return error.code === 'PGRST116';
}
function isProgressKey(key) {
    if (PROGRESS_KEYS.has(key)) {
        return true;
    }
    return PROGRESS_PREFIXES.some((prefix) => key.startsWith(prefix));
}
function computeHash(record) {
    const entries = Object.entries(record).sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0));
    return JSON.stringify(entries);
}
export const syncController = new SyncController();
