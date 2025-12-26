/**
 * Sends a text message to a specified Telegram chat using the provided bot instance.
 * @param {object} bot The Telegram bot instance.
 * @param {string} text The message text. Supports HTML formatting.
 * @param {string|number} chatId The ID of the target chat.
 * @returns {Promise<object>} The response data from the Telegram API.
 */
async function postToTelegram(bot, text, chatId) {
    if (!bot) {
        throw new Error('Telegram bot instance is not provided.');
    }
    if (!chatId) {
        throw new Error('A valid Chat ID must be provided.');
    }

    try {
        const response = await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        return response;
    } catch (error) {
        // Preserve the original Telegram description/status to bubble up to API responses.
        const telegramDescription = error?.response?.body?.description || error.message;
        const statusCode = error?.response?.statusCode || error?.response?.status;
        const wrappedError = new Error(`Failed to send message to chat ID ${chatId}. Reason: ${telegramDescription}`);
        wrappedError.telegramDescription = telegramDescription;
        wrappedError.telegramStatus = statusCode;
        console.error(`Telegram API Error (sendMessage): ${telegramDescription}`);
        throw wrappedError;
    }
}

/**
 * Sends a photo with a caption to a specified Telegram chat using the provided bot instance.
 * @param {object} bot The Telegram bot instance.
 * @param {string} imageUrl The URL of the photo to send (can be a remote URL or a local file path).
 * @param {string} caption The caption for the photo. Supports HTML formatting.
 * @param {string|number} chatId The ID of the target chat.
 * @returns {Promise<object>} The response data from the Telegram API.
 */
async function sendPhotoToTelegram(bot, imageUrl, caption, chatId) {
    if (!bot) {
        throw new Error('Telegram bot instance is not provided.');
    }
    if (!chatId) {
        throw new Error('A valid Chat ID must be provided.');
    }
    if (!imageUrl) {
        throw new Error('An image URL must be provided.');
    }

    try {
        const response = await bot.sendPhoto(chatId, imageUrl, { caption: caption, parse_mode: 'HTML' });
        return response;
    } catch (error) {
        const telegramDescription = error?.response?.body?.description || error.message;
        const statusCode = error?.response?.statusCode || error?.response?.status;
        const wrappedError = new Error(`Failed to send photo to chat ID ${chatId}. Reason: ${telegramDescription}`);
        wrappedError.telegramDescription = telegramDescription;
        wrappedError.telegramStatus = statusCode;
        console.error(`Telegram API Error (sendPhoto): ${telegramDescription}`);
        throw wrappedError;
    }
}

/**
 * Sends a video with a caption to a specified Telegram chat using the provided bot instance.
 * @param {object} bot The Telegram bot instance.
 * @param {string} videoUrl The URL of the video to send.
 * @param {string} caption The caption for the video. Supports HTML formatting.
 * @param {string|number} chatId The ID of the target chat.
 * @returns {Promise<object>} The response data from the Telegram API.
 */
async function sendVideoToTelegram(bot, videoUrl, caption, chatId) {
    if (!bot) {
        throw new Error('Telegram bot instance is not provided.');
    }
    if (!chatId) {
        throw new Error('A valid Chat ID must be provided.');
    }
    if (!videoUrl) {
        throw new Error('A video URL must be provided.');
    }

    try {
        const response = await bot.sendVideo(chatId, videoUrl, { caption: caption, parse_mode: 'HTML' });
        return response;
    } catch (error) {
        const telegramDescription = error?.response?.body?.description || error.message;
        const statusCode = error?.response?.statusCode || error?.response?.status;
        const wrappedError = new Error(`Failed to send video to chat ID ${chatId}. Reason: ${telegramDescription}`);
        wrappedError.telegramDescription = telegramDescription;
        wrappedError.telegramStatus = statusCode;
        console.error(`Telegram API Error (sendVideo): ${telegramDescription}`);
        throw wrappedError;
    }
}

/**
 * Sends a group of media (photos or videos) to a specified Telegram chat.
 * @param {object} bot The Telegram bot instance.
 * @param {Array<object>} media The array of media objects (type, media, caption, parse_mode).
 * @param {string|number} chatId The ID of the target chat.
 * @returns {Promise<object>} The response data from the Telegram API.
 */
async function sendMediaGroupToTelegram(bot, media, chatId) {
    if (!bot) {
        throw new Error('Telegram bot instance is not provided.');
    }
    if (!chatId) {
        throw new Error('A valid Chat ID must be provided.');
    }
    if (!media || !Array.isArray(media) || media.length === 0) {
        throw new Error('A valid media array must be provided.');
    }

    try {
        const response = await bot.sendMediaGroup(chatId, media);
        return response;
    } catch (error) {
        const telegramDescription = error?.response?.body?.description || error.message;
        const statusCode = error?.response?.statusCode || error?.response?.status;
        const wrappedError = new Error(`Failed to send media group to chat ID ${chatId}. Reason: ${telegramDescription}`);
        wrappedError.telegramDescription = telegramDescription;
        wrappedError.telegramStatus = statusCode;
        console.error(`Telegram API Error (sendMediaGroup): ${telegramDescription}`);
        throw wrappedError;
    }
}

module.exports = { postToTelegram, sendPhotoToTelegram, sendVideoToTelegram, sendMediaGroupToTelegram };