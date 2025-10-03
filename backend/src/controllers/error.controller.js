
exports.logFrontendError = (req, res) => {
    const { message, source, lineno, colno, error, url } = req.body;
    console.error('--- [FRONTEND ERROR CAPTURED] ---');
    console.error(`URL: ${url}`);
    console.error(`Message: ${message}`);
    console.error(`Source: ${source} at line ${lineno}:${colno}`);
    if (error && error.stack) {
        // The stack is the most valuable part for debugging
        console.error('Stack Trace:\n', error.stack);
    }
    console.error('------------------------------------');
    res.sendStatus(204); // No Content - we just received the data and logged it.
};
                