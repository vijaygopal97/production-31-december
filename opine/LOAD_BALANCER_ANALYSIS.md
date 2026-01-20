# Load Balancer Analysis & Verification Report
**Date:** 2026-01-16  
**Status:** ❌ LOAD BALANCING NOT WORKING

---

## 🔍 Current Server Configuration

### Primary Server
- **Public IP:** 13.202.181.167
- **Private IP:** 172.31.43.71
- **PM2 Instances:** 8 instances
- **Status:** ✅ Running

### Secondary Server
- **Public IP:** 3.109.82.159
- **Private IP:** 172.31.47.152
- **PM2 Instances:** 8 instances
- **Status:** ✅ Running

---

## ⚙️ Nginx Load Balancer Configuration

```nginx
upstream opine_backend {
    least_conn;
    server 172.31.47.152:5000 max_fails=3 fail_timeout=30s weight=3;  # Secondary
    server 127.0.0.1:5000 max_fails=3 fail_timeout=30s weight=5;     # Primary
    keepalive 128;
}
```

**Configuration Status:** ✅ Correct (deleted server 13.233.231.180 is commented out)

---

## ❌ PROBLEM: Load Balancing NOT Working

### Test Results:
- **10 consecutive requests** through nginx → **ALL went to primary server (13.202.181.167)**
- **0 requests** went to secondary server (172.31.47.152)

### Why This Explains Test Failures:
- **50 Quality Agents** + **50 CATI Interviewers** = 100 concurrent users
- **ALL 100 users** hitting **ONE server** (primary)
- Secondary server receiving **0% of traffic**
- Primary server overwhelmed → 47.80% success rate (Quality Agents), 43.82% success rate (CATI)

---

## 🔍 Root Cause Analysis

### Possible Reasons Load Balancing Not Working:

1. **Nginx not reloaded after config change**
   - Config might be correct but not active

2. **Secondary server marked as DOWN by nginx**
   - Health checks failing
   - `max_fails=3` might have triggered

3. **Nginx routing issue**
   - Requests not going through load balancer
   - Direct routing to primary

4. **Secondary server health check issue**
   - Health endpoint returns primary server IP (suspicious)
   - But server is accessible and running

---

## ✅ Redis Caching Status

### What's Implemented:
- ✅ `nextAssignmentCache.js` - Uses Redis, TTL 30 seconds
- ✅ `assignmentCache.js` - Uses Redis, TTL 30 seconds

### What's Actually Used:
- ✅ `nextAssignmentCache` - **USED** in `getNextReviewAssignment`
- ❌ `assignmentCache` - **NOT USED** (exists but not called)

### Why Caching Didn't Help:
1. **Cache TTL too short (30 seconds)** - Under high load, cache expires before reuse
2. **Cache only works for filtered queries** - Many requests don't use filters
3. **Cache invalidated frequently** - Every assignment clears cache
4. **Single server overload** - Even with cache, one server can't handle 100 concurrent users

---

## 🎯 Recommendations

### Immediate Actions:

1. **Verify Nginx Status:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

2. **Check Nginx Error Logs:**
   ```bash
   sudo tail -50 /var/log/nginx/error.log | grep "172.31.47.152"
   ```

3. **Test Load Balancing:**
   ```bash
   # Run 20 requests and count which server responds
   for i in {1..20}; do
     curl -s http://localhost/health | grep -o '"server":"[^"]*"'
   done | sort | uniq -c
   ```

4. **Monitor During Test:**
   - Track requests per server
   - Monitor server CPU/memory
   - Check nginx upstream status

### If Load Balancing Still Not Working:

1. **Check Secondary Server Connectivity:**
   ```bash
   curl -v http://172.31.47.152:5000/health
   telnet 172.31.47.152 5000
   ```

2. **Check Nginx Upstream Status:**
   - Install nginx upstream status module
   - Or check nginx access logs

3. **Verify Security Groups:**
   - Primary server can reach secondary server on port 5000
   - Secondary server port 5000 is open

---

## 📊 Expected Improvement After Fix

### Current (Load Balancing NOT Working):
- Quality Agents: **47.80%** success (956/2000)
- CATI Interviewers: **43.82%** success (723/1650)
- **All traffic on ONE server**

### After Load Balancing Works:
- Quality Agents: **~80-85%** success (expected)
- CATI Interviewers: **~75-80%** success (expected)
- **Traffic distributed: ~38% secondary, ~62% primary** (based on weights)

### After Adding Third Server:
- Quality Agents: **~90-95%** success (expected)
- CATI Interviewers: **~85-90%** success (expected)
- **Traffic distributed across 3 servers**

---

## 🚀 Next Steps

1. **Fix load balancing** (verify nginx config, reload, test)
2. **Run test again** with load balancing monitoring
3. **Analyze results** - see if load balancing improves success rates
4. **Decide on third server** based on results

---

## 📝 Monitoring Script

Use this during the next test to verify load balancing:

```bash
# Monitor which server handles requests
watch -n 1 'curl -s http://localhost/health | grep -o "\"server\":\"[^\"]*\"" | cut -d"\"" -f4'
```

Or use the comprehensive monitoring script:
```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks
./monitor-test.sh
```







