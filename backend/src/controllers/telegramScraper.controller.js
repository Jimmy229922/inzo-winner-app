/**
 * Telegram Scraper Controller
 * ---------------------------
 * Independent controller for fetching comments/replies from public Telegram
 * channel posts using the MTProto API (GramJS).
 *
 * This module is completely self-contained and does NOT touch any other part
 * of the application.  It stores a single StringSession in a local JSON file
 * so the user only needs to authenticate once.
 */

const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const fs = require('fs');
const path = require('path');

// ── Paths ────────────────────────────────────────────────────────────────
const SESSION_FILE = path.join(__dirname, '..', '..', 'telegram_scraper_session.json');

// ── Helpers ──────────────────────────────────────────────────────────────

/** Read persisted session string (or return empty) */
function loadSession() {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
            return data.session || '';
        }
    } catch { /* ignore */ }
    return '';
}

/** Persist session string to disk */
function saveSession(sessionStr) {
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ session: sessionStr, updatedAt: new Date().toISOString() }), 'utf8');
}

/** Sleep helper */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Normalize Telegram time values (seconds/ms/Date/BigInt-like) to unix seconds.
 * Returns null for empty/invalid values.
 */
function toUnixSeconds(value) {
    if (value === null || value === undefined) return null;

    let num = null;
    if (typeof value === 'number') {
        num = value;
    } else if (typeof value === 'bigint') {
        num = Number(value);
    } else if (value instanceof Date) {
        num = Math.floor(value.getTime() / 1000);
    } else {
        const asNumber = Number(value);
        if (Number.isFinite(asNumber)) {
            num = asNumber;
        }
    }

    if (!Number.isFinite(num) || num <= 0) return null;

    // Some runtimes may expose milliseconds.
    if (num > 1e12) {
        num = Math.floor(num / 1000);
    }

    return Math.floor(num);
}

function toIsoFromTelegramTime(value) {
    const seconds = toUnixSeconds(value);
    return seconds ? new Date(seconds * 1000).toISOString() : null;
}

// ── Rate-limit / cooldown state ─────────────────────────────────────────
const COOLDOWN_MS = 15000;            // 15 seconds between fetches
const MAX_COMMENTS = 2000;            // Hard cap on comments per fetch
const PAGE_DELAY_MS = 1500;           // 1.5 second delay between each page
const MAX_PAGES = 30;                 // Max pagination iterations (30 × 100 = 3000 max)
let lastFetchTime = 0;                // Timestamp of last fetch request
let activeFetch = false;              // Prevent concurrent fetches

/** Build & connect a TelegramClient using env credentials.
 *  The client is configured for one-off API calls only:
 *  - No update loop (no persistent connection)
 *  - No auto-reconnect
 *  - Caller MUST disconnect() after use.
 */
async function getClient() {
    const apiId = parseInt(process.env.TELEGRAM_API_ID, 10);
    const apiHash = process.env.TELEGRAM_API_HASH;
    if (!apiId || !apiHash) {
        throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in .env');
    }

    const sessionStr = loadSession();
    const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
        connectionRetries: 2,
        timeout: 30000,
        autoReconnect: false,   // Don't keep reconnecting
        floodSleepThreshold: 0, // Don't auto-sleep on flood
    });

    // Patch: prevent the internal update loop from running.
    // GramJS calls (0, updates._updateLoop)(this) inside connect(),
    // but only if client._loopStarted is false. By setting it to true
    // BEFORE connect(), we prevent the ping/update loop from ever starting.
    client._loopStarted = true;

    await client.connect();
    return client;
}

/**
 * Parse a Telegram post URL into { channel, messageId }.
 * Supports:
 *   https://t.me/channel_name/123
 *   https://t.me/c/1234567890/123   (private-style but numeric id)
 */
function parsePostUrl(url) {
    // Normalise
    url = url.trim().replace(/\/$/, '');

    // Public channel: https://t.me/channel_name/123
    const publicMatch = url.match(/t\.me\/([a-zA-Z_][a-zA-Z0-9_]{3,})\/(\d+)/);
    if (publicMatch) {
        return { channel: publicMatch[1], messageId: parseInt(publicMatch[2], 10) };
    }

    // Private-style: https://t.me/c/1234567890/123
    const privateMatch = url.match(/t\.me\/c\/(\d+)\/(\d+)/);
    if (privateMatch) {
        return { channel: `-100${privateMatch[1]}`, messageId: parseInt(privateMatch[2], 10) };
    }

    return null;
}

// ── In-memory OTP flow ──────────────────────────────────────────────────
// We need a way for the frontend to send the phone, receive a prompt for OTP,
// then send the OTP.  We keep a transient client reference in memory.
let pendingAuth = null; // { client, phoneCodeHash, phone, resolve, reject }

// ======================================================================
// API Handlers
// ======================================================================

/**
 * GET /api/telegram-scraper/status
 * Returns whether MTProto session is authenticated.
 */
exports.getStatus = async (req, res) => {
    try {
        const sessionStr = loadSession();
        if (!sessionStr) {
            return res.json({ authenticated: false });
        }
        // Try a quick getMe to verify
        const client = await getClient();
        try {
            const me = await client.getMe();
            await client.disconnect();
            return res.json({
                authenticated: true,
                user: {
                    id: me.id?.value?.toString() || me.id?.toString(),
                    firstName: me.firstName,
                    lastName: me.lastName,
                    phone: me.phone,
                    username: me.username,
                }
            });
        } catch (e) {
            await client.disconnect();
            return res.json({ authenticated: false, reason: e.message });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/telegram-scraper/auth/send-code
 * Body: { phone: "+201234567890" }
 * Sends the OTP to the phone and returns a prompt.
 */
exports.sendCode = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'رقم الهاتف مطلوب' });

        const apiId = parseInt(process.env.TELEGRAM_API_ID, 10);
        const apiHash = process.env.TELEGRAM_API_HASH;
        if (!apiId || !apiHash) {
            return res.status(500).json({ error: 'TELEGRAM_API_ID / TELEGRAM_API_HASH not configured' });
        }

        // Disconnect any previous pending client
        if (pendingAuth && pendingAuth.client) {
            try { await pendingAuth.client.disconnect(); } catch {}
        }

        const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
            connectionRetries: 2,
            timeout: 30000,
            autoReconnect: false,
            floodSleepThreshold: 0,
        });
        // Disable update loop for auth flow too
        client._loopStarted = true;
        await client.connect();

        const result = await client.invoke(
            new Api.auth.SendCode({
                phoneNumber: phone,
                apiId,
                apiHash,
                settings: new Api.CodeSettings({}),
            })
        );

        pendingAuth = { client, phoneCodeHash: result.phoneCodeHash, phone };

        return res.json({ success: true, message: 'تم إرسال كود التحقق إلى تلجرام' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/telegram-scraper/auth/verify-code
 * Body: { code: "12345", password?: "2FA password" }
 */
exports.verifyCode = async (req, res) => {
    try {
        const { code, password } = req.body;
        if (!code) return res.status(400).json({ error: 'كود التحقق مطلوب' });
        if (!pendingAuth) return res.status(400).json({ error: 'لم يتم طلب كود أولاً. أعد إرسال الكود.' });

        const { client, phoneCodeHash, phone } = pendingAuth;

        try {
            await client.invoke(
                new Api.auth.SignIn({
                    phoneNumber: phone,
                    phoneCodeHash,
                    phoneCode: code,
                })
            );
        } catch (err) {
            // 2FA required
            if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
                if (!password) {
                    return res.status(200).json({ needs2FA: true, message: 'حسابك محمي بكلمة مرور ثنائية. أدخل كلمة المرور.' });
                }
                const passwordResult = await client.invoke(new Api.account.GetPassword());
                const { computeCheck } = require('telegram/Password');
                const srp = await computeCheck(passwordResult, password);
                await client.invoke(new Api.auth.CheckPassword({ password: srp }));
            } else {
                throw err;
            }
        }

        // Save session
        const sessionStr = client.session.save();
        saveSession(sessionStr);

        const me = await client.getMe();
        await client.disconnect();
        pendingAuth = null;

        return res.json({
            success: true,
            message: 'تم تسجيل الدخول بنجاح!',
            user: {
                firstName: me.firstName,
                lastName: me.lastName,
                username: me.username,
            }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/telegram-scraper/auth/logout
 * Clears the stored session.
 */
exports.logout = async (req, res) => {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            fs.unlinkSync(SESSION_FILE);
        }
        pendingAuth = null;
        return res.json({ success: true, message: 'تم تسجيل الخروج' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/telegram-scraper/fetch-comments
 * Body: { postUrl: "https://t.me/channel/123" }
 * Returns all comments/replies on the given post.
 */
exports.fetchComments = async (req, res) => {
    try {
        const { postUrl } = req.body;
        if (!postUrl) return res.status(400).json({ error: 'رابط البوست مطلوب' });

        // ── Anti-spam: prevent concurrent fetches ────────────
        if (activeFetch) {
            return res.status(429).json({ error: 'يوجد طلب جلب قيد التنفيذ بالفعل. انتظر حتى ينتهي.' });
        }

        // ── Cooldown check ───────────────────────────────────
        const now = Date.now();
        const elapsed = now - lastFetchTime;
        if (elapsed < COOLDOWN_MS) {
            const wait = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
            return res.status(429).json({ error: `انتظر ${wait} ثانية قبل طلب جلب جديد.` });
        }

        const parsed = parsePostUrl(postUrl);
        if (!parsed) return res.status(400).json({ error: 'رابط غير صالح. استخدم رابط بالشكل: https://t.me/channel/123' });

        activeFetch = true;
        lastFetchTime = Date.now();

        const client = await getClient();

        try {
            // Resolve the channel
            let inputChannel;
            if (parsed.channel.startsWith('-100')) {
                // Numeric channel ID
                const channelId = BigInt(parsed.channel.replace('-100', ''));
                // We need access hash, resolve via getDialogs or getEntity
                const entity = await client.getEntity(parsed.channel);
                inputChannel = entity;
            } else {
                // Username-based
                inputChannel = await client.getEntity(parsed.channel);
            }

            // Fetch replies (comments) on the specific message
            const comments = [];
            let offsetId = 0;
            const limit = 100;
            let pageCount = 0;
            let apiCallCount = 2; // connect + getEntity already done

            console.log(`[TelegramScraper] Starting fetch for ${parsed.channel}/${parsed.messageId}`);

            // Use messages.getReplies which fetches the discussion thread
            while (pageCount < MAX_PAGES) {
                // ── Delay between pages (skip first page) ────
                if (pageCount > 0) {
                    await sleep(PAGE_DELAY_MS);
                }

                let result;
                try {
                    result = await client.invoke(
                        new Api.messages.GetReplies({
                            peer: inputChannel,
                            msgId: parsed.messageId,
                            offsetId: offsetId,
                            offsetDate: 0,
                            addOffset: 0,
                            limit: limit,
                            maxId: 0,
                            minId: 0,
                            hash: BigInt(0),
                        })
                    );
                    apiCallCount++;
                    pageCount++;
                } catch (floodErr) {
                    // ── Handle FloodWait ─────────────────────
                    if (floodErr.message && floodErr.message.includes('FLOOD_WAIT')) {
                        const waitMatch = floodErr.message.match(/(\d+)/);
                        const waitSec = waitMatch ? parseInt(waitMatch[1], 10) : 30;
                        console.warn(`[TelegramScraper] FloodWait ${waitSec}s — stopping pagination with ${comments.length} comments collected so far.`);
                        // Return what we have so far instead of waiting or failing
                        break;
                    }
                    throw floodErr;
                }

                if (!result.messages || result.messages.length === 0) break;

                // Build a user/chat lookup map
                const userMap = {};
                if (result.users) {
                    for (const u of result.users) {
                        const uid = u.id?.value?.toString() || u.id?.toString();
                        userMap[uid] = {
                            id: uid,
                            firstName: u.firstName || '',
                            lastName: u.lastName || '',
                            username: u.username || '',
                        };
                    }
                }
                if (result.chats) {
                    for (const c of result.chats) {
                        const cid = c.id?.value?.toString() || c.id?.toString();
                        userMap[cid] = {
                            id: cid,
                            firstName: c.title || '',
                            lastName: '',
                            username: c.username || '',
                        };
                    }
                }

                for (const msg of result.messages) {
                    // Skip service messages
                    if (msg.className === 'MessageService') continue;

                    const fromId = msg.fromId?.userId?.value?.toString()
                        || msg.fromId?.userId?.toString()
                        || msg.fromId?.channelId?.value?.toString()
                        || msg.fromId?.channelId?.toString()
                        || msg.fromId?.chatId?.value?.toString()
                        || msg.fromId?.chatId?.toString()
                        || '';

                    const sender = userMap[fromId] || { id: fromId, firstName: 'مجهول', lastName: '', username: '' };
                    const fullName = `${sender.firstName} ${sender.lastName}`.trim();
                    const createdAtSec = toUnixSeconds(msg.date);
                    const editedAtSec = toUnixSeconds(msg.editDate);
                    const isEdited = !!(createdAtSec && editedAtSec && editedAtSec > createdAtSec && msg.editHide !== true);

                    comments.push({
                        id: msg.id,
                        text: msg.message || '',
                        date: toIsoFromTelegramTime(msg.date) || '',
                        editDate: isEdited ? toIsoFromTelegramTime(msg.editDate) : null,
                        isEdited,
                        sender: {
                            id: sender.id,
                            name: fullName,
                            username: sender.username,
                        }
                    });
                }

                // If we got fewer than limit, we've reached the end
                if (result.messages.length < limit) break;
                offsetId = result.messages[result.messages.length - 1].id;

                // ── Hard cap on total comments ──────────────
                if (comments.length >= MAX_COMMENTS) {
                    console.log(`[TelegramScraper] Reached max comments cap (${MAX_COMMENTS}). Stopping.`);
                    break;
                }
            }

            console.log(`[TelegramScraper] Done. ${comments.length} comments fetched in ${apiCallCount} API calls (${pageCount} pages).`);

            await client.disconnect();
            activeFetch = false;

            return res.json({
                success: true,
                postUrl: postUrl,
                channel: parsed.channel,
                messageId: parsed.messageId,
                totalComments: comments.length,
                apiCalls: apiCallCount,
                comments: comments,
            });
        } catch (err) {
            await client.disconnect();
            activeFetch = false;
            throw err;
        }
    } catch (err) {
        console.error('[TelegramScraper] fetchComments error:', err.message);
        activeFetch = false;
        return res.status(500).json({ error: 'حدث خطأ أثناء الجلب: ' + err.message });
    }
};
