#!/usr/bin/env node
/**
 * Add Performance Indexes for Reports and Responses Pages
 * This script adds indexes to improve query performance
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SurveyResponse = require('../models/SurveyResponse');

async function addIndexes() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connected to MongoDB');

    console.log('\n📊 Adding performance indexes...\n');

    // Index 1: Most common query pattern (survey + status + date)
    console.log('1. Adding index: survey + status + createdAt...');
    await SurveyResponse.collection.createIndex(
      { survey: 1, status: 1, createdAt: -1 },
      { background: true, name: 'survey_status_createdAt_idx' }
    );
    console.log('   ✅ Index created');

    // Index 2: Survey + interviewMode + status
    console.log('2. Adding index: survey + interviewMode + status...');
    await SurveyResponse.collection.createIndex(
      { survey: 1, interviewMode: 1, status: 1 },
      { background: true, name: 'survey_interviewMode_status_idx' }
    );
    console.log('   ✅ Index created');

    // Index 3: Survey + interviewer + status
    console.log('3. Adding index: survey + interviewer + status...');
    await SurveyResponse.collection.createIndex(
      { survey: 1, interviewer: 1, status: 1 },
      { background: true, name: 'survey_interviewer_status_idx' }
    );
    console.log('   ✅ Index created');

    // Index 4: For AC filtering (assemblyConstituency in responses array)
    console.log('4. Adding index: survey + responses.assemblyConstituency...');
    await SurveyResponse.collection.createIndex(
      { survey: 1, 'responses.assemblyConstituency': 1, status: 1 },
      { background: true, name: 'survey_ac_status_idx' }
    );
    console.log('   ✅ Index created');

    // Index 5: For district filtering
    console.log('5. Adding index: survey + responses.district...');
    await SurveyResponse.collection.createIndex(
      { survey: 1, 'responses.district': 1, status: 1 },
      { background: true, name: 'survey_district_status_idx' }
    );
    console.log('   ✅ Index created');

    // Index 6: For lokSabha filtering
    console.log('6. Adding index: survey + responses.lokSabha...');
    await SurveyResponse.collection.createIndex(
      { survey: 1, 'responses.lokSabha': 1, status: 1 },
      { background: true, name: 'survey_lokSabha_status_idx' }
    );
    console.log('   ✅ Index created');

    // Index 7: For gender filtering
    console.log('7. Adding index: survey + responses.gender...');
    await SurveyResponse.collection.createIndex(
      { survey: 1, 'responses.gender': 1, status: 1 },
      { background: true, name: 'survey_gender_status_idx' }
    );
    console.log('   ✅ Index created');

    // Index 8: For age filtering
    console.log('8. Adding index: survey + responses.age...');
    await SurveyResponse.collection.createIndex(
      { survey: 1, 'responses.age': 1, status: 1 },
      { background: true, name: 'survey_age_status_idx' }
    );
    console.log('   ✅ Index created');

    console.log('\n✅ All indexes created successfully!');
    console.log('\n📊 Current indexes:');
    const indexes = await SurveyResponse.collection.getIndexes();
    console.log(JSON.stringify(indexes, null, 2));

    await mongoose.connection.close();
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addIndexes();





