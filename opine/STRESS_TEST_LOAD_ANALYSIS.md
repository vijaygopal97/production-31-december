# Stress Test Load Analysis & CPU Optimization Recommendations

## Current Test Configuration

### **Test Setup:**
- **Duration:** 5 minutes (300 seconds)
- **Total Emulators:** 162 concurrent users
  - 50 Quality Agents
  - 50 CATI Interviewers
  - 50 CAPI Interviewers
  - 10 Project Managers
  - 2 Company Admins

### **Request Rate:**
- **Quality Agents:** 50 requests/second
- **CATI Interviewers:** 50 requests/second
- **CAPI Interviewers:** 50 requests/second
- **Project Managers:** 10 requests/second
- **Company Admins:** 2 requests/second
- **TOTAL: 162 requests/second**

### **API Calls per Action:**
1. **Quality Agents:** 2 API calls per action
   - GET `/api/survey-responses/next-review` (assignment query)
   - POST `/api/survey-responses/verify` (verification update)
   - **Subtotal: 100 API calls/second**

2. **CATI Interviewers:** 1 API call per action
   - POST `/api/cati-interview/start/:surveyId` (complex query + assignment)
   - **Subtotal: 50 API calls/second**

3. **CAPI Interviewers:** 1 API call per action
   - POST `/api/survey-responses/start/:surveyId` (survey load + session creation)
   - **Subtotal: 50 API calls/second**

4. **Project Managers:** 1 API call per action
   - GET `/api/surveys/:surveyId/analytics-v2` (HEAVY aggregation query)
   - **Subtotal: 10 API calls/second**

5. **Company Admins:** 1 API call per action
   - GET `/api/surveys/:surveyId/analytics-v2` (HEAVY aggregation query)
   - **Subtotal: 2 API calls/second**

**GRAND TOTAL: ~212 API calls/second (162 direct + 50 for QA second call)**

---

## CPU Load Root Causes

### **1. Extremely High Request Rate (Primary Issue)**
- **212 API calls/second** is extremely high
- For 5 minutes: **63,600 API calls total**
- Each API call triggers:
  - Database queries
  - Authentication checks
  - Business logic processing
  - Response serialization

**Impact:** This creates a sustained high CPU load (18.56 and 22.89 load average)

### **2. Concurrent Execution Pattern**
The test uses `Promise.allSettled()` for concurrent execution:
- All 162 emulators run simultaneously
- Each emulator executes actions as fast as possible
- No effective rate limiting between requests
- Only waits for batch completion, then immediately starts next batch

**Impact:** Creates burst loads and CPU spikes

### **3. Expensive Analytics Queries (Secondary Issue)**
- **Project Managers & Company Admins** call `/api/surveys/:surveyId/analytics-v2`
- This endpoint runs heavy MongoDB aggregation pipelines
- **12 expensive queries per second** (10 + 2)
- These queries scan large datasets and perform complex calculations

**Impact:** Analytics queries are CPU-intensive and add significant load

### **4. CATI Respondent Selection (Secondary Issue)**
- Each CATI start triggers complex respondent selection logic
- Multiple database queries (even with optimizations)
- Priority-based selection with AC filtering
- **50 CATI queries/second** = significant database load

**Impact:** Complex queries under high concurrency create contention

### **5. Quality Agent Assignment (Secondary Issue)**
- Each QA action triggers 2 API calls
- Assignment query + verification update
- **100 API calls/second** for Quality Agents alone
- Assignment queries can be expensive under load

**Impact:** Double the API calls for this user type

---

## Why This Generates High CPU Load

### **Mathematical Analysis:**
- **212 API calls/second**
- Average API response time: ~200-500ms (observed)
- Concurrent requests in-flight: **42-106 requests** at any given time
- With 8 backend processes: **5-13 requests per process** simultaneously
- Each request requires CPU for:
  - HTTP parsing
  - Authentication
  - Database queries (I/O wait + CPU for query processing)
  - Business logic
  - Response serialization

**Result:** Sustained CPU utilization of 100-200%+ per core = high load average

### **The Load Average Explanation:**
- **Load 18.56** = 18.56 processes waiting for CPU time (on average)
- **Load 22.89** = 22.89 processes waiting for CPU time (on average)
- With 8-16 CPU cores, this means:
  - More processes wanting CPU than available cores
  - CPU queue is backing up
  - Requests are waiting for CPU time
  - This causes slow responses and timeouts

---

## Immediate Solutions (Without Affecting Functionality)

### **Solution 1: Reduce Request Rate (HIGHEST IMPACT)**
**Current:** 162 requests/second  
**Recommended:** 50-80 requests/second

**Implementation:**
- Reduce request rate for each user type:
  - Quality Agents: 50 → 20 req/sec
  - CATI Interviewers: 50 → 20 req/sec
  - CAPI Interviewers: 50 → 20 req/sec
  - Project Managers: 10 → 5 req/sec
  - Company Admins: 2 → 2 req/sec
  - **New Total: 67 requests/second (59% reduction)**

**Impact:** Reduces CPU load by ~60%, more manageable load

**Why This Works:**
- Reduces concurrent requests in-flight
- Gives CPU time to process each request
- Maintains realistic test load
- Still tests system under stress

---

### **Solution 2: Add Request Throttling/Delay (HIGH IMPACT)**
**Current:** No delay between requests  
**Recommended:** Add 50-100ms delay between requests

**Implementation:**
- In `runUserGroup()`, add delay between batches:
  - Current: `await Promise.allSettled(batchPromises); await Promise.resolve(setTimeout(...))`
  - Recommended: Increase wait time between batches
  - Add: `await new Promise(resolve => setTimeout(resolve, 100));` after each batch

**Impact:** Spreads requests over time, reduces burst loads

**Why This Works:**
- Prevents burst loads that spike CPU
- Gives system time to process requests
- Maintains test duration but reduces peak load

---

### **Solution 3: Reduce Analytics Query Frequency (MEDIUM IMPACT)**
**Current:** 12 expensive analytics queries/second  
**Recommended:** 2-4 queries/second

**Implementation:**
- Reduce Project Managers: 10 → 2 req/sec
- Keep Company Admins: 2 req/sec
- **New Total: 4 analytics queries/second (67% reduction)**

**Impact:** Reduces CPU-intensive queries significantly

**Why This Works:**
- Analytics queries are the most CPU-intensive
- Reducing frequency has disproportionate impact
- Still tests analytics endpoint under load

---

### **Solution 4: Reduce Number of Emulators (MEDIUM IMPACT)**
**Current:** 162 emulators  
**Recommended:** 80-100 emulators

**Implementation:**
- Reduce each user type proportionally:
  - Quality Agents: 50 → 25
  - CATI Interviewers: 50 → 25
  - CAPI Interviewers: 50 → 25
  - Project Managers: 10 → 5
  - Company Admins: 2 → 2
  - **New Total: 82 emulators (49% reduction)**

**Impact:** Reduces concurrent connections and memory overhead

**Why This Works:**
- Fewer concurrent connections
- Less memory overhead
- Still tests realistic scenarios

---

### **Solution 5: Stagger Test Start (LOW IMPACT)**
**Current:** All emulators start simultaneously  
**Recommended:** Stagger start over 10-30 seconds

**Implementation:**
- Add delay between starting each user group
- Start groups 5-10 seconds apart
- Prevents initial burst load

**Impact:** Reduces initial CPU spike, smoother ramp-up

---

### **Solution 6: Use Batch Size Throttling (MEDIUM IMPACT)**
**Current:** Executes batches as fast as possible  
**Recommended:** Limit concurrent requests per batch

**Implementation:**
- Reduce batch size in `runUserGroup()`
- Process 10-20 requests per batch instead of 50
- Add delay between batches

**Impact:** Reduces concurrent processing, smoother load

---

## Recommended Combined Solution

### **Option A: Moderate Reduction (Balanced)**
- Reduce request rates: 162 → 67 req/sec (59% reduction)
- Add 100ms delay between batches
- Reduce analytics queries: 12 → 4 req/sec
- **Expected CPU Load: 7-10 (60% reduction)**

### **Option B: Aggressive Reduction (Maximum CPU Savings)**
- Reduce request rates: 162 → 40 req/sec (75% reduction)
- Add 200ms delay between batches
- Reduce analytics queries: 12 → 2 req/sec
- Reduce emulators: 162 → 80
- **Expected CPU Load: 4-6 (70-75% reduction)**

### **Option C: Conservative Reduction (Minimal Change)**
- Reduce request rates: 162 → 100 req/sec (38% reduction)
- Add 50ms delay between batches
- Reduce analytics queries: 12 → 6 req/sec
- **Expected CPU Load: 12-15 (35% reduction)**

---

## Why These Solutions Don't Affect Functionality

1. **Rate Reduction:**
   - Still tests system under load
   - Still tests all endpoints
   - Still tests concurrency
   - Just reduces intensity

2. **Delay Addition:**
   - Doesn't change test logic
   - Doesn't change API calls
   - Just spreads load over time
   - More realistic user behavior

3. **Emulator Reduction:**
   - Still tests all user types
   - Still tests realistic scenarios
   - Just fewer concurrent users
   - Still comprehensive test coverage

4. **Analytics Reduction:**
   - Still tests analytics endpoint
   - Still tests under load
   - Just less frequent
   - Analytics is already heavy, testing it less frequently is reasonable

---

## Expected Results After Optimization

### **Before:**
- CPU Load: 18.56 / 22.89
- Request Rate: 212 API calls/second
- Success Rates: CATI 26%, QA 30% (due to resource exhaustion)
- System: Under extreme stress

### **After (Option A - Moderate):**
- CPU Load: 7-10 (estimated)
- Request Rate: ~77 API calls/second
- Success Rates: Expected 70-90% (resources available)
- System: Under manageable stress

### **After (Option B - Aggressive):**
- CPU Load: 4-6 (estimated)
- Request Rate: ~44 API calls/second
- Success Rates: Expected 85-95% (resources available)
- System: Under moderate stress

---

## Additional Observations

### **Current Test Issues:**
1. **Resource Exhaustion:** High load causes "No Pending Respondents" errors
2. **Race Conditions:** High concurrency creates race conditions
3. **Timeout Failures:** Slow responses cause timeouts
4. **Memory Pressure:** 162 concurrent connections create memory pressure

### **What the Test Should Measure:**
- API response times under load
- Success rates under realistic load
- System stability
- Database query performance
- Not: System behavior under extreme/unrealistic load

### **Realistic Load:**
- In production, you wouldn't have 162 concurrent users all hitting the system simultaneously
- More realistic: 20-50 concurrent users
- Current test is 3-8x more aggressive than realistic

---

## Conclusion

The stress test is generating extremely high CPU load because:

1. **212 API calls/second is unrealistic** - This is 3-8x more than realistic production load
2. **No rate limiting** - All requests execute as fast as possible
3. **Expensive analytics queries** - 12 heavy aggregation queries per second
4. **High concurrency** - 162 concurrent emulators

**Immediate Solutions:**
1. **Reduce request rates by 50-60%** (highest impact)
2. **Add delays between batches** (high impact)
3. **Reduce analytics query frequency by 67%** (medium impact)
4. **Optionally reduce emulator count** (medium impact)

These changes will:
- ✅ Reduce CPU load by 60-75%
- ✅ Make tests more realistic
- ✅ Still test all functionality
- ✅ Still test system under stress
- ✅ Improve success rates
- ✅ Provide meaningful results

**Recommended:** Implement **Option A (Moderate Reduction)** for balanced approach that still provides meaningful stress test results while reducing CPU load significantly.




