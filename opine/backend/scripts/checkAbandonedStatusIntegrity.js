#!/usr/bin/env node

/**
 * Data Integrity Check Script: Abandoned Responses Status
 * 
 * This script checks for responses that have abandonedReason but are NOT in 'abandoned' status.
 * This is a critical data integrity issue that should never happen.
 * 
 * Usage:
 *   node scripts/checkAbandonedStatusIntegrity.js
 * 
 * Output:
 *   - Console log with summary
 *   - JSON report file: reports/abandoned-status-integrity-check-{timestamp}.json
 * 
 * Exit Codes:
 *   0 - No issues found
 *   1 - Issues found (responses with abandonedReason in wrong status)
 */

const mongoose = require('mongoose');
require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Helper function to check if abandonedReason is valid
const hasValidAbandonedReason = (abandonedReason) => {
  return abandonedReason && 
         typeof abandonedReason === 'string' &&
         abandonedReason.trim() !== '' &&
         abandonedReason !== 'No reason specified' &&
         abandonedReason.toLowerCase() !== 'null' &&
         abandonedReason.toLowerCase() !== 'undefined';
};

async function checkAbandonedStatusIntegrity() {
  try {
    console.log('🔍 Starting Abandoned Status Integrity Check...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false }));
    
    // Check for responses with abandonedReason in wrong statuses
    const pendingApproval = await SurveyResponse.find({
      status: 'Pending_Approval',
      abandonedReason: { $exists: true, $ne: null }
    })
    .select('responseId status abandonedReason updatedAt createdAt survey interviewer')
    .lean();
    
    const approved = await SurveyResponse.find({
      status: 'Approved',
      abandonedReason: { $exists: true, $ne: null }
    })
    .select('responseId status abandonedReason updatedAt createdAt survey interviewer')
    .lean();
    
    const rejected = await SurveyResponse.find({
      status: 'Rejected',
      abandonedReason: { $exists: true, $ne: null }
    })
    .select('responseId status abandonedReason updatedAt createdAt survey interviewer')
    .lean();
    
    // Filter to only include responses with valid abandonedReason
    const validPendingApproval = pendingApproval.filter(r => hasValidAbandonedReason(r.abandonedReason));
    const validApproved = approved.filter(r => hasValidAbandonedReason(r.abandonedReason));
    const validRejected = rejected.filter(r => hasValidAbandonedReason(r.abandonedReason));
    
    const totalIssues = validPendingApproval.length + validApproved.length + validRejected.length;
    
    // Display results
    console.log('📊 RESULTS:');
    console.log('===========\n');
    console.log(`Pending_Approval + abandonedReason: ${validPendingApproval.length}`);
    console.log(`Approved + abandonedReason: ${validApproved.length}`);
    console.log(`Rejected + abandonedReason: ${validRejected.length}`);
    console.log(`\nTotal Issues: ${totalIssues}\n`);
    
    // Generate report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(__dirname, '..', 'reports', `abandoned-status-integrity-check-${timestamp}.json`);
    
    const report = {
      checkTimestamp: new Date().toISOString(),
      totalIssues: totalIssues,
      summary: {
        pendingApproval: {
          count: validPendingApproval.length,
          description: 'Responses with abandonedReason incorrectly in Pending_Approval status'
        },
        approved: {
          count: validApproved.length,
          description: 'Responses with abandonedReason incorrectly in Approved status'
        },
        rejected: {
          count: validRejected.length,
          description: 'Responses with abandonedReason incorrectly in Rejected status'
        }
      },
      issues: {
        pendingApproval: validPendingApproval.map(r => ({
          responseId: r.responseId,
          status: r.status,
          abandonedReason: r.abandonedReason,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          surveyId: r.survey?.toString(),
          interviewerId: r.interviewer?.toString()
        })),
        approved: validApproved.map(r => ({
          responseId: r.responseId,
          status: r.status,
          abandonedReason: r.abandonedReason,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          surveyId: r.survey?.toString(),
          interviewerId: r.interviewer?.toString()
        })),
        rejected: validRejected.map(r => ({
          responseId: r.responseId,
          status: r.status,
          abandonedReason: r.abandonedReason,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          surveyId: r.survey?.toString(),
          interviewerId: r.interviewer?.toString()
        }))
      },
      breakdown: {
        byAbandonedReason: {},
        bySurvey: {},
        byDate: {}
      }
    };
    
    // Generate breakdowns
    [...validPendingApproval, ...validApproved, ...validRejected].forEach(r => {
      const reason = r.abandonedReason || 'Unknown';
      report.breakdown.byAbandonedReason[reason] = (report.breakdown.byAbandonedReason[reason] || 0) + 1;
      
      const surveyId = r.survey?.toString() || 'Unknown';
      report.breakdown.bySurvey[surveyId] = (report.breakdown.bySurvey[surveyId] || 0) + 1;
      
      const date = new Date(r.updatedAt).toISOString().split('T')[0];
      report.breakdown.byDate[date] = (report.breakdown.byDate[date] || 0) + 1;
    });
    
    // Save report
    const reportsDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to: ${reportPath}\n`);
    
    // Display breakdown if issues found
    if (totalIssues > 0) {
      console.log('⚠️  ISSUES DETECTED!\n');
      console.log('Breakdown by Abandoned Reason:');
      Object.entries(report.breakdown.byAbandonedReason)
        .sort((a, b) => b[1] - a[1])
        .forEach(([reason, count]) => {
          console.log(`  - ${reason}: ${count}`);
        });
      
      console.log('\nBreakdown by Survey:');
      Object.entries(report.breakdown.bySurvey)
        .sort((a, b) => b[1] - a[1])
        .forEach(([surveyId, count]) => {
          console.log(`  - ${surveyId}: ${count}`);
        });
      
      console.log('\nBreakdown by Date (Updated):');
      Object.entries(report.breakdown.byDate)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .forEach(([date, count]) => {
          console.log(`  - ${date}: ${count}`);
        });
      
      console.log('\n❌ CRITICAL: Data integrity violation detected!');
      console.log('   These responses should be in "abandoned" status but are not.');
      console.log('   This indicates the prevention mechanisms may have been bypassed.\n');
      
      process.exit(1);
    } else {
      console.log('✅ NO ISSUES FOUND');
      console.log('   All responses with abandonedReason are correctly in "abandoned" status.\n');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Error during integrity check:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the check
checkAbandonedStatusIntegrity();



