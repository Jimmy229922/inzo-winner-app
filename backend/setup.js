const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// --- Configuration Constants ---
// All hard-coded setup values are centralized here for easier management.
// IMPORTANT: This is only safe if your GitHub repository is PRIVATE.
const SETUP_CONFIG = {
    SUPABASE_URL: 'https://xfnqbtrnqnjlwpwfoahu.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmbnFidHJucW5qbHdwd2ZvYWh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MzU4NDksImV4cCI6MjA3NDExMTg0OX0.SDGmikg8YVcLULfuiByJCYSaqyWsSU0YXEXwtRreb8o',
    SUPABASE_SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmbnFidHJucW5qbHdwd2ZvYWh1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODUzNTg0OSwiZXhwIjoyMDc0MTExODQ5fQ.HwWyNma2esRzyr8_l4HggawjqKHJ_3n8lYUipUZU9xE',
    SUPER_ADMIN_EMAIL: 'ahmed12@inzo.com',
    TELEGRAM_BOT_TOKEN: '8284290450:AAFFhQlAMWliCY0jGTAct50GTNtF5NzLIec',
    TELEGRAM_CHAT_ID: '-4904232890'
};
// --- End of Configuration Constants ---

async function main() {
    console.log('\n--------------------------------------------------');
    console.log('Creating configuration file automatically...');
    console.log('--------------------------------------------------');

    // --- IMPORTANT SECURITY NOTICE ---
    // These keys are hard-coded for automatic setup.
    if (SETUP_CONFIG.SUPABASE_SERVICE_KEY === 'YOUR_REAL_SERVICE_KEY_HERE') {
        console.warn('\n[WARNING] The Supabase Service Key is a placeholder. Scheduled tasks might fail.');
        console.warn('          Please edit `backend/setup.js` and add the real key.\n');
    }

    const envContent = `
# Telegram Bot Configuration is now loaded from the database.

# Supabase Configuration (Hard-coded for automatic setup)
SUPABASE_URL=${SETUP_CONFIG.SUPABASE_URL}
SUPABASE_KEY=${SETUP_CONFIG.SUPABASE_ANON_KEY}
SUPABASE_SERVICE_KEY=${SETUP_CONFIG.SUPABASE_SERVICE_KEY}
`.trim();
 
    const envPath = path.join(__dirname, '.env');
    fs.writeFileSync(envPath, envContent);
    console.log('\n[OK] Configuration file created successfully at backend\\.env');

    // FIX: Reload dotenv to make the new variables available to the current process
    require('dotenv').config({ path: envPath, override: true });
    console.log('[INFO] Environment variables reloaded.');
}
async function ensureSuperAdmin() {
    console.log('\n--------------------------------------------------');
    console.log('Verifying Super Admin account...');
    console.log('--------------------------------------------------');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey === 'YOUR_REAL_SERVICE_KEY_HERE') {
        console.warn('[WARN] Cannot verify Super Admin. Supabase keys are not configured.');
        return;
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Check if the user exists in auth
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;

        const superAdminUser = users.find(u => u.email === SETUP_CONFIG.SUPER_ADMIN_EMAIL);

        if (!superAdminUser) {
            console.log(`[INFO] Super Admin user (${superAdminEmail}) not found. It will be created upon first login.`);
            return;
        }

        // 2. Check the role in the public 'users' table
        const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', superAdminUser.id)
            .single();
        
        // --- FIX: Handle case where profile doesn't exist yet ---
        if (profileError && profileError.code === 'PGRST116') {
            console.log(`[FIX] Profile for ${SETUP_CONFIG.SUPER_ADMIN_EMAIL} not found. Creating it...`);
            const { error: createProfileError } = await supabaseAdmin
                .from('users')
                .insert({
                    id: superAdminUser.id,
                    full_name: 'INZO LLC مدير عام',
                    role: 'super_admin',
                    permissions: { agents: { view_financials: true, edit_profile: true, edit_financials: true, can_view_competitions_tab: true }, competitions: { manage_comps: 'full', manage_templates: 'full', can_create: true } }
                });
            if (createProfileError) throw new Error(`Failed to create profile: ${createProfileError.message}`);
            console.log('[OK] Super Admin profile created and role set correctly.');
            return; // Exit after creating
        } else if (profileError) {
            throw new Error(`Could not fetch profile for ${SETUP_CONFIG.SUPER_ADMIN_EMAIL}: ${profileError.message}`);
        }

        // If profile exists, check and update the role
        if (userProfile.role !== 'super_admin') {
            console.log(`[FIX] Role for ${SETUP_CONFIG.SUPER_ADMIN_EMAIL} is '${userProfile.role}'. Updating to 'super_admin'...`);
            const { error: updateError } = await supabaseAdmin.from('users').update({ role: 'super_admin' }).eq('id', superAdminUser.id);
            if (updateError) throw updateError;
            console.log('[OK] Super Admin role has been set correctly.');
        } else {
            console.log('[OK] Super Admin role is already set correctly.');
        }
    } catch (error) {
        console.error(`[ERROR] Failed to verify/update Super Admin role: ${error.message}`);
    }
}

async function updateTelegramConfig() {
    console.log('\n--------------------------------------------------');
    console.log('Updating Telegram Bot configuration...');
    console.log('--------------------------------------------------');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey === 'YOUR_REAL_SERVICE_KEY_HERE') {
        console.warn('[WARN] Cannot update Telegram config. Supabase keys are not configured.');
        return;
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { error: tokenError } = await supabaseAdmin
            .from('app_config')
            .upsert({ key: 'TELEGRAM_BOT_TOKEN', value: SETUP_CONFIG.TELEGRAM_BOT_TOKEN }, { onConflict: 'key' });

        if (tokenError) throw new Error(`Failed to update Bot Token: ${tokenError.message}`);
        console.log('[OK] Telegram Bot Token updated successfully.');

        const { error: chatIdError } = await supabaseAdmin
            .from('app_config')
            .upsert({ key: 'TELEGRAM_CHAT_ID', value: SETUP_CONFIG.TELEGRAM_CHAT_ID }, { onConflict: 'key' });

        if (chatIdError) throw new Error(`Failed to update Chat ID: ${chatIdError.message}`);
        console.log('[OK] Telegram Chat ID updated successfully.');

    } catch (error) {
        console.error(`[ERROR] Failed to update Telegram configuration: ${error.message}`);
    }
}

(async () => {
    await main();
    await ensureSuperAdmin();
    await updateTelegramConfig(); // NEW: Update Telegram config after setup
    console.log('\nSetup complete. You can now start the server.');
})();