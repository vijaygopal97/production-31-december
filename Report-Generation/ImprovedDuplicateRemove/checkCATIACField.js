#!/usr/bin/env node

/**
 * Quick check script to see CATI responses and their selectedAC field
 */

const path = require('path');
const backendPath = path.join(__dirname, '../../opine/backend');
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  try {
    return originalRequire.apply(this, arguments);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      const backendNodeModules = path.join(backendPath, 'node_modules');
      try {
        return originalRequire.apply(this, [path.join(backendNodeModules, id)]);
      } catch (e) {
        throw err;
      }
    }
    throw err;
  }
};

require('dotenv').config({ path: path.join(backendPath, '.env') });
const mongoose = require('mongoose');
const SurveyResponse = require(path.join(backendPath, 'models/SurveyResponse'));

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // December 30, 2025 IST
  const startDate30IST = new Date('2025-12-30T00:00:00+05:30');
  const endDate30IST = new Date('2025-12-30T23:59:59+05:30');
  const startDate30UTC = new Date(startDate30IST.toISOString());
  const endDate30UTC = new Date(endDate30IST.toISOString());
  
  // Check total Pending_Approval CATI responses
  const totalPending = await SurveyResponse.countDocuments({
    interviewMode: 'cati',
    status: 'Pending_Approval',
    createdAt: { $gte: startDate30UTC, $lte: endDate30UTC }
  });
  
  console.log(`Total Pending_Approval CATI on Dec 30: ${totalPending}`);
  
  // Get a sample
  const sample = await SurveyResponse.find({
    interviewMode: 'cati',
    status: 'Pending_Approval',
    createdAt: { $gte: startDate30UTC, $lte: endDate30UTC }
  })
    .select('_id responseId status selectedAC createdAt')
    .limit(5)
    .lean();
  
  console.log('\nSample responses:');
  sample.forEach(r => {
    console.log(`  ID: ${r.responseId || r._id}, selectedAC: ${r.selectedAC || '(null/empty)'}, type: ${typeof r.selectedAC}`);
  });
  
  // Check how many have null/empty selectedAC
  const withoutAC = await SurveyResponse.countDocuments({
    interviewMode: 'cati',
    status: 'Pending_Approval',
    createdAt: { $gte: startDate30UTC, $lte: endDate30UTC },
    $or: [
      { selectedAC: null },
      { selectedAC: '' },
      { selectedAC: { $exists: false } }
    ]
  });
  
  console.log(`\nResponses without selectedAC: ${withoutAC}`);
  
  await mongoose.disconnect();
}

check().catch(console.error);






