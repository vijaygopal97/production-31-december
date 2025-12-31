const path = require('path');
const fs = require('fs');

// Cache for assembly constituencies data
let assemblyConstituenciesData = null;

/**
 * Load assembly constituencies data from JSON file
 * @returns {Object} Assembly constituencies data
 */
const loadAssemblyConstituenciesData = () => {
  if (assemblyConstituenciesData) {
    return assemblyConstituenciesData;
  }

  try {
    const filePath = path.join(__dirname, '../data/assemblyConstituencies.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    assemblyConstituenciesData = JSON.parse(fileContent);
    return assemblyConstituenciesData;
  } catch (error) {
    console.error('Error loading assembly constituencies data:', error);
    return { states: {} };
  }
};

/**
 * Get AC details (district, state, lokSabha/PC) from AC name
 * @param {string} acName - Assembly Constituency name
 * @returns {Object} Object with district, state, lokSabha (PC), or null if not found
 */
const getACDetails = (acName) => {
  if (!acName || acName === 'N/A' || acName.trim() === '') {
    return null;
  }

  const data = loadAssemblyConstituenciesData();
  if (!data.states) {
    return null;
  }

  // Search through all states
  for (const [stateName, stateData] of Object.entries(data.states)) {
    if (stateData.assemblyConstituencies) {
      const ac = stateData.assemblyConstituencies.find(
        ac => ac.acName === acName || ac.acName?.toLowerCase() === acName.toLowerCase()
      );
      
      if (ac) {
        return {
          district: ac.district || null,
          state: stateName,
          lokSabha: ac.lokSabha || null, // Parliamentary Constituency
          pcName: ac.lokSabha || null, // Alias for lokSabha
          acCode: ac.acCode || null,
          reserved: ac.reserved || null
        };
      }
    }
  }

  return null;
};

/**
 * Get district from AC name
 * @param {string} acName - Assembly Constituency name
 * @returns {string|null} District name or null
 */
const getDistrictFromAC = (acName) => {
  const details = getACDetails(acName);
  return details?.district || null;
};

/**
 * Get state from AC name
 * @param {string} acName - Assembly Constituency name
 * @returns {string|null} State name or null
 */
const getStateFromAC = (acName) => {
  const details = getACDetails(acName);
  return details?.state || null;
};

/**
 * Get Parliamentary Constituency (Lok Sabha) from AC name
 * @param {string} acName - Assembly Constituency name
 * @returns {string|null} PC name or null
 */
const getPCFromAC = (acName) => {
  const details = getACDetails(acName);
  return details?.lokSabha || details?.pcName || null;
};

/**
 * Get all AC details (district, state, PC) from AC name
 * @param {string} acName - Assembly Constituency name
 * @returns {Object} Object with district, state, pcName, or null values if not found
 */
const getAllACDetails = (acName) => {
  const details = getACDetails(acName);
  if (!details) {
    return {
      district: null,
      state: null,
      pcName: null,
      lokSabha: null
    };
  }
  
  return {
    district: details.district,
    state: details.state,
    pcName: details.lokSabha || details.pcName,
    lokSabha: details.lokSabha || details.pcName
  };
};

module.exports = {
  loadAssemblyConstituenciesData,
  getACDetails,
  getDistrictFromAC,
  getStateFromAC,
  getPCFromAC,
  getAllACDetails
};

