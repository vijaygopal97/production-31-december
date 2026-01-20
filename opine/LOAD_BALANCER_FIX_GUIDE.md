# Load Balancer Fix Guide

## 🔍 Problem Summary

### Load Balancing NOT Working
- **Symptom:** All requests go to primary server (13.202.181.167)
- **Secondary server (3.109.82.159)** receiving 0% of traffic
- **Test:** 20 requests → 100% to primary, 0% to secondary

### assignmentCache.js NOT Working
- **Symptom:** File exists but never called in code
- **Reason:** Never integrated into `getNextReviewAssignment` function
- **What's actually used:** `nextAssignmentCache.js` (different file)

---

## 🛠️ How to Fix Load Balancing

### Step 1: Check Nginx Status
```bash
sudo nginx -t
sudo systemctl status nginx
```

### Step 2: Check Secondary Server Connectivity
```bash
# Test if secondary server is reachable
curl -v http://172.31.47.152:5000/health

# Test from primary to secondary
telnet 172.31.47.152 5000
```

### Step 3: Check Nginx Error Logs
```bash
sudo tail -50 /var/log/nginx/error.log | grep "172.31.47.152"
```

### Step 4: Reload Nginx (if config changed)
```bash
sudo nginx -t  # Test config first
sudo systemctl reload nginx  # Reload without downtime
```

### Step 5: Verify Load Balancing
```bash
# Run 20 requests and count distribution
for i in {1..20}; do
  curl -s http://localhost/health | grep -o '"server":"[^"]*"' | cut -d'"' -f4
done | sort | uniq -c
```

**Expected Result:**
- Primary: ~12 requests (62.5% - weight=5)
- Secondary: ~8 requests (37.5% - weight=3)

---

## 🔧 Why Load Balancing Might Not Work

### Reason 1: Secondary Server Marked as DOWN
- **Cause:** Failed health checks (max_fails=3)
- **Fix:** Check nginx error logs, verify secondary server is healthy
- **Check:** `sudo tail -50 /var/log/nginx/error.log | grep "172.31.47.152"`

### Reason 2: Nginx Not Reloaded
- **Cause:** Config changed but nginx not reloaded
- **Fix:** `sudo nginx -t && sudo systemctl reload nginx`

### Reason 3: Connection Issues
- **Cause:** Primary server can't reach secondary on port 5000
- **Fix:** Check security groups, firewall rules
- **Test:** `curl http://172.31.47.152:5000/health` from primary server

### Reason 4: Secondary Server Not Running
- **Cause:** PM2 instances down on secondary
- **Fix:** SSH to secondary and check `pm2 list`

---

## 📝 assignmentCache.js Issue

### Why It's Not Working:
1. **File exists:** `/var/www/opine/backend/utils/assignmentCache.js`
2. **But never imported:** Not in `surveyResponseController.js`
3. **Never called:** Not used in `getNextReviewAssignment` function

### What's Actually Used:
- `surveyAssignmentCache` - Caches survey assignments (line 3162)
- `nextAssignmentCache` - Caches available responses (line 3731)

### To Fix assignmentCache.js:
1. Import it in `surveyResponseController.js`
2. Call it in `getNextReviewAssignment` function
3. Replace or supplement `nextAssignmentCache` with `assignmentCache`

**BUT:** This won't help much if load balancing isn't working, because:
- Single server overload = cache doesn't help
- Cache TTL too short (30 seconds)
- Cache cleared on every assignment

---

## ✅ Verification Steps

### After Fixing Load Balancing:

1. **Run Load Balancing Test:**
   ```bash
   for i in {1..20}; do
     curl -s http://localhost/health | grep -o '"server":"[^"]*"' | cut -d'"' -f4
   done | sort | uniq -c
   ```

2. **Run Stress Test:**
   ```bash
   cd /var/www/opine/stress-tests/situation-1-quality-checks/scripts
   node comprehensive-5min-stress-test-updated.js
   ```

3. **Monitor Load Balancing:**
   ```bash
   cd /var/www/opine/stress-tests/situation-1-quality-checks/scripts
   ./monitor-load-balancing.sh
   ```

4. **Check Results:**
   - Quality Agents success rate should improve from 47.80% to ~80-85%
   - CATI Interviewers success rate should improve from 43.82% to ~75-80%
   - Traffic should be distributed: ~62% primary, ~38% secondary

---

## 🎯 Expected Results After Fix

### Load Balancing Working:
- **Traffic Distribution:** ~62% primary, ~38% secondary
- **Quality Agents:** 47.80% → ~80-85% success
- **CATI Interviewers:** 43.82% → ~75-80% success

### After Adding 3rd Server:
- **Traffic Distribution:** ~40% primary, ~30% secondary, ~30% third
- **Quality Agents:** ~90-95% success
- **CATI Interviewers:** ~85-90% success







