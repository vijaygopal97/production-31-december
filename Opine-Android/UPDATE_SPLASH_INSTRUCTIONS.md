# How to See the New Convergent Logo in Splash Screen

## The Problem
The splash screen might be cached. There are TWO splash screens:
1. **Native Expo Splash Screen** (shows first, before React loads) - configured in app.json
2. **React SplashScreen Component** (shows after React loads) - in src/screens/SplashScreen.tsx

## Solution Steps

### Step 1: Clear All Caches
```bash
cd /var/www/Opine-Android
./clear-cache-and-restart.sh
```

Or manually:
```bash
rm -rf .expo
npx expo start --clear
```

### Step 2: Reload the App
- **If using Expo Go**: Shake your device → Tap "Reload"
- **If using development build**: The app should reload automatically

### Step 3: For Native Splash Screen (if still showing old logo)
The native splash screen requires a rebuild:

```bash
# For Android
npx expo prebuild --clean
npx expo run:android

# For iOS  
npx expo prebuild --clean
npx expo run:ios
```

### Step 4: Verify Files
All icon files have been regenerated from the new logo:
- ✅ assets/icon.png (1024x1024)
- ✅ assets/splash.png (1024x1024) 
- ✅ assets/adaptive-icon.png (1024x1024)
- ✅ assets/favicon.png (48x48)

## Current Status
- ✅ SplashScreen.tsx uses Image component with new logo
- ✅ LoginScreen.tsx uses Image component with new logo  
- ✅ All icon files regenerated from new SVG logo
- ✅ app.json configured correctly

## If Still Not Working
1. Check if you're seeing the NATIVE splash (white background) vs React splash (gradient background)
2. The native splash requires a rebuild (see Step 3)
3. Try deleting the app and reinstalling
4. For production builds, use: `eas build --platform android --clear-cache`
