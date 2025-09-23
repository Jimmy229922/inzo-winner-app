// تحميل المكتبات اللازمة
require('dotenv').config(); // لتحميل المتغيرات من ملف .env
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');
const cron = require('node-cron');

const app = express();
const port = 3000;

// Middlewares
app.use(cors()); // للسماح للـ Frontend بالتواصل مع الـ Backend
app.use(express.json()); // لتحليل البيانات القادمة بصيغة JSON

// استخراج بيانات التيليجرام من ملف .env
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// --- Supabase Admin Client ---
// This client uses the SERVICE_ROLE key and bypasses all RLS policies.
// It should ONLY be used on the server.
let supabaseAdmin;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY && process.env.SUPABASE_SERVICE_KEY !== 'YOUR_REAL_SERVICE_KEY_HERE') {
    const { createClient } = require('@supabase/supabase-js');
    supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    console.log('[INFO] Supabase admin client initialized.');
} else {
    console.warn('[WARN] Supabase admin client not initialized. SUPABASE_SERVICE_KEY is missing or is a placeholder. Scheduled tasks will fail. Please run setup.bat again.');
}

// --- Main API Router ---
const apiRouter = express.Router();

// Endpoint to provide public config to the frontend
// This is now /api/config
apiRouter.get('/config', (req, res) => {
    // Check for missing variables and build a more informative error message
    const missingVars = [];
    if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
    if (!SUPABASE_KEY) missingVars.push('SUPABASE_KEY');

    if (missingVars.length > 0) {
        const errorMessage = `Server configuration error: The following required environment variables are missing: ${missingVars.join(', ')}. Please run setup.bat again.`;
        console.error(errorMessage);
        return res.status(500).json({
            message: errorMessage
        });
    }
    res.json({
        supabaseUrl: SUPABASE_URL,
        supabaseKey: SUPABASE_KEY
    });
});

// Endpoint لاستقبال طلبات النشر
// This is now /api/post-winner
apiRouter.post('/post-winner', async (req, res) => {
    const { name } = req.body;
    console.log(`[INFO] Received request to post winner: "${name}"`);

    if (!name) {
        console.warn('[WARN] Post request received with no winner name.');
        return res.status(400).json({ message: 'Winner name is required' });
    }

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        const errorMsg = '[ERROR] Telegram Bot Token or Chat ID is not configured on the server.';
        console.error(errorMsg);
        return res.status(500).json({ message: 'Telegram integration is not configured on the server.' });
    }

    const message = `🎉 تهانينا للفائز الجديد في inzo! 🎉\n\n ✨ ${name} ✨ \n\nحظاً أوفر للبقية!`;
    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
        await axios.post(telegramApiUrl, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
        });
        console.log(`[SUCCESS] Message sent to Telegram for winner: ${name}`);
        res.status(200).json({ message: 'Successfully posted to Telegram' });
    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`[ERROR] Failed to send message to Telegram: ${errorDetails}`);
        res.status(500).json({ message: `Failed to post to Telegram. Reason: ${error.response ? error.response.data.description : 'Unknown error'}` });
    }
});

// Endpoint to update the application via git pull
// This is now /api/update-app
apiRouter.post('/update-app', (req, res) => {
    console.log('[UPDATE] Received request to update the application from remote.');

    // Execute git pull command in the project's root directory
    exec('git pull origin main', { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[UPDATE-ERROR] exec error: ${error}`);
            if (stderr.includes('not a git repository')) {
                return res.status(500).json({ message: 'فشل التحديث: المجلد الحالي ليس مستودع Git صالح.' });
            }
            return res.status(500).json({ message: 'فشل تحديث التطبيق.', details: stderr });
        }

        console.log(`[UPDATE-LOG] git pull stdout: ${stdout}`);
        if (stderr && !stderr.toLowerCase().includes('fast-forward')) {
            console.warn(`[UPDATE-LOG] git pull stderr: ${stderr}`);
        }

        // If 'Already up to date.' is in the output, no need to restart.
        if (stdout.includes('Already up to date.')) {
            console.log('[UPDATE] Application is already up to date.');
            return res.status(200).json({ message: 'أنت تستخدم بالفعل آخر إصدار.', needsRestart: false });
        }

        // If there were changes, send a response and then restart the server.
        res.status(200).json({ message: 'تم العثور على تحديثات! سيتم إعادة تشغيل التطبيق الآن لتطبيقها.', needsRestart: true });

        // Restart the server by exiting with a specific code that the .bat file will catch
        setTimeout(() => {
            console.log('[UPDATE] Restarting server to apply updates...');
            process.exit(42); // Use a unique exit code for updates
        }, 1500);
    });
});

// API 404 Handler - This must be the last route on the API router
apiRouter.use((req, res) => {
    res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Mount the main API router under the /api path
app.use('/api', apiRouter);


// --- Static File Serving & SPA Fallback ---
// This should come AFTER all API routes.

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Handle Chrome DevTools requests gracefully to prevent console noise.
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
    res.status(204).send();
});

// The SPA fallback. This should be the last route.
// It sends index.html for any GET request that did not match an API route or a static file.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// --- Scheduled Tasks ---

// Schedule a task to delete old tasks every Sunday at 7:00 AM.
// Cron format: 'Minute Hour DayOfMonth Month DayOfWeek'
cron.schedule('0 7 * * 0', async () => {
    console.log('[CRON] Running weekly task cleanup...');
    try {
        // This requires a Supabase client instance on the server
        // For simplicity, we'll just log it. A proper implementation
        // would use the service_role key to perform this action.
        // The logic is now: delete all entries from daily_tasks.
        // This is a placeholder for a more secure server-side implementation.
        // To make this work, we need to create a Supabase client here.
        const { createClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY); // Assumes SERVICE_KEY is in .env

        // We delete all tasks. New tasks will be created as needed.
        const { error } = await supabaseAdmin
            .from('daily_tasks')
            .delete()
            .gt('id', 0); // A trick to delete all rows

         if (error) {
            console.error('[CRON] Failed to delete old tasks:', error.message);
         } else {
            console.log('[CRON] Successfully deleted all old tasks.');
         }
    } catch (err) {
        console.error('[CRON] Error calling reset-agents endpoint:', err.message);
    }
}, {
    scheduled: true,
    timezone: "Africa/Cairo" // Set to your local timezone
});

// Schedule a task to deactivate expired competitions every hour.
cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running hourly check for expired competitions...');
    try {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

        const todayStr = new Date().toISOString().split('T')[0];

        // Find active competitions where the winner selection date is in the past
        const { data: expiredCompetitions, error: fetchError } = await supabaseAdmin
            .from('agents')
            .select('id')
            .lt('winner_selection_date', todayStr);

        if (fetchError) throw fetchError;

        if (expiredCompetitions.length > 0) {
            const agentIds = expiredCompetitions.map(a => a.id);
            const { error: updateError } = await supabaseAdmin.from('competitions').update({ is_active: false }).in('agent_id', agentIds);
            if (updateError) throw updateError;
            console.log(`[CRON] Deactivated ${expiredCompetitions.length} expired competitions.`);
        }
    } catch (err) {
        console.error('[CRON] Error deactivating expired competitions:', err.message);
    }
});

// تشغيل السيرفر
app.listen(port, () => {
    console.log(`Backend server is running at http://localhost:${port}`);
});