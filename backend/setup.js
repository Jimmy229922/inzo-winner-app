const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper function to ask questions using promises
function askQuestion(query) {
    return new Promise(resolve => rl.question(query, ans => {
        resolve(ans.trim());
    }));
}

async function main() {
    console.log('--------------------------------------------------');
    console.log('Configuring system settings...');
    console.log('Please provide the following details.');
    console.log('--------------------------------------------------');

    let telegramToken, telegramChatId, supabaseUrl, supabaseKey, supabaseServiceKey;

    while (!telegramToken) {
        telegramToken = await askQuestion('Enter your Telegram Bot Token: ');
        if (!telegramToken) console.log('Token cannot be empty. Please try again.');
    }

    while (!telegramChatId) {
        telegramChatId = await askQuestion('Enter your Telegram Channel/Group ID: ');
        if (!telegramChatId) console.log('Chat ID cannot be empty. Please try again.');
    }

    while (!supabaseUrl) {
        supabaseUrl = await askQuestion('Enter your Supabase Project URL: ');
        if (!supabaseUrl) console.log('Supabase URL cannot be empty. Please try again.');
    }

    while (!supabaseKey) {
        supabaseKey = await askQuestion('Enter your Supabase anon public Key: ');
        if (!supabaseKey) console.log('Supabase Key cannot be empty. Please try again.');
    }

    while (!supabaseServiceKey) {
        supabaseServiceKey = await askQuestion('Enter your Supabase service_role Key (for server tasks): ');
        if (!supabaseServiceKey) console.log('Supabase Service Key cannot be empty. Please try again.');
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

    rl.close();
}

main().catch(err => console.error(err));