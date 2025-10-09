const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
//const authMiddleware = require('../middleware/auth.middleware');
const { authenticate } = require("../middleware/auth.middleware");

router.post("/login", authController.login);
router.get("/me", authenticate, authController.getMe);

module.exports = router;