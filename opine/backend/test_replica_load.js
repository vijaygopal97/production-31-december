const mongoose = require('mongoose');
require('dotenv').config();

const SurveyResponseSchema = new mongoose.Schema({}, {strict: false, collection: 'surveyresponses'});

async function testReplicaLoad() {
  try {
    console.log('=== MONGODB REPLICA SET LOAD TESTING ===\n');
    
    // Connect with read preference
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Replica Set');
    
    const SurveyResponse = mongoose.model('SurveyResponse', SurveyResponseSchema);
    
    // Test 1: Check which server we're connected to
    console.log('\n📊 Test 1: Checking Connection Server...');
    const hello = await mongoose.connection.db.admin().command({hello: 1});
    console.log('   Connected to: ' + hello.me);
    console.log('   Is Primary: ' + hello.isWritablePrimary);
    console.log('   Is Secondary: ' + hello.secondary);
    console.log('   Set Name: ' + hello.setName);
    
    // Test 2: Create test interviews
    console.log('\n📊 Test 2: Creating 20 Test CAPI Interviews...');
    const testIds = [];
    const startCreate = Date.now();
    
    for(let i = 0; i < 20; i++) {
      const resp = await SurveyResponse.create({
        survey: new mongoose.Types.ObjectId('68fd1915d41841da463f0d46'),
        interviewer: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        status: 'completed',
        interviewMode: 'capi',
        sessionId: 'TEST_' + Date.now() + '_' + i, // Unique sessionId
        startTime: new Date(Date.now() - (Math.random() * 300000)),
        endTime: new Date(),
        totalTimeSpent: Math.floor(Math.random() * 300 + 60),
        responses: [
          {questionId: 'name', response: 'Test Respondent ' + i},
          {questionId: 'gender', response: 'Male'},
          {questionId: 'age', response: '25'}
        ],
        location: {
          latitude: 12.9716 + (Math.random() * 0.1),
          longitude: 77.5946 + (Math.random() * 0.1),
          accuracy: Math.random() * 10 + 5
        },
        audioRecording: {
          recordingDuration: Math.floor(Math.random() * 300 + 60),
          fileSize: Math.floor(Math.random() * 5000000 + 1000000),
          format: 'mp3',
          codec: 'aac',
          bitrate: 128000
        },
        createdAt: new Date()
      });
      testIds.push(resp._id.toString());
    }
    
    const endCreate = Date.now();
    console.log('   ✅ Created ' + testIds.length + ' interviews');
    console.log('   ⏱️  Time: ' + ((endCreate - startCreate) / 1000).toFixed(2) + ' seconds');
    
    // Test 3: Read distribution test
    console.log('\n📊 Test 3: Testing Read Distribution (100 queries)...');
    const readServers = [];
    const startRead = Date.now();
    
    for(let i = 0; i < 100; i++) {
      const hello = await mongoose.connection.db.admin().command({hello: 1});
      readServers.push(hello.me);
      await SurveyResponse.findOne({_id: testIds[0]}).lean();
    }
    
    const endRead = Date.now();
    const serverCounts = {};
    readServers.forEach(s => serverCounts[s] = (serverCounts[s] || 0) + 1);
    
    console.log('   Read Distribution:');
    Object.keys(serverCounts).forEach(s => {
      console.log('     ' + s + ': ' + serverCounts[s] + ' queries (' + ((serverCounts[s]/100)*100).toFixed(1) + '%)');
    });
    console.log('   ⏱️  Time: ' + ((endRead - startRead) / 1000).toFixed(2) + ' seconds');
    
    // Test 4: Concurrent reads
    console.log('\n📊 Test 4: Concurrent Read Test (50 parallel queries)...');
    const concurrentStart = Date.now();
    const concurrentServers = [];
    
    const promises = [];
    for(let i = 0; i < 50; i++) {
      promises.push(
        mongoose.connection.db.admin().command({hello: 1}).then(hello => {
          concurrentServers.push(hello.me);
          return SurveyResponse.findOne({interviewMode: 'capi'}).lean();
        })
      );
    }
    
    await Promise.all(promises);
    const concurrentEnd = Date.now();
    
    const concurrentCounts = {};
    concurrentServers.forEach(s => concurrentCounts[s] = (concurrentCounts[s] || 0) + 1);
    
    console.log('   Concurrent Read Distribution:');
    Object.keys(concurrentCounts).forEach(s => {
      console.log('     ' + s + ': ' + concurrentCounts[s] + ' queries (' + ((concurrentCounts[s]/50)*100).toFixed(1) + '%)');
    });
    console.log('   ⏱️  Time: ' + ((concurrentEnd - concurrentStart) / 1000).toFixed(2) + ' seconds');
    
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await SurveyResponse.deleteMany({_id: {$in: testIds.map(id => new mongoose.Types.ObjectId(id))}});
    console.log('   ✅ Deleted ' + testIds.length + ' test interviews');
    
    console.log('\n✅ TESTING COMPLETE!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testReplicaLoad();

