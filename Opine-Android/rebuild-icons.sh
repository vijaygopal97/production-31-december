#!/bin/bash
# Script to clear cache and rebuild app with new icons

echo "Clearing Expo cache..."
npx expo start --clear

echo ""
echo "To see the new app icon:"
echo "1. Stop the current Expo server (Ctrl+C)"
echo "2. Run: npx expo prebuild --clean"
echo "3. For Android: npx expo run:android"
echo "4. For iOS: npx expo run:ios"
echo ""
echo "Or rebuild using EAS:"
echo "eas build --platform android"
echo "eas build --platform ios"

