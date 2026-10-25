module.exports = {
  apps: [
    {
      name: 'sveltekit',
      script: 'build/index.js',
      interpreter: '/home/aiolev/.bun/bin/bun',
      cwd: '/home/aiolev/est-asr-ui',
      env: {
        ORIGIN: 'https://tekstiks.ee',
        BODY_SIZE_LIMIT: 'Infinity',
        PORT: '5180',
        HOST: '127.0.0.1',
        NODE_ENV: 'production'
      }
    },
    {
      name: 'asr-watchdog',
      script: 'scripts/asr-watchdog.mjs',
      interpreter: '/usr/bin/node',
      cwd: '/home/aiolev/est-asr-ui',
      restart_delay: 10000,
      env: {
        ASR_WATCHDOG_PM2: '/usr/local/bin/pm2'
      }
    }
  ]
};
