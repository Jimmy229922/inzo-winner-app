const onlineClients = require('./clients');

/**
 * Broadcasts a notification to connected WebSocket clients.
 * 
 * @param {Object} app - DEPRECATED: The Express app instance (ignored).
 * @param {string} message - The notification message text.
 * @param {string} level - The notification level ('info', 'success', 'warning', 'error').
 * @param {string|null} targetUserId - Optional. If provided, sends only to this user. Otherwise, broadcasts to all.
 */
const broadcastNotification = (app, message, level = 'info', targetUserId = null) => {
    try {
        // console.log(`[Notification] Broadcasting: "${message}" (Level: ${level}) to ${targetUserId ? 'User ' + targetUserId : 'All Users'}`);
        // console.log(`[Notification] Current online clients: ${onlineClients.size}`);

        const payload = JSON.stringify({
            type: 'notification',
            message,
            level
        });

        if (targetUserId) {
            // Send to specific user
            const client = onlineClients.get(targetUserId.toString());
            if (client && client.readyState === 1) { // 1 = OPEN
                client.send(payload);
            }
        } else {
            // Broadcast to all connected clients
            onlineClients.forEach((client) => {
                if (client.readyState === 1) { // 1 = OPEN
                    client.send(payload);
                }
            });
        }
    } catch (error) {
        console.error('[Notification] Error broadcasting notification:', error);
    }
};

module.exports = { broadcastNotification };
