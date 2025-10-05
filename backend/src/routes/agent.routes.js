const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agent.controller');

// GET /api/agents - Get all agents with filtering and pagination
router.get('/', agentController.getAllAgents);

// GET /api/agents/check-uniqueness - Check if an agent ID is unique
router.get('/check-uniqueness', agentController.checkUniqueness);

// POST /api/agents - Create a new agent
router.post('/', agentController.createAgent);

// POST /api/agents/bulk-insert - Create multiple agents
router.post('/bulk-insert', agentController.bulkInsertAgents);

// PUT /api/agents/bulk-update - Update multiple agents
router.put('/bulk-update', agentController.bulkUpdateAgents);

// DELETE /api/agents/delete-all - Delete all agents
router.delete('/delete-all', agentController.deleteAllAgents);

// GET, PUT, DELETE for a single agent by ID
router.route('/:id')
    .get(agentController.getAgentById)
    .put(agentController.updateAgent)
    .delete(agentController.deleteAgent);

module.exports = router;