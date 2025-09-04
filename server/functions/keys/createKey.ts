import Key from "../../types/api/keys/key";
import Permissions from "@server/types/api/keys/permissions";
import * as crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";

import makeid from "./generate";

const apiKeysPath = path.resolve(__dirname, "../../apiKeys.json");

async function createApiKey(keyname: string, permissions: Permissions): Promise<Key> {
    // Ensure all permission fields are present
    const completePermissions: Permissions = {
        viewStats: permissions.viewStats ?? false,
        createApiKey: permissions.createApiKey ?? false,
        deleteApiKey: permissions.deleteApiKey ?? false,
        viewApiKeys: permissions.viewApiKeys ?? false,
        usePowerCommands: permissions.usePowerCommands ?? false
    };
    
    const key: Key = {
        uuid: crypto.randomUUID(),
        name: keyname,
        key: makeid(),
        permissions: completePermissions,
        createdAt: new Date()
    };

    let keys: Key[] = [];
    try {
        const data = await fs.readFile(apiKeysPath, "utf-8");
        keys = JSON.parse(data);
    } catch (err) {
        keys = [];
    }
    keys.push(key);
    await fs.writeFile(apiKeysPath, JSON.stringify(keys, null, 4), "utf-8");

    return key;
}

export default createApiKey;
