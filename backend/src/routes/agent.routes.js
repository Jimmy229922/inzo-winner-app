
const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agent.controller');

router.get('/', agentController.getAllAgents);
router.get('/check-uniqueness', agentController.checkUniqueness);
router.get('/:id', agentController.getAgentById);
router.post('/', agentController.createAgent);
router.post('/bulk-insert', agentController.bulkInsertAgents);
router.post('/bulk-renew', agentController.bulkRenewBalances);
router.put('/bulk-update', agentController.bulkUpdateAgents);
router.put('/:id', agentController.updateAgent);
router.delete('/delete-all', agentController.deleteAllAgents);
router.delete('/:id', agentController.deleteAgent);

module.exports = router;
                