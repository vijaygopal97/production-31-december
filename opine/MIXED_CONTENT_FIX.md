# 🔧 Mixed Content Error Fix

## 🚨 **Problem Identified**

Your site was experiencing **Mixed Content errors** because:

1. **Site is served over HTTPS**: `https://convo.convergentview.com`
2. **API calls were going to HTTP**: `http://40.81.243.10:5000/api/...`
3. **Browsers block mixed content**: HTTPS pages cannot request HTTP resources

**Error Message:**
```
Mixed Content: The page at 'https://convo.convergentview.com/company/surveys' 
was loaded over HTTPS, but requested an insecure XMLHttpRequest endpoint 
'http://40.81.243.10:5000/api/surveys?limit=1000'. 
This request has been blocked; the content must be served over HTTPS.
```

---

## 🔍 **Root Cause**

The `toggle-seo.js` script was hardcoding an old HTTP URL:
```javascript
VITE_API_BASE_URL=http://40.81.243.10:5000  // ❌ HTTP URL, wrong IP
```

This caused:
- ❌ All API calls to use HTTP instead of HTTPS
- ❌ Mixed Content errors blocking requests
- ❌ Network errors preventing data loading

---

## ✅ **Solution Applied**

### **1. Fixed `.env` File**
Changed from:
```env
VITE_API_BASE_URL=http://40.81.243.10:5000  # ❌ Wrong
```

To:
```env
VITE_API_BASE_URL=  # ✅ Empty = uses relative paths
```

### **2. Updated `toggle-seo.js` Script**
Fixed the script to not hardcode the HTTP URL:
- ✅ Now sets `VITE_API_BASE_URL` to empty string
- ✅ Uses relative paths that go through nginx proxy
- ✅ Works correctly with HTTPS

### **3. How It Works Now**

**Before (Broken):**
```
Frontend → http://40.81.243.10:5000/api/surveys  ❌ HTTP, blocked
```

**After (Fixed):**
```
Frontend → /api/surveys  ✅ Relative path
         ↓
Nginx → https://convo.convergentview.com/api/surveys  ✅ HTTPS
         ↓
Nginx Proxy → http://localhost:5000/api/surveys  ✅ Internal HTTP (OK)
         ↓
Backend → Processes request ✅
```

**Why This Works:**
- ✅ Frontend uses relative paths (`/api/...`)
- ✅ Browser sees HTTPS requests (same origin)
- ✅ Nginx proxies to backend internally (HTTP is OK internally)
- ✅ No Mixed Content errors

---

## 📋 **What Was Changed**

### **Files Modified:**

1. **`/var/www/opine/frontend/.env`**
   - Removed hardcoded HTTP URL
   - Set `VITE_API_BASE_URL` to empty string
   - Added helpful comments

2. **`/var/www/opine/frontend/scripts/toggle-seo.js`**
   - Updated `updateEnvFile()` function
   - No longer hardcodes HTTP URL
   - Sets `VITE_API_BASE_URL` to empty for production

3. **`/var/www/opine/frontend/dist/`** (Rebuilt)
   - New production build with correct API configuration
   - All API calls now use relative paths

---

## ✅ **Verification**

### **Check Current Configuration:**
```bash
cat /var/www/opine/frontend/.env
# Should show: VITE_API_BASE_URL= (empty)
```

### **Test the Fix:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Visit: `https://convo.convergentview.com/company/surveys`
4. Check API requests:
   - ✅ Should go to: `https://convo.convergentview.com/api/...`
   - ❌ Should NOT go to: `http://40.81.243.10:5000/api/...`
5. No Mixed Content errors should appear

---

## 🎯 **How Your API Configuration Works**

### **Production Setup (Current):**

```
┌─────────────────────────────────────────┐
│  Browser (HTTPS)                        │
│  https://convo.convergentview.com       │
└──────────────┬──────────────────────────┘
               │ HTTPS Request
               │ /api/surveys
               ↓
┌─────────────────────────────────────────┐
│  Nginx (HTTPS)                          │
│  Listens on: 443                        │
│  Serves: /var/www/opine/frontend/dist  │
│  Proxies: /api → localhost:5000        │
└──────────────┬──────────────────────────┘
               │ Internal HTTP (OK)
               │ localhost:5000/api/surveys
               ↓
┌─────────────────────────────────────────┐
│  Backend (HTTP)                         │
│  Node.js on: localhost:5000             │
│  PM2 Process: opine-backend            │
└─────────────────────────────────────────┘
```

**Key Points:**
- ✅ Frontend uses relative paths (`/api/...`)
- ✅ Browser sees HTTPS (same origin, no Mixed Content)
- ✅ Nginx handles HTTPS termination
- ✅ Internal communication uses HTTP (acceptable)
- ✅ No security issues

---

## 🔄 **For Future Reference**

### **If You Need to Change API URL:**

**For Production (HTTPS):**
```env
# Leave empty for relative paths through nginx
VITE_API_BASE_URL=
```

**For Development (Local):**
```env
# Use localhost for direct backend access
VITE_API_BASE_URL=http://localhost:5000
```

**Never use:**
- ❌ HTTP URLs in production (causes Mixed Content)
- ❌ IP addresses directly (use domain)
- ❌ Hardcoded URLs in scripts

---

## 📝 **Code Logic**

Your `api.js` already has the correct logic:

```javascript
const isProduction = window.location.protocol === 'https:' || 
                     window.location.hostname !== 'localhost';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
                     (isProduction ? '' : 'http://localhost:5000');
```

**How it works:**
- If `VITE_API_BASE_URL` is set → use it
- If empty and production → use empty string (relative paths)
- If empty and development → use `http://localhost:5000`

**This is correct!** ✅

---

## ✅ **Status: FIXED**

- ✅ `.env` file updated
- ✅ `toggle-seo.js` script fixed
- ✅ Production build rebuilt
- ✅ Mixed Content errors resolved
- ✅ API calls now use HTTPS through nginx proxy

**Your site should now work correctly!** 🎉

---

**Fixed:** December 14, 2025
**Issue:** Mixed Content errors blocking API requests
**Solution:** Use relative paths instead of hardcoded HTTP URLs







