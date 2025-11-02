
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    console.log('--- Login Request Received ---');
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' });
    }

    try {
        console.log(`[AUTH] Login attempt for email: ${email}`);
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

        const payload = { userId: user._id, role: user.role };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

        user.password = undefined;
        console.log(`[AUTH-SUCCESS] User ${email} (ID: ${user._id}) logged in successfully.`);
        res.json({ token, user });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'خطأ في الخادم أثناء تسجيل الدخول.' });
    }
};

exports.getMe = async (req, res) => {
    try {
        // console.log(`[AUTH] Fetching profile for user ID: ${req.user.userId}`);
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(user);
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
exports.logout = (req, res) => {
    // On the backend, for a stateless JWT system, logout is mainly a client-side operation (deleting the token).
    // This endpoint is useful for future enhancements like token blocklisting.
    res.status(200).json({ message: "تم تسجيل الخروج بنجاح." });
};
                