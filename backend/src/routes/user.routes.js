const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../api/middleware/auth.middleware');
const multer = require('multer');
const path = require('path');

// --- Multer configuration for file uploads ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', '..', 'uploads', 'avatars'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Middleware to check if the current user is a super_admin
const isSuperAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'super_admin') {
        return res.status(403).json({ message: 'Forbidden: Access is restricted to Super Admins.' });
    }
    next();
};

// --- NEW: Middleware to check if the user is an Admin or Super Admin ---
const isAdminOrSuperAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== 'super_admin' && req.user.role !== 'admin')) {
        return res.status(403).json({ message: 'Forbidden: Access is restricted to Admins.' });
    }
    next();
};

// Basic CRUD routes
router.route('/')
    .get(authenticate, isSuperAdmin, userController.getAllUsers) // FIX: Allow only super admins to get all users
    .post(authenticate, isSuperAdmin, userController.createUser); // FIX: Only super admins can create users

router.route('/:id')
    .get(authenticate, userController.getUserById)
    .put(authenticate, userController.updateUser)
    .delete(authenticate, isSuperAdmin, userController.deleteUser);

// Special routes
router.post('/:id/avatar', authenticate, upload.single('avatar'), userController.uploadAvatar);
router.put('/:id/role', authenticate, isSuperAdmin, userController.updateUserRole);

module.exports = router;