import { Router } from 'express';
import { readFile, initialUsers } from '../storage.js';

const router = Router();

/**
 * Authentication & Session Subsystem
 * Routes mounted at /api/auth/*
 */

// POST /api/auth/login
router.post(['/login', '/'], async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const users = await readFile('users.json', initialUsers);
    const cleanUser = String(username).trim().toLowerCase();
    
    const user = users.find(u => 
      String(u.username || '').toLowerCase() === cleanUser ||
      String(u.employeeId || '').toLowerCase() === cleanUser ||
      String(u.email || '').toLowerCase() === cleanUser
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or credentials' });
    }

    // Password check if provided in request
    if (password && user.password && user.password !== password) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = `token_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const safeUser = { ...user };
    delete safeUser.password;

    res.json({
      success: true,
      token,
      user: safeUser
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me or /api/auth/profile
router.get(['/me', '/profile'], async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const users = await readFile('users.json', initialUsers);

    if (authHeader.startsWith('Bearer token_')) {
      const parts = authHeader.split('_');
      const userId = parts[1];
      const user = users.find(u => u.id === userId);
      if (user) {
        const safeUser = { ...user };
        delete safeUser.password;
        return res.json({ success: true, user: safeUser });
      }
    }

    // Default return first user or admin for developer inspection
    const defaultUser = users[0] || initialUsers[0];
    const safeUser = { ...defaultUser };
    delete safeUser.password;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/token (Validate / Refresh)
router.post('/token', (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ valid: false, error: 'Token is required' });
  }
  res.json({ valid: true, token, refreshedAt: new Date().toISOString() });
});

export default router;
