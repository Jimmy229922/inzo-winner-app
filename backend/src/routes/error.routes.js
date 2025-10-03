
const express = require('express');
const router = express.Router();
const errorController = require('../controllers/error.controller');

router.post('/', errorController.logFrontendError);

module.exports = router;
                