// تحميل المكتبات اللازمة
require('dotenv').config({ path: require('path').join(__dirname, '.env') }); // FIX: Ensure .env is loaded correctly
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');
const cron = require('node-cron');
const app = express();
const port = 30001; // تم تثبيت المنفذ بناءً على الطلب

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
    const { message, chatId, imageUrl } = req.body; // استقبال chatId و imageUrl من الطلب
    // console.log(`[INFO] Received request to post announcement.`);

    if (!message) {
        console.warn('[WARN] Post announcement request received with no message.');
        return res.status(400).json({ message: 'Message content is required' });
    }

    // تحديد chat_id الذي سيتم الإرسال إليه. الأولوية للـ chatId الخاص بالوكيل.
    const targetChatId = chatId || TELEGRAM_CHAT_ID;
    if (!TELEGRAM_BOT_TOKEN || !targetChatId) {
        const errorMsg = '[ERROR] Telegram Bot Token or Chat ID is not configured on the server.';
        console.error(errorMsg);
        return res.status(500).json({ message: 'Telegram integration is not configured on the server.' });
    }
    
    // --- Re-enabled: Determine API method based on whether an image is present ---
    const apiMethod = imageUrl ? 'sendPhoto' : 'sendMessage';
    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${apiMethod}`;
    
    const payload = {
        chat_id: targetChatId,
        parse_mode: 'HTML'
    };

    if (imageUrl) {
        payload.photo = encodeURI(imageUrl); // Encode the URL to handle special characters
        payload.caption = message;
    } else {
        payload.text = message;
    }

    try {
        await axios.post(telegramApiUrl, payload);
        res.status(200).json({ message: 'Successfully posted announcement to Telegram' });
    } catch (error) {
        // --- التحسين التلقائي لمعرف الدردشة ---
        const errorData = error.response?.data;
        const newChatId = errorData?.parameters?.migrate_to_chat_id;

        if (errorData && newChatId) {
            console.warn(`[AUTO-FIX] Telegram group upgraded. Old Chat ID: ${targetChatId}, New Chat ID: ${newChatId}`);
            
            try {
                // 1. تحديث معرف الدردشة في قاعدة البيانات
                const { error: updateError } = await supabaseAdmin
                    .from('agents')
                    .update({ telegram_chat_id: newChatId.toString() })
                    .eq('telegram_chat_id', targetChatId.toString());

                if (updateError) throw new Error(`Failed to update Chat ID in DB: ${updateError.message}`);
                console.log(`[AUTO-FIX] Successfully updated Chat ID for agent.`);

                // 2. إعادة محاولة إرسال الرسالة بالمعرف الجديد
                const retryPayload = {
                    ...payload,
                    chat_id: newChatId
                };
                const retryApiMethod = imageUrl ? 'sendPhoto' : 'sendMessage';
                const retryTelegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${retryApiMethod}`;
                await axios.post(retryTelegramApiUrl, retryPayload);

                console.log(`[AUTO-FIX] Successfully resent message to new Chat ID.`);
                return res.status(200).json({ message: 'Successfully posted announcement after auto-fixing Chat ID.' });

            } catch (autoFixError) {
                console.error(`[AUTO-FIX-ERROR] Failed during auto-fix process: ${autoFixError.message}`);
                // إذا فشلت عملية الإصلاح، يتم إرجاع الخطأ الأصلي
            }
        }

        console.error(`[ERROR] Failed to send announcement to Telegram: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
        res.status(500).json({ message: `فشل الإرسال إلى تلجرام. السبب: ${error.response?.data?.description || 'Unknown error'}` });
    }
});

// NEW: Endpoint to get chat info from Telegram
apiRouter.get('/get-chat-info', async (req, res) => {
    const { chatId } = req.query;

    if (!chatId) {
        return res.status(400).json({ message: 'Chat ID is required.' });
    }

    if (!TELEGRAM_BOT_TOKEN) {
        return res.status(500).json({ message: 'Telegram integration is not configured.' });
    }

    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat`;

    try {
        const response = await axios.post(telegramApiUrl, { chat_id: chatId });
        const chatTitle = response.data?.result?.title;
        if (!chatTitle) throw new Error('Could not retrieve chat title.');

        res.status(200).json({ title: chatTitle });
    } catch (error) {
        const errorDetails = error.response ? error.response.data.description : error.message;
        console.error(`[ERROR] Failed to get chat info for ${chatId}: ${errorDetails}`);
        res.status(500).json({ message: `فشل جلب بيانات المجموعة من تلجرام. تأكد من أن البوت عضو في المجموعة وأن المعرف صحيح.` });
    }
});

// Endpoint to update the application via git pull
// This is now /api/update-app
apiRouter.post('/update-app', async (req, res) => { // تعديل: تحويل الدالة إلى async
    console.log('[UPDATE] Received request to update the application from remote.');

    // Execute git pull command in the project's root directory
    exec('git pull origin main', { cwd: path.join(__dirname, '..') }, async (error, stdout, stderr) => { // تعديل: تحويل الدالة إلى async
        if (error) {
            console.error(`[UPDATE-ERROR] exec error: ${error}`);
            if (stderr.includes('not a git repository') || stderr.includes('is not recognized')) {
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

        // --- NEW: Broadcast update notification before restarting ---
        if (supabaseAdmin) {
            await supabaseAdmin.from('realtime_notifications').insert({
                message: 'تم تحديث التطبيق بنجاح! سيتم إعادة تحميل الصفحة.',
                type: 'success',
                notification_type: 'APP_UPDATE'
            });
            console.log('[UPDATE] Broadcasted APP_UPDATE notification to all clients.');
        }
        // --- End of new code ---

        // If there were changes, send a response and then restart the server.
        res.status(200).json({ message: 'تم العثور على تحديثات! سيتم إعادة تشغيل التطبيق الآن لتطبيقها.', needsRestart: true });

        // Restart the server by exiting with a specific code that the .bat file will catch
        setTimeout(() => {
            console.log('[UPDATE] Restarting server to apply updates...');
            process.exit(42); // Use a unique exit code for updates
        }, 1500);
    });
});

// NEW: Endpoint to delete a user (Admin only)
// This is now /api/users/:id
apiRouter.delete('/users/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    console.log(`[ADMIN] Received request to delete user with ID: ${id}`);

    if (!supabaseAdmin) {
        const errorMsg = '[ERROR] Supabase admin client is not configured.';
        console.error(errorMsg);
        return res.status(500).json({ message: 'Admin features are not configured on the server.' });
    }

    try {
        // --- NEW: Security Check - Only Super Admin can delete users ---
        const { data: performingUser, error: performingUserError } = await supabaseAdmin.from('users').select('role').eq('id', req.user.id).single();
        if (performingUserError || performingUser.role !== 'super_admin') {
            return res.status(403).json({ message: 'فقط المدير العام يمكنه حذف المستخدمين.' });
        }

        const { data: targetUser, error: targetUserError } = await supabaseAdmin.from('users').select('role').eq('id', id).single();
        if (targetUserError) throw new Error('Could not find the user to delete.');

        // --- NEW: Security Check - User cannot delete themselves ---
        if (req.user.id === id) {
            return res.status(403).json({ message: 'لا يمكنك حذف حسابك الخاص.' });
        }

        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (error) throw error;
        res.status(200).json({ message: 'User deleted successfully.', data });
    } catch (error) {
        console.error(`[ERROR] Failed to delete user ${id}:`, error.message);
        res.status(500).json({ message: `Failed to delete user. Reason: ${error.message}` });
    }
});

// NEW: Endpoint to get a combined list of users with their emails (Admin only)
apiRouter.get('/users', authMiddleware, async (req, res) => {
    if (!supabaseAdmin) {
        return res.status(500).json({ message: 'Admin features are not configured on the server.' });
    }

    try {
        // --- إصلاح: التحقق من صلاحيات المسؤول قبل جلب البيانات ---
        const { data: performingUser, error: performingUserError } = await supabaseAdmin.from('users').select('role').eq('id', req.user.id).single();
        if (performingUserError) throw new Error('Could not verify performing user permissions.');
        const isAdmin = performingUser.role === 'admin' || performingUser.role === 'super_admin';
        if (!isAdmin) {
            return res.status(403).json({ message: 'ليس لديك الصلاحية لعرض هذه الصفحة.' });
        }
        // --- إصلاح: العودة إلى طريقة الدمج اليدوي للبيانات لضمان الاستقرار ---
        // 1. جلب جميع المستخدمين من نظام المصادقة
        const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        if (authError) throw authError;

        // 2. جلب جميع الملفات الشخصية من الجدول العام
        const { data: profiles, error: profileError } = await supabaseAdmin.from('users').select('*');
        if (profileError) throw profileError;

        // 3. إنشاء خريطة (map) للملفات الشخصية لتسهيل البحث
        const profileMap = new Map(profiles.map(p => [p.id, p]));

        // 4. دمج البيانات
        const combinedUsers = authUsers.map(authUser => {
            const profile = profileMap.get(authUser.id) || {};
            return {
                ...profile, // full_name, role, avatar_url, created_at
                id: authUser.id,
                email: authUser.email,
                last_sign_in_at: authUser.last_sign_in_at,
            };
        });

        // 5. تطبيق الفلاتر والترقيم على البيانات المدمجة
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const search = (req.query.q || '').toLowerCase();
        const roleFilter = req.query.role || 'all';
        const offset = (page - 1) * limit;

        const filteredUsers = combinedUsers.filter(user => {
            const matchesSearch = !search || user.full_name?.toLowerCase().includes(search) || user.email?.toLowerCase().includes(search);
            const matchesRole = roleFilter === 'all' || user.role === roleFilter;
            return matchesSearch && matchesRole;
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const paginatedUsers = filteredUsers.slice(offset, offset + limit);

        res.status(200).json({ users: paginatedUsers, count: filteredUsers.length });
    } catch (error) {
        console.error(`[ERROR] Failed to fetch all users:`, error.message);
        res.status(500).json({ message: `Failed to fetch users. Reason: ${error.message}` });
    }
});

// NEW: Endpoint to create a new user (Admin only)
apiRouter.post('/users', authMiddleware, async (req, res) => {
    const { email, password, full_name, role } = req.body;
    console.log(`[ADMIN] Received request to create new user: ${email}`);

    if (!supabaseAdmin) {
        return res.status(500).json({ message: 'Admin features are not configured on the server.' });
    }
    // The check for required fields is implicitly handled by supabase.auth.admin.createUser
    // which will fail if email or password are not provided.
    // This makes the endpoint more robust.

    try {
        // 1. Create the user in the 'auth' schema
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // Automatically confirm the email
            user_metadata: { full_name: full_name }
        });

        if (authError) throw authError;

        const newUserId = authData.user.id;

        // 2. The trigger 'handle_new_user' already created a profile with 'user' role.
        //    If the requested role is 'admin', we need to update it.
        if (role === 'admin') {
            const { error: roleError } = await supabaseAdmin.from('users').update({ role: 'admin' }).eq('id', newUserId);
            if (roleError) throw new Error(`User created, but failed to set role to admin: ${roleError.message}`);
        }

        res.status(201).json({ message: 'User created successfully.', user: authData.user });
    } catch (error) {
        console.error(`[ERROR] Failed to create user ${email}:`, error.message);
        res.status(500).json({ message: `Failed to create user. Reason: ${error.message}` });
    }
});

// NEW: Endpoint to update a user (Admin only)
apiRouter.put('/users/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { full_name, password, avatar_url, status, permissions } = req.body; // إضافة: استقبال الصلاحيات
    console.log(`[ADMIN] Received request to update user ${id}`);

    if (!supabaseAdmin) {
        return res.status(500).json({ message: 'Admin features are not configured on the server.' });
    }

    // --- تعديل: إضافة صلاحيات للمسؤول العام ومنع التعديل الذاتي ---
    try {
        // 1. جلب بيانات المستخدم الذي يقوم بالإجراء (المسؤول الحالي)
        const { data: performingUser, error: performingUserError } = await supabaseAdmin.from('users').select('id, role').eq('id', req.user.id).single();
        if (performingUserError) throw new Error('Could not verify performing user permissions.');

        // 2. جلب بيانات المستخدم المراد تعديله
        const { data: targetUser, error: targetUserError } = await supabaseAdmin.from('users').select('id, role').eq('id', id).single();
        if (targetUserError) throw new Error('Could not find the user to update.');

        // 3. تطبيق قواعد الصلاحيات
        const isSuperAdmin = performingUser.role === 'super_admin';

        // لا يمكن للمستخدم تعطيل حسابه بنفسه
        if (performingUser.id === id && status === 'inactive') {
            return res.status(403).json({ message: 'لا يمكنك تعطيل حسابك الخاص.' });
        }

        // لا يمكن لمسؤول ثانوي تعديل حالة (تفعيل/تعطيل) مسؤول آخر
        if (status && targetUser.role === 'admin' && performingUser.role === 'admin' && !isSuperAdmin) {
            return res.status(403).json({ message: 'ليس لديك الصلاحية لتغيير حالة مسؤول آخر.' });
        }
        const updatePayload = {
            user_metadata: {}
        };

        // Only include password if it's provided and not empty
        if (password && password.length >= 6) {
            updatePayload.password = password;
        }

        if (full_name) {
            updatePayload.user_metadata.full_name = full_name;
        }

        // 1. Update user in the 'auth' schema if there are auth-related changes
        if (updatePayload.password || (updatePayload.user_metadata && Object.keys(updatePayload.user_metadata).length > 0)) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, updatePayload);
            if (authError) throw authError;
        }

        // 2. Update the public 'users' table for profile data like avatar_url and status
        const profileUpdatePayload = {};
        if (avatar_url !== undefined) { // Check for undefined to allow setting it to null
            profileUpdatePayload.avatar_url = avatar_url;
        }
        if (status) { // Handle status update
            profileUpdatePayload.status = status;
        }
        if (permissions) { // Handle permissions update
            profileUpdatePayload.permissions = permissions;
        }

        if (Object.keys(profileUpdatePayload).length > 0) {
            const { error: profileError } = await supabaseAdmin
                .from('users')
                .update(profileUpdatePayload)
                .eq('id', id);
            if (profileError) {
                // This is not a critical failure if the auth part succeeded, but we should log it.
                console.warn(`[WARN] User ${id} updated, but failed to update profile data: ${profileError.message}`);
            }
        }

        // Fetch the final user state to return
        const { data: finalUser, error: finalUserError } = await supabaseAdmin.from('users').select('*').eq('id', id).single();
        if (finalUserError) {
            console.warn(`[WARN] User ${id} updated, but failed to fetch final state: ${finalUserError.message}`);
        }

        res.status(200).json({ message: 'User updated successfully.', user: finalUser });
    } catch (error) {
        console.error(`[ERROR] Failed to update user ${id}:`, error.message);
        res.status(500).json({ message: `Failed to update user. Reason: ${error.message}` });
    }
});

// NEW: Endpoint to update a user's role (Admin only)
apiRouter.put('/users/:id/role', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!supabaseAdmin) {
        return res.status(500).json({ message: 'Admin features are not configured on the server.' });
    }
    if (!role || !['admin', 'user'].includes(role)) {
        return res.status(400).json({ message: 'صلاحية غير صالحة. يجب أن تكون "admin" أو "user".' });
    }

    try {
        // --- NEW: Security Check - Only Super Admin can change roles ---
        const { data: performingUser, error: performingUserError } = await supabaseAdmin.from('users').select('role').eq('id', req.user.id).single();
        if (performingUserError) throw new Error('Could not verify performing user permissions.');

        if (performingUser.role !== 'super_admin') {
            return res.status(403).json({ message: 'فقط المدير العام يمكنه تغيير صلاحيات المستخدمين.' });
        }

        // --- NEW: Security Check - Prevent changing Super Admin's role ---
        const { data: targetUser, error: targetUserError } = await supabaseAdmin.from('users').select('role').eq('id', id).single();
        if (targetUserError) throw new Error('Could not find the user to update.');

        if (targetUser.role === 'super_admin') {
            return res.status(403).json({ message: 'لا يمكن تغيير صلاحية المدير العام.' });
        }

        // We update our public.users table, not auth.users
        const { data, error } = await supabaseAdmin.from('users').update({ role: role }).eq('id', id).select().single();

        if (error) throw error;
        res.status(200).json({ message: 'User role updated successfully.', user: data });
    } catch (error) {
        console.error(`[ERROR] Failed to update role for user ${id}:`, error.message);
        res.status(500).json({ message: `Failed to update role. Reason: ${error.message}` });
    }
});

// API 404 Handler - This must be the last route on the API router
apiRouter.use((req, res) => {
    res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});


// --- Static File Serving & SPA Fallback ---
// This should come AFTER all API routes.

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Mount the main API router under the /api path
app.use('/api', apiRouter);

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