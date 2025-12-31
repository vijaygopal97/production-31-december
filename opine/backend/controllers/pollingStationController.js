const { loadData, findACNumberByName, getGroupsForAC } = require('../utils/pollingStationHelper');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * @desc    Get available round numbers for a specific AC
 * @route   GET /api/polling-stations/rounds/:state/:acIdentifier
 * @access  Private
 */
const getRoundNumbersByAC = async (req, res) => {
  try {
    const { state, acIdentifier } = req.params;
    const decodedACIdentifier = decodeURIComponent(acIdentifier);
    console.log('getRoundNumbersByAC - State:', state, 'AC Identifier (decoded):', decodedACIdentifier);
    
    const acData = getGroupsForAC(state, decodedACIdentifier);
    
    if (!acData) {
      console.log('AC not found - State:', state, 'AC Identifier:', decodedACIdentifier);
      return res.status(404).json({
        success: false,
        message: 'AC not found in polling station data'
      });
    }
    
    // Collect unique round numbers from all groups
    const roundNumbers = new Set();
    for (const groupName in acData.groups || {}) {
      const stations = acData.groups[groupName].polling_stations || [];
      for (const station of stations) {
        if (station.Interview_Round_number) {
          roundNumbers.add(station.Interview_Round_number);
        }
      }
    }
    
    const rounds = Array.from(roundNumbers).sort((a, b) => parseInt(a) - parseInt(b));
    console.log('Found round numbers:', rounds);
    
    res.json({
      success: true,
      data: {
        rounds: rounds
      }
    });
  } catch (error) {
    console.error('Error fetching round numbers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch round numbers',
      error: error.message
    });
  }
};

/**
 * @desc    Get groups for a specific AC (accepts AC number or AC name)
 * @route   GET /api/polling-stations/groups/:state/:acIdentifier
 * @access  Private
 */
const getGroupsByAC = async (req, res) => {
  try {
    const { state, acIdentifier } = req.params;
    const { roundNumber } = req.query; // Optional round number filter
    const decodedACIdentifier = decodeURIComponent(acIdentifier);
    console.log('getGroupsByAC - State:', state, 'AC Identifier (decoded):', decodedACIdentifier, 'Round Number:', roundNumber);
    
    const acData = getGroupsForAC(state, decodedACIdentifier);
    
    if (!acData) {
      console.log('AC not found - State:', state, 'AC Identifier:', decodedACIdentifier);
      return res.status(404).json({
        success: false,
        message: 'AC not found in polling station data'
      });
    }
    
    // Filter groups by round number if provided
    let groups = Object.keys(acData.groups || {});
    if (roundNumber) {
      groups = groups.filter(groupName => {
        const stations = acData.groups[groupName].polling_stations || [];
        return stations.some(station => station.Interview_Round_number === roundNumber);
      });
    }
    
    console.log('Found AC:', acData.ac_name, 'Groups count:', groups.length, 'Group names:', groups);
    
    res.json({
      success: true,
      data: {
        ac_name: acData.ac_name,
        ac_no: findACNumberByName(state, acData.ac_name) || acIdentifier,
        pc_no: acData.pc_no || null,
        pc_name: acData.pc_name || null,
        district: acData.district || null,
        district_code: acData.district_code || null,
        region_code: acData.region_code || null,
        region_name: acData.region_name || null,
        groups: groups.map(groupName => {
          const stations = acData.groups[groupName].polling_stations || [];
          // Filter stations by round number if provided
          const filteredStations = roundNumber 
            ? stations.filter(s => s.Interview_Round_number === roundNumber)
            : stations;
          return {
          name: groupName,
            polling_station_count: filteredStations.length
          };
        }).filter(group => group.polling_station_count > 0) // Only return groups with stations
      }
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch groups',
      error: error.message
    });
  }
};

/**
 * @desc    Get polling stations for a specific group (accepts AC number or AC name)
 * @route   GET /api/polling-stations/stations/:state/:acIdentifier/:groupName
 * @access  Private
 */
const getPollingStationsByGroup = async (req, res) => {
  try {
    const { state, acIdentifier, groupName } = req.params;
    const { roundNumber } = req.query; // Optional round number filter
    const decodedACIdentifier = decodeURIComponent(acIdentifier);
    const decodedGroupName = decodeURIComponent(groupName);
    console.log('getPollingStationsByGroup - State:', state, 'AC (decoded):', decodedACIdentifier, 'Group (decoded):', decodedGroupName, 'Round Number:', roundNumber);
    
    const acData = getGroupsForAC(state, decodedACIdentifier);
    
    if (!acData) {
      console.log('AC not found for polling stations - State:', state, 'AC:', decodedACIdentifier);
      return res.status(404).json({
        success: false,
        message: 'AC not found in polling station data'
      });
    }
    
    if (!acData.groups[decodedGroupName]) {
      console.log('Group not found - Available groups:', Object.keys(acData.groups), 'Requested:', decodedGroupName);
      return res.status(404).json({
        success: false,
        message: 'Group not found in polling station data'
      });
    }
    
    let stations = acData.groups[decodedGroupName].polling_stations || [];
    
    // Filter by round number if provided
    if (roundNumber) {
      stations = stations.filter(station => station.Interview_Round_number === roundNumber);
    }
    
    console.log('Found', stations.length, 'polling stations for group:', decodedGroupName, 'Round:', roundNumber || 'All');
    
    res.json({
      success: true,
      data: {
        stations: stations.map(station => ({
          name: station.name,
          gps_location: station.gps_location,
          latitude: station.latitude,
          longitude: station.longitude,
          Interview_Round_number: station.Interview_Round_number || null
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching polling stations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch polling stations',
      error: error.message
    });
  }
};

/**
 * @desc    Get polling station GPS location by name (accepts AC number or AC name)
 * @route   GET /api/polling-stations/gps/:state/:acIdentifier/:groupName/:stationName
 * @access  Private
 */
const getPollingStationGPS = async (req, res) => {
  try {
    const { state, acIdentifier, groupName, stationName } = req.params;
    const acData = getGroupsForAC(state, acIdentifier);
    
    if (!acData || !acData.groups[groupName]) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    const stations = acData.groups[groupName].polling_stations;
    const station = stations.find(s => s.name === decodeURIComponent(stationName));
    
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Polling station not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        name: station.name,
        gps_location: station.gps_location,
        latitude: station.latitude,
        longitude: station.longitude
      }
    });
  } catch (error) {
    console.error('Error fetching polling station GPS:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch polling station GPS',
      error: error.message
    });
  }
};

/**
 * @desc    Check if polling_stations.json has been updated (returns hash and metadata)
 * @route   GET /api/polling-stations/check-update
 * @access  Private
 */
const checkPollingStationsUpdate = async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../data/polling_stations.json');
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Polling stations file not found'
      });
    }

    // Read file and calculate hash
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
    const stats = fs.statSync(filePath);
    
    // Check if client has a stored hash (indicates they've synced before)
    // If no hash is provided, this is likely a first-time user with bundled file
    const clientHash = req.headers['if-none-match'] || req.query.hash || null;
    const isFirstTimeUser = !clientHash || clientHash.trim() === '';
    
    // CRITICAL: Check if client hash is a modified hash (from previous first-time user fix)
    // Format: <hash>_<timestamp> - if it matches our current hash, extract and compare
    let needsForceUpdate = false;
    let actualClientHash = clientHash;
    
    if (clientHash && clientHash.includes('_')) {
      // This is a modified hash from previous sync
      // Extract the actual hash part
      actualClientHash = clientHash.split('_')[0];
      // Always force update for modified hashes to ensure they get the clean hash
      needsForceUpdate = true;
    }
    
    // Check if client hash matches server hash
    const hashMatches = actualClientHash === hash;
    
    // AGGRESSIVE FIX: If hash doesn't match OR it's a modified hash, force update
    // This ensures users with old/stale hashes always get updates
    const shouldForceUpdate = isFirstTimeUser || needsForceUpdate || !hashMatches;
    
    // Set cache headers to prevent caching of this check endpoint
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // For users who need update, return modified hash to force download
    // For users who are up to date, return actual hash
    let responseHash = hash;
    if (shouldForceUpdate) {
      // Return modified hash to force download
      const timestamp = Math.floor(Date.now() / 1000);
      responseHash = hash + '_' + timestamp;
    }
    
    res.json({
      success: true,
      data: {
        hash: responseHash,
        lastModified: stats.mtime.toISOString(),
        size: stats.size,
        // Force download flag
        forceDownload: shouldForceUpdate,
        // Always indicate update needed if hash doesn't match or is modified
        needsUpdate: shouldForceUpdate,
        // Include actual hash for reference (without timestamp)
        actualHash: hash,
        message: shouldForceUpdate 
          ? 'Update required. Please download the latest file.' 
          : undefined
      }
    });
  } catch (error) {
    console.error('Error checking polling stations update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check polling stations update',
      error: error.message
    });
  }
};

/**
 * @desc    Download the latest polling_stations.json file
 * @route   GET /api/polling-stations/download
 * @access  Private
 */
const downloadPollingStations = async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../data/polling_stations.json');
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Polling stations file not found'
      });
    }

    // Check If-None-Match header for conditional request
    const clientHash = req.headers['if-none-match'];
    
    // CRITICAL FIX: Enhanced logic to handle all cases
    // 1. First-time users (no hash)
    // 2. Users with modified hashes (from previous sync attempts)
    // 3. Users with stale/old hashes
    // 4. Users with current hashes (only these get 304)
    
    if (clientHash && clientHash.trim() !== '') {
      // Check if this is a modified hash from check-update endpoint (has timestamp suffix)
      // Format: <actual_hash>_<timestamp>
      const isModifiedHash = clientHash.includes('_') && /_\d+$/.test(clientHash);
      
      if (isModifiedHash) {
        // This is a modified hash - always send the file
        // Extract the actual hash part (before the underscore) for logging
        const actualHash = clientHash.split('_')[0];
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const serverHash = crypto.createHash('sha256').update(fileContent).digest('hex');
        
        // For modified hashes, always send the file (don't return 304)
        // This ensures users get the file and can store the clean hash
        console.log(`Modified hash detected (${actualHash.substring(0, 8)}...), forcing download...`);
        // Continue to send file below
      } else {
        // Normal hash comparison for existing users
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const serverHash = crypto.createHash('sha256').update(fileContent).digest('hex');
        
        if (clientHash === serverHash) {
          // Only return 304 if client provided a valid hash AND it matches exactly
          // This means they've synced before and have the current version
          console.log('Hash matches, returning 304 Not Modified');
          return res.status(304).end(); // Not Modified
        } else {
          // Hash doesn't match - file has changed, send new file
          console.log(`Hash mismatch - client: ${clientHash.substring(0, 8)}..., server: ${serverHash.substring(0, 8)}...`);
          // Continue to send file below
        }
      }
    } else {
      // No hash provided (first-time user) - always send the file
      console.log('No hash provided (first-time user), sending file...');
    }
    // Continue to send the file for all cases except exact hash match

    // Send file with proper headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="polling_stations.json"');
    
    // Calculate and set ETag
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
    res.setHeader('ETag', hash);
    
    // CRITICAL: Set cache headers to prevent caching of JSON file
    // This ensures users always get the latest version
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Send file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading polling stations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download polling stations file',
      error: error.message
    });
  }
};

module.exports = {
  getRoundNumbersByAC,
  getGroupsByAC,
  getPollingStationsByGroup,
  getPollingStationGPS,
  checkPollingStationsUpdate,
  downloadPollingStations
};

