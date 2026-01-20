#!/bin/bash
# Monitor load balancing and replica set during stress test

echo "🔍 Monitoring Load Balancing and Replica Set Distribution..."
echo ""

# Monitor health endpoint distribution
echo "1️⃣ Testing Load Balancing (Health Endpoint)..."
PRIMARY_COUNT=0
SECONDARY_COUNT=0

for i in {1..20}; do
  SERVER_IP=$(curl -s -m 2 http://13.202.181.167:5000/health 2>/dev/null | grep -o '"server":"[^"]*"' | cut -d'"' -f4)
  if [[ "$SERVER_IP" == *"172.31.43"* ]] || [[ "$SERVER_IP" == *"13.202.181"* ]]; then
    PRIMARY_COUNT=$((PRIMARY_COUNT + 1))
  elif [[ "$SERVER_IP" == *"172.31.47"* ]] || [[ "$SERVER_IP" == *"3.109.82"* ]]; then
    SECONDARY_COUNT=$((SECONDARY_COUNT + 1))
  fi
  sleep 0.1
done

echo "   Primary server requests: $PRIMARY_COUNT/20"
echo "   Secondary server requests: $SECONDARY_COUNT/20"
echo "   Distribution: $((PRIMARY_COUNT * 5))% primary, $((SECONDARY_COUNT * 5))% secondary"
echo ""

# Check MongoDB replica set usage
echo "2️⃣ Checking Replica Set Query Distribution..."
cd /var/www/opine/backend
node -e "
const mongoose = require('mongoose');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI, { readPreference: 'secondaryPreferred' });
  const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, {strict: false, collection: 'surveyresponses'}));
  
  let primaryQueries = 0;
  let secondaryQueries = 0;
  
  for (let i = 0; i < 20; i++) {
    await SurveyResponse.findOne({}).read('secondaryPreferred').lean();
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (hello.secondary) {
      secondaryQueries++;
    } else {
      primaryQueries++;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log('   Primary queries: ' + primaryQueries + '/20');
  console.log('   Secondary queries: ' + secondaryQueries + '/20');
  console.log('   Distribution: ' + (primaryQueries * 5) + '% primary, ' + (secondaryQueries * 5) + '% secondary');
  
  process.exit(0);
}

test().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
" 2>&1

echo ""
echo "✅ Monitoring complete"







