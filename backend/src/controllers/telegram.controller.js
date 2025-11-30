const path = require('path');
const fs = require('fs').promises;

/**
 * Posts an announcement to a Telegram chat.
 * It now gets the bot instance from req.app.locals.
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

    try {
        // --- FIX: Handle relative image paths safely and fall back to text-only send ---
        // Telegram cannot reach local URLs, so we resolve the file on disk and send the buffer.
        if (imageUrl && imageUrl.startsWith('/')) {
            // Remove the leading slash so path.join does not discard the base path
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

                await bot.sendPhoto(
                    chatId,
                    imageBuffer,
                    { caption: message, parse_mode: 'HTML' },
                    { filename, contentType }
                );
                console.log(`[Telegram] Image sent successfully to chat ID: ${chatId}`);
            } catch (fileError) {
                // If the image cannot be read (wrong path / missing file), log and fall back to text-only message.
                console.error(`[Telegram] Could not read local file for path ${imageUrl}. Error: ${fileError.message}`);
                await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
                return res.status(200).json({
                    message: 'Message sent to Telegram without image (image file not found on server).',
                    hint: 'Verify the competition image path is accessible to the backend.'
                });
            }
        } else if (imageUrl) {
            // Absolute remote URL
            await bot.sendPhoto(chatId, imageUrl, { caption: message, parse_mode: 'HTML' });
        } else {
            // Text-only message
            await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        }

        res.status(200).json({ message: 'Message sent successfully to Telegram.' });
    } catch (error) {
        console.error(`Error sending message to Telegram chat ID ${chatId}:`, error.message);
        const apiResponse = error.response || {};
        const statusCode = apiResponse.statusCode || 500;
        const telegramError = apiResponse.body?.description || 'Unknown Telegram error';
        const errorMessage = `فشل الإرسال إلى تيليجرام: ${telegramError}`;

        // Return the status code we got from Telegram API if available (e.g., 400 for bad request, 403 for forbidden)
        // Otherwise, default to 500 for internal server errors.
        const responseStatus = (statusCode >= 400 && statusCode < 500) ? statusCode : 500;

        res.status(responseStatus).json({ message: errorMessage, telegram_error: telegramError });
    }
};

/**
 * Gets information about a Telegram chat.
 * It now gets the bot instance from req.app.locals.
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
