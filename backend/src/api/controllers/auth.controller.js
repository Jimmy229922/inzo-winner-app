const User = require('../../models/User.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' });
    }

    try {
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
        }

        if (user.status === 'inactive') {
            return res.status(403).json({ message: 'تم تعطيل حسابك. يرجى التواصل مع المدير.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
        }

        const payload = { userId: user._id, role: user.role };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

        user.password = undefined;
        res.json({ token, user });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء تسجيل الدخول.' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(user);
    } catch (error) {
        console.error('GetMe Error:', error);
        res.status(500).json({ message: 'Server error fetching user profile.' });
    }
};