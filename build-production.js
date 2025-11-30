/**
 * Production Build Script for INZO Winner App
 * 
 * This script prepares the application for production deployment by:
 * 1. Cleaning existing build artifacts
 * 2. Building optimized CSS and JS bundles
 * 3. Validating essential files
 * 4. Displaying deployment instructions
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(60));
    log(`  ${title}`, colors.bright + colors.cyan);
    console.log('='.repeat(60) + '\n');
}

function logSuccess(message) {
    log(`✅ ${message}`, colors.green);
}

function logWarning(message) {
    log(`⚠️  ${message}`, colors.yellow);
}

function logError(message) {
    log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
    log(`ℹ️  ${message}`, colors.blue);
}

async function main() {
    try {
        logSection('🚀 INZO Winner App - Production Build');
        
        // Step 1: Clean dist folder
        logSection('🧹 Step 1: Cleaning Build Artifacts');
        const distPath = path.join(__dirname, 'frontend', 'dist');
        
        if (fs.existsSync(distPath)) {
            logInfo('Removing existing dist folder...');
            fs.rmSync(distPath, { recursive: true, force: true });
            logSuccess('Cleaned dist folder');
        } else {
            logInfo('No existing dist folder found');
        }
        
        logInfo('Creating fresh dist folder...');
        fs.mkdirSync(distPath, { recursive: true });
        logSuccess('Created dist directory');

        // Step 2: Build bundles
        logSection('📦 Step 2: Building CSS and JS Bundles');
        logInfo('Running build.js...');
        
        try {
            execSync('node build.js', { 
                stdio: 'inherit',
                cwd: __dirname 
            });
            logSuccess('Bundles created successfully');
        } catch (error) {
            logError('Failed to create bundles');
            throw error;
        }

        // Step 3: Validate build outputs
        logSection('✔️  Step 3: Validating Build Outputs');
        
        const cssBundlePath = path.join(distPath, 'bundle.css');
        const jsBundlePath = path.join(distPath, 'bundle.js');
        
        let validationPassed = true;
        
        if (fs.existsSync(cssBundlePath)) {
            const cssSize = fs.statSync(cssBundlePath).size;
            logSuccess(`bundle.css exists (${(cssSize / 1024).toFixed(2)} KB)`);
        } else {
            logError('bundle.css not found!');
            validationPassed = false;
        }
        
        if (fs.existsSync(jsBundlePath)) {
            const jsSize = fs.statSync(jsBundlePath).size;
            logSuccess(`bundle.js exists (${(jsSize / 1024).toFixed(2)} KB)`);
        } else {
            logError('bundle.js not found!');
            validationPassed = false;
        }

        if (!validationPassed) {
            throw new Error('Build validation failed');
        }

        // Step 4: Check environment configuration
        logSection('⚙️  Step 4: Environment Configuration Check');
        
        const backendEnvPath = path.join(__dirname, 'backend', '.env');
        const backendEnvProdPath = path.join(__dirname, 'backend', '.env.production');
        
        if (fs.existsSync(backendEnvPath)) {
            logSuccess('.env file exists in backend/');
        } else {
            logWarning('.env file not found in backend/ - create it before deployment');
        }
        
        if (fs.existsSync(backendEnvProdPath)) {
            logInfo('.env.production file found - remember to review it');
        } else {
            logWarning('.env.production not found - create it for production settings');
        }

        // Step 5: Summary and next steps
        logSection('🎉 Production Build Completed Successfully!');
        
        log('\n📋 Build Summary:', colors.bright);
        logSuccess('CSS and JS bundles created in frontend/dist/');
        logSuccess('Build artifacts validated');
        logSuccess('Application ready for deployment');

        logSection('📝 Next Steps for Deployment');
        
        console.log(`
${colors.yellow}1. Configure Production Environment:${colors.reset}
   - Review and update: backend/.env.production
   - Set NODE_ENV=production
   - Configure production database URI
   - Set secure JWT_SECRET
   - Configure Telegram bot credentials

${colors.yellow}2. Install Production Dependencies:${colors.reset}
   cd backend
   npm ci --only=production

${colors.yellow}3. Upload to Production Server:${colors.reset}
   - Upload entire project (excluding node_modules, .env)
   - Or use git pull on server
   - Ensure .gitignore is properly configured

${colors.yellow}4. Server Setup:${colors.reset}
   # Install dependencies
   cd backend && npm install --production

   # Run database migrations
   npm run migrate:templates
   npm run migrate:competitions:types

   # Create super admin (first time only)
   node scripts/create-superadmin.js

${colors.yellow}5. Start Application:${colors.reset}
   
   ${colors.green}Option A - Direct:${colors.reset}
   cd backend
   NODE_ENV=production node server.js

   ${colors.green}Option B - PM2 (Recommended):${colors.reset}
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup

${colors.yellow}6. Configure Nginx (if applicable):${colors.reset}
   - Set up reverse proxy to port 30001
   - Configure SSL/TLS certificates
   - Enable gzip compression

${colors.yellow}7. Monitor:${colors.reset}
   pm2 logs inzo-backend
   pm2 monit
        `);

        logSection('📚 Additional Resources');
        
        console.log(`
${colors.cyan}Documentation:${colors.reset}
   - Full cleanup plan: PRODUCTION_CLEANUP_PLAN.md
   - Competition flow: docs/COMPETITION_WINNERS_FLOW_AR.md

${colors.cyan}Important Files:${colors.reset}
   - Frontend entry: frontend/index.html
   - Backend entry: backend/server.js
   - PM2 config: ecosystem.config.js
   - Git ignore: .gitignore

${colors.cyan}Cleanup Recommendations:${colors.reset}
   See PRODUCTION_CLEANUP_PLAN.md for:
   - Files to remove before deployment
   - Development vs Production files
   - Security best practices
        `);

        logSection('✨ Build Process Complete');
        
        logSuccess('Your application is ready for production deployment!');
        log('\n💡 Remember to:', colors.bright);
        console.log('   • Test thoroughly in staging environment first');
        console.log('   • Backup your database before deployment');
        console.log('   • Keep development backups before cleaning files');
        console.log('   • Review PRODUCTION_CLEANUP_PLAN.md\n');

    } catch (error) {
        logSection('❌ Build Failed');
        logError(`Error: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

// Run the build
main();
