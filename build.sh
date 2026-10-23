#!/bin/sh
set -eu
cd "$(dirname "$0")"
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
node -e 'const fs = require("node:fs"); const p = JSON.parse(fs.readFileSync("utools/plugin.json", "utf8")); for (const file of [p.main, p.logo]) { if (!fs.existsSync("utools/" + file)) throw new Error("Missing " + file) }'
echo 'uTools plugin ready: utools/plugin.json'
