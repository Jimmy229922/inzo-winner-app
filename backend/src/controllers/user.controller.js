const User = require('../models/User');
const bcrypt = require('bcryptjs');

const userController = {
    getAllUsers: async (req, res) => {
        try {
            const users = await User.find({}).select('-password').sort({ createdAt: -1 });
            res.json({ users });
        } catch (error) {
            res.status(500).json({ message: 'Server error while fetching users.', error: error.message });
        }
    },

    getUserById: async (req, res) => {
        try {
            const user = await User.findById(req.params.id).select('-password');
            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }
            res.json({ user });
        } catch (error) {
            res.status(500).json({ message: 'Server error while fetching user.', error: error.message });
        }
    },

    createUser: async (req, res) => {
        const { full_name, email, password, role, permissions } = req.body;

        if (!full_name || !email || !password || !role) {
            return res.status(400).json({ message: 'Please provide all required fields.' });
        }

        // --- SECURITY: Only super_admin can create users with the 'admin' role or assign permissions ---
        if ((role === 'admin' || (permissions && Object.keys(permissions).length > 0)) && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to create users with special roles or permissions.' });
        }

        try {
            let user = await User.findOne({ email });
            if (user) {
                return res.status(400).json({ message: 'User with this email already exists.' });
            }

            const hashedPassword = await bcrypt.hash(password, 12);

            user = new User({
                full_name,
                email,
                password: hashedPassword,
                role,
                permissions: permissions || {} // Ensure permissions is an object
            });

            await user.save();
            user.password = undefined;
            
            // Log activity
            const userId = req.user?._id;
            if (userId) {
                const { logActivity } = require('../utils/logActivity');
                await logActivity(userId, null, 'USER_CREATED', 
                    `تم إنشاء مستخدم جديد: ${user.full_name} (${user.role})`
                ).catch(err => console.warn('[User Create] Failed to log activity:', err));
            }
            
            res.status(201).json({ user });
        } catch (error) {
            res.status(500).json({ message: 'Server error while creating user.', error: error.message });
        }
    },

    updateUser: async (req, res) => {
        const { full_name, password, permissions, status } = req.body;
        const updateData = {};

        if (full_name) updateData.full_name = full_name;
        if (status) updateData.status = status;
        
        // --- SECURITY: Only the user themselves or an admin can change their own full_name ---
        if (full_name && req.user.role !== 'super_admin' && req.user.role !== 'admin' && req.user.id !== req.params.id) {
             return res.status(403).json({ message: 'Forbidden: You can only change your own name.' });
        }
 
        try {
            const userToUpdate = await User.findById(req.params.id); // We need the full Mongoose document now
            if (!userToUpdate) {
                return res.status(404).json({ message: 'User not found.' });
            }

            if (permissions) {
                for (const category in permissions) { // e.g., 'agents', 'competitions'
                    for (const perm in permissions[category]) { // e.g., 'manage_financials', 'manage_comps'
                        updateData[`permissions.${category}.${perm}`] = permissions[category][perm];
                    }
                }
            }

            // --- SECURITY FIX: Prevent any modification to a super_admin account via API ---
            if (userToUpdate.role === 'super_admin' && req.user.id !== req.params.id) {
                return res.status(403).json({ message: 'Forbidden: Super Admin accounts cannot be modified by others.' });
            }
            
            // --- SECURITY FIX: Only super_admin can change permissions, unless an admin is changing a 'user' ---
            if (permissions && req.user.role !== 'super_admin' && !(req.user.role === 'admin' && userToUpdate.role === 'user')) {
                return res.status(403).json({ message: 'Forbidden: You do not have permission to change these user permissions.' });
            }

            if (password) {
                updateData.password = await bcrypt.hash(password, 12);
            }

            const user = await User.findByIdAndUpdate(
                req.params.id,
                { $set: updateData },
                { new: true }
            ).select('-password');

            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }

            // Log activity
            const actorId = req.user?._id;
            if (actorId) {
                const { logActivity } = require('../utils/logActivity');
                const changes = [];
                if (full_name) changes.push(`الاسم`);
                if (password) changes.push(`كلمة المرور`);
                if (status) changes.push(`الحالة`);
                if (permissions) changes.push(`الصلاحيات`);
                
                await logActivity(actorId, null, 'USER_UPDATED', 
                    `تم تحديث بيانات المستخدم: ${user.full_name}${changes.length ? ' (' + changes.join('، ') + ')' : ''}`
                ).catch(err => console.warn('[User Update] Failed to log activity:', err));
            }

            res.json({ user });
        } catch (error) {
            res.status(500).json({ message: 'Server error while updating user.', error: error.message });
        }
    },

    uploadAvatar: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded.' });
            }

            const avatar_url = `/uploads/avatars/${req.file.filename}`;
            const user = await User.findByIdAndUpdate(req.params.id, { avatar_url }, { new: true });

            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }
            res.json({ message: 'Avatar updated successfully', avatar_url });
        } catch (error) {
            res.status(500).json({ message: 'Server error while uploading avatar.', error: error.message });
        }
    },

    updateUserRole: async (req, res) => {
        try {
            const { role } = req.body;

            const userToUpdate = await User.findById(req.params.id);
            if (userToUpdate && userToUpdate.role === 'super_admin') {
                return res.status(403).json({ message: 'Cannot change the role of a Super Admin account.' });
            }

            const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
            if (!user) return res.status(404).json({ message: 'User not found' });
            res.json({ message: 'User role updated successfully.' });
        } catch (error) {
            res.status(500).json({ message: 'Failed to update user role.', error: error.message });
        }
    },

    deleteUser: async (req, res) => {
        try {
            const user = await User.findById(req.params.id);
            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }
            if (user.role === 'super_admin') {
                return res.status(400).json({ message: 'Cannot delete a Super Admin account.' });
            }
            
            const userName = user.full_name;
            await user.deleteOne();
            
            // Log activity
            const actorId = req.user?._id;
            if (actorId) {
                const { logActivity } = require('../utils/logActivity');
                await logActivity(actorId, null, 'USER_DELETED', 
                    `تم حذف المستخدم: ${userName}`
                ).catch(err => console.warn('[User Delete] Failed to log activity:', err));
            }
            
            res.json({ message: 'User deleted successfully.' });
        } catch (error) {
            res.status(500).json({ message: 'Server error while deleting user.', error: error.message });
        }
    },

    purgeAllUsers: async (req, res) => {
        try {
            // Only super_admin can purge all users
            if (req.user.role !== 'super_admin') {
                return res.status(403).json({ message: 'غير مصرح لك بحذف جميع المستخدمين' });
            }

            const currentUserId = req.user._id || req.user.userId;

            // Delete all users except the current super_admin
            const result = await User.deleteMany({
                _id: { $ne: currentUserId }
            });

            console.log(`[Purge Users] Super admin ${req.user.email} deleted ${result.deletedCount} users`);

            res.json({
                success: true,
                message: `تم حذف ${result.deletedCount} حساب بنجاح`,
                deletedCount: result.deletedCount
            });
        } catch (error) {
            console.error('Error purging users:', error);
            res.status(500).json({ 
                message: 'حدث خطأ أثناء حذف المستخدمين',
                error: error.message 
            });
        }
    }
};

/**
 * Helper function to find a user by ID.
 * This is used by middleware in other files (like user.routes.js).
 * @param {string} userId The ID of the user to find.
 * @returns {Promise<User|null>}
 */
userController.findUserById = async (userId) => {
    try {
        // Use .lean() for a faster, plain JavaScript object result as we don't need Mongoose methods here.
        const user = await User.findById(userId).lean();
        return user;
    } catch (error) {
        return null; // Return null on any error (e.g., invalid ID format)
    }
};

module.exports = userController;