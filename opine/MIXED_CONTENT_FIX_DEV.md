# Mixed Content Error Fix - Development Codebase

## Problem Identified

The same issue that existed in production was also present in the development codebase:

1. **`toggle-seo.js` script** was hardcoding an HTTP URL:
   ```javascript
   VITE_API_BASE_URL=http://40.81.243.10:5000  ❌ HTTP URL
   ```

2. This would cause **Mixed Content errors** if deployed to production:
   - HTTPS page requesting HTTP resources
   - All API calls blocked by the browser
   - Network errors preventing data loading

## Files Fixed

### 1. `/var/www/opine/frontend/scripts/toggle-seo.js`

**Before:**
```javascript
function updateEnvFile(filePath, enableIndexing) {
  const content = `VITE_API_BASE_URL=http://40.81.243.10:5000
# SEO Control...
VITE_ENABLE_SEO_INDEXING=${enableIndexing}`;
  // ...
}
```

**After:**
```javascript
function updateEnvFile(filePath, enableIndexing) {
  // Read existing .env to preserve VITE_API_BASE_URL if it exists
  // Production mode: Use empty string for relative paths (HTTPS)
  // Development mode: Use localhost or preserve existing value
  let apiBaseUrl;
  if (enableIndexing) {
    apiBaseUrl = '';  // Production: relative paths
  } else {
    apiBaseUrl = existingApiUrl || 'http://localhost:5000';  // Development
  }
  // ...
}
```

**Changes:**
- ✅ No longer hardcodes HTTP URLs
- ✅ Preserves existing `VITE_API_BASE_URL` if set
- ✅ Sets empty string for production (HTTPS)
- ✅ Sets localhost for development (HTTP)

### 2. `/var/www/opine/frontend/src/services/api.js`

**Before:**
```javascript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isProduction ? '' : 'http://localhost:5000');
```

**After:**
```javascript
const isHTTPS = window.location.protocol === 'https:';
const envApiUrl = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL = isHTTPS 
  ? ''  // Always use relative paths on HTTPS - ignore env var to prevent mixed content
  : (envApiUrl !== undefined ? envApiUrl : (isProduction ? '' : 'http://localhost:5000'));
```

**Changes:**
- ✅ Always uses empty string (relative paths) when on HTTPS
- ✅ Ignores `VITE_API_BASE_URL` when on HTTPS to prevent mixed content
- ✅ Properly handles empty string values from .env file

### 3. `/var/www/opine/frontend/src/utils/config.js`

**Before:**
```javascript
export const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
};
```

**After:**
```javascript
export const getApiBaseUrl = () => {
  const isHTTPS = window.location.protocol === 'https:';
  if (isHTTPS) {
    return '';  // Always use relative paths on HTTPS
  }
  const envApiUrl = import.meta.env.VITE_API_BASE_URL;
  return envApiUrl !== undefined ? envApiUrl : (isLocalhost ? 'http://localhost:5000' : '');
};
```

**Changes:**
- ✅ Always uses empty string (relative paths) when on HTTPS
- ✅ Prevents mixed content errors
- ✅ Consistent with `api.js` behavior

## How It Works Now

### Development (HTTP/localhost):
```
Frontend → http://localhost:5000/api/surveys  ✅ Direct connection
```

### Production (HTTPS):
```
Frontend → /api/surveys  ✅ Relative path
         ↓
Nginx → https://convo.convergentview.com/api/surveys  ✅ HTTPS
         ↓
Nginx Proxy → http://localhost:5000/api/surveys  ✅ Internal (OK)
         ↓
Backend ✅
```

## Benefits

1. **No Mixed Content Errors**: HTTPS pages always use relative paths
2. **Flexible Configuration**: Development can use localhost, production uses nginx proxy
3. **Safe Defaults**: Scripts won't accidentally break production
4. **Environment-Aware**: Automatically detects HTTPS and adjusts behavior

## Testing

### Development:
1. Run `npm run dev` in frontend
2. API calls should go to `http://localhost:5000/api/...`
3. No errors should occur

### Production (after deployment):
1. Visit `https://convo.convergentview.com`
2. Open DevTools → Network tab
3. Check API requests:
   - ✅ Should go to: `https://convo.convergentview.com/api/...`
   - ❌ Should NOT go to: `http://40.81.243.10:5000/api/...`
4. No Mixed Content errors should appear

## Summary

✅ **Fixed**: `toggle-seo.js` no longer hardcodes HTTP URLs  
✅ **Fixed**: `api.js` always uses relative paths on HTTPS  
✅ **Fixed**: `config.js` consistent with `api.js` behavior  
✅ **Result**: Safe for both development and production deployment

The codebase is now protected against mixed content errors and will work correctly in both development and production environments.

---

**Last Updated:** December 14, 2025  
**Status:** ✅ Fixed and Ready for Deployment


