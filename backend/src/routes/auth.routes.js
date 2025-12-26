const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
//const authMiddleware = require('../middleware/auth.middleware');
const { authenticate } = require("../api/middleware/auth.middleware");

router.post("/login", authController.login);
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.getMe);
router.post("/verify-password", authenticate, authController.verifyPassword);
router.post("/change-password", authenticate, authController.changePassword);

module.exports = router;