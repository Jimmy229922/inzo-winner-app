const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// --- Configuration Constants ---
// These values are used to create the initial .env file for the new MongoDB-based backend.
const SETUP_CONFIG = {
    MONGODB_URI: 'mongodb://localhost:27017/inzo-winner-app',
    JWT_SECRET: 'your-super-secret-and-long-jwt-secret-key-change-me',
    SUPER_ADMIN_EMAIL: 'admin@inzo.com',
    SUPER_ADMIN_PASSWORD: 'super-secure-password-change-me',
    PORT: 30001
};
// --- End of Configuration Constants ---

async function createEnvFile() {
    console.log('\n--------------------------------------------------');
    console.log('Creating configuration file automatically...');
    console.log('--------------------------------------------------');

    const envContent = `
# MongoDB Configuration
MONGODB_URI=${SETUP_CONFIG.MONGODB_URI}

# JWT (JSON Web Token) Configuration
JWT_SECRET=${SETUP_CONFIG.JWT_SECRET}

# Initial Super Admin Credentials (used on first run only)
SUPER_ADMIN_EMAIL=${SETUP_CONFIG.SUPER_ADMIN_EMAIL}
SUPER_ADMIN_PASSWORD=${SETUP_CONFIG.SUPER_ADMIN_PASSWORD}

# Server Port
PORT=${SETUP_CONFIG.PORT}
`.trim();
 
    const envPath = path.join(__dirname, '.env');
    fs.writeFileSync(envPath, envContent);
    console.log('\n[OK] Configuration file created successfully at backend\\.env');
}

(async () => {
    await createEnvFile();
    console.log('\nSetup complete. You can now start the server.');
})();