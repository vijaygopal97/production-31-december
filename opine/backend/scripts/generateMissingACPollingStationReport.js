const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// Load polling stations data
const pollingStationsPath = path.join(__dirname, '../data/polling_stations.json');
const pollingStationsData = JSON.parse(fs.readFileSync(pollingStationsPath, 'utf8'));

// Haversine formula to calculate distance between two GPS coordinates (in kilometers)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find nearest polling station for given GPS coordinates
function findNearestPollingStation(latitude, longitude) {
  let nearestStation = null;
  let minDistance = Infinity;
  let nearestState = null;
  let nearestAC = null;
  let nearestGroup = null;

  // Iterate through all states
  for (const [state, acs] of Object.entries(pollingStationsData)) {
    // Iterate through all ACs in the state
    for (const [acNo, acData] of Object.entries(acs)) {
      if (!acData.groups) continue;
      
      // Iterate through all groups
      for (const [groupName, groupData] of Object.entries(acData.groups)) {
        if (!groupData.polling_stations || !Array.isArray(groupData.polling_stations)) continue;
        
        // Iterate through all polling stations in the group
        for (const station of groupData.polling_stations) {
          if (!station.latitude || !station.longitude) continue;
          
          const distance = calculateDistance(
            latitude,
            longitude,
            station.latitude,
            station.longitude
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            nearestStation = station;
            nearestState = state;
            nearestAC = {
              acNo: acNo,
              acName: acData.ac_name || '',
              pcNo: acData.pc_no || null,
              pcName: acData.pc_name || '',
              district: acData.district || ''
            };
            nearestGroup = groupName;
          }
        }
      }
    }
  }

  return {
    station: nearestStation,
    distance: minDistance,
    state: nearestState,
    ac: nearestAC,
    group: nearestGroup
  };
}

// Format date to YYYY-MM-DD
function formatDate(date) {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function generateReport() {
  try {
    // Connect to MongoDB - try multiple ways to load env
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    require('dotenv').config(); // Also try default location
    
    // Try to get MONGO_URI from environment or use dbConnection
    let mongoUri = process.env.MONGO_URI;
    
    if (!mongoUri) {
      // Try to use the dbConnection module which might have the URI
      try {
        const dbConnection = require('../dbConnection');
        // If dbConnection exports connection string, use it
        // Otherwise, try to get from process.env that might be set by PM2
        mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
      } catch (e) {
        // Continue
      }
    }
    
    if (!mongoUri) {
      console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('MONGO')));
      throw new Error('MONGO_URI not found in environment variables. Please set MONGO_URI in .env file');
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Query CAPI responses without AC/Polling Station but with GPS coordinates
    const responses = await SurveyResponse.find({
      interviewMode: 'capi',
      status: { $in: ['Pending_Approval', 'Approved'] },
      $or: [
        { selectedAC: { $exists: false } },
        { selectedAC: null },
        { selectedAC: '' },
        { selectedPollingStation: { $exists: false } },
        { selectedPollingStation: null }
      ],
      'location.latitude': { $exists: true, $ne: null },
      'location.longitude': { $exists: true, $ne: null }
    })
    .populate('interviewer', 'memberId firstName lastName email')
    .select('responseId createdAt location selectedAC selectedPollingStation status interviewer')
    .sort({ createdAt: 1 })
    .lean();

    console.log(`📊 Found ${responses.length} CAPI responses without AC/Polling Station but with GPS coordinates`);

    // Process each response and find nearest polling station
    const reportData = [];
    const dateStats = {};

    for (const response of responses) {
      const date = formatDate(response.createdAt);
      
      // Initialize date stats if not exists
      if (!dateStats[date]) {
        dateStats[date] = 0;
      }
      dateStats[date]++;

      // Find nearest polling station
      const nearest = findNearestPollingStation(
        response.location.latitude,
        response.location.longitude
      );

      reportData.push({
        responseId: response.responseId || response._id.toString(),
        createdAt: response.createdAt,
        createdDate: date,
        interviewer: {
          memberId: response.interviewer?.memberId || 'N/A',
          name: response.interviewer 
            ? `${response.interviewer.firstName || ''} ${response.interviewer.lastName || ''}`.trim() || 'N/A'
            : 'N/A',
          email: response.interviewer?.email || 'N/A'
        },
        gpsCoordinates: {
          latitude: response.location.latitude,
          longitude: response.location.longitude,
          accuracy: response.location.accuracy || null
        },
        currentStatus: {
          selectedAC: response.selectedAC || null,
          selectedPollingStation: response.selectedPollingStation || null,
          status: response.status
        },
        nearestPollingStation: nearest.station ? {
          name: nearest.station.name,
          latitude: nearest.station.latitude,
          longitude: nearest.station.longitude,
          distanceKm: parseFloat(nearest.distance.toFixed(2)),
          state: nearest.state,
          acNo: nearest.ac.acNo,
          acName: nearest.ac.acName,
          pcNo: nearest.ac.pcNo,
          pcName: nearest.ac.pcName,
          district: nearest.ac.district,
          group: nearest.group
        } : null
      });
    }

    // Generate report object
    const report = {
      generatedAt: new Date().toISOString(),
      totalResponses: responses.length,
      dateWiseStatistics: dateStats,
      responses: reportData
    };

    // Save report to file
    const reportPath = path.join(__dirname, `../reports/missing-ac-polling-station-report-${formatDate(new Date())}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`✅ Report saved to: ${reportPath}`);

    // Also generate CSV format for easy viewing
    const csvPath = path.join(__dirname, `../reports/missing-ac-polling-station-report-${formatDate(new Date())}.csv`);
    const csvHeaders = [
      'Response ID',
      'Created Date',
      'Created At',
      'Interviewer Member ID',
      'Interviewer Name',
      'Interviewer Email',
      'GPS Latitude',
      'GPS Longitude',
      'GPS Accuracy',
      'Current Status',
      'Current Selected AC',
      'Nearest Polling Station Name',
      'Nearest Polling Station Distance (km)',
      'Nearest State',
      'Nearest AC No',
      'Nearest AC Name',
      'Nearest PC No',
      'Nearest PC Name',
      'Nearest District',
      'Nearest Group'
    ];

    let csvContent = csvHeaders.join(',') + '\n';
    
    for (const item of reportData) {
      const row = [
        item.responseId,
        item.createdDate,
        item.createdAt,
        item.interviewer.memberId,
        `"${item.interviewer.name.replace(/"/g, '""')}"`,
        item.interviewer.email,
        item.gpsCoordinates.latitude,
        item.gpsCoordinates.longitude,
        item.gpsCoordinates.accuracy || '',
        item.currentStatus.status,
        item.currentStatus.selectedAC || '',
        item.nearestPollingStation ? `"${item.nearestPollingStation.name.replace(/"/g, '""')}"` : '',
        item.nearestPollingStation ? item.nearestPollingStation.distanceKm : '',
        item.nearestPollingStation ? item.nearestPollingStation.state : '',
        item.nearestPollingStation ? item.nearestPollingStation.acNo : '',
        item.nearestPollingStation ? `"${item.nearestPollingStation.acName.replace(/"/g, '""')}"` : '',
        item.nearestPollingStation ? (item.nearestPollingStation.pcNo || '') : '',
        item.nearestPollingStation ? `"${item.nearestPollingStation.pcName.replace(/"/g, '""')}"` : '',
        item.nearestPollingStation ? `"${item.nearestPollingStation.district.replace(/"/g, '""')}"` : '',
        item.nearestPollingStation ? `"${item.nearestPollingStation.group.replace(/"/g, '""')}"` : ''
      ];
      csvContent += row.join(',') + '\n';
    }

    fs.writeFileSync(csvPath, csvContent, 'utf8');
    console.log(`✅ CSV report saved to: ${csvPath}`);

    // Print summary
    console.log('\n📊 SUMMARY:');
    console.log(`Total Responses: ${responses.length}`);
    console.log('\n📅 Date-wise Statistics:');
    const sortedDates = Object.keys(dateStats).sort();
    for (const date of sortedDates) {
      console.log(`  ${date}: ${dateStats[date]} responses`);
    }

    console.log('\n✅ Report generation completed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating report:', error);
    process.exit(1);
  }
}

// Run the script
generateReport();

