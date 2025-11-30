/**
 * PM2 Ecosystem Configuration for INZO Winner App
 * 
 * This configuration file is used by PM2 process manager to:
 * - Run the application in production mode
 * - Enable clustering for better performance
 * - Configure automatic restarts
 * - Set up logging
 * 
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    {
      // Application name
      name: 'inzo-backend',
      
      // Script to run
      script: './server.js',
      
      // Working directory
      cwd: './backend',
      
      // Number of instances (use max for all CPU cores, or specify a number)
      instances: 1, // Change to 'max' or 2+ for clustering
      
      // Execution mode: cluster or fork
      exec_mode: 'fork', // Change to 'cluster' if instances > 1
      
      // Environment variables for production
      env_production: {
        NODE_ENV: 'production',
        PORT: 30001,
        TZ: 'Asia/Baghdad'
      },
      
      // Environment variables for development (optional)
      env_development: {
        NODE_ENV: 'development',
        PORT: 30001,
        TZ: 'Asia/Baghdad'
      },
      
      // Logging configuration
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Memory management
      max_memory_restart: '1G', // Restart if memory exceeds 1GB
      
      // Watch for file changes (disable in production)
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads'],
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Source map support (for debugging)
      source_map_support: false,
      
      // Instance variables
      instance_var: 'INSTANCE_ID',
      
      // Interpreter (default is node)
      interpreter: 'node',
      
      // Cron restart pattern (optional)
      // cron_restart: '0 3 * * *', // Restart at 3 AM daily
      
      // Post deployment commands (optional)
      post_update: [
        'npm install --production',
        'npm run migrate:templates',
        'npm run migrate:competitions:types'
      ].join(' && '),
      
      // Time zone
      time: true
    }
  ],

  /**
   * Deployment configuration (optional)
   * Uncomment and configure if using PM2 deploy functionality
   */
  /*
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-production-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:Jimmy229922/inzo-winner-app.git',
      path: '/var/www/inzo-winner-app',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': '',
      'post-setup': 'npm install --production && npm run migrate:templates && npm run migrate:competitions:types'
    },
    
    staging: {
      user: 'deploy',
      host: 'your-staging-server.com',
      ref: 'origin/develop',
      repo: 'git@github.com:Jimmy229922/inzo-winner-app.git',
      path: '/var/www/inzo-winner-app-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env development'
    }
  }
  */
};

/**
 * PM2 Commands Reference:
 * 
 * Start the app:
 *   pm2 start ecosystem.config.js --env production
 * 
 * List all processes:
 *   pm2 list
 * 
 * Monitor processes:
 *   pm2 monit
 * 
 * View logs:
 *   pm2 logs inzo-backend
 *   pm2 logs inzo-backend --lines 100
 * 
 * Restart the app:
 *   pm2 restart inzo-backend
 * 
 * Reload (zero-downtime):
 *   pm2 reload inzo-backend
 * 
 * Stop the app:
 *   pm2 stop inzo-backend
 * 
 * Delete from PM2:
 *   pm2 delete inzo-backend
 * 
 * Save process list:
 *   pm2 save
 * 
 * Resurrect saved processes:
 *   pm2 resurrect
 * 
 * Setup startup script:
 *   pm2 startup
 *   (follow the instructions shown)
 * 
 * Update PM2:
 *   pm2 update
 * 
 * Cluster mode (multiple instances):
 *   Change instances to 'max' or a number > 1
 *   Change exec_mode to 'cluster'
 *   pm2 reload ecosystem.config.js --env production
 */
