
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logActivity } = require('../utils/logActivity');

exports.login = async (req, res) => {
    console.log('--- Login Request Received ---');
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' });
    }

    try {
        // console.log(`[AUTH] Login attempt for email: ${email}`);
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            console.warn(`[AUTH-FAIL] Login failed for ${email}: User not found.`);
            return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
        }

        if (user.status === 'inactive') {
            console.warn(`[AUTH-FAIL] Login failed for ${email}: Account is inactive.`);
            return res.status(403).json({ message: 'تم تعطيل حسابك. يرجى التواصل مع المدير.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.warn(`[AUTH-FAIL] Login failed for ${email}: Invalid password.`);
            return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
        }

        const payload = { 
            userId: user._id,
            _id: user._id, // Add _id to match what auth middleware expects
            role: user.role,
            name: user.name  // Include name for better logging
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });

        user.password = undefined;
        console.log(`[AUTH-SUCCESS] User ${email} (ID: ${user._id}, Role: ${user.role}) logged in successfully.`);
        
        // Log login activity
        logActivity(
            user._id,
            null,
            'USER_LOGIN',
            `${user.full_name} قام بتسجيل الدخول`,
            { email: user.email, ip: req.ip || req.headers['x-forwarded-for'] }
        ).catch(err => console.warn('[AUTH] Failed to log login activity:', err));
        
        res.json({ token, user });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'خطأ في الخادم أثناء تسجيل الدخول.' });
    }
};

exports.getMe = async (req, res) => {
    try {
        // console.log(`[AUTH] Fetching profile for user ID: ${req.user._id || req.user.userId}`);
        const user = await User.findById(req.user._id || req.user.userId).select('-password');
        if (!user) {
            console.error('[AUTH] User not found in database:', req.user);
            return res.status(404).json({ message: 'المستخدم غير موجود.' });
        }

        // Ensure consistent user object structure
        const userResponse = {
            ...user.toObject(),
            _id: user._id,
            userId: user._id,
            role: user.role
        };
        res.json(userResponse);
    } catch (error) {
        console.error('GetMe Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Logs user out
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res) => {
    // On the backend, for a stateless JWT system, logout is mainly a client-side operation (deleting the token).
    // This endpoint is useful for future enhancements like token blocklisting.
    
    // Log logout activity if user is authenticated
    if (req.user && req.user._id) {
        try {
            // Ensure we have the user's full name
            let userName = req.user.full_name || req.user.name;
            
            // If name not in token, fetch from database
            if (!userName) {
                const user = await User.findById(req.user._id).select('full_name name').lean();
                userName = user?.full_name || user?.name || 'مستخدم';
            }
            
            logActivity(
                req.user._id,
                null,
                'USER_LOGOUT',
                `${userName} قام بتسجيل الخروج`,
                { ip: req.ip || req.headers['x-forwarded-for'] }
            ).catch(err => console.warn('[AUTH] Failed to log logout activity:', err));
        } catch (err) {
            console.warn('[AUTH] Failed to log logout activity:', err);
        }
    }
    
    res.status(200).json({ message: "تم تسجيل الخروج بنجاح." });
};

// Verify current password for the authenticated user
exports.verifyPassword = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.userId;
        const { password } = req.body || {};

        if (!userId) {
            return res.status(401).json({ message: 'غير مصرح. يرجى تسجيل الدخول مرة أخرى.' });
        }
        if (!password) {
            return res.status(400).json({ message: 'يرجى إدخال كلمة المرور الحالية.' });
        }

        const user = await User.findById(userId).select('+password');
        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'كلمة المرور الحالية غير صحيحة.' });
        }

        return res.json({ message: 'كلمة المرور صحيحة.' });
    } catch (error) {
        console.error('VerifyPassword Error:', error);
        return res.status(500).json({ message: 'خطأ في الخادم أثناء التحقق من كلمة المرور.' });
    }
};

// Change password for the authenticated user
exports.changePassword = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.userId;
        const { currentPassword, newPassword } = req.body || {};

        if (!userId) {
            return res.status(401).json({ message: 'غير مصرح. يرجى تسجيل الدخول مرة أخرى.' });
        }
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'يرجى إدخال كلمة المرور الحالية والجديدة.' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.' });
        }

        const user = await User.findById(userId).select('+password');
        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'كلمة المرور الحالية غير صحيحة.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        user.password = hashedPassword;
        await user.save();

        // Log activity
        logActivity(
            user._id,
            null,
            'USER_PASSWORD_CHANGED',
            `${user.full_name || user.email} غيّر كلمة المرور الخاصة به`
        ).catch(err => console.warn('[AUTH] Failed to log password change activity:', err));

        return res.json({ message: 'تم تغيير كلمة المرور بنجاح.' });
    } catch (error) {
        console.error('ChangePassword Error:', error);
        return res.status(500).json({ message: 'خطأ في الخادم أثناء تغيير كلمة المرور.' });
    }
};
                
