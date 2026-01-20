/**
 * Comprehensive 5-Minute Prolonged Stress Test - CLEAN VERSION
 * 
 * Success Criteria:
 * - Quality Agent: next-review returns success:true AND verify returns success:true
 * - CATI Interviewer: start returns success:true (respondent assigned)
 * - CAPI Interviewer: start returns success:true (interview started)
 * - Project Manager/Admin: analytics-v2 returns success:true
 * 
 * Note: "No Pending Respondents" (success:false) is NOT counted as success
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../backend/.env') });
const axios = require('axios');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.API_BASE_URL || 'https://convo.convergentview.com';
const SURVEY_ID = '68fd1915d41841da463f0d46';
const TEST_DURATION_SECONDS = 300; // 5 minutes
const TEST_MARKER = 'STRESS_TEST_5MIN';

// Track quality checks for reversion
const qualityCheckTracker = {
  checks: new Map(),
  addCheck(responseId, originalData) {
    if (!this.checks.has(responseId)) {
      this.checks.set(responseId, originalData);
    }
  },
  getAllChecks() {
    return Array.from(this.checks.entries());
  },
  clear() {
    this.checks.clear();
  }
};

// User credentials
const QUALITY_AGENT = { email: 'adarshquality123@gmail.com', password: 'Vijaygopal97' };
const CATI_INTERVIEWER = { email: 'vishalinterviewer@gmail.com', password: 'Demopassword@123' };
const CAPI_INTERVIEWER = { email: 'ajithinterviewer@gmail.com', password: 'Demopassword@123' };
const COMPANY_ADMIN = { email: 'ajayadarsh@gmail.com', password: 'Vijaygopal97' };

class UserEmulator {
  constructor(userType, index, monitor) {
    this.userType = userType;
    this.index = index;
    this.monitor = monitor;
    this.token = null;
    this.stats = {
      requests: 0,
      successes: 0,
      failures: 0,
      totalTime: 0
    };
  }

  async login() {
    let credentials;
    switch (this.userType) {
      case 'quality_agent':
        credentials = QUALITY_AGENT;
        break;
      case 'cati_interviewer':
        credentials = CATI_INTERVIEWER;
        break;
      case 'capi_interviewer':
        credentials = CAPI_INTERVIEWER;
        break;
      case 'project_manager':
      case 'company_admin':
        credentials = COMPANY_ADMIN;
        break;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, credentials, { timeout: 30000 });
      if (response.data.success) {
        this.token = response.data.token || response.data.data?.token;
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async executeAction() {
    const startTime = Date.now();
    this.stats.requests++;
    
    try {
      let success = false;
      
      switch (this.userType) {
        case 'quality_agent':
          success = await this.qualityAgentAction();
          break;
        case 'cati_interviewer':
          success = await this.catiInterviewerAction();
          break;
        case 'capi_interviewer':
          success = await this.capiInterviewerAction();
          break;
        case 'project_manager':
          success = await this.projectManagerAction();
          break;
        case 'company_admin':
          success = await this.companyAdminAction();
          break;
      }
      
      const responseTime = Date.now() - startTime;
      this.stats.totalTime += responseTime;
      
      if (this.monitor) {
        this.monitor.recordAPICall(responseTime);
      }
      
      if (success) {
        this.stats.successes++;
      } else {
        this.stats.failures++;
      }
      
      return success;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.stats.totalTime += responseTime;
      this.stats.failures++;
      if (this.monitor) {
        this.monitor.recordAPICall(responseTime);
      }
      return false;
    }
  }

  async qualityAgentAction() {
    const interviewMode = this.index % 2 === 0 ? 'capi' : 'cati';
    
    try {
      // Get next review assignment
      const response = await axios.get(`${API_BASE_URL}/api/survey-responses/next-review`, {
        headers: { 'Authorization': `Bearer ${this.token}` },
        params: { surveyId: SURVEY_ID, interviewMode },
        timeout: 30000
      });
      
      // Only proceed if we got a successful assignment
      if (response.data && response.data.success === true && response.data.data && response.data.data.interview) {
        const assignment = response.data.data.interview;
        const responseId = assignment.responseId || assignment._id?.toString();
        
        if (responseId) {
          qualityCheckTracker.addCheck(responseId, {
            originalStatus: assignment.status || 'Pending_Approval',
            originalVerificationData: assignment.verificationData || null,
            originalReviewAssignment: assignment.reviewAssignment || null,
            trackedAt: new Date()
          });
          
          // Submit verification
          const criteria = this.generateVerificationCriteria();
          const status = Math.random() < 0.7 ? 'approved' : 'rejected';
          
          const verifyResponse = await axios.post(
            `${API_BASE_URL}/api/survey-responses/verify`,
            {
              responseId,
              status,
              verificationCriteria: criteria,
              feedback: status === 'rejected' ? 'Test rejection' : ''
            },
            {
              headers: { 'Authorization': `Bearer ${this.token}` },
              timeout: 60000
            }
          );
          
          // Success = both assignment AND verification succeeded
          return verifyResponse.data && verifyResponse.data.success === true;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async catiInterviewerAction() {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/cati-interview/start/${SURVEY_ID}`,
        {},
        {
          headers: { 'Authorization': `Bearer ${this.token}` },
          timeout: 30000
        }
      );
      
      // Success = API returned success:true (respondent assigned)
      return response.data && response.data.success === true;
    } catch (error) {
      return false;
    }
  }

  async capiInterviewerAction() {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/survey-responses/start/${SURVEY_ID}`,
        {},
        {
          headers: { 'Authorization': `Bearer ${this.token}` },
          timeout: 30000
        }
      );
      
      // Success = API returned success:true (interview started)
      return response.data && response.data.success === true;
    } catch (error) {
      return false;
    }
  }

  async projectManagerAction() {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/surveys/${SURVEY_ID}/analytics-v2`,
        {
          headers: { 'Authorization': `Bearer ${this.token}` },
          params: { timeRange: 'all' },
          timeout: 60000
        }
      );
      
      // Success = API returned success:true
      return response.data && response.data.success === true;
    } catch (error) {
      return false;
    }
  }

  async companyAdminAction() {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/surveys/${SURVEY_ID}/analytics-v2`,
        {
          headers: { 'Authorization': `Bearer ${this.token}` },
          params: { timeRange: 'all' },
          timeout: 60000
        }
      );
      
      // Success = API returned success:true
      return response.data && response.data.success === true;
    } catch (error) {
      return false;
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

  getStats() {
    return {
      requests: this.stats.requests,
      successes: this.stats.successes,
      failures: this.stats.failures,
      totalTime: this.stats.totalTime,
      avgResponseTime: this.stats.requests > 0 ? (this.stats.totalTime / this.stats.requests).toFixed(2) : 0,
      successRate: this.stats.requests > 0 ? ((this.stats.successes / this.stats.requests) * 100).toFixed(2) : 0
    };
  }
}

// Copy the rest from the original file (ComprehensiveStressTest class, run method, cleanup, etc.)
// This is just the UserEmulator class - we need the full file structure




