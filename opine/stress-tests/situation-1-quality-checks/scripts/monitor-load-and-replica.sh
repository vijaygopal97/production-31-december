#!/bin/bash
# Monitor Load Balancing and Replica Set during stress test

echo "🔍 Monitoring Load Balancing and Replica Set Distribution..."
echo ""

# Monitor health endpoint distribution
echo "1️⃣ Testing Load Balancing (Health Endpoint)..."
PRIMARY_COUNT=0
SECONDARY_COUNT=0
ERRORS=0

for i in {1..30}; do
  SERVER_IP=$(timeout 2 curl -s http://13.202.181.167:5000/health 2>/dev/null | grep -o '"server":"[^"]*"' | cut -d'"' -f4)
  if [[ -n "$SERVER_IP" ]]; then
    if [[ "$SERVER_IP" == *"172.31.43"* ]] || [[ "$SERVER_IP" == *"13.202.181"* ]]; then
      PRIMARY_COUNT=$((PRIMARY_COUNT + 1))
    elif [[ "$SERVER_IP" == *"172.31.47"* ]] || [[ "$SERVER_IP" == *"3.109.82"* ]]; then
      SECONDARY_COUNT=$((SECONDARY_COUNT + 1))
    fi
  else
    ERRORS=$((ERRORS + 1))
  fi
  sleep 0.1
done

TOTAL=$((PRIMARY_COUNT + SECONDARY_COUNT))
if [ $TOTAL -gt 0 ]; then
  PRIMARY_PCT=$((PRIMARY_COUNT * 100 / TOTAL))
  SECONDARY_PCT=$((SECONDARY_COUNT * 100 / TOTAL))
  echo "   Primary server requests: $PRIMARY_COUNT/$TOTAL ($PRIMARY_PCT%)"
  echo "   Secondary server requests: $SECONDARY_COUNT/$TOTAL ($SECONDARY_PCT%)"
  echo "   Errors: $ERRORS"
  
  if [ $PRIMARY_COUNT -gt 0 ] && [ $SECONDARY_COUNT -gt 0 ]; then
    echo "   ✅ Load balancing is working!"
  else
    echo "   ⚠️  Load balancing may not be working correctly"
  fi
else
  echo "   ❌ No successful health checks"
fi

echo ""
echo "2️⃣ Checking Replica Set Query Distribution..."
cd /var/www/opine/backend
node -e "
const mongoose = require('mongoose');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI, {
    readPreference: 'secondaryPreferred',
    maxStalenessSeconds: 90,
    retryReads: true
  });
  
  const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, {strict: false, collection: 'surveyresponses'}));
  
  let primaryQueries = 0;
  let secondaryQueries = 0;
  
  for (let i = 0; i < 20; i++) {
    try {
      await SurveyResponse.findOne({}).read('secondaryPreferred').lean();
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      if (hello.secondary) {
        secondaryQueries++;
      } else {
        primaryQueries++;
      }
    } catch (err) {
      // Ignore errors
    }
    await new Promise(r => setTimeout(r, 200));
  }
  
  const total = primaryQueries + secondaryQueries;
  const primaryPct = total > 0 ? ((primaryQueries / total) * 100).toFixed(1) : 0;
  const secondaryPct = total > 0 ? ((secondaryQueries / total) * 100).toFixed(1) : 0;
  
  console.log('   Primary queries: ' + primaryQueries + '/' + total + ' (' + primaryPct + '%)');
  console.log('   Secondary queries: ' + secondaryQueries + '/' + total + ' (' + secondaryPct + '%)');
  
  if (secondaryQueries > 0) {
    console.log('   ✅ Replica set queries are being distributed!');
  } else {
    console.log('   ⚠️  All queries going to primary (may be normal during initial connection)');
  }
  
  process.exit(0);
}

test().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
" 2>&1

echo ""
echo "✅ Monitoring complete"







