declare const workbox: any;

type GenkiConfig = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
};

importScripts('/resources/javascript/config.js');
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

const swScope = self as unknown as ServiceWorkerGlobalScope & {
  GENKI_CONFIG?: GenkiConfig;
};
const precacheManifest = (self as any).__WB_MANIFEST || [];

if (!workbox) {
  console.warn('Workbox failed to load; offline support will be limited.');
}

const config = swScope.GENKI_CONFIG;
const supabaseOrigin = config ? new URL(config.SUPABASE_URL).origin : null;

workbox.core.setCacheNameDetails({
  prefix: 'genki',
  suffix: 'v1',
  precache: 'precache',
  runtime: 'runtime'
});

workbox.precaching.precacheAndRoute(precacheManifest, {
  ignoreURLParametersMatching: [/.*/]
});

workbox.core.skipWaiting();
workbox.core.clientsClaim();

workbox.routing.registerRoute(
  ({ request }: { request: Request }) => request.mode === 'navigate',
  new workbox.strategies.NetworkFirst({
    cacheName: 'genki-pages',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 40,
        purgeOnQuotaError: true
      })
    ]
  })
);

workbox.routing.registerRoute(
  ({ url }: { url: URL }) => url.pathname.startsWith('/resources/css/'),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'genki-styles'
  })
);

workbox.routing.registerRoute(
  ({ url }: { url: URL }) => url.pathname.startsWith('/resources/javascript/'),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'genki-scripts'
  })
);

workbox.routing.registerRoute(
  ({ url }: { url: URL }) => url.pathname.startsWith('/resources/images/'),
  new workbox.strategies.CacheFirst({
    cacheName: 'genki-images',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        purgeOnQuotaError: true
      })
    ]
  })
);

workbox.routing.registerRoute(
  ({ url }: { url: URL }) => url.pathname.startsWith('/resources/audio/'),
  new workbox.strategies.CacheFirst({
    cacheName: 'genki-audio',
    plugins: [
      new workbox.rangeRequests.RangeRequestsPlugin(),
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 40,
        purgeOnQuotaError: true
      })
    ]
  })
);

if (supabaseOrigin) {
  const supabaseQueue = new workbox.backgroundSync.BackgroundSyncPlugin('supabase-sync-queue', {
    maxRetentionTime: 24 * 60
  });

  const queueingStrategy = new workbox.strategies.NetworkOnly({
    cacheName: 'supabase-runtime',
    plugins: [supabaseQueue]
  });

  ['POST', 'PUT', 'PATCH', 'DELETE'].forEach((method) => {
    workbox.routing.registerRoute(
      ({ url, request }: { url: URL; request: Request }) =>
        url.origin === supabaseOrigin && request.method === method,
      queueingStrategy,
      method
    );
  });
}

swScope.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    swScope.skipWaiting();
  }
});
