module.exports = {
  globDirectory: '.',
  globPatterns: [
    'index.html',
    'login.html',
    '404.html',
    'manifest.webmanifest',
    'resources/css/**/*.css',
    'resources/javascript/**/*.js',
    'resources/images/**/*.{png,svg,webp,ico}',
    'resources/fonts/**/*.{woff,woff2,ttf,otf}'
  ],
  globIgnores: [
    'node_modules/**/*',
    'resources/javascript/sw.js',
    'resources/javascript/config.js',
    'resources/javascript/*.map',
    'resources/javascript/modules/**/*.map'
  ],
  swSrc: 'build/sw.js',
  swDest: 'resources/javascript/sw.js',
  maximumFileSizeToCacheInBytes: 15 * 1024 * 1024
};
