# 🔍 LOAD BALANCER EXPLANATION & MONGODB CONNECTION POOLING

## 📊 HOW THE LOAD BALANCER WORKS

### Current Architecture

```
                    Internet
                       ↓
            ┌──────────────────────┐
            │   Nginx Load         │
            │   Balancer           │
            │   (Current Server)   │
            └──────────────────────┘
                       ↓
        ┌──────────────┼──────────────┐
        ↓              ↓               ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Server 1    │ │  Server 2    │ │  Server 3    │
│ (Current)    │ │ (c6i.4xlarge)│ │ (t2.xlarge)  │
│              │ │              │ │              │
│ Port: 5000   │ │ Port: 5000   │ │ Port: 5000   │
│ Weight: 1    │ │ Weight: 2    │ │ Weight: 1    │
│              │ │              │ │              │
│ PM2: 5       │ │ PM2: 5       │ │ PM2: 5       │
│ instances    │ │ instances    │ │ instances    │
└──────────────┘ └──────────────┘ └──────────────┘
        ↓              ↓               ↓
        └──────────────┼──────────────┘
                       ↓
            ┌──────────────────────┐
            │   MongoDB            │
            │   (Same Instance)    │
            │   Connection Pool: 50 │
            └──────────────────────┘
```

### How Traffic Flows

1. **User Request Arrives:**
   - User makes request to `https://convo.convergentview.com/api/surveys`
   - Request hits Nginx Load Balancer (port 80/443)

2. **Load Balancer Decision:**
   - Nginx uses `least_conn` algorithm
   - Checks active connections on each server
   - Routes to server with **fewest active connections**
   - Considers weight (Server 2 gets 2x preference)

3. **Backend Processing:**
   - Selected server (e.g., Server 2) receives request
   - Node.js/Express processes the request
   - Makes database query using MongoDB connection from pool
   - Returns response

4. **Response Return:**
   - Response goes back through load balancer
   - Load balancer returns to user

### Load Balancing Algorithm: `least_conn`

**How it works:**
- Nginx tracks active connections to each backend server
- When new request arrives, it checks:
  - Server 1: 5 active connections
  - Server 2: 3 active connections ← **Routes here** (fewer connections)
  - Server 3: 8 active connections

**With Weights:**
- Server 1 (weight: 1): Normal preference
- Server 2 (weight: 2): **2x preference** (gets more traffic)
- Server 3 (weight: 1): Normal preference

**Example:**
- 100 requests arrive
- Server 1 gets: ~25 requests (weight 1)
- Server 2 gets: ~50 requests (weight 2) ← More powerful server
- Server 3 gets: ~25 requests (weight 1)

---

## 🔌 MONGODB CONNECTION POOLING - THE CRITICAL ISSUE

### Current Setup

**Each Server Has Its Own Connection Pool:**
- **Current Server:** maxPoolSize: 50 connections
- **Server 1 (c6i.4xlarge):** maxPoolSize: 50 connections
- **Server 2 (t2.xlarge):** maxPoolSize: 50 connections (when added)

**Total MongoDB Connections:**
- **Current:** 50 connections
- **With 2 servers:** 50 + 50 = **100 connections**
- **With 3 servers:** 50 + 50 + 50 = **150 connections**

### ⚠️ THE BOTTLENECK PROBLEM

**YES, MongoDB WILL STILL BE A BOTTLENECK!**

Here's why:

1. **Connection Pool Exhaustion:**
   - Each server creates its own pool of 50 connections
   - With 3 servers: 150 total connections to MongoDB
   - MongoDB has connection limits (default: 100,000 but practical limit is much lower)
   - **Problem:** If all servers are busy, you could exhaust MongoDB connections

2. **MongoDB CPU Usage:**
   - **Current:** MongoDB at 100% CPU (single bottleneck)
   - **With Load Balancing:** Still 100% CPU, but now serving 2-3x more requests
   - **Result:** MongoDB becomes even MORE of a bottleneck
   - Each server waits for MongoDB, creating a queue

3. **The Real Issue:**
   ```
   User Request → Load Balancer → Server 1
                                      ↓
                                 MongoDB Query
                                      ↓
                                 MongoDB (100% CPU, slow)
                                      ↓
                                 Response (delayed)
   ```
   
   Even though you have 3 servers, they all wait for the same slow MongoDB!

### What Happens Under Load

**Scenario: 100 Concurrent CATI Users**

1. **Load Balancer:**
   - Distributes: 33 users → Server 1, 50 users → Server 2, 17 users → Server 3
   - ✅ **Works perfectly!**

2. **Each Server:**
   - Server 1: 33 requests, each needs MongoDB query
   - Server 2: 50 requests, each needs MongoDB query
   - Server 3: 17 requests, each needs MongoDB query
   - ✅ **Servers handle load well!**

3. **MongoDB:**
   - Receives: 100 concurrent queries (33 + 50 + 17)
   - **CPU:** Still 100% (or worse!)
   - **Response Time:** Slow (2-5 seconds per query)
   - **Result:** All 3 servers wait for MongoDB
   - ❌ **BOTTLENECK!**

---

## 💡 SOLUTIONS TO MONGODB BOTTLENECK

### Option 1: Increase MongoDB Connection Pool (Quick Fix)

**Current:**
```javascript
maxPoolSize: 50  // Per server
```

**Recommended:**
```javascript
maxPoolSize: 150  // Per server (if MongoDB can handle it)
```

**But this doesn't solve the CPU problem!**

### Option 2: MongoDB Read Replicas (Best Solution)

**Architecture:**
```
                    Internet
                       ↓
            ┌──────────────────────┐
            │   Nginx Load         │
            │   Balancer           │
            └──────────────────────┘
                       ↓
        ┌──────────────┼──────────────┐
        ↓              ↓               ↓
   Server 1       Server 2       Server 3
        ↓              ↓               ↓
        └──────────────┼──────────────┘
                       ↓
        ┌──────────────┼──────────────┐
        ↓              ↓               ↓
   MongoDB        MongoDB         MongoDB
   Primary        Read Replica    Read Replica
   (Writes)       (Reads)         (Reads)
```

**How it works:**
- **Primary MongoDB:** Handles all writes (create, update, delete)
- **Read Replicas:** Handle all reads (queries, reports)
- **Load Distribution:** Read queries distributed across replicas
- **Result:** 3x read capacity, primary only handles writes

**Benefits:**
- ✅ Read queries distributed (no single bottleneck)
- ✅ Write queries still go to primary (data consistency)
- ✅ Can scale reads independently
- ✅ High availability (if primary fails, replica can become primary)

**Implementation:**
- Set up MongoDB Replica Set (3+ nodes)
- Configure application to:
  - Write to: Primary
  - Read from: Replicas (round-robin or nearest)

### Option 3: Redis Caching Layer (Reduces MongoDB Load)

**Architecture:**
```
User Request → Server → Redis Cache (check first)
                           ↓ (if not found)
                      MongoDB (query)
                           ↓
                      Redis Cache (store result)
                           ↓
                      Return to user
```

**What to Cache:**
- Survey definitions (rarely change)
- User sessions
- Frequently accessed data
- Statistics (with TTL)

**Benefits:**
- ✅ 60-80% reduction in MongoDB queries
- ✅ Faster response times (Redis is in-memory)
- ✅ Reduces MongoDB CPU usage significantly

**Example:**
- **Before:** 100 requests → 100 MongoDB queries
- **After:** 100 requests → 20 MongoDB queries + 80 Redis hits
- **Result:** MongoDB CPU drops from 100% to ~20-30%

### Option 4: Optimize Database Queries (Reduce Load)

**Current Problems:**
- N+1 queries (multiple queries instead of one)
- Missing indexes (full table scans)
- Large result sets (loading too much data)

**Solutions:**
- Add indexes on frequently queried fields
- Use `.lean()` to reduce memory usage
- Implement pagination
- Use aggregation pipelines efficiently

**Expected Impact:**
- ✅ 50-70% reduction in query time
- ✅ Lower CPU usage per query
- ✅ Can handle 2-3x more queries with same resources

---

## 📊 CONNECTION POOL CALCULATION

### Current Setup (Single Server)
- **maxPoolSize:** 50
- **Active Connections:** ~30-40 (under load)
- **MongoDB Total Connections:** 50

### With Load Balancing (3 Servers)
- **Each Server maxPoolSize:** 50
- **Total Possible Connections:** 150 (50 × 3)
- **Typical Active Connections:** 90-120 (30-40 × 3)
- **MongoDB Connection Limit:** Usually 1000+ (but CPU is the limit)

### Recommended Setup (3 Servers + Optimizations)
- **Each Server maxPoolSize:** 100-150
- **Total Possible Connections:** 300-450
- **With Redis Caching:** Actual connections: 50-100 (80% cache hits)
- **With Read Replicas:** Connections distributed across 3 MongoDB nodes

---

## 🎯 RECOMMENDED APPROACH

### Phase 1: Immediate (Do Now)
1. ✅ **Load Balancing:** Already done!
2. **Increase Connection Pool:** 50 → 100 per server
3. **Add Database Indexes:** Critical queries
4. **Use `.lean()`:** All read queries

**Expected Result:**
- Can handle 2-3x more users
- MongoDB CPU: 100% → 80-90% (still high but manageable)

### Phase 2: Short-term (Next Week)
1. **Implement Redis Caching:**
   - Cache survey data
   - Cache user sessions
   - Cache statistics

**Expected Result:**
- MongoDB queries: 100 → 20-30 (70-80% reduction)
- MongoDB CPU: 80-90% → 30-40%
- Response time: 2-5s → 0.5-1s

### Phase 3: Long-term (Next Month)
1. **MongoDB Read Replicas:**
   - Set up replica set
   - Configure read preferences
   - Distribute read load

**Expected Result:**
- Read capacity: 3x increase
- MongoDB CPU per node: 30-40% → 10-20%
- Can handle 500+ concurrent users

---

## ⚠️ CRITICAL WARNINGS

### 1. Connection Pool Exhaustion
**Problem:** If you set maxPoolSize too high, you can exhaust MongoDB connections.

**Solution:** 
- Monitor active connections: `db.serverStatus().connections`
- Set reasonable limits: 100-150 per server
- Use connection pooling monitoring

### 2. MongoDB CPU Bottleneck
**Problem:** Even with load balancing, MongoDB CPU is still 100%.

**Solution:**
- **Immediate:** Optimize queries, add indexes
- **Short-term:** Add Redis caching
- **Long-term:** MongoDB read replicas

### 3. Write Contention
**Problem:** All writes go to primary MongoDB (single point of failure).

**Solution:**
- MongoDB replica set (automatic failover)
- Write concern settings (ensure data durability)
- Regular backups

---

## 📈 EXPECTED PERFORMANCE

### Current (Single Server)
- **Concurrent Users:** 30-50
- **MongoDB CPU:** 100%
- **Response Time (P95):** 18.8 seconds
- **Connection Pool:** 50 (single server)

### After Load Balancing (3 Servers, No Optimizations)
- **Concurrent Users:** 100-150
- **MongoDB CPU:** 100% (still bottleneck!)
- **Response Time (P95):** 5-10 seconds (better but still slow)
- **Connection Pool:** 150 total (50 × 3 servers)
- **Problem:** All servers wait for MongoDB

### After Load Balancing + Redis Caching
- **Concurrent Users:** 200-300
- **MongoDB CPU:** 30-40% (much better!)
- **Response Time (P95):** 1-2 seconds
- **Connection Pool:** 150 total, but only 30-50 active (cache hits)
- **Result:** MongoDB no longer bottleneck

### After Load Balancing + Redis + Read Replicas
- **Concurrent Users:** 500+
- **MongoDB CPU (per node):** 10-20%
- **Response Time (P95):** < 1 second
- **Connection Pool:** Distributed across 3 MongoDB nodes
- **Result:** System scales horizontally

---

## 🔧 CONFIGURATION RECOMMENDATIONS

### MongoDB Connection Pool Settings

**Current (Per Server):**
```javascript
maxPoolSize: 50
minPoolSize: 5
```

**Recommended (Per Server, with 3 servers):**
```javascript
maxPoolSize: 100  // Total: 300 connections (manageable)
minPoolSize: 10   // Keep some connections warm
```

**With Redis Caching:**
```javascript
maxPoolSize: 150  // Total: 450, but only 50-100 active
minPoolSize: 20
```

**With Read Replicas:**
```javascript
// Primary (writes)
maxPoolSize: 50   // Only writes, less load

// Replicas (reads)
maxPoolSize: 100  // Each replica, reads distributed
```

---

## ✅ SUMMARY

### How Load Balancer Works:
1. ✅ Distributes HTTP requests across multiple servers
2. ✅ Uses `least_conn` algorithm (routes to server with fewest connections)
3. ✅ Considers server weights (powerful servers get more traffic)
4. ✅ Provides high availability (if one server fails, others continue)

### MongoDB Connection Pooling:
1. ⚠️ **YES, it increases:** 50 → 150 total connections (3 servers)
2. ⚠️ **YES, MongoDB is still bottleneck:** All servers wait for same MongoDB
3. ⚠️ **CPU is the real issue:** MongoDB at 100% CPU limits everything

### Solutions (Priority Order):
1. **Immediate:** Increase connection pool, add indexes, use `.lean()`
2. **Short-term:** Add Redis caching (reduces MongoDB load by 70-80%)
3. **Long-term:** MongoDB read replicas (distributes read load)

### Bottom Line:
- ✅ Load balancing helps distribute HTTP load
- ⚠️ MongoDB is still the bottleneck (CPU, not connections)
- ✅ Redis caching is the quickest win (reduces MongoDB load significantly)
- ✅ Read replicas are the best long-term solution

---

**Next Steps:**
1. Monitor MongoDB CPU and connections for 24 hours
2. Implement Redis caching (biggest impact)
3. Plan MongoDB replica set setup
4. Optimize database queries continuously






