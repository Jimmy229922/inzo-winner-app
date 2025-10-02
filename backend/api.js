const express = require('express');
const axios = require('axios');
const { exec } = require('child_process');
const path = require('path');

module.exports = (dependencies) => {
    const { supabaseAdmin, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = dependencies;
    const router = express.Router();

    // --- Authentication Middleware ---
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
            req.user = user;
            next();
        } catch (e) {
            res.status(500).json({ message: 'An unexpected authentication error occurred.' });
        }
    };

    // Endpoint to provide public config to the frontend
    router.get('/config', (req, res) => {
        const { SUPABASE_URL, SUPABASE_KEY } = process.env;
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            const errorMessage = 'Server configuration error: SUPABASE_URL or SUPABASE_KEY is missing.';
            console.error(errorMessage);
            return res.status(500).json({ message: errorMessage });
        }
        res.json({
            supabaseUrl: SUPABASE_URL,
            supabaseKey: SUPABASE_KEY
        });
    });

    // Endpoint to update the application via git pull
    router.post('/update-app', authMiddleware, async (req, res) => {
        console.log('[UPDATE] Received request to update the application from remote.');
        exec('git pull origin main', { cwd: path.join(__dirname, '../..') }, async (error, stdout, stderr) => {
            if (error) {
                console.error(`[UPDATE-ERROR] exec error: ${error}`);
                return res.status(500).json({ message: 'فشل تحديث التطبيق.', details: stderr });
            }

            if (stdout.includes('Already up to date.')) {
                return res.status(200).json({ message: 'أنت تستخدم بالفعل آخر إصدار.', needsRestart: false });
            }

            if (supabaseAdmin) {
                await supabaseAdmin.from('realtime_notifications').insert({
                    message: 'تم تحديث التطبيق بنجاح! سيتم إعادة تحميل الصفحة.',
                    type: 'success',
                    notification_type: 'APP_UPDATE'
                });
            }

            res.status(200).json({ message: 'تم العثور على تحديثات! سيتم إعادة تشغيل التطبيق الآن لتطبيقها.', needsRestart: true });

            setTimeout(() => {
                console.log('[UPDATE] Restarting server to apply updates...');
                process.exit(42);
            }, 1500);
        });
    });

    // Endpoint to get all users (Admin only)
    router.get('/users', authMiddleware, async (req, res) => {
                const { q: searchTerm, status: statusFilter } = req.query;

        try {
            const { data: performingUser, error: performingUserError } = await supabaseAdmin.from('users').select('role').eq('id', req.user.id).single();
            if (performingUserError || !['admin', 'super_admin'].includes(performingUser.role)) {
                return res.status(403).json({ message: 'ليس لديك الصلاحية لعرض هذه الصفحة.' });
            }

            
            // --- تحسين: استخدام دالة RPC لجلب المستخدمين مع الفلترة والدمج في قاعدة البيانات ---
            let rpcParams = { p_search_term: searchTerm || null, p_status_filter: statusFilter || null };
            const { data: combinedUsers, error: rpcError } = await supabaseAdmin.rpc('get_all_users_with_details', rpcParams);

            if (rpcError) throw rpcError;

            res.status(200).json({ users: combinedUsers || [] });
        } catch (error) {
            console.error(`[ERROR] Failed to fetch all users:`, error.message);
            res.status(500).json({ message: `Failed to fetch users. Reason: ${error.message}` });
        }
    });

    // Endpoint to create a new user (Admin only)
    router.post('/users', authMiddleware, async (req, res) => {
        const { email, password, full_name, role } = req.body;
        try {
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email, password, email_confirm: true, user_metadata: { full_name }
            });
            if (authError) throw authError;

            if (role === 'admin') {
                const { error: roleError } = await supabaseAdmin.from('users').update({ role: 'admin' }).eq('id', authData.user.id);
                if (roleError) throw new Error(`User created, but failed to set role: ${roleError.message}`);
            }

            res.status(201).json({ message: 'User created successfully.', user: authData.user });
        } catch (error) {
            console.error(`[ERROR] Failed to create user ${email}:`, error.message);
            res.status(500).json({ message: `Failed to create user. Reason: ${error.message}` });
        }
    });

    // Endpoint to update a user (Admin only)
    router.put('/users/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        const { full_name, password, avatar_url, status, permissions } = req.body;

        try {
            const { data: performingUser, error: performingUserError } = await supabaseAdmin.from('users').select('id, role').eq('id', req.user.id).single();
            if (performingUserError) throw new Error('Could not verify performing user permissions.');

            if (performingUser.id === id && status === 'inactive') {
                return res.status(403).json({ message: 'لا يمكنك تعطيل حسابك الخاص.' });
            }

            const authUpdatePayload = { user_metadata: {} };
            if (password) authUpdatePayload.password = password;
            if (full_name) authUpdatePayload.user_metadata.full_name = full_name;

            if (Object.keys(authUpdatePayload).length > 1 || authUpdatePayload.password) {
                const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdatePayload);
                if (authError) throw authError;
            }

            const profileUpdatePayload = {};
            if (avatar_url !== undefined) profileUpdatePayload.avatar_url = avatar_url;
            if (status) profileUpdatePayload.status = status;
            if (permissions) profileUpdatePayload.permissions = permissions;

            if (Object.keys(profileUpdatePayload).length > 0) {
                const { error: profileError } = await supabaseAdmin.from('users').update(profileUpdatePayload).eq('id', id);
                if (profileError) console.warn(`[WARN] User ${id} updated, but failed to update profile data: ${profileError.message}`);
            }

            res.status(200).json({ message: 'User updated successfully.' });
        } catch (error) {
            console.error(`[ERROR] Failed to update user ${id}:`, error.message);
            res.status(500).json({ message: `Failed to update user. Reason: ${error.message}` });
        }
    });

    // Endpoint to update a user's role (Super Admin only)
    router.put('/users/:id/role', authMiddleware, async (req, res) => {
        const { id } = req.params;
        const { role } = req.body;

        if (!role || !['admin', 'user'].includes(role)) {
            return res.status(400).json({ message: 'صلاحية غير صالحة.' });
        }

        try {
            const { data: performingUser, error: performingUserError } = await supabaseAdmin.from('users').select('role').eq('id', req.user.id).single();
            if (performingUserError || performingUser.role !== 'super_admin') {
                return res.status(403).json({ message: 'فقط المدير العام يمكنه تغيير صلاحيات المستخدمين.' });
            }

            const { data: targetUser, error: targetUserError } = await supabaseAdmin.from('users').select('role').eq('id', id).single();
            if (targetUserError) throw new Error('Could not find the user to update.');
            if (targetUser.role === 'super_admin') {
                return res.status(403).json({ message: 'لا يمكن تغيير صلاحية المدير العام.' });
            }

            const { error } = await supabaseAdmin.from('users').update({ role }).eq('id', id);
            if (error) throw error;

            res.status(200).json({ message: 'User role updated successfully.' });
        } catch (error) {
            console.error(`[ERROR] Failed to update role for user ${id}:`, error.message);
            res.status(500).json({ message: `Failed to update role. Reason: ${error.message}` });
        }
    });

    // Endpoint to delete a user (Super Admin only)
    router.delete('/users/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        try {
            const { data: performingUser, error: performingUserError } = await supabaseAdmin.from('users').select('role').eq('id', req.user.id).single();
            if (performingUserError || performingUser.role !== 'super_admin') {
                return res.status(403).json({ message: 'فقط المدير العام يمكنه حذف المستخدمين.' });
            }
            if (req.user.id === id) {
                return res.status(403).json({ message: 'لا يمكنك حذف حسابك الخاص.' });
            }

            const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
            if (error) throw error;

            res.status(200).json({ message: 'User deleted successfully.' });
        } catch (error) {
            console.error(`[ERROR] Failed to delete user ${id}:`, error.message);
            res.status(500).json({ message: `Failed to delete user. Reason: ${error.message}` });
        }
    });

    // Endpoint to post a generic announcement to Telegram
    router.post('/post-announcement', authMiddleware, async (req, res) => {
        const { message, chatId, imageUrl } = req.body;

        if (!message) return res.status(400).json({ message: 'Message content is required' });

        const targetChatId = chatId || TELEGRAM_CHAT_ID;
        if (!TELEGRAM_BOT_TOKEN || !targetChatId) {
            return res.status(500).json({ message: 'Telegram integration is not configured on the server.' });
        }

        const apiMethod = imageUrl ? 'sendPhoto' : 'sendMessage';
        const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${apiMethod}`;
        const payload = { chat_id: targetChatId, parse_mode: 'HTML' };

        if (imageUrl) {
            payload.photo = encodeURI(imageUrl);
            payload.caption = message;
        } else {
            payload.text = message;
        }

        try {
            await axios.post(telegramApiUrl, payload);
            res.status(200).json({ message: 'Successfully posted announcement to Telegram' });
        } catch (error) {
            const errorData = error.response?.data;
            const newChatId = errorData?.parameters?.migrate_to_chat_id;

            if (newChatId) {
                console.warn(`[AUTO-FIX] Telegram group upgraded. Old Chat ID: ${targetChatId}, New Chat ID: ${newChatId}`);
                try {
                    await supabaseAdmin.from('agents').update({ telegram_chat_id: newChatId.toString() }).eq('telegram_chat_id', targetChatId.toString());
                    await axios.post(telegramApiUrl, { ...payload, chat_id: newChatId });
                    return res.status(200).json({ message: 'Successfully posted after auto-fixing Chat ID.' });
                } catch (autoFixError) {
                    console.error(`[AUTO-FIX-ERROR] Failed during auto-fix process: ${autoFixError.message}`);
                }
            }

            console.error(`[ERROR] Failed to send announcement to Telegram: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
            res.status(500).json({ message: `فشل الإرسال إلى تلجرام. السبب: ${error.response?.data?.description || 'Unknown error'}` });
        }
    });

    // Endpoint to get chat info from Telegram
    router.get('/get-chat-info', authMiddleware, async (req, res) => {
        const { chatId } = req.query;
        if (!chatId) return res.status(400).json({ message: 'Chat ID is required.' });
        if (!TELEGRAM_BOT_TOKEN) return res.status(500).json({ message: 'Telegram integration is not configured.' });

        const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat`;
        try {
            const response = await axios.post(telegramApiUrl, { chat_id: chatId });
            const chatTitle = response.data?.result?.title;
            if (!chatTitle) throw new Error('Could not retrieve chat title.');
            res.status(200).json({ title: chatTitle });
        } catch (error) {
            const errorDetails = error.response ? error.response.data.description : error.message;
            console.error(`[ERROR] Failed to get chat info for ${chatId}: ${errorDetails}`);
            res.status(500).json({ message: `فشل جلب بيانات المجموعة من تلجرام.` });
        }
    });

    return router;
};