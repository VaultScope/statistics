import { Request, Response, NextFunction } from "express";
import { promises as fs } from "fs";
import path from "path";
import Key from "../types/api/keys/key";
import Permissions from "../types/api/keys/permissions";
import { logApiRequest } from "./logs/apiLogger";

const apiKeysPath = path.resolve(__dirname, "../apiKeys.json");

// Cache and reload every 15s
let cachedKeys: Key[] = [];
let lastLoad = 0;
const CACHE_TTL = 15 * 1000;

async function loadKeys(): Promise<Key[]> {
    const now = Date.now();
    if (cachedKeys.length > 0 && now - lastLoad < CACHE_TTL) {
        return cachedKeys;
    }

    try {
        const data = await fs.readFile(apiKeysPath, "utf-8");
        cachedKeys = JSON.parse(data) as Key[];
        lastLoad = now;
        return cachedKeys;
    } catch {
        cachedKeys = [];
        return [];
    }
}

interface AuthRequest extends Request {
    apiKey?: Key;
    requestStartTime?: number;
}

function authenticate(requiredPermissions?: (keyof Permissions)[]) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        req.requestStartTime = Date.now();

        const apiKey: string | undefined =
            (req.headers["x-api-key"] as string) ||
            req.headers["authorization"]?.replace("Bearer ", "") ||
            (req.query.apiKey as string);

        if (!apiKey || apiKey.trim() === "") {
            const statusCode = 401;
            void logApiRequest(
                "unknown",
                "No API Key",
                req.path,
                req.method,
                statusCode,
                (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
                req.headers["user-agent"],
                Date.now() - req.requestStartTime
            );

            return res.status(statusCode).json({
                error: "Unauthorized",
                message: "No API key provided.",
            });
        }

        const keys = await loadKeys();
        const foundKey = keys.find((k) => k.key === apiKey);

        if (!foundKey) {
            const statusCode = 401;
            void logApiRequest(
                "invalid",
                "Invalid API Key",
                req.path,
                req.method,
                statusCode,
                (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
                req.headers["user-agent"],
                Date.now() - req.requestStartTime
            );

            return res.status(statusCode).json({
                error: "Unauthorized",
                message: "Invalid API key.",
            });
        }

        if (requiredPermissions && requiredPermissions.length > 0) {
            const missingPermissions = requiredPermissions.filter(
                (perm) => !foundKey.permissions[perm]
            );

            if (missingPermissions.length > 0) {
                const statusCode = 403;
                void logApiRequest(
                    foundKey.uuid,
                    foundKey.name,
                    req.path,
                    req.method,
                    statusCode,
                    (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
                    req.headers["user-agent"],
                    Date.now() - req.requestStartTime
                );

                return res.status(statusCode).json({
                    error: "Forbidden",
                    message: "Insufficient permissions.",
                    required: requiredPermissions,
                    missing: missingPermissions,
                });
            }
        }

        req.apiKey = foundKey;

        // Log successful request once response is sent
        res.on("finish", () => {
            void logApiRequest(
                foundKey.uuid,
                foundKey.name,
                req.path,
                req.method,
                res.statusCode,
                (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
                req.headers["user-agent"],
                Date.now() - req.requestStartTime!
            );
        });

        next();
    };
}

export default authenticate;
export { AuthRequest };