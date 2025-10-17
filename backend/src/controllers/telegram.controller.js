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
            // This block handles relative paths (e.g., /uploads/...) which point to local files.
            // Telegram's servers can't access these directly.
            // We must read the image from our filesystem and send it as a file buffer.
            try {
                // The imageUrl is the relative path from the root of the backend project.
                // e.g., /uploads/competitions/image.jpg
                // We need to construct the full path on the filesystem.
                const imagePath = path.join(__dirname, '..', '..', imageUrl);

                // Read the file into a buffer
                const imageBuffer = await fs.readFile(imagePath);
                // Send the buffer as a photo
                await bot.sendPhoto(chatId, imageBuffer, { caption: message, parse_mode: 'HTML' });
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
        console.error('Error getting chat info from Telegram:', error.message);
        const errorMessage = error.response?.body?.description || error.message;
        // Handle specific "chat not found" error from Telegram API
        if (errorMessage.includes('chat not found')) {
            return res.status(404).json({ message: `Telegram API Error: ${errorMessage}` });
        }
        res.status(500).json({ message: `Failed to get chat info: ${errorMessage}` });
    }
};