/**
 * Reusable Script to add approved CAPI interviewers
 * Survey: 68fd1915d41841da463f0d46
 * 
 * INSTRUCTIONS:
 * 1. Add interviewer details to the 'interviewersToAdd' array below
 * 2. Run: node scripts/addCAPIInterviewers.js (for development)
 * 3. Run on production: ssh to production and run the same command
 * 
 * Format for each interviewer:
 * {
 *   name: 'Full Name',
 *   phone: '10-digit phone number (no country code)',
 *   whatsapp: '10-digit whatsapp number (no country code)',
 *   email: 'email@example.com',
 *   memberId: 'unique member ID',
 *   ac: 'Assembly Constituency Name' (e.g., 'Bandwan', 'Barabani')
 * }
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Survey = require('../models/Survey');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const REFERENCE_USER_ID = '68ebf124ab86ea29f3c0f1f8';
const SURVEY_ID = '68fd1915d41841da463f0d46';
const COMPANY_CODE = 'TEST001';
const STATE = 'West Bengal';
const COUNTRY = 'India';

// ============================================================================
// ADD INTERVIEWER DETAILS HERE
// ============================================================================
const interviewersToAdd = [
  {
    name: 'Bipasha Lohar',
    phone: '6295419141',
    whatsapp: '6295419141',
    email: 'bipshaloh6282@gmail.com',
    memberId: 'CAPI408',
    ac: 'Purulia'
  },
  {
    name: 'SK MD YUNAS',
    phone: '7699532888',
    whatsapp: '7699532888',
    email: 'capi431@gmail.com',
    memberId: 'CAPI431',
    ac: 'PurbaBurdwan'
  },
  {
    name: 'SHAIKH ZEENATH SAMIM',
    phone: '9547841271',
    whatsapp: '9547841271',
    email: 'capi432@gmail.com',
    memberId: 'CAPI432',
    ac: 'PurbaBurdwan'
  },
  {
    name: 'SHAIKH MAHAROOF HAQUE',
    phone: '7602977829',
    whatsapp: '7602977829',
    email: 'capi438@gmail.com',
    memberId: 'CAPI438',
    ac: 'PurbaBurdwan'
  },
  {
    name: 'SK ROBIUL',
    phone: '9144352907',
    whatsapp: '9144352907',
    email: 'capi440@gmail.com',
    memberId: 'CAPI440',
    ac: 'PurbaBurdwan'
  },
  {
    name: 'Bumba Dangar',
    phone: '8945983325',
    whatsapp: '8945983325',
    email: 'capi488@gmail.com',
    memberId: 'CAPI488',
    ac: 'PurbaBurdwan'
  },
  {
    name: 'SK SAHABUDDIN',
    phone: '8597544677',
    whatsapp: '8597544677',
    email: 'capi498@gmail.com',
    memberId: 'CAPI498',
    ac: 'PurbaBurdwan'
  },
  {
    name: 'Jharna Mondal',
    phone: '9332646654',
    whatsapp: '9332646654',
    email: 'capi499@gmail.com',
    memberId: 'CAPI499',
    ac: 'PaschimBurdwan'
  },
  {
    name: 'Manoj Panda',
    phone: '7602995165',
    whatsapp: '7602995165',
    email: 'capi581@gmail.com',
    memberId: 'CAPI581',
    ac: 'Hooghly'
  },
  {
    name: 'Roni Mondal',
    phone: '7810880347',
    whatsapp: '7810880347',
    email: 'capi582@gmail.com',
    memberId: 'CAPI582',
    ac: 'Hooghly'
  },
  {
    name: 'Subhajit Bhattacharya',
    phone: '8250426283',
    whatsapp: '8250426283',
    email: 'capi588@gmail.com',
    memberId: 'CAPI588',
    ac: 'Hooghly'
  }
  // Note: CAPI583 (Sonali Debnath) skipped - no phone number available in Excel
];

// Copy the rest of the script from the original file
const fs = require('fs');
const originalScript = fs.readFileSync('/var/www/opine/backend/scripts/addCAPIInterviewers.js', 'utf8');
const scriptParts = originalScript.split('// ============================================================================\n// DO NOT MODIFY BELOW THIS LINE\n// ============================================================================');
if (scriptParts.length > 1) {
  const restOfScript = scriptParts[1];
  // Write the complete script
  fs.writeFileSync('/var/www/opine/backend/scripts/addCAPIInterviewers.js', 
    scriptParts[0].split('const interviewersToAdd = [')[0] + 
    'const interviewersToAdd = [\n' + 
    interviewersToAdd.map(i => JSON.stringify(i, null, 2).replace(/"([^"]+)":/g, '$1:')).join(',\n') + 
    '\n];\n\n// ============================================================================\n// DO NOT MODIFY BELOW THIS LINE\n// ============================================================================' + 
    restOfScript
  );
}
