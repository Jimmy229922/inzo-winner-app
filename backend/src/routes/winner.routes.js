const express = require('express');
const router = express.Router();
const winnerController = require('../controllers/winner.controller');
const { authenticate } = require('../api/middleware/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Multer configuration for winner video uploads ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', '..', 'uploads', 'winners');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `winner-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

// Protected GET for agent winners - requires authentication
router.get('/agents/:agentId/winners', authenticate, winnerController.getWinnersByAgent);

// Import winners for an agent (expects body { winners: [...] })
router.post('/agents/:agentId/winners/import', authenticate, winnerController.importWinnersForAgent);

// Upload video for a specific winner
router.post('/winners/:id/video', authenticate, upload.single('video'), winnerController.uploadWinnerVideo);

// Upload national ID image for a specific winner
router.post('/winners/:id/id-image', authenticate, upload.single('id_image'), winnerController.uploadWinnerIdImage);

// Update winner details
router.put('/winners/:id', authenticate, winnerController.updateWinner);

// Delete a winner (admin/super_admin)
router.delete('/agents/:agentId/winners/:winnerId', authenticate, winnerController.deleteWinner);

module.exports = router;
