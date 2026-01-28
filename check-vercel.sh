#!/bin/bash

# Script to check Vercel deployment status and build logs

set -e

echo "🚀 Vercel Deployment Checker"
echo "=============================="
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Install it with: npm i -g vercel"
    exit 1
fi

# Check if project is linked
if [ ! -f ".vercel/project.json" ]; then
    echo "❌ Project not linked to Vercel"
    echo ""
    echo "💡 Run: vercel link"
    exit 1
fi

# Get project info
PROJECT_NAME=$(cat .vercel/project.json 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

echo "📁 Project: $PROJECT_NAME"
echo ""

# List recent deployments
echo "📦 Fetching deployments..."
DEPLOYMENTS=$(vercel ls --yes 2>&1)

if echo "$DEPLOYMENTS" | grep -q "No deployments found"; then
    echo "❌ No deployments found for this project"
    echo ""
    echo "💡 Make sure you have deployments in your Vercel dashboard"
    echo "   or wait a moment after pushing to GitHub"
    exit 1
fi

# Extract deployment URLs
DEPLOYMENT_URLS=$(echo "$DEPLOYMENTS" | grep -oE "https://[a-zA-Z0-9-]+\.vercel\.app" | head -5)

if [ -z "$DEPLOYMENT_URLS" ]; then
    echo "$DEPLOYMENTS"
    exit 0
fi

# Show deployments
echo "Recent Deployments:"
echo "-------------------"
COUNT=1
for URL in $DEPLOYMENT_URLS; do
    echo "$COUNT. $URL"
    COUNT=$((COUNT + 1))
done
echo ""

# Get latest deployment
LATEST=$(echo "$DEPLOYMENT_URLS" | head -1)

# Get deployment status
echo "📊 Latest Deployment Status:"
echo "----------------------------"
STATUS=$(vercel inspect "$LATEST" 2>&1)
echo "$STATUS" | grep -E "(State|URL|Created|Ready|Error|Building)" | head -15 || echo "$STATUS" | head -20
echo ""

# Check build state
if echo "$STATUS" | grep -q "State.*ERROR\|State.*FAILED"; then
    echo "❌ Build Failed!"
    echo ""
    read -p "📋 Show error logs? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "📋 Error Logs:"
        echo "--------------"
        vercel inspect "$LATEST" --logs 2>&1 | grep -A 20 -i "error\|failed\|fail" | tail -50 || vercel inspect "$LATEST" --logs 2>&1 | tail -50
    fi
elif echo "$STATUS" | grep -q "State.*READY"; then
    echo "✅ Build Successful!"
    echo ""
    read -p "📋 Show build logs? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "📋 Build Logs (last 50 lines):"
        echo "-------------------------------"
        vercel inspect "$LATEST" --logs 2>&1 | tail -50
    fi
else
    echo "⏳ Build in progress or unknown status"
    echo ""
    read -p "📋 Show logs? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "📋 Logs (last 50 lines):"
        echo "-------------------------"
        vercel inspect "$LATEST" --logs 2>&1 | tail -50
    fi
fi

echo ""
echo "✅ Done!"
