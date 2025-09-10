import compression from 'compression';
import { Request, Response } from 'express';

// Custom compression options
export const compressionMiddleware = compression({
  // Compression level (0-9, higher = better compression, slower)
  level: 6,
  
  // Minimum response size to compress (in bytes)
  threshold: 1024, // 1KB
  
  // Custom filter function
  filter: (req: any, res: any) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Don't compress images
    const contentType = res.getHeader('Content-Type') as string;
    if (contentType && /image\/.+/.test(contentType)) {
      return false;
    }

    // Use compression's default filter
    return compression.filter(req, res);
  },
  
  // Memory level (1-9, higher = more memory, faster)
  memLevel: 8,
  
  // Strategy
  strategy: 0, // Default strategy
  
  // Window bits
  windowBits: 15,
  
  // Chunk size
  chunkSize: 16 * 1024
});

// Brotli compression for modern browsers
export const brotliMiddleware = (req: Request, res: Response, next: Function) => {
  const acceptEncoding = req.headers['accept-encoding'] as string || '';
  
  if (acceptEncoding.includes('br')) {
    res.setHeader('Content-Encoding', 'br');
    res.setHeader('Vary', 'Accept-Encoding');
  }
  
  next();
};