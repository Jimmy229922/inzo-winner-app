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
        console.error(`Telegram API Error (sendMessage): ${error.message}`);
        throw new Error(`Failed to send message to chat ID ${chatId}. Reason: ${error.message}`);
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
        console.error(`Telegram API Error (sendPhoto): ${error.message}`);
        throw new Error(`Failed to send photo to chat ID ${chatId}. Reason: ${error.message}`);
    }
}

module.exports = { postToTelegram, sendPhotoToTelegram };