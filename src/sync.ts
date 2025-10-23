import type { PostgrestError, SupabaseClient, User } from '@supabase/supabase-js';

type PreferencePayload = Record<string, string>;
type ProgressPayload = Record<string, string>;

export interface SyncMeta {
  preferenceHash: string | null;
  progressHash: string | null;
  preferenceLastSyncedAt: string | null;
  progressLastSyncedAt: string | null;
  preferenceRemoteUpdatedAt: string | null;
  progressRemoteUpdatedAt: string | null;
}

const META_STORAGE_KEY = '__genki_sync_meta__';
const PROGRESS_KEYS = new Set(['Results', 'customVocab', 'customSpelling', 'customQuiz', 'customWrittenQuiz']);
const PROGRESS_PREFIXES = ['progress_', 'study_', 'genkiResults_', 'customResults_'];
const RESERVED_PREF_KEYS = new Set(['genki-supabase-auth']);

export class SyncController {
  private supabase: SupabaseClient | null = null;
  private user: User | null = null;
  private meta: SyncMeta = {
    preferenceHash: null,
    progressHash: null,
    preferenceLastSyncedAt: null,
    progressLastSyncedAt: null,
    preferenceRemoteUpdatedAt: null,
    progressRemoteUpdatedAt: null
  };
  private pollHandle: number | null = null;
  private isPushing = false;

  init(client: SupabaseClient, user: User): void {
    this.supabase = client;
    this.user = user;
    this.meta = this.loadMeta();
    this.emitMetaUpdate();
    void this.pullRemote();
    this.startPolling();
    window.addEventListener('storage', this.handleCrossTabUpdate);
    window.addEventListener('online', this.handleOnline);
  }

  destroy(): void {
    if (this.pollHandle !== null) {
      window.clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    window.removeEventListener('storage', this.handleCrossTabUpdate);
    window.removeEventListener('online', this.handleOnline);
    this.supabase = null;
    this.user = null;
  }

  manualSync(): void {
    void this.pushChanges();
  }

  private startPolling(): void {
    if (this.pollHandle !== null) {
      return;
    }
    this.pollHandle = window.setInterval(() => {
      void this.pushChanges();
    }, 10_000);
  }

  private handleCrossTabUpdate = (): void => {
    void this.pushChanges();
  };

  private handleOnline = (): void => {
    void this.pushChanges();
  };

  private async pullRemote(): Promise<void> {
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
        this.applyRemotePreferences(preferenceData.settings as PreferencePayload, preferenceData.updated_at as string);
      }

      if (progressData?.payload) {
        this.applyRemoteProgress(progressData.payload as ProgressPayload, progressData.updated_at as string);
      }

      this.emitMetaUpdate();
    } catch (error) {
      console.warn('Unexpected error while pulling remote data', error);
    }
  }

  private async pushChanges(): Promise<void> {
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
        const { error } = await client.from('profile_settings').upsert(
          {
            user_id: user.id,
            settings: preferences,
            updated_at: now
          },
          {
            onConflict: 'user_id'
          }
        );

        if (error) {
          throw error;
        }

        meta.preferenceHash = preferenceHash;
        meta.preferenceLastSyncedAt = now;
        meta.preferenceRemoteUpdatedAt = now;
      }

      if (progressChanged) {
        const { error } = await client.from('progress_snapshots').upsert(
          {
            user_id: user.id,
            key: 'local_storage',
            payload: progress,
            updated_at: now
          },
          {
            onConflict: 'user_id,key'
          }
        );

        if (error) {
          throw error;
        }

        meta.progressHash = progressHash;
        meta.progressLastSyncedAt = now;
        meta.progressRemoteUpdatedAt = now;
      }

      this.saveMeta(meta);
      this.emitMetaUpdate();
    } catch (error) {
      console.warn('Failed pushing local changes, they will retry when connectivity returns.', error);
    } finally {
      this.isPushing = false;
    }
  }

  private applyRemotePreferences(payload: PreferencePayload, updatedAtIso: string): void {
    const meta = this.meta;
    const updatedAt = new Date(updatedAtIso).toISOString();

    if (meta.preferenceLastSyncedAt && updatedAt <= meta.preferenceLastSyncedAt) {
      return;
    }

    Object.entries(payload).forEach(([key, value]) => {
      if (RESERVED_PREF_KEYS.has(key)) {
        return;
      }
      try {
        localStorage.setItem(key, value);
      } catch (storageError) {
        console.warn(`Failed applying preference ${key}`, storageError);
      }
    });

    meta.preferenceHash = computeHash(payload);
    meta.preferenceRemoteUpdatedAt = updatedAt;
    this.saveMeta(meta);
    this.emitMetaUpdate();
  }

  private applyRemoteProgress(payload: ProgressPayload, updatedAtIso: string): void {
    const meta = this.meta;
    const updatedAt = new Date(updatedAtIso).toISOString();

    if (meta.progressLastSyncedAt && updatedAt <= meta.progressLastSyncedAt) {
      return;
    }

    Object.entries(payload).forEach(([key, value]) => {
      try {
        localStorage.setItem(key, value);
      } catch (storageError) {
        console.warn(`Failed applying progress ${key}`, storageError);
      }
    });

    meta.progressHash = computeHash(payload);
    meta.progressRemoteUpdatedAt = updatedAt;
    this.saveMeta(meta);
    this.emitMetaUpdate();
  }

  private captureLocalState(): { preferences: PreferencePayload; progress: ProgressPayload } {
    const preferences: PreferencePayload = {};
    const progress: ProgressPayload = {};

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
      } else if (!RESERVED_PREF_KEYS.has(key)) {
        preferences[key] = value;
      }
    }

    return {
      preferences,
      progress
    };
  }

  private loadMeta(): SyncMeta {
    const fallback: SyncMeta = {
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
      const parsed = JSON.parse(raw) as SyncMeta;
      return { ...fallback, ...parsed };
    } catch (error) {
      console.warn('Failed reading sync metadata, resetting state.', error);
      return fallback;
    }
  }

  private saveMeta(meta: SyncMeta): void {
    try {
      localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
    } catch (error) {
      console.warn('Unable to persist sync metadata.', error);
    }
  }

  private emitMetaUpdate(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.dispatchEvent(
        new CustomEvent('genki-sync-meta', {
          detail: { meta: this.meta }
        })
      );
    } catch (error) {
      console.warn('Unable to dispatch sync metadata event.', error);
    }
  }
}

function isRowNotFound(error: PostgrestError): boolean {
  return error.code === 'PGRST116';
}

function isProgressKey(key: string): boolean {
  if (PROGRESS_KEYS.has(key)) {
    return true;
  }
  return PROGRESS_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function computeHash(record: Record<string, string>): string {
  const entries = Object.entries(record).sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0));
  return JSON.stringify(entries);
}

export const syncController = new SyncController();
