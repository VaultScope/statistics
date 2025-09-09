import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import LdapStrategy from 'passport-ldapauth';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
// @ts-ignore
import { OIDCStrategy } from 'passport-azure-ad';
import bcrypt from 'bcryptjs';
import { userRepository } from '../../db/repositories/userRepository';
import { db } from '../../db/index';
import { users, sessions } from '../../db/index';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

interface AuthUser {
  id: number;
  username: string;
  email?: string;
  firstName: string;
  roleId: string;
  provider?: string;
}

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await userRepository.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Local Strategy
passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const user = await userRepository.getUserByUsername(username);
      if (!user) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      // Update last login
      await userRepository.updateUser(user.id, { lastLogin: new Date().toISOString() });

      return done(null, {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        roleId: user.roleId,
        provider: 'local'
      });
    } catch (error) {
      return done(error);
    }
  }
));

// LDAP Strategy
if (process.env.LDAP_URL) {
  const ldapOptions = {
    server: {
      url: process.env.LDAP_URL,
      bindDN: process.env.LDAP_BIND_DN || '',
      bindCredentials: process.env.LDAP_BIND_PASSWORD || '',
      searchBase: process.env.LDAP_SEARCH_BASE || 'dc=example,dc=com',
      searchFilter: process.env.LDAP_SEARCH_FILTER || '(uid={{username}})',
      searchAttributes: ['displayName', 'mail', 'memberOf', 'uid', 'cn']
    }
  };

  passport.use(new LdapStrategy(ldapOptions, async (user: any, done: any) => {
    try {
      // Check if user exists in database
      let dbUser = await userRepository.getUserByUsername(user.uid || user.cn);
      
      if (!dbUser) {
        // Create user from LDAP
        const newUser = await db.insert(users).values({
          username: user.uid || user.cn,
          firstName: user.displayName || user.cn,
          password: await bcrypt.hash(uuidv4(), 10), // Random password for LDAP users
          roleId: 'viewer', // Default role
          email: user.mail,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).returning();
        
        dbUser = newUser[0];
      }

      // Update last login
      await userRepository.updateUser(dbUser.id, { lastLogin: new Date().toISOString() });

      return done(null, {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        firstName: dbUser.firstName,
        roleId: dbUser.roleId,
        provider: 'ldap'
      });
    } catch (error) {
      return done(error);
    }
  }));
}

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists
      let user = await db.select().from(users).where(eq(users.email, profile.emails?.[0]?.value || '')).get();
      
      if (!user) {
        // Create new user from Google profile
        const newUser = await db.insert(users).values({
          username: profile.emails?.[0]?.value?.split('@')[0] || profile.id,
          firstName: profile.displayName || profile.name?.givenName || 'Google User',
          password: await bcrypt.hash(uuidv4(), 10), // Random password for OAuth users
          roleId: 'viewer',
          email: profile.emails?.[0]?.value,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).returning();
        
        user = newUser[0];
      }

      // Update last login
      await userRepository.updateUser(user.id, { lastLogin: new Date().toISOString() });

      return done(null, {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        roleId: user.roleId,
        provider: 'google'
      });
    } catch (error) {
      return done(error as Error);
    }
  }));
}

// GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || '/auth/github/callback'
  }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      // Check if user exists
      let user = await db.select().from(users).where(eq(users.email, profile.emails?.[0]?.value || '')).get();
      
      if (!user) {
        // Create new user from GitHub profile
        const newUser = await db.insert(users).values({
          username: profile.username || profile.id,
          firstName: profile.displayName || profile.username || 'GitHub User',
          password: await bcrypt.hash(uuidv4(), 10),
          roleId: 'viewer',
          email: profile.emails?.[0]?.value,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).returning();
        
        user = newUser[0];
      }

      // Update last login
      await userRepository.updateUser(user.id, { lastLogin: new Date().toISOString() });

      return done(null, {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        roleId: user.roleId,
        provider: 'github'
      });
    } catch (error) {
      return done(error);
    }
  }));
}

// Azure AD / Microsoft Strategy
if (process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET && process.env.AZURE_TENANT_ID) {
  passport.use(new OIDCStrategy({
    identityMetadata: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0/.well-known/openid-configuration`,
    clientID: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
    responseType: 'code',
    responseMode: 'form_post',
    redirectUrl: process.env.AZURE_CALLBACK_URL || '/auth/azure/callback',
    allowHttpForRedirectUrl: process.env.NODE_ENV !== 'production',
    validateIssuer: true,
    passReqToCallback: false,
    scope: ['profile', 'email']
  }, async (iss: any, sub: any, profile: any, accessToken: any, refreshToken: any, done: any) => {
    try {
      const email = profile._json.email || profile._json.preferred_username;
      
      // Check if user exists
      let user = await db.select().from(users).where(eq(users.email, email)).get();
      
      if (!user) {
        // Create new user from Azure profile
        const newUser = await db.insert(users).values({
          username: email.split('@')[0],
          firstName: profile.displayName || profile.name?.givenName || 'Azure User',
          password: await bcrypt.hash(uuidv4(), 10),
          roleId: 'viewer',
          email: email,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).returning();
        
        user = newUser[0];
      }

      // Update last login
      await userRepository.updateUser(user.id, { lastLogin: new Date().toISOString() });

      return done(null, {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        roleId: user.roleId,
        provider: 'azure'
      });
    } catch (error) {
      return done(error);
    }
  }));
}

// JWT Token generation
export function generateJWT(user: AuthUser): string {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    roleId: user.roleId,
    provider: user.provider
  };

  return require('jsonwebtoken').sign(payload, process.env.JWT_SECRET || 'changeme', {
    expiresIn: '24h'
  });
}

// Session management
export async function createSession(userId: number): Promise<string> {
  const sessionId = uuidv4();
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    token,
    expiresAt,
    createdAt: new Date().toISOString()
  });

  return token;
}

export async function validateSession(token: string): Promise<AuthUser | null> {
  const session = await db.select().from(sessions).where(eq(sessions.token, token)).get();
  
  if (!session || new Date(session.expiresAt) < new Date()) {
    return null;
  }

  const user = await userRepository.getUserById(session.userId);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email || undefined,
    firstName: user.firstName,
    roleId: user.roleId
  };
}

export default passport;