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
        if (imageUrl && imageUrl.startsWith('http://localhost')) {
            // Handle local image: read it and send as a stream
            const imagePath = path.join(__dirname, '..', '..', '..', 'frontend', 'images', 'competition_bg.jpg');
            const imageBuffer = await fs.readFile(imagePath);
            await bot.sendPhoto(chatId, imageBuffer, { caption: message, parse_mode: 'HTML' });
        } else {
            // Handle remote image URL or text-only message
            if (imageUrl) {
                await bot.sendPhoto(chatId, imageUrl, { caption: message, parse_mode: 'HTML' });
            } else {
                await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
            }
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