#!/bin/bash

echo "=== Med Connect Deployment Test ==="
echo "Node.js version: $(node --version)"
echo "pnpm version: $(pnpm --version)"
echo ""

echo "=== Directory Structure ==="
ls -la
echo ""

echo "=== Frontend Directory ==="
ls -la Frontend/
echo ""

echo "=== Testing pnpm workspace ==="
pnpm list --depth=0
echo ""

echo "=== Testing Frontend build ==="
cd Frontend
pnpm install
pnpm run build
echo ""

echo "=== Build Output ==="
ls -la .svelte-kit/output/
echo ""

echo "=== Deployment test complete ==="