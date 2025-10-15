const express = require('express');
const router = express.Router();
const competitionController = require('../controllers/competition.controller');

// Get all competitions with filtering, sorting, and pagination
router.get('/', competitionController.getAllCompetitions);
// --- NEW: Check for competition existence ---
router.get('/check-existence', competitionController.checkCompetitionExistence);

router.post('/', competitionController.createCompetition);

// --- NEW: Bulk actions for competitions ---
router.put('/bulk-update', competitionController.bulkUpdateCompetitions);
// --- NEW: Bulk delete competitions ---
router.delete('/bulk-delete', competitionController.bulkDeleteCompetitions);

router.put('/:id', competitionController.updateCompetition);
router.delete('/:id', competitionController.deleteCompetition);

module.exports = router;