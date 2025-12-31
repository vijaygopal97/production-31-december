# SEO Control System for Convergent

## Overview
This system allows you to easily control whether search engines can index your website during development and production phases.

## 🚫 **Current Status: DEVELOPMENT MODE (No Indexing)**

Your website is currently configured to **BLOCK** all search engines from indexing your content.

## 🎛️ **How to Control SEO Indexing**

### **Method 1: Using NPM Scripts (Recommended)**

```bash
# Switch to Development Mode (No indexing)
npm run seo:dev

# Switch to Production Mode (Indexing enabled)
npm run seo:prod

# Check current status
npm run seo:status
```

### **Method 2: Using the Script Directly**

```bash
# Development mode
node scripts/toggle-seo.js dev

# Production mode
node scripts/toggle-seo.js prod

# Check status
node scripts/toggle-seo.js status
```

### **Method 3: Manual Environment Variable**

Edit `/var/www/opine/frontend/.env`:
```env
# For development (no indexing)
VITE_ENABLE_SEO_INDEXING=false

# For production (indexing enabled)
VITE_ENABLE_SEO_INDEXING=true
```

## 🔧 **What the System Controls**

### **Development Mode (VITE_ENABLE_SEO_INDEXING=false)**
- ✅ **Meta Robots**: `noindex, nofollow` on all pages
- ✅ **Robots.txt**: Blocks all search engines (`Disallow: /`)
- ✅ **Structured Data**: Still generated but with noindex
- ✅ **Social Media**: Open Graph tags still work for sharing

### **Production Mode (VITE_ENABLE_SEO_INDEXING=true)**
- ✅ **Meta Robots**: `index, follow` on all pages
- ✅ **Robots.txt**: Allows all search engines (`Allow: /`)
- ✅ **Structured Data**: Full SEO optimization
- ✅ **Social Media**: Full Open Graph optimization

## 📁 **Files Modified by the System**

### **Environment Files**
- `.env` - Development environment variables
- `.env.production` - Production environment variables

### **SEO Files**
- `src/config/seo.js` - SEO configuration with environment control
- `src/components/SEO.jsx` - SEO component with robots meta control

### **Robots Files**
- `public/robots.txt` - Active robots.txt file
- `public/robots.production.txt` - Production robots.txt template

## 🚀 **Quick Commands Reference**

| Command | Purpose | Result |
|---------|---------|---------|
| `npm run seo:dev` | Enable development mode | 🔴 No indexing |
| `npm run seo:prod` | Enable production mode | 🟢 Full indexing |
| `npm run seo:status` | Check current status | 📊 Show current mode |

## 🔍 **How to Verify It's Working**

### **1. Check Meta Tags**
Open your website in browser → Right-click → "View Page Source" → Look for:
```html
<!-- Development Mode -->
<meta name="robots" content="noindex, nofollow" />

<!-- Production Mode -->
<meta name="robots" content="index, follow" />
```

### **2. Check Robots.txt**
Visit: `http://40.81.243.10:3000/robots.txt`

**Development Mode:**
```
User-agent: *
Disallow: /
```

**Production Mode:**
```
User-agent: *
Allow: /
```

### **3. Check Environment Variable**
```bash
npm run seo:status
```

## 🎯 **Best Practices**

### **During Development**
- ✅ Always keep `VITE_ENABLE_SEO_INDEXING=false`
- ✅ Use `npm run seo:dev` to ensure no indexing
- ✅ Test your SEO system without affecting search engines

### **Before Production**
- ✅ Switch to `VITE_ENABLE_SEO_INDEXING=true`
- ✅ Use `npm run seo:prod` to enable indexing
- ✅ Verify robots.txt allows indexing
- ✅ Test meta tags show `index, follow`

### **After Production Launch**
- ✅ Monitor search engine indexing
- ✅ Use Google Search Console to verify indexing
- ✅ Check that your site appears in search results

## 🛠️ **Troubleshooting**

### **Problem: Search engines still indexing during development**
**Solution:**
1. Run `npm run seo:dev`
2. Check `http://40.81.243.10:3000/robots.txt` shows `Disallow: /`
3. Verify meta tags show `noindex, nofollow`

### **Problem: Site not appearing in search results after production**
**Solution:**
1. Run `npm run seo:prod`
2. Check `http://40.81.243.10:3000/robots.txt` shows `Allow: /`
3. Verify meta tags show `index, follow`
4. Submit sitemap to Google Search Console

### **Problem: Environment variable not updating**
**Solution:**
1. Restart your development server
2. Clear browser cache
3. Check `.env` file has correct value

## 📊 **Current Configuration**

- **Environment**: Development
- **Indexing**: Disabled
- **Robots.txt**: Blocks all crawlers
- **Meta Robots**: noindex, nofollow

## 🎉 **Ready for Production?**

When you're ready to launch:

1. **Switch to production mode:**
   ```bash
   npm run seo:prod
   ```

2. **Verify the changes:**
   ```bash
   npm run seo:status
   ```

3. **Test your site:**
   - Visit `http://40.81.243.10:3000/robots.txt`
   - Check meta tags in browser dev tools
   - Verify social media sharing works

4. **Monitor indexing:**
   - Set up Google Search Console
   - Submit your sitemap
   - Monitor search engine crawling

---

**Remember**: This system gives you complete control over when search engines can index your site. Keep it in development mode until you're ready to launch! 🚀
