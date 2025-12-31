const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load .env file
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const Survey = require('../models/Survey');
const { generateAllSurveyCSVs } = require('../jobs/csvGenerator');

async function generateInitialCSVs() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }
    
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    console.log('\n🔄 Starting initial CSV generation for all surveys...');
    await generateAllSurveyCSVs();
    
    console.log('\n✅ Initial CSV generation completed');
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
generateInitialCSVs();

