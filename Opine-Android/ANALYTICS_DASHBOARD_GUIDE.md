# 📊 Analytics Dashboard Guide - How to View Your App Analytics

## 🎯 Quick Access

**Dashboard URL**: https://mixpanel.com  
**Login Email**: vijay@convergentview.com  
**Project Name**: Convergent Interviewer App

---

## 📋 Step-by-Step: Viewing Your Analytics

### Step 1: Login to Mixpanel
1. Go to **https://mixpanel.com**
2. Click **"Sign In"** (top right)
3. Enter your email: **vijay@convergentview.com**
4. Enter your password
5. Click **"Sign In"**

### Step 2: Select Your Project
1. After login, you'll see your projects list
2. Click on **"Convergent Interviewer App"** project
3. You'll be taken to the main dashboard

### Step 3: View Real-Time Events
1. In the left sidebar, click **"Insights"**
2. You'll see a real-time event stream
3. Events appear within 1-2 minutes of being triggered in the app

---

## 📊 What Events Are Being Tracked?

### ✅ Currently Tracked Events

#### **1. App Lifecycle Events**
- **App Open** - Every time the app is opened
- **User Login** - When a user logs in
- **User Logout** - When a user logs out

#### **2. Interviewer Dashboard Events**
- **Button Clicked: Start CAPI Interview** - When interviewer clicks "Start CAPI Interview"
- **Button Clicked: Start CATI Interview** - When interviewer clicks "Start CATI Interview"
- **Offline Sync Completed** - When offline interviews are synced (manual or background)

#### **3. Quality Agent Dashboard Events**
- **Button Clicked: Start CAPI QC** - When quality agent clicks "Start CAPI QC"
- **Button Clicked: Start CATI QC** - When quality agent clicks "Start CATI QC"

#### **4. Interview Events** (Automatically tracked)
- **Interview Started** - When an interview begins
- **Interview Completed** - When an interview is completed
- **Interview Abandoned** - When an interview is abandoned

#### **5. Sync Events** (Automatically tracked)
- **Sync Started** - When sync process starts
- **Sync Completed** - When sync finishes

#### **6. Error Events** (Automatically tracked)
- **Error Occurred** - When any error happens in the app

#### **7. API Performance** (Automatically tracked)
- **API Call** - Every API call with performance metrics

---

## 🔍 How to View Specific Metrics

### View Button Clicks

1. Go to **Insights** (left sidebar)
2. Click **"+ New"** button (top right)
3. Select **"Event"**
4. Choose event: **"Button Clicked"**
5. Click **"Run"**
6. You'll see:
   - Total button clicks
   - Breakdown by button name
   - Timeline graph

**To filter by specific button:**
- Click **"Add filter"**
- Select **"button_name"**
- Choose: "Start CAPI Interview", "Start CATI Interview", "Start CAPI QC", or "Start CATI QC"

### View Offline Sync Completions

1. Go to **Insights**
2. Create new event query for **"Offline Sync Completed"**
3. You'll see:
   - Total syncs completed
   - Average synced_count per sync
   - Success rate (synced vs failed)
   - Timeline of syncs

**To see sync statistics:**
- Add breakdown by **"sync_type"** (manual vs background)
- Add breakdown by **"synced_count"** to see distribution

### View User Activity

1. Go to **Insights**
2. Create event query for **"App Open"**
3. Add breakdown by **"Day"** to see daily active users
4. Add breakdown by **"Hour"** to see peak usage times

### View Interview Completion Rate

1. Go to **Funnels** (left sidebar)
2. Click **"+ New Funnel"**
3. Add steps:
   - Step 1: **"Interview Started"**
   - Step 2: **"Interview Completed"**
4. Click **"Run"**
5. You'll see conversion rate (how many started interviews are completed)

### View Error Frequency

1. Go to **Insights**
2. Create event query for **"Error Occurred"**
3. Add breakdown by **"error_type"**
4. You'll see:
   - Most common errors
   - Error frequency over time
   - Error trends

---

## 📈 Creating Custom Reports

### Daily Active Users Report

1. Go to **Insights**
2. Event: **"App Open"**
3. Group by: **"Day"**
4. Time range: **"Last 30 days"**
5. Click **"Run"**

### Interview Mode Usage Report

1. Go to **Insights**
2. Event: **"Interview Started"**
3. Add breakdown by: **"interview_mode"**
4. You'll see CAPI vs CATI usage

### Sync Success Rate Report

1. Go to **Insights**
2. Event: **"Offline Sync Completed"**
3. Add breakdown by: **"sync_type"**
4. View average **"synced_count"** and **"failed_count"**

---

## 🎨 Dashboard Views

### **Insights Tab** (Real-time Events)
- View all events as they happen
- Filter by event type, user, time range
- See event properties and values

### **Flows Tab** (User Journeys)
- Visualize user paths through the app
- See where users drop off
- Understand user behavior patterns

### **Funnels Tab** (Conversion Tracking)
- Track conversion rates
- Example: App Open → Login → Start Interview → Complete Interview
- Identify bottlenecks

### **Retention Tab** (User Retention)
- See how many users return
- Daily/weekly/monthly retention
- Cohort analysis

### **Cohorts Tab** (User Segmentation)
- Group users by behavior
- Example: "Users who completed 5+ interviews"
- Compare cohorts

---

## 📱 Real-Time Monitoring

### Live Event Stream

1. Go to **Insights**
2. Click **"Live View"** (top right)
3. You'll see events appearing in real-time as users interact with the app
4. Events appear within 1-2 minutes

### Event Details

Click on any event to see:
- **Event Name**: What happened
- **Properties**: All data associated with the event
- **User**: Which user triggered it
- **Time**: When it happened
- **Device**: Device information

---

## 🔔 Setting Up Alerts (Optional)

### Alert for High Error Rate

1. Go to **Alerts** (left sidebar)
2. Click **"+ New Alert"**
3. Condition: **"Error Occurred"** count > 10 in 1 hour
4. Notification: Email to vijay@convergentview.com
5. Click **"Save"**

### Alert for Low Sync Success Rate

1. Go to **Alerts**
2. Create alert for **"Offline Sync Completed"**
3. Condition: Average **"failed_count"** > 5 in 1 hour
4. Notification: Email alert

---

## 📊 Key Metrics to Monitor

### Daily Metrics
- **Daily Active Users** (App Open events)
- **Interviews Started** (Interview Started events)
- **Interviews Completed** (Interview Completed events)
- **Sync Success Rate** (Offline Sync Completed events)

### Weekly Metrics
- **User Retention** (Users who return)
- **Interview Completion Rate** (Completed / Started)
- **Error Frequency** (Error Occurred events)
- **Button Click Distribution** (Which buttons are used most)

### Monthly Metrics
- **Total Users** (Unique users)
- **Total Interviews** (Interview Completed count)
- **Total Syncs** (Offline Sync Completed count)
- **API Performance** (Average API call duration)

---

## 🎯 Example Queries

### "How many CAPI interviews started today?"
1. Event: **"Interview Started"**
2. Filter: **interview_mode = "capi"**
3. Time: **Today**

### "How many offline syncs completed this week?"
1. Event: **"Offline Sync Completed"**
2. Time: **Last 7 days**
3. Sum: **synced_count**

### "Which button is clicked most?"
1. Event: **"Button Clicked"**
2. Breakdown by: **button_name**
3. Sort: **Descending**

### "What's the sync success rate?"
1. Event: **"Offline Sync Completed"**
2. Calculate: **Average synced_count / (synced_count + failed_count)**
3. Time: **Last 30 days**

---

## 🚀 Quick Tips

1. **Bookmark Your Dashboard**: Save frequently used reports
2. **Export Data**: Click "Export" to download CSV/Excel
3. **Share Reports**: Click "Share" to send reports to team
4. **Set Time Ranges**: Use date picker to analyze specific periods
5. **Compare Periods**: Use "Compare to" to see trends

---

## ❓ Troubleshooting

### Events Not Appearing?
1. Check if Mixpanel token is configured in `analyticsService.ts`
2. Wait 1-2 minutes (events are batched)
3. Check app console for analytics errors
4. Verify internet connection

### Can't See Specific Event?
1. Check event name spelling (case-sensitive)
2. Use "Live View" to see real-time events
3. Check time range (default is last 7 days)
4. Remove filters to see all events

### Need Help?
- Mixpanel Docs: https://docs.mixpanel.com
- Support: support@mixpanel.com
- Community: https://community.mixpanel.com

---

## ✅ Current Tracking Status

### ✅ Fully Tracked
- ✅ App opens
- ✅ User logins/logouts
- ✅ Start CAPI Interview button
- ✅ Start CATI Interview button
- ✅ Start CAPI QC button
- ✅ Start CATI QC button
- ✅ Offline sync completions
- ✅ Interview lifecycle (started/completed/abandoned)
- ✅ Sync operations
- ✅ Errors
- ✅ API performance

### 📊 Ready to View
Once you complete Mixpanel setup (get token and configure), all events will start appearing in the dashboard within 1-2 minutes!

---

**Status**: ✅ All tracking implemented and ready  
**Next Step**: Complete Mixpanel setup (see ANALYTICS_SETUP.md)



