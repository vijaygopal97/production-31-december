const fs = require('fs');
const path = require('path');

// Read .env file and parse it
const envPath = path.join(__dirname, 'backend', '.env');
let envVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        // Remove quotes if present
        envVars[key.trim()] = value.replace(/^["']|["']$/g, '');
      }
    }
  });
}

module.exports = {
  apps: [
    {
      name: 'opine-backend',
      script: 'server.js',
      cwd: '/var/www/opine/backend',
      instances: 5,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: envVars.NODE_ENV || 'development',
        PORT: envVars.PORT || 5000,
        JWT_SECRET: envVars.JWT_SECRET || 'your-secret-key',
        MONGODB_URI: envVars.MONGODB_URI,
        DB_NAME: envVars.DB_NAME,
        ...envVars // Spread all other env vars
      },
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      log_file: '../logs/backend-combined.log',
      time: true
    },
    {
      name: 'opine-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: '/var/www/opine/frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      error_file: '../logs/frontend-error.log',
      out_file: '../logs/frontend-out.log',
      log_file: '../logs/frontend-combined.log',
      time: true
    }
  ]
};
