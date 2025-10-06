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
            res.status(201).json({ user });
        } catch (error) {
            res.status(500).json({ message: 'Server error while creating user.', error: error.message });
        }
    },

    updateUser: async (req, res) => {
        const { full_name, password, permissions, status } = req.body;
        const updateData = {};

        if (full_name) updateData.full_name = full_name;
        if (permissions) updateData.permissions = permissions;
        if (status) updateData.status = status;

        // --- SECURITY FIX: Only super_admin can change permissions ---
        if (permissions && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to change user permissions.' });
        }

        try {
            const userToUpdate = await User.findById(req.params.id);
            if (userToUpdate && userToUpdate.role === 'super_admin') {
                return res.status(403).json({ message: 'Cannot modify a Super Admin account.' });
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
            await user.deleteOne();
            res.json({ message: 'User deleted successfully.' });
        } catch (error) {
            res.status(500).json({ message: 'Server error while deleting user.', error: error.message });
        }
    }
};

module.exports = userController;