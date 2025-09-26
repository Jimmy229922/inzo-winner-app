const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
    console.log('\n--------------------------------------------------');
    console.log('Creating configuration file automatically...');
    console.log('--------------------------------------------------');

    // --- IMPORTANT SECURITY NOTICE ---
    // These keys are hard-coded for automatic setup.
    // This is only safe if your GitHub repository is PRIVATE.
    const supabaseUrl = 'https://xfnqbtrnqnjlwpwfoahu.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmbnFidHJucW5qbHdwd2ZvYWh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MzU4NDksImV4cCI6MjA3NDExMTg0OX0.SDGmikg8YVcLULfuiByJCYSaqyWsSU0YXEXwtRreb8o';
    // !! IMPORTANT !! You must add your real service key here for scheduled tasks to work.
    const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmbnFidHJucW5qbHdwd2ZvYWh1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODUzNTg0OSwiZXhwIjoyMDc0MTExODQ5fQ.HwWyNma2esRzyr8_l4HggawjqKHJ_3n8lYUipUZU9xE'; 

    if (supabaseServiceKey === 'YOUR_REAL_SERVICE_KEY_HERE') {
        console.warn('\n[WARNING] The Supabase Service Key is a placeholder. Scheduled tasks might fail.');
        console.warn('          Please edit `backend/setup.js` and add the real key.\n');
    }

    const envContent = `
# Telegram Bot Configuration is now loaded from the database.

# Supabase Configuration (Hard-coded for automatic setup)
SUPABASE_URL=${supabaseUrl}
SUPABASE_KEY=${supabaseKey}
SUPABASE_SERVICE_KEY=${supabaseServiceKey}
`.trim();
 
    const envPath = path.join(__dirname, '.env');
    fs.writeFileSync(envPath, envContent);
    console.log('\n[OK] Configuration file created successfully at backend\\.env');
}

(async () => {
    await main();
    console.log('\nSetup complete. You can now start the server.');
})();