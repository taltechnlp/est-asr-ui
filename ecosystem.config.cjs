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
    }
  ]
};
