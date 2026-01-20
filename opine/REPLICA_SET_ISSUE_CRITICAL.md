# CRITICAL: Replica Set Not Using Secondary - Root Cause Analysis

## Current Status
- Replica Set: ✅ Both servers healthy (Primary + Secondary)
- Network: ✅ Both servers reachable
- Topology Discovery: ✅ Driver discovers both servers
- **BUT: ALL queries go to PRIMARY (0% to secondary)**

## Root Cause
MongoDB driver connects to PRIMARY first, then discovers secondaries. However, even with `readPreference=secondaryPreferred` in connection string AND `.read('secondaryPreferred')` on queries, ALL queries execute on PRIMARY.

## Tests Performed
1. Connection string with `readPreference=secondaryPreferred` → Still uses PRIMARY
2. Query-level `.read('secondaryPreferred')` → Still uses PRIMARY  
3. Dedicated read connection with `readPreference=secondaryPreferred` → Still uses PRIMARY
4. Native MongoDB driver (not Mongoose) → Still uses PRIMARY
5. Removed `maxStalenessSeconds` → Still uses PRIMARY

## Possible Reasons
1. Secondary might be considered "not eligible" due to lag/health from driver's perspective
2. Network latency to secondary might be too high
3. MongoDB driver bug or misconfiguration
4. Secondary might be in "RECOVERING" state from driver's view (even though rs.status shows SECONDARY)

## Immediate Workaround
Since replica set is not working, system is using PRIMARY only. This means:
- ✅ Reads work (from primary)
- ✅ Writes work (to primary)
- ⚠️  NO load distribution (all queries hit primary)
- ⚠️  NO read scaling (secondary not used)

## Long-term Fix Needed
1. Verify secondary is actually reachable and healthy from application server's perspective
2. Check MongoDB driver logs to see why secondary is being rejected
3. Verify MongoDB replica set configuration on the server side
4. Consider if secondary needs to be explicitly enabled for reads in MongoDB config

## Connection String Used
```
mongodb://opine_user:***@172.31.43.71:27017,172.31.47.152:27017/Opine?authSource=admin&replicaSet=rs0&maxPoolSize=100&readPreference=secondaryPreferred
```

**Status:** System is functional (using PRIMARY only) but NOT optimal (no replica set load distribution).
