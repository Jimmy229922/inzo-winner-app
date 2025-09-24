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

// --- متغيرات سيتم تحميلها من قاعدة البيانات ---
let TELEGRAM_BOT_TOKEN = null;
let TELEGRAM_CHAT_ID = null;
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

// --- تحميل الإعدادات الآمنة من قاعدة البيانات عند بدء التشغيل ---
async function loadSecureConfig() {
    if (!supabaseAdmin) {
        console.error('[CRITICAL] Cannot load secure config because Supabase admin client is not available.');
        return;
    }
    console.log('[INFO] Loading secure configuration from database...');
    const { data, error } = await supabaseAdmin.from('app_config').select('key, value');

    if (error) {
        console.error('[CRITICAL] Failed to fetch secure configuration from database:', error.message);
        return;
    }

    const config = data.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
    }, {});

    TELEGRAM_BOT_TOKEN = config.TELEGRAM_BOT_TOKEN;
    TELEGRAM_CHAT_ID = config.TELEGRAM_CHAT_ID;
    console.log('[INFO] Secure configuration loaded successfully.');
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

// NEW: Endpoint to post a generic announcement
apiRouter.post('/post-announcement', async (req, res) => {
    const { message } = req.body;
    console.log(`[INFO] Received request to post announcement.`);

    if (!message) {
        console.warn('[WARN] Post announcement request received with no message.');
        return res.status(400).json({ message: 'Message content is required' });
    }

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        const errorMsg = '[ERROR] Telegram Bot Token or Chat ID is not configured on the server.';
        console.error(errorMsg);
        return res.status(500).json({ message: 'Telegram integration is not configured on the server.' });
    }

    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
        await axios.post(telegramApiUrl, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
        });
        console.log(`[SUCCESS] Announcement sent to Telegram.`);
        res.status(200).json({ message: 'Successfully posted announcement to Telegram' });
    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`[ERROR] Failed to send announcement to Telegram: ${errorDetails}`);
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
    if (!supabaseAdmin) {
        console.error('[CRON] Aborting task cleanup: Supabase admin client is not initialized.');
        return;
    }
    try {

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
    if (!supabaseAdmin) {
        console.error('[CRON] Aborting expired competition check: Supabase admin client is not initialized.');
        return;
    }
    try {
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

// Schedule a task to reset agent balances based on their renewal period. Runs every 10 seconds for testing.
cron.schedule('*/10 * * * * *', async () => {
    console.log('[CRON_TEST] Running 10-second check for agent balance renewal...');
    if (!supabaseAdmin) {
        console.error('[CRON_TEST] Aborting balance renewal: Supabase admin client is not initialized.');
        return;
    }
    try {
        const { data: agents, error } = await supabaseAdmin
            .from('agents')
            .select('id, name, renewal_period, last_renewal_date')
            .eq('renewal_period', 'test_10s');

        if (error) throw error;

        const now = new Date();
        const agentsToReset = agents.filter(agent => {
            if (!agent.last_renewal_date) return true; // Renew if it has never been renewed
            const lastRenewal = new Date(agent.last_renewal_date);
            const secondsSinceLastRenewal = (now.getTime() - lastRenewal.getTime()) / 1000;
            return secondsSinceLastRenewal >= 10;
        });

        if (agentsToReset.length > 0) {
            const agentIdsToReset = agentsToReset.map(a => a.id);
            console.log(`[CRON_TEST] Renewing balances for ${agentsToReset.length} agents (test_10s).`);
            
            // Reset balances for the specific agents
            const { error: rpcError } = await supabaseAdmin.rpc('reset_agent_balances_by_ids', { p_agent_ids: agentIdsToReset });
            if (rpcError) throw rpcError;
            
            // Update renewal date for the specific agents
            await supabaseAdmin.from('agents').update({ last_renewal_date: now.toISOString() }).in('id', agentIdsToReset);

            // Send a realtime notification for each renewed agent
            for (const agent of agentsToReset) {
                await supabaseAdmin.from('realtime_notifications').insert({ message: `تم تجديد رصيد الوكيل (تجريبي): ${agent.name}`, type: 'success' });
            }
        }
    } catch (err) {
        console.error('[CRON_TEST] Error during 10s agent balance renewal check:', err.message);
    }
});

// Schedule a task to reset agent balances based on their renewal period. Runs daily at 00:05 AM.
cron.schedule('5 0 * * *', async () => {
    console.log('[CRON] Running daily check for agent balance renewal...');
    if (!supabaseAdmin) {
        console.error('[CRON] Aborting balance renewal: Supabase admin client is not initialized.');
        return;
    }
    try {
        const { data: agents, error } = await supabaseAdmin
            .from('agents')
            .select('id, name, renewal_period, last_renewal_date')
            .not('renewal_period', 'is', null);

        if (error) throw error;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const agentsToReset = [];
        const testAgentsToReset = [];

        agents.forEach(agent => {
            console.log(`[CRON DEBUG] Checking agent: ${agent.name} (ID: ${agent.id}), Period: ${agent.renewal_period}, Last Renewal: ${agent.last_renewal_date}`);
            const lastRenewal = agent.last_renewal_date ? new Date(agent.last_renewal_date) : new Date(0); // If never renewed, consider it very old
            let nextRenewalDate = new Date(lastRenewal);

            if (agent.renewal_period === 'weekly') {
                nextRenewalDate.setDate(lastRenewal.getDate() + 7);
                console.log(`[CRON DEBUG] Agent ${agent.name} is weekly. Next renewal: ${nextRenewalDate.toISOString()}`);
            } else if (agent.renewal_period === 'biweekly') {
                nextRenewalDate.setDate(lastRenewal.getDate() + 14);
                console.log(`[CRON DEBUG] Agent ${agent.name} is biweekly. Next renewal: ${nextRenewalDate.toISOString()}`);
            } else if (agent.renewal_period === 'monthly') {
                nextRenewalDate.setMonth(lastRenewal.getMonth() + 1);
                console.log(`[CRON DEBUG] Agent ${agent.name} is monthly. Next renewal: ${nextRenewalDate.toISOString()}`);
            } else if (agent.renewal_period === 'test_10s') {
                const secondsSinceLastRenewal = (today.getTime() - lastRenewal.getTime()) / 1000;
                if (secondsSinceLastRenewal >= 10) {
                    testAgentsToReset.push(agent);
                }
                return; // Skip normal daily check for test agents
            } else {
                return; // Skip if renewal_period is not set or invalid
            }

            if (today.getTime() >= nextRenewalDate.getTime()) {
                agentsToReset.push(agent);
            }
        });

        // Process daily renewals
        if (agentsToReset.length > 0) {
            const agentIds = agentsToReset.map(a => a.id);
            console.log(`[CRON] Renewing daily balances for ${agentsToReset.length} agents.`);
            const { error: rpcError } = await supabaseAdmin.rpc('reset_agent_balances_by_ids', { p_agent_ids: agentIds });
            if (rpcError) {
                 console.error('[CRON] Failed to reset daily agent balances via RPC:', rpcError.message);
            } else {
                await supabaseAdmin.from('agents').update({ last_renewal_date: today.toISOString().split('T')[0] }).in('id', agentIds);
                console.log('[CRON] Successfully renewed daily balances.');
                // Send notifications for daily renewals
                for (const agent of agentsToReset) {
                    await supabaseAdmin.from('realtime_notifications').insert({ 
                        message: `تم تجديد الرصيد اليومي للوكيل: ${agent.name}`, 
                        type: 'success',
                        notification_type: 'BALANCE_RENEWAL',
                        agent_id: agent.id
                    });
                }
            }
        } else {
            console.log('[CRON] No agents due for daily balance renewal.');
        }

        // Process 10-second test renewals
        if (testAgentsToReset.length > 0) {
            const agentIds = testAgentsToReset.map(a => a.id);
            console.log(`[CRON_TEST] Renewing balances for ${testAgentsToReset.length} agents (test_10s).`);
            const { error: rpcError } = await supabaseAdmin.rpc('reset_agent_balances_by_ids', { p_agent_ids: agentIds });
            if (rpcError) {
                console.error('[CRON_TEST] Failed to reset test agent balances via RPC:', rpcError.message);
            } else {
                await supabaseAdmin.from('agents').update({ last_renewal_date: new Date().toISOString() }).in('id', agentIds);
                // Send notifications for test renewals
                for (const agent of testAgentsToReset) {
                    await supabaseAdmin.from('realtime_notifications').insert({ 
                        message: `تم تجديد رصيد الوكيل (تجريبي): ${agent.name}`, 
                        type: 'success',
                        notification_type: 'BALANCE_RENEWAL',
                        agent_id: agent.id
                    });
                }
            }
        } else {
            console.log('[CRON] No agents due for balance renewal today.');
        }
    } catch (err) {
        console.error('[CRON] Error during agent balance renewal check:', err.message);
    }
}, {
    scheduled: true,
    timezone: "Africa/Cairo" // Set to your local timezone
});

// Schedule a task to send winner selection reminders. Runs daily at 09:00 AM.
cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Running daily check for winner selection reminders...');
    if (!supabaseAdmin) {
        console.error('[CRON] Aborting winner selection check: Supabase admin client is not initialized.');
        return;
    }
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: agents, error } = await supabaseAdmin
            .from('agents')
            .select('name')
            .eq('winner_selection_date', todayStr);

        if (error) throw error;

        if (agents.length > 0) {
            for (const agent of agents) {
                const clicheText = `دمت بخير شريكنا العزيز ${agent.name}،\n\nيرجى اختيار الفائزين بالمسابقة الاخيرة التي تم انتهاء مدة المشاركة بها \nوتزويدنا بفيديو الروليت والاسم الثلاثي و معلومات الحساب لكل فائز قبل الاعلان عنهم في قناتكم كي يتم التحقق منهم من قبل القسم المختص\n\nكما يجب اختيار الفائزين بالقرعة لشفافية الاختيار.`;
                // Send to Telegram
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: TELEGRAM_CHAT_ID,
                    text: clicheText,
                });
                console.log(`[CRON] Sent winner selection reminder for agent: ${agent.name}`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between messages
            }
        } else {
            console.log('[CRON] No winner selection reminders to send today.');
        }
    } catch (err) {
        console.error('[CRON] Error sending winner selection reminders:', err.message);
    }
}, { scheduled: true, timezone: "Africa/Cairo" });

// تشغيل السيرفر
app.listen(port, () => {
    // قم بتحميل الإعدادات الآمنة أولاً
    loadSecureConfig();
    console.log(`Backend server is running at http://localhost:${port}`);
});