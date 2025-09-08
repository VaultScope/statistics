import { promises as fs } from "fs";
import path from "path";
import Key from "../../types/api/keys/key";

const apiKeysPath = path.resolve(process.cwd(), "apiKeys.json");

async function loadKeys(): Promise<Key[]> {
    try {
        const data = await fs.readFile(apiKeysPath, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

const listKeys = {
    list: async (): Promise<Key[]> => {
        return await loadKeys();
    }
};

export default listKeys;