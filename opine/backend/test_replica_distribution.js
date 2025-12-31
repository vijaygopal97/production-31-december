const mongoose = require('mongoose');
require('dotenv').config();

async function testReplicaDistribution() {
  try {
    console.log('=== FORCING READS TO SECONDARIES TEST ===\n');
    
    // Connect directly to secondaries for testing
    const secondary1URI = 'mongodb://opine_user:OpineApp2024Secure@13.233.231.180:27017/Opine?authSource=admin&readPreference=secondary';
    const secondary2URI = 'mongodb://opine_user:OpineApp2024Secure@3.109.186.86:27017/Opine?authSource=admin&readPreference=secondary';
    const replicaSetURI = process.env.MONGODB_URI;
    
    const SurveyResponseSchema = new mongoose.Schema({}, {strict: false, collection: 'surveyresponses'});
    const SurveySchema = new mongoose.Schema({}, {strict: false, collection: 'surveys'});
    
    console.log('📊 Test 1: Reading from Secondary 1 directly...');
    const conn1 = await mongoose.createConnection(secondary1URI);
    const SurveyResponse1 = conn1.model('SurveyResponse', SurveyResponseSchema);
    const start1 = Date.now();
    const responses1 = await SurveyResponse1.find({interviewMode: 'capi'}).limit(100).lean();
    const end1 = Date.now();
    console.log(`   ✅ Read ${responses1.length} responses in ${((end1 - start1) / 1000).toFixed(2)}s`);
    await conn1.close();
    
    console.log('\n📊 Test 2: Reading from Secondary 2 directly...');
    const conn2 = await mongoose.createConnection(secondary2URI);
    const SurveyResponse2 = conn2.model('SurveyResponse', SurveyResponseSchema);
    const start2 = Date.now();
    const responses2 = await SurveyResponse2.find({interviewMode: 'capi'}).limit(100).lean();
    const end2 = Date.now();
    console.log(`   ✅ Read ${responses2.length} responses in ${((end2 - start2) / 1000).toFixed(2)}s`);
    await conn2.close();
    
    console.log('\n📊 Test 3: Concurrent reads from replica set (60 users)...');
    await mongoose.connect(replicaSetURI);
    const SurveyResponse = mongoose.model('SurveyResponse', SurveyResponseSchema);
    const Survey = mongoose.model('Survey', SurveySchema);
    
    const CONCURRENT = 60;
    const READS_PER_USER = 20;
    
    const start = Date.now();
    const serverCounts = {primary: 0, secondary1: 0, secondary2: 0};
    
    // Create multiple connections to force distribution
    const connections = [];
    for (let i = 0; i < CONCURRENT; i++) {
      connections.push(mongoose.createConnection(replicaSetURI));
    }
    
    await Promise.all(connections.map(async (conn, idx) => {
      const SR = conn.model('SurveyResponse', SurveyResponseSchema);
      const S = conn.model('Survey', SurveySchema);
      
      for (let j = 0; j < READS_PER_USER; j++) {
        try {
          const hello = await conn.db.admin().command({hello: 1});
          const server = hello.me;
          
          if (server.includes('13.202.181.167')) serverCounts.primary++;
          else if (server.includes('13.233.231.180')) serverCounts.secondary1++;
          else if (server.includes('3.109.186.86')) serverCounts.secondary2++;
          
          await SR.findOne({interviewMode: 'capi'}).lean();
        } catch (err) {
          console.error(`Error in connection ${idx}:`, err.message);
        }
      }
      
      // Read survey
      try {
        const hello = await conn.db.admin().command({hello: 1});
        const server = hello.me;
        if (server.includes('13.202.181.167')) serverCounts.primary++;
        else if (server.includes('13.233.231.180')) serverCounts.secondary1++;
        else if (server.includes('3.109.186.86')) serverCounts.secondary2++;
        
        await S.findById('68fd1915d41841da463f0d46').lean();
      } catch (err) {
        console.error(`Error reading survey:`, err.message);
      }
      
      await conn.close();
    }));
    
    const end = Date.now();
    const total = serverCounts.primary + serverCounts.secondary1 + serverCounts.secondary2;
    
    console.log(`\n✅ Test Complete in ${((end - start) / 1000).toFixed(2)}s\n`);
    console.log('📊 LOAD DISTRIBUTION:');
    console.log(`   Primary: ${serverCounts.primary} (${((serverCounts.primary/total)*100).toFixed(1)}%)`);
    console.log(`   Secondary 1: ${serverCounts.secondary1} (${((serverCounts.secondary1/total)*100).toFixed(1)}%)`);
    console.log(`   Secondary 2: ${serverCounts.secondary2} (${((serverCounts.secondary2/total)*100).toFixed(1)}%)`);
    console.log(`   Total: ${total} reads`);
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testReplicaDistribution();






