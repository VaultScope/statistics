import Key from "../../types/api/keys/key";
import Permissions from "@server/types/api/keys/permissions";
import { apiKeyRepository } from "../../db/repositories/apiKeyRepository";

async function createApiKey(keyname: string, permissions: Permissions): Promise<Key> {
    // Ensure all permission fields are present
    const completePermissions: Permissions = {
        viewStats: permissions.viewStats ?? false,
        createApiKey: permissions.createApiKey ?? false,
        deleteApiKey: permissions.deleteApiKey ?? false,
        viewApiKeys: permissions.viewApiKeys ?? false,
        usePowerCommands: permissions.usePowerCommands ?? false
    };
    
    const apiKey = await apiKeyRepository.createApiKey(keyname, completePermissions);
    
    return {
        uuid: apiKey.uuid!,
        name: apiKey.name,
        key: apiKey.key,
        permissions: apiKey.permissions,
        createdAt: new Date(apiKey.createdAt)
    };
}

export default createApiKey;
