#!/bin/bash
# Verification script to check if issues have been fixed

echo "🔍 Running post-fix verification tests..."

# Check if page loads
echo "🌐 Checking page accessibility..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://185.217.126.72/threejs-blob-engine/)
echo "   HTTP Status Code: $HTTP_CODE"

if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ Page not accessible"
    exit 1
fi

# Check CSS for background color
echo "🎨 Checking CSS background color..."
BACKGROUND_COLOR=$(curl -s http://185.217.126.72/threejs-blob-engine/assets/index-CIBHfSKD.css | grep -o 'background-color:[^;]*')

echo "   Current background-color: $BACKGROUND_COLOR"

if [[ "$BACKGROUND_COLOR" == *"#000"* ]] || [[ "$BACKGROUND_COLOR" == *"black"* ]]; then
    echo "   ❌ Still has black background"
elif [[ "$BACKGROUND_COLOR" == *"#"* ]] && [[ ! "$BACKGROUND_COLOR" == *"000"* ]]; then
    echo "   ✅ Background color changed from black"
else
    echo "   ?  Background color status unclear"
fi

# Check HTML for body class modifications
echo "🧱 Checking for body class modifications..."
BODY_TAG=$(curl -s http://185.217.126.72/threejs-blob-engine/ | grep -i "<body")

if [[ "$BODY_TAG" == *"white"* ]] || [[ "$BODY_TAG" == *"bg-"* ]]; then
    echo "   ✅ Body tag modified to support light theme"
else
    echo "   ⚠️  Body tag still default"
fi

echo ""
echo "📋 Verification complete!"
echo "   Note: Full canvas size verification requires browser testing"