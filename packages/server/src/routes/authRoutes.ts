import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { dbService } from '../db';
import { generateToken, requireAuth, AuthenticatedRequest } from '../auth';

const router = Router();

// Register new account
router.post('/register', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await dbService.get('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    const now = Date.now();
    const finalDisplayName = displayName ? displayName.trim() : cleanEmail.split('@')[0];

    await dbService.run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)',
      [userId, cleanEmail, passwordHash, finalDisplayName, now]
    );

    const token = generateToken({ id: userId, email: cleanEmail, displayName: finalDisplayName });
    res.status(201).json({
      token,
      user: { id: userId, email: cleanEmail, displayName: finalDisplayName, createdAt: now }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// Login
router.post('/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await dbService.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken({ id: user.id, email: user.email, displayName: user.display_name });
    res.json({
      token,
      user: { id: user.id, email: user.email, displayName: user.display_name, createdAt: user.created_at }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// Get current authenticated user
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await dbService.get('SELECT id, email, display_name, created_at FROM users WHERE id = ?', [req.user!.id]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({
      user: { id: user.id, email: user.email, displayName: user.display_name, createdAt: user.created_at }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch user: ' + err.message });
  }
});

export default router;

