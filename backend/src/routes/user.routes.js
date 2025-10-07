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

// --- NEW: Middleware to ensure an admin can only edit users, not other admins or super admins ---
const canUpdateUser = async (req, res, next) => {
    // Super admin can do anything.
    if (req.user.role === 'super_admin') {
        return next();
    }

    // Admin can edit their own profile.
    if (req.user.role === 'admin' && req.user.id === req.params.id) {
        return next();
    }

    // Admin can edit users with the 'user' role.
    if (req.user.role === 'admin') {
        const targetUser = await userController.findUserById(req.params.id); // Assuming a helper function exists in controller
        if (targetUser && targetUser.role === 'user') {
            return next();
        }
    }

    return res.status(403).json({ message: 'Forbidden: You do not have permission to modify this user.' });
};

// Basic CRUD routes
router.route('/')
    .get(authenticate, isAdminOrSuperAdmin, userController.getAllUsers) // FIX: Allow Admins and Super Admins to get all users
    .post(authenticate, isAdminOrSuperAdmin, userController.createUser); // FIX: Allow Admins and Super Admins to create users

router.route('/:id')
    .get(authenticate, userController.getUserById)
    .put(authenticate, canUpdateUser, userController.updateUser)
    .delete(authenticate, isSuperAdmin, userController.deleteUser); // FIX: Removed incorrect canUpdateUser middleware from delete route

// Special routes
router.post('/:id/avatar', authenticate, upload.single('avatar'), userController.uploadAvatar);
router.put('/:id/role', authenticate, isSuperAdmin, userController.updateUserRole);

module.exports = router;