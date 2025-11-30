const express = require('express');
const router = express.Router();
const competitionController = require('../controllers/competition.controller');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Multer configuration for competition image uploads ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', '..', 'uploads', 'competitions');
        // Create the directory if it doesn't exist
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `competition-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

// Get all competitions with filtering, sorting, and pagination
router.get('/', competitionController.getAllCompetitions);

// Get active competition for a specific agent
router.get('/agent/:agentId/active', competitionController.getAgentActiveCompetition);

// --- NEW: Check for competition existence ---
router.get('/check-existence', competitionController.checkCompetitionExistence);

router.get('/:id', competitionController.getCompetitionById);

// --- NEW: Upload a competition image ---
router.post('/upload-image', upload.single('image'), competitionController.uploadImage);

router.post('/', competitionController.createCompetition);

// --- NEW: Bulk actions for competitions ---
router.put('/bulk-update', competitionController.bulkUpdateCompetitions);
// --- NEW: Bulk delete competitions ---
router.delete('/bulk-delete', competitionController.bulkDeleteCompetitions);

router.put('/:id', competitionController.updateCompetition);
router.delete('/:id', competitionController.deleteCompetition);

module.exports = router;
