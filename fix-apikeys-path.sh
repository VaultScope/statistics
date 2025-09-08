#!/bin/bash

# Fix all apiKeys.json paths in the server code
cd /mnt/c/Users/toowa/OneDrive/Desktop/Projects/Statistics

echo "Fixing apiKeys.json paths in all server files..."

# Fix each file
sed -i 's|path.resolve(__dirname, "\.\./apiKeys\.json")|path.resolve(process.cwd(), "apiKeys.json")|g' server/functions/rateLimit.ts
sed -i 's|path.resolve(__dirname, "\.\./\.\./apiKeys\.json")|path.resolve(process.cwd(), "apiKeys.json")|g' server/functions/keys/createKey.ts
sed -i 's|path.resolve(__dirname, "\.\./\.\./apiKeys\.json")|path.resolve(process.cwd(), "apiKeys.json")|g' server/functions/keys/deleteKey.ts
sed -i 's|path.resolve(__dirname, "\.\./\.\./apiKeys\.json")|path.resolve(process.cwd(), "apiKeys.json")|g' server/functions/keys/updateKey.ts
sed -i 's|path.resolve(__dirname, "\.\./\.\./apiKeys\.json")|path.resolve(process.cwd(), "apiKeys.json")|g' server/functions/keys/manageKey.ts

# Also fix the CLI tool
sed -i 's|path.join(__dirname, "apiKeys\.json")|path.resolve(process.cwd(), "apiKeys.json")|g' cli.js 2>/dev/null || true
sed -i 's|path.resolve(__dirname, "apiKeys\.json")|path.resolve(process.cwd(), "apiKeys.json")|g' cli.js 2>/dev/null || true

echo "Paths fixed. Now rebuilding the server..."

# Rebuild the server
npm run build

echo "Server rebuilt. The apiKeys.json file will now be read from the project root."
echo ""
echo "On the server, run:"
echo "  cd /var/www/vaultscope-statistics"
echo "  npm run build"
echo "  systemctl restart vaultscope-statistics-server"
echo "  ls -la apiKeys.json"