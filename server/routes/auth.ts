import { Router } from 'express';
import passport from '../services/auth/passport';
import { generateJWT, createSession } from '../services/auth/passport';

const router = Router();

// Local login
router.post('/login', (req, res, next) => {
  passport.authenticate('local', async (err: any, user: any, info: any) => {
    if (err) {
      return res.status(500).json({ error: 'Authentication error' });
    }
    if (!user) {
      return res.status(401).json({ error: info?.message || 'Invalid credentials' });
    }

    // Generate JWT token
    const token = generateJWT(user);
    
    // Create session
    const sessionToken = await createSession(user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        roleId: user.roleId
      },
      token,
      sessionToken
    });
  })(req, res, next);
});

// LDAP login
router.post('/ldap/login', (req, res, next) => {
  passport.authenticate('ldapauth', async (err: any, user: any, info: any) => {
    if (err) {
      return res.status(500).json({ error: 'LDAP authentication error' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid LDAP credentials' });
    }

    const token = generateJWT(user);
    const sessionToken = await createSession(user.id);

    res.json({
      success: true,
      user,
      token,
      sessionToken
    });
  })(req, res, next);
});

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    const user = req.user as any;
    const token = generateJWT(user);
    const sessionToken = await createSession(user.id);
    
    // Redirect to frontend with tokens
    res.redirect(`${process.env.FRONTEND_URL || ''}/?token=${token}&session=${sessionToken}`);
  }
);

// GitHub OAuth
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  async (req, res) => {
    const user = req.user as any;
    const token = generateJWT(user);
    const sessionToken = await createSession(user.id);
    
    res.redirect(`${process.env.FRONTEND_URL || ''}/?token=${token}&session=${sessionToken}`);
  }
);

// Azure AD
router.get('/azure', passport.authenticate('azuread-openidconnect'));

router.post('/azure/callback',
  passport.authenticate('azuread-openidconnect', { failureRedirect: '/login' }),
  async (req, res) => {
    const user = req.user as any;
    const token = generateJWT(user);
    const sessionToken = await createSession(user.id);
    
    res.redirect(`${process.env.FRONTEND_URL || ''}/?token=${token}&session=${sessionToken}`);
  }
);

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Session validation
router.get('/session', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const { validateSession } = require('../services/auth/passport');
  const user = await validateSession(token);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  res.json({ user });
});

export default router;