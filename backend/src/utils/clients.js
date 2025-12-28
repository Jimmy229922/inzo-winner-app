// Global Map to store online WebSocket clients
// Key: userId (string)
// Value: WebSocket connection object
const onlineClients = new Map();

module.exports = onlineClients;