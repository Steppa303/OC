module.exports = {
  apps: [
    {
      name: 'trpg',
      script: 'server/index.js',
      cwd: '/root/.local/.openclaw/workspace/projects/trpg',
      env: {
        NODE_ENV: 'production',
        PORT: 3800,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
