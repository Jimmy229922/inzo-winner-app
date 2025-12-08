const path = require('path');
const fs = require('fs').promises;

// In-memory idempotency cache to prevent accidental double-send (same exact request)
const recentAnnouncements = new Map(); // key -> expiry timestamp
const ANNOUNCEMENT_TTL_MS = 5 * 1000; // 5 seconds only - just to prevent accidental double-clicks

/**
 * Creates a hash from the full message content for accurate duplicate detection.
 * @param {string} str - String to hash
 * @returns {number} Simple hash number
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

/**
 * Checks if the announcement key is a duplicate (already sent recently).
 * @param {string} key - Unique key for the announcement
 * @returns {boolean} True if duplicate, false otherwise
 */
function isDuplicateAnnouncement(key) {
    const now = Date.now();
    // Clean up expired entries
    for (const [k, expiry] of recentAnnouncements) {
        if (expiry < now) {
            recentAnnouncements.delete(k);
        }
    }
    // Check if this key exists and is not expired
    if (recentAnnouncements.has(key)) {
        return true;
    }
    return false;
}

/**
 * Marks an announcement key as sent.
 * @param {string} key - Unique key for the announcement
 */
function markAnnouncementSent(key) {
    recentAnnouncements.set(key, Date.now() + ANNOUNCEMENT_TTL_MS);
}

/**
 * Posts an announcement to Telegram.
 * It gets the bot instance from req.app.locals.
 */
exports.postAnnouncement = async (req, res) => {
    const { message, chatId, imageUrl } = req.body;
    const bot = req.app.locals.telegramBot;

    if (!bot) {
        return res.status(503).json({ 
            message: 'Telegram bot is not initialized on the server.',
            hint: 'Please check TELEGRAM_BOT_TOKEN in .env or contact administrator.'
        });
    }
    if (!message || !chatId) {
        return res.status(400).json({ message: 'Message and Chat ID are required.' });
    }

    // Generate idempotency key based on chatId and FULL message hash to distinguish different competitions
    const messageHash = simpleHash(message + (imageUrl || ''));
    const idempotencyKey = `${chatId}-${messageHash}`;
    
    // --- NEW: Check shared cache for duplicates from Competition Controller ---
    // We also check the hash of the message ONLY, because the ghost call might not have the image URL.
    const textOnlyHash = simpleHash(message);
    const textDedupKey = `${chatId}-${textOnlyHash}`;

    if (req.app.locals.recentMessages) {
        // Clean up expired entries first (lazy cleanup)
        for (const [key, expiry] of req.app.locals.recentMessages) {
            if (expiry < Date.now()) {
                req.app.locals.recentMessages.delete(key);
            }
        }

        if (req.app.locals.recentMessages.has(textDedupKey)) {
            console.log(`[Telegram] BLOCKED duplicate announcement for chat ${chatId} (already sent by Competition Controller).`);
            return res.status(200).json({ 
                message: 'Announcement blocked (duplicate detection).',
                duplicate: true
            });
        }
    }
    
    // Check for duplicate announcement (only blocks same exact message within 5 seconds)
    if (isDuplicateAnnouncement(idempotencyKey)) {
        console.log(`[Telegram] Duplicate announcement detected for chat ${chatId} (same message sent within 5 seconds), skipping.`);
        return res.status(200).json({ 
            message: 'Announcement already sent recently (duplicate prevention).',
            duplicate: true
        });
    }

    try {
        // Telegram caption limit is 1024 characters for photos
        const TELEGRAM_CAPTION_LIMIT = 1024;
        
        // Determine if we need to split the message (Photo + Reply)
        const shouldSplit = message.length > TELEGRAM_CAPTION_LIMIT;
        let captionToSend = message;
        
        if (shouldSplit) {
            console.log(`[Telegram] Message is ${message.length} chars (exceeds ${TELEGRAM_CAPTION_LIMIT}). Switching to Split Mode.`);
            // For the photo caption, we use a fixed short title
            captionToSend = `<b>مسابقة جديدة</b>`;
        }

        // Telegram cannot reach local URLs, so we resolve the file on disk and send the buffer.
        if (imageUrl && imageUrl.startsWith('/')) {
            const normalizedPath = imageUrl.replace(/^\/+/, '');
            let imagePath;

            if (imageUrl.startsWith('/images/')) {
                // Frontend assets (e.g. /images/competition_bg.jpg)
                imagePath = path.join(__dirname, '..', '..', '..', 'frontend', normalizedPath);
            } else {
                // Backend uploads (e.g. /uploads/...)
                imagePath = path.join(__dirname, '..', '..', normalizedPath);
            }

            console.log(`[Telegram] Attempting to read image from path: ${imagePath}`);

            try {
                const imageBuffer = await fs.readFile(imagePath);
                console.log(`[Telegram] Image buffer read successfully. Size: ${imageBuffer.length} bytes`);

                const filename = path.basename(imagePath);
                const ext = path.extname(filename).toLowerCase();
                let contentType = 'application/octet-stream';
                if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
                else if (ext === '.png') contentType = 'image/png';
                else if (ext === '.gif') contentType = 'image/gif';

                // Send photo
                const photoMsg = await bot.sendPhoto(
                    chatId,
                    imageBuffer,
                    { caption: captionToSend, parse_mode: 'HTML' },
                    { filename, contentType }
                );
                console.log(`[Telegram] Image sent successfully to chat ID: ${chatId}`);
                
                // If split mode, send the full text as a reply
                if (shouldSplit && photoMsg && photoMsg.message_id) {
                    await bot.sendMessage(
                        chatId,
                        message,
                        { 
                            parse_mode: 'HTML', 
                            reply_to_message_id: photoMsg.message_id 
                        }
                    );
                    console.log(`[Telegram] Full text sent as reply to chat ID: ${chatId}`);
                }
                
                // Mark as sent to prevent duplicates
                markAnnouncementSent(idempotencyKey);
                
                return res.status(200).json({ message: 'Message sent successfully to Telegram.' });
            } catch (fileError) {
                // Check if it's a Telegram API error (not file read error)
                if (fileError.message && fileError.message.includes('ETELEGRAM')) {
                    console.error(`[Telegram] Telegram API error: ${fileError.message}`);
                    throw fileError;
                }
                // If the image cannot be read (wrong path / missing file), log and FAIL.
                console.error(`[Telegram] Could not read local file for path ${imageUrl}. Error: ${fileError.message}`);
                
                return res.status(400).json({
                    message: 'Failed to send message: Image file not found or unreadable.',
                    error: fileError.message
                });
            }
        } else if (imageUrl) {
            // Absolute remote URL - send photo
            const photoMsg = await bot.sendPhoto(chatId, imageUrl, { caption: captionToSend, parse_mode: 'HTML' });
            
            // If split mode, send the full text as a reply
            if (shouldSplit && photoMsg && photoMsg.message_id) {
                await bot.sendMessage(
                    chatId,
                    message,
                    { 
                        parse_mode: 'HTML', 
                        reply_to_message_id: photoMsg.message_id 
                    }
                );
            }
            
            // Mark as sent to prevent duplicates
            markAnnouncementSent(idempotencyKey);
            
            return res.status(200).json({ message: 'Message sent successfully to Telegram.' });
        } else {
            // Text-only message
            await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
            
            // Mark as sent to prevent duplicates
            markAnnouncementSent(idempotencyKey);
            
            return res.status(200).json({ message: 'Message sent successfully to Telegram.' });
        }
    } catch (error) {
        console.error(`Error sending message to Telegram chat ID ${chatId}:`, error.message);
        const apiResponse = error.response || {};
        const statusCode = apiResponse.statusCode || 500;
        const telegramError = apiResponse.body?.description || error.message || 'Unknown Telegram error';
        const errorMessage = `فشل الإرسال إلى تيليجرام: ${telegramError}`;

        // Return the status code we got from Telegram API if available (e.g., 400 for bad request, 403 for forbidden)
        // Otherwise, default to 500 for internal server errors.
        const responseStatus = (statusCode >= 400 && statusCode < 500) ? statusCode : 500;

        res.status(responseStatus).json({ message: errorMessage, telegram_error: telegramError });
    }
};

/**
 * Gets information about a Telegram chat.
 * It gets the bot instance from req.app.locals.
 */
exports.getChatInfo = async (req, res) => {
    const { chatId } = req.query;
    const bot = req.app.locals.telegramBot;

    if (!bot) {
        return res.status(503).json({ 
            message: 'Telegram bot is not initialized on the server.',
            hint: 'Please check TELEGRAM_BOT_TOKEN in .env or contact administrator.'
        });
    }
    if (!chatId) {
        return res.status(400).json({ message: 'Chat ID is required.' });
    }

    try {
        const chatInfo = await bot.getChat(chatId);
        res.json(chatInfo);
    } catch (error) {
        // Log full error for debugging
        console.error('Error getting chat info from Telegram:', error);
        const statusCode = error?.response?.statusCode || error?.response?.status || 500;
        const errorDescription = error?.response?.body?.description || error.message || 'Unknown error from Telegram API';

        // Common causes and hints
        if (errorDescription && errorDescription.includes('chat not found')) {
            return res.status(404).json({ message: `Telegram API Error: ${errorDescription}. Make sure the bot was added to the chat and the chatId is correct.` });
        }
        if (errorDescription && (errorDescription.includes('forbidden') || errorDescription.includes('bot was blocked by the user'))) {
            return res.status(403).json({ message: `Telegram API Error: ${errorDescription}. The bot may be blocked or removed from the chat.` });
        }

        res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({ message: `Failed to get chat info: ${errorDescription}` });
    }
};

/**
 * Gets the status of the Telegram bot.
 */
exports.getStatus = async (req, res) => {
    const bot = req.app.locals.telegramBot;
    if (!bot) return res.json({ initialized: false, message: 'Telegram bot is not initialized on the server.' });
    try {
        const me = await bot.getMe();
        res.json({ initialized: true, me });
    } catch (err) {
        console.error('Error checking Telegram bot status:', err);
        res.status(500).json({ initialized: false, message: err.message });
    }
};
