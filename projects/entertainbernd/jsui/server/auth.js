/**
 * Telegram Mini App Init-Data Validation (HMAC-SHA256) + JWT Auth
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const JWT_SECRET = process.env.JWT_SECRET || 'entertainbernd-miniapp-jwt-secret-2026';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';

/**
 * Validate Telegram WebApp initData signature.
 * Uses HMAC-SHA256 as per Telegram docs.
 */
function validateTelegramInitData(initData) {
  if (!BOT_TOKEN) {
    console.error('[auth] BOT_TOKEN not set');
    return false;
  }

  try {
    // Parse the URL-encoded initData string into key=value pairs
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;

    // Remove hash, sort remaining pairs alphabetically, join with \n
    params.delete('hash');
    const keys = Array.from(params.keys()).sort();
    const dataCheckString = keys.map(k => `${k}=${params.get(k)}`).join('\n');

    // Create secret key: HMAC-SHA256(secret, "WebAppData")
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

    // HMAC-SHA256 of data-check-string with the secret key
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return computedHash === hash;
  } catch (err) {
    console.error('[auth] validation error:', err.message);
    return false;
  }
}

/**
 * Parse user info from initData string.
 */
function parseTelegramUser(initData) {
  const params = new URLSearchParams(initData);
  const raw = params.get('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Initialize auth routes and return middleware.
 */
function initAuth(app) {
  // POST /api/auth — validate initData, return JWT
  app.post('/api/auth', (req, res) => {
    try {
      const { initData } = req.body;
      if (!initData) {
        return res.status(400).json({ error: 'Missing initData' });
      }

      const valid = validateTelegramInitData(initData);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid initData signature' });
      }

      const user = parseTelegramUser(initData);
      if (!user || !user.id) {
        return res.status(401).json({ error: 'No valid user in initData' });
      }

      const payload = {
        id: user.id,
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        username: user.username || '',
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

      return res.json({
        token,
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username,
          languageCode: user.language_code,
        },
      });
    } catch (err) {
      console.error('[auth] error:', err);
      return res.status(500).json({ error: 'Auth failed' });
    }
  });

  // JWT verification middleware
  const authMiddleware = (req, res, next) => {
    // Skip health check
    if (req.path === '/health') return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid token' });
    }

    const token = authHeader.slice(7);
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };

  return authMiddleware;
}

module.exports = { initAuth };
