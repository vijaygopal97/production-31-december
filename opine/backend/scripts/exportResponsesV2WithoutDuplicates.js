const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Opine';

// Load models
const SurveyResponse = require('../models/SurveyResponse');
const Survey = require('../models/Survey');
const User = require('../models/User');

// Load data files
const assemblyConstituenciesData = require('../data/assemblyConstituencies.json');
const acRegionDistrictMapping = require('../data/ac_region_district_mapping.json');

// Target survey ID
const TARGET_SURVEY_ID = '68fd1915d41841da463f0d46';
const VALID_STATUSES = ['Approved', 'Pending_Approval', 'Rejected'];

// ========== HELPER FUNCTIONS (Replicated from frontend) ==========

/**
 * Parse multi-translation text: "Main Text {Translation1{Translation2}}"
 */
function parseMultiTranslation(text) {
  if (!text) return [''];
  if (typeof text !== 'string') {
    try {
      text = String(text);
    } catch (error) {
      return [''];
    }
  }
  if (text.trim().length === 0) return [''];

  const languages = [];
  let remaining = text.trim();
  
  while (remaining.length > 0) {
    const openBraceIndex = remaining.indexOf('{');
    if (openBraceIndex === -1) {
      if (remaining.trim()) languages.push(remaining.trim());
      break;
    }
    
    const beforeBrace = remaining.substring(0, openBraceIndex).trim();
    if (beforeBrace) languages.push(beforeBrace);
    
    let braceCount = 0;
    let closeBraceIndex = -1;
    for (let i = openBraceIndex; i < remaining.length; i++) {
      if (remaining[i] === '{') braceCount++;
      else if (remaining[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          closeBraceIndex = i;
          break;
        }
      }
    }
    
    if (closeBraceIndex === -1) {
      const restText = remaining.substring(openBraceIndex + 1).trim();
      if (restText) languages.push(restText);
      break;
    }
    
    const insideBraces = remaining.substring(openBraceIndex + 1, closeBraceIndex);
    const nestedLanguages = parseMultiTranslation(insideBraces);
    if (nestedLanguages && nestedLanguages.length > 0) {
      languages.push(...nestedLanguages);
    }
    
    remaining = remaining.substring(closeBraceIndex + 1).trim();
  }
  
  return languages.length === 0 ? [text.trim()] : languages;
}

/**
 * Get main text without translation
 */
function getMainText(text) {
  const languages = parseMultiTranslation(text);
  return languages[0] || '';
}

/**
 * Get all survey questions
 */
function getAllSurveyQuestions(survey) {
  if (!survey) return [];
  const actualSurvey = survey.survey || survey;
  let allQuestions = [];
  
  if (actualSurvey?.sections && Array.isArray(actualSurvey.sections)) {
    actualSurvey.sections.forEach(section => {
      if (section.questions && Array.isArray(section.questions)) {
        allQuestions.push(...section.questions);
      }
    });
  }
  
  if (actualSurvey?.questions && Array.isArray(actualSurvey.questions)) {
    allQuestions.push(...actualSurvey.questions);
  }
  
  allQuestions.sort((a, b) => (a.order || 0) - (b.order || 0));
  return allQuestions;
}

/**
 * Check if question is AC or polling station selection
 */
function isACOrPollingStationQuestion(question) {
  if (question.id === 'ac-selection') return true;
  if (question.type === 'polling_station') return true;
  const questionText = question.text || question.questionText || '';
  if (questionText.toLowerCase().includes('select assembly constituency') || 
      questionText.toLowerCase().includes('select polling station')) {
    return true;
  }
  return false;
}

/**
 * Get district from AC
 */
function getDistrictFromAC(acName) {
  if (!acName || acName === 'N/A' || !assemblyConstituenciesData.states) return 'N/A';
  const acNameStr = String(acName);
  for (const state of Object.values(assemblyConstituenciesData.states)) {
    if (state.assemblyConstituencies) {
      const constituency = state.assemblyConstituencies.find(ac => {
        if (!ac || !ac.acName) return false;
        return ac.acName === acName || ac.acName.toLowerCase() === acNameStr.toLowerCase();
      });
      if (constituency && constituency.district) {
        return constituency.district;
      }
    }
  }
  return 'N/A';
}

/**
 * Get Lok Sabha from AC
 */
function getLokSabhaFromAC(acName) {
  if (!acName || acName === 'N/A' || !assemblyConstituenciesData.states) return 'N/A';
  const acNameStr = String(acName);
  for (const state of Object.values(assemblyConstituenciesData.states)) {
    if (state.assemblyConstituencies) {
      const constituency = state.assemblyConstituencies.find(ac => {
        if (!ac || !ac.acName) return false;
        return ac.acName === acName || ac.acName.toLowerCase() === acNameStr.toLowerCase();
      });
      if (constituency && constituency.lokSabha) {
        return constituency.lokSabha;
      }
    }
  }
  return 'N/A';
}

/**
 * Extract numeric AC code
 */
function extractNumericACCode(acCode) {
  if (!acCode || acCode === 'N/A') return 'N/A';
  const acCodeStr = String(acCode).trim();
  const numericPart = acCodeStr.replace(/^[^0-9]+/, '');
  const finalCode = numericPart.replace(/^0+/, '') || '0';
  return finalCode;
}

/**
 * Get AC code from AC name
 */
function getACCodeFromAC(acName) {
  if (!acName || acName === 'N/A' || !assemblyConstituenciesData.states) return 'N/A';
  const acNameStr = String(acName);
  for (const state of Object.values(assemblyConstituenciesData.states)) {
    if (state.assemblyConstituencies) {
      const constituency = state.assemblyConstituencies.find(ac => {
        if (!ac || !ac.acName) return false;
        return ac.acName === acName || ac.acName.toLowerCase() === acNameStr.toLowerCase();
      });
      if (constituency) {
        if (constituency.acCode) return extractNumericACCode(constituency.acCode);
        if (constituency.numericCode) return extractNumericACCode(constituency.numericCode);
      }
    }
  }
  return 'N/A';
}

/**
 * Extract polling station code and name
 */
function extractPollingStationCodeAndName(stationValue) {
  let stationCode = 'N/A';
  let stationName = 'N/A';
  
  if (!stationValue || stationValue === 'N/A') {
    return { stationCode, stationName };
  }
  
  const stationStr = String(stationValue).trim();
  if (stationStr.includes(' - ')) {
    const parts = stationStr.split(' - ');
    if (parts.length >= 3 && parts[0].toLowerCase().startsWith('group')) {
      stationCode = parts[1].trim();
      stationName = parts.slice(2).join(' - ').trim();
    } else if (parts.length >= 2) {
      stationCode = parts[0].trim();
      stationName = parts.slice(1).join(' - ').trim();
    } else {
      stationCode = stationStr;
      stationName = stationStr;
    }
  } else {
    stationCode = stationStr;
    stationName = stationStr;
  }
  
  return { stationCode, stationName };
}

/**
 * Get status code
 */
function getStatusCode(status) {
  if (!status) return '';
  const statusUpper = String(status).toUpperCase();
  if (statusUpper === 'APPROVED' || statusUpper === 'VALID') return '10';
  if (statusUpper === 'REJECTED') return '20';
  if (statusUpper === 'PENDING_APPROVAL' || statusUpper === 'UNDER_QC' || statusUpper === 'UNDER QC') return '40';
  if (statusUpper === 'ABANDONED' || statusUpper === 'TERMINATED') return '0';
  return '';
}

/**
 * Get rejection reason code
 */
function getRejectionReasonCode(response) {
  if (!response || response.status !== 'Rejected') return '';
  
  const verificationData = response.verificationData || {};
  const autoRejectionReasons = verificationData.autoRejectionReasons || [];
  const criteria = verificationData.criteria || verificationData.verificationCriteria || {};
  const feedback = verificationData.feedback || '';
  const feedbackLower = feedback.toLowerCase();
  
  if (autoRejectionReasons.length > 0) {
    if (autoRejectionReasons.includes('duration')) return '1';
    if (autoRejectionReasons.includes('gps_distance')) return '2';
    if (autoRejectionReasons.includes('duplicate_phone')) return '3';
  }
  
  if (criteria.audioStatus !== null && criteria.audioStatus !== undefined && criteria.audioStatus !== '') {
    const audioStatus = String(criteria.audioStatus);
    if (!['1', '4', '7'].includes(audioStatus)) return '4';
  }
  
  if (criteria.genderMatching !== null && criteria.genderMatching !== undefined && criteria.genderMatching !== '') {
    const genderMatching = String(criteria.genderMatching);
    if (genderMatching !== '1') return '5';
  }
  
  if (criteria.previousElectionsMatching !== null && criteria.previousElectionsMatching !== undefined && criteria.previousElectionsMatching !== '') {
    const previousElectionsMatching = String(criteria.previousElectionsMatching);
    if (!['1', '3'].includes(previousElectionsMatching)) return '6';
  }
  
  if (criteria.previousLoksabhaElectionsMatching !== null && criteria.previousLoksabhaElectionsMatching !== undefined && criteria.previousLoksabhaElectionsMatching !== '') {
    const previousLoksabhaElectionsMatching = String(criteria.previousLoksabhaElectionsMatching);
    if (!['1', '3'].includes(previousLoksabhaElectionsMatching)) return '7';
  }
  
  if (criteria.upcomingElectionsMatching !== null && criteria.upcomingElectionsMatching !== undefined && criteria.upcomingElectionsMatching !== '') {
    const upcomingElectionsMatching = String(criteria.upcomingElectionsMatching);
    if (!['1', '3'].includes(upcomingElectionsMatching)) return '8';
  }
  
  if (feedback) {
    if (feedbackLower.includes('interview too short') || feedbackLower.includes('too short') || feedbackLower.includes('short duration')) return '1';
    if (feedbackLower.includes('gps location too far') || (feedbackLower.includes('gps') && feedbackLower.includes('far')) || feedbackLower.includes('location too far') || feedbackLower.includes('gps distance')) return '2';
    if (feedbackLower.includes('duplicate phone') || feedbackLower.includes('duplicate phone number')) return '3';
    if (feedbackLower.includes('audio') && (feedbackLower.includes('not') || feedbackLower.includes('cannot') || feedbackLower.includes('fail'))) return '4';
    if (feedbackLower.includes('gender') && (feedbackLower.includes('mismatch') || feedbackLower.includes('not match'))) return '5';
    if ((feedbackLower.includes('2021') || feedbackLower.includes('assembly')) && (feedbackLower.includes('mismatch') || feedbackLower.includes('not match'))) return '6';
    if ((feedbackLower.includes('2024') || feedbackLower.includes('lok sabha') || feedbackLower.includes('general election')) && (feedbackLower.includes('mismatch') || feedbackLower.includes('not match'))) return '7';
    if ((feedbackLower.includes('2025') || feedbackLower.includes('preference') || feedbackLower.includes('pref')) && (feedbackLower.includes('mismatch') || feedbackLower.includes('not match'))) return '8';
    if (feedbackLower.includes('interviewer performance') || feedbackLower.includes('performance') || feedbackLower.includes('quality') || feedbackLower.includes('incomplete') || feedbackLower.includes('poor quality') || feedbackLower.includes('poor performance')) return '9';
  }
  
  return '';
}

/**
 * Check if option is "Others"
 */
function isOthersOption(optText) {
  if (!optText) return false;
  const normalized = String(optText).toLowerCase().trim();
  return normalized === 'other' || 
         normalized === 'others' || 
         (normalized.includes('other') && (normalized.includes('specify') || normalized.includes('please') || normalized.includes('(specify)')));
}

/**
 * Extract Others text
 */
function extractOthersText(responseValue) {
  if (!responseValue) return null;
  const responseStr = String(responseValue);
  if (responseStr.startsWith('Others: ')) {
    return responseStr.substring(8);
  }
  return null;
}

/**
 * Format response display
 */
function formatResponseDisplay(response, surveyQuestion) {
  if (!response || response === null || response === undefined) {
    return 'No response';
  }

  if (Array.isArray(response)) {
    if (response.length === 0) return 'No selections';
    const displayTexts = response.map(value => {
      if (surveyQuestion && surveyQuestion.options) {
        const option = surveyQuestion.options.find(opt => opt.value === value);
        return option ? getMainText(option.text || option.value || value) : value;
      }
      return value;
    });
    return displayTexts.join(', ');
  }

  if (typeof response === 'string' || typeof response === 'number') {
    if (surveyQuestion && surveyQuestion.options) {
      const option = surveyQuestion.options.find(opt => opt.value === response);
      return option ? getMainText(option.text || option.value || response.toString()) : response.toString();
    }
    return response.toString();
  }

  return JSON.stringify(response);
}

/**
 * Option matches
 */
function optionMatches(option, value) {
  if (!option || value === null || value === undefined) return false;
  const optValue = typeof option === 'object' ? (option.value || option.text) : option;
  const optMainText = getMainText(String(optValue));
  const valueMainText = getMainText(String(value));
  if (optMainText && valueMainText && optMainText.toLowerCase() === valueMainText.toLowerCase()) return true;
  if (String(optValue).toLowerCase() === String(value).toLowerCase()) return true;
  return false;
}

/**
 * Get question code from template
 */
function getQuestionCodeFromTemplate(question, questionNumber) {
  if (!question) return `q${questionNumber}`;
  
  const questionText = getMainText(question.text || question.questionText || '').toLowerCase();
  const qNum = questionNumber;
  
  if (question.id) {
    const questionId = String(question.id).toLowerCase();
    if (questionId.includes('religion') || questionId === 'resp_religion') return 'resp_religion';
    if (questionId.includes('social_cat') || questionId === 'resp_social_cat') return 'resp_social_cat';
    if (questionId.includes('caste') || questionId === 'resp_caste_jati') return 'resp_caste_jati';
    if (questionId.includes('female_edu') || questionId === 'resp_female_edu') return 'resp_female_edu';
    if (questionId.includes('male_edu') || questionId === 'resp_male_edu') return 'resp_male_edu';
    if (questionId.includes('occupation') || questionId === 'resp_occupation') return 'resp_occupation';
    if (questionId.includes('mobile') || questionId === 'resp_mobile') return 'resp_mobile';
    if (questionId.includes('name') && !questionId.includes('caste')) return 'resp_name';
  }
  
  if (questionText.includes('religion') && questionText.includes('belong to')) return 'resp_religion';
  if (questionText.includes('social category') && questionText.includes('belong to')) return 'resp_social_cat';
  if (questionText.includes('caste') && (questionText.includes('tell me') || questionText.includes('jati'))) return 'resp_caste_jati';
  if (questionText.includes('female') && questionText.includes('education') && (questionText.includes('most educated') || questionText.includes('highest educational'))) return 'resp_female_edu';
  if (questionText.includes('male') && questionText.includes('education') && (questionText.includes('most educated') || questionText.includes('highest educational'))) return 'resp_male_edu';
  if (questionText.includes('occupation') && questionText.includes('chief wage earner')) return 'resp_occupation';
  if ((questionText.includes('mobile number') || questionText.includes('phone number')) && questionText.includes('share')) return 'resp_mobile';
  if (questionText.includes('share your name') && questionText.includes('confidential')) return 'resp_name';
  if (questionText.includes('contact you in future') || (questionText.includes('future') && questionText.includes('similar surveys'))) return 'thanks_future';
  
  return `q${qNum}`;
}

/**
 * Get AC and polling station from responses
 */
function getACAndPollingStationFromResponses(responses) {
  if (!responses || !Array.isArray(responses)) {
    return { ac: null, pollingStation: null, groupName: null };
  }
  
  let ac = null;
  let pollingStation = null;
  let groupName = null;
  
  responses.forEach((responseItem) => {
    if (responseItem.questionId === 'ac-selection') {
      ac = responseItem.response || null;
    }
    
    if (responseItem.questionText?.toLowerCase().includes('select polling station') ||
        responseItem.questionType === 'polling_station') {
      const stationResponse = responseItem.response;
      if (stationResponse) {
        if (typeof stationResponse === 'string' && stationResponse.includes(' - ')) {
          const parts = stationResponse.split(' - ');
          if (parts.length >= 3 && parts[0].toLowerCase().startsWith('group')) {
            groupName = parts[0] || null;
            pollingStation = parts.slice(1).join(' - ');
          } else if (parts.length === 2 && parts[0].toLowerCase().startsWith('group')) {
            groupName = parts[0] || null;
            pollingStation = parts[1] || stationResponse;
          } else {
            pollingStation = stationResponse;
          }
        } else {
          pollingStation = stationResponse;
        }
      }
    }
    
    if (responseItem.questionId === 'polling-station-group' ||
        responseItem.questionId === 'polling-station-selection') {
      const stationResponse = responseItem.response;
      if (stationResponse) {
        if (typeof stationResponse === 'string' && stationResponse.includes(' - ')) {
          const parts = stationResponse.split(' - ');
          if (parts.length >= 3 && parts[0].toLowerCase().startsWith('group')) {
            groupName = parts[0] || null;
            pollingStation = parts.slice(1).join(' - ');
          } else {
            pollingStation = stationResponse;
          }
        } else {
          pollingStation = stationResponse;
        }
      }
    }
  });
  
  return { ac, pollingStation, groupName };
}

/**
 * Clean value for CSV
 */
function cleanValue(value) {
  if (value === 'N/A' || value === null || value === undefined) return '';
  return value;
}

/**
 * Escape CSV field
 */
function escapeCSVField(field) {
  const fieldStr = String(field || '');
  return `"${fieldStr.replace(/"/g, '""')}"`;
}

// ========== MAIN EXPORT FUNCTION ==========

async function exportResponsesV2WithoutDuplicates() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Step 1: Load duplicate report
    console.log('📊 Step 1: Loading duplicate report...');
    const duplicateReportPath = path.join(__dirname, `../duplicate_responses_report_${new Date().toISOString().split('T')[0]}.json`);
    let duplicateReport;
    try {
      duplicateReport = JSON.parse(fs.readFileSync(duplicateReportPath, 'utf8'));
      console.log(`✅ Loaded duplicate report: ${duplicateReport.duplicateGroups} groups\n`);
    } catch (error) {
      console.error('❌ Error loading duplicate report:', error.message);
      console.log('⚠️  Continuing without duplicate filtering...');
      duplicateReport = { groups: [] };
    }
    
    // Build set of duplicate mongoIds to exclude
    const duplicateMongoIds = new Set();
    duplicateReport.groups.forEach(group => {
      group.duplicates.forEach(dup => {
        duplicateMongoIds.add(dup.mongoId);
      });
    });
    console.log(`📋 Will exclude ${duplicateMongoIds.size} duplicate responses\n`);
    
    // Step 2: Fetch survey
    console.log('📊 Step 2: Fetching survey...');
    const survey = await Survey.findById(TARGET_SURVEY_ID).lean();
    if (!survey) {
      throw new Error(`Survey ${TARGET_SURVEY_ID} not found`);
    }
    console.log(`✅ Survey: ${survey.surveyName}\n`);
    
    // Step 3: Fetch all responses with valid statuses
    console.log('📊 Step 3: Fetching all responses...');
    const allResponses = await SurveyResponse.aggregate([
      {
        $match: {
          survey: mongoose.Types.ObjectId.isValid(TARGET_SURVEY_ID) ? new mongoose.Types.ObjectId(TARGET_SURVEY_ID) : TARGET_SURVEY_ID,
          status: { $in: VALID_STATUSES }
        }
      },
      {
        $addFields: {
          genderValue: {
            $let: {
              vars: {
                genderResponse: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ['$responses', []] },
                        as: 'resp',
                        cond: { $eq: ['$$resp.questionType', 'gender'] }
                      }
                    },
                    0
                  ]
                }
              },
              in: { $ifNull: ['$$genderResponse.response', null] }
            }
          },
          ageValue: {
            $let: {
              vars: {
                ageResponse: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ['$responses', []] },
                        as: 'resp',
                        cond: { $eq: ['$$resp.questionType', 'age'] }
                      }
                    },
                    0
                  ]
                }
              },
              in: {
                $cond: {
                  if: { $isArray: '$$ageResponse.response' },
                  then: { $toInt: { $ifNull: [{ $arrayElemAt: ['$$ageResponse.response', 0] }, 0] } },
                  else: { $toInt: { $ifNull: ['$$ageResponse.response', 0] } }
                }
              }
            }
          },
          acValue: {
            $ifNull: [
              '$selectedAC',
              '$selectedPollingStation.acName'
            ]
          },
          cityValue: {
            $let: {
              vars: {
                cityResponse: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ['$responses', []] },
                        as: 'resp',
                        cond: { $eq: ['$$resp.questionType', 'city'] }
                      }
                    },
                    0
                  ]
                }
              },
              in: { $ifNull: ['$$cityResponse.response', null] }
            }
          },
          districtValue: {
            $ifNull: ['$selectedPollingStation.district', null]
          },
          lokSabhaValue: {
            $ifNull: ['$selectedPollingStation.pcName', null]
          }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'interviewer',
          foreignField: '_id',
          as: 'interviewerDetails'
        }
      },
      {
        $unwind: {
          path: '$interviewerDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'qcbatches',
          localField: 'qcBatch',
          foreignField: '_id',
          as: 'qcBatchDetails'
        }
      },
      {
        $unwind: {
          path: '$qcBatchDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          qcBatchStatus: '$qcBatchDetails.status',
          qcBatchRemainingDecision: '$qcBatchDetails.remainingDecision.decision',
          isSampleResponse: { $ifNull: ['$isSampleResponse', false] }
        }
      },
      {
        $project: {
          _id: 1,
          survey: 1,
          interviewer: 1,
          status: 1,
          interviewMode: 1,
          createdAt: 1,
          updatedAt: 1,
          totalTimeSpent: 1,
          completionPercentage: 1,
          responses: 1,
          selectedAC: 1,
          selectedPollingStation: 1,
          location: 1,
          verificationData: 1,
          audioRecording: 1,
          qcBatch: 1,
          qcBatchStatus: 1,
          qcBatchRemainingDecision: 1,
          responseId: 1,
          sessionId: 1,
          startTime: 1,
          endTime: 1,
          call_id: 1,
          isSampleResponse: 1,
          interviewerDetails: 1,
          acValue: 1,
          cityValue: 1,
          districtValue: 1,
          lokSabhaValue: 1
        }
      }
    ], { allowDiskUse: true });
    
    console.log(`✅ Fetched ${allResponses.length} responses\n`);
    
    // Step 4: Filter out duplicates
    console.log('📊 Step 4: Filtering out duplicates...');
    const filteredResponses = allResponses.filter(response => {
      const mongoId = response._id.toString();
      return !duplicateMongoIds.has(mongoId);
    });
    console.log(`✅ After filtering: ${filteredResponses.length} responses (excluded ${allResponses.length - filteredResponses.length} duplicates)\n`);
    
    // Reverse to get oldest first (backend returns newest first)
    const sortedResponses = [...filteredResponses].reverse();
    
    if (sortedResponses.length === 0) {
      console.log('⚠️  No responses to export');
      await mongoose.disconnect();
      return;
    }
    
    // Step 5: Get all survey questions
    console.log('📊 Step 5: Processing survey questions...');
    const allSurveyQuestions = getAllSurveyQuestions(survey);
    const regularQuestions = allSurveyQuestions
      .filter(q => !isACOrPollingStationQuestion(q))
      .sort((a, b) => {
        const orderA = a.order !== null && a.order !== undefined ? parseInt(a.order) : 9999;
        const orderB = b.order !== null && b.order !== undefined ? parseInt(b.order) : 9999;
        if (!isNaN(orderA) && !isNaN(orderB)) {
          return orderA - orderB;
        }
        return 0;
      });
    
    // Filter out "Professional Degree" from Q13 for survey 68fd1915d41841da463f0d46
    const filteredRegularQuestions = regularQuestions.map(question => {
      const questionText = getMainText(question.text || question.questionText || '').toLowerCase();
      if (questionText.includes('three most pressing issues') && questionText.includes('west bengal')) {
        if (question.options && Array.isArray(question.options)) {
          const filteredOptions = question.options.filter(opt => {
            const optText = typeof opt === 'object' ? getMainText(opt.text || opt.label || opt.value || '') : getMainText(String(opt));
            const optTextLower = String(optText).toLowerCase();
            return !optTextLower.includes('professional degree');
          });
          return {
            ...question,
            options: filteredOptions
          };
        }
      }
      return question;
    });
    
    console.log(`✅ Processing ${filteredRegularQuestions.length} questions\n`);
    
    // Step 6: Build headers
    console.log('📊 Step 6: Building CSV headers...');
    const metadataTitleRow = [];
    const metadataCodeRow = [];
    
    metadataTitleRow.push('Serial Number');
    metadataCodeRow.push('serial_no');
    metadataTitleRow.push('Response ID');
    metadataCodeRow.push('Response ID');
    metadataTitleRow.push('Interview Mode');
    metadataCodeRow.push('MODE');
    metadataTitleRow.push('Interviewer Name');
    metadataCodeRow.push('int_name');
    metadataTitleRow.push('Interviewer ID');
    metadataCodeRow.push('int_id');
    metadataTitleRow.push('Interviewer Email');
    metadataCodeRow.push('Email_Id');
    metadataTitleRow.push('Supervisor Name');
    metadataCodeRow.push('sup_name');
    metadataTitleRow.push('Supervisor ID');
    metadataCodeRow.push('sup_id');
    metadataTitleRow.push('Response Date');
    metadataCodeRow.push('survey_date');
    metadataTitleRow.push('Response Date Time');
    metadataCodeRow.push('survey_datetime');
    metadataTitleRow.push('Status');
    metadataCodeRow.push('Status');
    metadataTitleRow.push('Assembly Constituency code');
    metadataCodeRow.push('ac_code');
    metadataTitleRow.push('Assembly Constituency (AC)');
    metadataCodeRow.push('ac_name');
    metadataTitleRow.push('Parliamentary Constituency Code');
    metadataCodeRow.push('pc_code');
    metadataTitleRow.push('Parliamentary Constituency (PC)');
    metadataCodeRow.push('pc_name');
    metadataTitleRow.push('District Code');
    metadataCodeRow.push('district_code');
    metadataTitleRow.push('District');
    metadataCodeRow.push('district_code');
    metadataTitleRow.push('Region Code');
    metadataCodeRow.push('region_code');
    metadataTitleRow.push('Region Name');
    metadataCodeRow.push('region_name');
    metadataTitleRow.push('Polling Station Code');
    metadataCodeRow.push('rt_polling_station_no');
    metadataTitleRow.push('Polling Station Name');
    metadataCodeRow.push('rt_polling_station_name');
    metadataTitleRow.push('GPS Coordinates');
    metadataCodeRow.push('rt_gps_coordinates');
    metadataTitleRow.push('Call ID');
    metadataCodeRow.push('');
    
    // Build question headers
    const questionTitleRow = [];
    const questionCodeRow = [];
    const questionMultiSelectMap = new Map();
    const questionOthersMap = new Map();
    
    filteredRegularQuestions.forEach((question, index) => {
      const questionText = question.text || question.questionText || `Question ${index + 1}`;
      const mainQuestionText = getMainText(questionText);
      const questionNumber = index + 1;
      const questionCode = getQuestionCodeFromTemplate(question, questionNumber);
      
      questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText}`);
      questionCodeRow.push(questionCode);
      
      const isMultiSelect = (question.type === 'multiple_choice' || question.type === 'multi_select') 
        && question.settings?.allowMultiple === true 
        && question.options 
        && question.options.length > 0;
      
      const hasOthersOption = question.options && question.options.some(opt => {
        const optText = typeof opt === 'object' ? (opt.text || opt.label || opt.value) : opt;
        const optTextStr = String(optText || '').toLowerCase().trim();
        return isOthersOption(optTextStr) || 
               (optTextStr.includes('other') && (optTextStr.includes('specify') || optTextStr.includes('please')));
      });
      
      const hasIndependentOption = question.options && question.options.some(opt => {
        const optText = typeof opt === 'object' ? opt.text : opt;
        const optLower = String(optText).toLowerCase();
        return optLower.includes('independent') && !optLower.includes('other');
      });
      
      questionOthersMap.set(index, hasOthersOption);
      
      if (isMultiSelect) {
        const regularOptions = [];
        let othersOption = null;
        let othersOptionIndex = -1;
        
        question.options.forEach((option, optIndex) => {
          const optText = typeof option === 'object' ? option.text : option;
          const optTextStr = String(optText || '').trim();
          if (isOthersOption(optTextStr) || optTextStr.toLowerCase().includes('other') && (optTextStr.toLowerCase().includes('specify') || optTextStr.toLowerCase().includes('please'))) {
            othersOption = option;
            othersOptionIndex = optIndex;
          } else {
            regularOptions.push(option);
          }
        });
        
        questionMultiSelectMap.set(index, {
          isMultiSelect: true,
          options: regularOptions,
          othersOption: othersOption,
          othersOptionIndex: othersOptionIndex,
          questionText: mainQuestionText,
          questionNumber,
          questionCode
        });
        
        let regularOptionIndex = 0;
        regularOptions.forEach((option) => {
          const optText = typeof option === 'object' ? option.text : option;
          const optMainText = getMainText(optText);
          const optionNum = regularOptionIndex + 1;
          const optCode = `Q${questionNumber}_${optionNum}`;
          regularOptionIndex++;
          
          questionTitleRow.push(`Q${questionNumber}. ${mainQuestionText} - ${optMainText}`);
          questionCodeRow.push(optCode);
        });
        
        if (hasOthersOption) {
          questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText} - Others Choice`);
          const othersChoiceCode = questionCode.startsWith('resp_') || questionCode === 'thanks_future'
            ? `${questionCode}_oth_choice`
            : `${questionCode}_oth_choice`;
          questionCodeRow.push(othersChoiceCode);
          
          questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText} - Others (Specify)`);
          const othersCode = questionCode.startsWith('resp_') || questionCode === 'thanks_future'
            ? `${questionCode}_oth`
            : `${questionCode}_oth`;
          questionCodeRow.push(othersCode);
        }
      } else {
        if (hasOthersOption) {
          questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText} - Others (Specify)`);
          const othersCode = questionCode.startsWith('resp_') || questionCode === 'thanks_future'
            ? `${questionCode}_oth`
            : `${questionCode}_oth`;
          questionCodeRow.push(othersCode);
        }
        
        if (hasIndependentOption && ['q5', 'q6', 'q7', 'q8', 'q9'].includes(questionCode)) {
          questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText} - Independent (Please specify)`);
          const indCode = `${questionCode}_ind`;
          questionCodeRow.push(indCode);
        }
      }
    });
    
    // Combine headers
    const allTitleRow = [...metadataTitleRow, ...questionTitleRow];
    const allCodeRow = [...metadataCodeRow, ...questionCodeRow];
    
    // Add Status, QC, and Rejection columns
    allTitleRow.push('Status (0= terminated, 10=valid, 20=rejected, 40=under qc)');
    allCodeRow.push('status_code');
    allTitleRow.push('Qc Completion date');
    allCodeRow.push('qc_completion_date');
    allTitleRow.push('Assigned to QC ( 1 can mean those whih are assigned to audio qc and 2 can mean those which are not yet assigned)');
    allCodeRow.push('assigned_to_qc');
    allTitleRow.push('Reason for rejection (1= short duration, 2= gps rejection, 3= duplicate phone numbers, 4= audio status, 5= gender mismatch, 6=2021 AE, 7=2024 GE, 8= Pref, 9=Interviewer performance)');
    allCodeRow.push('rejection_reason');
    
    // Convert Q to q for survey 68fd1915d41841da463f0d46
    const transformedCodeRow = allCodeRow.map(code => {
      if (typeof code === 'string') {
        return code.replace(/^Q(\d+)/g, 'q$1');
      }
      return code;
    });
    
    console.log(`✅ Headers built: ${transformedCodeRow.length} columns\n`);
    
    // Step 7: Pre-fetch supervisor names
    console.log('📊 Step 7: Pre-fetching supervisor names...');
    const uniqueSupervisorIDs = new Set();
    sortedResponses.forEach(response => {
      if (response.responses && Array.isArray(response.responses)) {
        const supervisorIdResponse = response.responses.find(r => r.questionId === 'supervisor-id');
        if (supervisorIdResponse && supervisorIdResponse.response !== null && supervisorIdResponse.response !== undefined && supervisorIdResponse.response !== '') {
          const supervisorID = String(supervisorIdResponse.response).trim();
          if (supervisorID && supervisorID !== '') {
            uniqueSupervisorIDs.add(supervisorID);
          }
        }
      }
    });
    
    const supervisorDataMap = new Map();
    if (uniqueSupervisorIDs.size > 0) {
      console.log(`   Fetching ${uniqueSupervisorIDs.size} supervisor names...`);
      for (const supervisorID of uniqueSupervisorIDs) {
        try {
          const supervisor = await User.findOne({
            $or: [
              { memberId: supervisorID },
              { memberID: supervisorID }
            ],
            userType: { $in: ['project_manager', 'supervisor'] }
          }).lean();
          
          if (supervisor && (supervisor.firstName || supervisor.lastName)) {
            const supervisorName = `${supervisor.firstName || ''} ${supervisor.lastName || ''}`.trim();
            supervisorDataMap.set(supervisorID, supervisorName);
          } else {
            supervisorDataMap.set(supervisorID, '');
          }
        } catch (error) {
          supervisorDataMap.set(supervisorID, '');
        }
      }
    }
    console.log(`✅ Supervisor names fetched\n`);
    
    // Step 8: Pre-fetch polling station data
    console.log('📊 Step 8: Pre-fetching polling station data...');
    const uniqueACCodes = new Set();
    sortedResponses.forEach(response => {
      const acFromResponse = getACAndPollingStationFromResponses(response.responses).ac;
      const displayAC = acFromResponse || response.selectedPollingStation?.acName || response.selectedAC || 'N/A';
      if (displayAC !== 'N/A') {
        const acCode = getACCodeFromAC(displayAC);
        if (acCode !== 'N/A') {
          uniqueACCodes.add(acCode);
        }
      }
    });
    
    const pollingDataMap = new Map();
    // Note: Polling station API endpoint would need to be called here
    // For now, we'll use the JSON mapping for region/district codes
    console.log(`✅ AC codes identified: ${uniqueACCodes.size}\n`);
    
    // Step 9: Generate CSV data rows
    console.log('📊 Step 9: Generating CSV data rows...');
    const csvData = [];
    const downloadMode = 'codes'; // Always use codes mode for this export
    
    sortedResponses.forEach((response, rowIndex) => {
      if ((rowIndex + 1) % 1000 === 0) {
        console.log(`   Processing row ${rowIndex + 1}/${sortedResponses.length}...`);
      }
      
      const { ac: acFromResponse, pollingStation: pollingStationFromResponse } = getACAndPollingStationFromResponses(response.responses);
      
      const displayACRaw = acFromResponse || response.selectedPollingStation?.acName || response.selectedAC || '';
      const displayAC = displayACRaw || '';
      
      let displayPC = response.selectedPollingStation?.pcName || '';
      if (!displayPC && displayAC) {
        const pcFromAC = getLokSabhaFromAC(displayAC);
        displayPC = cleanValue(pcFromAC) || '';
      }
      
      let displayDistrict = response.selectedPollingStation?.district || '';
      if (!displayDistrict && displayAC) {
        const districtFromAC = getDistrictFromAC(displayAC);
        displayDistrict = cleanValue(districtFromAC) || '';
      }
      
      const acCodeRaw = getACCodeFromAC(displayAC);
      const acCode = cleanValue(acCodeRaw) || '';
      
      const pollingStationValue = pollingStationFromResponse || response.selectedPollingStation?.stationName;
      
      let pcCode = '';
      let districtCode = '';
      let regionCode = '';
      let regionName = '';
      
      if (acCode && acCode !== '') {
        const acMapping = acRegionDistrictMapping[acCode];
        if (acMapping) {
          districtCode = cleanValue(acMapping.district_code) || '';
          regionCode = cleanValue(acMapping.region_code) || '';
          regionName = cleanValue(acMapping.region_name) || '';
        }
      }
      
      const { stationCode: stationCodeRaw, stationName: stationNameRaw } = extractPollingStationCodeAndName(pollingStationValue);
      const stationCode = cleanValue(stationCodeRaw) || '';
      const stationName = cleanValue(stationNameRaw) || '';
      
      // Format date in IST
      const responseDateUTC = new Date(response.createdAt || response.endTime || response.createdAt);
      const istOffset = 5.5 * 60 * 60 * 1000;
      const responseDateIST = new Date(responseDateUTC.getTime() + istOffset);
      
      const istYear = responseDateIST.getUTCFullYear();
      const istMonth = String(responseDateIST.getUTCMonth() + 1).padStart(2, '0');
      const istDay = String(responseDateIST.getUTCDate()).padStart(2, '0');
      const formattedDateOnly = `${istYear}-${istMonth}-${istDay}`;
      
      const istHours = String(responseDateIST.getUTCHours()).padStart(2, '0');
      const istMinutes = String(responseDateIST.getUTCMinutes()).padStart(2, '0');
      const istSeconds = String(responseDateIST.getUTCSeconds()).padStart(2, '0');
      const formattedDateTime = `${formattedDateOnly} ${istHours}:${istMinutes}:${istSeconds}`;
      
      // Extract supervisor ID
      let supervisorID = '';
      if (response.responses && Array.isArray(response.responses)) {
        const supervisorIdResponse = response.responses.find(r => r.questionId === 'supervisor-id');
        if (supervisorIdResponse && supervisorIdResponse.response !== null && supervisorIdResponse.response !== undefined && supervisorIdResponse.response !== '') {
          supervisorID = String(supervisorIdResponse.response).trim();
        }
      }
      
      const supervisorName = supervisorID && supervisorDataMap.has(supervisorID) 
        ? supervisorDataMap.get(supervisorID) 
        : '';
      
      // Get interviewer data
      const interviewerDetails = response.interviewerDetails || response.interviewer || {};
      const interviewerName = interviewerDetails.firstName || interviewerDetails.lastName
        ? `${interviewerDetails.firstName || ''} ${interviewerDetails.lastName || ''}`.trim()
        : '';
      const interviewerID = interviewerDetails.memberId || interviewerDetails.memberID || response.interviewer?.memberId || response.interviewer?.memberID || '';
      const interviewerEmail = interviewerDetails.email || response.interviewer?.email || '';
      
      // Build metadata row
      const metadata = [
        rowIndex + 1,
        cleanValue(response.responseId || response._id?.toString().slice(-8)),
        cleanValue(response.interviewMode?.toUpperCase()),
        cleanValue(interviewerName || null),
        cleanValue(interviewerID),
        cleanValue(interviewerEmail),
        cleanValue(supervisorName),
        cleanValue(supervisorID),
        formattedDateOnly,
        formattedDateTime,
        cleanValue(response.status),
        cleanValue(acCode),
        cleanValue(displayAC),
        cleanValue(pcCode),
        cleanValue(displayPC),
        cleanValue(districtCode),
        cleanValue(displayDistrict),
        cleanValue(regionCode),
        cleanValue(regionName),
        cleanValue(stationCode),
        cleanValue(stationName),
        response.interviewMode?.toUpperCase() === 'CATI' ? '' : (response.location ? `(${response.location.latitude?.toFixed(4)}, ${response.location.longitude?.toFixed(4)})` : ''),
        response.call_id || ''
      ];
      
      // Extract answers for each question
      const answers = [];
      
      filteredRegularQuestions.forEach((surveyQuestion, questionIndex) => {
        let matchingAnswer = null;
        
        if (surveyQuestion.id) {
          matchingAnswer = response.responses?.find(r => 
            r.questionId === surveyQuestion.id
          );
        }
        
        if (!matchingAnswer && surveyQuestion.text) {
          matchingAnswer = response.responses?.find(r => {
            const rText = getMainText(r.questionText || '');
            const sText = getMainText(surveyQuestion.text || surveyQuestion.questionText || '');
            return rText === sText || r.questionText === surveyQuestion.text || r.questionText === surveyQuestion.questionText;
          });
        }
        
        const multiSelectInfo = questionMultiSelectMap.get(questionIndex);
        const hasOthersOption = questionOthersMap.get(questionIndex);
        const questionCode = multiSelectInfo?.questionCode || getQuestionCodeFromTemplate(surveyQuestion, questionIndex + 1);
        
        const questionText = getMainText(surveyQuestion.text || surveyQuestion.questionText || '').toLowerCase();
        const isQ13 = questionText.includes('three most pressing issues') && questionText.includes('west bengal');
        
        if (multiSelectInfo && multiSelectInfo.isMultiSelect) {
          // Multi-select question handling
          let selectedValues = [];
          let othersText = '';
          
          if (matchingAnswer && !matchingAnswer.isSkipped && matchingAnswer.response) {
            const responseValue = matchingAnswer.response;
            
            if (Array.isArray(responseValue)) {
              selectedValues = responseValue;
            } else if (responseValue !== null && responseValue !== undefined && responseValue !== '') {
              selectedValues = [responseValue];
            }
          }
          
          // Filter out Professional Degree for Q13
          if (isQ13) {
            selectedValues = selectedValues.filter(val => {
              const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
              const valLower = valStr.toLowerCase().replace(/[_\s-]/g, ' ').trim();
              return !(valLower.includes('professional') && valLower.includes('degree'));
            });
          }
          
          let isOthersSelected = false;
          selectedValues.forEach(val => {
            const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
            const isOthers = surveyQuestion.options.some(opt => {
              const optText = typeof opt === 'object' ? opt.text : opt;
              return isOthersOption(optText) && optionMatches(opt, val);
            }) || valStr.startsWith('Others: ') || isOthersOption(valStr);
            
            if (isOthers) {
              isOthersSelected = true;
              if (valStr.startsWith('Others: ')) {
                othersText = valStr.substring(8).trim();
              } else {
                const othersTextValue = extractOthersText(val);
                if (othersTextValue) {
                  othersText = othersTextValue;
                }
              }
            }
          });
          
          let mainResponse = '';
          if (selectedValues.length > 0) {
            if (downloadMode === 'codes') {
              mainResponse = selectedValues.map(val => {
                const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
                const isOthers = surveyQuestion.options.some(opt => {
                  const optText = typeof opt === 'object' ? opt.text : opt;
                  return isOthersOption(optText) && optionMatches(opt, val);
                }) || valStr.startsWith('Others: ') || isOthersOption(valStr);
                
                if (isOthers) {
                  return '44';
                }
                
                if (isQ13) {
                  const valStrForCheck = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
                  const valLowerForCheck = valStrForCheck.toLowerCase().replace(/[_\s-]/g, ' ').trim();
                  if (valLowerForCheck.includes('professional') && valLowerForCheck.includes('degree')) {
                    return null;
                  }
                }
                
                let option = surveyQuestion.options.find(opt => optionMatches(opt, val));
                
                if (!option) {
                  const valMainText = getMainText(String(val));
                  option = surveyQuestion.options.find(opt => {
                    const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
                    const optMainText = getMainText(String(optValue));
                    return optMainText === valMainText && valMainText !== '';
                  });
                }
                
                if (option) {
                  if (option.code !== null && option.code !== undefined && option.code !== '') {
                    return String(option.code);
                  } else if (option.value) {
                    const mainValue = getMainText(String(option.value));
                    if (!/^\d+$/.test(mainValue)) {
                      const matchingOpt = surveyQuestion.options.find(opt => {
                        const optMainText = getMainText(String(opt.value || opt.text || ''));
                        return optMainText === mainValue;
                      });
                      if (matchingOpt && matchingOpt.code) {
                        return String(matchingOpt.code);
                      } else {
                        if (questionCode === 'thanks_future') {
                          const valLower = mainValue.toLowerCase().replace(/[,_]/g, ' ').trim();
                          if (valLower.includes('yes') && (valLower.includes('you') || valLower.includes('can'))) {
                            return '1';
                          }
                        }
                        return mainValue;
                      }
                    } else {
                      return mainValue;
                    }
                  } else {
                    const mainValue = getMainText(String(val));
                    if (questionCode === 'thanks_future') {
                      const valLower = mainValue.toLowerCase().replace(/[,_]/g, ' ').trim();
                      if (valLower.includes('yes') && (valLower.includes('you') || valLower.includes('can'))) {
                        return '1';
                      }
                    }
                    return mainValue || String(val);
                  }
                }
                const mainValue = getMainText(String(val));
                if (questionCode === 'thanks_future') {
                  const valLower = mainValue.toLowerCase().replace(/[,_]/g, ' ').trim();
                  if (valLower.includes('yes') && (valLower.includes('you') || valLower.includes('can'))) {
                    return '1';
                  }
                }
                if (isQ13) {
                  const valLower = mainValue.toLowerCase().replace(/[_\s-]/g, ' ').trim();
                  if (valLower.includes('professional') && valLower.includes('degree')) {
                    return null;
                  }
                }
                return mainValue || String(val);
              }).filter(code => code !== null).join(', ');
            }
          } else if (matchingAnswer && matchingAnswer.isSkipped) {
            mainResponse = '';
          } else {
            mainResponse = '';
          }
          
          answers.push(mainResponse);
          
          const questionCodeForMatching = multiSelectInfo.questionCode || questionCode;
          multiSelectInfo.options.forEach((option, optIndex) => {
            const optText = typeof option === 'object' ? option.text : option;
            if (isOthersOption(optText)) {
              return;
            }
            const optValue = typeof option === 'object' ? (option.value || option.text) : option;
            const isSelected = selectedValues.some(val => {
              const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
              if (valStr.startsWith('Others: ') || isOthersOption(valStr)) {
                return false;
              }
              if (optionMatches(option, val)) {
                return true;
              }
              const valMainText = getMainText(String(valStr));
              const optMainText = getMainText(String(optValue));
              if (valMainText && optMainText && valMainText === optMainText) {
                return true;
              }
              if (questionCodeForMatching === 'thanks_future') {
                const valLower = valMainText.toLowerCase().replace(/[,_]/g, ' ').trim();
                const optLower = optMainText.toLowerCase().replace(/[,_]/g, ' ').trim();
                if (valLower.includes('yes') && optLower.includes('yes') && 
                    (valLower.includes('you') || valLower.includes('can'))) {
                  return true;
                }
              }
              return false;
            });
            
            if (downloadMode === 'codes') {
              answers.push(isSelected ? '1' : '0');
            }
          });
          
          if (hasOthersOption) {
            const mainResponseStr = String(mainResponse || '').trim();
            let containsOthersCode = false;
            if (mainResponseStr === '44') {
              containsOthersCode = true;
            } else if (mainResponseStr.includes(',')) {
              const codes = mainResponseStr.split(',').map(c => c.trim());
              containsOthersCode = codes.includes('44');
            } else {
              containsOthersCode = /\b44\b/.test(mainResponseStr);
            }
            const othChoiceValue = containsOthersCode ? '1' : '0';
            answers.push(othChoiceValue);
            answers.push(othersText || '');
          }
        } else {
          // Single choice question
          let questionResponse = '';
          let othersText = '';
          
          if (matchingAnswer) {
            if (matchingAnswer.isSkipped) {
              questionResponse = '';
            } else {
              const responseValue = matchingAnswer.response;
              const hasResponseContent = (val) => {
                if (!val && val !== 0) return false;
                if (Array.isArray(val)) return val.length > 0;
                if (typeof val === 'object') return Object.keys(val).length > 0;
                return val !== '' && val !== null && val !== undefined;
              };
              
              if (!hasResponseContent(responseValue)) {
                questionResponse = '';
              } else {
                const responseStr = String(responseValue);
                const isOthersResponse = responseStr.startsWith('Others: ') || 
                  (hasOthersOption && surveyQuestion.options && surveyQuestion.options.some(opt => {
                    const optText = typeof opt === 'object' ? opt.text : opt;
                    return isOthersOption(optText) && optionMatches(opt, responseValue);
                  }));
                
                if (isOthersResponse) {
                  if (responseStr.startsWith('Others: ')) {
                    othersText = responseStr.substring(8).trim();
                  } else {
                    const othersTextValue = extractOthersText(responseValue);
                    if (othersTextValue) {
                      othersText = othersTextValue;
                    }
                  }
                  
                  if (downloadMode === 'codes') {
                    questionResponse = '44';
                  } else {
                    questionResponse = 'Others';
                  }
                } else {
                  if (downloadMode === 'codes' && surveyQuestion.options) {
                    let option = surveyQuestion.options.find(opt => optionMatches(opt, responseValue));
                    
                    if (!option) {
                      const responseMainText = getMainText(String(responseValue));
                      option = surveyQuestion.options.find(opt => {
                        const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
                        const optMainText = getMainText(String(optValue));
                        return optMainText === responseMainText && responseMainText !== '';
                      });
                    }
                    
                    if (option) {
                      if (option.code !== null && option.code !== undefined && option.code !== '') {
                        questionResponse = String(option.code);
                      } else if (option.value) {
                        const mainValue = getMainText(String(option.value));
                        if (!/^\d+$/.test(mainValue)) {
                          const matchingOpt = surveyQuestion.options.find(opt => {
                            const optMainText = getMainText(String(opt.value || opt.text || ''));
                            return optMainText === mainValue;
                          });
                          if (matchingOpt && matchingOpt.code) {
                            questionResponse = String(matchingOpt.code);
                          } else {
                            if (questionCode === 'thanks_future') {
                              const valLower = mainValue.toLowerCase().replace(/[,_]/g, ' ').trim();
                              if (valLower.includes('yes') && (valLower.includes('you') || valLower.includes('can'))) {
                                questionResponse = '1';
                              } else {
                                questionResponse = mainValue;
                              }
                            } else {
                              questionResponse = mainValue;
                            }
                          }
                        } else {
                          questionResponse = mainValue;
                        }
                      } else {
                        const mainValue = getMainText(String(responseValue));
                        if (questionCode === 'thanks_future') {
                          const valLower = mainValue.toLowerCase().replace(/[,_]/g, ' ').trim();
                          if (valLower.includes('yes') && (valLower.includes('you') || valLower.includes('can'))) {
                            questionResponse = '1';
                          } else {
                            questionResponse = mainValue || String(responseValue);
                          }
                        } else {
                          questionResponse = mainValue || String(responseValue);
                        }
                      }
                    } else {
                      const mainValue = getMainText(String(responseValue));
                      if (responseValue !== null && responseValue !== undefined && responseValue !== '') {
                        const responseStr = String(responseValue);
                        if (/^\d+$/.test(responseStr.trim())) {
                          questionResponse = responseStr.trim();
                        } else {
                          questionResponse = mainValue || responseStr;
                        }
                      } else {
                        questionResponse = mainValue || String(responseValue);
                      }
                    }
                  } else {
                    if (surveyQuestion.options) {
                      questionResponse = formatResponseDisplay(responseValue, surveyQuestion);
                    } else {
                      questionResponse = String(responseValue);
                    }
                  }
                }
              }
            }
          }
          
          const mainQuestionResponse = questionResponse !== null && questionResponse !== undefined ? String(questionResponse) : '';
          answers.push(mainQuestionResponse);
          
          if (hasOthersOption) {
            let othersTextValue = '';
            if (othersText && othersText.trim() !== '') {
              if (!othersText.match(/^\d+$/)) {
                if (othersText !== mainQuestionResponse) {
                  othersTextValue = othersText;
                }
              }
            }
            answers.push(othersTextValue);
          }
          
          const hasIndependentOption = surveyQuestion.options && surveyQuestion.options.some(opt => {
            const optText = typeof opt === 'object' ? opt.text : opt;
            const optLower = String(optText).toLowerCase();
            return optLower.includes('independent') && !optLower.includes('other');
          });
          
          if (hasIndependentOption && ['q5', 'q6', 'q7', 'q8', 'q9'].includes(questionCode)) {
            let independentText = '';
            if (matchingAnswer && matchingAnswer.response) {
              const responseValue = matchingAnswer.response;
              const responseStr = String(responseValue).toLowerCase();
              const isIndependentResponse = responseStr.includes('independent') || 
                  surveyQuestion.options.some(opt => {
                    const optText = typeof opt === 'object' ? opt.text : opt;
                    return String(optText).toLowerCase().includes('independent') && optionMatches(opt, responseValue);
                  });
              
              if (isIndependentResponse) {
                const independentOpt = surveyQuestion.options.find(opt => {
                  const optText = typeof opt === 'object' ? opt.text : opt;
                  return String(optText).toLowerCase().includes('independent');
                });
                if (independentOpt && typeof independentOpt === 'object' && independentOpt.text) {
                  if (String(responseValue).startsWith('Others: ') || String(responseValue).startsWith('Independent: ')) {
                    const independentTextValue = extractOthersText(responseValue);
                    independentText = independentTextValue || '';
                  }
                }
              }
            }
            answers.push(independentText || '');
          }
        }
      });
      
      // Add QC and status columns
      const statusCode = getStatusCode(response.status);
      const qcCompletionDate = response.verificationData?.reviewedAt 
        ? new Date(response.verificationData.reviewedAt).toLocaleDateString('en-US')
        : '';
      
      let assignedToQC = '';
      if (response.status === 'Approved' || response.status === 'Rejected') {
        assignedToQC = '';
      } else if (response.status === 'Pending_Approval') {
        const qcBatch = response.qcBatch;
        const isSampleResponse = response.isSampleResponse || false;
        const batchStatus = response.qcBatchStatus || (typeof qcBatch === 'object' && qcBatch?.status ? qcBatch.status : null);
        const remainingDecision = response.qcBatchRemainingDecision || (typeof qcBatch === 'object' && qcBatch?.remainingDecision?.decision ? qcBatch.remainingDecision.decision : null);
        
        if (batchStatus) {
          if (batchStatus === 'queued_for_qc' ||
              (isSampleResponse && (batchStatus === 'qc_in_progress' || batchStatus === 'completed')) ||
              (!isSampleResponse && remainingDecision === 'queued_for_qc')) {
            assignedToQC = '1';
          } else if (batchStatus === 'collecting' ||
                     (batchStatus === 'processing' && !isSampleResponse)) {
            assignedToQC = '2';
          } else {
            assignedToQC = '2';
          }
        } else {
          assignedToQC = '2';
        }
      }
      
      const rejectionReasonCode = getRejectionReasonCode(response);
      
      csvData.push([...metadata, ...answers, statusCode, qcCompletionDate, assignedToQC, rejectionReasonCode]);
    });
    
    console.log(`✅ Generated ${csvData.length} data rows\n`);
    
    // Step 10: Write CSV file
    console.log('📊 Step 10: Writing CSV file...');
    const csvPath = path.join(__dirname, `../responses_v2_export_no_duplicates_${new Date().toISOString().split('T')[0]}.csv`);
    const writeStream = fs.createWriteStream(csvPath);
    
    // Write code row only (for survey 68fd1915d41841da463f0d46, no title row)
    writeStream.write(transformedCodeRow.map(escapeCSVField).join(',') + '\n');
    
    // Write data rows
    csvData.forEach((row, index) => {
      if ((index + 1) % 1000 === 0) {
        console.log(`   Writing row ${index + 1}/${csvData.length}...`);
      }
      writeStream.write(row.map(escapeCSVField).join(',') + '\n');
    });
    
    writeStream.end();
    
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    console.log(`✅ CSV file written: ${csvPath}`);
    console.log(`\n📊 Summary:`);
    console.log(`   Total responses fetched: ${allResponses.length}`);
    console.log(`   Duplicates excluded: ${duplicateMongoIds.size}`);
    console.log(`   Responses exported: ${csvData.length}`);
    console.log(`   Columns: ${transformedCodeRow.length}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Export complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

// Run the export
exportResponsesV2WithoutDuplicates();

