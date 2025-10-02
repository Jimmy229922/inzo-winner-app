const express = require('express');
const axios = require('axios');
const { exec } = require('child_process');
const path = require('path');

/**
 * Creates and configures the API router.
 * @param {object} dependencies - Dependencies injected from server.js
 * @param {object} dependencies.supabaseAdmin - The Supabase admin client.
 * @param {function(): string} dependencies.getTelegramBotToken - Function to get the current Telegram bot token.
 * @param {function(): string} dependencies.getTelegramChatId - Function to get the current Telegram chat ID.
 * @returns {express.Router} The configured Express router.
 */
module.exports = function(dependencies) {
    const { supabaseAdmin, getTelegramBotToken, getTelegramChatId } = dependencies;
    const router = express.Router();

    // Middleware to check if Supabase client is available for routes that need it.
    const requireSupabase = (req, res, next) => {
        if (!supabaseAdmin) {
            return res.status(503).json({ message: 'Database service is not available.' });
        }
        next();
    };

    // --- NEW: Authentication Middleware (moved from server.js) ---
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

    // Example/Health-check route
    router.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok', message: 'API is running' });
    });

    // --- FIX: Add the missing /config endpoint ---
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

    // --- Routes moved from old api.js for better organization ---

    // Endpoint to update the application via git pull
    router.post('/update-app', authMiddleware, async (req, res) => {
        console.log('[UPDATE] Received request to update the application from remote.');
        // Note: The CWD should be the root of the git repository.
        exec('git pull origin main', { cwd: path.join(__dirname, '../../') }, async (error, stdout, stderr) => {
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
                process.exit(42); // Special exit code to trigger restart in start-server.bat
            }, 1500);
        });
    });

    // Endpoint to post a generic announcement to Telegram
    router.post('/post-announcement', authMiddleware, async (req, res) => {
        const { message, chatId, imageUrl } = req.body;

        if (!message) return res.status(400).json({ message: 'Message content is required' });

        const botToken = getTelegramBotToken();
        const targetChatId = chatId || getTelegramChatId();
        if (!botToken || !targetChatId) {
            return res.status(500).json({ message: 'Telegram integration is not configured on the server.' });
        }

        const apiMethod = imageUrl ? 'sendPhoto' : 'sendMessage';
        const telegramApiUrl = `https://api.telegram.org/bot${botToken}/${apiMethod}`;
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
                    // Attempt to fix the chat ID in the database
                    await supabaseAdmin.from('agents').update({ telegram_chat_id: newChatId.toString() }).eq('telegram_chat_id', targetChatId.toString());
                    // Retry sending the message
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
        const botToken = getTelegramBotToken();
        if (!botToken) return res.status(500).json({ message: 'Telegram integration is not configured.' });

        const telegramApiUrl = `https://api.telegram.org/bot${botToken}/getChat`;
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

    // --- NEW: Endpoint to get all users (for admin panel) ---
    router.get('/users', authMiddleware, async (req, res) => {
        // 1. Check for admin privileges
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', req.user.id)
            .single();

        if (profileError || !profile) {
            return res.status(500).json({ message: 'Could not verify user role.' });
        }

        if (profile.role !== 'admin' && profile.role !== 'super_admin') {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to view users.' });
        }

        // 2. Fetch all users
        try {
            const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
            if (listError) throw listError;

            // 3. Fetch profiles from the public 'users' table to merge roles and other details
            const { data: profiles, error: profilesError } = await supabaseAdmin.from('users').select('*');
            if (profilesError) throw profilesError;

            res.status(200).json({ users: users, profiles: profiles });
        } catch (error) {
            res.status(500).json({ message: `Failed to fetch users: ${error.message}` });
        }
    });

    // --- NEW: Endpoint to create a user ---
    router.post('/users', authMiddleware, async (req, res) => {
        const { email, password, full_name, role } = req.body;
        // Only super_admin can create new users
        const { data: profile } = await supabaseAdmin.from('users').select('role').eq('id', req.user.id).single();
        if (profile.role !== 'super_admin') {
            return res.status(403).json({ message: 'Forbidden: Only Super Admins can create users.' });
        }

        try {
            const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true, // Auto-confirm email
            });
            if (error) throw error;

            // FIX: The database has a trigger that auto-creates a user profile.
            // Instead of inserting, we must UPDATE the existing profile.
            const { error: profileError } = await supabaseAdmin
                .from('users')
                .update({ full_name, role })
                .eq('id', user.id);

            if (profileError) {
                // If profile creation fails, try to delete the auth user to avoid orphans
                await supabaseAdmin.auth.admin.deleteUser(user.id);
                throw profileError;
            }

            res.status(201).json({ message: 'User created successfully.', user });
        } catch (error) {
            res.status(500).json({ message: `Failed to create user: ${error.message}` });
        }
    });

    // --- NEW: Endpoint to update a user ---
    router.put('/users/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        const { full_name, password, avatar_url, permissions } = req.body;

        try {
            const updatePayload = { data: {} };
            if (full_name) updatePayload.data.full_name = full_name;
            if (password) updatePayload.password = password;

            const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, updatePayload);
            if (authError) throw authError;

            const { error: profileError } = await supabaseAdmin.from('users').update({ full_name, avatar_url, permissions }).eq('id', id);
            if (profileError) throw profileError;

            res.status(200).json({ message: 'User updated successfully.' });
        } catch (error) {
            res.status(500).json({ message: `Failed to update user: ${error.message}` });
        }
    });

    // --- NEW: Endpoint to delete a user ---
    router.delete('/users/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;

        // 1. Check for super_admin privileges
        const { data: profile, error: profileError } = await supabaseAdmin.from('users').select('role').eq('id', req.user.id).single();
        if (profileError || !profile) {
            return res.status(500).json({ message: 'Could not verify user role.' });
        }
        if (profile.role !== 'super_admin') {
            return res.status(403).json({ message: 'Forbidden: Only Super Admins can delete users.' });
        }

        // 2. Prevent self-deletion
        if (req.user.id === id) {
            return res.status(400).json({ message: 'لا يمكنك حذف حسابك الخاص.' });
        }

        // 3. Delete the user from Supabase Auth
        try {
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
            if (deleteError) throw deleteError;
            res.status(200).json({ message: 'User deleted successfully.' });
        } catch (error) {
            res.status(500).json({ message: `Failed to delete user: ${error.message}` });
        }
    });

    return router;
};
