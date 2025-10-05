const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agent.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/', agentController.getAllAgents);
router.post('/', agentController.createAgent);

// --- FIX: Add the missing route for checking agent_id uniqueness ---
router.get('/check-uniqueness', agentController.checkUniqueness);

router.get('/:id', agentController.getAgentById);
router.put('/:id', agentController.updateAgent);
router.delete('/:id', agentController.deleteAgent);

// --- NEW: Special route for bulk renewal ---
router.post('/bulk-renew', agentController.bulkRenewBalances);

// --- FIX: The test route was missing from the previous commit ---
router.post('/trigger-renewal-test', agentController.triggerRenewalJob);

// --- NEW: Route to renew a single agent's balance ---
router.post('/:id/renew', agentController.renewSingleAgentBalance);

module.exports = router;