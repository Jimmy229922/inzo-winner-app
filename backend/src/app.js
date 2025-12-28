
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');

const authRoutes = require('./routes/auth.routes');
const agentRoutes = require('./routes/agent.routes');
const logRoutes = require('./routes/log.routes');
const taskRoutes = require('./routes/tasks.routes'); // تصحيح: اسم الملف هو tasks.routes.js
const userRoutes = require('./routes/user.routes'); // إضافة: استيراد مسارات المستخدمين
const calendarRoutes = require('./routes/calendar.routes'); // إضافة: استيراد مسارات التقويم
const competitionRoutes = require('./routes/competition.routes'); // إضافة: استيراد مسارات المسابقات
const templateRoutes = require('./routes/template.routes'); // إضافة: استيراد مسارات القوالب
const telegramRoutes = require('./routes/telegram.routes'); // إضافة: استيراد مسارات تلجرام
const statsRoutes = require('./routes/stats.routes'); // إضافة: استيراد مسارات الإحصائيات
const integrationsRoutes = require('./routes/integrations.routes');
const errorRoutes = require('./routes/error.routes'); // إضافة: استيراد مسارات الأخطاء
const authMiddleware = require('./api/middleware/auth.middleware');
const activityLogger = require('./middleware/activityLog.middleware');
const runMigrations = require('./migration-runner'); // FIX: Correct path for migration runner
const winnerRoutes = require('./routes/winner.routes');
const questionSuggestionRoutes = require('./routes/questionSuggestion.routes'); // نظام اقتراح الأسئلة

const { broadcastNotification } = require('./utils/notification');

const app = express();

// --- TEST ROUTE: Trigger Notification Manually ---
app.get('/api/test-notification', (req, res) => {
    try {
        broadcastNotification(app, 'هذا إشعار تجريبي من السيرفر', 'info');
        res.json({ message: 'Notification sent', onlineClients: app.locals.onlineClients ? app.locals.onlineClients.size : 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- NEW: Shared cache for deduplication between controllers ---
app.locals.recentMessages = new Map();

// --- Global log silencer: hide noisy console output in production by default ---
// Set DEBUG_LOGS=true in the environment to re-enable info/debug logs.
(() => {
  const DEBUG_LOGS = String(process.env.DEBUG_LOGS || '').toLowerCase() === 'true';
  if (!DEBUG_LOGS) {
    const noop = () => {};
    // Keep errors and warnings visible; silence info/debug/log
    if (console.info) console.info = noop;
    if (console.debug) console.debug = noop;
    if (console.log) console.log = noop;
  }
})();


// Middlewares
app.use(cors());

// --- SIMPLIFIED: Use express built-in body parsers with verify callback for rawBody ---
// 1. Add text/plain parser that treats plain text as JSON
app.use(express.text({ type: 'text/plain', limit: '50mb' }));

// 2. JSON parser with rawBody capture and UTF-8 enforcement
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf, encoding) => {
    try {
      // Force UTF-8 encoding for proper Arabic character handling
      const actualEncoding = encoding || 'utf8';
      if (buf && buf.length) {
        req.rawBody = buf.toString(actualEncoding);
      }
    } catch (e) {
      req.rawBody = '';
    }
  }
}));

// 3. URL-encoded parser
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- NEW: Middleware to normalize Arabic text in request body ---
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const normalizeArabicFields = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          // Normalize Unicode to NFC form (canonical composition) for consistent Arabic text
          obj[key] = obj[key].normalize('NFC');
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          normalizeArabicFields(obj[key]);
        }
      }
    };
    normalizeArabicFields(req.body);
  }
  next();
});

// --- FIX: Handle text/plain Content-Type by parsing it as JSON ---
app.use((req, res, next) => {
  // If body is a string (from text/plain parser), try to parse it as JSON
  if (typeof req.body === 'string' && req.body.length > 0) {
    // Skip parsing if it looks like [object Object] which is an invalid serialization
    if (req.body.startsWith('[object') || req.body.startsWith('{[object')) {
      // console.warn('⚠ [MIDDLEWARE] Skipping invalid serialized object:', req.body.substring(0, 50));
      req.body = {};
    } else {
      try {
        // console.log('🔄 [MIDDLEWARE] Converting text/plain to JSON...');
        req.body = JSON.parse(req.body);
        // console.log('✓ [MIDDLEWARE] Successfully parsed text/plain as JSON');
      } catch (e) {
        // console.error('❌ [MIDDLEWARE] Failed to parse text/plain as JSON:', e.message);
        req.body = {};
      }
    }
  }
  // If body-parser couldn't parse the body but rawBody has data, try to parse rawBody
  else if ((Object.keys(req.body).length === 0) && req.rawBody && typeof req.rawBody === 'string' && req.rawBody.length > 0) {
    // Skip parsing if it looks like [object Object]
    if (req.rawBody.startsWith('[object') || req.rawBody.startsWith('{[object')) {
      // console.warn('⚠ [MIDDLEWARE] Skipping invalid serialized rawBody');
    } else {
      try {
        // console.log('🔄 [MIDDLEWARE] Parsing rawBody as JSON...');
        const parsedBody = JSON.parse(req.rawBody);
        req.body = parsedBody;
        // console.log('✓ [MIDDLEWARE] Successfully parsed rawBody as JSON');
      } catch (e) {
        // console.warn('⚠ [MIDDLEWARE] Could not parse rawBody as JSON:', e.message);
      }
    }
  }
  next();
});

app.use(
    helmet.contentSecurityPolicy({
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://cdn.sheetjs.com",
          // السماح بتنفيذ السكريبت المضمن في index.html لتحميل الملفات
          "'sha256-C+UNglKutB8VZOyHLy9MTyAC11AaepJoYdvIp21CZXY='",
          // السماح بتنفيذ سكريبت مضمن آخر يتم إنشاؤه ديناميكياً (ربما في نافذة منبثقة)
          "'sha256-8wRuEDii/8OrjKP+SkrGmAiY6dnp1/j/6JdNr8TjXtY='",
          // السماح بتنفيذ سكريبت مضمن لتسجيل ChartDataLabels
          "'sha256-2ar/7UBbVZ+sIvKv5KcwpCftABgp+gg1GvE5xLPk8eI='",
          // السماح بتنفيذ سكريبت مضمن جديد تم اكتشافه
          "'sha256-SwrHo0hQphrDZYNs4Z6fi3PQudeXxZOydZrc+QiPdIU='",
        ],
        "img-src": ["'self'", "data:", "blob:", "https://ui-avatars.com", "https://via.placeholder.com"],
        "media-src": ["'self'", "blob:", "data:"],
        // السماح بتحميل ملفات .map من cdn.jsdelivr.net
        "connect-src": ["'self'", "https://cdn.jsdelivr.net"],
        // السماح بتضمين Wheel of Names داخل iframe إذا لزم الأمر
        "frame-src": ["'self'", "https://wheelofnames.com"],
        // بعض المتصفحات تعتمد child-src للـ iframes القديمة
        "child-src": ["'self'", "https://wheelofnames.com"],
      },
    })
);

// --- إضافة: جعل مجلد 'uploads' متاحاً للوصول العام ---
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
// Winners routes (public GET to allow agent-winners page to fetch without token in local testing)
app.use('/api', winnerRoutes);

app.use('/api/agents', authMiddleware.authenticate, activityLogger, agentRoutes);
app.use('/api/logs', authMiddleware.authenticate, logRoutes);
app.use('/api/tasks', authMiddleware.authenticate, activityLogger, taskRoutes); // إضافة: استخدام مسارات المهام
app.use('/api/users', authMiddleware.authenticate, activityLogger, userRoutes); // إضافة: استخدام مسارات المستخدمين
app.use('/api/calendar', authMiddleware.authenticate, activityLogger, calendarRoutes); // إضافة: استخدام مسارات التقويم
app.use('/api/competitions', authMiddleware.authenticate, activityLogger, competitionRoutes); // إضافة: استخدام مسارات المسابقات
app.use('/api/templates', authMiddleware.authenticate, activityLogger, templateRoutes); // إضافة: استخدام مسارات القوالب
// --- إضافة: استخدام مسارات تلجرام ---
// Note: These are not protected by authMiddleware to allow more flexibility if needed later.
app.use('/api', telegramRoutes);
// --- FIX: Mount stats routes properly ---
app.use('/api/stats', authMiddleware.authenticate, activityLogger, statsRoutes);
// Integrations (Wheel of Names, etc.)
app.use('/api/integrations', authMiddleware.authenticate, activityLogger, integrationsRoutes);
// نظام اقتراح الأسئلة
app.use('/api/question-suggestions', questionSuggestionRoutes);
// Expose a top-level analytics endpoint that the frontend expects (/api/analytics)
const statsController = require('./controllers/stats.controller');
app.get('/api/analytics', authMiddleware.authenticate, activityLogger, statsController.getAnalytics);
app.use('/api/log-error', errorRoutes); // إضافة: استخدام مسارات الأخطاء
// Winners routes were registered earlier to avoid duplicate declaration.

// --- NEW: Run database migrations after routes are set up ---
// runMigrations(); // Temporarily disabled

// Catch-all for API routes that don't exist
app.use('/api/*', (req, res) => {
    res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});

// --- FIX: Serve static files AFTER API routes but BEFORE the final catch-all ---
// Add charset=utf-8 to all responses and prevent caching for HTML/JS files
app.use((req, res, next) => {
    if (req.path.endsWith('.html') || req.path.endsWith('.js') || req.path.endsWith('.css')) {
        const contentType = req.path.endsWith('.html') ? 'text/html' : 
                           req.path.endsWith('.js') ? 'application/javascript' : 'text/css';
        res.setHeader('Content-Type', `${contentType}; charset=utf-8`);
        
        // Disable caching for HTML and JS files to ensure fresh content
        if (req.path.endsWith('.html') || req.path.endsWith('.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
    next();
});

app.use(express.static(path.join(__dirname, '../../frontend')));

// --- Compatibility redirects for pages placed under /pages/ to preserve old URLs ---
app.get('/agent-competitions.html', (req, res) => {
  return res.sendFile(path.join(__dirname, '../../frontend', 'pages', 'agent-competitions.html'));
});
app.get('/agent-winners.html', (req, res) => {
  return res.sendFile(path.join(__dirname, '../../frontend', 'pages', 'agent-winners.html'));
});

// For any other request that doesn't match a static file or an API route, serve the main index.html
// This is crucial for client-side routing (e.g., React, Vue, or the current hash-based routing) to work correctly on page refresh.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend', 'index.html'));
});

// --- IMPROVEMENT: Centralized Error Handling Middleware ---
// This should be the last middleware added. It catches any errors that occur in the route handlers.
app.use((err, req, res, next) => {
    console.error('\n' + '='.repeat(70));
    console.error('❌ [GLOBAL ERROR HANDLER] Error Caught');
    console.error('='.repeat(70));
    console.error('Error Type:', err.constructor.name);
    console.error('Error Message:', err.message);
    console.error('Error Stack:', err.stack);
    console.error('Request URL:', req.method, req.originalUrl);
    console.error('Request Headers:', {
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length']
    });
    console.error('='.repeat(70) + '\n');
    
    // Avoid sending stack trace in production for security reasons
    const errorResponse = {
        message: err.message || 'An unexpected error occurred on the server.',
        errorType: err.constructor.name,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    };
    res.status(err.status || 500).json(errorResponse);
});

module.exports = app;
