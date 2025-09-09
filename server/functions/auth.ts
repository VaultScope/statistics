import { Request, Response, NextFunction } from "express";
import Key from "../types/api/keys/key";
import Permissions from "../types/api/keys/permissions";
import { logApiRequest } from "./logs/apiLogger";
import { apiKeyRepository } from "../db/repositories/apiKeyRepository";

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

        // Validate API key using database
        const validatedKey = await apiKeyRepository.validateApiKey(apiKey);

        if (!validatedKey) {
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

        // Convert database key to expected format
        const foundKey: Key = {
            uuid: validatedKey.uuid!,
            name: validatedKey.name,
            key: validatedKey.key,
            permissions: validatedKey.permissions,
            createdAt: new Date(validatedKey.createdAt)
        };

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