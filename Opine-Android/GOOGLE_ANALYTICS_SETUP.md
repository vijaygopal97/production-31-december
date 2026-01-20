# 📊 Google Analytics 4 Setup Guide

## Quick Setup (5 minutes)

### Step 1: Create GA4 Property
1. Go to **https://analytics.google.com**
2. Login with your Google account
3. Click **"Admin"** (gear icon, bottom left)
4. In the **Property** column, click **"Create Property"**
5. Enter property name: **"Convergent Interviewer App"**
6. Select timezone and currency
7. Click **"Next"** → **"Create"**

### Step 2: Get Measurement ID (IMPORTANT: Choose Web, NOT Mobile App!)
1. After creating property, you'll see **"Data Streams"**
2. Click **"Add stream"** → **"Web"** ⚠️ **NOT "iOS app" or "Android app"**
3. Enter website URL: **https://convergentview.com** (or any URL - doesn't matter for our use)
4. Enter stream name: **"React Native App"**
5. Click **"Create stream"**
6. You'll see your **Measurement ID** (format: `G-XXXXXXXXXX`)
7. **Copy this ID** - you'll need it!

**Why Web stream?** We use Measurement Protocol API which works with Web streams. Mobile app streams require Firebase SDK, but we don't need that!

### Step 3: Create API Secret
1. In the stream details page, scroll down to **"Measurement Protocol API secrets"**
2. Click **"Create"**
3. Enter nickname: **"React Native App Secret"**
4. Click **"Create"**
5. **Copy the secret value** (you'll only see it once!)
6. **Save this secret** - you'll need it!

### Step 4: Configure the App
1. Open `/var/www/Opine-Android/src/services/analyticsService.ts`
2. Find line 25:
   ```typescript
   const GA4_MEASUREMENT_ID = 'YOUR_GA4_MEASUREMENT_ID_HERE';
   ```
3. Replace with your Measurement ID:
   ```typescript
   const GA4_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // Your actual ID
   ```
4. Find line 26:
   ```typescript
   const GA4_API_SECRET = 'YOUR_GA4_API_SECRET_HERE';
   ```
5. Replace with your API Secret:
   ```typescript
   const GA4_API_SECRET = 'your_secret_value_here'; // Your actual secret
   ```
6. Save the file

### Step 5: Install Dependencies & Rebuild
```bash
cd /var/www/Opine-Android
npm install
# Then rebuild your app
```

---

## 📊 Viewing Your Analytics

### Access Dashboard
1. Go to **https://analytics.google.com**
2. Select your property: **"Convergent Interviewer App"**
3. Click **"Reports"** (left sidebar)

### View Events
1. Go to **Reports** → **Engagement** → **Events**
2. You'll see all tracked events:
   - `app_open`
   - `login`
   - `logout`
   - `button_clicked`
   - `sync_completed`
   - etc.

### Create Custom Reports
1. Go to **Explore** (left sidebar)
2. Click **"Blank"** or choose a template
3. Add dimensions and metrics
4. Save as custom report

### Real-Time View
1. Go to **Reports** → **Realtime**
2. See events as they happen (within seconds!)

---

## 🎯 What Gets Tracked

### ✅ Currently Tracked Events
- **App Open** - Every time app opens
- **User Login** - When users log in
- **User Logout** - When users log out
- **Button Clicked** - All button clicks (Start Interview, Start QC, etc.)
- **Sync Completed** - Offline sync completions
- **Screen View** - Screen navigation (if you add it)

### 📋 Event Names in GA4
- `app_open` - App opened
- `login` - User logged in
- `logout` - User logged out
- `button_clicked` - Button clicked (with `button_name` parameter)
- `sync_completed` - Sync finished (with `synced_count`, `failed_count`)
- `interview_started` - Interview began
- `interview_completed` - Interview finished
- `interview_abandoned` - Interview abandoned
- `error_occurred` - Error happened
- `api_call` - API call made

---

## 🔍 Useful Reports

### Daily Active Users
1. Go to **Reports** → **Life cycle** → **Acquisition** → **User acquisition**
2. See daily active users

### Button Click Analysis
1. Go to **Reports** → **Engagement** → **Events**
2. Click on `button_clicked` event
3. See breakdown by `button_name` parameter

### Sync Success Rate
1. Go to **Reports** → **Engagement** → **Events**
2. Click on `sync_completed` event
3. See `synced_count` and `failed_count` metrics

### User Journey
1. Go to **Explore** → **Path exploration**
2. See how users navigate through the app

---

## ⚙️ Advanced Configuration

### Custom Dimensions
1. Go to **Admin** → **Custom definitions** → **Custom dimensions**
2. Create dimensions for:
   - `user_type` (Interviewer, Quality Agent, etc.)
   - `survey_id`
   - `interview_mode` (CAPI, CATI)

### Custom Metrics
1. Go to **Admin** → **Custom definitions** → **Custom metrics**
2. Create metrics for:
   - `sync_success_rate`
   - `average_interview_duration`

### Conversions
1. Go to **Admin** → **Events**
2. Mark important events as conversions:
   - `interview_completed`
   - `sync_completed`

---

## 📱 Mobile App Configuration

### Enable App + Web Property
1. In GA4, go to **Admin** → **Property Settings**
2. Enable **"App + Web"** property type
3. This allows better mobile app tracking

### DebugView (Development)
1. In your app, add debug mode (optional):
   ```typescript
   // Add ?debug_mode=1 to API URL for testing
   const GA4_API_URL = `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}&debug_mode=1`;
   ```
2. View events in **Admin** → **DebugView** (real-time)

---

## 🚨 Troubleshooting

### Events Not Appearing?
1. **Wait 24-48 hours** - GA4 can take time to process events
2. Check **Realtime** view - events appear within seconds there
3. Verify Measurement ID and API Secret are correct
4. Check app console for analytics errors
5. Ensure internet connection is working

### Can't Find Measurement ID?
1. Go to **Admin** → **Data Streams**
2. Click on your stream
3. Measurement ID is at the top

### Lost API Secret?
1. Go to **Admin** → **Data Streams** → **[Your Stream]**
2. Scroll to **"Measurement Protocol API secrets"**
3. Create a new secret (old one won't work if lost)

### Need Help?
- GA4 Documentation: https://developers.google.com/analytics/devguides/collection/protocol/ga4
- GA4 Support: https://support.google.com/analytics

---

## ✅ Verification Checklist

- [ ] Created GA4 property
- [ ] Got Measurement ID (G-XXXXXXXXXX)
- [ ] Created API Secret
- [ ] Updated `GA4_MEASUREMENT_ID` in code
- [ ] Updated `GA4_API_SECRET` in code
- [ ] Rebuilt app
- [ ] Tested by opening app
- [ ] Checked Realtime view in GA4 dashboard
- [ ] Events appearing in dashboard

---

**Status**: ✅ Ready to use once configured  
**Free Tier**: ✅ Unlimited events (completely free)  
**Dashboard**: https://analytics.google.com

