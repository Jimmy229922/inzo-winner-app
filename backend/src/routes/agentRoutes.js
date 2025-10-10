const express = require('express');
const router = express.Router();
const Agent = require('../models/Agent');
const { protect, admin } = require('../middleware/authMiddleware');
const { getBotInstance } = require('../services/telegramBot');

/**
 * @desc    Bulk check if the bot is a member of agent groups
 * @route   POST /api/agents/bulk-check-bot-presence
 * @access  Private/Admin
 */
router.post('/bulk-check-bot-presence', protect, admin, async (req, res) => {
    try {
        const bot = getBotInstance();
        if (!bot) {
            return res.status(500).json({ message: 'لم يتم تهيئة بوت التلجرام.' });
        }

        // Find all agents that have a telegram_chat_id
        const agentsToCheck = await Agent.find({
            telegram_chat_id: { $ne: null, $ne: '' }
        }).select('name agent_id telegram_chat_id').lean();

        let successCount = 0;
        let failureCount = 0;
        const failures = [];

        for (const agent of agentsToCheck) {
            try {
                // getChat will throw an error if the bot is not in the chat
                await bot.telegram.getChat(agent.telegram_chat_id);
                successCount++;
            } catch (error) {
                // This error is expected if the bot is not in the group
                failureCount++;
                failures.push({
                    name: agent.name,
                    agent_id: agent.agent_id,
                    chat_id: agent.telegram_chat_id
                });
            }
        }

        res.json({
            totalChecked: agentsToCheck.length,
            successCount,
            failureCount,
            failures
        });

    } catch (error) {
        console.error('Error during bulk bot presence check:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء عملية الفحص.' });
    }
});

module.exports = router;