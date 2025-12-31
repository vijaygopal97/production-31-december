require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');

const isProduction = process.argv.includes('--production');
const MONGODB_URI = isProduction 
  ? process.env.PRODUCTION_MONGO_URI || process.env.MONGODB_URI
  : process.env.MONGODB_URI;

async function checkStatus() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} database\n`);
  
  // Overall status distribution
  const stats = await SurveyResponse.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  console.log('=== OVERALL STATUS DISTRIBUTION ===');
  stats.forEach(s => console.log(`  ${s._id}: ${s.count}`));
  
  // By interview mode
  const statsByMode = await SurveyResponse.aggregate([
    { $group: { _id: { mode: '$interviewMode', status: '$status' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  console.log('\n=== STATUS BY INTERVIEW MODE ===');
  statsByMode.forEach(s => {
    const mode = s._id.mode || 'null';
    const status = s._id.status || 'null';
    console.log(`  ${mode} - ${status}: ${s.count}`);
  });
  
  // Pending_Approval breakdown
  const pendingApproval = await SurveyResponse.countDocuments({ status: 'Pending_Approval' });
  const catiPending = await SurveyResponse.countDocuments({ interviewMode: 'cati', status: 'Pending_Approval' });
  const capiPending = await SurveyResponse.countDocuments({ interviewMode: 'capi', status: 'Pending_Approval' });
  
  console.log('\n=== PENDING_APPROVAL BREAKDOWN ===');
  console.log(`  Total Pending_Approval: ${pendingApproval}`);
  console.log(`  CATI Pending_Approval: ${catiPending}`);
  console.log(`  CAPI Pending_Approval: ${capiPending}`);
  
  // Check abandonedReason vs status
  const withAbandonReason = await SurveyResponse.countDocuments({ 
    abandonedReason: { $exists: true, $ne: null, $ne: '' },
    status: 'Pending_Approval'
  });
  const totalWithAbandonReason = await SurveyResponse.countDocuments({ 
    abandonedReason: { $exists: true, $ne: null, $ne: '' }
  });
  const totalAbandoned = await SurveyResponse.countDocuments({ status: 'abandoned' });
  
  console.log('\n=== ABANDONED REASON ANALYSIS ===');
  console.log(`  Responses with abandonedReason: ${totalWithAbandonReason}`);
  console.log(`  Responses with abandonedReason but status=Pending_Approval: ${withAbandonReason}`);
  console.log(`  Total responses with status=abandoned: ${totalAbandoned}`);
  
  // Check recent changes
  const recentChanges = await SurveyResponse.countDocuments({ 
    'metadata.abandonedStatusFixed': { $exists: true }
  });
  console.log(`  Responses with abandonedStatusFixed metadata: ${recentChanges}`);
  
  await mongoose.connection.close();
}

checkStatus().catch(console.error);

