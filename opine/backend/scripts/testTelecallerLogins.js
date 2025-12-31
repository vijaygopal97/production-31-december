/**
 * Script to test logins for all Telecaller Group 1 users
 * Tests login through the actual login endpoint
 */

const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/User');
require('dotenv').config();

const SURVEY_ID = '68fd1915d41841da463f0d46';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// Read Excel data
const { execSync } = require('child_process');
const path = require('path');

const readExcelFile = async () => {
  try {
    const pythonScript = path.join(__dirname, 'readTelecallerGroup1Excel.py');
    const output = execSync(`python3 "${pythonScript}"`, { encoding: 'utf-8' });
    return JSON.parse(output.trim());
  } catch (error) {
    console.error('Error reading Excel file:', error.message);
    throw error;
  }
};

// Test login via API endpoint
const testLoginAPI = async (email, password) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: email.toLowerCase(),
      password: password
    }, {
      timeout: 10000,
      validateStatus: (status) => status < 500 // Don't throw on 4xx
    });
    
    return {
      success: response.status === 200 && response.data.success !== false,
      status: response.status,
      data: response.data,
      error: response.status !== 200 ? (response.data.message || response.data.error || 'Login failed') : null
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 0,
      error: error.message || 'Network error',
      data: error.response?.data
    };
  }
};

// Test login via User model
const testLoginModel = async (email, password) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    const isValid = await user.comparePassword(password);
    return { 
      success: isValid, 
      error: isValid ? null : 'Invalid password'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const main = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/opine';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    console.log('📖 Reading Excel file...');
    const excelData = await readExcelFile();
    console.log(`✅ Found ${excelData.length} interviewers in Excel\n`);

    console.log('🔐 Testing Logins\n');
    console.log('='.repeat(80));
    
    const results = [];
    
    for (const row of excelData) {
      try {
        const callerName = row['Caller Name']?.trim();
        const callerMobile = row['Caller Mobile No.']?.toString().trim();
        const callerId = row['Caller ID']?.toString().trim();
        
        if (!callerName || !callerMobile || !callerId) {
          continue;
        }
        
        const email = `cati${callerId}@gmail.com`;
        const password = callerMobile;
        
        console.log(`\n📝 Testing: ${callerName} (${callerId})`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        
        // Test via User model
        const modelTest = await testLoginModel(email, password);
        console.log(`   Model Test: ${modelTest.success ? '✅ PASSED' : '❌ FAILED'} ${modelTest.error || ''}`);
        
        // Test via API endpoint
        const apiTest = await testLoginAPI(email, password);
        console.log(`   API Test: ${apiTest.success ? '✅ PASSED' : '❌ FAILED'} ${apiTest.error || ''}`);
        
        results.push({
          callerId,
          callerName,
          email,
          password,
          modelTest: modelTest.success,
          apiTest: apiTest.success,
          modelError: modelTest.error,
          apiError: apiTest.error
        });
      } catch (error) {
        console.error(`❌ Error testing ${row['Caller ID']}:`, error.message);
        results.push({
          callerId: row['Caller ID'],
          error: error.message
        });
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 Login Test Summary:');
    console.log('='.repeat(80));
    
    const modelPassed = results.filter(r => r.modelTest === true).length;
    const modelFailed = results.filter(r => r.modelTest === false).length;
    const apiPassed = results.filter(r => r.apiTest === true).length;
    const apiFailed = results.filter(r => r.apiTest === false).length;
    
    console.log(`\nUser Model Tests:`);
    console.log(`   ✅ Passed: ${modelPassed}/${results.length}`);
    console.log(`   ❌ Failed: ${modelFailed}/${results.length}`);
    
    console.log(`\nAPI Endpoint Tests:`);
    console.log(`   ✅ Passed: ${apiPassed}/${results.length}`);
    console.log(`   ❌ Failed: ${apiFailed}/${results.length}`);
    
    if (modelFailed > 0) {
      console.log(`\n⚠️  Model Test Failures:`);
      results.filter(r => r.modelTest === false).forEach(r => {
        console.log(`   - ${r.email}: ${r.modelError}`);
      });
    }
    
    if (apiFailed > 0) {
      console.log(`\n⚠️  API Test Failures:`);
      results.filter(r => r.apiTest === false).forEach(r => {
        console.log(`   - ${r.email}: ${r.apiError}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

module.exports = { testLoginAPI, testLoginModel };

