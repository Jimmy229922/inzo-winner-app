process.env.TZ = 'Asia/Baghdad';
// Fix Telegram Bot API deprecation warning regarding file uploads
process.env.NTBA_FIX_350 = 1; 

require('dotenv').config();
// Silence noisy logs when requested
const SILENCE_LOGS = process.env.SILENCE_LOGS === '1' || process.env.LOG_SILENT === '1';
if (SILENCE_LOGS) {
    // Keep errors, optionally warnings; silence info/debug logs
    console.log = () => {};
    console.info = () => {};
}
const http = require('http');
const { Server: WebSocketServer } = require('ws');
const TelegramBot = require('node-telegram-bot-api'); // --- NEW: Import TelegramBot
const jwt = require('jsonwebtoken');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { startAllSchedulers, setTelegramBot } = require('./src/scheduler'); // Import scheduler APIs
const User = require('./src/models/User');
const bcrypt = require('bcryptjs');

// --- NEW: Import shared onlineClients map ---
const onlineClients = require('./src/utils/clients');

const port = process.env.PORT || 30001;

async function createSuperAdmin() {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!email || !password) {
        console.error('[CRITICAL] SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in .env file.');
        process.exit(1);
    }

    try {
        const existingAdmin = await User.findOne({ email });
        if (existingAdmin) {
            console.log('[INFO] Super Admin user already exists.');
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const superAdmin = new User({
            full_name: 'INZO Super Admin',
            email,
            password: hashedPassword,
            role: 'super_admin',
            permissions: {
                agents: { view_financials: true, edit_profile: true, edit_financials: true, can_view_competitions_tab: true, can_renew_all_balances: true },
                competitions: { manage_comps: 'full', manage_templates: 'full', can_create: true }
            }
        });
        await superAdmin.save();
        console.log(`[SUCCESS] Initial Super Admin created successfully with email: ${email}`);
    } catch (error) {
        console.error('[CRITICAL] Failed to create initial Super Admin:', error.message);
        process.exit(1);
    }
}

/**
 * NEW: Broadcasts the list of online user IDs to all connected clients.
 */
function broadcastPresence() {
    const onlineUserIds = Array.from(onlineClients.keys());
    const message = JSON.stringify({ type: 'presence_update', data: onlineUserIds });

    onlineClients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            client.send(message);
        }
    });
}

async function startServer() {
    await connectDB();
    await createSuperAdmin();

    // --- REFACTOR: Create an HTTP server from the Express app ---
    const server = http.createServer(app);

    // --- NEW: Initialize WebSocket Server ---
    const wss = new WebSocketServer({ server });
    
    // Expose WSS to app locals for broadcasting to all clients
    app.locals.wss = wss;

    wss.on('connection', (ws) => {
        // console.log('[WebSocket] A new client connected.');

        // Part of the heartbeat mechanism
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true; // Connection is alive.
        });

        ws.on('message', (message) => {
            try {
                const messageStr = message.toString();
                // console.log(`[WebSocket] Received message: ${messageStr}`);
                const data = JSON.parse(messageStr);
                if (data.type === 'auth' && data.token) {
                    const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
                    const userId = decoded.userId;

                    // Associate this WebSocket connection with the user ID
                    ws.userId = userId;
                    onlineClients.set(userId, ws);

                    // console.log(`[WebSocket] User ${userId} authenticated and connected.`);
                    broadcastPresence(); // Notify all clients about the new online user
                }
            } catch (e) {
                console.error('[WebSocket] Error processing message:', e.message);
                // Send error message to client before closing
                try {
                    ws.send(JSON.stringify({ 
                        type: 'auth_error', 
                        error: e.message 
                    }));
                } catch (sendErr) {
                    console.error('[WebSocket] Failed to send error message:', sendErr.message);
                }
                ws.close(); // Close connection on auth error
            }
        });

        ws.on('close', () => {
            if (ws.userId) {
                onlineClients.delete(ws.userId);
                // console.log(`[WebSocket] User ${ws.userId} disconnected.`);
                broadcastPresence(); // Notify all clients that a user went offline
            } else {
                // console.log('[WebSocket] An unauthenticated client disconnected.');
            }
        });

        ws.on('error', (error) => {
            console.error('[WebSocket] An error occurred:', error);
        });
    });

    // --- NEW: Add WebSocket heartbeat to prevent idle timeouts ---
    const interval = setInterval(function ping() {
        wss.clients.forEach(function each(ws) {
            // The 'isAlive' property is managed by the pong listener below.
            if (ws.isAlive === false) return ws.terminate();

            ws.isAlive = false; // Assume connection is lost until a pong is received.
            ws.ping();
        });
    }, 30000); // Ping every 30 seconds

    server.listen(port, () => {
        console.log(`[SERVER] Backend server is running at http://localhost:${port}`);
        
        // --- Start schedulers immediately with null bot (will update later) ---
        startAllSchedulers(onlineClients, null);
        
        // --- NEW: Initialize Telegram Bot AFTER server starts (non-blocking) ---
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token || token.startsWith('DISABLE')) {
            console.warn('[INFO] Telegram bot disabled (missing token or DISABLE prefix).');
        } else {
            // Run in background without blocking server startup
            (async () => {
                try {
                    // console.log('[INFO] Initializing Telegram bot in background...');
                    const bot = new TelegramBot(token, { 
                        polling: false,
                        request: {
                            agentOptions: {
                                keepAlive: true,
                                keepAliveMsecs: 10000
                            },
                            timeout: 15000 // 15 seconds timeout
                        }
                    });
                    
                    // Single attempt with timeout
                    const me = await bot.getMe();
                    // console.log(`[INFO] ✓ Telegram bot "${me.first_name}" initialized successfully.`);
                    app.locals.telegramBot = bot;
                    // Ensure scheduler uses the initialized bot
                    try { setTelegramBot(bot); } catch {}
                } catch (error) {
                    console.error(`[WARN] Telegram bot initialization failed: ${error.message.substring(0, 50)}`);
                    console.error('[INFO] Server continues without Telegram bot. Manual sending required.');
                }
            })();
        }
    });
}

startServer();
