#!/bin/bash
set -e

echo "🔍 Checking if server is running..."

# Check if our app is running on port 3000
if ! curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo "❌ Server is not running on port 3000"
    echo "💡 Start your application first with 'npm run dev' or similar"
    exit 1
fi

echo "✅ Server is running"

echo "🚀 Running Playwright tests..."
npx playwright test --reporter=html,verbose

echo "📊 Generating HTML report..."
npx playwright show-report

echo "🎉 Tests completed! Opening HTML report..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open playwright-report/index.html
elif [[ "$OSTYPE" == "linux"* ]]; then
    xdg-open playwright-report/index.html
else
    echo "Please open playwright-report/index.html manually"
fi