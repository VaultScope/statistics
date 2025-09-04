#!/usr/bin/env node
import createApiKey from "../functions/keys/createKey";
import { deleteApiKey } from "../functions/keys/deleteKey";
import listKeys from "../functions/keys/manageKey";
import Permissions from "../types/api/keys/permissions";

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
    switch (command) {
        case "create":
            await createKey();
            break;
        case "list":
            await listApiKeys();
            break;
        case "delete":
            await deleteKey();
            break;
        default:
            console.log("Usage: npm run apikey [create|list|delete] [options]");
            console.log("\nCommands:");
            console.log("  create <name>              Create a new API key");
            console.log("    Options:");
            console.log("      --admin                Grant all permissions");
            console.log("      --viewStats            Grant viewStats permission (default: true)");
            console.log("      --createApiKey         Grant createApiKey permission");
            console.log("      --deleteApiKey         Grant deleteApiKey permission");
            console.log("      --viewApiKeys          Grant viewApiKeys permission");
            console.log("      --usePowerCommands     Grant usePowerCommands permission");
            console.log("\n  list                       List all API keys");
            console.log("  delete <uuid|key>          Delete an API key by UUID or key");
            process.exit(1);
    }
}

async function createKey() {
    let name = "";
    const optionArgs: string[] = [];
    
    for (const arg of args) {
        if (arg.startsWith("--")) {
            optionArgs.push(arg);
        } else if (!name) {
            name = arg;
        }
    }
    
    if (!name) {
        console.error("Error: Name is required");
        console.log("Usage: npm run apikey create <name> [options]");
        process.exit(1);
    }
    
    const permissions: Permissions = {
        viewStats: true,
        createApiKey: false,
        deleteApiKey: false,
        viewApiKeys: false,
        usePowerCommands: false
    };
    
    if (optionArgs.includes("--admin")) {
        permissions.viewStats = true;
        permissions.createApiKey = true;
        permissions.deleteApiKey = true;
        permissions.viewApiKeys = true;
        permissions.usePowerCommands = true;
    } else {
        if (optionArgs.includes("--viewStats")) permissions.viewStats = true;
        if (optionArgs.includes("--no-viewStats")) permissions.viewStats = false;
        if (optionArgs.includes("--createApiKey")) permissions.createApiKey = true;
        if (optionArgs.includes("--deleteApiKey")) permissions.deleteApiKey = true;
        if (optionArgs.includes("--viewApiKeys")) permissions.viewApiKeys = true;
        if (optionArgs.includes("--usePowerCommands")) permissions.usePowerCommands = true;
    }
    
    try {
        const key = await createApiKey(name, permissions);
        console.log("\n✅ API Key created successfully!");
        console.log("=====================================");
        console.log(`Name: ${key.name}`);
        console.log(`UUID: ${key.uuid}`);
        console.log(`Key: ${key.key}`);
        console.log("\n⚠️  IMPORTANT: Save this key securely. It won't be shown again!");
        console.log("\nPermissions:");
        console.log(`  - View Stats: ${permissions.viewStats}`);
        console.log(`  - Create API Keys: ${permissions.createApiKey}`);
        console.log(`  - Delete API Keys: ${permissions.deleteApiKey}`);
        console.log(`  - View API Keys: ${permissions.viewApiKeys}`);
        console.log(`  - Use Power Commands: ${permissions.usePowerCommands}`);
        console.log("=====================================");
    } catch (error) {
        console.error("Failed to create API key:", error);
        process.exit(1);
    }
}

async function listApiKeys() {
    try {
        const keys = await listKeys.list();
        
        if (keys.length === 0) {
            console.log("No API keys found.");
            return;
        }
        
        console.log("\nAPI Keys:");
        console.log("=====================================");
        
        keys.forEach((key, index) => {
            console.log(`\n${index + 1}. ${key.name}`);
            console.log(`   UUID: ${key.uuid}`);
            console.log(`   Created: ${key.createdAt}`);
            console.log(`   Permissions:`);
            console.log(`     - View Stats: ${key.permissions.viewStats}`);
            console.log(`     - Create API Keys: ${key.permissions.createApiKey}`);
            console.log(`     - Delete API Keys: ${key.permissions.deleteApiKey}`);
            console.log(`     - View API Keys: ${key.permissions.viewApiKeys}`);
            console.log(`     - Use Power Commands: ${key.permissions.usePowerCommands}`);
        });
        
        console.log("\n=====================================");
        console.log(`Total: ${keys.length} key(s)`);
    } catch (error) {
        console.error("Failed to list API keys:", error);
        process.exit(1);
    }
}

async function deleteKey() {
    const identifier = args[0];
    
    if (!identifier) {
        console.error("Error: UUID or key is required");
        console.log("Usage: npm run apikey delete <uuid|key>");
        process.exit(1);
    }
    
    try {
        const success = await deleteApiKey(identifier);
        
        if (success) {
            console.log(`✅ API key deleted successfully: ${identifier}`);
        } else {
            console.error(`❌ API key not found: ${identifier}`);
            process.exit(1);
        }
    } catch (error) {
        console.error("Failed to delete API key:", error);
        process.exit(1);
    }
}

main().catch(console.error);