// تحميل المكتبات اللازمة
require('dotenv').config(); // لتحميل المتغيرات من ملف .env
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = 3000;

// Middlewares
app.use(cors()); // للسماح للـ Frontend بالتواصل مع الـ Backend
app.use(express.json()); // لتحليل البيانات القادمة بصيغة JSON

// استخراج بيانات التيليجرام من ملف .env
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Endpoint لاستقبال طلبات النشر
app.post('/post-winner', async (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'Winner name is required' });
    }

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error('Telegram Bot Token or Chat ID is not configured.');
        return res.status(500).json({ message: 'Telegram integration is not configured on the server.' });
    }

    const message = `🎉 تهانينا للفائز الجديد في Enzo! 🎉\n\n ✨ ${name} ✨ \n\nحظاً أوفر للبقية!`;
    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
        await axios.post(telegramApiUrl, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
        });
        console.log(`Message sent for winner: ${name}`);
        res.status(200).json({ message: 'Successfully posted to Telegram' });
    } catch (error) {
        console.error('Error sending message to Telegram:', error.response ? error.response.data : error.message);
        res.status(500).json({ message: 'Failed to post to Telegram' });
    }
});

// تشغيل السيرفر
app.listen(port, () => {
    console.log(`Backend server is running at http://localhost:${port}`);
});