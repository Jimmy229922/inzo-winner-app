const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const multer = require('multer');
const path = require('path');

// --- NEW: Multer configuration for file uploads ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', '..', 'uploads', 'avatars'));
    },
    filename: function (req, file, cb) {
        // Create a unique filename to avoid conflicts
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Middleware to check if the current user is a super_admin
const isSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: 'Forbidden: Access is restricted to Super Admins.' });
    }
    next();
};

router.get('/', userController.getAllUsers);
router.post('/', isSuperAdmin, userController.createUser);
router.post('/:id/avatar', isSuperAdmin, upload.single('avatar'), userController.uploadAvatar); // NEW: Avatar upload route
router.put('/:id', isSuperAdmin, userController.updateUser);
router.put('/:id/role', isSuperAdmin, userController.updateUserRole);
router.delete('/:id', isSuperAdmin, userController.deleteUser);

module.exports = router;