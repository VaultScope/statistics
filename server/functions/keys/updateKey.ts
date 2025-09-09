import Key from "../../types/api/keys/key";
import Permissions from "../../types/api/keys/permissions";
import { apiKeyRepository } from "../../db/repositories/apiKeyRepository";

export async function updateApiKeyPermissions(identifier: string, permissions: Permissions): Promise<boolean> {
    try {
        // Update the permissions
        return await apiKeyRepository.updateApiKeyPermissions(identifier, permissions);
    } catch (error) {
        console.error("Error updating API key permissions:", error);
        return false;
    }
}

export async function getApiKey(identifier: string): Promise<Key | null> {
    try {
        const key = await apiKeyRepository.getApiKey(identifier);
        if (!key) {
            return null;
        }
        
        return {
            uuid: key.uuid!,
            name: key.name,
            key: key.key,
            permissions: key.permissions,
            createdAt: new Date(key.createdAt)
        };
    } catch (error) {
        console.error("Error getting API key:", error);
        return null;
    }
}