const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';

// Load models
const SurveyResponse = require('../models/SurveyResponse');
const InterviewSession = require('../models/InterviewSession');
const User = require('../models/User');

/**
 * Analyze root cause of duplicate creation
 */
async function analyzeRootCause() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Find all responses with duplicate sessionIds
    console.log('📊 Analyzing sessionId duplicates...');
    const sessionIdGroups = await SurveyResponse.aggregate([
      {
        $group: {
          _id: '$sessionId',
          count: { $sum: 1 },
          responseIds: { $push: '$_id' },
          responseData: { $push: '$$ROOT' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);
    
    console.log(`✅ Found ${sessionIdGroups.length} sessionIds with multiple responses\n`);
    
    // Analyze patterns
    const analysis = {
      totalDuplicateSessionIds: sessionIdGroups.length,
      totalDuplicateResponses: sessionIdGroups.reduce((sum, g) => sum + g.count, 0),
      patterns: {
        sameInterviewer: 0,
        differentInterviewers: 0,
        sameTime: 0,
        differentTime: 0,
        sameDuration: 0,
        differentDuration: 0,
        createdOnTheFly: 0,
        normalSessions: 0,
        offlineSync: 0,
        onlineSubmission: 0
      },
      details: []
    };
    
    for (const group of sessionIdGroups) {
      const responses = group.responseData;
      const firstResponse = responses[0];
      
      // Check if session was created on-the-fly
      const session = await InterviewSession.findOne({ sessionId: group._id }).lean();
      const wasCreatedOnTheFly = session?.metadata?.createdOnTheFly === true;
      
      // Check if all responses have same interviewer
      const interviewers = [...new Set(responses.map(r => r.interviewer.toString()))];
      const sameInterviewer = interviewers.length === 1;
      
      // Check if all responses have same start time (within 5 seconds)
      const startTimes = responses.map(r => new Date(r.startTime).getTime());
      const minStartTime = Math.min(...startTimes);
      const maxStartTime = Math.max(...startTimes);
      const sameTime = (maxStartTime - minStartTime) < 5000;
      
      // Check if all responses have same duration (within 5 seconds)
      const durations = responses.map(r => r.totalTimeSpent);
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);
      const sameDuration = (maxDuration - minDuration) < 5;
      
      // Check metadata for offline sync indicators
      const hasOfflineMetadata = responses.some(r => 
        r.metadata?.createdOnTheFly === true ||
        r.metadata?.originalMetadata ||
        r.metadata?.offlineSync === true
      );
      
      // Check if responses were created close together (race condition indicator)
      const createdTimes = responses.map(r => new Date(r.createdAt || r._id.getTimestamp()).getTime());
      const minCreated = Math.min(...createdTimes);
      const maxCreated = Math.max(...createdTimes);
      const timeBetweenCreations = maxCreated - minCreated;
      
      const pattern = {
        sessionId: group._id,
        responseCount: group.count,
        responseIds: responses.map(r => r._id.toString()),
        responseIds_numeric: responses.map(r => r.responseId || r._id.toString()),
        wasCreatedOnTheFly,
        sameInterviewer,
        interviewers: interviewers,
        sameTime,
        timeRange: {
          min: new Date(minStartTime).toISOString(),
          max: new Date(maxStartTime).toISOString(),
          difference: maxStartTime - minStartTime
        },
        sameDuration,
        durationRange: {
          min: minDuration,
          max: maxDuration,
          difference: maxDuration - minDuration
        },
        hasOfflineMetadata,
        creationTimeRange: {
          min: new Date(minCreated).toISOString(),
          max: new Date(maxCreated).toISOString(),
          difference: timeBetweenCreations,
          differenceSeconds: Math.round(timeBetweenCreations / 1000)
        },
        likelyRaceCondition: timeBetweenCreations < 5000, // Created within 5 seconds
        responses: responses.map(r => ({
          responseId: r.responseId || r._id.toString(),
          mongoId: r._id.toString(),
          interviewer: r.interviewer.toString(),
          startTime: r.startTime,
          duration: r.totalTimeSpent,
          status: r.status,
          createdAt: r.createdAt || r._id.getTimestamp(),
          hasMetadata: !!r.metadata,
          metadataKeys: r.metadata ? Object.keys(r.metadata) : []
        }))
      };
      
      analysis.details.push(pattern);
      
      // Update statistics
      if (sameInterviewer) analysis.patterns.sameInterviewer++;
      else analysis.patterns.differentInterviewers++;
      
      if (sameTime) analysis.patterns.sameTime++;
      else analysis.patterns.differentTime++;
      
      if (sameDuration) analysis.patterns.sameDuration++;
      else analysis.patterns.differentDuration++;
      
      if (wasCreatedOnTheFly) analysis.patterns.createdOnTheFly++;
      else analysis.patterns.normalSessions++;
      
      if (hasOfflineMetadata) analysis.patterns.offlineSync++;
      else analysis.patterns.onlineSubmission++;
    }
    
    // Print analysis
    console.log('='.repeat(80));
    console.log('ROOT CAUSE ANALYSIS');
    console.log('='.repeat(80));
    console.log(`Total Duplicate SessionIds: ${analysis.totalDuplicateSessionIds}`);
    console.log(`Total Duplicate Responses: ${analysis.totalDuplicateResponses}`);
    console.log();
    console.log('Patterns:');
    console.log(`  Same Interviewer: ${analysis.patterns.sameInterviewer}`);
    console.log(`  Different Interviewers: ${analysis.patterns.differentInterviewers}`);
    console.log(`  Same Start Time: ${analysis.patterns.sameTime}`);
    console.log(`  Different Start Time: ${analysis.patterns.differentTime}`);
    console.log(`  Same Duration: ${analysis.patterns.sameDuration}`);
    console.log(`  Different Duration: ${analysis.patterns.differentDuration}`);
    console.log(`  Created On-The-Fly: ${analysis.patterns.createdOnTheFly}`);
    console.log(`  Normal Sessions: ${analysis.patterns.normalSessions}`);
    console.log(`  Offline Sync: ${analysis.patterns.offlineSync}`);
    console.log(`  Online Submission: ${analysis.patterns.onlineSubmission}`);
    console.log();
    
    // Find likely race conditions
    const raceConditions = analysis.details.filter(p => p.likelyRaceCondition);
    console.log(`⚠️  Likely Race Conditions: ${raceConditions.length}`);
    if (raceConditions.length > 0) {
      console.log('\nRace Condition Details:');
      raceConditions.forEach((rc, idx) => {
        console.log(`\n  ${idx + 1}. SessionId: ${rc.sessionId}`);
        console.log(`     Responses: ${rc.responseCount}`);
        console.log(`     Created within: ${rc.creationTimeRange.differenceSeconds} seconds`);
        console.log(`     Response IDs: ${rc.responseIds_numeric.join(', ')}`);
      });
    }
    
    // Find cases where session was created on-the-fly
    const onTheFlyCases = analysis.details.filter(p => p.wasCreatedOnTheFly);
    console.log(`\n⚠️  Sessions Created On-The-Fly: ${onTheFlyCases.length}`);
    if (onTheFlyCases.length > 0) {
      console.log('\nOn-The-Fly Creation Details:');
      onTheFlyCases.forEach((otf, idx) => {
        console.log(`\n  ${idx + 1}. SessionId: ${otf.sessionId}`);
        console.log(`     Responses: ${otf.responseCount}`);
        console.log(`     Response IDs: ${otf.responseIds_numeric.join(', ')}`);
      });
    }
    
    // Find cases with different interviewers (shouldn't happen)
    const differentInterviewerCases = analysis.details.filter(p => !p.sameInterviewer);
    console.log(`\n⚠️  Different Interviewers (CRITICAL): ${differentInterviewerCases.length}`);
    if (differentInterviewerCases.length > 0) {
      console.log('\nDifferent Interviewer Details:');
      differentInterviewerCases.forEach((diff, idx) => {
        console.log(`\n  ${idx + 1}. SessionId: ${diff.sessionId}`);
        console.log(`     Interviewers: ${diff.interviewers.join(', ')}`);
        console.log(`     Response IDs: ${diff.responseIds_numeric.join(', ')}`);
      });
    }
    
    // Save detailed analysis
    const fs = require('fs');
    const analysisPath = path.join(__dirname, `../duplicate_root_cause_analysis_${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
    console.log(`\n✅ Detailed analysis saved to: ${analysisPath}`);
    
    // Generate recommendations
    console.log('\n' + '='.repeat(80));
    console.log('RECOMMENDATIONS');
    console.log('='.repeat(80));
    
    if (raceConditions.length > 0) {
      console.log('\n🔴 CRITICAL: Race Condition Detected');
      console.log('   - Multiple responses created with same sessionId within seconds');
      console.log('   - Likely cause: Multiple sync attempts happening simultaneously');
      console.log('   - Fix: Add proper locking mechanism in sync service');
      console.log('   - Fix: Check for existing response before creating new one');
    }
    
    if (onTheFlyCases.length > 0) {
      console.log('\n🟡 WARNING: Sessions Created On-The-Fly');
      console.log('   - Sessions created when they don\'t exist (offline sync)');
      console.log('   - This is expected behavior but may cause duplicates if sync retries');
      console.log('   - Fix: Check for existing response before creating session on-the-fly');
      console.log('   - Fix: Use transaction to ensure atomicity');
    }
    
    if (differentInterviewerCases.length > 0) {
      console.log('\n🔴 CRITICAL: Different Interviewers Using Same SessionId');
      console.log('   - This should NEVER happen - indicates security issue');
      console.log('   - Fix: Add validation to prevent sessionId reuse across interviewers');
    }
    
    console.log('\n📋 General Recommendations:');
    console.log('   1. Add unique constraint check before creating response');
    console.log('   2. Use database transactions for response creation');
    console.log('   3. Implement proper retry logic with duplicate detection');
    console.log('   4. Add logging to track all response creation attempts');
    console.log('   5. Check for existing response by sessionId before creating');
    
    await mongoose.disconnect();
    console.log('\n✅ Analysis complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the analysis
analyzeRootCause();


