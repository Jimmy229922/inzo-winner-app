const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agent.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/', agentController.getAllAgents);
router.post('/', agentController.createAgent);

router.get('/:id', agentController.getAgentById);
router.put('/:id', agentController.updateAgent);
router.delete('/:id', agentController.deleteAgent);

// --- NEW: Special route for bulk renewal ---
router.post('/bulk-renew', agentController.bulkRenewBalances);

module.exports = router;