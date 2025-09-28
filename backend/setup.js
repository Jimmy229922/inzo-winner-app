const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
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
    const superAdminEmail = 'ahmed12@inzo.com';

    try {
        // 1. Check if the user exists in auth
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;

        const superAdminUser = users.find(u => u.email === superAdminEmail);

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

        if (profileError) throw new Error(`Could not fetch profile for ${superAdminEmail}: ${profileError.message}`);

        if (userProfile.role !== 'super_admin') {
            console.log(`[FIX] Role for ${superAdminEmail} is '${userProfile.role}'. Updating to 'super_admin'...`);
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

(async () => {
    await main();
    await ensureSuperAdmin();
    console.log('\nSetup complete. You can now start the server.');
})();