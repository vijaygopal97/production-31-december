/**
 * Real Quality Agent Flow Emulation
 * Emulates the exact React Native app flow:
 * 1. Login
 * 2. Load dashboard (getQualityAgentAnalytics)
 * 3. Click "Start CAPI QC" or "Start CATI QC"
 * 4. Get next review assignment (with interviewMode filter)
 * 5. Review and submit verification
 * 
 * Tests 500 concurrent quality agents (50% CAPI, 50% CATI)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../backend/.env') });
const axios = require('axios');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.API_BASE_URL || 'https://convo.convergentview.com';
const SURVEY_ID = '68fd1915d41841da463f0d46';
const TEST_MARKER = 'STRESS_TEST_REAL_FLOW';

// Import models for test data creation
const SurveyResponse = require('../../../backend/models/SurveyResponse');
const User = require('../../../backend/models/User');

class RealQualityAgentEmulator {
  constructor(agentIndex, interviewMode, monitor) {
    this.agentIndex = agentIndex;
    this.interviewMode = interviewMode; // 'capi' or 'cati'
    this.monitor = monitor;
    this.token = null;
    this.results = {
      login: { success: false, time: 0 },
      dashboard: { success: false, time: 0 },
      getAssignment: { success: false, time: 0, responseId: null },
      submitVerification: { success: false, time: 0 }
    };
  }

  async login() {
    const startTime = Date.now();
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: 'adarshquality123@gmail.com',
        password: 'Vijaygopal97'
      }, { timeout: 30000 });
      
      const responseTime = Date.now() - startTime;
      if (this.monitor) {
        this.monitor.recordAPICall(responseTime);
      }
      
      if (response.data.success) {
        this.token = response.data.token || response.data.data?.token;
        this.results.login = { success: true, time: responseTime };
        return true;
      }
      throw new Error('Login failed');
    } catch (error) {
      this.results.login = { success: false, time: Date.now() - startTime, error: error.message };
      throw error;
    }
  }

  async loadDashboard() {
    const startTime = Date.now();
    try {
      const response = await axios.get(`${API_BASE_URL}/api/quality-agents/analytics`, {
        headers: { 'Authorization': `Bearer ${this.token}` },
        params: { timeRange: 'all', lightweight: 'true' },
        timeout: 30000
      });
      
      const responseTime = Date.now() - startTime;
      if (this.monitor) {
        this.monitor.recordAPICall(responseTime);
      }
      
      this.results.dashboard = { success: response.data.success, time: responseTime };
      return response.data.success;
    } catch (error) {
      this.results.dashboard = { success: false, time: Date.now() - startTime, error: error.message };
      return false;
    }
  }

  async getNextReviewAssignment() {
    const startTime = Date.now();
    try {
      // Emulate clicking "Start CAPI QC" or "Start CATI QC" button
      const response = await axios.get(`${API_BASE_URL}/api/survey-responses/next-review`, {
        headers: { 'Authorization': `Bearer ${this.token}` },
        params: {
          surveyId: SURVEY_ID,
          interviewMode: this.interviewMode // Filter by CAPI or CATI
        },
        timeout: 30000
      });
      
      const responseTime = Date.now() - startTime;
      if (this.monitor) {
        this.monitor.recordAPICall(responseTime);
      }
      
      if (response.data.success && response.data.data) {
        const assignment = response.data.data.interview || response.data.data;
        const responseId = assignment.responseId || assignment._id;
        
        if (responseId) {
          this.results.getAssignment = {
            success: true,
            time: responseTime,
            responseId: responseId,
            interviewMode: assignment.interviewMode
          };
          return responseId;
        }
      }
      
      this.results.getAssignment = { success: false, time: responseTime, error: 'No assignment available' };
      return null;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.results.getAssignment = { success: false, time: responseTime, error: error.message };
      return null;
    }
  }

  generateVerificationCriteria() {
    return {
      audioStatus: ['1', '2', '3', '4'][Math.floor(Math.random() * 4)],
      genderMatching: ['1', '2', '3'][Math.floor(Math.random() * 3)],
      upcomingElectionsMatching: ['1', '2', '3'][Math.floor(Math.random() * 3)],
      previousElectionsMatching: ['1', '2', '3'][Math.floor(Math.random() * 3)],
      previousLoksabhaElectionsMatching: ['1', '2', '3'][Math.floor(Math.random() * 3)],
      nameMatching: ['1', '2', '3'][Math.floor(Math.random() * 3)],
      ageMatching: ['1', '2', '3'][Math.floor(Math.random() * 3)],
      phoneNumberAsked: ['1', '2'][Math.floor(Math.random() * 2)],
      audioQuality: ['1', '2', '3', '4'][Math.floor(Math.random() * 4)],
      questionAccuracy: ['1', '2', '3'][Math.floor(Math.random() * 3)],
      dataAccuracy: ['1', '2', '3'][Math.floor(Math.random() * 3)],
      locationMatch: ['1', '2', '3'][Math.floor(Math.random() * 3)]
    };
  }

  async submitVerification(responseId) {
    const startTime = Date.now();
    try {
      const criteria = this.generateVerificationCriteria();
      const status = Math.random() < 0.7 ? 'approved' : 'rejected';
      const feedback = status === 'rejected' ? 'Test rejection for stress test' : '';
      
      const response = await axios.post(
        `${API_BASE_URL}/api/survey-responses/verify`,
        {
          responseId,
          status,
          verificationCriteria: criteria,
          feedback
        },
        {
          headers: { 'Authorization': `Bearer ${this.token}` },
          timeout: 60000
        }
      );
      
      const responseTime = Date.now() - startTime;
      if (this.monitor) {
        this.monitor.recordAPICall(responseTime);
      }
      
      this.results.submitVerification = {
        success: response.data.success,
        time: responseTime,
        status: status
      };
      
      return response.data.success;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.results.submitVerification = {
        success: false,
        time: responseTime,
        error: error.message
      };
      return false;
    }
  }

  async runFullFlow() {
    try {
      // Step 1: Login
      await this.login();
      
      // Step 2: Load dashboard (like React Native app does on mount)
      await this.loadDashboard();
      
      // Step 3: Click "Start CAPI QC" or "Start CATI QC" button
      const responseId = await this.getNextReviewAssignment();
      
      // Step 4: Submit verification (if assignment was received)
      if (responseId) {
        await this.submitVerification(responseId);
      }
      
      return {
        success: this.results.getAssignment.success && this.results.submitVerification.success,
        results: this.results
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        results: this.results
      };
    }
  }
}

class RealFlowStressTest {
  constructor() {
    this.testId = `real-flow-${Date.now()}`;
    this.reportDir = path.join(__dirname, '../reports');
    this.createdResponseIds = [];
  }

  async connectMongoDB() {
    console.log('🔌 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 100,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      readPreference: "secondaryPreferred",
      maxStalenessSeconds: 90,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000
    });
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MongoDB connection timeout'));
      }, 30000);
      
      if (mongoose.connection.readyState === 1) {
        clearTimeout(timeout);
        mongoose.connection.db.admin().ping().then(() => {
          resolve();
        }).catch(reject);
      } else {
        mongoose.connection.once('connected', () => {
          clearTimeout(timeout);
          mongoose.connection.db.admin().ping().then(() => {
            resolve();
          }).catch(reject);
        });
        mongoose.connection.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      }
    });
    
    console.log('✅ Connected to MongoDB\n');
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async createTestResponses(count = 500) {
    console.log(`📝 Creating ${count} test responses (50% CAPI, 50% CATI)...`);
    
    const capiInterviewer = await mongoose.connection.db.collection('users').findOne({ 
      email: 'ajithinterviewer@gmail.com',
      userType: 'interviewer'
    });
    
    const catiInterviewer = await mongoose.connection.db.collection('users').findOne({ 
      email: 'vishalinterviewer@gmail.com',
      userType: 'interviewer'
    });

    if (!capiInterviewer || !catiInterviewer) {
      throw new Error('Test interviewers not found');
    }

    const responses = [];
    const capiCount = Math.floor(count / 2);
    const catiCount = count - capiCount;

    // Create CAPI responses
    for (let i = 0; i < capiCount; i++) {
      responses.push({
        survey: new mongoose.Types.ObjectId(SURVEY_ID),
        interviewer: capiInterviewer._id,
        status: 'Pending_Approval',
        interviewMode: 'capi',
        sessionId: `${TEST_MARKER}-capi-${Date.now()}-${i}`,
        startTime: new Date(),
        endTime: new Date(),
        totalTimeSpent: 300 + Math.floor(Math.random() * 200),
        responses: [
          {
            sectionIndex: 0,
            questionIndex: 0,
            questionId: 'age',
            questionType: 'numeric',
            response: 25 + Math.floor(Math.random() * 50),
            responseTime: 1000
          },
          {
            sectionIndex: 1,
            questionIndex: 0,
            questionId: 'gender',
            questionType: 'multiple_choice',
            response: Math.random() < 0.5 ? 'male' : 'female',
            responseTime: 2000
          }
        ],
        selectedAC: 'Ranibandh',
        location: {
          latitude: 22.866141660215824,
          longitude: 86.78307081700281,
          accuracy: 50
        },
        metadata: {
          testMarker: TEST_MARKER,
          testIndex: i
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Create CATI responses
    for (let i = 0; i < catiCount; i++) {
      responses.push({
        survey: new mongoose.Types.ObjectId(SURVEY_ID),
        interviewer: catiInterviewer._id,
        status: 'Pending_Approval',
        interviewMode: 'cati',
        sessionId: `${TEST_MARKER}-cati-${Date.now()}-${i}`,
        startTime: new Date(),
        endTime: new Date(),
        totalTimeSpent: 200 + Math.floor(Math.random() * 150),
        responses: [
          {
            sectionIndex: 0,
            questionIndex: 0,
            questionId: 'age',
            questionType: 'numeric',
            response: 25 + Math.floor(Math.random() * 50),
            responseTime: 800
          },
          {
            sectionIndex: 1,
            questionIndex: 0,
            questionId: 'gender',
            questionType: 'multiple_choice',
            response: Math.random() < 0.5 ? 'male' : 'female',
            responseTime: 1500
          }
        ],
        selectedAC: 'Ranibandh',
        location: {
          latitude: 22.866141660215824,
          longitude: 86.78307081700281,
          accuracy: 100
        },
        metadata: {
          testMarker: TEST_MARKER,
          testIndex: capiCount + i
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Insert in batches
    const responsesCollection = mongoose.connection.db.collection('surveyresponses');
    const batchSize = 50;
    let inserted = 0;
    
    for (let i = 0; i < responses.length; i += batchSize) {
      const batch = responses.slice(i, i + batchSize);
      const result = await responsesCollection.insertMany(batch);
      this.createdResponseIds.push(...Object.values(result.insertedIds).map(id => id.toString()));
      inserted += batch.length;
      console.log(`   ✅ Created ${inserted}/${count} responses`);
    }

    console.log(`\n✅ Successfully created ${inserted} test responses`);
    console.log(`   CAPI: ${capiCount}, CATI: ${catiCount}\n`);
    
    // Wait for data to be available
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return inserted;
  }

  async runStressTest(monitor, totalAgents = 500) {
    console.log(`🚀 Starting REAL Quality Agent Flow Stress Test`);
    console.log(`   Total Agents: ${totalAgents}`);
    console.log(`   CAPI Agents: ${Math.floor(totalAgents / 2)}`);
    console.log(`   CATI Agents: ${totalAgents - Math.floor(totalAgents / 2)}`);
    console.log(`   Survey ID: ${SURVEY_ID}\n`);
    
    const results = {
      successful: [],
      failed: [],
      partial: []
    };
    
    let processed = 0;
    let successful = 0;
    let failed = 0;
    let partial = 0;
    const startTime = Date.now();
    
    // Create agents (50% CAPI, 50% CATI)
    const agents = [];
    for (let i = 0; i < totalAgents; i++) {
      const interviewMode = i < Math.floor(totalAgents / 2) ? 'capi' : 'cati';
      agents.push(new RealQualityAgentEmulator(i, interviewMode, monitor));
    }
    
    // Run all agents concurrently
    console.log(`📊 Executing ${totalAgents} concurrent quality agent flows...\n`);
    
    const agentPromises = agents.map(async (agent, index) => {
      // Small random delay to simulate real user behavior (0-2 seconds)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
      
      try {
        const result = await agent.runFullFlow();
        processed++;
        
        if (result.success) {
          successful++;
          results.successful.push({
            agentIndex: agent.agentIndex,
            interviewMode: agent.interviewMode,
            results: result.results
          });
        } else if (result.results.getAssignment.success || result.results.submitVerification.success) {
          partial++;
          results.partial.push({
            agentIndex: agent.agentIndex,
            interviewMode: agent.interviewMode,
            results: result.results,
            error: result.error
          });
        } else {
          failed++;
          results.failed.push({
            agentIndex: agent.agentIndex,
            interviewMode: agent.interviewMode,
            results: result.results,
            error: result.error
          });
        }
        
        // Progress update every 50 agents
        if (processed % 50 === 0 || processed === totalAgents) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
          const rate = (processed / elapsed).toFixed(2);
          console.log(`📊 Progress: ${processed}/${totalAgents} (${((processed/totalAgents)*100).toFixed(1)}%) | ✅ Success: ${successful} | ⚠️ Partial: ${partial} | ❌ Failed: ${failed} | Rate: ${rate}/s`);
        }
        
        return result;
      } catch (error) {
        processed++;
        failed++;
        results.failed.push({
          agentIndex: agent.agentIndex,
          interviewMode: agent.interviewMode,
          error: error.message
        });
        return { success: false, error: error.message };
      }
    });
    
    // Wait for all agents to complete
    await Promise.allSettled(agentPromises);
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    return {
      processed,
      successful,
      partial,
      failed,
      totalTime,
      results
    };
  }

  async cleanupTestData() {
    console.log('\n🧹 Cleaning up test data...');
    
    try {
      const responsesCollection = mongoose.connection.db.collection('surveyresponses');
      const result = await responsesCollection.deleteMany({
        'metadata.testMarker': TEST_MARKER
      });
      
      console.log(`✅ Deleted ${result.deletedCount} test responses\n`);
      return result.deletedCount;
    } catch (error) {
      console.error('❌ Error cleaning up:', error.message);
      throw error;
    }
  }

  async run() {
    const SystemMonitor = require('./monitor-system');
    const monitor = new SystemMonitor(this.testId, this.reportDir);
    
    try {
      if (!fs.existsSync(this.reportDir)) {
        fs.mkdirSync(this.reportDir, { recursive: true });
      }
      
      monitor.start(1000);
      
      // Step 1: Connect to MongoDB
      await this.connectMongoDB();
      
      // Step 2: Create test data (500 responses: 250 CAPI, 250 CATI)
      const createdCount = await this.createTestResponses(500);
      
      // Step 3: Run stress test (500 concurrent agents: 250 CAPI, 250 CATI)
      const testResults = await this.runStressTest(monitor, 500);
      
      // Step 4: Stop monitoring
      const metrics = monitor.stop();
      
      // Step 5: Cleanup test data
      const deletedCount = await this.cleanupTestData();
      
      // Step 6: Save results
      const resultsFile = path.join(this.reportDir, `results-${this.testId}.json`);
      fs.writeFileSync(resultsFile, JSON.stringify({
        testId: this.testId,
        timestamp: new Date().toISOString(),
        surveyId: SURVEY_ID,
        createdResponses: createdCount,
        deletedResponses: deletedCount,
        summary: testResults,
        metrics: metrics.summary
      }, null, 2));
      
      // Step 7: Generate report
      const ReportGenerator = require('./generate-report');
      const generator = new ReportGenerator(this.testId, this.reportDir);
      await generator.generate();
      
      console.log('\n✅ Real Quality Agent Flow Stress Test Complete!');
      console.log(`📄 Results: ${resultsFile}`);
      console.log(`📊 Metrics: ${monitor.metricsFile}`);
      console.log(`\n📈 Summary:`);
      console.log(`   Created: ${createdCount} responses`);
      console.log(`   Processed: ${testResults.processed} agents`);
      console.log(`   Successful: ${testResults.successful}`);
      console.log(`   Partial: ${testResults.partial}`);
      console.log(`   Failed: ${testResults.failed}`);
      console.log(`   Success Rate: ${testResults.processed > 0 ? ((testResults.successful / testResults.processed) * 100).toFixed(2) : 0}%`);
      console.log(`   Total Time: ${testResults.totalTime}s`);
      console.log(`   Deleted: ${deletedCount} responses`);
      
      await mongoose.disconnect();
      process.exit(0);
    } catch (error) {
      monitor.stop();
      console.error('\n❌ Error:', error);
      
      try {
        await this.cleanupTestData();
      } catch (cleanupError) {
        console.error('❌ Cleanup error:', cleanupError);
      }
      
      await mongoose.disconnect();
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const test = new RealFlowStressTest();
  test.run();
}

module.exports = RealFlowStressTest;





