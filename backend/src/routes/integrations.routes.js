const express = require('express');
const router = express.Router();
const wheelController = require('../controllers/wheelofnames.controller');

// Create a new Wheel of Names wheel from provided entries
router.post('/wheelofnames/wheels', wheelController.createWheel);

module.exports = router;
