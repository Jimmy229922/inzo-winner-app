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
        return res.status(500).json({ message: 'Telegram bot is not initialized on the server.' });
    }
    if (!message || !chatId) {
        return res.status(400).json({ message: 'Message and Chat ID are required.' });
    }

    try {
        // --- FIX: Handle relative image paths by sending a file buffer ---
        if (imageUrl && imageUrl.startsWith('/')) {
            // This block handles relative paths (e.g., /uploads/... or /images/...) which point to local files.
            // Telegram's servers can't access these directly, so we read the file and send it as a buffer.
            try {
                let imagePath;

                // Check if the path is for a frontend asset or a backend upload
                if (imageUrl.startsWith('/images/')) {
                    // Path is relative to the frontend directory
                    imagePath = path.join(__dirname, '..', '..', '..', 'frontend', imageUrl);
                } else {
                    // Assume other paths (like /uploads/) are relative to the backend directory's root
                    imagePath = path.join(__dirname, '..', '..', imageUrl);
                }

                console.log(`[Telegram] Attempting to read image from path: ${imagePath}`);

                // Read the file into a buffer
                const imageBuffer = await fs.readFile(imagePath);
                console.log(`[Telegram] Image buffer read successfully. Size: ${imageBuffer.length} bytes`);

                // Send the buffer as a photo
                await bot.sendPhoto(chatId, imageBuffer, { caption: message, parse_mode: 'HTML' });
                console.log(`[Telegram] Image sent successfully to chat ID: ${chatId}`);

            } catch (fileError) {
                // If reading the local file fails, log the error and do not send to Telegram.
                console.error(`[Telegram] Could not read local file for path ${imageUrl}. Error: ${fileError.message}`);
                // We can't fall back to sending the URL because it's not a valid URL.
                // We'll let the generic error handler below catch this and inform the user.
                throw new Error(`Server could not process image file: ${fileError.message}`);
            }
        } else if (imageUrl) {
            // This handles absolute remote URLs (e.g., from a CDN).
            await bot.sendPhoto(chatId, imageUrl, { caption: message, parse_mode: 'HTML' });
        } else {
            // Handle a text-only message if no imageUrl is provided.
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
        return res.status(500).json({ message: 'Telegram bot is not initialized on the server.' });
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