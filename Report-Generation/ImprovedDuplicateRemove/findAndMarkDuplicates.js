#!/usr/bin/env node

/**
 * Comprehensive Duplicate Detection and Cleanup Script
 * 
 * This script finds duplicate SurveyResponses based on specific criteria:
 * 
 * CAPI Duplicates (ALL conditions must match):
 * - All responses match exactly
 * - Audio recording is same (duration, fileSize, format, codec, bitrate)
 * - Same interviewer
 * - Same interview timing (startTime)
 * - Same GPS coordinates (latitude, longitude)
 * 
 * CATI Duplicates (ALL conditions must match):
 * - Same interviewer
 * - All responses match exactly
 * - Same interview time (startTime)
 * - Same call_id
 * 
 * The first found response in each duplicate group is kept as original.
 * All duplicates are marked as "abandoned".
 * 
 * Processing is done in batches to avoid server crashes.
 */

const path = require('path');
const fs = require('fs');

// Set up module resolution to use backend's node_modules
const backendPath = path.join(__dirname, '../../opine/backend');

// Add backend's node_modules to module path
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  try {
    return originalRequire.apply(this, arguments);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      // Try loading from backend's node_modules
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

// Now require modules
require('dotenv').config({ path: path.join(backendPath, '.env') });
const mongoose = require('mongoose');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';

// Load models (need to load all models for populate to work)
const SurveyResponse = require(path.join(backendPath, 'models/SurveyResponse'));
const User = require(path.join(backendPath, 'models/User'));
const Survey = require(path.join(backendPath, 'models/Survey'));

// Configuration - Optimized for speed
const BATCH_SIZE = 1000; // Process responses in larger batches for speed
const COMPARISON_BATCH_SIZE = 200; // Compare in larger batches
const PARALLEL_BATCHES = 5; // Process multiple batches in parallel
const REPORT_DIR = path.join(__dirname); // Keep original report directory
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

// Statistics
const stats = {
  totalProcessed: 0,
  capiProcessed: 0,
  catiProcessed: 0,
  capiDuplicatesFound: 0,
  catiDuplicatesFound: 0,
  totalDuplicatesMarked: 0,
  errors: []
};

/**
 * Normalize responses for comparison
 */
function normalizeResponses(responses) {
  if (!Array.isArray(responses)) return [];
  return responses
    .map(r => ({
      questionId: r.questionId || '',
      response: normalizeResponseValue(r.response),
      questionType: r.questionType || ''
    }))
    .sort((a, b) => a.questionId.localeCompare(b.questionId));
}

function normalizeResponseValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map(v => normalizeResponseValue(v)).sort();
  }
  if (typeof value === 'object') {
    const sorted = {};
    Object.keys(value).sort().forEach(key => {
      sorted[key] = normalizeResponseValue(value[key]);
    });
    return sorted;
  }
  return value;
}

/**
 * Compare two response arrays for exact match
 */
function compareResponses(responses1, responses2) {
  const normalized1 = normalizeResponses(responses1);
  const normalized2 = normalizeResponses(responses2);
  
  if (normalized1.length !== normalized2.length) return false;
  
  for (let i = 0; i < normalized1.length; i++) {
    const r1 = normalized1[i];
    const r2 = normalized2[i];
    
    if (r1.questionId !== r2.questionId) return false;
    if (r1.questionType !== r2.questionType) return false;
    
    // Deep comparison of response values
    const resp1Str = JSON.stringify(r1.response);
    const resp2Str = JSON.stringify(r2.response);
    if (resp1Str !== resp2Str) return false;
  }
  
  return true;
}

/**
 * Compare audio recordings for CAPI
 * Checks: duration, fileSize, format, codec, bitrate
 */
function compareAudio(audio1, audio2) {
  // Both missing audio - consider same
  if ((!audio1 || !audio1.recordingDuration) && (!audio2 || !audio2.recordingDuration)) {
    return true;
  }
  
  // One has audio, other doesn't - different
  if ((!audio1 || !audio1.recordingDuration) || (!audio2 || !audio2.recordingDuration)) {
    return false;
  }
  
  // Compare audio signatures
  const duration1 = audio1.recordingDuration || 0;
  const duration2 = audio2.recordingDuration || 0;
  
  // Allow 1 second tolerance for duration
  if (Math.abs(duration1 - duration2) > 1) return false;
  
  // Compare file size (allow 1KB tolerance)
  const fileSize1 = audio1.fileSize || 0;
  const fileSize2 = audio2.fileSize || 0;
  if (Math.abs(fileSize1 - fileSize2) > 1024) return false;
  
  // Compare format
  const format1 = (audio1.format || '').toLowerCase();
  const format2 = (audio2.format || '').toLowerCase();
  if (format1 && format2 && format1 !== format2) return false;
  
  // Compare codec
  const codec1 = (audio1.codec || '').toLowerCase();
  const codec2 = (audio2.codec || '').toLowerCase();
  if (codec1 && codec2 && codec1 !== codec2) return false;
  
  // Compare bitrate (allow 1kbps tolerance)
  const bitrate1 = audio1.bitrate || 0;
  const bitrate2 = audio2.bitrate || 0;
  if (bitrate1 && bitrate2 && Math.abs(bitrate1 - bitrate2) > 1000) return false;
  
  return true;
}

/**
 * Compare GPS coordinates
 * Allows small tolerance for GPS accuracy
 */
function compareGPS(loc1, loc2) {
  if (!loc1 || !loc2) {
    // Both missing - consider same
    if (!loc1 && !loc2) return true;
    // One missing - different
    return false;
  }
  
  const lat1 = loc1.latitude;
  const lon1 = loc1.longitude;
  const lat2 = loc2.latitude;
  const lon2 = loc2.longitude;
  
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return !lat1 && !lon1 && !lat2 && !lon2;
  }
  
  // Allow 0.0001 degree tolerance (~11 meters)
  const latDiff = Math.abs(lat1 - lat2);
  const lonDiff = Math.abs(lon1 - lon2);
  
  return latDiff < 0.0001 && lonDiff < 0.0001;
}

/**
 * Compare interview timing
 * Allows 1 second tolerance
 */
function compareTiming(time1, time2) {
  if (!time1 || !time2) return false;
  const diff = Math.abs(new Date(time1).getTime() - new Date(time2).getTime());
  return diff < 1000; // 1 second tolerance
}

/**
 * Check if two CAPI responses are duplicates
 */
function areCAPIDuplicates(response1, response2) {
  // 1. All responses must match
  if (!compareResponses(response1.responses || [], response2.responses || [])) {
    return false;
  }
  
  // 2. Audio recording must be same
  if (!compareAudio(response1.audioRecording, response2.audioRecording)) {
    return false;
  }
  
  // 3. Interviewer must be same
  const interviewer1 = response1.interviewer?.toString() || response1.interviewer;
  const interviewer2 = response2.interviewer?.toString() || response2.interviewer;
  if (interviewer1 !== interviewer2) {
    return false;
  }
  
  // 4. Interview timing must be same
  if (!compareTiming(response1.startTime, response2.startTime)) {
    return false;
  }
  
  // 5. GPS coordinates must be same
  if (!compareGPS(response1.location, response2.location)) {
    return false;
  }
  
  return true;
}

/**
 * Check if two CATI responses are duplicates
 */
function areCATIDuplicates(response1, response2) {
  // 1. Interviewer must be same
  const interviewer1 = response1.interviewer?.toString() || response1.interviewer;
  const interviewer2 = response2.interviewer?.toString() || response2.interviewer;
  if (interviewer1 !== interviewer2) {
    return false;
  }
  
  // 2. All responses must match exactly
  if (!compareResponses(response1.responses || [], response2.responses || [])) {
    return false;
  }
  
  // 3. Interview time must be same
  if (!compareTiming(response1.startTime, response2.startTime)) {
    return false;
  }
  
  // 4. call_id must be same
  const callId1 = (response1.call_id || '').toString().trim();
  const callId2 = (response2.call_id || '').toString().trim();
  if (!callId1 || !callId2 || callId1 !== callId2) {
    return false;
  }
  
  return true;
}

/**
 * Process CAPI responses in batches
 */
async function processCAPIDuplicates() {
  console.log('\n📱 Processing CAPI responses...');
  
  // Calculate today's date range (IST) for CAPI as well
  const today = new Date();
  const todayIST = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const startDateIST = new Date(todayIST.getFullYear(), todayIST.getMonth(), todayIST.getDate(), 0, 0, 0);
  const endDateIST = new Date(todayIST.getFullYear(), todayIST.getMonth(), todayIST.getDate(), 23, 59, 59);
  
  // Convert to UTC
  const startDateUTC = new Date(startDateIST.getTime() - (5.5 * 60 * 60 * 1000));
  const endDateUTC = new Date(endDateIST.getTime() - (5.5 * 60 * 60 * 1000));
  
  console.log(`   Date Range: ${startDateIST.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })} (IST)`);
  console.log(`   UTC Range: ${startDateUTC.toISOString()} to ${endDateUTC.toISOString()}`);
  
  // Get all CAPI responses from today only (excluding already abandoned)
  const capiQuery = {
    interviewMode: 'capi',
    status: { $ne: 'abandoned' }, // Don't process already abandoned
    createdAt: {
      $gte: startDateUTC,
      $lte: endDateUTC
    }
  };
  
  const totalCAPI = await SurveyResponse.countDocuments(capiQuery);
  console.log(`   Found ${totalCAPI} CAPI responses to analyze`);
  
  if (totalCAPI === 0) {
    console.log('   ✅ No CAPI responses to process');
    return [];
  }
  
  const duplicateGroups = [];
  let processed = 0;
  
  // Use aggregation to pre-group potential duplicates by interviewer+survey
  // This dramatically reduces the number of comparisons needed
  console.log('   Using aggregation to pre-group potential duplicates...');
  const potentialGroups = await SurveyResponse.aggregate([
    { $match: capiQuery },
    {
      $group: {
        _id: {
          interviewer: '$interviewer',
          survey: '$survey'
        },
        responseIds: { $push: '$_id' },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } }, // Only groups with potential duplicates
    { $sort: { count: -1 } }
  ]);
  
  console.log(`   Found ${potentialGroups.length} potential duplicate groups to check`);
  
  // Process potential groups in batches
  for (let i = 0; i < potentialGroups.length; i += BATCH_SIZE) {
    const groupBatch = potentialGroups.slice(i, i + BATCH_SIZE);
    
    // Fetch all responses for these groups at once
    const allResponseIds = groupBatch.flatMap(g => g.responseIds);
    const batch = await SurveyResponse.find({ _id: { $in: allResponseIds } })
      .select('_id responseId sessionId interviewer survey startTime endTime totalTimeSpent responses audioRecording location status createdAt')
      .lean()
      .sort({ createdAt: 1 });
    
    if (batch.length === 0) continue;
    
    // Group by interviewer + survey for efficient comparison
    const grouped = {};
    batch.forEach(resp => {
      const interviewerId = resp.interviewer?.toString() || resp.interviewer;
      const surveyId = resp.survey?.toString() || resp.survey;
      const key = `${interviewerId}_${surveyId}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(resp);
    });
    
    // Compare within each group
    for (const groupKey in grouped) {
      const group = grouped[groupKey];
      if (group.length < 2) continue; // Need at least 2 for duplicates
      
      const processedInGroup = new Set();
      
      for (let i = 0; i < group.length; i++) {
        if (processedInGroup.has(i)) continue;
        
        const response1 = group[i];
        const duplicates = [response1];
        
        for (let j = i + 1; j < group.length; j++) {
          if (processedInGroup.has(j)) continue;
          
          if (areCAPIDuplicates(response1, group[j])) {
            duplicates.push(group[j]);
            processedInGroup.add(j);
          }
        }
        
        if (duplicates.length > 1) {
          // Sort by createdAt to keep first as original
          duplicates.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a._id.getTimestamp ? a._id.getTimestamp().getTime() : new Date(a._id).getTime());
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b._id.getTimestamp ? b._id.getTimestamp().getTime() : new Date(b._id).getTime());
            return timeA - timeB;
          });
          
          duplicateGroups.push({
            mode: 'CAPI',
            original: duplicates[0],
            duplicates: duplicates.slice(1)
          });
          
          processedInGroup.add(i);
          stats.capiDuplicatesFound += duplicates.length - 1;
        }
      }
    }
    
    processed += batch.length;
    stats.capiProcessed += batch.length;
    
    if (i % 10 === 0 || i === potentialGroups.length - 1) {
      console.log(`   Processed ${i + 1}/${potentialGroups.length} groups (${processed} responses)... (Found ${duplicateGroups.length} duplicate groups)`);
    }
  }
  
  console.log(`   ✅ CAPI processing complete: Found ${duplicateGroups.length} duplicate groups`);
  return duplicateGroups;
}

/**
 * Process CATI responses in batches
 */
async function processCATIDuplicates() {
  console.log('\n📞 Processing CATI responses...');
  
  // Calculate today's date range (IST)
  // IST is UTC+5:30
  const today = new Date();
  const todayIST = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const startDateIST = new Date(todayIST.getFullYear(), todayIST.getMonth(), todayIST.getDate(), 0, 0, 0);
  const endDateIST = new Date(todayIST.getFullYear(), todayIST.getMonth(), todayIST.getDate(), 23, 59, 59);
  
  // Convert to UTC
  const startDateUTC = new Date(startDateIST.getTime() - (5.5 * 60 * 60 * 1000));
  const endDateUTC = new Date(endDateIST.getTime() - (5.5 * 60 * 60 * 1000));
  
  console.log(`   Date Range: ${startDateIST.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })} (IST)`);
  console.log(`   UTC Range: ${startDateUTC.toISOString()} to ${endDateUTC.toISOString()}`);
  
  // Get CATI responses from today only (excluding already abandoned)
  const catiQuery = {
    interviewMode: 'cati',
    status: { $ne: 'abandoned' }, // Don't process already abandoned
    createdAt: {
      $gte: startDateUTC,
      $lte: endDateUTC
    }
  };
  
  const totalCATI = await SurveyResponse.countDocuments(catiQuery);
  console.log(`   Found ${totalCATI} CATI responses from today to analyze`);
  
  if (totalCATI === 0) {
    console.log('   ✅ No CATI responses to process');
    return [];
  }
  
  const duplicateGroups = [];
  let processed = 0;
  
  // Use aggregation to pre-group potential duplicates by interviewer+call_id
  // This dramatically reduces the number of comparisons needed
  console.log('   Using aggregation to pre-group potential duplicates...');
  const potentialGroups = await SurveyResponse.aggregate([
    { $match: { ...catiQuery, call_id: { $exists: true, $ne: null, $ne: '' } } },
    {
      $group: {
        _id: {
          interviewer: '$interviewer',
          call_id: '$call_id'
        },
        responseIds: { $push: '$_id' },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } }, // Only groups with potential duplicates
    { $sort: { count: -1 } }
  ]);
  
  console.log(`   Found ${potentialGroups.length} potential duplicate groups to check`);
  
  // Process potential groups in batches
  for (let i = 0; i < potentialGroups.length; i += BATCH_SIZE) {
    const groupBatch = potentialGroups.slice(i, i + BATCH_SIZE);
    
    // Fetch all responses for these groups at once
    const allResponseIds = groupBatch.flatMap(g => g.responseIds);
    const batch = await SurveyResponse.find({ _id: { $in: allResponseIds } })
      .select('_id responseId sessionId interviewer survey startTime endTime totalTimeSpent responses call_id status createdAt')
      .lean()
      .sort({ createdAt: 1 });
    
    if (batch.length === 0) continue;
    
    // Group by interviewer + call_id for efficient comparison
    const grouped = {};
    batch.forEach(resp => {
      const interviewerId = resp.interviewer?.toString() || resp.interviewer;
      const callId = (resp.call_id || '').toString().trim();
      if (!callId) return; // Skip responses without call_id
      
      const key = `${interviewerId}_${callId}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(resp);
    });
    
    // Compare within each group
    for (const groupKey in grouped) {
      const group = grouped[groupKey];
      if (group.length < 2) continue; // Need at least 2 for duplicates
      
      const processedInGroup = new Set();
      
      for (let i = 0; i < group.length; i++) {
        if (processedInGroup.has(i)) continue;
        
        const response1 = group[i];
        const duplicates = [response1];
        
        for (let j = i + 1; j < group.length; j++) {
          if (processedInGroup.has(j)) continue;
          
          if (areCATIDuplicates(response1, group[j])) {
            duplicates.push(group[j]);
            processedInGroup.add(j);
          }
        }
        
        if (duplicates.length > 1) {
          // Sort by createdAt to keep first as original
          duplicates.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a._id.getTimestamp ? a._id.getTimestamp().getTime() : new Date(a._id).getTime());
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b._id.getTimestamp ? b._id.getTimestamp().getTime() : new Date(b._id).getTime());
            return timeA - timeB;
          });
          
          duplicateGroups.push({
            mode: 'CATI',
            original: duplicates[0],
            duplicates: duplicates.slice(1)
          });
          
          processedInGroup.add(i);
          stats.catiDuplicatesFound += duplicates.length - 1;
        }
      }
    }
    
    processed += batch.length;
    stats.catiProcessed += batch.length;
    
    if (i % 10 === 0 || i === potentialGroups.length - 1) {
      console.log(`   Processed ${i + 1}/${potentialGroups.length} groups (${processed} responses)... (Found ${duplicateGroups.length} duplicate groups)`);
    }
  }
  
  console.log(`   ✅ CATI processing complete: Found ${duplicateGroups.length} duplicate groups`);
  return duplicateGroups;
}

/**
 * Generate comprehensive report
 */
function generateReport(allDuplicateGroups) {
  console.log('\n📊 Generating report...');
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalDuplicateGroups: allDuplicateGroups.length,
      capiDuplicateGroups: allDuplicateGroups.filter(g => g.mode === 'CAPI').length,
      catiDuplicateGroups: allDuplicateGroups.filter(g => g.mode === 'CATI').length,
      totalDuplicatesToMark: allDuplicateGroups.reduce((sum, g) => sum + g.duplicates.length, 0),
      totalOriginals: allDuplicateGroups.length
    },
    statistics: {
      totalProcessed: stats.totalProcessed,
      capiProcessed: stats.capiProcessed,
      catiProcessed: stats.catiProcessed,
      capiDuplicatesFound: stats.capiDuplicatesFound,
      catiDuplicatesFound: stats.catiDuplicatesFound
    },
    groups: allDuplicateGroups.map((group, index) => {
      const original = group.original;
      return {
        groupNumber: index + 1,
        mode: group.mode,
        original: {
          responseId: original.responseId || original._id.toString(),
          mongoId: original._id.toString(),
          sessionId: original.sessionId,
          interviewer: {
            id: original.interviewer?.toString() || original.interviewer || 'Unknown',
            name: 'N/A (ID only)',
            email: 'N/A',
            phone: 'N/A',
            memberId: 'N/A'
          },
          survey: {
            id: original.survey?.toString() || original.survey || 'Unknown',
            name: 'N/A (ID only)'
          },
          startTime: original.startTime,
          endTime: original.endTime,
          duration: original.totalTimeSpent,
          status: original.status,
          call_id: original.call_id || null,
          audioUrl: original.audioRecording?.audioUrl || original.audioRecording?.url || 'No audio',
          audioDuration: original.audioRecording?.recordingDuration || 0,
          audioFileSize: original.audioRecording?.fileSize || 0,
          location: original.location ? {
            latitude: original.location.latitude,
            longitude: original.location.longitude
          } : null,
          responseCount: original.responses?.length || 0,
          createdAt: original.createdAt || (original._id.getTimestamp ? original._id.getTimestamp() : new Date(original._id))
        },
        duplicates: group.duplicates.map(dup => ({
          responseId: dup.responseId || dup._id.toString(),
          mongoId: dup._id.toString(),
          sessionId: dup.sessionId,
          startTime: dup.startTime,
          endTime: dup.endTime,
          duration: dup.totalTimeSpent,
          status: dup.status,
          call_id: dup.call_id || null,
          audioUrl: dup.audioRecording?.audioUrl || dup.audioRecording?.url || 'No audio',
          audioDuration: dup.audioRecording?.recordingDuration || 0,
          audioFileSize: dup.audioRecording?.fileSize || 0,
          location: dup.location ? {
            latitude: dup.location.latitude,
            longitude: dup.location.longitude
          } : null,
          responseCount: dup.responses?.length || 0,
          createdAt: dup.createdAt || (dup._id.getTimestamp ? dup._id.getTimestamp() : new Date(dup._id)),
          timeDifference: Math.abs(new Date(original.startTime) - new Date(dup.startTime))
        }))
      };
    })
  };
  
  // Save JSON report
  const jsonPath = path.join(REPORT_DIR, `duplicate_detection_report_${TIMESTAMP}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`   ✅ JSON report saved: ${jsonPath}`);
  
  // Save CSV report
  const csvRows = [
    'Group Number,Mode,Type,Response ID,Mongo ID,Session ID,Interviewer Name,Interviewer Member ID,Survey Name,Start Time,End Time,Duration (seconds),Status,Call ID,Audio URL,Audio Duration,Audio File Size,Latitude,Longitude,Response Count,Created At,Time Difference (ms)'
  ];
  
  report.groups.forEach(group => {
    // Original row
    const orig = group.original;
    csvRows.push([
      group.groupNumber,
      group.mode,
      'ORIGINAL',
      orig.responseId,
      orig.mongoId,
      orig.sessionId,
      `"${orig.interviewer.id}"`,
      orig.interviewer.memberId || 'N/A',
      `"${orig.survey.id}"`,
      new Date(orig.startTime).toISOString(),
      orig.endTime ? new Date(orig.endTime).toISOString() : '',
      orig.duration,
      orig.status,
      orig.call_id || '',
      orig.audioUrl,
      orig.audioDuration,
      orig.audioFileSize,
      orig.location?.latitude || '',
      orig.location?.longitude || '',
      orig.responseCount,
      new Date(orig.createdAt).toISOString(),
      ''
    ].join(','));
    
    // Duplicate rows
    group.duplicates.forEach(dup => {
      csvRows.push([
        group.groupNumber,
        group.mode,
        'DUPLICATE',
        dup.responseId,
        dup.mongoId,
        dup.sessionId,
      `"${group.original.interviewer.id}"`,
      group.original.interviewer.memberId || 'N/A',
      `"${group.original.survey.id}"`,
        new Date(dup.startTime).toISOString(),
        dup.endTime ? new Date(dup.endTime).toISOString() : '',
        dup.duration,
        dup.status,
        dup.call_id || '',
        dup.audioUrl,
        dup.audioDuration,
        dup.audioFileSize,
        dup.location?.latitude || '',
        dup.location?.longitude || '',
        dup.responseCount,
        new Date(dup.createdAt).toISOString(),
        dup.timeDifference
      ].join(','));
    });
  });
  
  const csvPath = path.join(REPORT_DIR, `duplicate_detection_report_${TIMESTAMP}.csv`);
  fs.writeFileSync(csvPath, csvRows.join('\n'));
  console.log(`   ✅ CSV report saved: ${csvPath}`);
  
  return report;
}

/**
 * Mark duplicates as abandoned
 */
async function markDuplicatesAsAbandoned(allDuplicateGroups) {
  console.log('\n🏷️  Marking duplicates as abandoned...');
  
  const duplicateIds = [];
  allDuplicateGroups.forEach(group => {
    group.duplicates.forEach(dup => {
      duplicateIds.push(dup._id);
    });
  });
  
  if (duplicateIds.length === 0) {
    console.log('   ✅ No duplicates to mark');
    return { updated: 0, errors: [] };
  }
  
  console.log(`   Found ${duplicateIds.length} duplicate responses to mark as abandoned`);
  
  const updateResults = {
    updated: 0,
    errors: []
  };
  
  // Update in batches
  const UPDATE_BATCH_SIZE = 100;
  for (let i = 0; i < duplicateIds.length; i += UPDATE_BATCH_SIZE) {
    const batch = duplicateIds.slice(i, i + UPDATE_BATCH_SIZE);
    
    try {
      const result = await SurveyResponse.updateMany(
        { _id: { $in: batch } },
        { 
          $set: { 
            status: 'abandoned',
            abandonedReason: 'Duplicate response detected and marked as abandoned'
          } 
        }
      );
      
      updateResults.updated += result.modifiedCount;
      stats.totalDuplicatesMarked += result.modifiedCount;
      
      if ((i / UPDATE_BATCH_SIZE + 1) % 10 === 0) {
        console.log(`   Updated ${updateResults.updated}/${duplicateIds.length} duplicates...`);
      }
    } catch (error) {
      console.error(`   ❌ Error updating batch ${i / UPDATE_BATCH_SIZE + 1}:`, error.message);
      updateResults.errors.push({
        batch: i / UPDATE_BATCH_SIZE + 1,
        error: error.message
      });
      stats.errors.push(error);
    }
  }
  
  console.log(`   ✅ Marked ${updateResults.updated} duplicates as abandoned`);
  if (updateResults.errors.length > 0) {
    console.log(`   ⚠️  ${updateResults.errors.length} errors occurred during update`);
  }
  
  return updateResults;
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('='.repeat(80));
    console.log('DUPLICATE DETECTION AND CLEANUP SCRIPT');
    console.log('='.repeat(80));
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Report Directory: ${REPORT_DIR}`);
    console.log('');
    
    // Connect to database
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connected to database\n');
    
    // Get total counts
    const totalResponses = await SurveyResponse.countDocuments({});
    const capiTotal = await SurveyResponse.countDocuments({ interviewMode: 'capi' });
    const catiTotal = await SurveyResponse.countDocuments({ interviewMode: 'cati' });
    
    console.log('📊 Database Statistics:');
    console.log(`   Total Responses: ${totalResponses}`);
    console.log(`   CAPI Responses: ${capiTotal}`);
    console.log(`   CATI Responses: ${catiTotal}`);
    console.log('');
    
    // Process CAPI duplicates
    const capiDuplicates = await processCAPIDuplicates();
    
    // Process CATI duplicates
    const catiDuplicates = await processCATIDuplicates();
    
    // Combine all duplicate groups
    const allDuplicateGroups = [...capiDuplicates, ...catiDuplicates];
    stats.totalProcessed = stats.capiProcessed + stats.catiProcessed;
    
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Duplicate Groups Found: ${allDuplicateGroups.length}`);
    console.log(`  - CAPI Groups: ${capiDuplicates.length}`);
    console.log(`  - CATI Groups: ${catiDuplicates.length}`);
    console.log(`Total Duplicates to Mark: ${allDuplicateGroups.reduce((sum, g) => sum + g.duplicates.length, 0)}`);
    console.log(`  - CAPI Duplicates: ${stats.capiDuplicatesFound}`);
    console.log(`  - CATI Duplicates: ${stats.catiDuplicatesFound}`);
    console.log('='.repeat(80));
    
    if (allDuplicateGroups.length === 0) {
      console.log('\n✅ No duplicates found! Database is clean.');
      await mongoose.disconnect();
      return;
    }
    
    // Generate report
    const report = generateReport(allDuplicateGroups);
    
    // Mark duplicates as abandoned
    console.log('\n⚠️  WARNING: About to mark duplicates as "abandoned"');
    console.log('   This will update the status of duplicate responses in the database.');
    console.log('   Original responses will be kept, duplicates will be marked as abandoned.\n');
    
    const updateResults = await markDuplicatesAsAbandoned(allDuplicateGroups);
    
    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Duplicate Groups: ${allDuplicateGroups.length}`);
    console.log(`Total Duplicates Marked: ${updateResults.updated}`);
    console.log(`Errors: ${updateResults.errors.length}`);
    console.log(`Reports Generated:`);
    console.log(`  - JSON: duplicate_detection_report_${TIMESTAMP}.json`);
    console.log(`  - CSV: duplicate_detection_report_${TIMESTAMP}.csv`);
    console.log('='.repeat(80));
    
    // Save update log
    const updateLog = {
      timestamp: new Date().toISOString(),
      summary: report.summary,
      updateResults: updateResults,
      statistics: stats
    };
    
    const logPath = path.join(REPORT_DIR, `duplicate_cleanup_log_${TIMESTAMP}.json`);
    fs.writeFileSync(logPath, JSON.stringify(updateLog, null, 2));
    console.log(`\n✅ Update log saved: ${logPath}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Script completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error.stack) console.error(error.stack);
    
    // Save error log
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      statistics: stats
    };
    
    const errorPath = path.join(REPORT_DIR, `duplicate_detection_error_${TIMESTAMP}.json`);
    fs.writeFileSync(errorPath, JSON.stringify(errorLog, null, 2));
    console.log(`\n❌ Error log saved: ${errorPath}`);
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, areCAPIDuplicates, areCATIDuplicates };

