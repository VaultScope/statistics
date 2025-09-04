import { promises as fs } from "fs";
import path from "path";
import Key from "../../types/api/keys/key";

const apiKeysPath = path.resolve(__dirname, "../../apiKeys.json");
export async function deleteApiKey(identifier: string): Promise<boolean> {
    try {
        let keys: Key[] = [];
        try {
            const data = await fs.readFile(apiKeysPath, "utf-8");
            keys = JSON.parse(data);
        } catch (err) {
            return false;
        }

        const originalLength = keys.length;
        keys = keys.filter(k => k.uuid !== identifier && k.key !== identifier);

        if (keys.length === originalLength) {
            return false;
        }

        await fs.writeFile(apiKeysPath, JSON.stringify(keys, null, 4), "utf-8");
        return true;

    } catch (err) {
        console.error("Error when deleting API key:", err);
        return false;
    }
}
