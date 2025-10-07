module.exports = {
  apps: [
    {
      name: 'sveltekit',
      script: 'build/index.js',
      interpreter: 'bun',
      cwd: '/home/aiolev/est-asr-ui',
      env: {
        ORIGIN: 'https://uus.tekstiks.ee',
        BODY_SIZE_LIMIT: 'Infinity',
        PORT: '5173',
        HOST: '127.0.0.1',
        NODE_ENV: 'production'
      }
    },
    {
      name: 'prelive-sveltekit',
      script: 'build/index.js',
      interpreter: 'bun',
      cwd: '/home/aiolev/est-asr-ui',
      env: {
        ORIGIN: 'https://tekstiks.ee',
        BODY_SIZE_LIMIT: 'Infinity',
        PORT: '5180',
        HOST: '127.0.0.1',
        NODE_ENV: 'production'
      }
    }
  ]
};
