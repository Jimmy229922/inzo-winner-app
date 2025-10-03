const axios = require('axios');
const path = require('path');
const { Blob } = require('buffer');
const fs = require('fs').promises;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GENERAL_CHAT_ID = process.env.TELEGRAM_GENERAL_CHAT_ID;

const getApiUrl = (method) => `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;

exports.postAnnouncement = async (req, res) => {
    const { message, chatId, imageUrl } = req.body;
    const targetChatId = chatId || GENERAL_CHAT_ID;

    if (!BOT_TOKEN) {
        return res.status(500).json({ message: 'Telegram Bot Token is not configured on the server.' });
    }
    if (!targetChatId) {
        return res.status(400).json({ message: 'No target chat ID provided or configured.' });
    }

    try {
        if (imageUrl && imageUrl.startsWith('http://localhost')) {
            // Handle local image: read it and send as a file
            const imagePath = path.join(__dirname, '..', '..', '..', 'frontend', 'images', 'competition_bg.jpg');
            const imageBuffer = await fs.readFile(imagePath); // This is a Buffer
            const imageBlob = new Blob([imageBuffer]); // Convert Buffer to Blob
            
            const formData = new FormData();
            formData.append('chat_id', targetChatId);
            formData.append('photo', imageBlob, 'competition.jpg');
            formData.append('caption', message);
            formData.append('parse_mode', 'HTML');

            const response = await axios.post(getApiUrl('sendPhoto'), formData);
            result = response.data;
        } else {
            // Handle remote image URL or text-only message
            const method = imageUrl ? 'sendPhoto' : 'sendMessage';
            const payload = { chat_id: targetChatId, parse_mode: 'HTML' };
            if (imageUrl) {
                payload.photo = imageUrl;
                payload.caption = message;
            } else {
                payload.text = message;
            }
            const response = await axios.post(getApiUrl(method), payload);
            result = response.data;
        }
        if (!result.ok) {
            throw new Error(result.description || 'Unknown Telegram API error.');
        }

        res.status(200).json({ message: 'Message sent successfully to Telegram.', data: result });
    } catch (error) {
        console.error('Error sending message to Telegram:', error);
        // --- تحسين: إظهار رسالة الخطأ من تلجرام مباشرة إن وجدت ---
        if (error.response && error.response.data) {
            return res.status(error.response.status).json({ message: `Telegram API Error: ${error.response.data.description}` });
        }
        res.status(500).json({ message: `Failed to send message: ${error.message}` });
    }
};

exports.getChatInfo = async (req, res) => {
    const { chatId } = req.query;
    if (!chatId) {
        return res.status(400).json({ message: 'Chat ID is required.' });
    }

    if (!BOT_TOKEN) {
        return res.status(500).json({ message: 'Telegram Bot Token is not configured on the server.' });
    }

    try {
        const response = await axios.post(getApiUrl('getChat'), { chat_id: chatId });
        const result = response.data;
        if (!result.ok) {
            throw new Error(result.description || 'Failed to get chat info.');
        }
        res.json(result.result);
    } catch (error) {
        console.error('Error getting chat info from Telegram:', error);
        // --- تحسين: إظهار رسالة الخطأ من تلجرام مباشرة إن وجدت ---
        if (error.response && error.response.data) {
            return res.status(error.response.status).json({ message: `Telegram API Error: ${error.response.data.description}` });
        }
        res.status(500).json({ message: `Failed to get chat info: ${error.message}` });
    }
};