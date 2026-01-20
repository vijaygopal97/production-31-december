/**
 * Query Helper - Self-Healing MongoDB Query Wrapper
 * 
 * Top-tier company approach: Automatic retry, read preference, timeout handling
 * 
 * This helper ensures:
 * 1. Queries use secondary for reads
 * 2. Automatic retry on failure
 * 3. Proper timeout handling
 * 4. Self-healing on connection issues
 */

const mongoose = require('mongoose');
const { getReadConnection, getMainConnection } = require('../dbConnection');

/**
 * Execute a read query with automatic retry and read preference
 * @param {Function} queryFn - Function that returns a query
 * @param {Object} options - Options (retries, timeout, useSecondary)
 * @returns {Promise} Query result
 */
async function executeReadQuery(queryFn, options = {}) {
  const {
    retries = 2,
    timeout = 30000,
    useSecondary = true,
    fallbackToPrimary = true
  } = options;
  
  let lastError = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Get appropriate connection
      const connection = useSecondary && getReadConnection() 
        ? getReadConnection() 
        : getMainConnection();
      
      // Execute query with timeout
      const query = queryFn(connection);
      
      if (query.maxTimeMS) {
        query.maxTimeMS(Math.min(query.maxTimeMS, timeout));
      } else {
        query.maxTimeMS(timeout);
      }
      
      // Add read preference if using secondary
      if (useSecondary && connection !== getMainConnection()) {
        query.read('secondaryPreferred');
      }
      
      const result = await query;
      return result;
      
    } catch (error) {
      lastError = error;
      
      // If secondary failed and we can fallback to primary, try primary
      if (useSecondary && fallbackToPrimary && attempt < retries) {
        console.warn(`⚠️  Query failed on secondary (attempt ${attempt + 1}), retrying on primary...`);
        continue;
      }
      
      // If it's a timeout and we have retries left, retry
      if ((error.name === 'MongoServerError' || error.message.includes('timeout')) && attempt < retries) {
        console.warn(`⚠️  Query timeout (attempt ${attempt + 1}/${retries + 1}), retrying...`);
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1))); // Exponential backoff
        continue;
      }
      
      // If it's a network error, retry
      if (error.name === 'MongoNetworkError' && attempt < retries) {
        console.warn(`⚠️  Network error (attempt ${attempt + 1}/${retries + 1}), retrying...`);
        await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
        continue;
      }
      
      // Last attempt failed, throw error
      if (attempt === retries) {
        throw error;
      }
    }
  }
  
  throw lastError || new Error('Query failed after all retries');
}

/**
 * Execute a write query (always goes to primary)
 * @param {Function} queryFn - Function that returns a query
 * @param {Object} options - Options (retries, timeout)
 * @returns {Promise} Query result
 */
async function executeWriteQuery(queryFn, options = {}) {
  const {
    retries = 1,
    timeout = 30000
  } = options;
  
  let lastError = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const connection = getMainConnection();
      const query = queryFn(connection);
      
      if (query.maxTimeMS) {
        query.maxTimeMS(Math.min(query.maxTimeMS, timeout));
      } else {
        query.maxTimeMS(timeout);
      }
      
      const result = await query;
      return result;
      
    } catch (error) {
      lastError = error;
      
      if ((error.name === 'MongoServerError' || error.message.includes('timeout')) && attempt < retries) {
        console.warn(`⚠️  Write query timeout (attempt ${attempt + 1}/${retries + 1}), retrying...`);
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
        continue;
      }
      
      if (attempt === retries) {
        throw error;
      }
    }
  }
  
  throw lastError || new Error('Write query failed after all retries');
}

module.exports = {
  executeReadQuery,
  executeWriteQuery
};







