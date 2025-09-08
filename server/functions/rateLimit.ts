import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { promises as fs } from "fs";
import path from "path";
import Key from "../types/api/keys/key";

const apiKeysPath = path.resolve(process.cwd(), "apiKeys.json");

async function loadKeys(): Promise<Key[]> {
    try {
        const data = await fs.readFile(apiKeysPath, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

// Rate limiter for requests without valid API key - 10 requests per minute
const invalidKeyLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,               // 10 requests per minute
  standardHeaders: true, 
  legacyHeaders: false, 
  message: "Too many requests without valid API key. Maximum 10 requests per minute allowed.",
  // Skip IP validation since we're only trusting loopback proxy
  skip: (req) => false,
  // Custom key generator that handles both IPv4 and IPv6
  keyGenerator: (req) => {
    // Get the IP address (supports both IPv4 and IPv6)
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    // For IPv6, normalize the address by removing the ::ffff: prefix for IPv4-mapped addresses
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7); // Return just the IPv4 part
    }
    return ip;
  },
  // Disable validation warnings for custom keyGenerator
  validate: false
});

// Main rate limiting middleware that checks for API key validity
const limiter = async (req: Request, res: Response, next: NextFunction) => {
  // Extract API key from headers or query
  const apiKey: string = req.headers['x-api-key'] as string || 
                        req.headers['authorization']?.replace('Bearer ', '') || 
                        (req.query.apiKey as string);

  if (apiKey) {
    const keys = await loadKeys();
    const foundKey = keys.find(k => k.key === apiKey);
    
    if (foundKey) {
      // Valid API key found - skip rate limiting
      return next();
    }
  }
  
  // No API key or invalid key - apply rate limiting
  invalidKeyLimiter(req, res, next);
};

export default limiter;