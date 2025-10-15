(function createGenkiConfig(globalScope) {
  var config = {
    SUPABASE_URL: 'https://your-project-id.supabase.co',
    SUPABASE_ANON_KEY: 'public-anon-key'
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.GENKI_CONFIG = config;
  }

  if (globalScope && !globalScope.GENKI_CONFIG) {
    globalScope.GENKI_CONFIG = config;
  }
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : undefined);
