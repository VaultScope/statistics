import { apiKeyRepository } from "../../db/repositories/apiKeyRepositoryMock";

export async function deleteApiKey(identifier: string): Promise<boolean> {
    try {
        // First try to find the key to get its ID
        const key = await apiKeyRepository.getApiKey(identifier);
        if (!key) {
            return false;
        }
        
        // Delete the key (soft delete by default)
        return await apiKeyRepository.deleteApiKey(identifier);
    } catch (err) {
        console.error("Error when deleting API key:", err);
        return false;
    }
}
