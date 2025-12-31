import assemblyConstituenciesData from '../data/assemblyConstituencies.json';

/**
 * Utility functions for handling Assembly Constituency data
 */

/**
 * Get all available states
 * @returns {Array} Array of state names
 */
export const getAllStates = () => {
  return Object.keys(assemblyConstituenciesData.states);
};

/**
 * Get state information by name
 * @param {string} stateName - Name of the state
 * @returns {Object|null} State information or null if not found
 */
export const getStateInfo = (stateName) => {
  return assemblyConstituenciesData.states[stateName] || null;
};

/**
 * Get all Assembly Constituencies for a specific state
 * @param {string} stateName - Name of the state
 * @returns {Array} Array of AC objects with acCode and acName
 */
export const getACsForState = (stateName) => {
  const stateInfo = getStateInfo(stateName);
  return stateInfo ? stateInfo.assemblyConstituencies : [];
};

/**
 * Get AC names only for a specific state (for backward compatibility)
 * @param {string} stateName - Name of the state
 * @returns {Array} Array of AC names
 */
export const getACNamesForState = (stateName) => {
  const acs = getACsForState(stateName);
  return acs.map(ac => ac.acName);
};

/**
 * Get AC by code
 * @param {string} acCode - AC code
 * @returns {Object|null} AC object or null if not found
 */
export const getACByCode = (acCode) => {
  for (const stateName in assemblyConstituenciesData.states) {
    const state = assemblyConstituenciesData.states[stateName];
    const ac = state.assemblyConstituencies.find(ac => ac.acCode === acCode);
    if (ac) {
      return {
        ...ac,
        stateName,
        stateCode: state.code
      };
    }
  }
  return null;
};

/**
 * Get AC by name
 * @param {string} acName - AC name
 * @returns {Object|null} AC object or null if not found
 */
export const getACByName = (acName) => {
  for (const stateName in assemblyConstituenciesData.states) {
    const state = assemblyConstituenciesData.states[stateName];
    const ac = state.assemblyConstituencies.find(ac => ac.acName === acName);
    if (ac) {
      return {
        ...ac,
        stateName,
        stateCode: state.code
      };
    }
  }
  return null;
};

/**
 * Search ACs by name (case-insensitive)
 * @param {string} searchTerm - Search term
 * @returns {Array} Array of matching AC objects
 */
export const searchACs = (searchTerm) => {
  const results = [];
  const searchLower = searchTerm.toLowerCase();
  
  for (const stateName in assemblyConstituenciesData.states) {
    const state = assemblyConstituenciesData.states[stateName];
    const matchingACs = state.assemblyConstituencies.filter(ac => 
      ac.acName.toLowerCase().includes(searchLower) ||
      ac.acCode.toLowerCase().includes(searchLower)
    );
    
    matchingACs.forEach(ac => {
      results.push({
        ...ac,
        stateName,
        stateCode: state.code
      });
    });
  }
  
  return results;
};

/**
 * Get metadata about the AC data
 * @returns {Object} Metadata object
 */
export const getACDataMetadata = () => {
  return assemblyConstituenciesData.metadata;
};

/**
 * Validate if a state exists
 * @param {string} stateName - Name of the state
 * @returns {boolean} True if state exists
 */
export const isValidState = (stateName) => {
  return stateName in assemblyConstituenciesData.states;
};

/**
 * Validate if an AC exists in a state
 * @param {string} stateName - Name of the state
 * @param {string} acName - Name of the AC
 * @returns {boolean} True if AC exists in the state
 */
export const isValidAC = (stateName, acName) => {
  const acs = getACsForState(stateName);
  return acs.some(ac => ac.acName === acName);
};

/**
 * Get total count of ACs across all states
 * @returns {number} Total number of ACs
 */
export const getTotalACCount = () => {
  let total = 0;
  for (const stateName in assemblyConstituenciesData.states) {
    total += assemblyConstituenciesData.states[stateName].assemblyConstituencies.length;
  }
  return total;
};

/**
 * Get states with AC count
 * @returns {Array} Array of objects with state name and AC count
 */
export const getStatesWithACCount = () => {
  return Object.keys(assemblyConstituenciesData.states).map(stateName => ({
    stateName,
    stateCode: assemblyConstituenciesData.states[stateName].code,
    acCount: assemblyConstituenciesData.states[stateName].assemblyConstituencies.length
  }));
};

export default {
  getAllStates,
  getStateInfo,
  getACsForState,
  getACNamesForState,
  getACByCode,
  getACByName,
  searchACs,
  getACDataMetadata,
  isValidState,
  isValidAC,
  getTotalACCount,
  getStatesWithACCount
};















