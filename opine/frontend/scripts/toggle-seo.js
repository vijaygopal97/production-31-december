#!/usr/bin/env node

/**
 * SEO Toggle Script for Opine India
 * 
 * This script helps you easily switch between development (no indexing) 
 * and production (indexing enabled) SEO settings.
 * 
 * Usage:
 *   node scripts/toggle-seo.js dev    # Enable development mode (no indexing)
 *   node scripts/toggle-seo.js prod   # Enable production mode (indexing)
 *   node scripts/toggle-seo.js status # Check current status
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_FILE = path.join(__dirname, '..', '.env');
const ENV_PROD_FILE = path.join(__dirname, '..', '.env.production');
const ROBOTS_FILE = path.join(__dirname, '..', 'public', 'robots.txt');
const ROBOTS_PROD_FILE = path.join(__dirname, '..', 'public', 'robots.production.txt');

function updateEnvFile(filePath, enableIndexing) {
  // Read existing .env file to preserve VITE_API_BASE_URL if it exists
  let existingApiUrl = '';
  try {
    const existingContent = fs.readFileSync(filePath, 'utf8');
    const apiUrlMatch = existingContent.match(/VITE_API_BASE_URL=(.+)/);
    if (apiUrlMatch) {
      existingApiUrl = apiUrlMatch[1].trim();
    }
  } catch (error) {
    // File doesn't exist, that's okay - will use defaults
  }
  
  // Determine API URL based on mode:
  // - Production (enableIndexing=true): Use empty string for relative paths (HTTPS through nginx)
  // - Development (enableIndexing=false): Use localhost or preserve existing value
  let apiBaseUrl;
  if (enableIndexing) {
    // Production mode: Use empty string for relative paths (HTTPS)
    apiBaseUrl = '';
  } else {
    // Development mode: Use existing value or default to localhost
    apiBaseUrl = existingApiUrl || 'http://localhost:5000';
  }
  
  const content = `# API Base URL
# Production (HTTPS): Leave empty to use relative paths through nginx proxy
# Development: Set to http://localhost:5000 or your dev server URL
${apiBaseUrl ? `VITE_API_BASE_URL=${apiBaseUrl}` : '# VITE_API_BASE_URL='}
# SEO Control - Set to 'true' to enable search engine indexing, 'false' to disable
VITE_ENABLE_SEO_INDEXING=${enableIndexing}`;
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ Updated ${path.basename(filePath)} with VITE_ENABLE_SEO_INDEXING=${enableIndexing}`);
  if (enableIndexing) {
    console.log(`   Production mode: Using relative paths (empty VITE_API_BASE_URL) for HTTPS`);
  } else {
    console.log(`   Development mode: VITE_API_BASE_URL=${apiBaseUrl}`);
  }
}

function updateRobotsFile(enableIndexing) {
  const content = enableIndexing 
    ? `# Production Robots.txt for Opine India
# This file allows search engines to index the site

User-agent: *
Allow: /

# Sitemap location (update when you have a sitemap)
# Sitemap: https://opineindia.com/sitemap.xml`
    : `# Robots.txt for Opine India
# This file blocks all search engines from indexing the site during development

User-agent: *
Disallow: /

# Block all crawlers from all pages
# Remove this file or change to "Allow: /" when ready for production`;

  fs.writeFileSync(ROBOTS_FILE, content);
  console.log(`✅ Updated robots.txt to ${enableIndexing ? 'allow' : 'block'} search engines`);
}

function getCurrentStatus() {
  try {
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    const match = envContent.match(/VITE_ENABLE_SEO_INDEXING=(.+)/);
    const isEnabled = match && match[1] === 'true';
    
    console.log(`\n📊 Current SEO Status:`);
    console.log(`   Environment: ${isEnabled ? '🟢 Production (Indexing ENABLED)' : '🔴 Development (Indexing DISABLED)'}`);
    console.log(`   VITE_ENABLE_SEO_INDEXING: ${isEnabled ? 'true' : 'false'}`);
    
    return isEnabled;
  } catch (error) {
    console.log('❌ Could not read .env file');
    return false;
  }
}

function main() {
  const command = process.argv[2];
  
  console.log('🚀 Opine India SEO Toggle Script\n');
  
  switch (command) {
    case 'dev':
    case 'development':
      console.log('🔴 Switching to DEVELOPMENT mode (No indexing)...');
      updateEnvFile(ENV_FILE, 'false');
      updateRobotsFile(false);
      console.log('\n✅ Development mode activated! Search engines are blocked.');
      break;
      
    case 'prod':
    case 'production':
      console.log('🟢 Switching to PRODUCTION mode (Indexing enabled)...');
      updateEnvFile(ENV_FILE, 'true');
      updateRobotsFile(true);
      console.log('\n✅ Production mode activated! Search engines can index your site.');
      break;
      
    case 'status':
      getCurrentStatus();
      break;
      
    default:
      console.log('Usage:');
      console.log('  node scripts/toggle-seo.js dev     # Enable development mode (no indexing)');
      console.log('  node scripts/toggle-seo.js prod    # Enable production mode (indexing)');
      console.log('  node scripts/toggle-seo.js status  # Check current status');
      console.log('\nCurrent status:');
      getCurrentStatus();
      break;
  }
}

main();
