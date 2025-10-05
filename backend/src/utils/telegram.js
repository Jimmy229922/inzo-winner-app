const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Sends a text message to a specified Telegram chat.
 * @param {string} text The message text. Supports HTML formatting.
 * @param {string|number} chatId The ID of the target chat.
 * @returns {Promise<object>} The response data from the Telegram API.
 */
async function postToTelegram(text, chatId) {
    if (!BOT_TOKEN) {
        throw new Error('TELEGRAM_BOT_TOKEN is not configured in the environment variables.');
    }
    if (!chatId) {
        throw new Error('A valid Chat ID must be provided.');
    }

    try {
        const response = await axios.post(`${BASE_URL}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        });
        return response.data;
    } catch (error) {
        console.error(`Telegram API Error (sendMessage): ${error.response?.data?.description || error.message}`);
        // Re-throw a more specific error to be handled by the caller
        throw new Error(`Failed to send message to chat ID ${chatId}. Reason: ${error.response?.data?.description || error.message}`);
    }
}

/**
 * Sends a photo with a caption to a specified Telegram chat.
 * @param {string} imageUrl The URL of the photo to send.
 * @param {string} caption The caption for the photo. Supports HTML formatting.
 * @param {string|number} chatId The ID of the target chat.
 * @returns {Promise<object>} The response data from the Telegram API.
 */

module.exports = { postToTelegram };