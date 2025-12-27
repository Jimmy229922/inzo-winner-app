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

    // Admin can edit users with the 'employee' role.
    if (req.user.role === 'admin') {
        const targetUser = await userController.findUserById(req.params.id); // Assuming a helper function exists in controller
        if (targetUser && targetUser.role === 'employee') {
            return next();
        }
    }

    return res.status(403).json({ message: 'Forbidden: You do not have permission to modify this user.' });
};

// --- NEW: Middleware to check if a user can be deleted ---
const canDeleteUser = async (req, res, next) => {
    const currentUser = req.user;
    const targetUserId = req.params.id;

    // Super admin can delete anyone except other super admins (which is handled in the controller).
    if (currentUser.role === 'super_admin') {
        return next();
    }

    // Admin can delete users with the 'employee' role.
    if (currentUser.role === 'admin') {
        try {
            const targetUser = await userController.findUserById(targetUserId);
            if (targetUser && targetUser.role === 'employee') {
                return next();
            }
        } catch (error) {
            return res.status(500).json({ message: 'Error verifying user to delete.' });
        }
    }

    // If none of the above, deny access.
    return res.status(403).json({ message: 'Forbidden: You do not have permission to delete this user.' });
};

// Basic CRUD routes
router.route('/')
    .get(authenticate, isAdminOrSuperAdmin, userController.getAllUsers) // FIX: Allow Admins and Super Admins to get all users
    .post(authenticate, isAdminOrSuperAdmin, userController.createUser); // FIX: Allow Admins and Super Admins to create users

// Purge all users route (super_admin only)
router.delete('/purge-all', authenticate, isSuperAdmin, userController.purgeAllUsers);

router.route('/:id')
    .get(authenticate, userController.getUserById)
    .put(authenticate, canUpdateUser, userController.updateUser)
    .delete(authenticate, canDeleteUser, userController.deleteUser); // MODIFICATION: Use the new canDeleteUser middleware

// Special routes
router.post('/:id/avatar', authenticate, upload.single('avatar'), userController.uploadAvatar);
router.put('/:id/role', authenticate, isSuperAdmin, userController.updateUserRole);

module.exports = router;