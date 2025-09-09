import Key from "../../types/api/keys/key";
import { apiKeyRepository } from "../../db/repositories/apiKeyRepositoryMock";

const listKeys = {
    list: async (): Promise<Key[]> => {
        try {
            const keys = await apiKeyRepository.getAllApiKeys();
            return keys.map(key => ({
                uuid: key.uuid!,
                name: key.name,
                key: key.key,
                permissions: key.permissions,
                createdAt: new Date(key.createdAt)
            }));
        } catch (err) {
            console.error("Error loading API keys from database:", err);
            return [];
        }
    }
};

export default listKeys;