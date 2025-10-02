// تحميل المكتبات اللازمة
require('dotenv').config({ path: require('path').join(__dirname, '.env') }); // FIX: Ensure .env is loaded correctly
const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // NEW: For basic security headers
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');
const cron = require('node-cron');
const app = express();
const port = process.env.PORT || 30001; // NEW: Make port configurable

// Middlewares
app.use(cors()); // للسماح للـ Frontend بالتواصل مع الـ Backend
app.use(helmet()); // NEW: Add security headers
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
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 5000; // 5 seconds

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (!supabaseAdmin) {
                throw new Error('Supabase admin client is not available.');
            }
            console.log(`[INFO] Loading secure configuration... (Attempt ${attempt}/${MAX_RETRIES})`);
            const { data, error } = await supabaseAdmin.from('app_config').select('key, value');

            if (error) throw error; // Throw to be caught by the catch block

            const config = data.reduce((acc, item) => {
                acc[item.key] = item.value;
                return acc;
            }, {});

            TELEGRAM_BOT_TOKEN = config.TELEGRAM_BOT_TOKEN;
            TELEGRAM_CHAT_ID = config.TELEGRAM_CHAT_ID;
            console.log('[INFO] Secure configuration loaded successfully.');
            return; // Exit the function on success
        } catch (error) {
            console.error(`[CRITICAL] Failed to fetch secure configuration on attempt ${attempt}:`, error.message);
            if (error.cause) console.error('[CRITICAL] Underlying cause:', error.cause);
            if (attempt === MAX_RETRIES) {
                console.error('[CRITICAL] All attempts to load configuration failed. Server might not function correctly.');
            } else {
                await new Promise(res => setTimeout(res, RETRY_DELAY));
            }
        }
    }
}

// --- Main API Router ---
const apiRouter = express.Router();

// --- NEW: Authentication Middleware ---
// This middleware will verify the JWT from the Authorization header
// and attach the user object to the request for protected routes.
const authMiddleware = async (req, res, next) => {
    if (!supabaseAdmin) {
        return res.status(500).json({ message: 'Authentication service is not configured.' });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (error) {
            console.warn('[AUTH-WARN] Token validation failed:', error.message);
            return res.status(401).json({ message: 'Unauthorized: Invalid token.' });
        }
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized: User not found.' });
        }
        req.user = user; // Attach user to the request object
        next();
    } catch (e) {
        res.status(500).json({ message: 'An unexpected authentication error occurred.' });
    }
};

// --- NEW: Centralized API Router Setup ---
const apiRoutes = require('./routes/api'); // Import the new router file
apiRouter.use('/', apiRoutes({ supabaseAdmin, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID }));

// --- NEW: Central Error Handling Middleware ---
// This should be placed after all other app.use() and routes calls
apiRouter.use((err, req, res, next) => {
    console.error('[UNHANDLED_ERROR]', err.stack);
    res.status(500).json({ message: 'An unexpected server error occurred.' });
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
    res.status(204).send(); // No Content
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

// تعديل: المهمة تعمل الآن مرة واحدة يومياً الساعة 12:00 صباحاً
cron.schedule('0 0 * * *', async () => {
    if (!supabaseAdmin) {
        // console.error('[CRON] Aborting check: Supabase admin client is not initialized.');
        return;
    }
    try {
        // تعديل: البحث عن المسابقات التي تاريخ انتهائها هو اليوم
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const tomorrowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

        const { data: competitionsForToday, error: fetchError } = await supabaseAdmin
            .from('competitions')
            .select('id, name, correct_answer, agents(name, telegram_chat_id)') // تعديل: جلب chat_id الخاص بالوكيل
            .eq('status', 'sent')
            .gte('ends_at', todayStart) // Greater than or equal to the start of today
            .lt('ends_at', tomorrowStart); // Less than the start of tomorrow

        if (fetchError) throw fetchError;

        if (competitionsForToday.length > 0) {
            console.log(`[CRON] Found ${competitionsForToday.length} competition(s) scheduled for winner selection today.`);
            
            // 1. Mark all found competitions as 'processing' immediately to prevent re-fetching
            const competitionIds = competitionsForToday.map(c => c.id);
            if (competitionIds.length > 0) await supabaseAdmin.from('competitions').update({ status: 'processing' }).in('id', competitionIds);

            for (const comp of competitionsForToday) {
                const agentName = comp.agents ? comp.agents.name : 'شريكنا';
                // تعديل: تحديد المعرف المستهدف. الأولوية للمعرف الخاص بالوكيل.
                const targetChatId = comp.agents?.telegram_chat_id || TELEGRAM_CHAT_ID;

                const clicheText = `دمت بخير شريكنا العزيز ${agentName}،\n\nيرجى اختيار الفائزين بالمسابقة الاخيرة التي تم انتهاء مدة المشاركة بها \nوتزويدنا بفيديو الروليت والاسم الثلاثي و معلومات الحساب لكل فائز قبل الاعلان عنهم في قناتكم كي يتم التحقق منهم من قبل القسم المختص\n\nالإجابة الصحيحة هي : ${comp.correct_answer}\nكما يجب اختيار الفائزين بالقرعة لشفافية الاختيار.`;
                
                // 2. Send to Telegram
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: targetChatId,
                    text: clicheText
                });

                // 3. Update competition status to its final state
                await supabaseAdmin.from('competitions').update({ status: 'awaiting_winners' }).eq('id', comp.id);
            }
        }
    } catch (err) {
        console.error('[CRON] Error processing expired competitions:', err.message);
    }

    try {
        // Fetch all agents with a renewal period
        const { data: agents, error: fetchError } = await supabaseAdmin
            .from('agents') // تحسين: جلب المسابقات النشطة مع الوكلاء في استعلام واحد
            .select('id, name, created_at, renewal_period, last_renewal_date, competition_bonus, deposit_bonus_count, competitions!inner(id, name, correct_answer, status, ends_at)')
            .not('renewal_period', 'is', null) // جلب الوكلاء الذين لديهم نظام تجديد
            .neq('renewal_period', 'none'); // استثناء الوكلاء الذين ليس لديهم نظام تجديد

        if (fetchError) throw fetchError;

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day

        for (const agent of agents) {
            const lastRenewal = agent.last_renewal_date ? new Date(agent.last_renewal_date) : new Date(agent.created_at);
            lastRenewal.setHours(0, 0, 0, 0);

            let nextRenewalDate = new Date(lastRenewal);
            if (agent.renewal_period === 'weekly') nextRenewalDate.setDate(lastRenewal.getDate() + 7);
            else if (agent.renewal_period === 'biweekly') nextRenewalDate.setDate(lastRenewal.getDate() + 14);
            else if (agent.renewal_period === 'monthly') nextRenewalDate.setMonth(lastRenewal.getMonth() + 1);
            else continue; // Skip if invalid period

            // Check if today is the renewal day or later
            if (today >= nextRenewalDate) {
                console.log(`[CRON] Renewing balance for agent: ${agent.name} (ID: ${agent.id})`);
                const renewalTimestamp = today.toISOString();

                const { error: updateError } = await supabaseAdmin
                    .from('agents')
                    .update({
                        consumed_balance: 0,
                        remaining_balance: agent.competition_bonus,
                        used_deposit_bonus: 0,
                        remaining_deposit_bonus: agent.deposit_bonus_count,
                        last_renewal_date: renewalTimestamp
                    })
                    .eq('id', agent.id);

                if (updateError) {
                    console.error(`[CRON] Failed to renew balance for agent ${agent.id}:`, updateError.message);
                } else {
                    // Send a realtime notification to the frontend
                    await supabaseAdmin.from('realtime_notifications').insert({
                        message: `تم تجديد رصيد المسابقات والبونص للوكيل ${agent.name}.`,
                        type: 'success',
                        notification_type: 'BALANCE_RENEWAL',
                        agent_id: agent.id
                    });
                }
            }
        }
    } catch (err) {
        console.error('[CRON] Error processing agent renewals:', err.message);
    }
});

async function startServer() {
    // 1. قم بتحميل الإعدادات الآمنة أولاً وانتظر اكتمالها
    await loadSecureConfig();

    // 2. بعد اكتمال التحميل، ابدأ تشغيل السيرفر
    app.listen(port, () => {
        console.log(`Backend server is running at http://localhost:${port}`);
    });
}

startServer();