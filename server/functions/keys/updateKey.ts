import { promises as fs } from "fs";
import path from "path";
import Key from "../../types/api/keys/key";
import Permissions from "../../types/api/keys/permissions";

const apiKeysPath = path.resolve(__dirname, "../../apiKeys.json");

async function loadKeys(): Promise<Key[]> {
    try {
        const data = await fs.readFile(apiKeysPath, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

async function saveKeys(keys: Key[]): Promise<void> {
    await fs.writeFile(apiKeysPath, JSON.stringify(keys, null, 2));
}

export async function updateApiKeyPermissions(identifier: string, permissions: Permissions): Promise<boolean> {
    const keys = await loadKeys();
    const keyIndex = keys.findIndex(k => k.uuid === identifier || k.key === identifier);
    
    if (keyIndex === -1) {
        return false;
    }
    
    keys[keyIndex].permissions = permissions;
    await saveKeys(keys);
    return true;
}

export async function getApiKey(identifier: string): Promise<Key | null> {
    const keys = await loadKeys();
    return keys.find(k => k.uuid === identifier || k.key === identifier) || null;
}