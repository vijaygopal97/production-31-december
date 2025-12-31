#!/usr/bin/env node

/**
 * Script to find which response is causing "N/A" in the aggregation
 * This simulates the aggregation pipeline to find responses with null extractedAC
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const SurveyResponse = require('../models/SurveyResponse');
const Survey = require('../models/Survey');

async function findNAACInAggregation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log('✅ Connected to MongoDB');

    const surveyId = '68fd1915d41841da463f0d46';
    
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      console.error('Survey not found');
      process.exit(1);
    }
    
    console.log(`\n🔍 Finding responses that would be grouped as "N/A" in aggregation\n`);
    console.log(`Survey: ${survey.surveyName || survey.title}`);
    console.log(`State: ${survey.acAssignmentState || 'West Bengal'}\n`);

    // Simulate the aggregation pipeline's extractedAC logic
    // This matches what's in surveyController.js addFieldsStage
    const responses = await SurveyResponse.aggregate([
      {
        $match: {
          survey: new mongoose.Types.ObjectId(surveyId),
          status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
        }
      },
      {
        $addFields: {
          // Extract AC (priority: selectedAC > selectedPollingStation.acName > responses array)
          extractedAC: {
            $cond: {
              if: { $and: [{ $ne: ['$selectedAC', null] }, { $ne: ['$selectedAC', ''] }] },
              then: '$selectedAC',
              else: {
                $cond: {
                  if: { $and: [{ $ne: ['$selectedPollingStation.acName', null] }, { $ne: ['$selectedPollingStation.acName', ''] }] },
                  then: '$selectedPollingStation.acName',
                  else: null
                }
              }
            }
          }
        }
      },
      {
        $match: {
          extractedAC: null  // Find responses where extractedAC is null (would become "N/A")
        }
      },
      {
        $project: {
          _id: 1,
          status: 1,
          createdAt: 1,
          interviewer: 1,
          selectedAC: 1,
          selectedPollingStation: 1,
          responses: { $slice: ['$responses', 10] }, // First 10 responses for debugging
          extractedAC: 1
        }
      },
      {
        $limit: 20  // Limit to first 20 for investigation
      }
    ]);

    console.log(`📊 Found ${responses.length} responses where extractedAC would be null (grouped as "N/A")\n`);

    if (responses.length > 0) {
      console.log('='.repeat(80));
      console.log('RESPONSES THAT WOULD BE GROUPED AS "N/A" IN AGGREGATION:');
      console.log('='.repeat(80));
      
      responses.forEach((response, index) => {
        console.log(`\n--- Response ${index + 1} ---`);
        console.log(`Response ID: ${response._id}`);
        console.log(`Status: ${response.status}`);
        console.log(`Created At: ${response.createdAt}`);
        console.log(`Interviewer ID: ${response.interviewer || 'N/A'}`);
        console.log(`Selected AC: ${JSON.stringify(response.selectedAC)}`);
        console.log(`Selected Polling Station AC: ${JSON.stringify(response.selectedPollingStation?.acName)}`);
        console.log(`Extracted AC (from aggregation): ${response.extractedAC || 'null (would become "N/A")'}`);
        
        // Check if there are AC-related questions in responses array
        if (response.responses && Array.isArray(response.responses)) {
          const acRelatedResponses = response.responses.filter(r => {
            const questionText = (r.questionText || '').toLowerCase();
            const questionId = (r.questionId || '').toLowerCase();
            return questionText.includes('assembly') || 
                   questionText.includes('constituency') || 
                   questionText.includes('ac') ||
                   questionId.includes('ac') ||
                   questionId === 'ac-selection';
          });
          
          if (acRelatedResponses.length > 0) {
            console.log(`\n⚠️  AC-related questions found in responses array (but not extracted by aggregation):`);
            acRelatedResponses.forEach((r, idx) => {
              console.log(`  ${idx + 1}. Question: ${r.questionText || r.questionId}`);
              console.log(`     Response: ${JSON.stringify(r.response)}`);
            });
          } else {
            console.log(`\nNo AC-related questions found in responses array`);
          }
        }
        
        console.log(`\nFull Response Object (JSON):`);
        console.log(JSON.stringify(response, null, 2));
        console.log('\n' + '-'.repeat(80));
      });
      
      console.log(`\n\nTotal responses that would be grouped as "N/A": ${responses.length}`);
      
      // Count total responses that would be in "N/A" group
      const totalNACount = await SurveyResponse.aggregate([
        {
          $match: {
            survey: new mongoose.Types.ObjectId(surveyId),
            status: { $in: ['Approved', 'Rejected', 'Pending_Approval'] }
          }
        },
        {
          $addFields: {
            extractedAC: {
              $cond: {
                if: { $and: [{ $ne: ['$selectedAC', null] }, { $ne: ['$selectedAC', ''] }] },
                then: '$selectedAC',
                else: {
                  $cond: {
                    if: { $and: [{ $ne: ['$selectedPollingStation.acName', null] }, { $ne: ['$selectedPollingStation.acName', ''] }] },
                    then: '$selectedPollingStation.acName',
                    else: null
                  }
                }
              }
            }
          }
        },
        {
          $match: {
            extractedAC: null
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ]);
      
      const naCount = totalNACount[0]?.count || 0;
      console.log(`\n📊 Total count of responses in "N/A" group: ${naCount}`);
      
    } else {
      console.log('✅ No responses found that would be grouped as "N/A"');
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findNAACInAggregation();

