process.env.TZ = 'Asia/Baghdad';
require('dotenv').config();
const http = require('http');
const { Server: WebSocketServer } = require('ws');
const TelegramBot = require('node-telegram-bot-api'); // --- NEW: Import TelegramBot
const jwt = require('jsonwebtoken');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { startAllSchedulers } = require('./src/scheduler'); // NEW: Import the scheduler
const User = require('./src/models/User');
const bcrypt = require('bcryptjs');

// --- NEW: Map to store online users ---
// Key: userId (string), Value: WebSocket client instance
const onlineClients = new Map();

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
    const message = JSON.stringify({ type: 'presence_update', onlineUserIds });

    onlineClients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            client.send(message);
        }
    });
}

async function startServer() {
    await connectDB();
    await createSuperAdmin();

    // --- REFACTOR: Pass onlineClients map to the scheduler ---
    // This allows the scheduler to broadcast messages to clients.
    app.locals.onlineClients = onlineClients;

    // --- NEW: Initialize Telegram Bot and pass it to the app ---
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.error('[CRITICAL] TELEGRAM_BOT_TOKEN is not set in .env file. Telegram features will fail.');
    }
    const bot = new TelegramBot(token); // No polling, we only use it for sending
    app.locals.telegramBot = bot;

    // --- NEW: Verify the bot token on startup ---
    try {
        const me = await bot.getMe();
        console.log(`[INFO] Telegram bot "${me.first_name}" initialized successfully.`);
    } catch (error) {
        console.error(`[CRITICAL] Telegram bot token seems to be invalid. Error: ${error.message}`);
        console.error('[CRITICAL] Please verify the TELEGRAM_BOT_TOKEN in your .env file.');
        // We don't exit the process, but the Telegram features will not work.
        // This allows the rest of the app to run.
    }

    // --- FIX: Start all scheduled jobs from here ---
    startAllSchedulers(onlineClients);
    // --- REFACTOR: Create an HTTP server from the Express app ---
    const server = http.createServer(app);

    // --- NEW: Initialize WebSocket Server ---
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        // console.log('[WebSocket] A client connected.');

        // Part of the heartbeat mechanism
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true; // Connection is alive.
        });

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
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
        console.log(`Backend server is running at http://localhost:${port}`);
    });
}

startServer();