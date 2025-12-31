#!/bin/bash

echo "🎙️ Audio Recording Test Script"
echo "================================"
echo ""

echo "Choose your testing method:"
echo "1. Use localhost (Recommended)"
echo "2. Chrome with insecure origins flag"
echo "3. Firefox (Less restrictive)"
echo "4. Chrome site settings"
echo ""

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo "🌐 Opening localhost..."
        echo "URL: http://localhost:3000"
        echo "✅ This should work with audio recording!"
        ;;
    2)
        echo "🔧 Launching Chrome with insecure origins flag..."
        echo "This will open Chrome with special flags for development."
        echo "Choose your system:"
        echo "a) Mac"
        echo "b) Linux"
        read -p "Enter your system (a/b): " system
        
        if [ "$system" = "a" ]; then
            /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --unsafely-treat-insecure-origin-as-secure=http://74.225.250.243:3000 --user-data-dir=/tmp/chrome_dev_test &
            echo "✅ Chrome launched with development flags (Mac)!"
        else
            google-chrome --unsafely-treat-insecure-origin-as-secure=http://74.225.250.243:3000 --user-data-dir=/tmp/chrome_dev_test &
            echo "✅ Chrome launched with development flags (Linux)!"
        fi
        ;;
    3)
        echo "🦊 Opening Firefox..."
        echo "URL: http://74.225.250.243:3000"
        echo "✅ Firefox is less restrictive with microphone access!"
        ;;
    4)
        echo "⚙️ Chrome Site Settings Instructions:"
        echo "1. Open Chrome Settings → Privacy and Security → Site Settings"
        echo "2. Click 'View permissions and data stored across sites'"
        echo "3. Search for: 74.225.250.243:3000"
        echo "4. Click on the site → Microphone → Allow"
        echo "5. Refresh the page"
        echo "✅ This will allow microphone access for your server!"
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        ;;
esac

echo ""
echo "🎯 Expected Results:"
echo "- Microphone permission prompt should appear"
echo "- Audio recording indicator should show 'Recording'"
echo "- Interview should continue seamlessly"
echo ""
echo "🔍 Debug Information:"
echo "- Check browser console for 'Audio Support Check' logs"
echo "- Look for any error messages"
echo "- Verify microphone permission in browser settings"
