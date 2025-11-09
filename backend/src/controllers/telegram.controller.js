const path = require('path');
const fs = require('fs').promises;

/**
 * Posts an announcement to a Telegram chat.
 * It now gets the bot instance from req.app.locals.
 */
exports.postAnnouncement = async (req, res) => {
    const { message, chatId, imageUrl } = req.body;
    const bot = req.app.locals.telegramBot;

    console.log(`[Telegram Debug] postAnnouncement called with:`);
    console.log(`[Telegram Debug]   message: ${message ? message.substring(0, 50) + '...' : 'N/A'}`);
    console.log(`[Telegram Debug]   chatId: ${chatId}`);
    console.log(`[Telegram Debug]   imageUrl: ${imageUrl}`);

    if (!bot) {
        console.error(`[Telegram Debug] Bot not initialized.`);
        return res.status(500).json({ message: 'Telegram bot is not initialized on the server.' });
    }
    if (!message || !chatId) {
        console.error(`[Telegram Debug] Message or Chat ID missing.`);
        return res.status(400).json({ message: 'Message and Chat ID are required.' });
    }

    try {
        if (imageUrl && imageUrl.startsWith('/')) {
            console.log(`[Telegram Debug] Handling relative image URL: ${imageUrl}`);
            try {
                let imagePath;

                if (imageUrl.startsWith('/images/')) {
                    imagePath = path.join(__dirname, '..', '..', '..', 'frontend', imageUrl);
                } else {
                    imagePath = path.join(__dirname, '..', '..', imageUrl);
                }

                console.log(`[Telegram Debug] Attempting to read image from path: ${imagePath}`);

                const imageBuffer = await fs.readFile(imagePath);
                console.log(`[Telegram Debug] Image buffer read successfully. Size: ${imageBuffer.length} bytes`);

                await bot.sendPhoto(chatId, imageBuffer, { caption: message, parse_mode: 'HTML' });
                console.log(`[Telegram Debug] Image sent successfully to chat ID: ${chatId}`);

            } catch (fileError) {
                console.error(`[Telegram Debug] Could not read local file for path ${imageUrl}. Error: ${fileError.message}`);
                throw new Error(`Server could not process image file: ${fileError.message}`);
            }
        } else if (imageUrl) {
            console.log(`[Telegram Debug] Handling absolute image URL: ${imageUrl}`);
            await bot.sendPhoto(chatId, imageUrl, { caption: message, parse_mode: 'HTML' });
            console.log(`[Telegram Debug] Image sent successfully to chat ID: ${chatId}`);
        } else {
            console.log(`[Telegram Debug] Sending text-only message.`);
            await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
            console.log(`[Telegram Debug] Text message sent successfully to chat ID: ${chatId}`);
        }

        res.status(200).json({ message: 'Message sent successfully to Telegram.' });
    } catch (error) {
        console.error(`[Telegram Debug] Error in postAnnouncement for chat ID ${chatId}:`, error);
        const apiResponse = error.response || {};
        const statusCode = apiResponse.statusCode || 500;
        const telegramError = apiResponse.body?.description || 'Unknown Telegram error';
        const errorMessage = `فشل الإرسال إلى تيليجرام: ${telegramError}`;

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