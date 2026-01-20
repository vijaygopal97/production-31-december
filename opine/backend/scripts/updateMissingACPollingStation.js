const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');
const fs = require('fs');
const path = require('path');
const { getAllACDetails, getACDetails } = require('../utils/acDataHelper');

// Load polling stations data to get PC number
const pollingStationsPath = path.join(__dirname, '../data/polling_stations.json');
const pollingStationsData = JSON.parse(fs.readFileSync(pollingStationsPath, 'utf8'));

/**
 * Get PC number from polling station data
 */
function getPCNumberFromPollingStation(state, acNo, stationName) {
  try {
    if (!pollingStationsData[state] || !pollingStationsData[state][acNo]) {
      return null;
    }
    
    const acData = pollingStationsData[state][acNo];
    if (!acData.groups) {
      return acData.pc_no || null;
    }
    
    // Search through all groups and polling stations
    for (const [groupName, groupData] of Object.entries(acData.groups)) {
      if (groupData.polling_stations && Array.isArray(groupData.polling_stations)) {
        for (const station of groupData.polling_stations) {
          if (station.name === stationName || station.name.includes(stationName) || stationName.includes(station.name)) {
            return acData.pc_no || null;
          }
        }
      }
    }
    
    // Return PC number from AC data if station not found
    return acData.pc_no || null;
  } catch (error) {
    console.error(`Error getting PC number for ${stationName}:`, error.message);
    return null;
  }
}

/**
 * Get AC code from AC name
 */
function getACCodeFromName(acName) {
  const acDetails = getACDetails(acName);
  return acDetails?.acCode || null;
}

async function updateResponses() {
  try {
    // Connect to MongoDB
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    require('dotenv').config(); // Also try default location
    
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI not found in environment variables');
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Load the report - use today's date
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const reportPath = path.join(__dirname, `../reports/missing-ac-polling-station-report-${dateStr}.json`);
    
    if (!fs.existsSync(reportPath)) {
      throw new Error(`Report file not found: ${reportPath}. Please run generateMissingACPollingStationReport.js first.`);
    }
    
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    
    console.log(`📊 Processing ${report.responses.length} responses...`);

    const updateResults = {
      total: report.responses.length,
      updated: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    // Process each response
    for (let i = 0; i < report.responses.length; i++) {
      const responseData = report.responses[i];
      
      try {
        // Find the response by responseId
        const response = await SurveyResponse.findOne({ 
          responseId: responseData.responseId 
        });

        if (!response) {
          console.log(`⚠️  Response not found: ${responseData.responseId}`);
          updateResults.skipped++;
          continue;
        }

        // Skip if already has AC and polling station
        if (response.selectedAC && response.selectedPollingStation && 
            response.selectedPollingStation.acName && response.selectedPollingStation.stationName) {
          console.log(`⏭️  Skipping ${responseData.responseId} - already has AC and polling station`);
          updateResults.skipped++;
          continue;
        }

        const nearestPS = responseData.nearestPollingStation;
        if (!nearestPS || !nearestPS.acName) {
          console.log(`⚠️  No nearest polling station data for: ${responseData.responseId}`);
          updateResults.skipped++;
          continue;
        }

        // Get AC details from assemblyConstituencies.json
        const acDetails = getAllACDetails(nearestPS.acName);
        const acCodeDetails = getACDetails(nearestPS.acName);
        
        // Get AC code
        const acCode = acCodeDetails?.acCode || null;
        // Extract numeric AC number from AC code (e.g., "WB152" -> "152")
        let numericACNo = nearestPS.acNo || null;
        if (acCode && !numericACNo) {
          const match = acCode.match(/\d+/);
          if (match) {
            numericACNo = match[0].replace(/^0+/, '') || match[0];
          }
        }

        // Get PC number from polling station data
        const pcNo = nearestPS.pcNo || getPCNumberFromPollingStation(
          nearestPS.state,
          nearestPS.acNo,
          nearestPS.name
        );

        // Build selectedPollingStation object (matching React Native app structure)
        const selectedPollingStation = {
          state: nearestPS.state || 'West Bengal',
          acNo: numericACNo || nearestPS.acNo || null,
          acName: nearestPS.acName,
          acCode: acCode || null,
          pcNo: pcNo || null,
          pcName: nearestPS.pcName || acDetails.pcName || null,
          district: nearestPS.district || acDetails.district || null,
          groupName: nearestPS.group || null,
          stationName: nearestPS.name || null,
          gpsLocation: nearestPS.latitude && nearestPS.longitude 
            ? `${nearestPS.latitude},${nearestPS.longitude}` 
            : null,
          latitude: nearestPS.latitude || null,
          longitude: nearestPS.longitude || null
        };

        // Update the response
        const updateData = {
          selectedAC: nearestPS.acName,
          selectedPollingStation: selectedPollingStation
        };

        await SurveyResponse.updateOne(
          { _id: response._id },
          { $set: updateData }
        );

        updateResults.updated++;
        
        if ((i + 1) % 50 === 0) {
          console.log(`✅ Processed ${i + 1}/${report.responses.length} responses...`);
        }
      } catch (error) {
        console.error(`❌ Error updating response ${responseData.responseId}:`, error.message);
        updateResults.failed++;
        updateResults.errors.push({
          responseId: responseData.responseId,
          error: error.message
        });
      }
    }

    // Generate update report
    const updateReport = {
      generatedAt: new Date().toISOString(),
      sourceReport: reportPath,
      summary: updateResults,
      errors: updateResults.errors
    };

    const updateReportPath = path.join(__dirname, `../reports/ac-polling-station-update-report-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(updateReportPath, JSON.stringify(updateReport, null, 2), 'utf8');

    console.log('\n' + '='.repeat(70));
    console.log('UPDATE SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Responses: ${updateResults.total}`);
    console.log(`✅ Successfully Updated: ${updateResults.updated}`);
    console.log(`⏭️  Skipped (already has data): ${updateResults.skipped}`);
    console.log(`❌ Failed: ${updateResults.failed}`);
    console.log(`\n✅ Update report saved to: ${updateReportPath}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating responses:', error);
    process.exit(1);
  }
}

// Run the script
updateResponses();







