
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');

const authRoutes = require('./routes/auth.routes');
const agentRoutes = require('./routes/agent.routes');
const logRoutes = require('./routes/log.routes');
const taskRoutes = require('./routes/tasks.routes'); // تصحيح: اسم الملف هو tasks.routes.js
const userRoutes = require('./routes/user.routes'); // إضافة: استيراد مسارات المستخدمين
const statsRoutes = require('./routes/stats.routes'); // إضافة: استيراد مسارات الإحصائيات
const calendarRoutes = require('./routes/calendar.routes'); // إضافة: استيراد مسارات التقويم
const competitionRoutes = require('./routes/competition.routes'); // إضافة: استيراد مسارات المسابقات
const templateRoutes = require('./routes/template.routes'); // إضافة: استيراد مسارات القوالب
const telegramRoutes = require('./routes/telegram.routes'); // إضافة: استيراد مسارات تلجرام
const errorRoutes = require('./routes/error.routes'); // إضافة: استيراد مسارات الأخطاء
const authMiddleware = require('./api/middleware/auth.middleware');
const runMigrations = require('./migration-runner'); // FIX: Correct path for migration runner

const app = express();


// Middlewares
app.use(cors());
app.use(express.json());
app.use(
    helmet.contentSecurityPolicy({
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          // السماح بتنفيذ السكريبت المضمن في index.html لتحميل الملفات
          "'sha256-C+UNglKutB8VZOyHLy9MTyAC11AaepJoYdvIp21CZXY='",
          // السماح بتنفيذ سكريبت مضمن آخر يتم إنشاؤه ديناميكياً (ربما في نافذة منبثقة)
          "'sha256-8wRuEDii/8OrjKP+SkrGmAiY6dnp1/j/6JdNr8TjXtY='",
          // السماح بتنفيذ سكريبت مضمن لتسجيل ChartDataLabels
          "'sha256-2ar/7UBbVZ+sIvKv5KcwpCftABgp+gg1GvE5xLPk8eI='",
        ],
        "img-src": ["'self'", "data:", "blob:", "https://ui-avatars.com", "https://via.placeholder.com"],
        // السماح بتحميل ملفات .map من cdn.jsdelivr.net
        "connect-src": ["'self'", "https://cdn.jsdelivr.net"],
      },
    })
);

// --- إضافة: جعل مجلد 'uploads' متاحاً للوصول العام ---
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', authMiddleware.authenticate, agentRoutes);
app.use('/api/logs', authMiddleware.authenticate, logRoutes);
app.use('/api/tasks', authMiddleware.authenticate, taskRoutes); // إضافة: استخدام مسارات المهام
app.use('/api/users', authMiddleware.authenticate, userRoutes); // إضافة: استخدام مسارات المستخدمين
app.use('/api/stats', authMiddleware.authenticate, statsRoutes); // إضافة: استخدام مسارات الإحصائيات
app.use('/api/calendar', authMiddleware.authenticate, calendarRoutes); // إضافة: استخدام مسارات التقويم
app.use('/api/competitions', authMiddleware.authenticate, competitionRoutes); // إضافة: استخدام مسارات المسابقات
app.use('/api/templates', authMiddleware.authenticate, templateRoutes); // إضافة: استخدام مسارات القوالب
// --- إضافة: استخدام مسارات تلجرام ---
// Note: These are not protected by authMiddleware to allow more flexibility if needed later.
app.use('/api', telegramRoutes);
// Expose a top-level analytics endpoint that the frontend expects (/api/analytics)
const statsController = require('./controllers/stats.controller');
app.get('/api/analytics', authMiddleware.authenticate, statsController.getAnalytics);
app.use('/api/log-error', errorRoutes); // إضافة: استخدام مسارات الأخطاء

// --- NEW: Run database migrations after routes are set up ---
runMigrations();

// Catch-all for API routes that don't exist
app.use('/api/*', (req, res) => {
    res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});

// --- FIX: Serve static files AFTER API routes but BEFORE the final catch-all ---
app.use(express.static(path.join(__dirname, '../../frontend')));

// For any other request that doesn't match a static file or an API route, serve the main index.html
// This is crucial for client-side routing (e.g., React, Vue, or the current hash-based routing) to work correctly on page refresh.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend', 'index.html'));
});

// --- IMPROVEMENT: Centralized Error Handling Middleware ---
// This should be the last middleware added. It catches any errors that occur in the route handlers.
app.use((err, req, res, next) => {
    console.error('[GLOBAL ERROR HANDLER]', err.stack);
    // Avoid sending stack trace in production for security reasons
    const errorResponse = {
        message: err.message || 'An unexpected error occurred on the server.',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    };
    res.status(err.status || 500).json(errorResponse);
});

module.exports = app;
            