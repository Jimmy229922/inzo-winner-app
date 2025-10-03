const express = require('express');
const router = express.Router();
const competitionController = require('../controllers/competition.controller');

router.get('/', competitionController.getAllCompetitions);
router.post('/', competitionController.createCompetition);

router.put('/bulk-update', competitionController.bulkUpdateCompetitions);
router.delete('/bulk-delete', competitionController.bulkDeleteCompetitions);

router.put('/:id', competitionController.updateCompetition);
router.delete('/:id', competitionController.deleteCompetition);

module.exports = router;