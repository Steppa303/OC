/**
 * Telegram Mini App Init-Data Validation + JWT Auth
 */
import { initDataStorage, parseInitData, validate as validateInitData } from '@telegram-apps/init-data';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction, Express } from 'express';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const JWT_SECRET = 'entertainbernd-miniapp-jwt-secret-2026';

interface AuthRequest extends Request {
  user?: {
    id: number;
    firstName?: string;
    lastName?: string;
    username?: string;
  };
}

export function initAuth(app: Express) {
  // Init-Data validation endpoint
  app.post('/api/auth', async (req: Request, res: Response) => {
    try {
      const { initData } = req.body;
      if (!initData) {
        return res.status(400).json({ error: 'Missing initData' });
      }

      const parsed = parseInitData(initData);
      const valid = validateInitData(initData, BOT_TOKEN);

      if (!valid) {
        return res.status(401).json({ error: 'Invalid initData signature' });
      }

      const user = parsed.user;
      if (!user) {
        return res.status(401).json({ error: 'No user in initData' });
      }

      // Generate JWT
      const token = jwt.sign(
        {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Return user info + token
      return res.json({
        token,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          languageCode: user.languageCode,
        },
      });
    } catch (err) {
      console.error('Auth error:', err);
      return res.status(500).json({ error: 'Auth failed' });
    }
  });

  // Middleware to verify JWT
  const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid token' });
    }

    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthRequest['user'];
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };

  return authMiddleware;
}