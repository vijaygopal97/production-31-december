const fs = require('fs');
const path = require('path');

let pollingStationData = null;

/**
 * Load polling station data
 */
const loadData = () => {
  if (pollingStationData) return pollingStationData;
  
  try {
    const dataPath = path.join(__dirname, '../data/polling_stations.json');
    pollingStationData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return pollingStationData;
  } catch (error) {
    console.error('Error loading polling station data:', error);
    return null;
  }
};

/**
 * Find AC number by AC name in a state
 * CRITICAL: Prioritizes exact matches to prevent substring conflicts (e.g., "Kashipur" matching "Kashipur-Belgachhia")
 */
const findACNumberByName = (state, acName) => {
  const data = loadData();
  if (!data || !data[state]) return null;
  
  // Ensure acName is a string
  if (!acName || (typeof acName !== 'string' && typeof acName !== 'number')) return null;
  const acNameStr = String(acName).trim();
  if (!acNameStr || acNameStr === 'N/A' || acNameStr === '') return null;
  
  // Normalize the search name (remove extra spaces, convert to lowercase)
  const normalizedSearchName = acNameStr.toLowerCase().replace(/\s+/g, ' ');
  
  // First pass: Try exact matches only (CRITICAL: Prevents substring conflicts)
  for (const [acNo, acData] of Object.entries(data[state])) {
    if (!acData.ac_name) continue;
    
    // Normalize the stored AC name
    const normalizedStoredName = acData.ac_name.trim().toLowerCase().replace(/\s+/g, ' ');
    
    // Exact match (highest priority)
    if (normalizedStoredName === normalizedSearchName) {
      return acNo;
    }
    
    // Exact match after removing parentheses content (e.g., "KALCHINI (ST)" matches "Kalchini")
    const storedWithoutParens = normalizedStoredName.replace(/\s*\([^)]*\)\s*/g, '').trim();
    const searchWithoutParens = normalizedSearchName.replace(/\s*\([^)]*\)\s*/g, '').trim();
    if (storedWithoutParens === searchWithoutParens && storedWithoutParens !== '') {
      return acNo;
    }
  }
  
  // Second pass: Only if no exact match found, try partial matching
  // BUT: Only match if the search term is longer or equal (prevents "Kashipur" matching "Kashipur-Belgachhia")
  // This handles edge cases where parentheses or formatting differs but names are essentially the same
  for (const [acNo, acData] of Object.entries(data[state])) {
    if (!acData.ac_name) continue;
    
    const normalizedStoredName = acData.ac_name.trim().toLowerCase().replace(/\s+/g, ' ');
    const storedWithoutParens = normalizedStoredName.replace(/\s*\([^)]*\)\s*/g, '').trim();
    const searchWithoutParens = normalizedSearchName.replace(/\s*\([^)]*\)\s*/g, '').trim();
    
    // Only allow partial match if:
    // 1. Search term is longer than stored name (e.g., searching "Kashipur-Belgachhia" finds "Kashipur-Belgachhia")
    // 2. OR stored name without parens contains search term AND they're similar length (within 3 chars)
    // This prevents "Kashipur" from matching "Kashipur-Belgachhia"
    const lengthDiff = Math.abs(storedWithoutParens.length - searchWithoutParens.length);
    if (searchWithoutParens.length >= storedWithoutParens.length && 
        storedWithoutParens.includes(searchWithoutParens) && 
        lengthDiff <= 3) {
      return acNo;
    }
  }
  
  return null;
};

/**
 * Get groups for AC (by name or number)
 */
const getGroupsForAC = (state, acIdentifier) => {
  const data = loadData();
  if (!data || !data[state]) return null;
  
  // Ensure acIdentifier is valid
  if (!acIdentifier || (typeof acIdentifier !== 'string' && typeof acIdentifier !== 'number')) return null;
  
  // Try to find by number first
  if (data[state][acIdentifier]) {
    return data[state][acIdentifier];
  }
  
  // Try to find by name (with improved matching)
  const acNo = findACNumberByName(state, acIdentifier);
  if (acNo && data[state][acNo]) {
    return data[state][acNo];
  }
  
  // Last resort: try direct case-insensitive name matching
  const normalizedSearch = acIdentifier.trim().toLowerCase();
  for (const [acNo, acData] of Object.entries(data[state])) {
    if (acData.ac_name && acData.ac_name.trim().toLowerCase() === normalizedSearch) {
      return acData;
    }
    // Also try without parentheses
    const nameWithoutParens = acData.ac_name?.replace(/\s*\([^)]*\)\s*/g, '').trim().toLowerCase();
    if (nameWithoutParens === normalizedSearch) {
      return acData;
    }
  }
  
  return null;
};

module.exports = {
  loadData,
  findACNumberByName,
  getGroupsForAC
};

