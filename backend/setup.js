const fs = require('fs');
const path = require('path');

function main() {
    console.log('--------------------------------------------------');
    console.log('Creating configuration file automatically...');
    console.log('--------------------------------------------------');

    // --- IMPORTANT SECURITY NOTICE ---
    // These keys are hard-coded for automatic setup.
    // This is only safe if your GitHub repository is PRIVATE.
    // Do NOT make the repository public with these keys inside.
    const telegramToken = '8284290450:AAFFhQlAMWliCY0jGTAct50GTNtF5NzLIec';
    const telegramChatId = '-4904232890';
    const supabaseUrl = 'https://xfnqbtrnqnjlwpwfoahu.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmbnFidHJucW5qbHdwd2ZvYWh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MzU4NDksImV4cCI6MjA3NDExMTg0OX0.SDGmikg8YVcLULfuiByJCYSaqyWsSU0YXEXwtRreb8o';
    // !! IMPORTANT !! You must add your real service key here for scheduled tasks to work.
    const supabaseServiceKey = 'YOUR_REAL_SERVICE_KEY_HERE'; 

    if (supabaseServiceKey === 'YOUR_REAL_SERVICE_KEY_HERE') {
        console.warn('\n[WARNING] The Supabase Service Key is a placeholder. Scheduled tasks might fail.');
        console.warn('          Please edit `backend/setup.js` and add the real key.\n');
    }

    const envContent = `
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=${telegramToken}
TELEGRAM_CHAT_ID=${telegramChatId}
 
# Supabase Configuration
SUPABASE_URL=${supabaseUrl}
SUPABASE_KEY=${supabaseKey}
SUPABASE_SERVICE_KEY=${supabaseServiceKey}
`.trim();
 
    const envPath = path.join(__dirname, '.env');
    fs.writeFileSync(envPath, envContent);
    console.log('\n[OK] Configuration file created successfully at backend\\.env');
}

main();