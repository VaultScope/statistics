import { Request, Response, NextFunction } from "express";
import { promises as fs } from "fs";
import path from "path";
import Key from "../types/api/keys/key";
import { logApiRequest } from "./logs/apiLogger";

const apiKeysPath = path.resolve(__dirname, "../apiKeys.json");

async function loadKeys(): Promise<Key[]> {
    try {
        const data = await fs.readFile(apiKeysPath, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

interface AuthRequest extends Request {
    apiKey?: Key;
    requestStartTime?: number;
}

function authenticate(requiredPermissions?: string[]) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        req.requestStartTime = Date.now();
        
        const apiKey: string = req.headers['x-api-key'] as string || 
                               req.headers['authorization']?.replace('Bearer ', '') || 
                               (req.query.apiKey as string);

        if (!apiKey) {
            const statusCode = 401;
            
            // Log failed request
            await logApiRequest(
                'unknown',
                'No API Key',
                req.path,
                req.method,
                statusCode,
                req.ip || 'unknown',
                req.headers['user-agent'],
                Date.now() - req.requestStartTime
            );
            
            return res.status(statusCode).json({
                error: "HTTP 401 Unauthorized",
                message: "No API key provided."
            });
        }

        const keys = await loadKeys();
        const foundKey = keys.find(k => k.key === apiKey);

        if (!foundKey) {
            const statusCode = 401;
            
            // Log failed request
            await logApiRequest(
                'invalid',
                'Invalid API Key',
                req.path,
                req.method,
                statusCode,
                req.ip || 'unknown',
                req.headers['user-agent'],
                Date.now() - req.requestStartTime
            );
            
            return res.status(statusCode).json({
                error: "HTTP 401 Unauthorized",
                message: "Invalid API key."
            });
        }

        if (requiredPermissions && requiredPermissions.length > 0) {
            const missingPermissions = requiredPermissions.filter(perm => {
                return !(foundKey.permissions as any)[perm];
            });

            if (missingPermissions.length > 0) {
                const statusCode = 403;
                
                // Log failed request
                await logApiRequest(
                    foundKey.uuid,
                    foundKey.name,
                    req.path,
                    req.method,
                    statusCode,
                    req.ip || 'unknown',
                    req.headers['user-agent'],
                    Date.now() - req.requestStartTime
                );
                
                return res.status(statusCode).json({
                    error: "HTTP 403 Forbidden",
                    message: "Insufficient permissions.",
                    required: requiredPermissions,
                    missing: missingPermissions
                });
            }
        }

        req.apiKey = foundKey;
        
        // Log successful request after response
        res.on('finish', async () => {
            await logApiRequest(
                foundKey.uuid,
                foundKey.name,
                req.path,
                req.method,
                res.statusCode,
                req.ip || 'unknown',
                req.headers['user-agent'],
                Date.now() - req.requestStartTime!
            );
        });
        
        next();
    };
}

export default authenticate;
export { AuthRequest };