/**
 * Verify Self-Healing Fixes
 * Tests load balancing and replica set distribution
 */

const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

async function verifyFixes() {
  console.log('🔍 Verifying Self-Healing Fixes...\n');
  
  // 1. Test Load Balancing
  console.log('1️⃣ Testing Load Balancing...');
  const loadBalancingResults = { primary: 0, secondary: 0, errors: 0 };
  
  for (let i = 0; i < 30; i++) {
    try {
      const response = await axios.get('http://13.202.181.167:5000/health', { timeout: 3000 });
      const serverIP = response.data?.server;
      
      if (serverIP) {
        if (serverIP.includes('172.31.43') || serverIP.includes('13.202.181')) {
          loadBalancingResults.primary++;
        } else if (serverIP.includes('172.31.47') || serverIP.includes('3.109.82')) {
          loadBalancingResults.secondary++;
        }
      }
    } catch (error) {
      loadBalancingResults.errors++;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  
  const total = loadBalancingResults.primary + loadBalancingResults.secondary;
  const primaryPct = total > 0 ? ((loadBalancingResults.primary / total) * 100).toFixed(1) : 0;
  const secondaryPct = total > 0 ? ((loadBalancingResults.secondary / total) * 100).toFixed(1) : 0;
  
  console.log(`   Primary: ${loadBalancingResults.primary}/${total} (${primaryPct}%)`);
  console.log(`   Secondary: ${loadBalancingResults.secondary}/${total} (${secondaryPct}%)`);
  console.log(`   Errors: ${loadBalancingResults.errors}`);
  
  if (loadBalancingResults.primary > 0 && loadBalancingResults.secondary > 0) {
    console.log('   ✅ Load balancing is working!');
  } else {
    console.log('   ⚠️  Load balancing may not be working correctly');
  }
  
  // 2. Test Replica Set Distribution
  console.log('\n2️⃣ Testing Replica Set Query Distribution...');
  
  try {
    const { initializeConnections, getReadConnection } = require('../dbConnection');
    const { readConnection } = await initializeConnections(process.env.MONGODB_URI);
    
    const SurveyResponse = readConnection.model('SurveyResponse', new mongoose.Schema({}, {strict: false, collection: 'surveyresponses'}));
    
    let primaryQueries = 0;
    let secondaryQueries = 0;
    
    for (let i = 0; i < 20; i++) {
      try {
        await SurveyResponse.findOne({}).read('secondaryPreferred').lean();
        const hello = await readConnection.db.admin().command({ hello: 1 });
        
        if (hello.secondary) {
          secondaryQueries++;
        } else {
          primaryQueries++;
        }
      } catch (err) {
        console.error(`   Query ${i} error:`, err.message);
      }
      await new Promise(r => setTimeout(r, 200));
    }
    
    const totalQueries = primaryQueries + secondaryQueries;
    const primaryQueryPct = totalQueries > 0 ? ((primaryQueries / totalQueries) * 100).toFixed(1) : 0;
    const secondaryQueryPct = totalQueries > 0 ? ((secondaryQueries / totalQueries) * 100).toFixed(1) : 0;
    
    console.log(`   Primary queries: ${primaryQueries}/${totalQueries} (${primaryQueryPct}%)`);
    console.log(`   Secondary queries: ${secondaryQueries}/${totalQueries} (${secondaryQueryPct}%)`);
    
    if (secondaryQueries > 0) {
      console.log('   ✅ Replica set queries are being distributed!');
    } else {
      console.log('   ⚠️  All queries going to primary (check secondary availability)');
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('   ❌ Error testing replica set:', error.message);
  }
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Load Balancing: ${loadBalancingResults.primary > 0 && loadBalancingResults.secondary > 0 ? '✅ Working' : '⚠️  Needs attention'}`);
  console.log(`   Replica Set: ${secondaryQueries > 0 ? '✅ Distributed' : '⚠️  All to primary'}`);
  
  process.exit(0);
}

verifyFixes().catch(err => {
  console.error('❌ Verification failed:', err.message);
  process.exit(1);
});







