# 📊 Analytics Setup Guide - Mixpanel Integration

## Overview
This app uses **Mixpanel** for analytics tracking. All data is stored in Mixpanel's cloud (separate from your backend).

## Why Mixpanel?
- ✅ **Free Tier**: 20 million events/month (more than enough for most apps)
- ✅ **Cloud-Based**: Data stored separately, no backend involvement
- ✅ **Custom Email**: Sign up with any email (vijay@convergentview.com)
- ✅ **Professional**: Used by top companies like Uber, Twitter, Airbnb
- ✅ **Easy Integration**: Works perfectly with React Native/Expo
- ✅ **Real-time Dashboard**: View analytics in real-time web dashboard

## Setup Instructions

### Step 1: Create Mixpanel Account
1. Go to https://mixpanel.com
2. Click "Sign Up" (top right)
3. Enter your email: **vijay@convergentview.com**
4. Create a password
5. Verify your email

### Step 2: Create a Project
1. After login, click "Create Project"
2. Project Name: **Convergent Interviewer App**
3. Timezone: Select your timezone
4. Click "Create"

### Step 3: Get Your Project Token
1. Go to **Settings** (gear icon, top right)
2. Click **Project Settings**
3. Find **Project Token** (looks like: `abc123def456...`)
4. Copy the token

### Step 4: Configure the App
1. Open `/var/www/Opine-Android/src/services/analyticsService.ts`
2. Find line 18: `const MIXPANEL_TOKEN = 'YOUR_MIXPANEL_TOKEN_HERE';`
3. Replace `YOUR_MIXPANEL_TOKEN_HERE` with your actual token from Step 3
4. Save the file

### Step 5: Install Dependencies
```bash
cd /var/www/Opine-Android
npm install
```

### Step 6: Rebuild the App
```bash
# For development
npm start

# For production build
npm run build:apk:production
```

## What Gets Tracked?

### Automatic Tracking
- ✅ App opens
- ✅ Screen views (every screen navigation)
- ✅ User logins/logouts
- ✅ Interview starts/completions/abandonments
- ✅ Sync operations
- ✅ Errors
- ✅ API calls (performance monitoring)

### User Properties Tracked
- User ID
- User Type (Interviewer, Quality Agent, etc.)
- Last login time
- Total interviews completed
- And more...

## Viewing Analytics

### Access Dashboard
1. Go to https://mixpanel.com
2. Login with vijay@convergentview.com
3. Select your project: **Convergent Interviewer App**

### Key Reports Available
- **Insights**: Real-time event tracking
- **Flows**: User journey visualization
- **Funnels**: Conversion tracking
- **Retention**: User retention analysis
- **Cohorts**: User segmentation

## Example Queries

### View Daily Active Users
1. Go to **Insights**
2. Select event: **App Open**
3. Group by: **Day**
4. View chart

### Track Interview Completion Rate
1. Go to **Funnels**
2. Create funnel:
   - Step 1: Interview Started
   - Step 2: Interview Completed
3. View conversion rate

### Monitor Errors
1. Go to **Insights**
2. Select event: **Error Occurred**
3. Group by: **error_type**
4. View error breakdown

## Privacy & Data

### What Data is Collected?
- User actions (screen views, button clicks)
- App events (interviews, syncs, errors)
- User properties (user type, login time)
- Device info (automatically collected by Mixpanel)

### What Data is NOT Collected?
- Personal information (names, phone numbers)
- Interview responses (survey data)
- Location data (unless explicitly tracked)
- Audio recordings

### Data Storage
- All data stored in Mixpanel cloud (US/EU servers)
- Data retention: 12 months (free tier)
- GDPR compliant

## Troubleshooting

### Analytics Not Working?
1. Check if token is configured correctly
2. Check console logs for errors
3. Verify internet connection
4. Check Mixpanel dashboard for events (may take 1-2 minutes to appear)

### Events Not Appearing?
- Events are batched and sent every 60 seconds
- Use `analyticsService.flush()` to send immediately (for testing)
- Check Mixpanel dashboard after 1-2 minutes

### Need Help?
- Mixpanel Docs: https://docs.mixpanel.com
- React Native Guide: https://developer.mixpanel.com/docs/react-native

## Cost
- **Free Tier**: 20 million events/month (FREE forever)
- **Paid Plans**: Start at $25/month (only if you exceed free tier)

For most apps, the free tier is more than enough!

---

**Status**: ✅ Analytics service integrated and ready to use
**Next Step**: Complete Step 1-4 above to activate analytics



