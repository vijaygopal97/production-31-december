const path = require('path');
const Module = require('module');

// Store original script directory BEFORE changing directory
const SCRIPT_DIR = __dirname;
const BACKEND_DIR = path.resolve(SCRIPT_DIR, '../../opine/backend');

// Add backend node_modules to module path
if (!process.env.NODE_PATH) {
  process.env.NODE_PATH = path.join(BACKEND_DIR, 'node_modules');
} else {
  process.env.NODE_PATH = process.env.NODE_PATH + path.delimiter + path.join(BACKEND_DIR, 'node_modules');
}
Module._initPaths();

// Load environment variables
require('dotenv').config({ path: path.join(BACKEND_DIR, '.env') });

// Now require modules
const mongoose = require('mongoose');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';

// Load models (use absolute path since we changed directory)
const SurveyResponse = require(path.join(BACKEND_DIR, 'models/SurveyResponse'));
const User = require(path.join(BACKEND_DIR, 'models/User'));
const Survey = require(path.join(BACKEND_DIR, 'models/Survey'));

// Output directory - use absolute path since we changed directory
const OUTPUT_DIR = SCRIPT_DIR;

/**
 * Normalize responses for comparison
 */
function normalizeResponses(responses) {
  if (!Array.isArray(responses)) return [];
  return responses
    .map(r => ({
      questionId: r.questionId,
      response: normalizeResponseValue(r.response),
      questionType: r.questionType
    }))
    .sort((a, b) => a.questionId.localeCompare(b.questionId));
}

function normalizeResponseValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(v => normalizeResponseValue(v)).sort();
  if (typeof value === 'object') {
    const sorted = {};
    Object.keys(value).sort().forEach(key => {
      sorted[key] = normalizeResponseValue(value[key]);
    });
    return sorted;
  }
  return value;
}

function compareResponses(responses1, responses2) {
  const normalized1 = normalizeResponses(responses1);
  const normalized2 = normalizeResponses(responses2);
  if (normalized1.length !== normalized2.length) return false;
  for (let i = 0; i < normalized1.length; i++) {
    const r1 = normalized1[i];
    const r2 = normalized2[i];
    if (r1.questionId !== r2.questionId) return false;
    if (JSON.stringify(r1.response) !== JSON.stringify(r2.response)) return false;
  }
  return true;
}

function compareAudio(audio1, audio2) {
  if (!audio1 && !audio2) return true;
  if (!audio1 || !audio2) return false;
  const url1 = audio1.audioUrl || audio1.url || '';
  const url2 = audio2.audioUrl || audio2.url || '';
  if (url1 && url2) {
    const filename1 = url1.split('/').pop().split('?')[0];
    const filename2 = url2.split('/').pop().split('?')[0];
    return filename1 === filename2;
  }
  return !url1 && !url2;
}

function areDuplicates(response1, response2) {
  const interviewer1 = response1.interviewer?._id?.toString() || response1.interviewer?.toString() || response1.interviewer;
  const interviewer2 = response2.interviewer?._id?.toString() || response2.interviewer?.toString() || response2.interviewer;
  if (interviewer1 !== interviewer2) return false;
  
  const survey1 = response1.survey?._id?.toString() || response1.survey?.toString() || response1.survey;
  const survey2 = response2.survey?._id?.toString() || response2.survey?.toString() || response2.survey;
  if (survey1 !== survey2) return false;
  
  const timeDiff = Math.abs(new Date(response1.startTime) - new Date(response2.startTime));
  if (timeDiff > 5000) return false;
  
  const durationDiff = Math.abs(response1.totalTimeSpent - response2.totalTimeSpent);
  if (durationDiff > 5) return false;
  
  if (!compareResponses(response1.responses, response2.responses)) return false;
  if (!compareAudio(response1.audioRecording, response2.audioRecording)) return false;
  
  return true;
}

async function findDuplicates() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Filter: Only analyze responses with status: Approved, Pending_Approval, or Rejected
    // Exclude: abandoned, Terminated, completed
    const validStatuses = ['Approved', 'Pending_Approval', 'Rejected'];
    const excludedStatuses = ['abandoned', 'Terminated', 'completed'];
    
    const totalCount = await SurveyResponse.countDocuments({});
    const validCount = await SurveyResponse.countDocuments({ status: { $in: validStatuses } });
    const excludedCount = await SurveyResponse.countDocuments({ status: { $in: excludedStatuses } });
    
    console.log(`📊 Total responses in database: ${totalCount}`);
    console.log(`   ✅ Valid statuses (${validStatuses.join(', ')}): ${validCount}`);
    console.log(`   ❌ Excluded statuses (${excludedStatuses.join(', ')}): ${excludedCount}\n`);
    
    // Step 1: Find duplicate sessionIds (only for valid statuses)
    console.log('🔍 Step 1: Finding duplicate sessionIds (valid statuses only)...');
    const duplicateSessionIds = await SurveyResponse.aggregate([
      { $match: { status: { $in: validStatuses } } },
      { $group: { _id: '$sessionId', count: { $sum: 1 }, responseIds: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log(`   Found ${duplicateSessionIds.length} sessionIds with multiple responses\n`);
    
    // Step 2: Group by interviewer-survey (only for valid statuses)
    console.log('🔍 Step 2: Grouping by interviewer and survey (valid statuses only)...');
    const potentialGroups = await SurveyResponse.aggregate([
      { $match: { status: { $in: validStatuses } } },
      { $group: { _id: { interviewer: '$interviewer', survey: '$survey' }, count: { $sum: 1 }, responseIds: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log(`   Found ${potentialGroups.length} interviewer-survey combinations with multiple responses\n`);
    
    // Step 3: Detailed comparison
    console.log('🔍 Step 3: Detailed comparison...');
    const duplicateGroups = [];
    const BATCH_SIZE = 5; // Reduced batch size for lower memory usage
    
    for (let i = 0; i < potentialGroups.length; i += BATCH_SIZE) {
      const batch = potentialGroups.slice(i, i + BATCH_SIZE);
      const progress = Math.min(i + BATCH_SIZE, potentialGroups.length);
      if ((i / BATCH_SIZE + 1) % 5 === 0 || i === 0) {
        console.log(`   Processing ${progress}/${potentialGroups.length} groups... (Memory efficient batch processing)`);
      }
      
      for (const group of batch) {
        // Limit the number of responses processed per group to avoid memory issues
        const responseIdsToProcess = group.responseIds.slice(0, 100); // Process max 100 responses per group at a time
        
        const fullResponses = await SurveyResponse.find({ 
          _id: { $in: responseIdsToProcess },
          status: { $in: validStatuses } // Only process valid statuses
        })
          .populate('interviewer', 'name email phone')
          .populate('survey', 'surveyName')
          .select('_id responseId sessionId interviewer survey startTime endTime totalTimeSpent responses audioRecording status createdAt')
          .lean()
          .limit(100); // Additional safety limit
        
        const processed = new Set();
        for (let j = 0; j < fullResponses.length; j++) {
          if (processed.has(j)) continue;
          const response1 = fullResponses[j];
          const duplicates = [response1];
          
          for (let k = j + 1; k < fullResponses.length; k++) {
            if (processed.has(k)) continue;
            if (areDuplicates(response1, fullResponses[k])) {
              duplicates.push(fullResponses[k]);
              processed.add(k);
            }
          }
          
          if (duplicates.length > 1) {
            duplicates.sort((a, b) => {
              const timeA = a.createdAt ? new Date(a.createdAt).getTime() : a._id.getTimestamp().getTime();
              const timeB = b.createdAt ? new Date(b.createdAt).getTime() : b._id.getTimestamp().getTime();
              return timeA - timeB;
            });
            duplicateGroups.push(duplicates);
            processed.add(j);
          }
        }
        
        // Force garbage collection hint after processing each group
        if (global.gc) {
          global.gc();
        }
      }
      
      // Small delay between batches to prevent overwhelming the server
      if (i + BATCH_SIZE < potentialGroups.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ Found ${duplicateGroups.length} confirmed duplicate groups\n`);
    
    // Generate report
    const report = {
      totalResponses: totalCount,
      validStatusResponses: validCount,
      excludedStatusResponses: excludedCount,
      validStatuses: validStatuses,
      excludedStatuses: excludedStatuses,
      duplicateSessionIds: duplicateSessionIds.length,
      duplicateGroups: duplicateGroups.length,
      totalDuplicates: duplicateGroups.reduce((sum, group) => sum + group.length, 0),
      duplicateSessionIdDetails: duplicateSessionIds.map(g => ({
        sessionId: g._id,
        count: g.count,
        responseIds: g.responseIds.map(id => id.toString())
      })),
      groups: duplicateGroups.map((group, index) => {
        const original = group[0];
        const duplicates = group.slice(1);
        return {
          groupNumber: index + 1,
          original: {
            responseId: original.responseId || original._id.toString(),
            mongoId: original._id.toString(),
            sessionId: original.sessionId,
            interviewer: {
              id: original.interviewer?._id?.toString() || original.interviewer?.toString() || 'Unknown',
              name: original.interviewer?.name || 'Unknown',
              email: original.interviewer?.email || 'N/A',
              phone: original.interviewer?.phone || 'N/A'
            },
            survey: {
              id: original.survey?._id?.toString() || original.survey?.toString() || 'Unknown',
              name: original.survey?.surveyName || 'Unknown'
            },
            startTime: original.startTime,
            endTime: original.endTime,
            duration: original.totalTimeSpent,
            status: original.status,
            audioUrl: original.audioRecording?.audioUrl || original.audioRecording?.url || 'No audio',
            createdAt: original.createdAt || original._id.getTimestamp(),
            responseCount: original.responses?.length || 0
          },
          duplicates: duplicates.map(dup => ({
            responseId: dup.responseId || dup._id.toString(),
            mongoId: dup._id.toString(),
            sessionId: dup.sessionId,
            startTime: dup.startTime,
            endTime: dup.endTime,
            duration: dup.totalTimeSpent,
            status: dup.status,
            audioUrl: dup.audioRecording?.audioUrl || dup.audioRecording?.url || 'No audio',
            createdAt: dup.createdAt || dup._id.getTimestamp(),
            responseCount: dup.responses?.length || 0,
            timeDifference: Math.abs(new Date(original.startTime) - new Date(dup.startTime))
          }))
        };
      })
    };
    
    // Print summary
    console.log('='.repeat(80));
    console.log('DUPLICATE RESPONSES REPORT');
    console.log('='.repeat(80));
    console.log(`Total Responses: ${report.totalResponses}`);
    console.log(`Valid Status Responses (${validStatuses.join(', ')}): ${report.validStatusResponses}`);
    console.log(`Excluded Status Responses (${excludedStatuses.join(', ')}): ${report.excludedStatusResponses}`);
    console.log(`Duplicate SessionIds: ${report.duplicateSessionIds} (CRITICAL)`);
    console.log(`Duplicate Groups: ${report.duplicateGroups}`);
    console.log(`Total Duplicate Entries: ${report.totalDuplicates - report.duplicateGroups}`);
    console.log('='.repeat(80));
    
    if (duplicateSessionIds.length > 0) {
      console.log('\n🔴 CRITICAL: Duplicate SessionIds:');
      duplicateSessionIds.slice(0, 10).forEach((g, idx) => {
        console.log(`   ${idx + 1}. SessionId: ${g._id} - ${g.count} responses`);
      });
      if (duplicateSessionIds.length > 10) {
        console.log(`   ... and ${duplicateSessionIds.length - 10} more`);
      }
    }
    
    // Save reports to OUTPUT_DIR
    const fs = require('fs');
    const reportPath = path.join(OUTPUT_DIR, `duplicate_responses_report_${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ JSON report saved to: ${reportPath}`);
    
    // CSV
    const csvRows = ['Group Number,Type,Response ID,Mongo ID,Session ID,Interviewer Name,Interviewer Email,Survey Name,Start Time,Duration (seconds),Status,Audio URL,Created At'];
    report.groups.forEach(group => {
      csvRows.push([
        group.groupNumber, 'ORIGINAL', group.original.responseId, group.original.mongoId, group.original.sessionId,
        `"${group.original.interviewer.name}"`, group.original.interviewer.email, `"${group.original.survey.name}"`,
        new Date(group.original.startTime).toISOString(), group.original.duration, group.original.status,
        group.original.audioUrl, new Date(group.original.createdAt).toISOString()
      ].join(','));
      group.duplicates.forEach(dup => {
        csvRows.push([
          group.groupNumber, 'DUPLICATE', dup.responseId, dup.mongoId, dup.sessionId,
          `"${group.original.interviewer.name}"`, group.original.interviewer.email, `"${group.original.survey.name}"`,
          new Date(dup.startTime).toISOString(), dup.duration, dup.status,
          dup.audioUrl, new Date(dup.createdAt).toISOString()
        ].join(','));
      });
    });
    
    const csvPath = path.join(OUTPUT_DIR, `duplicate_responses_report_${new Date().toISOString().split('T')[0]}.csv`);
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`✅ CSV report saved to: ${csvPath}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Analysis complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

findDuplicates();
