const axios = require('axios');

// Prefer environment variable; fallback to provided key for local testing
const API_KEY = process.env.WHEEL_OF_NAMES_API_KEY || 'e0d70af4-18cb-4c5e-ba8e-1ef18432a5a7';
const BASE_URL = process.env.WHEEL_OF_NAMES_BASE_URL || 'https://wheelofnames.com/api/v2';

function buildTitle(req) {
  const { title } = req.body || {};
  if (title && typeof title === 'string') return title.substring(0, 50);
  const agentName = req.body?.agent?.name || req.body?.agentName || '';
  const base = agentName ? `مسابقة ${agentName}` : 'مسابقة INZO';
  return base.substring(0, 50);
}

function buildDescription(req) {
  const { description } = req.body || {};
  if (description && typeof description === 'string') return description.substring(0, 200);
  const now = new Date().toLocaleString('ar-EG');
  return `تم الإنشاء من نظام INZO بتاريخ ${now}`.substring(0, 200);
}

function normalizeEntries(rawEntries) {
  if (!Array.isArray(rawEntries)) return [];
  // Accept either strings or {text}
  const texts = rawEntries
    .map((e) => {
      if (!e) return null;
      if (typeof e === 'string') return e.trim();
      if (typeof e === 'object' && typeof e.text === 'string') return e.text.trim();
      // If our FE sent name/account, join them
      if (typeof e === 'object' && e.name) {
        const acc = e.account || e.account_number || '';
        return acc ? `${e.name} — ${acc}` : `${e.name}`;
      }
      return null;
    })
    .filter(Boolean)
    .map((t) => t.substring(0, 200)); // Wheel API typical text limits
  return texts.map((t) => ({ text: t }));
}

exports.createWheel = async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries || []);
    if (!entries.length) {
      return res.status(400).json({ message: 'entries is required (non-empty array)' });
    }

    const shareMode = req.body?.shareMode || 'copyable';
    const payload = {
      shareMode,
      wheelConfig: {
        title: buildTitle(req),
        description: buildDescription(req),
        entries,
        // Sensible defaults – can be extended from body if provided
        displayWinnerDialog: true,
        spinTime: typeof req.body?.spinTime === 'number' ? Math.max(1, Math.min(60, req.body.spinTime)) : 10,
      },
    };

    const url = `${BASE_URL}/wheels`;
    const resp = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      timeout: 15000,
    });

    const path = resp?.data?.data?.path;
    if (!path) {
      return res.status(502).json({ message: 'Unexpected response from Wheel of Names', raw: resp.data });
    }

    return res.status(201).json({
      path,
      url: `https://wheelofnames.com/${path}`,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const body = err.response?.data;
    return res.status(status).json({
      message: 'Wheel of Names API error',
      status,
      error: body || err.message,
    });
  }
};
