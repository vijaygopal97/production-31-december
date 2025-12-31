const mongoose = require('mongoose');
const Survey = require('../models/Survey');
const User = require('../models/User');
const Company = require('../models/Company');
const SurveyResponse = require('../models/SurveyResponse');
const CatiCall = require('../models/CatiCall');
const CatiRespondentQueue = require('../models/CatiRespondentQueue');
const XLSX = require('xlsx');
const multer = require('multer');
const path = require('path');

// Helper functions for IST (Indian Standard Time) timezone handling
// IST is UTC+5:30

// Get current IST time as a Date object
const getISTNow = () => {
  const now = new Date();
  // Convert UTC to IST: add 5 hours and 30 minutes (5.5 hours)
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const utcTime = now.getTime();
  const istTime = new Date(utcTime + istOffset);
  return istTime;
};

// Get current IST date string (YYYY-MM-DD)
const getISTDateString = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utcTime = now.getTime();
  const istTime = new Date(utcTime + istOffset);
  
  // Format as YYYY-MM-DD
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get IST date string from a Date object (adjusting for IST)
const getISTDateStringFromDate = (date) => {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utcTime = date.getTime();
  const istTime = new Date(utcTime + istOffset);
  
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Convert IST date (YYYY-MM-DD) start of day (00:00:00 IST) to UTC Date
// IST midnight (00:00:00) = UTC previous day 18:30:00
const getISTDateStartUTC = (istDateStr) => {
  // Parse YYYY-MM-DD
  const [year, month, day] = istDateStr.split('-').map(Number);
  // IST midnight (00:00:00) = UTC previous day 18:30:00
  // Create UTC date for the day at 18:30:00, then subtract 1 day
  const startDateUTC = new Date(Date.UTC(year, month - 1, day, 18, 30, 0, 0));
  startDateUTC.setUTCDate(startDateUTC.getUTCDate() - 1);
  return startDateUTC;
};

// Convert IST date (YYYY-MM-DD) end of day (23:59:59.999 IST) to UTC Date
// IST end of day (23:59:59.999) = UTC same day 18:29:59.999
const getISTDateEndUTC = (istDateStr) => {
  // Parse YYYY-MM-DD
  const [year, month, day] = istDateStr.split('-').map(Number);
  // IST end of day (23:59:59.999) = UTC same day 18:29:59.999
  return new Date(Date.UTC(year, month - 1, day, 18, 29, 59, 999));
};

// @desc    Create a new survey
// @route   POST /api/surveys
// @access  Private (Company Admin, Project Manager)
exports.createSurvey = async (req, res) => {
  try {
    const {
      surveyName,
      description,
      category,
      purpose,
      mode,
      includeGigWorkers,
      startDate,
      deadline,
      sampleSize,
      targetAudience,
      thresholdInterviewsPerDay,
      maxInterviewsPerInterviewer,
      onlineContactMode,
      contactList,
      assignedInterviewers,
      sections,
      templateUsed,
      settings,
      notifications,
      status,
      assignACs,
      acAssignmentCountry,
      acAssignmentState,
      modes,
      modeAllocation,
      modeQuotas,
      modeGigWorkers,
      respondentContacts,
      sets
    } = req.body;

    console.log('🔍 Backend received mode:', mode, 'type:', typeof mode);
    console.log('🔍 Backend received modes:', modes, 'type:', typeof modes);
    console.log('🔍 Backend received modeAllocation:', modeAllocation, 'type:', typeof modeAllocation);

    // Get current user and their company
    const currentUser = await User.findById(req.user.id).populate('company');
    if (!currentUser || !currentUser.company) {
      return res.status(400).json({
        success: false,
        message: 'User not associated with any company'
      });
    }

    // Validate required fields
    if (!surveyName || !description || !category || !purpose || !mode || !startDate || !deadline || !sampleSize) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(deadline);
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'Deadline must be after start date'
      });
    }

    // Clean targetAudience data to handle new structure
    const cleanTargetAudience = (targetAudience) => {
      console.log('🔍 Backend received targetAudience:', JSON.stringify(targetAudience, null, 2));
      
      if (!targetAudience) {
        return {
          demographics: {},
          geographic: {},
          behavioral: {},
          psychographic: {},
          custom: '',
          quotaManagement: false
        };
      }

      // Handle the new structure where each category is an object with boolean flags and requirements
      const cleaned = {
        demographics: targetAudience.demographics || {},
        geographic: targetAudience.geographic || {},
        behavioral: targetAudience.behavioral || {},
        psychographic: targetAudience.psychographic || {},
        custom: targetAudience.custom || '',
        quotaManagement: targetAudience.quotaManagement || false
      };
      
      console.log('🔍 Backend cleaned targetAudience:', JSON.stringify(cleaned, null, 2));
      return cleaned;
    };

    // Create survey data object
    const surveyData = {
      surveyName,
      description,
      category,
      purpose,
      mode,
      modes: modes || [],
      modeAllocation: modeAllocation || {},
      modeQuotas: modeQuotas || {},
      modeGigWorkers: modeGigWorkers || {},
      includeGigWorkers: includeGigWorkers || false,
      startDate: start,
      deadline: end,
      sampleSize: parseInt(sampleSize),
      targetAudience: cleanTargetAudience(targetAudience),
      thresholdInterviewsPerDay: thresholdInterviewsPerDay ? parseInt(thresholdInterviewsPerDay) : undefined,
      maxInterviewsPerInterviewer: maxInterviewsPerInterviewer ? parseInt(maxInterviewsPerInterviewer) : undefined,
      onlineContactMode: onlineContactMode || [],
      contactList: contactList || [],
      sections: (() => {
        // Debug: Log sections with settings when receiving
        if (sections && Array.isArray(sections)) {
          sections.forEach((section, sectionIdx) => {
            if (section.questions && Array.isArray(section.questions)) {
              section.questions.forEach((question, questionIdx) => {
                if (question.type === 'multiple_choice' && question.settings) {
                  console.log('🔍 Backend received question with settings:', {
                    sectionIndex: sectionIdx,
                    questionIndex: questionIdx,
                    questionId: question.id,
                    questionText: question.text,
                    settings: question.settings
                  });
                }
              });
            }
          });
        }
        return sections || [];
      })(),
      templateUsed: templateUsed || {},
      settings: settings || {},
      notifications: notifications || {},
      company: currentUser.company._id,
      createdBy: currentUser._id,
      lastModifiedBy: currentUser._id,
      status: status || 'draft', // Use provided status or default to draft
      assignACs: assignACs || false,
      acAssignmentCountry: acAssignmentCountry || '',
      acAssignmentState: acAssignmentState || '',
      respondentContacts: respondentContacts || [],
      sets: sets || []
    };

    // Create the survey
    const survey = new Survey(surveyData);
    await survey.save();

    // Populate the created survey
    const populatedSurvey = await Survey.findById(survey._id)
      .populate('company', 'companyName companyCode')
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedInterviewers.interviewer', 'firstName lastName email userType')
      .populate('assignedQualityAgents.qualityAgent', 'firstName lastName email userType');

    res.status(201).json({
      success: true,
      message: 'Survey created successfully',
      data: { survey: populatedSurvey }
    });

  } catch (error) {
    console.error('Create survey error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get all surveys for a company
// @route   GET /api/surveys
// @access  Private (Company Admin, Project Manager)
exports.getSurveys = async (req, res) => {
  try {
    console.log('🚀 getSurveys function called');
    const { status, mode, search, category, page = 1, limit = 10 } = req.query;
    
    console.log('getSurveys - Query parameters:', { status, mode, search, category, page, limit });

    // Get current user and their company
    const currentUser = await User.findById(req.user.id).populate('company');
    if (!currentUser || !currentUser.company) {
      return res.status(400).json({
        success: false,
        message: 'User not associated with any company'
      });
    }

    // Build query
    const query = { company: currentUser.company._id };
    if (status) query.status = status;
    if (mode) query.mode = mode;
    if (category) query.category = category;
    
    // Add search functionality
    if (search) {
      query.$and = [
        { company: currentUser.company._id },
        {
          $or: [
            { surveyName: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
          ]
        }
      ];
      // Remove the company filter from the main query since it's now in $and
      delete query.company;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    console.log('getSurveys - Final query:', JSON.stringify(query, null, 2));
    console.log('getSurveys - Pagination:', { skip, limit: parseInt(limit) });

    // Get surveys with pagination
    // Exclude respondentContacts field to avoid loading large arrays (50K+ contacts)
    // respondentContactsFile field is kept (just the file path, not the data)
    const surveys = await Survey.find(query)
      .select('-respondentContacts') // Exclude large respondentContacts array
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedInterviewers.interviewer', 'firstName lastName email userType')
      .populate('capiInterviewers.interviewer', 'firstName lastName email userType')
      .populate('catiInterviewers.interviewer', 'firstName lastName email userType')
      .populate('assignedQualityAgents.qualityAgent', 'firstName lastName email userType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Survey.countDocuments(query);

    console.log(`🔍 Found ${surveys.length} surveys to process`);
    console.log(`🔍 Survey names:`, surveys.map(s => s.surveyName));

    // Calculate analytics for each survey
    console.log(`🔍 Starting analytics calculation for ${surveys.length} surveys`);
    const surveysWithAnalytics = await Promise.all(surveys.map(async (survey) => {
      console.log(`📊 Calculating analytics for: ${survey.surveyName} (ID: ${survey._id})`);
      
      // Get approved survey responses count
      const approvedResponses = await SurveyResponse.countDocuments({
        survey: survey._id,
        status: 'Approved'
      });
      
      // Get ALL responses count (for button visibility - any response type)
      const allResponsesCount = await SurveyResponse.countDocuments({
        survey: survey._id
      });
      
      // Use aggregation to get status counts (much faster than fetching all responses)
      const statusCountsResult = await SurveyResponse.aggregate([
        { $match: { survey: survey._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Convert aggregation result to object format
      const statusCounts = {};
      statusCountsResult.forEach(item => {
        statusCounts[item._id] = item.count;
      });
      
      console.log(`✅ Found ${approvedResponses} approved responses for ${survey.surveyName}`);
      console.log(`📊 Found ${allResponsesCount} total responses (all statuses) for ${survey.surveyName}`);
      console.log(`📊 All status counts for ${survey.surveyName}:`, statusCounts);


      // Calculate completion percentage
      const sampleSize = survey.sampleSize || 0;
      const completionRate = sampleSize > 0 ? Math.round((approvedResponses / sampleSize) * 100) : 0;

      // Count assigned interviewers (handle both single-mode and multi-mode)
      let assignedInterviewersCount = 0;
      if (survey.assignedInterviewers && survey.assignedInterviewers.length > 0) {
        assignedInterviewersCount = survey.assignedInterviewers.length;
      } else if (survey.capiInterviewers && survey.catiInterviewers) {
        // For multi-mode surveys, count unique interviewers from both arrays
        // Filter out null interviewers (deleted users)
        const capiInterviewerIds = survey.capiInterviewers
          .filter(a => a.interviewer && a.interviewer._id)
          .map(a => a.interviewer._id.toString());
        const catiInterviewerIds = survey.catiInterviewers
          .filter(a => a.interviewer && a.interviewer._id)
          .map(a => a.interviewer._id.toString());
        const uniqueInterviewerIds = new Set([...capiInterviewerIds, ...catiInterviewerIds]);
        assignedInterviewersCount = uniqueInterviewerIds.size;
      }

      return {
        ...survey.toObject(),
        analytics: {
          totalResponses: approvedResponses,
          allResponsesCount: allResponsesCount, // Count of ALL responses (for button visibility)
          completionRate: completionRate,
          assignedInterviewersCount: assignedInterviewersCount
        }
      };
    }));

    // Debug: Log the analytics data being sent
    console.log('📊 Analytics data being sent to frontend:');
    surveysWithAnalytics.forEach(survey => {
      console.log(`  ${survey.surveyName} (${survey._id}):`, {
        approvedResponses: survey.analytics?.totalResponses,
        allResponsesCount: survey.analytics?.allResponsesCount,
        completionRate: survey.analytics?.completionRate,
        assignedInterviewersCount: survey.analytics?.assignedInterviewersCount
      });
    });

    res.status(200).json({
      success: true,
      message: 'Surveys retrieved successfully',
      data: {
        surveys: surveysWithAnalytics,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get surveys error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get a single survey
// @route   GET /api/surveys/:id
// @access  Private (Company Admin, Project Manager, Interviewer)
// Get full survey data (with sections and questions) - optimized endpoint for interview interface
exports.getSurveyFull = async (req, res) => {
  try {
    const { id } = req.params;

    // Find survey with full data (sections and questions)
    const survey = await Survey.findById(id)
      .select('surveyName description mode sections questions assignACs acAssignmentState status version');

    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        survey: {
          id: survey._id,
          surveyName: survey.surveyName,
          description: survey.description,
          mode: survey.mode,
          sections: survey.sections,
          questions: survey.questions,
          assignACs: survey.assignACs,
          acAssignmentState: survey.acAssignmentState,
          status: survey.status,
          version: survey.version
        }
      }
    });

  } catch (error) {
    console.error('Get survey full error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch survey',
      error: error.message
    });
  }
};

exports.getSurvey = async (req, res) => {
  try {
    const { id } = req.params;

    // Get current user and their company
    const currentUser = await User.findById(req.user.id).populate('company');
    if (!currentUser || !currentUser.company) {
      return res.status(400).json({
        success: false,
        message: 'User not associated with any company'
      });
    }

    // Find survey
    const survey = await Survey.findById(id)
      .populate('company', 'companyName companyCode')
      .populate('createdBy', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email')
      .populate('assignedInterviewers.interviewer', 'firstName lastName email userType phone')
      .populate('assignedInterviewers.assignedBy', 'firstName lastName email')
      .populate('assignedQualityAgents.qualityAgent', 'firstName lastName email userType phone')
      .populate('assignedQualityAgents.assignedBy', 'firstName lastName email');

    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Check if user has access to this survey
    if (survey.company._id.toString() !== currentUser.company._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view surveys from your company.'
      });
    }

    // Special handling for survey 68fd1915d41841da463f0d46: Reorder question 13 for CATI mode
    // Question 13 should appear after "Please note the respondent's gender" question
    const TARGET_SURVEY_ID = '68fd1915d41841da463f0d46';
    if (survey._id.toString() === TARGET_SURVEY_ID && survey.sections && Array.isArray(survey.sections)) {
      // Check if request is for CATI mode (from query parameter or user's interview mode)
      const isCatiMode = req.query.mode === 'cati' || req.query.mode === 'CATI' || 
                        (currentUser.interviewModes && currentUser.interviewModes.includes('CATI'));
      
      // Find the section containing the questions (sectionIndex 1 based on database query)
      const targetSection = survey.sections.find((section, idx) => {
        if (!section.questions || !Array.isArray(section.questions)) return false;
        // Look for section that has both gender question and question 13
        const hasGenderQ = section.questions.some(q => 
          q.id && q.id.includes('fixed_respondent_gender') || 
          (q.text && q.text.toLowerCase().includes('gender') && q.text.toLowerCase().includes('respondent'))
        );
        const hasQ13 = section.questions.some(q => 
          q.questionNumber === '13' || 
          (q.text && (q.text.includes('three most pressing') || q.text.includes('পশ্চিমবঙ্গের সবচেয়ে জরুরি')))
        );
        return hasGenderQ && hasQ13;
      });

      if (targetSection && targetSection.questions && Array.isArray(targetSection.questions)) {
        // Find gender question and question 13
        let genderQIndex = -1;
        let q13Index = -1;
        let genderQuestion = null;
        let q13Question = null;

        targetSection.questions.forEach((q, idx) => {
          if (q.id && q.id.includes('fixed_respondent_gender') || 
              (q.text && q.text.toLowerCase().includes('gender') && q.text.toLowerCase().includes('respondent'))) {
            genderQIndex = idx;
            genderQuestion = q;
          }
          if (q.questionNumber === '13' || 
              (q.text && (q.text.includes('three most pressing') || q.text.includes('পশ্চিমবঙ্গের সবচেয়ে জরুরি')))) {
            q13Index = idx;
            q13Question = q;
          }
        });

        // Reorder: Move question 13 to appear right after gender question
        if (genderQIndex >= 0 && q13Index >= 0 && genderQuestion && q13Question && q13Index > genderQIndex) {
          // Remove question 13 from its current position
          targetSection.questions.splice(q13Index, 1);
          
          // Insert question 13 right after gender question
          const newQ13Index = genderQIndex + 1;
          targetSection.questions.splice(newQ13Index, 0, q13Question);
          
          console.log(`✅ Reordered question 13 to appear after gender question for survey ${TARGET_SURVEY_ID}`);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Survey retrieved successfully',
      data: { survey }
    });

  } catch (error) {
    console.error('Get survey error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};


// @desc    Delete a survey
// @route   DELETE /api/surveys/:id
// @access  Private (Company Admin, Project Manager)
exports.deleteSurvey = async (req, res) => {
  try {
    const { id } = req.params;

    // Get current user and their company
    const currentUser = await User.findById(req.user.id).populate('company');
    if (!currentUser || !currentUser.company) {
      return res.status(400).json({
        success: false,
        message: 'User not associated with any company'
      });
    }

    // Find survey
    const survey = await Survey.findById(id);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Check if user has access to this survey
    if (survey.company.toString() !== currentUser.company._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete surveys from your company.'
      });
    }

    // Check if survey can be deleted (only draft and active surveys)
    if (survey.status !== 'draft' && survey.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Only draft and active surveys can be deleted'
      });
    }

    // Delete the survey
    await Survey.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Survey deleted successfully'
    });

  } catch (error) {
    console.error('Delete survey error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Publish a survey
// @route   POST /api/surveys/:id/publish
// @access  Private (Company Admin, Project Manager)
exports.publishSurvey = async (req, res) => {
  try {
    const { id } = req.params;

    // Get current user and their company
    const currentUser = await User.findById(req.user.id).populate('company');
    if (!currentUser || !currentUser.company) {
      return res.status(400).json({
        success: false,
        message: 'User not associated with any company'
      });
    }

    // Find survey
    const survey = await Survey.findById(id);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Check if user has access to this survey
    if (survey.company.toString() !== currentUser.company._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only publish surveys from your company.'
      });
    }

    // Check if survey can be published
    if (survey.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft surveys can be published'
      });
    }

    // Validate required fields for publishing
    if (!survey.sections || survey.sections.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Survey must have at least one section with questions to be published'
      });
    }

    // Update survey status and publish date
    survey.status = 'active';
    survey.publishedAt = new Date();
    survey.lastModifiedBy = currentUser._id;
    await survey.save();

    // Populate the updated survey
    const publishedSurvey = await Survey.findById(survey._id)
      .populate('company', 'companyName companyCode')
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedInterviewers.interviewer', 'firstName lastName email userType');

    res.status(200).json({
      success: true,
      message: 'Survey published successfully',
      data: { survey: publishedSurvey }
    });

  } catch (error) {
    console.error('Publish survey error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Assign interviewers to survey
// @route   POST /api/surveys/:id/assign-interviewers
// @access  Private (Company Admin, Project Manager)
exports.assignInterviewers = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      interviewerIds, 
      maxInterviews, 
      interviewerACAssignments, 
      interviewerStateAssignments, 
      interviewerCountryAssignments,
      capiInterviewerIds,
      catiInterviewerIds,
      capiACAssignments,
      catiACAssignments,
      capiStateAssignments,
      catiStateAssignments,
      capiCountryAssignments,
      catiCountryAssignments
    } = req.body;

    // Get current user and their company
    const currentUser = await User.findById(req.user.id).populate('company');
    if (!currentUser || !currentUser.company) {
      return res.status(400).json({
        success: false,
        message: 'User not associated with any company'
      });
    }

    // Find survey
    const survey = await Survey.findById(id);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Check if user has access to this survey
    if (survey.company.toString() !== currentUser.company._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only assign interviewers to surveys from your company.'
      });
    }

    // Check if this is a multi-mode survey
    const isMultiMode = survey.mode === 'multi_mode' || (survey.modes && survey.modes.length > 1);
    
    // Validate interviewer IDs based on survey mode
    if (isMultiMode) {
      // For multi-mode surveys, check if we have any interviewers to assign
      const hasCapiInterviewers = capiInterviewerIds && Array.isArray(capiInterviewerIds) && capiInterviewerIds.length > 0;
      const hasCatiInterviewers = catiInterviewerIds && Array.isArray(catiInterviewerIds) && catiInterviewerIds.length > 0;
      
      // If no interviewers are provided (both are undefined, null, or empty arrays), 
      // this is valid - it means we're not updating interviewer assignments
      // This can happen when uploading respondent contacts or updating other survey data
      if (!hasCapiInterviewers && !hasCatiInterviewers) {
        // No interviewers to assign - return success without updating interviewer assignments
        const updatedSurvey = await Survey.findById(survey._id)
          .populate('capiInterviewers.interviewer', 'firstName lastName email userType phone')
          .populate('capiInterviewers.assignedBy', 'firstName lastName email')
          .populate('catiInterviewers.interviewer', 'firstName lastName email userType phone')
          .populate('catiInterviewers.assignedBy', 'firstName lastName email');
        
        return res.status(200).json({
          success: true,
          message: 'Survey updated successfully',
          data: { survey: updatedSurvey }
        });
      }
    } else {
      // For single-mode surveys, use the original logic
      if (!interviewerIds || !Array.isArray(interviewerIds) || interviewerIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Interviewer IDs are required'
        });
      }
    }

    if (isMultiMode) {
      // Handle multi-mode assignments
      const capiAssignments = [];
      const catiAssignments = [];
      
      // Process CAPI interviewers
      if (capiInterviewerIds && capiInterviewerIds.length > 0) {
        const capiInterviewers = await User.find({
          _id: { $in: capiInterviewerIds },
          company: currentUser.company._id,
          userType: 'interviewer',
          status: 'active'
        });

        if (capiInterviewers.length !== capiInterviewerIds.length) {
          return res.status(400).json({
            success: false,
            message: 'Some CAPI interviewers not found or not available'
          });
        }

        capiAssignments.push(...capiInterviewerIds.map(interviewerId => {
          const assignment = {
            interviewer: interviewerId,
            assignedBy: currentUser._id,
            maxInterviews: maxInterviews || 0,
            status: 'assigned'
          };
          
          // Add AC assignments only if assignACs is true and AC assignments are provided
          if (survey.assignACs && capiACAssignments && capiACAssignments[interviewerId]) {
            assignment.assignedACs = capiACAssignments[interviewerId];
          }
          
          // Add state assignment if provided
          if (capiStateAssignments && capiStateAssignments[interviewerId]) {
            assignment.selectedState = capiStateAssignments[interviewerId];
          }
          
          // Add country assignment if provided
          if (capiCountryAssignments && capiCountryAssignments[interviewerId]) {
            assignment.selectedCountry = capiCountryAssignments[interviewerId];
          }
          
          return assignment;
        }));
      }
      
      // Process CATI interviewers
      if (catiInterviewerIds && catiInterviewerIds.length > 0) {
        const catiInterviewers = await User.find({
          _id: { $in: catiInterviewerIds },
          company: currentUser.company._id,
          userType: 'interviewer',
          status: 'active'
        });

        if (catiInterviewers.length !== catiInterviewerIds.length) {
          return res.status(400).json({
            success: false,
            message: 'Some CATI interviewers not found or not available'
          });
        }

        catiAssignments.push(...catiInterviewerIds.map(interviewerId => {
          const assignment = {
            interviewer: interviewerId,
            assignedBy: currentUser._id,
            maxInterviews: maxInterviews || 0,
            status: 'assigned'
          };
          
          // Add AC assignments only if assignACs is true and AC assignments are provided
          if (survey.assignACs && catiACAssignments && catiACAssignments[interviewerId]) {
            assignment.assignedACs = catiACAssignments[interviewerId];
          }
          
          // Add state assignment if provided
          if (catiStateAssignments && catiStateAssignments[interviewerId]) {
            assignment.selectedState = catiStateAssignments[interviewerId];
          }
          
          // Add country assignment if provided
          if (catiCountryAssignments && catiCountryAssignments[interviewerId]) {
            assignment.selectedCountry = catiCountryAssignments[interviewerId];
          }
          
          return assignment;
        }));
      }
      
      // Update survey with mode-specific assignments
      survey.capiInterviewers = capiAssignments;
      survey.catiInterviewers = catiAssignments;
      survey.lastModifiedBy = currentUser._id;
      await survey.save();
      
    } else {
      // Handle single-mode assignments (original logic)
      const interviewers = await User.find({
        _id: { $in: interviewerIds },
        company: currentUser.company._id,
        userType: 'interviewer',
        status: 'active'
      });

      if (interviewers.length !== interviewerIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some interviewers not found or not available'
        });
      }

      // Assign interviewers
      const assignments = interviewerIds.map(interviewerId => {
        const assignment = {
          interviewer: interviewerId,
          assignedBy: currentUser._id,
          maxInterviews: maxInterviews || 0,
          status: 'assigned'
        };
        
        // Add mode assignment if provided (for multi-mode surveys)
        if (req.body.interviewerModeAssignments && req.body.interviewerModeAssignments[interviewerId]) {
          assignment.assignedMode = req.body.interviewerModeAssignments[interviewerId];
        }
        
        // Add AC assignments only if assignACs is true and AC assignments are provided
        if (survey.assignACs && interviewerACAssignments && interviewerACAssignments[interviewerId]) {
          assignment.assignedACs = interviewerACAssignments[interviewerId];
        }
        
        // Add state assignment if provided
        if (interviewerStateAssignments && interviewerStateAssignments[interviewerId]) {
          assignment.selectedState = interviewerStateAssignments[interviewerId];
        }
        
        // Add country assignment if provided
        if (interviewerCountryAssignments && interviewerCountryAssignments[interviewerId]) {
          assignment.selectedCountry = interviewerCountryAssignments[interviewerId];
        }
        
        return assignment;
      });

      survey.assignedInterviewers = assignments;
      survey.lastModifiedBy = currentUser._id;
      await survey.save();
    }

    // Populate the updated survey based on mode
    let updatedSurvey;
    if (isMultiMode) {
      updatedSurvey = await Survey.findById(survey._id)
        .populate('capiInterviewers.interviewer', 'firstName lastName email userType phone')
        .populate('capiInterviewers.assignedBy', 'firstName lastName email')
        .populate('catiInterviewers.interviewer', 'firstName lastName email userType phone')
        .populate('catiInterviewers.assignedBy', 'firstName lastName email');
    } else {
      updatedSurvey = await Survey.findById(survey._id)
        .populate('assignedInterviewers.interviewer', 'firstName lastName email userType phone')
        .populate('assignedInterviewers.assignedBy', 'firstName lastName email');
    }

    res.status(200).json({
      success: true,
      message: 'Interviewers assigned successfully',
      data: { survey: updatedSurvey }
    });

  } catch (error) {
    console.error('Assign interviewers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Assign quality agents to a survey
// @route   POST /api/surveys/:id/assign-quality-agents
// @access  Private (Company Admin, Project Manager)
exports.assignQualityAgents = async (req, res) => {
  try {
    const { id } = req.params;
    const { qualityAgentIds, qualityAgentACAssignments, qualityAgentStateAssignments, qualityAgentCountryAssignments } = req.body;

    // Get current user and their company
    const currentUser = await User.findById(req.user.id).populate('company');
    if (!currentUser || !currentUser.company) {
      return res.status(400).json({
        success: false,
        message: 'User not associated with any company'
      });
    }

    // Find survey
    const survey = await Survey.findById(id);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Check if user has access to this survey
    if (survey.company.toString() !== currentUser.company._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only assign quality agents to surveys from your company.'
      });
    }

    // Validate quality agent IDs
    if (!qualityAgentIds || !Array.isArray(qualityAgentIds) || qualityAgentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Quality agent IDs are required'
      });
    }

    // Check if quality agents exist and belong to the same company
    const qualityAgents = await User.find({
      _id: { $in: qualityAgentIds },
      company: currentUser.company._id,
      userType: 'quality_agent',
      status: 'active'
    });

    if (qualityAgents.length !== qualityAgentIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some quality agents not found or not available'
      });
    }

    // Assign quality agents
    const assignments = qualityAgentIds.map(agentId => {
      const assignment = {
        qualityAgent: agentId,
        assignedBy: currentUser._id,
        status: 'assigned'
      };
      
      // Add AC assignments only if assignACs is true and AC assignments are provided
      if (survey.assignACs && qualityAgentACAssignments && qualityAgentACAssignments[agentId]) {
        assignment.assignedACs = qualityAgentACAssignments[agentId];
      }
      
      // Add state assignment if provided
      if (qualityAgentStateAssignments && qualityAgentStateAssignments[agentId]) {
        assignment.selectedState = qualityAgentStateAssignments[agentId];
      }
      
      // Add country assignment if provided
      if (qualityAgentCountryAssignments && qualityAgentCountryAssignments[agentId]) {
        assignment.selectedCountry = qualityAgentCountryAssignments[agentId];
      }
      
      return assignment;
    });

    survey.assignedQualityAgents = assignments;
    survey.lastModifiedBy = currentUser._id;
    await survey.save();

    // Populate the updated survey
    const updatedSurvey = await Survey.findById(survey._id)
      .populate('assignedQualityAgents.qualityAgent', 'firstName lastName email userType phone')
      .populate('assignedQualityAgents.assignedBy', 'firstName lastName email');

    res.status(200).json({
      success: true,
      message: 'Quality agents assigned successfully',
      data: { survey: updatedSurvey }
    });

  } catch (error) {
    console.error('Assign quality agents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get survey statistics
// @route   GET /api/surveys/stats
// @access  Private (Company Admin, Project Manager)
exports.getSurveyStats = async (req, res) => {
  try {
    // Get current user and their company
    const currentUser = await User.findById(req.user.id).populate('company');
    if (!currentUser || !currentUser.company) {
      return res.status(400).json({
        success: false,
        message: 'User not associated with any company'
      });
    }

    // Get statistics
    const stats = await Survey.getStats(currentUser.company._id);

    res.status(200).json({
      success: true,
      message: 'Survey statistics retrieved successfully',
      data: { stats }
    });

  } catch (error) {
    console.error('Get survey stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get overall statistics for dashboard (optimized with aggregation)
// @route   GET /api/surveys/overall-stats
// @access  Private (Company Admin, Project Manager)
exports.getOverallStats = async (req, res) => {
  try {
    // Get current user and their company
    const currentUser = await User.findById(req.user.id).populate('company');
    if (!currentUser || !currentUser.company) {
      return res.status(400).json({
        success: false,
        message: 'User not associated with any company'
      });
    }

    const companyId = currentUser.company._id;
    
    // Convert to ObjectId if it's not already (companyId from populate is already ObjectId, but ensure it's correct)
    const companyObjectId = mongoose.Types.ObjectId.isValid(companyId) 
      ? (typeof companyId === 'string' ? new mongoose.Types.ObjectId(companyId) : companyId)
      : companyId;

    // Use aggregation to calculate stats efficiently
    // 1. Count total surveys and active surveys
    const surveyStats = await Survey.aggregate([
      { $match: { company: companyObjectId } },
      {
        $group: {
          _id: null,
          totalSurveys: { $sum: 1 },
          activeSurveys: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          }
        }
      }
    ]);

    // 2. Count total responses using aggregation (much faster than fetching all responses)
    // First get all survey IDs for this company, then count responses
    const companySurveyIds = await Survey.find({ company: companyObjectId }).select('_id').lean();
    const surveyIds = companySurveyIds.map(s => s._id);
    
    let responseStats = [{ totalResponses: 0 }];
    if (surveyIds.length > 0) {
      responseStats = await SurveyResponse.aggregate([
        {
          $match: {
            survey: { $in: surveyIds }
          }
        },
        {
          $group: {
            _id: null,
            totalResponses: { $sum: 1 }
          }
        }
      ]);
    }

    // 3. Calculate total cost from surveys (if cost field exists)
    const costStats = await Survey.aggregate([
      { $match: { company: companyObjectId } },
      {
        $group: {
          _id: null,
          totalCost: { $sum: { $ifNull: ['$cost', 0] } }
        }
      }
    ]);

    // Combine results
    const stats = {
      totalSurveys: surveyStats[0]?.totalSurveys || 0,
      activeSurveys: surveyStats[0]?.activeSurveys || 0,
      totalResponses: responseStats[0]?.totalResponses || 0,
      totalCost: costStats[0]?.totalCost || 0
    };

    res.status(200).json({
      success: true,
      message: 'Overall statistics retrieved successfully',
      data: { stats }
    });

  } catch (error) {
    console.error('Get overall stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Update an existing survey
// @route   PUT /api/surveys/:id
// @access  Private (Company Admin, Project Manager)
exports.updateSurvey = async (req, res) => {
  try {
    const surveyId = req.params.id;
    const {
      surveyName,
      description,
      category,
      purpose,
      mode,
      includeGigWorkers,
      startDate,
      deadline,
      sampleSize,
      targetAudience,
      thresholdInterviewsPerDay,
      maxInterviewsPerInterviewer,
      onlineContactMode,
      contactList,
      assignedInterviewers,
      assignedQualityAgents,
      sections,
      templateUsed,
      settings,
      notifications,
      status,
      assignACs,
      acAssignmentCountry,
      acAssignmentState,
      modes,
      modeAllocation,
      modeQuotas,
      modeGigWorkers,
      respondentContacts,
      sets
    } = req.body;

    // Find the survey
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Check if user has permission to update this survey
    const user = req.user;
    if (user.userType === 'company_admin' && survey.company.toString() !== user.company._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this survey'
      });
    }

    // Clean targetAudience data for update
    const cleanTargetAudience = (targetAudience) => {
      console.log('🔍 Backend received targetAudience for update:', JSON.stringify(targetAudience, null, 2));
      
      if (!targetAudience) {
        return {
          demographics: {},
          geographic: {},
          behavioral: {},
          psychographic: {},
          custom: '',
          quotaManagement: false
        };
      }

      // Handle the new structure where each category is an object with boolean flags and requirements
      const cleaned = {
        demographics: targetAudience.demographics || {},
        geographic: targetAudience.geographic || {},
        behavioral: targetAudience.behavioral || {},
        psychographic: targetAudience.psychographic || {},
        custom: targetAudience.custom || '',
        quotaManagement: targetAudience.quotaManagement || false
      };
      
      console.log('🔍 Backend cleaned targetAudience for update:', JSON.stringify(cleaned, null, 2));
      return cleaned;
    };

    // Process assignedInterviewers to handle status updates
    let processedAssignedInterviewers = assignedInterviewers;
    if (assignedInterviewers && Array.isArray(assignedInterviewers)) {
      processedAssignedInterviewers = assignedInterviewers.map(assignment => {
        const processedAssignment = { ...assignment };
        
        // If Company Admin is reassigning an interviewer, reset status to 'assigned'
        if (assignment.status === 'rejected' && assignment.interviewer) {
          processedAssignment.status = 'assigned';
          processedAssignment.assignedAt = new Date(); // Update assignment time
        }
        
        // If assignACs is false, explicitly set assignedACs to empty array to ensure it's removed
        // Using empty array instead of delete to ensure Mongoose properly updates the field
        if (assignACs === false) {
          processedAssignment.assignedACs = [];
        }
        
        return processedAssignment;
      });
    }

    // Process assignedQualityAgents to remove ACs if assignACs is false
    let processedAssignedQualityAgents = assignedQualityAgents || survey.assignedQualityAgents;
    if (processedAssignedQualityAgents && Array.isArray(processedAssignedQualityAgents)) {
      processedAssignedQualityAgents = processedAssignedQualityAgents.map(assignment => {
        const processedAssignment = { ...assignment };
        
        // If assignACs is false, explicitly set assignedACs to empty array to ensure it's removed
        // Using empty array instead of delete to ensure Mongoose properly updates the field
        if (assignACs === false) {
          processedAssignment.assignedACs = [];
        }
        
        return processedAssignment;
      });
    }

    // Prepare update data
    const updateData = {
      surveyName,
      description,
      category,
      purpose,
      mode,
      modes: modes || [],
      modeAllocation: modeAllocation || {},
      modeQuotas: modeQuotas || {},
      modeGigWorkers: modeGigWorkers || {},
      includeGigWorkers: includeGigWorkers || false,
      startDate,
      deadline,
      sampleSize,
      targetAudience: cleanTargetAudience(targetAudience),
      thresholdInterviewsPerDay,
      maxInterviewsPerInterviewer,
      onlineContactMode,
      contactList,
      assignedInterviewers: processedAssignedInterviewers,
      assignedQualityAgents: processedAssignedQualityAgents,
      sections: (() => {
        // Debug: Log sections with settings when updating
        if (sections && Array.isArray(sections)) {
          sections.forEach((section, sectionIdx) => {
            if (section.questions && Array.isArray(section.questions)) {
              section.questions.forEach((question, questionIdx) => {
                if (question.type === 'multiple_choice' && question.settings) {
                  console.log('🔍 Backend updating question with settings:', {
                    sectionIndex: sectionIdx,
                    questionIndex: questionIdx,
                    questionId: question.id,
                    questionText: question.text,
                    settings: question.settings
                  });
                }
              });
            }
          });
        }
        return sections;
      })(),
      templateUsed,
      settings,
      notifications,
      status,
      assignACs,
      acAssignmentCountry: assignACs ? acAssignmentCountry : '',
      acAssignmentState: assignACs ? acAssignmentState : '',
      respondentContacts: respondentContacts !== undefined ? respondentContacts : survey.respondentContacts,
      sets: sets !== undefined ? sets : survey.sets,
      updatedAt: new Date()
    };

    // Update the survey
    // Note: MongoDB handles large arrays efficiently, but we ensure proper indexing
    const updatedSurvey = await Survey.findByIdAndUpdate(
      surveyId,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email')
     .populate('company', 'companyName companyCode')
     .populate('assignedInterviewers.interviewer', 'firstName lastName email phone')
     .populate('assignedQualityAgents.qualityAgent', 'firstName lastName email phone');

    res.status(200).json({
      success: true,
      message: 'Survey updated successfully',
      data: {
        survey: updatedSurvey
      }
    });

  } catch (error) {
    console.error('Error updating survey:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get available surveys for interviewer or quality agent
// @route   GET /api/surveys/available
// @access  Private (Interviewer, Quality Agent)
exports.getAvailableSurveys = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const { search, status, category, sortBy = 'assignedAt', sortOrder = 'desc' } = req.query;

    console.log('🔍 getAvailableSurveys - Current user ID:', currentUser._id);
    console.log('🔍 getAvailableSurveys - User type:', currentUser.userType);
    console.log('🔍 getAvailableSurveys - Query params:', { search, status, category, sortBy, sortOrder });

    // Build query based on user type
    let query = {};
    
    if (currentUser.userType === 'quality_agent') {
      // For quality agents, find surveys where they are assigned as quality agents
      query = {
        'assignedQualityAgents.qualityAgent': currentUser._id,
        status: { $in: ['active', 'draft'] } // Only show active or draft surveys
      };
    } else {
      // For interviewers, find surveys where they are assigned as interviewers
      // Handle both single-mode (assignedInterviewers) and multi-mode (capiInterviewers, catiInterviewers) surveys
      query = {
        $or: [
          { 'assignedInterviewers.interviewer': currentUser._id },
          { 'capiInterviewers.interviewer': currentUser._id },
          { 'catiInterviewers.interviewer': currentUser._id }
        ],
        status: { $in: ['active', 'draft'] } // Only show active or draft surveys
      };
    }

    // Add search filter
    if (search) {
      if (currentUser.userType === 'quality_agent') {
        // For quality agents, add search to existing query
        query.$and = [
          { 'assignedQualityAgents.qualityAgent': currentUser._id },
          {
            $or: [
              { surveyName: { $regex: search, $options: 'i' } },
              { description: { $regex: search, $options: 'i' } },
              { category: { $regex: search, $options: 'i' } }
            ]
          }
        ];
      } else {
        // For interviewers, add search to existing query
        query.$and = [
          {
            $or: [
              { 'assignedInterviewers.interviewer': currentUser._id },
              { 'capiInterviewers.interviewer': currentUser._id },
              { 'catiInterviewers.interviewer': currentUser._id }
            ]
          },
          {
            $or: [
              { surveyName: { $regex: search, $options: 'i' } },
              { description: { $regex: search, $options: 'i' } },
              { category: { $regex: search, $options: 'i' } }
            ]
          }
        ];
        delete query.$or; // Remove the original $or since we're using $and now
      }
    }

    // Add category filter
    if (category) {
      query.category = category;
    }

    // Build sort object
    let sort = {};
    if (sortBy === 'assignedAt') {
      // For assignedAt sorting, we'll handle this in the transformation since we have multiple possible assignment arrays
      sort.createdAt = sortOrder === 'asc' ? 1 : -1; // Fallback to createdAt
    } else if (sortBy === 'deadline') {
      sort.deadline = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'surveyName') {
      sort.surveyName = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = -1; // Default sort
    }

    console.log('🔍 getAvailableSurveys - Final query:', JSON.stringify(query, null, 2));

    const surveys = await Survey.find(query)
      .populate('createdBy', 'firstName lastName email')
      .sort(sort)
      .lean();

    console.log('🔍 getAvailableSurveys - Found surveys:', surveys.length);
    if (surveys.length > 0) {
      console.log('🔍 getAvailableSurveys - First survey ID:', surveys[0]._id);
      console.log('🔍 getAvailableSurveys - First survey mode:', surveys[0].mode);
    }

    // Transform the data to include assignment-specific information
    const transformedSurveys = surveys.map(survey => {
      console.log(`🔍 Processing survey ${survey._id} (mode: ${survey.mode})`);
      let assignment = null;
      let assignedMode = null;

      // Check for single-mode assignment
      if (survey.assignedInterviewers && survey.assignedInterviewers.length > 0) {
        assignment = survey.assignedInterviewers.find(
          assignment => assignment.interviewer.toString() === currentUser._id.toString()
        );
        if (assignment) {
          assignedMode = assignment.assignedMode || 'single';
        }
      }

      // Check for multi-mode CAPI assignment
      if (!assignment && survey.capiInterviewers && survey.capiInterviewers.length > 0) {
        console.log(`🔍 Checking CAPI interviewers for survey ${survey._id}:`, survey.capiInterviewers.length);
        assignment = survey.capiInterviewers.find(
          assignment => assignment.interviewer.toString() === currentUser._id.toString()
        );
        if (assignment) {
          assignedMode = 'capi';
          console.log(`🔍 Found CAPI assignment for user ${currentUser._id}`);
        }
      }

      // Check for multi-mode CATI assignment
      if (!assignment && survey.catiInterviewers && survey.catiInterviewers.length > 0) {
        assignment = survey.catiInterviewers.find(
          assignment => assignment.interviewer.toString() === currentUser._id.toString()
        );
        if (assignment) {
          assignedMode = 'cati';
        }
      }

      return {
        ...survey,
        assignmentStatus: assignment ? assignment.status : 'assigned',
        assignedAt: assignment ? assignment.assignedAt : survey.createdAt,
        assignedACs: assignment ? assignment.assignedACs : [],
        selectedState: assignment ? assignment.selectedState : null,
        selectedCountry: assignment ? assignment.selectedCountry : null,
        maxInterviews: assignment ? assignment.maxInterviews : 0,
        completedInterviews: assignment ? assignment.completedInterviews : 0,
        assignedMode: assignedMode // Add the assigned mode for multi-mode surveys
      };
    });

    // Filter out surveys where the interviewer has rejected the assignment
    let filteredSurveys = transformedSurveys.filter(survey => 
      survey.assignmentStatus !== 'rejected'
    );
    
    if (status) {
      filteredSurveys = filteredSurveys.filter(survey => survey.assignmentStatus === status);
    }

    // Handle assignedAt sorting after transformation
    if (sortBy === 'assignedAt') {
      filteredSurveys.sort((a, b) => {
        const aDate = new Date(a.assignedAt);
        const bDate = new Date(b.assignedAt);
        return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
      });
    }

    res.json({
      success: true,
      data: {
        surveys: filteredSurveys,
        total: filteredSurveys.length
      }
    });

  } catch (error) {
    console.error('Error fetching available surveys:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Reject an interview assignment
// @route   POST /api/surveys/:id/reject-interview
// @access  Private (Interviewer)
exports.rejectInterview = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const survey = await Survey.findById(req.params.id);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Find the assignment for this interviewer
    const assignment = survey.assignedInterviewers.find(
      assignment => assignment.interviewer.toString() === currentUser._id.toString()
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Interview assignment not found'
      });
    }

    // Check if already rejected or completed
    if (assignment.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Interview has already been rejected'
      });
    }

    if (assignment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject a completed interview'
      });
    }

    // Update the assignment status to rejected
    assignment.status = 'rejected';
    await survey.save();

    res.json({
      success: true,
      message: 'Interview rejected successfully',
      data: {
        surveyId: survey._id,
        assignmentStatus: 'rejected'
      }
    });

  } catch (error) {
    console.error('Error rejecting interview:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Debug endpoint to check survey responses
exports.debugSurveyResponses = async (req, res) => {
  try {
    const { surveyId } = req.params;
    
    // Get all responses for this survey
    const allResponses = await SurveyResponse.find({ survey: surveyId });
    
    // Group by status
    const statusCounts = {};
    allResponses.forEach(response => {
      statusCounts[response.status] = (statusCounts[response.status] || 0) + 1;
    });
    
    res.json({
      success: true,
      data: {
        surveyId,
        totalResponses: allResponses.length,
        statusCounts,
        responses: allResponses.map(r => ({
          id: r._id,
          status: r.status,
          interviewer: r.interviewer,
          createdAt: r.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Debug survey responses error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Configure multer for Excel file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.ms-excel.sheet.macroEnabled.12' // .xlsm
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed.'));
    }
  }
});

// @desc    Download Excel template for respondent contacts
// @route   GET /api/surveys/respondent-contacts/template
// @access  Private (Company Admin, Project Manager)
exports.downloadRespondentTemplate = async (req, res) => {
  try {
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    
    // Define column headers - Country Code is optional and comes before Phone
    const headers = ['Name', 'Country Code', 'Phone', 'Email', 'Address', 'City', 'AC', 'PC', 'PS'];
    
    // Create worksheet with headers
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, // Name
      { wch: 12 }, // Country Code
      { wch: 15 }, // Phone
      { wch: 30 }, // Email
      { wch: 40 }, // Address
      { wch: 20 }, // City
      { wch: 15 }, // AC
      { wch: 15 }, // PC
      { wch: 15 }  // PS
    ];
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Respondents');
    
    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="CATI_Respondent_Template.xlsx"');
    
    // Send file
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error generating Excel template:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating template',
      error: error.message
    });
  }
};

// @desc    Upload and parse Excel file with respondent contacts
// @route   POST /api/surveys/respondent-contacts/upload
// @access  Private (Company Admin, Project Manager)
exports.uploadRespondentContacts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON - use raw: true to preserve phone numbers as they are
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      header: ['name', 'countryCode', 'phone', 'email', 'address', 'city', 'ac', 'pc', 'ps'],
      defval: '',
      raw: true  // Get raw values to preserve phone numbers exactly as entered
    });
    
    // Filter out header rows - check if row contains header values
    const headerValues = ['name', 'country code', 'phone', 'email', 'address', 'city', 'ac', 'pc', 'ps'];
    const filteredData = data.filter(row => {
      // Skip rows where name or phone matches header values (case-insensitive)
      const nameStr = row.name ? row.name.toString().toLowerCase().trim() : '';
      const phoneStr = row.phone ? row.phone.toString().toLowerCase().trim() : '';
      
      // Skip if name or phone is a header value
      if (headerValues.includes(nameStr) || headerValues.includes(phoneStr)) {
        return false;
      }
      
      // Skip if name is exactly "Name" or phone is exactly "Phone"
      if (nameStr === 'name' || phoneStr === 'phone') {
        return false;
      }
      
      return true;
    });
    
    // Debug: Log first few rows to see what we're getting
    console.log('📊 Total rows from Excel (before filter):', data.length);
    console.log('📊 Filtered rows (after removing headers):', filteredData.length);
    console.log('📊 First 3 rows from Excel:', JSON.stringify(filteredData.slice(0, 3), null, 2));

    // Validate and process contacts
    const contacts = [];
    const errors = [];

    // Use filtered data (with headers removed)
    filteredData.forEach((row, index) => {
      // Skip empty rows
      if (!row.name && !row.phone && !row.countryCode) {
        return;
      }

      // Validate required fields
      if (!row.name || (typeof row.name === 'string' && row.name.trim() === '')) {
        errors.push(`Row ${index + 2}: Name is required`);
        return;
      }
      
      // Check if phone is provided (handle 0, empty string, null, undefined, and dash)
      const phoneValue = row.phone;
      if (phoneValue === null || phoneValue === undefined || phoneValue === '' || 
          (typeof phoneValue === 'string' && phoneValue.trim() === '') ||
          (typeof phoneValue === 'string' && phoneValue.trim() === '-')) {
        errors.push(`Row ${index + 2}: Phone number is required (received: ${JSON.stringify(phoneValue)})`);
        return;
      }

      // Convert phone to string and handle various formats
      let phoneStr = '';
      
      // Debug logging for phone number
      console.log(`📱 Row ${index + 2} - Phone raw value:`, row.phone, 'Type:', typeof row.phone);
      
      if (row.phone === null || row.phone === undefined) {
        errors.push(`Row ${index + 2}: Phone number is required`);
        return;
      }
      
      // Handle different phone number formats
      if (typeof row.phone === 'number') {
        // If it's a number, convert to string without scientific notation
        // Handle large numbers that might be in scientific notation
        const numStr = row.phone.toString();
        if (numStr.includes('e') || numStr.includes('E')) {
          // Convert from scientific notation (e.g., 9.958011332e+9 -> 9958011332)
          phoneStr = row.phone.toFixed(0);
        } else {
          // Regular number, convert to string
          phoneStr = numStr;
        }
      } else if (typeof row.phone === 'string') {
        phoneStr = row.phone;
      } else if (row.phone !== null && row.phone !== undefined) {
        // Try to convert to string
        phoneStr = String(row.phone);
      } else {
        errors.push(`Row ${index + 2}: Phone number is empty or invalid (type: ${typeof row.phone})`);
        return;
      }

      // Clean phone number (remove spaces, dashes, parentheses, plus signs, dots, etc.)
      let cleanPhone = phoneStr.trim();
      
      // Remove leading + if present (we'll validate length separately)
      if (cleanPhone.startsWith('+')) {
        cleanPhone = cleanPhone.substring(1);
      }
      
      // Remove all non-digit characters
      cleanPhone = cleanPhone.replace(/[^\d]/g, '');
      
      console.log(`📱 Row ${index + 2} - Phone after cleaning:`, cleanPhone, 'Length:', cleanPhone.length);

      // Validate phone number format (should be numeric and 10-15 digits)
      // Also check if it's not empty after cleaning
      if (!cleanPhone || cleanPhone.length === 0) {
        errors.push(`Row ${index + 2}: Phone number is empty or invalid (original: "${phoneStr}", cleaned: "${cleanPhone}")`);
        return;
      }
      
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        errors.push(`Row ${index + 2}: Invalid phone number format. Phone must be 10-15 digits (got ${cleanPhone.length} digits: "${cleanPhone}")`);
        return;
      }
      
      if (!/^\d+$/.test(cleanPhone)) {
        errors.push(`Row ${index + 2}: Phone number contains non-numeric characters`);
        return;
      }

      // Handle country code (optional)
      let countryCode = '';
      if (row.countryCode !== null && row.countryCode !== undefined && row.countryCode !== '') {
        const countryCodeStr = String(row.countryCode).trim();
        // Remove + if present
        countryCode = countryCodeStr.startsWith('+') ? countryCodeStr.substring(1) : countryCodeStr;
        // Remove non-digit characters
        countryCode = countryCode.replace(/[^\d]/g, '');
      }

      // Create contact object
      const contact = {
        name: row.name.toString().trim(),
        countryCode: countryCode || undefined, // Store only if provided
        phone: cleanPhone,
        email: row.email ? row.email.toString().trim() : '',
        address: row.address ? row.address.toString().trim() : '',
        city: row.city ? row.city.toString().trim() : '',
        ac: row.ac ? row.ac.toString().trim() : '',
        pc: row.pc ? row.pc.toString().trim() : '',
        ps: row.ps ? row.ps.toString().trim() : '',
        addedAt: new Date(),
        addedBy: req.user.id
      };

      contacts.push(contact);
    });

    if (errors.length > 0 && contacts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid contacts found in file',
        errors: errors
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully parsed ${contacts.length} contact(s)`,
      data: {
        contacts: contacts,
        errors: errors.length > 0 ? errors : undefined,
        totalRows: data.length,
        validContacts: contacts.length,
        invalidRows: errors.length
      }
    });

  } catch (error) {
    console.error('Error parsing Excel file:', error);
    res.status(500).json({
      success: false,
      message: 'Error parsing Excel file',
      error: error.message
    });
  }
};

// @desc    Get respondent contacts for a survey (from JSON file or database)
// @route   GET /api/surveys/:id/respondent-contacts
// @access  Private (Company Admin, Project Manager)
exports.getRespondentContacts = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    // Find the survey
    const survey = await Survey.findById(id);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Check if user has permission
    const currentUser = await User.findById(req.user.id).populate('company');
    if (!currentUser || !currentUser.company) {
      return res.status(400).json({
        success: false,
        message: 'User not associated with any company'
      });
    }

    if (survey.company.toString() !== currentUser.company._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view contacts from your company surveys.'
      });
    }

    const fs = require('fs').promises;
    const path = require('path');
    
    let contacts = [];
    let total = 0;

    // Check if contacts are stored in JSON file
    const possiblePaths = [];
    
    if (survey.respondentContactsFile) {
      if (path.isAbsolute(survey.respondentContactsFile)) {
        possiblePaths.push(survey.respondentContactsFile);
      } else {
        // Try relative to backend directory
        possiblePaths.push(path.join(__dirname, '..', survey.respondentContactsFile));
        // Try relative to project root
        possiblePaths.push(path.join('/var/www/opine', survey.respondentContactsFile));
      }
    }
    
    // Also try default paths
    possiblePaths.push(path.join('/var/www/opine', 'data', 'respondent-contacts', `${id}.json`));
    possiblePaths.push(path.join(__dirname, '..', 'data', 'respondent-contacts', `${id}.json`));
    
    // Also check Optimised-backup directory
    possiblePaths.push(path.join('/var/www/Optimised-backup', 'opine', 'data', 'respondent-contacts', `${id}.json`));
    
    let fileRead = false;
    console.log(`🔍 Looking for respondent contacts file for survey: ${id}`);
    console.log(`🔍 Possible paths:`, possiblePaths);
    
    for (const filePath of possiblePaths) {
      try {
        await fs.access(filePath);
        console.log(`✅ File found at: ${filePath}`);
        
        const fileContent = await fs.readFile(filePath, 'utf8');
        contacts = JSON.parse(fileContent);
        
        if (!Array.isArray(contacts)) {
          console.warn(`⚠️ File content is not an array, got:`, typeof contacts);
          contacts = [];
        }
        
        total = contacts.length;
        fileRead = true;
        console.log(`✅ Successfully read ${total} contacts from file: ${filePath}`);
        break;
      } catch (fileError) {
        console.log(`❌ Could not read file at ${filePath}:`, fileError.message);
        continue;
      }
    }
    
    if (!fileRead) {
      console.log(`⚠️ No JSON file found, will check database array`);
    }
    
    if (fileRead) {
      // Apply pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;
      const paginatedContacts = contacts.slice(skip, skip + limitNum);
      
      return res.status(200).json({
        success: true,
        message: 'Respondent contacts retrieved successfully',
        data: {
          contacts: paginatedContacts,
          pagination: {
            current: pageNum,
            pages: Math.ceil(total / limitNum),
            total: total,
            limit: limitNum,
            hasNext: skip + limitNum < total,
            hasPrev: pageNum > 1
          }
        }
      });
    }

    // Fallback: Check if contacts are in database array
    if (survey.respondentContacts && Array.isArray(survey.respondentContacts) && survey.respondentContacts.length > 0) {
      contacts = survey.respondentContacts;
      total = contacts.length;
      
      // Apply pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;
      const paginatedContacts = contacts.slice(skip, skip + limitNum);
      
      return res.status(200).json({
        success: true,
        message: 'Respondent contacts retrieved successfully',
        data: {
          contacts: paginatedContacts,
          pagination: {
            current: pageNum,
            pages: Math.ceil(total / limitNum),
            total: total,
            limit: limitNum,
            hasNext: skip + limitNum < total,
            hasPrev: pageNum > 1
          }
        }
      });
    }

    // No contacts found
    return res.status(200).json({
      success: true,
      message: 'No respondent contacts found',
      data: {
        contacts: [],
        pagination: {
          current: parseInt(page),
          pages: 0,
          total: 0,
          limit: parseInt(limit),
          hasNext: false,
          hasPrev: false
        }
      }
    });

  } catch (error) {
    console.error('Error fetching respondent contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Save respondent contacts modifications (added/deleted)
// @route   PUT /api/surveys/:id/respondent-contacts
// @access  Private (Company Admin, Project Manager)
exports.saveRespondentContacts = async (req, res) => {
  try {
    const { id } = req.params;
    const { added = [], deleted = [] } = req.body;
    
    // Find the survey
    const survey = await Survey.findById(id);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Check if user has permission
    const currentUser = await User.findById(req.user.id).populate('company');
    if (!currentUser || !currentUser.company) {
      return res.status(400).json({
        success: false,
        message: 'User not associated with any company'
      });
    }

    if (survey.company.toString() !== currentUser.company._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only modify contacts from your company surveys.'
      });
    }

    const fs = require('fs').promises;
    const path = require('path');
    
    // Determine file path
    let filePath = path.join('/var/www/opine', 'data', 'respondent-contacts', `${id}.json`);
    
    // Ensure directory exists
    const dirPath = path.dirname(filePath);
    await fs.mkdir(dirPath, { recursive: true });
    
    // Read existing contacts from JSON file or database
    let allContacts = [];
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      allContacts = JSON.parse(fileContent);
      if (!Array.isArray(allContacts)) {
        allContacts = [];
      }
    } catch (fileError) {
      // File doesn't exist, try database array
      if (survey.respondentContacts && Array.isArray(survey.respondentContacts)) {
        allContacts = survey.respondentContacts;
      }
    }
    
    // Get phone numbers for deleted contacts BEFORE applying deletions
    const deletedPhones = [];
    if (deleted && deleted.length > 0) {
      const deletedIds = new Set(deleted);
      allContacts.forEach(contact => {
        const contactId = contact._id || contact.id || `${contact.phone}_${contact.name}`;
        if (deletedIds.has(contactId) && contact.phone) {
          deletedPhones.push(contact.phone);
        }
      });
      
      // Apply deletions
      allContacts = allContacts.filter(contact => {
        const contactId = contact._id || contact.id || `${contact.phone}_${contact.name}`;
        return !deletedIds.has(contactId);
      });
    }
    
    // Apply additions
    if (added && added.length > 0) {
      const newContacts = added.map(contact => ({
        name: contact.name || '',
        phone: contact.phone || '',
        countryCode: contact.countryCode || '',
        email: contact.email || '',
        address: contact.address || '',
        city: contact.city || '',
        ac: contact.ac || '',
        pc: contact.pc || '',
        ps: contact.ps || '',
        addedAt: contact.addedAt || new Date().toISOString(),
        addedBy: req.user.id
      }));
      
      allContacts = [...newContacts, ...allContacts];
    }
    
    // Save updated contacts to JSON file
    await fs.writeFile(filePath, JSON.stringify(allContacts, null, 2), 'utf8');
    
    // Update survey to reference the JSON file if not already set
    if (!survey.respondentContactsFile) {
      await Survey.findByIdAndUpdate(id, {
        respondentContactsFile: `data/respondent-contacts/${id}.json`
      });
    }
    
    // Update CATI respondent queue entries
    const CatiRespondentQueue = require('../models/CatiRespondentQueue');
    
    // Delete queue entries for deleted contacts
    if (deletedPhones.length > 0) {
      const deleteResult = await CatiRespondentQueue.deleteMany({
        survey: id,
        'respondentContact.phone': { $in: deletedPhones },
        status: { $in: ['pending', 'call_failed', 'busy', 'no_answer', 'switched_off', 'not_reachable', 'does_not_exist', 'rejected'] }
      });
    }
    
    // Create queue entries for added contacts
    if (added && added.length > 0) {
      // Solution 2: Optimize duplicate checking - use distinct() instead of fetching all entries
      // This is much more memory-efficient for large datasets
      console.log(`🔍 Checking for duplicate phones in queue for survey ${id}...`);
      const existingPhones = await CatiRespondentQueue.distinct(
        'respondentContact.phone',
        { survey: id }
      );
      const existingPhonesSet = new Set(existingPhones.filter(Boolean));
      console.log(`✅ Found ${existingPhonesSet.size} existing phone numbers in queue`);
      
      const newContactsForQueue = added.filter(contact => {
        const phone = contact.phone || '';
        return phone && !existingPhonesSet.has(phone);
      });
      
      console.log(`📊 Filtered ${added.length} added contacts to ${newContactsForQueue.length} new contacts for queue`);
      
      if (newContactsForQueue.length > 0) {
        // Solution 1: Batch processing for queue creation
        // Process in chunks to avoid memory issues and MongoDB limits
        const BATCH_SIZE = 5000; // Process 5000 contacts at a time
        const queueEntries = newContactsForQueue.map(contact => ({
          survey: id,
          respondentContact: {
            name: contact.name || '',
            countryCode: contact.countryCode || '',
            phone: contact.phone || '',
            email: contact.email || '',
            address: contact.address || '',
            city: contact.city || '',
            ac: contact.ac || '',
            pc: contact.pc || '',
            ps: contact.ps || ''
          },
          status: 'pending',
          currentAttemptNumber: 0
        }));
        
        // Process in batches
        let totalInserted = 0;
        let totalBatches = Math.ceil(queueEntries.length / BATCH_SIZE);
        console.log(`📦 Processing ${queueEntries.length} queue entries in ${totalBatches} batches of ${BATCH_SIZE}...`);
        
        for (let i = 0; i < queueEntries.length; i += BATCH_SIZE) {
          const batch = queueEntries.slice(i, i + BATCH_SIZE);
          const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
          
          try {
            // Use ordered: false to continue inserting even if some documents fail validation
            await CatiRespondentQueue.insertMany(batch, { 
              ordered: false,
              lean: false 
            });
            totalInserted += batch.length;
            console.log(`✅ Batch ${batchNumber}/${totalBatches} completed: ${batch.length} entries inserted (Total: ${totalInserted}/${queueEntries.length})`);
            
            // Small delay between batches to prevent overwhelming MongoDB
            if (i + BATCH_SIZE < queueEntries.length) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          } catch (batchError) {
            // If batch fails, log error but continue with next batch
            // This prevents one bad batch from stopping the entire process
            console.error(`⚠️ Error inserting batch ${batchNumber}:`, batchError.message);
            // Try to insert individually to identify problematic entries
            if (batchError.writeErrors && batchError.writeErrors.length > 0) {
              console.error(`⚠️ ${batchError.writeErrors.length} entries failed in batch ${batchNumber}`);
            }
            // Continue with next batch
          }
        }
        
        console.log(`✅ Queue creation completed: ${totalInserted}/${queueEntries.length} entries inserted successfully`);
      } else {
        console.log(`ℹ️ No new contacts to add to queue (all ${added.length} contacts already exist)`);
      }
    }
    
    return res.status(200).json({
      success: true,
      message: 'Respondent contacts saved successfully',
      data: {
        total: allContacts.length,
        added: added?.length || 0,
        deleted: deleted?.length || 0
      }
    });

  } catch (error) {
    console.error('Error saving respondent contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get CATI performance stats for a survey
// @route   GET /api/surveys/:id/cati-stats
// @access  Private (Company Admin, Project Manager)
exports.getCatiStats = async (req, res) => {
  // Set a timeout for this operation (5 minutes)
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error('❌ getCatiStats - TIMEOUT after 5 minutes');
      res.status(504).json({
        success: false,
        message: 'Request timeout - The operation is taking too long. Please try with more specific filters.',
        error: 'Timeout'
      });
    }
  }, 300000); // 5 minutes

  try {
    const { id } = req.params;
    const { startDate, endDate, interviewerIds, interviewerMode, ac } = req.query; // Get filters from query params
    
    console.log(`🔍🔍🔍 getCatiStats - START - Request for survey ID: ${id}`);
    console.log(`🔍🔍🔍 getCatiStats - Filters:`, { startDate, endDate, interviewerIds, interviewerMode, ac });
    console.log(`🔍🔍🔍 getCatiStats - User:`, req.user?.email, req.user?.userType);
    
    // Get current user and their company
    const currentUser = await User.findById(req.user.id).populate('company');
    if (!currentUser || !currentUser.company) {
      return res.status(400).json({
        success: false,
        message: 'User not associated with any company'
      });
    }

    // Find survey
    const survey = await Survey.findById(id);
    if (!survey) {
      console.log(`❌ getCatiStats - Survey not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    console.log(`✅ getCatiStats - Survey found: ${survey.surveyName || survey.title}`);

    // Check access
    if (survey.company.toString() !== currentUser.company._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Convert survey ID to ObjectId if needed
    const mongoose = require('mongoose');
    const surveyObjectId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;

    console.log(`🔍 getCatiStats - Survey ID: ${id}, ObjectId: ${surveyObjectId}`);

    // Build date filter
    // IMPORTANT: Frontend sends dates as YYYY-MM-DD representing LOCAL dates in IST (UTC+5:30)
    // We need to convert these IST dates to UTC date ranges that cover the entire IST day
    // IST is UTC+5:30, so for IST date "2025-12-13":
    //   IST 2025-12-13 00:00:00 = UTC 2025-12-12 18:30:00
    //   IST 2025-12-13 23:59:59.999 = UTC 2025-12-13 18:29:59.999
    const dateFilter = {};
    if (startDate) {
      // Parse YYYY-MM-DD as IST date
      const [year, month, day] = startDate.split('-').map(Number);
      // IST midnight (00:00:00) = UTC previous day 18:30:00
      // Create UTC date for the day at 18:30:00, then subtract 1 day
      const startDateUTC = new Date(Date.UTC(year, month - 1, day, 18, 30, 0, 0));
      startDateUTC.setUTCDate(startDateUTC.getUTCDate() - 1);
      dateFilter.createdAt = { $gte: startDateUTC };
    }
    if (endDate) {
      // Parse YYYY-MM-DD as IST date
      const [year, month, day] = endDate.split('-').map(Number);
      // IST end of day (23:59:59.999) = UTC same day 18:29:59.999
      const endDateUTC = new Date(Date.UTC(year, month - 1, day, 18, 29, 59, 999));
      dateFilter.createdAt = { 
        ...dateFilter.createdAt, 
        $lte: endDateUTC
      };
    }

    // Build interviewer filter
    let interviewerFilter = {};
    let projectManagerInterviewerIds = [];
    
    // For project managers: if interviewerIds not provided, get from assignedTeamMembers
    if (!interviewerIds && req.user.userType === 'project_manager') {
      try {
        console.log('🔍 getCatiStats - Project Manager detected, fetching assigned interviewers');
        const currentUser = await User.findById(req.user.id);
        console.log('🔍 getCatiStats - Current user:', currentUser?._id, currentUser?.userType);
        console.log('🔍 getCatiStats - Assigned team members count:', currentUser?.assignedTeamMembers?.length || 0);
        
        if (currentUser && currentUser.assignedTeamMembers && currentUser.assignedTeamMembers.length > 0) {
          const assignedInterviewers = currentUser.assignedTeamMembers
            .filter(tm => tm.userType === 'interviewer' && tm.user)
            .map(tm => {
              // Handle both ObjectId and populated user object
              const userId = tm.user._id ? tm.user._id : tm.user;
              return userId.toString();
            })
            .filter(id => mongoose.Types.ObjectId.isValid(id));
          
          if (assignedInterviewers.length > 0) {
            projectManagerInterviewerIds = assignedInterviewers.map(id => new mongoose.Types.ObjectId(id));
            interviewerIds = assignedInterviewers.join(',');
            console.log('🔍 getCatiStats - Filtering by', projectManagerInterviewerIds.length, 'assigned interviewers');
          } else {
            console.log('⚠️ getCatiStats - No assigned interviewers found for project manager');
          }
        } else {
          console.log('⚠️ getCatiStats - Project manager has no assigned team members');
        }
      } catch (error) {
        console.error('❌ Error fetching project manager assigned interviewers:', error);
        // Continue without filtering if there's an error
      }
    }
    
    if (interviewerIds) {
      const interviewerIdArray = typeof interviewerIds === 'string' 
        ? interviewerIds.split(',').filter(id => id.trim())
        : Array.isArray(interviewerIds) ? interviewerIds : [];
      
      if (interviewerIdArray.length > 0) {
        const validInterviewerIds = interviewerIdArray
          .map(id => mongoose.Types.ObjectId.isValid(id.trim()) ? new mongoose.Types.ObjectId(id.trim()) : null)
          .filter(id => id !== null);
        
        if (validInterviewerIds.length > 0) {
          if (interviewerMode === 'exclude') {
            interviewerFilter.interviewer = { $nin: validInterviewerIds };
          } else {
            interviewerFilter.interviewer = { $in: validInterviewerIds };
          }
          // Store for use in call records query
          projectManagerInterviewerIds = validInterviewerIds;
        }
      }
    } else if (req.user.userType === 'project_manager' && projectManagerInterviewerIds.length === 0) {
      console.log('⚠️ getCatiStats - Project manager but no interviewer filter applied - returning empty results');
      // For project managers with no assigned interviewers, return empty results
      return res.json({
        success: true,
        data: {
          callerPerformance: {
            callsMade: 0,
            callsAttended: 0,
            callsConnected: 0,
            totalTalkDuration: '0:00:00'
          },
          numberStats: {
            callNotReceived: 0,
            ringing: 0,
            notRinging: 0
          },
          callNotRingStatus: {
            switchOff: 0,
            numberNotReachable: 0,
            numberDoesNotExist: 0
          },
          callRingStatus: {
            callsConnected: 0,
            callsNotConnected: 0
          },
          interviewerStats: [],
          callRecords: []
        }
      });
    }

    // Build AC filter
    let acFilter = {};
    if (ac && ac.trim()) {
      // Filter by AC from respondent contact or response metadata
      acFilter.$or = [
        { 'metadata.respondentContact.ac': ac },
        { 'metadata.respondentContact.assemblyConstituency': ac },
        { 'metadata.respondentContact.acName': ac },
        { 'metadata.respondentContact.assemblyConstituencyName': ac },
        { selectedAC: ac }
      ];
    }

    // Get CATI responses to extract call status from metadata
    const catiResponsesQuery = {
      survey: surveyObjectId,
      interviewMode: 'cati',
      ...dateFilter,
      ...interviewerFilter,
      ...acFilter
    };
    
    console.log(`🔍 getCatiStats - Query filter:`, JSON.stringify(catiResponsesQuery, null, 2));
    
    let catiResponses = await SurveyResponse.find(catiResponsesQuery)
      .populate('interviewer', 'firstName lastName phone memberId')
      .select('_id interviewer metadata callStatus responses totalTimeSpent status createdAt knownCallStatus qcBatch isSampleResponse')
      .lean(); // Use lean() for better performance - returns plain JavaScript objects
    
    // Additional safety filter: For project managers, ensure we only include responses from assigned interviewers
    // This catches any edge cases where the query filter might not work correctly
    if (projectManagerInterviewerIds.length > 0) {
      const originalCount = catiResponses.length;
      catiResponses = catiResponses.filter(response => {
        if (!response.interviewer || !response.interviewer._id) return false;
        const interviewerId = response.interviewer._id.toString();
        const interviewerIdObj = mongoose.Types.ObjectId.isValid(interviewerId) 
          ? new mongoose.Types.ObjectId(interviewerId) 
          : null;
        if (!interviewerIdObj) return false;
        return projectManagerInterviewerIds.some(id => id.toString() === interviewerIdObj.toString());
      });
      if (originalCount !== catiResponses.length) {
        console.log(`⚠️ getCatiStats - Filtered ${originalCount - catiResponses.length} responses that didn't match assigned interviewers`);
      }
    }
    
    console.log(`🔍 getCatiStats - Found ${catiResponses.length} CATI responses (after project manager filtering)`);

    // Apply AC filter after extraction (since AC might be in responses array)
    // This ensures AC filter works correctly even when AC is stored in responses
    if (ac && ac.trim()) {
      const { getRespondentInfo } = require('../utils/respondentInfoUtils');
      const originalCount = catiResponses.length;
      catiResponses = catiResponses.filter(response => {
        const respondentInfo = getRespondentInfo(response.responses || [], response, survey);
        const responseAC = respondentInfo.ac;
        if (!responseAC || responseAC === 'N/A' || responseAC.toLowerCase() !== ac.toLowerCase()) {
          return false;
        }
        return true;
      });
      if (originalCount !== catiResponses.length) {
        console.log(`🔍 getCatiStats - AC filter: ${originalCount} -> ${catiResponses.length} responses after AC extraction filtering`);
      }
    }

    // Get queue entries first to find all related call records
    const queueEntries = await CatiRespondentQueue.find({
      survey: surveyObjectId
    }).select('_id callRecord');

    console.log(`🔍 getCatiStats - Found ${queueEntries.length} queue entries for survey`);

    const queueEntryIds = queueEntries.map(q => q._id);
    const callRecordIdsFromQueue = queueEntries
      .filter(q => q.callRecord)
      .map(q => q.callRecord._id || q.callRecord)
      .filter(id => id);

    console.log(`🔍 getCatiStats - Queue entry IDs: ${queueEntryIds.length}, Call record IDs from queue: ${callRecordIdsFromQueue.length}`);

    // Get ALL call records linked to this survey (directly via survey field)
    // Try multiple query approaches to ensure we find all calls
    let callRecords = [];
    
    // Approach 1: Query by ObjectId (primary method - should find all calls)
    // Apply date filter to call records as well
    // For project managers, also filter by assigned interviewers
    const callRecordsQuery = {
      survey: surveyObjectId
    };
    if (startDate || endDate) {
      callRecordsQuery.createdAt = {};
      if (startDate) {
        callRecordsQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        callRecordsQuery.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      }
    }
    // Apply project manager interviewer filter to call records
    if (projectManagerInterviewerIds.length > 0) {
      callRecordsQuery.createdBy = { $in: projectManagerInterviewerIds };
    }
    
    // Note: AC filter for call records is applied later after linking to responses
    // because call records don't have AC information directly
    
    console.log(`🔍🔍🔍 getCatiStats - Querying CatiCall with survey: ${surveyObjectId}`);
    console.log(`🔍🔍🔍 getCatiStats - Call records query:`, JSON.stringify(callRecordsQuery, null, 2));
    
    const callsByObjectId = await CatiCall.find(callRecordsQuery)
      .populate('createdBy', 'firstName lastName phone memberId')
      .populate('queueEntry')
      .lean(); // Use lean() for better performance

    console.log(`🔍🔍🔍 getCatiStats - Calls found by ObjectId: ${callsByObjectId.length}`);
    if (callsByObjectId.length > 0) {
      console.log(`🔍🔍🔍 getCatiStats - Sample call:`, {
        _id: callsByObjectId[0]._id,
        callId: callsByObjectId[0].callId,
        survey: String(callsByObjectId[0].survey),
        callStatus: callsByObjectId[0].callStatus,
        originalStatusCode: callsByObjectId[0].originalStatusCode
      });
    }
    // Since we're using lean(), callsByObjectId is already plain objects
    callRecords = callsByObjectId;
    
    // Approach 2: Get calls linked via queueEntry (in case some don't have survey field set)
    if (queueEntryIds.length > 0) {
      const callsViaQueueQuery = {
        queueEntry: { $in: queueEntryIds },
        _id: { $nin: callRecords.map(c => c._id) }  // Exclude already found calls
      };
      // Apply project manager interviewer filter to calls via queue
      if (projectManagerInterviewerIds.length > 0) {
        callsViaQueueQuery.createdBy = { $in: projectManagerInterviewerIds };
      }
      if (startDate || endDate) {
        callsViaQueueQuery.createdAt = {};
        if (startDate) {
          callsViaQueueQuery.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          callsViaQueueQuery.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
        }
      }
      
      const callsViaQueue = await CatiCall.find(callsViaQueueQuery)
        .populate('createdBy', 'firstName lastName phone memberId')
        .populate('queueEntry');
      
      console.log(`🔍 getCatiStats - Calls found via queueEntry: ${callsViaQueue.length}`);
      
      // Add calls not already in the list
      const existingCallIds = new Set(callRecords.map(c => c._id.toString()));
      callsViaQueue.forEach(call => {
        // Already plain object from lean()
        if (!existingCallIds.has(call._id.toString())) {
          callRecords.push(call);
        }
      });
    }
    
    console.log(`🔍 getCatiStats - Total unique call records found: ${callRecords.length}`);
    
    // Log sample call records to understand the data structure
    if (callRecords.length > 0) {
      console.log(`🔍 getCatiStats - Sample call record structure:`, {
        _id: callRecords[0]._id,
        callId: callRecords[0].callId,
        survey: callRecords[0].survey,
        surveyType: typeof callRecords[0].survey,
        surveyString: String(callRecords[0].survey),
        queueEntry: callRecords[0].queueEntry,
        callStatus: callRecords[0].callStatus,
        originalStatusCode: callRecords[0].originalStatusCode,
        webhookReceived: callRecords[0].webhookReceived,
        hasWebhookData: !!callRecords[0].webhookData,
        webhookDataKeys: callRecords[0].webhookData ? Object.keys(callRecords[0].webhookData) : []
      });
    } else {
      // If no calls found, try a broader search to debug
      const allCallsCount = await CatiCall.countDocuments({});
      const callsWithSurveyCount = await CatiCall.countDocuments({ survey: { $exists: true, $ne: null } });
      console.log(`⚠️ getCatiStats - No calls found. Total calls in DB: ${allCallsCount}, Calls with survey field: ${callsWithSurveyCount}`);
      
      // Try to find any calls with similar survey IDs
      if (mongoose.Types.ObjectId.isValid(id)) {
        const sampleCalls = await CatiCall.find({ survey: { $exists: true } }).limit(5).select('survey callId').lean();
        console.log(`🔍 getCatiStats - Sample survey IDs from other calls:`, sampleCalls.map(c => ({ survey: String(c.survey), callId: c.callId })));
      }
    }
    
    // Count calls with webhook data for reference
    const callsWithWebhook = callRecords.filter(c => c.webhookReceived === true || (c.webhookData && Object.keys(c.webhookData).length > 0));
    console.log(`🔍 getCatiStats - Calls with webhook data: ${callsWithWebhook.length} out of ${callRecords.length} total`);
    
    // Use ALL call records for counting (not just those with webhook)
    // For status determination, prioritize webhook data but fall back to stored callStatus
    
    // Helper functions defined here (before use)
    // Helper function to get call status from status code
    // Priority: originalStatusCode field > webhookData.callStatus > webhookData.status > stored callStatus
    const getCallStatus = (call) => {
      const webhookData = call.webhookData || {};
      
      // Try to get status code from multiple sources
      let statusCode = call.originalStatusCode;
      if (!statusCode && webhookData) {
        statusCode = webhookData.callStatus || webhookData.status;
      }
      
      // Convert to number if it's a string
      const statusCodeNum = typeof statusCode === 'number' ? statusCode : parseInt(statusCode);
      
      if (!isNaN(statusCodeNum)) {
        // Map DeepCall status codes (CTC - Click to Call)
        // Status 3: Both Answered -> completed
        if (statusCodeNum === 3) return 'completed';
        // Status 4, 5, 10: Answered -> answered
        // 4: To Ans. - From Unans., 5: To Ans, 10: From Ans.
        if (statusCodeNum === 4 || statusCodeNum === 5 || statusCodeNum === 10) return 'answered';
        // Status 6, 7, 8, 9: Unanswered -> no-answer
        // 6: To Unans - From Ans., 7: From Unanswered, 8: To Unans., 9: Both Unanswered
        if (statusCodeNum === 6 || statusCodeNum === 7 || statusCodeNum === 8 || statusCodeNum === 9) return 'no-answer';
        // Status 11, 12, 20, 21: Rejected/Skipped/Hangup -> cancelled
        // 11: Rejected Call, 12: Skipped, 20: To Hangup in Queue, 21: To Hangup
        if (statusCodeNum === 11 || statusCodeNum === 12 || statusCodeNum === 20 || statusCodeNum === 21) return 'cancelled';
        // Status 13, 14, 15, 16: Failed -> failed
        // 13: From Failed, 14: To Failed - From Ans., 15: To Failed, 16: To Ans - From Failed
        if (statusCodeNum === 13 || statusCodeNum === 14 || statusCodeNum === 15 || statusCodeNum === 16) return 'failed';
        // Status 18: To Ans. - From Not Found -> failed (but mark as "does not exist" separately)
        if (statusCodeNum === 18) return 'failed';
        // Status 17, 19: Busy -> busy
        // 17: From Busy, 19: To Unans. - From Busy
        if (statusCodeNum === 17 || statusCodeNum === 19) return 'busy';
      }
      
      // Fallback to stored callStatus
      return call.callStatus || 'initiated';
    };
    
    // Helper function to check if "From" is answered (interviewer/agent answered)
    // Status codes where "From" is answered: 3, 6, 10, 14, 16
    const isFromAnswered = (call) => {
      const webhookData = call.webhookData || {};
      let statusCode = call.originalStatusCode;
      if (!statusCode && webhookData) {
        statusCode = webhookData.callStatus || webhookData.status;
      }
      const statusCodeNum = typeof statusCode === 'number' ? statusCode : parseInt(statusCode);
      
      if (!isNaN(statusCodeNum)) {
        // Status codes where "From" (interviewer/agent) is answered:
        // 3: Both Answered, 6: To Unans - From Ans., 10: From Ans., 14: To Failed - From Ans., 16: To Ans - From Failed
        return statusCodeNum === 3 || statusCodeNum === 6 || statusCodeNum === 10 || statusCodeNum === 14 || statusCodeNum === 16;
      }
      return false;
    };
    
    if (callRecords.length > 0) {
      console.log(`🔍 getCatiStats - Sample call record:`, {
        callId: callRecords[0].callId,
        callStatus: callRecords[0].callStatus,
        originalStatusCode: callRecords[0].originalStatusCode,
        talkDuration: callRecords[0].talkDuration,
        callDuration: callRecords[0].callDuration,
        hasWebhookData: !!callRecords[0].webhookData,
        webhookReceived: callRecords[0].webhookReceived,
        webhookDataStatus: callRecords[0].webhookData?.callStatus || callRecords[0].webhookData?.status
      });
      
      // Show breakdown using getCallStatus helper
      const statusBreakdown = {
        completed: callRecords.filter(c => getCallStatus(c) === 'completed').length,
        answered: callRecords.filter(c => getCallStatus(c) === 'answered').length,
        no_answer: callRecords.filter(c => getCallStatus(c) === 'no-answer').length,
        busy: callRecords.filter(c => getCallStatus(c) === 'busy').length,
        failed: callRecords.filter(c => getCallStatus(c) === 'failed').length,
        cancelled: callRecords.filter(c => getCallStatus(c) === 'cancelled').length,
        ringing: callRecords.filter(c => getCallStatus(c) === 'ringing').length,
        initiated: callRecords.filter(c => getCallStatus(c) === 'initiated').length
      };
      console.log(`🔍 getCatiStats - Call statuses breakdown (using status codes):`, statusBreakdown);
      console.log(`🔍 getCatiStats - Calls where From is answered: ${callRecords.filter(c => isFromAnswered(c)).length}`);
    } else {
      console.log(`⚠️ getCatiStats - No call records found for survey ${id}`);
      console.log(`⚠️ getCatiStats - Survey ObjectId used: ${surveyObjectId}`);
    }

    // Get queue entries for additional context (status breakdowns) - already fetched above
    const queueEntriesWithDetails = await CatiRespondentQueue.find({
      survey: surveyObjectId
    })
      .populate('assignedTo', 'firstName lastName email')
      .lean(); // Use lean() for better performance

    console.log(`🔍 getCatiStats - Found ${queueEntriesWithDetails.length} queue entries for survey ${id}`);

    // Calculate total calls made = total call records (each record = one call attempt)
    const totalCallsMade = callRecords.length;

    // Dials attempted = total calls made (same thing)
    const dialsAttempted = totalCallsMade;

    // Calls attended = calls where "From" is answered (interviewer/agent answered)
    // Status codes 3, 6, 10, 14, 16 indicate "From" is answered
    const callsAttended = callRecords.filter(c => {
      return isFromAnswered(c);
    }).length;

    // Calls connected = calls where status is 'answered' or 'completed' (successful connections)
    // Status codes 3, 4, 5, 10 indicate successful connection
    const callsConnected = callRecords.filter(c => {
      const status = getCallStatus(c);
      return status === 'answered' || status === 'completed';
    }).length;

    console.log(`🔍 getCatiStats - Calls attended: ${callsAttended}, Calls connected: ${callsConnected}`);
    
    // Calculate total talk duration from call records (in seconds)
    // Use talkDuration field which is extracted from webhookData
    const totalTalkDuration = callRecords.reduce((sum, c) => {
      // talkDuration is already in seconds from webhook processing
      return sum + (c.talkDuration || 0);
    }, 0);
    
    console.log(`🔍 getCatiStats - Total talk duration: ${totalTalkDuration} seconds`);
    const formatDuration = (seconds) => {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Get queue status breakdown for additional context
    const queueStats = await CatiRespondentQueue.aggregate([
      { $match: { survey: surveyObjectId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log(`🔍 getCatiStats - Queue stats:`, queueStats);
    console.log(`🔍 getCatiStats - Total call records found: ${callRecords.length}`);

    // Status breakdowns from queue entries (for reference, but primary source is call records)
    const statusCounts = {
      interview_success: 0,
      call_failed: 0,
      busy: 0,
      not_interested: 0,
      no_answer: 0,
      switched_off: 0,
      not_reachable: 0,
      does_not_exist: 0,
      rejected: 0,
      call_later: 0
    };

    queueStats.forEach(stat => {
      if (statusCounts.hasOwnProperty(stat._id)) {
        statusCounts[stat._id] = stat.count;
      }
    });

    // Call status breakdown from call records (webhook data) - PRIMARY SOURCE
    // Use getCallStatus helper function to map DeepCall status codes correctly
    // Note: callRecords are already filtered by project manager assigned interviewers in the query
    const callStatusBreakdown = {
      answered: callRecords.filter(c => getCallStatus(c) === 'answered').length,
      completed: callRecords.filter(c => getCallStatus(c) === 'completed').length,
      no_answer: callRecords.filter(c => getCallStatus(c) === 'no-answer').length,
      busy: callRecords.filter(c => getCallStatus(c) === 'busy').length,
      failed: callRecords.filter(c => getCallStatus(c) === 'failed').length,
      cancelled: callRecords.filter(c => getCallStatus(c) === 'cancelled').length,
      ringing: callRecords.filter(c => getCallStatus(c) === 'ringing' || c.callStatus === 'ringing').length,
      initiated: callRecords.filter(c => getCallStatus(c) === 'initiated' || c.callStatus === 'initiated').length
    };
    
    console.log(`🔍 getCatiStats - Call records count: ${callRecords.length}`);
    console.log(`🔍 getCatiStats - CATI responses count: ${catiResponses.length}`);
    if (projectManagerInterviewerIds.length > 0) {
      console.log(`🔍 getCatiStats - Project manager filtering: ${projectManagerInterviewerIds.length} assigned interviewers`);
      console.log(`🔍 getCatiStats - Assigned interviewer IDs:`, projectManagerInterviewerIds.map(id => id.toString()));
    }
    
    console.log(`🔍 getCatiStats - Call status breakdown:`, callStatusBreakdown);

    // Extract additional details from webhookData and originalStatusCode for number status
    // Use DeepCall status codes to correctly categorize calls
    let switchOffCount = 0;
    let numberNotReachableCount = 0;
    let numberDoesNotExistCount = 0;
    
    // DeepCall Status Code Mapping (CTC - Click to Call)
    // Status codes: 3=Both Answered, 4=To Ans-From Unans, 5=To Ans, 6=To Unans-From Ans,
    // 7=From Unanswered, 8=To Unans, 9=Both Unanswered, 10=From Ans,
    // 11=Rejected, 12=Skipped, 13=From Failed, 14=To Failed-From Ans, 15=To Failed,
    // 16=To Ans-From Failed, 17=From Busy, 18=To Ans-From Not Found, 19=To Unans-From Busy,
    // 20=To Hangup in Queue, 21=To Hangup
    
    callRecords.forEach(call => {
      // For project managers, only count calls from assigned interviewers
      if (projectManagerInterviewerIds.length > 0) {
        if (!call.createdBy || !call.createdBy._id) return;
        const interviewerId = call.createdBy._id.toString();
        const interviewerIdObj = mongoose.Types.ObjectId.isValid(interviewerId) 
          ? new mongoose.Types.ObjectId(interviewerId) 
          : null;
        if (!interviewerIdObj || !projectManagerInterviewerIds.some(id => id.toString() === interviewerIdObj.toString())) {
          return; // Skip this call
        }
      }
      
      const webhookData = call.webhookData || {};
      const originalStatusCode = call.originalStatusCode || webhookData.callStatus || webhookData.status;
      const statusCode = typeof originalStatusCode === 'number' ? originalStatusCode : parseInt(originalStatusCode);
      
      // Map status codes to number status categories
      if (statusCode === 13 || statusCode === 15 || statusCode === 16) {
        // Status 13: From Failed, 15: To Failed, 16: To Ans - From Failed
        // These indicate the number failed - could be switch off or not reachable
        // Check webhookData for more details
        const exitCode = webhookData.exitCode || call.hangupCause || '';
        const hangupReason = webhookData.hangupReason || call.hangupReason || '';
        const statusDesc = call.statusDescription || '';
        
        const exitCodeStr = String(exitCode).toLowerCase();
        const reasonStr = String(hangupReason).toLowerCase();
        const descStr = String(statusDesc).toLowerCase();
        
        if (exitCodeStr.includes('switch') || reasonStr.includes('switch') || descStr.includes('switch')) {
          switchOffCount++;
        } else if (exitCodeStr.includes('not reachable') || reasonStr.includes('not reachable') || descStr.includes('not reachable')) {
          numberNotReachableCount++;
        } else {
          // Default to not reachable for failed calls
          numberNotReachableCount++;
        }
      } else if (statusCode === 18) {
        // Status 18: To Ans. - From Not Found (Number does not exist)
        numberDoesNotExistCount++;
      } else if (statusCode === 7 || statusCode === 8 || statusCode === 9) {
        // Status 7: From Unanswered, 8: To Unans., 9: Both Unanswered
        // These could be switch off - check webhookData
        const exitCode = webhookData.exitCode || call.hangupCause || '';
        const hangupReason = webhookData.hangupReason || call.hangupReason || '';
        const statusDesc = call.statusDescription || '';
        
        const exitCodeStr = String(exitCode).toLowerCase();
        const reasonStr = String(hangupReason).toLowerCase();
        const descStr = String(statusDesc).toLowerCase();
        
        if (exitCodeStr.includes('switch') || reasonStr.includes('switch') || descStr.includes('switch')) {
          switchOffCount++;
        } else {
          // Default: no answer (not switch off)
          // This will be counted in "Call Not Received" but not in "Switch Off"
        }
      }
    });

    // Calculate stats based on call status from responses (primary source)
    // Extract call status from responses metadata
    let ringingFromResponses = 0;
    let notRingingFromResponses = 0;
    let switchOffFromResponses = 0;
    let numberNotReachableFromResponses = 0;
    let numberDoesNotExistFromResponses = 0;
    let callNotReceivedFromResponses = 0;
    let callsConnectedFromResponses = 0;
    let callsNotConnectedFromResponses = 0;
    let didntGetCallFromResponses = 0;
    
    catiResponses.forEach(response => {
      // For project managers, only count responses from assigned interviewers
      if (projectManagerInterviewerIds.length > 0) {
        if (!response.interviewer || !response.interviewer._id) return;
        const interviewerId = response.interviewer._id.toString();
        const interviewerIdObj = mongoose.Types.ObjectId.isValid(interviewerId) 
          ? new mongoose.Types.ObjectId(interviewerId) 
          : null;
        if (!interviewerIdObj || !projectManagerInterviewerIds.some(id => id.toString() === interviewerIdObj.toString())) {
          return; // Skip this response
        }
      }
      
      // Get call status from metadata.callStatus (stored when response was submitted)
      const callStatus = response.metadata?.callStatus || 
                        (response.responses?.find(r => r.questionId === 'call-status')?.response);
      
      if (!callStatus) return; // Skip if no call status
      
      // Count based on call status from responses
      if (callStatus === 'success' || callStatus === 'call_connected') {
        callsConnectedFromResponses++;
        ringingFromResponses++; // Success counts as ringing
      } else if (callStatus === 'busy' || callStatus === 'did_not_pick_up') {
        ringingFromResponses++; // Busy and didn't pick up count as ringing
        callsNotConnectedFromResponses++;
      } else if (callStatus === 'switched_off') {
        notRingingFromResponses++;
        switchOffFromResponses++;
        callNotReceivedFromResponses++;
      } else if (callStatus === 'not_reachable') {
        notRingingFromResponses++;
        numberNotReachableFromResponses++;
        callNotReceivedFromResponses++;
      } else if (callStatus === 'number_does_not_exist') {
        notRingingFromResponses++;
        numberDoesNotExistFromResponses++;
        callNotReceivedFromResponses++;
      } else if (callStatus === 'didnt_get_call') {
        didntGetCallFromResponses++;
        // This doesn't count as a dial attempt (API failure)
      }
    });
    
    // Calculate "No Response by Telecaller" from CatiCall objects
    // Check for calls where hangupBySource === 1 or status code === 7 (agent didn't pick up)
    let noResponseByTelecallerCount = 0;
    const interviewerPhoneMap = new Map(); // Map phone numbers to interviewer IDs
    
    // Build map of interviewer phone numbers (only from assigned interviewers for project managers)
    catiResponses.forEach(response => {
      if (response.interviewer && response.interviewer.phone) {
        // For project managers, only include assigned interviewers
        if (projectManagerInterviewerIds.length > 0) {
          const interviewerId = response.interviewer._id.toString();
          const interviewerIdObj = mongoose.Types.ObjectId.isValid(interviewerId) 
            ? new mongoose.Types.ObjectId(interviewerId) 
            : null;
          if (!interviewerIdObj || !projectManagerInterviewerIds.some(id => id.toString() === interviewerIdObj.toString())) {
            return; // Skip this interviewer
          }
        }
        
        const phone = response.interviewer.phone.replace(/[^0-9]/g, '');
        const interviewerId = response.interviewer._id.toString();
        if (!interviewerPhoneMap.has(phone)) {
          interviewerPhoneMap.set(phone, interviewerId);
        }
      }
    });
    
    // Check CatiCall objects for "No Response by Telecaller"
    // Only check calls from assigned interviewers for project managers
    callRecords.forEach(call => {
      // For project managers, only check calls from assigned interviewers
      if (projectManagerInterviewerIds.length > 0) {
        if (!call.createdBy || !call.createdBy._id) return;
        const interviewerId = call.createdBy._id.toString();
        const interviewerIdObj = mongoose.Types.ObjectId.isValid(interviewerId) 
          ? new mongoose.Types.ObjectId(interviewerId) 
          : null;
        if (!interviewerIdObj || !projectManagerInterviewerIds.some(id => id.toString() === interviewerIdObj.toString())) {
          return; // Skip this call
        }
      }
      
      const fromNumber = call.fromNumber?.replace(/[^0-9]/g, '');
      if (fromNumber && interviewerPhoneMap.has(fromNumber)) {
        // Check if hangupBySource === 1 or status code === 7
        const hangupBySource = call.hangupBySource;
        const statusCode = call.originalStatusCode || call.webhookData?.callStatus || call.webhookData?.status;
        const statusCodeNum = typeof statusCode === 'number' ? statusCode : parseInt(statusCode);
        
        if (hangupBySource === 1 || hangupBySource === '1' || statusCodeNum === 7) {
          noResponseByTelecallerCount++;
        }
      }
    });
    
    // Use response-based stats (primary) with fallback to call record stats
    const ringing = ringingFromResponses || callStatusBreakdown.ringing;
    const notRinging = notRingingFromResponses || (switchOffCount + numberNotReachableCount + numberDoesNotExistCount);
    const callNotReceived = callNotReceivedFromResponses || callStatusBreakdown.no_answer;

    // Call Not Ring Status breakdown (from responses)
    const callNotRingStatus = {
      switchOff: switchOffFromResponses || switchOffCount,
      numberNotReachable: numberNotReachableFromResponses || numberNotReachableCount,
      numberDoesNotExist: numberDoesNotExistFromResponses || numberDoesNotExistCount
      // Removed noResponseByTelecaller from here
    };

    // Call Ring Status breakdown (from responses)
    const callRingStatus = {
      callsConnected: callsConnectedFromResponses || callsConnected,
      callsNotConnected: callsNotConnectedFromResponses || callRecords.filter(c => {
      const status = getCallStatus(c);
      return status === 'no-answer';
      }).length
      // Removed noResponseByTelecaller from here
    };

    // ============================================
    // INTERVIEWER PERFORMANCE STATS - REBUILT LOGIC
    // ============================================
    // Source of Truth: CatiCall objects for call attempts
    // Link: SurveyResponse objects for interview outcomes
    // ============================================
    
    const interviewerStatsMap = new Map();
    
    // Step 1: Get all interviewers who made calls (from CatiCall objects)
    // Build map of interviewer phone -> interviewer ID
    // For project managers, only include assigned interviewers
    const interviewerPhoneToIdMap = new Map();
    const interviewerIdToInfoMap = new Map();
    
    // Helper function to check if interviewer should be included
    const shouldIncludeInterviewer = (interviewerId) => {
      if (projectManagerInterviewerIds.length === 0) {
        // Not a project manager or no assigned interviewers - include all
        return true;
      }
      // For project managers, only include assigned interviewers
      const interviewerIdObj = typeof interviewerId === 'string' 
        ? (mongoose.Types.ObjectId.isValid(interviewerId) ? new mongoose.Types.ObjectId(interviewerId) : null)
        : interviewerId;
      if (!interviewerIdObj) return false;
      
      return projectManagerInterviewerIds.some(id => 
        id.toString() === interviewerIdObj.toString()
      );
    };
    
    // Get unique interviewers from call records
    callRecords.forEach(call => {
      if (call.createdBy && call.createdBy._id) {
        const interviewerId = call.createdBy._id.toString();
        
        // Filter by project manager assigned interviewers
        if (!shouldIncludeInterviewer(interviewerId)) {
          return; // Skip this interviewer
        }
        
        const phone = call.fromNumber?.replace(/[^0-9]/g, '');
        
        if (!interviewerIdToInfoMap.has(interviewerId)) {
          interviewerIdToInfoMap.set(interviewerId, {
            interviewerId: call.createdBy._id,
            interviewerName: `${call.createdBy.firstName || ''} ${call.createdBy.lastName || ''}`.trim(),
            interviewerPhone: call.createdBy.phone || phone || '',
            memberID: call.createdBy.memberId || call.createdBy.memberID || ''
          });
        }
        
        if (phone) {
          interviewerPhoneToIdMap.set(phone, interviewerId);
        }
      }
    });
    
    // Also get interviewers from responses (in case some calls don't have createdBy populated)
    catiResponses.forEach(response => {
      if (response.interviewer && response.interviewer._id) {
        const interviewerId = response.interviewer._id.toString();
        
        // Filter by project manager assigned interviewers
        if (!shouldIncludeInterviewer(interviewerId)) {
          return; // Skip this interviewer
        }
        
        if (!interviewerIdToInfoMap.has(interviewerId)) {
          interviewerIdToInfoMap.set(interviewerId, {
            interviewerId: response.interviewer._id,
            interviewerName: `${response.interviewer.firstName || ''} ${response.interviewer.lastName || ''}`.trim(),
            interviewerPhone: response.interviewer.phone || '',
            memberID: response.interviewer.memberId || response.interviewer.memberID || ''
          });
        }
      }
    });
    
    console.log(`🔍 getCatiStats - Interviewer stats map size: ${interviewerIdToInfoMap.size}`);
    if (projectManagerInterviewerIds.length > 0) {
      console.log(`🔍 getCatiStats - Project manager filtering: ${projectManagerInterviewerIds.length} assigned interviewers`);
    }
    
    // Initialize stats for all interviewers (already filtered above)
    interviewerIdToInfoMap.forEach((info, interviewerId) => {
      interviewerStatsMap.set(interviewerId, {
        interviewerId: info.interviewerId,
        interviewerName: info.interviewerName,
        interviewerPhone: info.interviewerPhone,
        memberID: info.memberID || '',
        numberOfDials: 0, // Total calls attempted (from CatiCall)
        callsConnected: 0, // Responses with knownCallStatus = 'call_connected' or 'success'
        completed: 0, // Interviews completed (call_connected status only)
        approved: 0, // SurveyResponse with Approved status (from completed interviews, regardless of batch status)
        underQCQueue: 0, // Responses in batches completed and sent to review (from completed interviews with Pending_Approval status)
        processingInBatch: 0, // Responses still in collecting phase in batches (from completed interviews with Pending_Approval status)
        rejected: 0, // SurveyResponse with Rejected status (from completed interviews only)
        incomplete: 0, // All other responses (abandoned, not connected, etc.)
        formDuration: 0, // Total duration from SurveyResponse + CatiCall talkDuration
        callNotReceivedToTelecaller: 0, // Call status: didnt_get_call
        ringing: 0, // Call status: success, busy, did_not_pick_up
        notRinging: 0, // Call status: switched_off, not_reachable, number_does_not_exist
        switchOff: 0,
        numberNotReachable: 0,
        numberDoesNotExist: 0,
        noResponseByTelecaller: 0 // From CatiCall: hangupBySource=1 or statusCode=7
          });
    });
    
    // Step 2: Count Total Dials from SurveyResponse objects (BETTER APPROACH)

    // This ensures we count ALL call attempts including abandoned interviews
    // SurveyResponse objects are created for every call attempt (completed or abandoned)
    // This is more accurate than counting CatiCall objects because:
    // 1. SurveyResponse captures ALL attempts (even if CatiCall wasn't created)
    // 2. SurveyResponse has call status from interviewer's selection
    // 3. Includes abandoned interviews mid-way
    catiResponses.forEach(response => {
      if (!response.interviewer || !response.interviewer._id) return;
      
      const interviewerId = response.interviewer._id.toString();
      
      // Ensure interviewer is in the map (add if missing, but check project manager filter)
      if (!interviewerStatsMap.has(interviewerId)) {
        // Check if should include (for project managers)
        if (!shouldIncludeInterviewer(interviewerId)) return;
        
        // Add interviewer to map from response data
        const interviewer = response.interviewer;
        if (!interviewer) return; // Safety check - should not happen due to earlier check
        
        const interviewerName = (interviewer.firstName && interviewer.lastName)
          ? `${interviewer.firstName} ${interviewer.lastName}`.trim()
          : (interviewer.name || 'Unknown');
        const interviewerPhone = interviewer.phone || '';
        const memberID = interviewer.memberId || interviewer.memberID || '';
        
        interviewerStatsMap.set(interviewerId, {
          interviewerId: interviewerId,
          interviewerName: interviewerName,
          interviewerPhone: interviewerPhone,
          memberID: memberID,
          numberOfDials: 0,
          callsConnected: 0,
          completed: 0,
          approved: 0,
          underQCQueue: 0,
          processingInBatch: 0,
          rejected: 0,
          incomplete: 0,
          formDuration: 0,
          callNotReceivedToTelecaller: 0,
          ringing: 0,
          notRinging: 0,
          switchOff: 0,
          numberNotReachable: 0,
          numberDoesNotExist: 0,
          noResponseByTelecaller: 0
        });
      }
      
      const stat = interviewerStatsMap.get(interviewerId);
        
      // Get call status from response - PRIORITY ORDER:
      // 1. knownCallStatus field (dedicated field for call status)
      // 2. metadata.callStatus (legacy)
      // 3. responses array (from call-status question)
      let callStatus = null;
      
      // Priority 1: knownCallStatus field (most reliable)
      if (response.knownCallStatus) {
        callStatus = response.knownCallStatus;
      }
      // Priority 2: metadata.callStatus (legacy)
      else if (response.metadata && response.metadata.callStatus) {
        callStatus = response.metadata.callStatus;
      } 
      // Priority 3: Check responses array (from call-status question)
      else if (response.responses && Array.isArray(response.responses)) {
        const callStatusResponse = response.responses.find(r => 
          r.questionId === 'call-status' || r.questionId === 'call_status'
        );
        if (callStatusResponse && callStatusResponse.response) {
          callStatus = callStatusResponse.response;
        }
      }
      
      // Normalize call status
      const normalizedCallStatus = callStatus ? callStatus.toLowerCase().trim() : 'unknown';
      
      // Count ALL dials INCLUDING "didnt_get_call" 
      // This includes ALL statuses: call_connected, busy, switched_off, not_reachable, 
      // number_does_not_exist, did_not_pick_up, didnt_get_call, abandoned mid-way, etc.
      // Even if call status is 'unknown', count it as a dial attempt
      // IMPORTANT: Number of Dials = Ringing + Not Ringing + Call Not Received to Telecaller
      stat.numberOfDials += 1;
      
      // Count Calls Connected: From ALL dials, count those with knownCallStatus = 'call_connected' or 'success'
      // This must be counted from the same set of responses as Number of Dials
      const isCallConnected = normalizedCallStatus === 'call_connected' || normalizedCallStatus === 'success';
      if (isCallConnected) {
        stat.callsConnected += 1;
      }
    });
    
    // Step 3: Fetch batch information for all responses to determine QC status
    const QCBatch = require('../models/QCBatch');
    const batchIds = [...new Set(catiResponses
      .filter(r => r.qcBatch)
      .map(r => {
        if (typeof r.qcBatch === 'string') {
          return mongoose.Types.ObjectId.isValid(r.qcBatch) ? new mongoose.Types.ObjectId(r.qcBatch) : null;
        }
        return r.qcBatch;
      })
      .filter(id => id !== null)
    )];
    
    const batchesMap = new Map();
    if (batchIds.length > 0) {
      const batches = await QCBatch.find({ _id: { $in: batchIds } })
        .select('_id status remainingDecision')
        .lean();
      batches.forEach(batch => {
        batchesMap.set(batch._id.toString(), batch);
      });
    }
    
    // Step 4: Process SurveyResponse objects to get interview outcomes
    // Include BOTH completed interviews AND abandoned interviews (with call status)
    // Create a map of callId/callRecordId -> SurveyResponse for linking
    const callIdToResponseMap = new Map();
    const responseToCallIdMap = new Map();
    
    // CRITICAL FIX: Ensure ALL interviewers from responses are in the map BEFORE processing
    // This ensures we count ALL responses with Approved/Rejected/Pending_Approval status
    // regardless of whether they have CatiCall records
    catiResponses.forEach(response => {
      if (!response.interviewer || !response.interviewer._id) return;
      
      const interviewerId = response.interviewer._id.toString();
      
      // If interviewer is not in map, add them now
      if (!interviewerStatsMap.has(interviewerId)) {
        // Check if should include (for project managers)
        if (!shouldIncludeInterviewer(interviewerId)) return;
        
        const interviewer = response.interviewer;
        const interviewerName = interviewer.firstName && interviewer.lastName
          ? `${interviewer.firstName} ${interviewer.lastName}`.trim()
          : interviewer.name || 'Unknown';
        const interviewerPhone = interviewer.phone || '';
        const memberID = interviewer.memberId || interviewer.memberID || '';
        
        interviewerStatsMap.set(interviewerId, {
          interviewerId: interviewerId,
          interviewerName: interviewerName,
          interviewerPhone: interviewerPhone,
          memberID: memberID,
          numberOfDials: 0,
          callsConnected: 0,
          completed: 0,
          approved: 0,
          underQCQueue: 0,
          processingInBatch: 0,
          rejected: 0,
          incomplete: 0,
          formDuration: 0,
          callNotReceivedToTelecaller: 0,
          ringing: 0,
          notRinging: 0,
          switchOff: 0,
          numberNotReachable: 0,
          numberDoesNotExist: 0,
          noResponseByTelecaller: 0
        });
      }
    });
    
    // Now process all responses - ALL interviewers should be in the map now
    catiResponses.forEach(response => {
      if (!response.interviewer || !response.interviewer._id) return;
      
      const interviewerId = response.interviewer._id.toString();
      
      // Ensure interviewer is in the map (add if missing, but check project manager filter)
      if (!interviewerStatsMap.has(interviewerId)) {
        // Check if should include (for project managers)
        if (!shouldIncludeInterviewer(interviewerId)) return;
        
        // Add interviewer to map from response data
        const interviewer = response.interviewer;
        const interviewerName = interviewer.firstName && interviewer.lastName
          ? `${interviewer.firstName} ${interviewer.lastName}`.trim()
          : interviewer.name || 'Unknown';
        const interviewerPhone = interviewer.phone || '';
        const memberID = interviewer.memberId || interviewer.memberID || '';
        
        interviewerStatsMap.set(interviewerId, {
          interviewerId: interviewerId,
          interviewerName: interviewerName,
          interviewerPhone: interviewerPhone,
          memberID: memberID,
          numberOfDials: 0,
          callsConnected: 0,
          completed: 0,
          approved: 0,
          underQCQueue: 0,
          processingInBatch: 0,
          rejected: 0,
          incomplete: 0,
          formDuration: 0,
          callNotReceivedToTelecaller: 0,
          ringing: 0,
          notRinging: 0,
          switchOff: 0,
          numberNotReachable: 0,
          numberDoesNotExist: 0,
          noResponseByTelecaller: 0
        });
      }
      
      const stat = interviewerStatsMap.get(interviewerId);
      
      // Get call status from response - PRIORITY ORDER:
      // 1. knownCallStatus field (dedicated field for call status)
      // 2. metadata.callStatus (legacy)
      // 3. responses array (from call-status question)
      let callStatus = null;
      
      // Priority 1: knownCallStatus field (most reliable)
      if (response.knownCallStatus) {
        callStatus = response.knownCallStatus;
      }
      // Priority 2: metadata.callStatus (legacy)
      else if (response.metadata && response.metadata.callStatus) {
        callStatus = response.metadata.callStatus;
      } 
      // Priority 3: Check responses array (from call-status question)
      else if (response.responses && Array.isArray(response.responses)) {
        const callStatusResponse = response.responses.find(r => 
          r.questionId === 'call-status' || r.questionId === 'call_status'
        );
        if (callStatusResponse && callStatusResponse.response) {
          callStatus = callStatusResponse.response;
        }
      }
      
      // IMPORTANT: Include ALL responses, even if no call status (for abandoned without status)
      // But prioritize responses WITH call status for accurate stats
      if (!callStatus) {
        // If no call status but response exists, it might be an old abandoned response
        // Still count it but mark as 'unknown'
        callStatus = 'unknown';
      }
      
      const normalizedCallStatus = callStatus.toLowerCase().trim();
      
      // NOTE: Calls Connected is now counted in Step 2 (where Number of Dials is counted)
      // This ensures it counts from the exact same set of responses as Number of Dials
      // No need to count it again here
      
      // Link response to call record (for duration calculation)
      const callRecordId = response.metadata?.callRecordId;
      const callId = response.metadata?.callId;
      if (callRecordId || callId) {
        responseToCallIdMap.set(response._id.toString(), { callRecordId, callId });
      }
      
      // Get response status (normalized) - check early for rejected responses
      const responseStatus = response.status ? response.status.trim() : '';
      const normalizedResponseStatus = responseStatus.toLowerCase();
      
      // SIMPLIFIED "Completed" CALCULATION: Match Top CATI Responses logic
      // Count ONLY based on status: Approved, Rejected, or Pending_Approval
      // This matches the frontend calculation: filteredResponses with status filter 'approved_rejected_pending'
      if (normalizedResponseStatus === 'rejected') {
        stat.rejected += 1;
        stat.completed += 1; // Rejected responses are completed interviews
        
        // Form Duration - Sum of all CATI interview durations (totalTimeSpent from timer)
        if (response.totalTimeSpent) {
          stat.formDuration += (response.totalTimeSpent || 0);
          console.log(`⏱️  Adding form duration: ${response.totalTimeSpent || 0}s for interviewer ${interviewerId}, total now: ${stat.formDuration}s`);
        }
        // Skip to call status breakdown - don't process as completed/incomplete again
        // Rejected responses are already counted in "Completed", so skip the isCompleted block
        // Continue to call status breakdown for stats
        // DO NOT count in incomplete - they are already in completed
      } else if (normalizedResponseStatus === 'approved') {
        // Approved: SurveyResponse with Approved status (from completed interviews)
        // Count in "Approved" and "Completed" regardless of call status
        // Approved responses are completed interviews, even if call status is missing
        stat.approved += 1;
        stat.completed += 1; // Approved responses are also completed interviews
        
        // Form Duration - Sum of all CATI interview durations (totalTimeSpent from timer)
        if (response.totalTimeSpent) {
          stat.formDuration += (response.totalTimeSpent || 0);
          console.log(`⏱️  Adding form duration: ${response.totalTimeSpent || 0}s for interviewer ${interviewerId}, total now: ${stat.formDuration}s`);
        }
        // Skip to call status breakdown - don't process as completed/incomplete again
        // Approved responses are already counted in "Completed", so skip the isCompleted block
        // Continue to call status breakdown for stats
        // DO NOT count in incomplete - they are already in completed
      } else if (normalizedResponseStatus === 'pending_approval') {
        // Pending_Approval: Count in "Completed" and categorize by batch status
        // IMPORTANT: Count ALL Pending_Approval responses as completed, regardless of call status
        stat.completed += 1;
        
        // Form Duration - Sum of all CATI interview durations (totalTimeSpent from timer)
        if (response.totalTimeSpent) {
          stat.formDuration += (response.totalTimeSpent || 0);
          console.log(`⏱️  Adding form duration: ${response.totalTimeSpent || 0}s for interviewer ${interviewerId}, total now: ${stat.formDuration}s`);
        }
        
        // Categorize Pending_Approval responses into: Under QC Queue, or Processing in Batch
        {
          // Split Under QC into two categories based on batch status (only for Pending_Approval responses)
          let batchId = null;
          if (response.qcBatch) {
            if (typeof response.qcBatch === 'object' && response.qcBatch._id) {
              batchId = response.qcBatch._id.toString();
            } else if (typeof response.qcBatch === 'object') {
              batchId = response.qcBatch.toString();
            } else {
              batchId = response.qcBatch.toString();
            }
          }
          const batch = batchId ? batchesMap.get(batchId) : null;
          const isSampleResponse = response.isSampleResponse || false;
          
          if (batch) {
            const batchStatus = batch.status;
            const remainingDecision = batch.remainingDecision?.decision;
            
            // "Under QC Queue": Batches completed and sent to review
            // - Responses in batches with status 'queued_for_qc'
            // - Sample responses (40%) in batches with status 'qc_in_progress' or 'completed'
            // - Remaining responses (60%) in batches where remainingDecision is 'queued_for_qc'
            if (batchStatus === 'queued_for_qc' ||
                (isSampleResponse && (batchStatus === 'qc_in_progress' || batchStatus === 'completed')) ||
                (!isSampleResponse && remainingDecision === 'queued_for_qc')) {
              stat.underQCQueue += 1;
            }
            // "Processing in Batch": Responses still in collecting phase
            // - Responses in batches with status 'collecting'
            // - Responses in batches with status 'processing' that are not sample responses
            else if (batchStatus === 'collecting' ||
                     (batchStatus === 'processing' && !isSampleResponse)) {
              stat.processingInBatch += 1;
            }
            // For other statuses, default to processingInBatch (safer fallback)
            else {
              stat.processingInBatch += 1;
            }
          } else {
            // Response not in any batch (legacy) - count as processingInBatch
            stat.processingInBatch += 1;
          }
        }
      } else {
        // Incomplete: Only count responses that are NOT Approved, Rejected, or Pending_Approval
        // AND have knownCallStatus = 'call_connected' or 'success'
        // This means: Among connected calls only, count those that were not completed
        // 
        // Check if call was connected
        const isCallConnected = normalizedCallStatus === 'call_connected' || normalizedCallStatus === 'success';
        
        // Only count as incomplete if:
        // 1. Call was connected (knownCallStatus = 'call_connected' or 'success')
        // 2. Response status is NOT Approved, Rejected, or Pending_Approval
        if (isCallConnected) {
          // This response had a connected call but was not completed (abandoned, terminated, etc.)
          stat.incomplete += 1;
        }
        // If call was not connected, don't count in incomplete (it's already counted in other statuses)
      }
        
      // Call Status Breakdown
      // IMPORTANT: These stats should cover ALL responses
      // Number of Dials = Ringing + Not Ringing + Call Not Received to Telecaller
      // Every response must be categorized into exactly one of these three categories
      
      // CRITICAL LOGIC:
      // - "Interviewer Picked up" (ringing) = All calls where interviewer picked up the call
      //   This includes: call_connected, success, busy, did_not_pick_up, switched_off
      //   (switched_off means interviewer picked up and determined phone was off - they heard something)
      // - "Respondent Ph. Not Ringing" (notRinging) = Calls where respondent's phone didn't ring
      //   This includes: switched_off, not_reachable, number_does_not_exist
      //   (switched_off = phone was off/didn't ring, not_reachable/number_does_not_exist = invalid number)
      // - "Call Not Received to Telecaller" = API failures
      // NOTE: switched_off appears in BOTH "Interviewer Picked up" AND "Respondent Ph. Not Ringing"
      // because interviewer picked up (heard it was off) but respondent's phone didn't ring
      
      if (normalizedCallStatus === 'didnt_get_call' || normalizedCallStatus === 'didn\'t_get_call') {
        // Call Not Received: API failure, not interviewer's fault
        // This IS counted in "Number of Dials"
        stat.callNotReceivedToTelecaller += 1;
      } else if (normalizedCallStatus === 'not_reachable' || 
                 normalizedCallStatus === 'number_does_not_exist') {
        // Not Ringing: ONLY these two statuses (phone didn't ring at all, interviewer may not have picked up)
        // - not_reachable (Number Not Reachable) - phone doesn't ring
        // - number_does_not_exist (Number Does Not Exist) - phone doesn't ring
        // These are counted in "Number of Dials"
        stat.notRinging += 1;
      } else {
        // All other statuses go to "Ringing" (interviewer picked up)
        // This includes:
        // - success, call_connected (respondent answered - phone rang)
        // - busy, did_not_pick_up (respondent's phone rang but didn't answer)
        // - switched_off (interviewer picked up and determined phone was off - they heard something)
        // - unknown, abandoned, terminated, or any other status (default to Ringing)
        // This ensures: Number of Dials = Ringing + Not Ringing + Call Not Received
        stat.ringing += 1;
      }
      
      // ALSO count switched_off in "Respondent Ph. Not Ringing" (notRinging)
      // because the respondent's phone didn't ring (it was off)
      if (normalizedCallStatus === 'switched_off') {
        stat.notRinging += 1;
      }
      
      // Count individual statuses for breakdown (regardless of ringing/notRinging category)
      if (normalizedCallStatus === 'switched_off') {
        stat.switchOff += 1;
      }
      
      if (normalizedCallStatus === 'not_reachable') {
        stat.numberNotReachable += 1;
      }
      
      if (normalizedCallStatus === 'number_does_not_exist') {
        stat.numberDoesNotExist += 1;
      }
    });
    
    // Step 5: Calculate "No Response by Telecaller" from CatiCall objects
    callRecords.forEach(call => {
      let interviewerId = null;
      
      if (call.createdBy && call.createdBy._id) {
        interviewerId = call.createdBy._id.toString();
      } else if (call.fromNumber) {
        const phone = call.fromNumber.replace(/[^0-9]/g, '');
        interviewerId = interviewerPhoneToIdMap.get(phone);
      }
      
      if (interviewerId && interviewerStatsMap.has(interviewerId)) {
        const stat = interviewerStatsMap.get(interviewerId);
        const hangupBySource = call.hangupBySource;
        const statusCode = call.originalStatusCode || call.webhookData?.callStatus || call.webhookData?.status;
        const statusCodeNum = typeof statusCode === 'number' ? statusCode : parseInt(statusCode);
        
        if (hangupBySource === 1 || hangupBySource === '1' || statusCodeNum === 7) {
          stat.noResponseByTelecaller += 1;
        }
      }
    });
    
    const interviewerStats = Array.from(interviewerStatsMap.values());
    
    console.log(`🔍 getCatiStats - Interviewer stats:`, interviewerStats.length, 'interviewers');

    // Calculate overall stats from filtered interviewer stats
    // 1. Calls Made = Total of all "Number of Dials" from all filtered interviewers
    const totalCallsMadeFromStats = interviewerStats.reduce((sum, stat) => sum + (stat.numberOfDials || 0), 0);
    
    // 2. Calls Attended = Total count of "Ringing" from all filtered interviewers
    const totalCallsAttendedFromStats = interviewerStats.reduce((sum, stat) => sum + (stat.ringing || 0), 0);
    
    // 3. Call Not Received to Telecaller = Total count of "Call Not Received to Telecaller" from all filtered interviewers
    const totalCallNotReceivedFromStats = interviewerStats.reduce((sum, stat) => sum + (stat.callNotReceivedToTelecaller || 0), 0);
    
    // 4. Not Ringing = Total count of "Not Ringing" from all filtered interviewers
    const totalNotRingingFromStats = interviewerStats.reduce((sum, stat) => sum + (stat.notRinging || 0), 0);
    
    // 3. Calls Connected = Total count of knownCallStatus = "call_connected" in filtered responses
    // Check both 'call_connected' and 'success' (legacy value)
    // Also check metadata.callStatus as fallback
    // For project managers, only count responses from assigned interviewers
    const totalCallsConnectedFromResponses = catiResponses.filter(response => {
      // For project managers, only count responses from assigned interviewers
      if (projectManagerInterviewerIds.length > 0) {
        if (!response.interviewer || !response.interviewer._id) return false;
        const interviewerId = response.interviewer._id.toString();
        const interviewerIdObj = mongoose.Types.ObjectId.isValid(interviewerId) 
          ? new mongoose.Types.ObjectId(interviewerId) 
          : null;
        if (!interviewerIdObj || !projectManagerInterviewerIds.some(id => id.toString() === interviewerIdObj.toString())) {
          return false; // Skip this response
        }
      }
      
      const knownStatus = response.knownCallStatus;
      const metadataStatus = response.metadata?.callStatus;
      
      // Check knownCallStatus field first (primary source)
      if (knownStatus === 'call_connected' || knownStatus === 'success') {
        return true;
      }
      
      // Fallback to metadata.callStatus if knownCallStatus is not set
      if (!knownStatus && metadataStatus) {
        const normalizedMetadataStatus = String(metadataStatus).toLowerCase().trim();
        return normalizedMetadataStatus === 'call_connected' || 
               normalizedMetadataStatus === 'success' || 
               normalizedMetadataStatus === 'connected';
      }
      
      return false;
    }).length;
    
    console.log(`🔍 getCatiStats - Total CATI responses: ${catiResponses.length}`);
    if (projectManagerInterviewerIds.length > 0) {
      console.log(`🔍 getCatiStats - Project manager filtering active: ${projectManagerInterviewerIds.length} assigned interviewers`);
      const responsesFromAssignedInterviewers = catiResponses.filter(r => {
        if (!r.interviewer || !r.interviewer._id) return false;
        const interviewerId = r.interviewer._id.toString();
        const interviewerIdObj = mongoose.Types.ObjectId.isValid(interviewerId) 
          ? new mongoose.Types.ObjectId(interviewerId) 
          : null;
        return interviewerIdObj && projectManagerInterviewerIds.some(id => id.toString() === interviewerIdObj.toString());
      });
      console.log(`🔍 getCatiStats - Responses from assigned interviewers: ${responsesFromAssignedInterviewers.length}`);
    }
    console.log(`🔍 getCatiStats - Responses with knownCallStatus:`, catiResponses.filter(r => r.knownCallStatus).length);
    console.log(`🔍 getCatiStats - Responses with call_connected/success:`, catiResponses.filter(r => {
      const ks = r.knownCallStatus;
      const ms = r.metadata?.callStatus;
      return ks === 'call_connected' || ks === 'success' || 
             (ms && (String(ms).toLowerCase().trim() === 'call_connected' || String(ms).toLowerCase().trim() === 'success'));
    }).length);
    console.log(`🔍 getCatiStats - Sample knownCallStatus values:`, catiResponses.slice(0, 10).map(r => ({ 
      id: r._id, 
      interviewerId: r.interviewer?._id?.toString(),
      knownCallStatus: r.knownCallStatus,
      metadataCallStatus: r.metadata?.callStatus,
      status: r.status
    })));
    
    // 4. Talk Duration = Total of all "Form Duration" (totalTimeSpent) from filtered responses
    // For project managers, only count responses from assigned interviewers
    const totalTalkDurationFromResponses = catiResponses.reduce((sum, response) => {
      // For project managers, only count responses from assigned interviewers
      if (projectManagerInterviewerIds.length > 0) {
        if (!response.interviewer || !response.interviewer._id) return sum;
        const interviewerId = response.interviewer._id.toString();
        const interviewerIdObj = mongoose.Types.ObjectId.isValid(interviewerId) 
          ? new mongoose.Types.ObjectId(interviewerId) 
          : null;
        if (!interviewerIdObj || !projectManagerInterviewerIds.some(id => id.toString() === interviewerIdObj.toString())) {
          return sum; // Skip this response
        }
      }
      
      return sum + (response.totalTimeSpent || 0);
    }, 0);

    console.log(`🔍 getCatiStats - Final stats (from filtered data):`, {
      callsMade: totalCallsMadeFromStats,
      callsAttended: totalCallsAttendedFromStats,
      callsConnected: totalCallsConnectedFromResponses,
      totalTalkDuration: formatDuration(totalTalkDurationFromResponses),
      callNotReceived,
      ringing,
      notRinging,
      switchOff: switchOffCount,
      numberNotReachable: numberNotReachableCount,
      numberDoesNotExist: numberDoesNotExistCount
    });

    const responseData = {
      callerPerformance: {
        callsMade: totalCallsMadeFromStats,
        callsAttended: totalCallsAttendedFromStats,
        callsConnected: totalCallsConnectedFromResponses,
        totalTalkDuration: formatDuration(totalTalkDurationFromResponses)
      },
      numberStats: {
        callNotReceived: totalCallNotReceivedFromStats || callNotReceived, // Use aggregated from interviewer stats, fallback to response-based calculation
        ringing: (totalCallsAttendedFromStats || 0) - (totalNotRingingFromStats || 0), // Respondent Ph. Ringing = Interviewer Picked up - Respondent Ph. Not Ringing (switched_off is in both, so it cancels out)
        notRinging: totalNotRingingFromStats || notRinging // Respondent Ph. Not Ringing = Switch Off + Not Reachable + Number Does Not Exist (aggregated from interviewer stats)
        // Removed noResponseByTelecaller from Number Stats
      },
      callNotRingStatus: callNotRingStatus,
      callRingStatus: callRingStatus,
      statusBreakdown: statusCounts,
      callStatusBreakdown: callStatusBreakdown,
      interviewerStats: interviewerStats.map((stat, index) => ({
        sNo: index + 1,
        interviewerId: stat.interviewerId,
        interviewerName: stat.interviewerName,
        interviewerPhone: stat.interviewerPhone,
        memberID: stat.memberID || stat.interviewerId?.toString() || 'N/A', // Use memberID, fallback to interviewerId
        numberOfDials: stat.numberOfDials,
        callsConnected: stat.callsConnected || 0,
        completed: stat.completed,
        approved: stat.approved || 0,
        underQCQueue: stat.underQCQueue || 0,
        processingInBatch: stat.processingInBatch || 0,
        rejected: stat.rejected,
        incomplete: stat.incomplete || 0,
        formDuration: formatDuration(stat.formDuration || 0),
        callNotReceivedToTelecaller: stat.callNotReceivedToTelecaller,
        ringing: stat.ringing,
        notRinging: stat.notRinging,
        switchOff: stat.switchOff,
        noResponseByTelecaller: stat.noResponseByTelecaller,
        numberNotReachable: stat.numberNotReachable,
        numberDoesNotExist: stat.numberDoesNotExist
      })),
      callRecords: callRecords.map(call => ({
        _id: call._id,
        callId: call.callId,
        fromNumber: call.fromNumber,
        toNumber: call.toNumber,
        callStatus: call.callStatus,
        callStatusDescription: call.callStatusDescription,
        callStartTime: call.callStartTime,
        callEndTime: call.callEndTime,
        callDuration: call.callDuration,
        talkDuration: call.talkDuration,
        recordingUrl: call.recordingUrl,
        interviewer: call.createdBy ? {
          _id: call.createdBy._id,
          name: `${call.createdBy.firstName} ${call.createdBy.lastName}`,
          email: call.createdBy.email
        } : null,
        createdAt: call.createdAt
      }))
    };

    console.log(`🔍🔍🔍 getCatiStats - Sending response with ${callRecords.length} call records`);
    console.log(`🔍🔍🔍 getCatiStats - Response callerPerformance:`, {
      callsMade: responseData.callerPerformance.callsMade,
      callsAttended: responseData.callerPerformance.callsAttended,
      callsConnected: responseData.callerPerformance.callsConnected
    });
    console.log(`🔍🔍🔍 getCatiStats - Response data structure (first 1000 chars):`, JSON.stringify(responseData, null, 2).substring(0, 1000));

    clearTimeout(timeout);
    if (!res.headersSent) {
    res.status(200).json({
      success: true,
      data: responseData
    });
    console.log(`🔍🔍🔍 getCatiStats - END - Response sent successfully`);
    }

  } catch (error) {
    clearTimeout(timeout);
    console.error('❌ Get CATI stats error:', error);
    console.error('❌ Error stack:', error.stack);
    if (!res.headersSent) {
    res.status(500).json({
      success: false,
        message: 'Server error while fetching CATI stats',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
    }
  }
};

// @desc    Get survey analytics (optimized with aggregation)
// @route   GET /api/surveys/:surveyId/analytics
// @access  Private (Company Admin, Project Manager)
exports.getSurveyAnalytics = async (req, res) => {
  try {
    const surveyId = req.params.id || req.params.surveyId; // Support both :id and :surveyId routes
    const {
      dateRange,
      startDate,
      endDate,
      status,
      interviewMode,
      ac,
      district,
      lokSabha,
      interviewerIds,
      interviewerMode = 'include'
    } = req.query;

    // Verify survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Build match filter
    const matchFilter = { survey: mongoose.Types.ObjectId(surveyId) };

    // Status filter
    if (status && status !== 'all') {
      if (status === 'approved_rejected_pending') {
        matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
      } else if (status === 'approved_pending') {
        matchFilter.status = { $in: ['Approved', 'Pending_Approval'] };
      } else if (status === 'pending') {
        matchFilter.status = 'Pending_Approval';
      } else {
        matchFilter.status = status;
      }
    } else {
      // Default: Approved, Rejected, and Pending_Approval (matching frontend default)
      matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
    }

    // Interview mode filter
    if (interviewMode) {
      matchFilter.interviewMode = interviewMode.toLowerCase();
    }

    // Date range filter (using IST timezone)
    // If dateRange is 'custom', ignore it and use startDate/endDate instead
    if (dateRange && dateRange !== 'all' && dateRange !== 'custom') {
      const istOffset = 5.5 * 60 * 60 * 1000; // IST offset: 5.5 hours
      let dateStart, dateEnd;

      switch (dateRange) {
        case 'today':
          // Get today's date in IST, convert to UTC
          const todayIST = getISTDateString();
          dateStart = getISTDateStartUTC(todayIST);
          dateEnd = getISTDateEndUTC(todayIST);
          break;
        case 'yesterday':
          // Get yesterday's date in IST
          const now = new Date();
          const istTime = new Date(now.getTime() + istOffset);
          istTime.setUTCDate(istTime.getUTCDate() - 1);
          const yesterdayISTStr = getISTDateStringFromDate(new Date(istTime.getTime() - istOffset));
          dateStart = getISTDateStartUTC(yesterdayISTStr);
          dateEnd = getISTDateEndUTC(yesterdayISTStr);
          break;
        case 'week':
          // Get date 7 days ago in IST
          const nowWeek = new Date();
          const istTimeWeek = new Date(nowWeek.getTime() + istOffset);
          istTimeWeek.setUTCDate(istTimeWeek.getUTCDate() - 7);
          const weekAgoISTStr = getISTDateStringFromDate(new Date(istTimeWeek.getTime() - istOffset));
          const todayISTStr = getISTDateString();
          dateStart = getISTDateStartUTC(weekAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr);
          break;
        case 'month':
          // Get date 30 days ago in IST
          const nowMonth = new Date();
          const istTimeMonth = new Date(nowMonth.getTime() + istOffset);
          istTimeMonth.setUTCDate(istTimeMonth.getUTCDate() - 30);
          const monthAgoISTStr = getISTDateStringFromDate(new Date(istTimeMonth.getTime() - istOffset));
          const todayISTStr2 = getISTDateString();
          dateStart = getISTDateStartUTC(monthAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr2);
          break;
      }

      if (dateStart && dateEnd) {
        matchFilter.createdAt = { $gte: dateStart, $lte: dateEnd };
      }
    }
    
    // Custom date range - parse as IST dates (check this separately to allow override)
    if (startDate || endDate) {
      let dateStart, dateEnd;
      // Handle single day selection (startDate === endDate) or date range
      if (startDate && endDate) {
        // Both dates provided - date range
        dateStart = getISTDateStartUTC(startDate);
        dateEnd = getISTDateEndUTC(endDate);
      } else if (startDate && !endDate) {
        // Only start date provided - from start date to end of that day
        dateStart = getISTDateStartUTC(startDate);
        dateEnd = getISTDateEndUTC(startDate);
      } else if (!startDate && endDate) {
        // Only end date provided - from beginning of that day to end date
        dateStart = getISTDateStartUTC(endDate);
        dateEnd = getISTDateEndUTC(endDate);
      }
      
      if (dateStart && dateEnd) {
        // Override any dateRange filter with custom dates
        matchFilter.createdAt = { $gte: dateStart, $lte: dateEnd };
      }
    }

    // Interviewer filter
    if (interviewerIds && Array.isArray(interviewerIds) && interviewerIds.length > 0) {
      const interviewerObjectIds = interviewerIds
        .filter(id => id)
        .map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id);

      if (interviewerMode === 'exclude') {
        matchFilter.interviewer = { $nin: interviewerObjectIds };
      } else {
        matchFilter.interviewer = { $in: interviewerObjectIds };
      }
    }

    // For project managers: filter by assigned interviewers
    if (req.user.userType === 'project_manager') {
      const currentUser = await User.findById(req.user.id);
      if (currentUser && currentUser.assignedTeamMembers && currentUser.assignedTeamMembers.length > 0) {
        const assignedIds = currentUser.assignedTeamMembers.map(id => 
          mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
        );
        if (!matchFilter.interviewer) {
          matchFilter.interviewer = { $in: assignedIds };
        } else if (matchFilter.interviewer.$in) {
          // Intersect with assigned interviewers
          matchFilter.interviewer.$in = matchFilter.interviewer.$in.filter(id => 
            assignedIds.some(assignedId => assignedId.toString() === id.toString())
          );
        }
      }
    }

    // Import respondent info utilities (mirrors frontend logic)
    const { getRespondentInfo, findQuestionResponse, getMainTextValue } = require('../utils/respondentInfoUtils');
    const { getMainText } = require('../utils/genderUtils');

    // Stage 1: Match filtered responses
    const matchStage = { $match: matchFilter };

    // Stage 2: Add computed fields for demographics extraction
    const addFieldsStage = {
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
        },
        // Extract gender from responses array
        genderResponse: {
          $arrayElemAt: [
            {
              $filter: {
                input: '$responses',
                as: 'resp',
                cond: {
                  $or: [
                    { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'gender' } },
                    { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'sex' } },
                    { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionId', ''] } }, regex: 'gender' } }
                  ]
                }
              }
            },
            0
          ]
        },
        // Extract age from responses array
        ageResponse: {
          $arrayElemAt: [
            {
              $filter: {
                input: '$responses',
                as: 'resp',
                cond: {
                  $or: [
                    { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'age' } },
                    { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'year' } }
                  ]
                }
              }
            },
            0
          ]
        },
        // Extract phone from responses array
        phoneResponse: {
          $arrayElemAt: [
            {
              $filter: {
                input: '$responses',
                as: 'resp',
                cond: {
                  $or: [
                    { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'phone' } },
                    { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'mobile' } }
                  ]
                }
              }
            },
            0
          ]
        },
        // Extract caste from responses array (for specific survey)
        casteResponse: surveyId === '68fd1915d41841da463f0d46' ? {
          $arrayElemAt: [
            {
              $filter: {
                input: '$responses',
                as: 'resp',
                cond: {
                  $or: [
                    { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'caste' } },
                    { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'scheduled cast' } },
                    { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'category' } }
                  ]
                }
              }
            },
            0
          ]
        } : null,
        // Extract religion from responses array
        religionResponse: {
          $arrayElemAt: [
            {
              $filter: {
                input: '$responses',
                as: 'resp',
                cond: {
                  $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'religion' }
                }
              }
            },
            0
          ]
        },
        // Extract polling station info
        pollingStationKey: {
          $cond: {
            if: { $and: [{ $ne: ['$selectedPollingStation.stationName', null] }] },
            then: {
              $concat: [
                { $ifNull: ['$selectedPollingStation.stationName', ''] },
                { $ifNull: [{ $concat: ['-', '$selectedPollingStation.groupName'] }, ''] }
              ]
            },
            else: null
          }
        }
      }
    };

    // Stage 3: Group by AC for AC stats
    const acGroupStage = {
      $group: {
        _id: {
          $ifNull: ['$extractedAC', 'N/A']
        },
        total: { $sum: 1 },
        capi: {
          $sum: {
            $cond: [{ $eq: [{ $toUpper: { $ifNull: ['$interviewMode', ''] } }, 'CAPI'] }, 1, 0]
          }
        },
        cati: {
          $sum: {
            $cond: [{ $eq: [{ $toUpper: { $ifNull: ['$interviewMode', ''] } }, 'CATI'] }, 1, 0]
          }
        },
        approved: {
          $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] }
        },
        autoRejected: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'Rejected'] },
                  {
                    $or: [
                      { $eq: ['$verificationData.autoRejected', true] },
                      { $gt: [{ $size: { $ifNull: ['$verificationData.autoRejectionReasons', []] } }, 0] }
                    ]
                  }
                ]
              },
              1,
              0
            ]
          }
        },
        manualRejected: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'Rejected'] },
                  {
                    $or: [
                      { $ne: ['$verificationData.autoRejected', true] },
                      { $eq: [{ $size: { $ifNull: ['$verificationData.autoRejectionReasons', []] } }, 0] }
                    ]
                  }
                ]
              },
              1,
              0
            ]
          }
        },
        underQC: {
          $sum: { $cond: [{ $eq: ['$status', 'Pending_Approval'] }, 1, 0] }
        },
        femaleCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$genderResponse', null] },
                  {
                    $or: [
                      { $regexMatch: { input: { $toLower: { $toString: { $ifNull: ['$genderResponse.response', ''] } } }, regex: 'female' } },
                      { $eq: [{ $toLower: { $toString: { $ifNull: ['$genderResponse.response', ''] } } }, 'f'] },
                      { $eq: [{ $toLower: { $toString: { $ifNull: ['$genderResponse.response', ''] } } }, '2'] }
                    ]
                  }
                ]
              },
              1,
              0
            ]
          }
        },
        withoutPhoneCount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$phoneResponse', null] },
                  { $eq: [{ $toString: { $ifNull: ['$phoneResponse.response', ''] } }, ''] },
                  { $eq: [{ $toLower: { $toString: { $ifNull: ['$phoneResponse.response', ''] } } }, 'n/a'] },
                  { $eq: [{ $toString: { $ifNull: ['$phoneResponse.response', ''] } }, '0'] }
                ]
              },
              1,
              0
            ]
          }
        },
        scCount: surveyId === '68fd1915d41841da463f0d46' ? {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$casteResponse', null] },
                  {
                    $regexMatch: {
                      input: { $toLower: { $toString: { $ifNull: ['$casteResponse.response', ''] } } },
                      regex: '(scheduled cast|sc|scheduled caste)'
                    }
                  }
                ]
              },
              1,
              0
            ]
          }
        } : { $literal: 0 },
        muslimCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$religionResponse', null] },
                  {
                    $regexMatch: {
                      input: { $toLower: { $toString: { $ifNull: ['$religionResponse.response', ''] } } },
                      regex: '(muslim|islam)'
                    }
                  }
                ]
              },
              1,
              0
            ]
          }
        },
        age18to24Count: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$ageResponse', null] },
                  {
                    $let: {
                      vars: {
                        age: {
                          $toInt: {
                            $arrayElemAt: [
                              {
                                $regexFind: {
                                  input: { $toString: { $ifNull: ['$ageResponse.response', ''] } },
                                  regex: /(\d+)/
                                }
                              },
                              1
                            ]
                          }
                        }
                      },
                      in: {
                        $and: [
                          { $gte: ['$$age', 18] },
                          { $lte: ['$$age', 24] }
                        ]
                      }
                    }
                  }
                ]
              },
              1,
              0
            ]
          }
        },
        age50PlusCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$ageResponse', null] },
                  {
                    $let: {
                      vars: {
                        age: {
                          $toInt: {
                            $arrayElemAt: [
                              {
                                $regexFind: {
                                  input: { $toString: { $ifNull: ['$ageResponse.response', ''] } },
                                  regex: /(\d+)/
                                }
                              },
                              1
                            ]
                          }
                        }
                      },
                      in: { $gte: ['$$age', 50] }
                    }
                  }
                ]
              },
              1,
              0
            ]
          }
        },
        pollingStations: { $addToSet: '$pollingStationKey' },
        interviewers: { $addToSet: '$interviewer' },
        totalResponseTime: {
          $sum: {
            $reduce: {
              input: { $ifNull: ['$responses', []] },
              initialValue: 0,
              in: { $add: ['$$value', { $ifNull: ['$$this.responseTime', 0] }] }
            }
          }
        }
      }
    };

    // Run aggregation for AC stats
    const acStatsPipeline = [
      matchStage,
      addFieldsStage,
      acGroupStage,
      {
        $project: {
          _id: 0,
          ac: '$_id',
          count: '$total',
          capi: '$capi',
          cati: '$cati',
          approved: '$approved',
          rejected: '$rejected',
          autoRejected: '$autoRejected',
          manualRejected: '$manualRejected',
          underQC: '$underQC',
          interviewersCount: { $size: { $ifNull: ['$interviewers', []] } },
          psCovered: { $size: { $filter: { input: { $ifNull: ['$pollingStations', []] }, cond: { $ne: ['$$this', null] } } } },
          femaleCount: '$femaleCount',
          withoutPhoneCount: '$withoutPhoneCount',
          scCount: '$scCount',
          muslimCount: '$muslimCount',
          age18to24Count: '$age18to24Count',
          age50PlusCount: '$age50PlusCount',
          totalResponseTime: '$totalResponseTime'
        }
      }
    ];

    // For accurate AC extraction, we need to use JavaScript processing
    // Fetch minimal data: responses array, selectedAC, selectedPollingStation, interviewer, status, interviewMode, createdAt, verificationData
    // This is still much faster than fetching full documents
    let minimalResponses = await SurveyResponse.find(matchFilter)
      .select('responses selectedAC selectedPollingStation interviewer status interviewMode createdAt verificationData')
      .populate('interviewer', 'firstName lastName memberId')
      .lean();

    // Apply AC, district, lokSabha filters after extraction (since they're in responses array)
    // These filters need to be applied after extracting from responses
    if (ac || district || lokSabha) {
      const { getRespondentInfo } = require('../utils/respondentInfoUtils');
      minimalResponses = minimalResponses.filter(response => {
        const respondentInfo = getRespondentInfo(response.responses || [], response, survey);
        
        // AC filter
        if (ac && ac.trim()) {
          const responseAC = respondentInfo.ac;
          if (!responseAC || responseAC === 'N/A' || responseAC.toLowerCase() !== ac.toLowerCase()) {
            return false;
          }
        }
        
        // District filter
        if (district && district.trim()) {
          const responseDistrict = respondentInfo.district;
          if (!responseDistrict || responseDistrict === 'N/A' || responseDistrict.toLowerCase() !== district.toLowerCase()) {
            return false;
          }
        }
        
        // Lok Sabha filter
        if (lokSabha && lokSabha.trim()) {
          const responseLokSabha = respondentInfo.lokSabha;
          if (!responseLokSabha || responseLokSabha === 'N/A' || responseLokSabha.toLowerCase() !== lokSabha.toLowerCase()) {
            return false;
          }
        }
        
        return true;
      });
    }

    // Process responses using same logic as frontend
    const acMap = new Map();
    const districtMap = new Map();
    const lokSabhaMap = new Map();
    const interviewerMap = new Map();
    const genderMap = new Map();
    const ageMap = new Map();
    const dailyMap = new Map(); // Format: { date: { total: count, capi: count, cati: count } }
    let totalResponseTime = 0;

    minimalResponses.forEach(response => {
      const respondentInfo = getRespondentInfo(response.responses || [], response, survey);
      const responseData = response.responses || [];
      
      // Extract AC
      const ac = respondentInfo.ac;
      if (ac && ac !== 'N/A') {
        const currentCount = acMap.get(ac) || {
          total: 0,
          capi: 0,
          cati: 0,
          interviewers: new Set(),
          approved: 0,
          rejected: 0,
          autoRejected: 0,
          manualRejected: 0,
          underQC: 0,
          femaleCount: 0,
          withoutPhoneCount: 0,
          scCount: 0,
          muslimCount: 0,
          age18to24Count: 0,
          age50PlusCount: 0,
          pollingStations: new Set()
        };
        
        currentCount.total += 1;
        
        // Polling station
        if (response.selectedPollingStation?.stationName) {
          const psKey = `${response.selectedPollingStation.stationName}${response.selectedPollingStation.groupName ? `-${response.selectedPollingStation.groupName}` : ''}`;
          currentCount.pollingStations.add(psKey);
        }
        
        // Interview mode
        const interviewMode = response.interviewMode?.toUpperCase();
        if (interviewMode === 'CAPI') {
          currentCount.capi += 1;
        } else if (interviewMode === 'CATI') {
          currentCount.cati += 1;
        }
        
        // Interviewers
        if (response.interviewer?._id) {
          currentCount.interviewers.add(response.interviewer._id.toString());
        }
        
        // Status
        if (response.status === 'Approved') {
          currentCount.approved += 1;
        } else if (response.status === 'Rejected') {
          const isAutoRejected = response.verificationData?.autoRejected === true ||
                                (response.verificationData?.autoRejectionReasons && response.verificationData.autoRejectionReasons.length > 0) ||
                                (response.verificationData?.feedback && (
                                  response.verificationData.feedback.includes('Interview Too Short') ||
                                  response.verificationData.feedback.includes('Not Voter') ||
                                  response.verificationData.feedback.includes('Not a Registered Voter') ||
                                  response.verificationData.feedback.includes('Duplicate Response')
                                ));
          if (isAutoRejected) {
            currentCount.autoRejected += 1;
          } else {
            currentCount.manualRejected += 1;
          }
          currentCount.rejected += 1;
        } else if (response.status === 'Pending_Approval') {
          currentCount.underQC += 1;
        }
        
        // Demographics
        const genderResponse = require('../utils/genderUtils').findGenderResponse(responseData, survey) || findQuestionResponse(responseData, ['gender', 'sex']);
        if (genderResponse?.response) {
          const normalizedGender = require('../utils/genderUtils').normalizeGenderResponse(genderResponse.response);
          if (normalizedGender === 'female') {
            currentCount.femaleCount += 1;
          }
        }
        
        // Phone
        let phoneResponse = responseData.find(r => {
          const questionText = getMainText(r.questionText || r.question?.text || '').toLowerCase();
          return questionText.includes('mobile number') ||
                 questionText.includes('phone number') ||
                 questionText.includes('share your mobile') ||
                 questionText.includes('would you like to share your mobile');
        });
        if (!phoneResponse) {
          phoneResponse = findQuestionResponse(responseData, ['phone', 'mobile', 'contact', 'number']);
        }
        if (!phoneResponse?.response ||
            String(phoneResponse.response).trim() === '' ||
            String(phoneResponse.response).trim() === 'N/A' ||
            String(phoneResponse.response).trim() === '0') {
          currentCount.withoutPhoneCount += 1;
        }
        
        // SC (for specific survey)
        if (surveyId === '68fd1915d41841da463f0d46') {
          const casteResponse = findQuestionResponse(responseData, ['caste', 'scheduled cast', 'sc', 'category']);
          if (casteResponse?.response) {
            const casteValue = getMainTextValue(String(casteResponse.response)).toLowerCase();
            if (casteValue.includes('scheduled cast') ||
                casteValue.includes('sc') ||
                casteValue.includes('scheduled caste')) {
              currentCount.scCount += 1;
            }
          }
        }
        
        // Muslim
        const religionResponse = findQuestionResponse(responseData, ['religion', 'muslim', 'hindu', 'christian']);
        if (religionResponse?.response) {
          const religionValue = getMainTextValue(String(religionResponse.response)).toLowerCase();
          if (religionValue.includes('muslim') || religionValue.includes('islam')) {
            currentCount.muslimCount += 1;
          }
        }
        
        // Age groups
        const ageResponse = findQuestionResponse(responseData, ['age', 'year']);
        if (ageResponse?.response) {
          const age = parseInt(ageResponse.response);
          if (!isNaN(age) && age > 0 && age < 150) {
            if (age >= 18 && age <= 24) {
              currentCount.age18to24Count += 1;
            }
            if (age >= 50) {
              currentCount.age50PlusCount += 1;
            }
          }
        }
        
        acMap.set(ac, currentCount);
      }
      
      // District
      const district = respondentInfo.district;
      if (district && district !== 'N/A') {
        districtMap.set(district, (districtMap.get(district) || 0) + 1);
      }
      
      // Lok Sabha
      const lokSabha = respondentInfo.lokSabha;
      if (lokSabha && lokSabha !== 'N/A') {
        lokSabhaMap.set(lokSabha, (lokSabhaMap.get(lokSabha) || 0) + 1);
      }
      
      // Interviewer stats
      if (response.interviewer) {
        const interviewerName = `${response.interviewer.firstName} ${response.interviewer.lastName}`;
        const interviewerMemberId = response.interviewer.memberId || '';
        const interviewerId = response.interviewer._id || response.interviewer.id || null;
        const currentCount = interviewerMap.get(interviewerName) || {
          total: 0,
          capi: 0,
          cati: 0,
          approved: 0,
          rejected: 0,
          autoRejected: 0,
          manualRejected: 0,
          pending: 0,
          pollingStations: new Set(),
          femaleCount: 0,
          withoutPhoneCount: 0,
          scCount: 0,
          muslimCount: 0,
          age18to24Count: 0,
          age50PlusCount: 0,
          memberId: interviewerMemberId,
          interviewerId: interviewerId
        };
        
        if (!currentCount.memberId && interviewerMemberId) {
          currentCount.memberId = interviewerMemberId;
        }
        if (!currentCount.interviewerId && interviewerId) {
          currentCount.interviewerId = interviewerId;
        }
        currentCount.total += 1;
        
        // Polling station
        if (response.selectedPollingStation?.stationName) {
          const psKey = `${response.selectedPollingStation.stationName}${response.selectedPollingStation.groupName ? `-${response.selectedPollingStation.groupName}` : ''}`;
          currentCount.pollingStations.add(psKey);
        }
        
        // Interview mode
        if (interviewMode === 'CAPI') {
          currentCount.capi += 1;
        } else if (interviewMode === 'CATI') {
          currentCount.cati += 1;
        }
        
        // Status
        if (response.status === 'Approved') {
          currentCount.approved += 1;
        } else if (response.status === 'Rejected') {
          const isAutoRejected = response.verificationData?.autoRejected === true ||
                                (response.verificationData?.autoRejectionReasons && response.verificationData.autoRejectionReasons.length > 0) ||
                                (response.verificationData?.feedback && (
                                  response.verificationData.feedback.includes('Interview Too Short') ||
                                  response.verificationData.feedback.includes('Not Voter') ||
                                  response.verificationData.feedback.includes('Not a Registered Voter') ||
                                  response.verificationData.feedback.includes('Duplicate Response')
                                ));
          if (isAutoRejected) {
            currentCount.autoRejected += 1;
          } else {
            currentCount.manualRejected += 1;
          }
          currentCount.rejected += 1;
        } else if (response.status === 'Pending_Approval') {
          currentCount.pending += 1;
        }
        
        // Demographics for interviewer
        const genderResponseForInterviewer = require('../utils/genderUtils').findGenderResponse(responseData, survey) || findQuestionResponse(responseData, ['gender', 'sex']);
        if (genderResponseForInterviewer?.response) {
          const normalizedGender = require('../utils/genderUtils').normalizeGenderResponse(genderResponseForInterviewer.response);
          if (normalizedGender === 'female') {
            currentCount.femaleCount += 1;
          }
        }
        
        // Phone for interviewer
        let phoneResponseForInterviewer = responseData.find(r => {
          const questionText = getMainText(r.questionText || r.question?.text || '').toLowerCase();
          return questionText.includes('mobile number') ||
                 questionText.includes('phone number') ||
                 questionText.includes('share your mobile') ||
                 questionText.includes('would you like to share your mobile');
        });
        if (!phoneResponseForInterviewer) {
          phoneResponseForInterviewer = findQuestionResponse(responseData, ['phone', 'mobile', 'contact', 'number']);
        }
        if (!phoneResponseForInterviewer?.response ||
            String(phoneResponseForInterviewer.response).trim() === '' ||
            String(phoneResponseForInterviewer.response).trim() === 'N/A' ||
            String(phoneResponseForInterviewer.response).trim() === '0') {
          currentCount.withoutPhoneCount += 1;
        }
        
        // SC for interviewer
        if (surveyId === '68fd1915d41841da463f0d46') {
          const casteResponseForInterviewer = findQuestionResponse(responseData, ['caste', 'scheduled cast', 'sc', 'category']);
          if (casteResponseForInterviewer?.response) {
            const casteValue = getMainTextValue(String(casteResponseForInterviewer.response)).toLowerCase();
            if (casteValue.includes('scheduled cast') ||
                casteValue.includes('sc') ||
                casteValue.includes('scheduled caste')) {
              currentCount.scCount += 1;
            }
          }
        }
        
        // Muslim for interviewer
        const religionResponseForInterviewer = findQuestionResponse(responseData, ['religion', 'muslim', 'hindu', 'christian']);
        if (religionResponseForInterviewer?.response) {
          const religionValue = getMainTextValue(String(religionResponseForInterviewer.response)).toLowerCase();
          if (religionValue.includes('muslim') || religionValue.includes('islam')) {
            currentCount.muslimCount += 1;
          }
        }
        
        // Age for interviewer
        const ageResponseForInterviewer = findQuestionResponse(responseData, ['age', 'year']);
        if (ageResponseForInterviewer?.response) {
          const age = parseInt(ageResponseForInterviewer.response);
          if (!isNaN(age) && age > 0 && age < 150) {
            if (age >= 18 && age <= 24) {
              currentCount.age18to24Count += 1;
            }
            if (age >= 50) {
              currentCount.age50PlusCount += 1;
            }
          }
        }
        
        interviewerMap.set(interviewerName, currentCount);
      }
      
      // Gender stats
      const gender = respondentInfo.gender;
      if (gender && gender !== 'N/A') {
        const genderText = getMainText(gender);
        genderMap.set(genderText, (genderMap.get(genderText) || 0) + 1);
      }
      
      // Age stats
      const age = parseInt(respondentInfo.age);
      if (!isNaN(age)) {
        const ageGroup = Math.floor(age / 10) * 10;
        ageMap.set(ageGroup, (ageMap.get(ageGroup) || 0) + 1);
      }
      
      // Daily stats with CAPI/CATI breakdown
      const date = new Date(response.createdAt).toDateString();
      const currentDaily = dailyMap.get(date) || { total: 0, capi: 0, cati: 0 };
      currentDaily.total += 1;
      if (interviewMode === 'CAPI') {
        currentDaily.capi += 1;
      } else if (interviewMode === 'CATI') {
        currentDaily.cati += 1;
      }
      dailyMap.set(date, currentDaily);
      
      // Response time
      totalResponseTime += (response.responses?.reduce((sum, resp) => sum + (resp.responseTime || 0), 0) || 0);
    });

    // Calculate total responses and basic stats
    const totalResponses = minimalResponses.length;
    const capiResponses = minimalResponses.filter(r => r.interviewMode?.toUpperCase() === 'CAPI').length;
    const catiResponses = minimalResponses.filter(r => r.interviewMode?.toUpperCase() === 'CATI').length;
    const capiApproved = minimalResponses.filter(r => r.interviewMode?.toUpperCase() === 'CAPI' && r.status === 'Approved').length;
    const capiRejected = minimalResponses.filter(r => r.interviewMode?.toUpperCase() === 'CAPI' && r.status === 'Rejected').length;

    // Format AC stats
    const acStats = Array.from(acMap.entries()).map(([ac, data]) => ({
      ac: ac,
      count: data.total,
      capi: data.capi,
      cati: data.cati,
      percentage: totalResponses > 0 ? (data.total / totalResponses) * 100 : 0,
      interviewersCount: data.interviewers ? data.interviewers.size : 0,
      approved: data.approved,
      rejected: data.rejected,
      autoRejected: data.autoRejected,
      manualRejected: data.manualRejected,
      underQC: data.underQC,
      psCovered: data.pollingStations ? data.pollingStations.size : 0,
      femalePercentage: data.total > 0 ? (data.femaleCount / data.total) * 100 : 0,
      withoutPhonePercentage: data.total > 0 ? (data.withoutPhoneCount / data.total) * 100 : 0,
      scPercentage: data.total > 0 ? (data.scCount / data.total) * 100 : 0,
      muslimPercentage: data.total > 0 ? (data.muslimCount / data.total) * 100 : 0,
      age18to24Percentage: data.total > 0 ? (data.age18to24Count / data.total) * 100 : 0,
      age50PlusPercentage: data.total > 0 ? (data.age50PlusCount / data.total) * 100 : 0
    })).sort((a, b) => b.count - a.count);

    // District and Lok Sabha stats are already calculated from minimalResponses processing above
    const districtStats = Array.from(districtMap.entries())
      .map(([district, count]) => ({
        district,
        count: count,
        percentage: totalResponses > 0 ? (count / totalResponses) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    const lokSabhaStats = Array.from(lokSabhaMap.entries())
      .map(([lokSabha, count]) => ({
        lokSabha,
        count: count,
        percentage: totalResponses > 0 ? (count / totalResponses) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    // Format interviewer stats
    const interviewerStats = Array.from(interviewerMap.entries()).map(([interviewer, data]) => ({
      interviewer: interviewer,
      interviewerId: data.interviewerId || null,
      memberId: data.memberId || '',
      count: data.total,
      capi: data.capi,
      cati: data.cati,
      approved: data.approved,
      rejected: data.rejected,
      autoRejected: data.autoRejected,
      manualRejected: data.manualRejected,
      pending: data.pending,
      underQC: data.pending,
      percentage: totalResponses > 0 ? (data.total / totalResponses) * 100 : 0,
      psCovered: data.pollingStations ? data.pollingStations.size : 0,
      femalePercentage: data.total > 0 ? (data.femaleCount / data.total) * 100 : 0,
      withoutPhonePercentage: data.total > 0 ? (data.withoutPhoneCount / data.total) * 100 : 0,
      scPercentage: data.total > 0 ? (data.scCount / data.total) * 100 : 0,
      muslimPercentage: data.total > 0 ? (data.muslimCount / data.total) * 100 : 0,
      age18to24Percentage: data.total > 0 ? (data.age18to24Count / data.total) * 100 : 0,
      age50PlusPercentage: data.total > 0 ? (data.age50PlusCount / data.total) * 100 : 0
    })).sort((a, b) => b.count - a.count);

    // Basic stats are already calculated from minimalResponses

    // Gender and Age stats are already calculated from minimalResponses
    const genderStats = Object.fromEntries(genderMap);
    const ageStats = Object.fromEntries(ageMap);

    // Daily stats are already calculated from minimalResponses (with CAPI/CATI breakdown)
    const dailyStats = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ 
        date, 
        count: data.total || data, // Support both old format (number) and new format (object)
        capi: data.capi || 0,
        cati: data.cati || 0
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate completion rate and average response time
    const completionRate = survey?.sampleSize ? (totalResponses / survey.sampleSize) * 100 : 0;
    const averageResponseTime = totalResponses > 0 
      ? (totalResponseTime / totalResponses) 
      : 0;

    // Return analytics data
    res.status(200).json({
      success: true,
      data: {
        totalResponses,
        capiResponses,
        catiResponses,
        completionRate,
        averageResponseTime,
        acStats,
        districtStats,
        lokSabhaStats,
        interviewerStats,
        genderStats: Object.fromEntries(genderMap),
        ageStats: Object.fromEntries(ageMap),
        dailyStats,
        capiPerformance: {
          approved: capiApproved,
          rejected: capiRejected,
          total: capiResponses
        }
      }
    });

  } catch (error) {
    console.error('Get survey analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get optimized analytics for reports V2 (using MongoDB aggregation only, no limits)
// @route   GET /api/surveys/:id/analytics-v2
// @access  Private (Company Admin, Project Manager)
exports.getSurveyAnalyticsV2 = async (req, res) => {
  try {
    const surveyId = req.params.id || req.params.surveyId;
    const {
      dateRange,
      startDate,
      endDate,
      status,
      interviewMode,
      ac,
      district,
      lokSabha,
      interviewerIds,
      interviewerMode = 'include'
    } = req.query;

    // Debug: Log received query params
    console.log('🔍 getSurveyAnalyticsV2 - Query params:', {
      surveyId,
      interviewerIds,
      interviewerIdsType: typeof interviewerIds,
      isArray: Array.isArray(interviewerIds),
      interviewerMode
    });

    // Verify survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Build match filter for MongoDB aggregation (NO LIMITS - handles millions of records)
    const matchFilter = { survey: mongoose.Types.ObjectId.isValid(surveyId) ? new mongoose.Types.ObjectId(surveyId) : surveyId };

    // Status filter
    if (status && status !== 'all') {
      if (status === 'approved_rejected_pending') {
        matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
      } else if (status === 'approved_pending') {
        matchFilter.status = { $in: ['Approved', 'Pending_Approval'] };
      } else if (status === 'pending') {
        matchFilter.status = 'Pending_Approval';
      } else {
        matchFilter.status = status;
      }
    } else {
      matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
    }

    // Interview mode filter
    if (interviewMode) {
      matchFilter.interviewMode = interviewMode.toLowerCase();
    }

    // Date range filter (using IST timezone)
    // If dateRange is 'custom', ignore it and use startDate/endDate instead
    if (dateRange && dateRange !== 'all' && dateRange !== 'custom') {
      const istOffset = 5.5 * 60 * 60 * 1000; // IST offset: 5.5 hours
      let dateStart, dateEnd;

      switch (dateRange) {
        case 'today':
          // Get today's date in IST, convert to UTC
          const todayIST = getISTDateString();
          dateStart = getISTDateStartUTC(todayIST);
          dateEnd = getISTDateEndUTC(todayIST);
          break;
        case 'yesterday':
          // Get yesterday's date in IST
          const now = new Date();
          const istTime = new Date(now.getTime() + istOffset);
          istTime.setUTCDate(istTime.getUTCDate() - 1);
          const yesterdayISTStr = getISTDateStringFromDate(new Date(istTime.getTime() - istOffset));
          dateStart = getISTDateStartUTC(yesterdayISTStr);
          dateEnd = getISTDateEndUTC(yesterdayISTStr);
          break;
        case 'week':
          // Get date 7 days ago in IST
          const nowWeek = new Date();
          const istTimeWeek = new Date(nowWeek.getTime() + istOffset);
          istTimeWeek.setUTCDate(istTimeWeek.getUTCDate() - 7);
          const weekAgoISTStr = getISTDateStringFromDate(new Date(istTimeWeek.getTime() - istOffset));
          const todayISTStr = getISTDateString();
          dateStart = getISTDateStartUTC(weekAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr);
          break;
        case 'month':
          // Get date 30 days ago in IST
          const nowMonth = new Date();
          const istTimeMonth = new Date(nowMonth.getTime() + istOffset);
          istTimeMonth.setUTCDate(istTimeMonth.getUTCDate() - 30);
          const monthAgoISTStr = getISTDateStringFromDate(new Date(istTimeMonth.getTime() - istOffset));
          const todayISTStr2 = getISTDateString();
          dateStart = getISTDateStartUTC(monthAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr2);
          break;
      }

      if (dateStart && dateEnd) {
        matchFilter.createdAt = { $gte: dateStart, $lte: dateEnd };
      }
    }
    
    // Custom date range - parse as IST dates (check this separately to allow override)
    if (startDate || endDate) {
      let dateStart, dateEnd;
      // Handle single day selection (startDate === endDate) or date range
      if (startDate && endDate) {
        // Both dates provided - date range
        dateStart = getISTDateStartUTC(startDate);
        dateEnd = getISTDateEndUTC(endDate);
      } else if (startDate && !endDate) {
        // Only start date provided - from start date to end of that day
        dateStart = getISTDateStartUTC(startDate);
        dateEnd = getISTDateEndUTC(startDate);
      } else if (!startDate && endDate) {
        // Only end date provided - from beginning of that day to end date
        dateStart = getISTDateStartUTC(endDate);
        dateEnd = getISTDateEndUTC(endDate);
      }
      
      if (dateStart && dateEnd) {
        // Override any dateRange filter with custom dates
        matchFilter.createdAt = { $gte: dateStart, $lte: dateEnd };
      }
    }

    // Interviewer filter - Handle both array and single value from query params
    let interviewerIdsArray = [];
    if (interviewerIds) {
      if (Array.isArray(interviewerIds)) {
        interviewerIdsArray = interviewerIds;
      } else if (typeof interviewerIds === 'string') {
        // If it's a string, it might be comma-separated or a single ID
        interviewerIdsArray = interviewerIds.split(',').map(id => id.trim()).filter(id => id);
      }
    }

    if (interviewerIdsArray.length > 0) {
      const interviewerObjectIds = interviewerIdsArray
        .filter(id => id && id !== 'undefined' && id !== 'null')
        .map(id => {
          // Handle both string IDs and ObjectIds
          if (mongoose.Types.ObjectId.isValid(id)) {
            return new mongoose.Types.ObjectId(id);
          }
          return id;
        })
        .filter(id => id); // Remove any invalid IDs

      if (interviewerObjectIds.length > 0) {
        if (interviewerMode === 'exclude') {
          matchFilter.interviewer = { $nin: interviewerObjectIds };
        } else {
          matchFilter.interviewer = { $in: interviewerObjectIds };
        }
        
        console.log(`🔍 getSurveyAnalyticsV2 - Filtering by ${interviewerObjectIds.length} interviewer(s):`, interviewerObjectIds.map(id => id.toString()));
      }
    }

    // For project managers: filter by assigned interviewers
    if (req.user.userType === 'project_manager') {
      const currentUser = await User.findById(req.user.id).populate('assignedTeamMembers.user', '_id userType');
      if (currentUser && currentUser.assignedTeamMembers && currentUser.assignedTeamMembers.length > 0) {
        // Extract interviewer IDs from assignedTeamMembers structure
        // assignedTeamMembers is an array of objects: [{ userType: 'interviewer', user: ObjectId or User object }, ...]
        const assignedIds = currentUser.assignedTeamMembers
          .filter(tm => tm.userType === 'interviewer' && tm.user)
          .map(tm => {
            // Handle both ObjectId and populated user object
            const userId = tm.user._id ? tm.user._id : tm.user;
            return mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
          })
          .filter(id => id && mongoose.Types.ObjectId.isValid(id));
        
        if (assignedIds.length > 0) {
          if (!matchFilter.interviewer) {
            // No interviewer filter yet, apply assigned interviewers filter
            matchFilter.interviewer = { $in: assignedIds };
            console.log(`🔍 getSurveyAnalyticsV2 - Project Manager: Filtering by ${assignedIds.length} assigned interviewer(s)`);
          } else if (matchFilter.interviewer.$in) {
            // Intersect with assigned interviewers (only show selected interviewers that are assigned)
            const originalIds = matchFilter.interviewer.$in;
            matchFilter.interviewer.$in = originalIds.filter(id => {
              const idStr = id.toString();
              return assignedIds.some(assignedId => assignedId.toString() === idStr);
            });
            console.log(`🔍 getSurveyAnalyticsV2 - Project Manager: Intersected ${originalIds.length} selected with ${assignedIds.length} assigned, result: ${matchFilter.interviewer.$in.length} interviewer(s)`);
          } else if (matchFilter.interviewer.$nin) {
            // For exclude mode, ensure we're only excluding from assigned interviewers
            const excludedIds = matchFilter.interviewer.$nin;
            const assignedIdsStr = assignedIds.map(id => id.toString());
            matchFilter.interviewer.$nin = excludedIds.filter(id => assignedIdsStr.includes(id.toString()));
            console.log(`🔍 getSurveyAnalyticsV2 - Project Manager: Excluding ${matchFilter.interviewer.$nin.length} interviewer(s) from assigned list`);
          }
        } else {
          // No assigned interviewers found, return empty results
          console.log(`⚠️ getSurveyAnalyticsV2 - Project Manager: No valid assigned interviewers found`);
          matchFilter.interviewer = { $in: [] }; // Empty array will return no results
        }
      } else {
        // No assigned team members, return empty results
        console.log(`⚠️ getSurveyAnalyticsV2 - Project Manager: No assigned team members`);
        matchFilter.interviewer = { $in: [] }; // Empty array will return no results
      }
    }

    // Build aggregation pipeline - pure MongoDB aggregation (no JavaScript processing)
    const pipeline = [];

    // Debug: Log the match filter before applying
    console.log('🔍 getSurveyAnalyticsV2 - Final matchFilter:', JSON.stringify(matchFilter, null, 2));

    // Stage 1: Match filtered responses
    pipeline.push({ $match: matchFilter });

    // Stage 2: Filter by AC if provided (using indexed fields)
    if (ac && ac.trim()) {
      const acPattern = ac.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pipeline.push({
        $match: {
          $or: [
            { selectedAC: { $regex: acPattern, $options: 'i' } },
            { 'selectedPollingStation.acName': { $regex: acPattern, $options: 'i' } }
          ]
        }
      });
    }

    // Stage 3: For district/lokSabha, we need to extract from responses array
    // This is less efficient but necessary since they're in nested responses
    // We'll use aggregation to extract and filter
    if ((district && district.trim()) || (lokSabha && lokSabha.trim())) {
      // Add fields to extract district/lokSabha from responses
      pipeline.push({
        $addFields: {
          // Extract district from responses array
          extractedDistrict: {
            $let: {
              vars: {
                districtResponse: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ['$responses', []] },
                        as: 'resp',
                        cond: {
                          $or: [
                            { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'district' } },
                            { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionId', ''] } }, regex: 'district' } }
                          ]
                        }
                      }
                    },
                    0
                  ]
                }
              },
              in: {
                $ifNull: ['$$districtResponse.response', null]
              }
            }
          },
          // Extract lokSabha from responses array
          extractedLokSabha: {
            $let: {
              vars: {
                lokSabhaResponse: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ['$responses', []] },
                        as: 'resp',
                        cond: {
                          $or: [
                            { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionText', ''] } }, regex: 'lok sabha|parliamentary' } },
                            { $regexMatch: { input: { $toLower: { $ifNull: ['$$resp.questionId', ''] } }, regex: 'lok.*sabha|parliamentary' } }
                          ]
                        }
                      }
                    },
                    0
                  ]
                }
              },
              in: {
                $ifNull: ['$$lokSabhaResponse.response', null]
              }
            }
          }
        }
      });

      // Filter by district/lokSabha
      const districtLokSabhaFilter = {};
      if (district && district.trim()) {
        const districtPattern = district.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        districtLokSabhaFilter.$or = [
          { extractedDistrict: { $regex: districtPattern, $options: 'i' } },
          { 'responses.response': { $regex: districtPattern, $options: 'i' } }
        ];
      }
      if (lokSabha && lokSabha.trim()) {
        const lokSabhaPattern = lokSabha.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (districtLokSabhaFilter.$or) {
          districtLokSabhaFilter.$and = [
            districtLokSabhaFilter,
            {
              $or: [
                { extractedLokSabha: { $regex: lokSabhaPattern, $options: 'i' } },
                { 'responses.response': { $regex: lokSabhaPattern, $options: 'i' } }
              ]
            }
          ];
          delete districtLokSabhaFilter.$or;
        } else {
          districtLokSabhaFilter.$or = [
            { extractedLokSabha: { $regex: lokSabhaPattern, $options: 'i' } },
            { 'responses.response': { $regex: lokSabhaPattern, $options: 'i' } }
          ];
        }
      }
      
      if (Object.keys(districtLokSabhaFilter).length > 0) {
        pipeline.push({ $match: districtLokSabhaFilter });
      }
    }

    // Stage 4: Group and count (final aggregation stage)
    pipeline.push({
      $group: {
        _id: null,
        totalResponses: { $sum: 1 },
        capiResponses: {
          $sum: {
            $cond: [{ $eq: [{ $toUpper: { $ifNull: ['$interviewMode', ''] } }, 'CAPI'] }, 1, 0]
          }
        },
        catiResponses: {
          $sum: {
            $cond: [{ $eq: [{ $toUpper: { $ifNull: ['$interviewMode', ''] } }, 'CATI'] }, 1, 0]
          }
        }
      }
    });

    // Execute aggregation (handles millions of records efficiently)
    const result = await SurveyResponse.aggregate(pipeline);

    // Get sample size from survey
    const sampleSize = survey.sampleSize || 0;

    // Extract counts from aggregation result
    const stats = result[0] || {
      totalResponses: 0,
      capiResponses: 0,
      catiResponses: 0
    };

    // Return only the 4 required stats
    res.status(200).json({
      success: true,
      data: {
        totalResponses: stats.totalResponses,
        sampleSize: sampleSize,
        capiResponses: stats.capiResponses,
        catiResponses: stats.catiResponses
      }
    });

  } catch (error) {
    console.error('Get survey analytics V2 error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get AC-wise stats (optimized for big data)
// @route   GET /api/surveys/:id/ac-wise-stats-v2
// @access  Private (Company Admin, Project Manager)
exports.getACWiseStatsV2 = async (req, res) => {
  try {
    const surveyId = req.params.id || req.params.surveyId;
    const {
      dateRange,
      startDate,
      endDate,
      status,
      interviewMode,
      ac,
      district,
      lokSabha,
      interviewerIds,
      interviewerMode = 'include'
    } = req.query;

    // Verify survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Build match filter for MongoDB aggregation (NO LIMITS - handles millions of records)
    const matchFilter = { survey: mongoose.Types.ObjectId.isValid(surveyId) ? new mongoose.Types.ObjectId(surveyId) : surveyId };

    // Status filter
    if (status && status !== 'all') {
      if (status === 'approved_rejected_pending') {
        matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
      } else if (status === 'approved_pending') {
        matchFilter.status = { $in: ['Approved', 'Pending_Approval'] };
      } else if (status === 'pending') {
        matchFilter.status = 'Pending_Approval';
      } else {
        matchFilter.status = status;
      }
    } else {
      matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
    }

    // Interview mode filter
    if (interviewMode) {
      matchFilter.interviewMode = interviewMode.toLowerCase();
    }

    // Date range filter (using IST timezone)
    // If dateRange is 'custom', ignore it and use startDate/endDate instead
    if (dateRange && dateRange !== 'all' && dateRange !== 'custom') {
      const istOffset = 5.5 * 60 * 60 * 1000; // IST offset: 5.5 hours
      let dateStart, dateEnd;

      switch (dateRange) {
        case 'today':
          // Get today's date in IST, convert to UTC
          const todayIST = getISTDateString();
          dateStart = getISTDateStartUTC(todayIST);
          dateEnd = getISTDateEndUTC(todayIST);
          break;
        case 'yesterday':
          // Get yesterday's date in IST
          const now = new Date();
          const istTime = new Date(now.getTime() + istOffset);
          istTime.setUTCDate(istTime.getUTCDate() - 1);
          const yesterdayISTStr = getISTDateStringFromDate(new Date(istTime.getTime() - istOffset));
          dateStart = getISTDateStartUTC(yesterdayISTStr);
          dateEnd = getISTDateEndUTC(yesterdayISTStr);
          break;
        case 'week':
          // Get date 7 days ago in IST
          const nowWeek = new Date();
          const istTimeWeek = new Date(nowWeek.getTime() + istOffset);
          istTimeWeek.setUTCDate(istTimeWeek.getUTCDate() - 7);
          const weekAgoISTStr = getISTDateStringFromDate(new Date(istTimeWeek.getTime() - istOffset));
          const todayISTStr = getISTDateString();
          dateStart = getISTDateStartUTC(weekAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr);
          break;
        case 'month':
          // Get date 30 days ago in IST
          const nowMonth = new Date();
          const istTimeMonth = new Date(nowMonth.getTime() + istOffset);
          istTimeMonth.setUTCDate(istTimeMonth.getUTCDate() - 30);
          const monthAgoISTStr = getISTDateStringFromDate(new Date(istTimeMonth.getTime() - istOffset));
          const todayISTStr2 = getISTDateString();
          dateStart = getISTDateStartUTC(monthAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr2);
          break;
      }

      if (dateStart && dateEnd) {
        matchFilter.createdAt = { $gte: dateStart, $lte: dateEnd };
      }
    }
    
    // Custom date range - parse as IST dates (check this separately to allow override)
    if (startDate || endDate) {
      let dateStart, dateEnd;
      // Handle single day selection (startDate === endDate) or date range
      if (startDate && endDate) {
        // Both dates provided - date range
        dateStart = getISTDateStartUTC(startDate);
        dateEnd = getISTDateEndUTC(endDate);
      } else if (startDate && !endDate) {
        // Only start date provided - from start date to end of that day
        dateStart = getISTDateStartUTC(startDate);
        dateEnd = getISTDateEndUTC(startDate);
      } else if (!startDate && endDate) {
        // Only end date provided - from beginning of that day to end date
        dateStart = getISTDateStartUTC(endDate);
        dateEnd = getISTDateEndUTC(endDate);
      }
      
      if (dateStart && dateEnd) {
        // Override any dateRange filter with custom dates
        matchFilter.createdAt = { $gte: dateStart, $lte: dateEnd };
      }
    }

    // Interviewer filter - Handle both array and single value from query params
    let interviewerIdsArray = [];
    if (interviewerIds) {
      if (Array.isArray(interviewerIds)) {
        interviewerIdsArray = interviewerIds;
      } else if (typeof interviewerIds === 'string') {
        interviewerIdsArray = interviewerIds.split(',').map(id => id.trim()).filter(id => id);
      }
    }

    if (interviewerIdsArray.length > 0) {
      const interviewerObjectIds = interviewerIdsArray
        .filter(id => id && id !== 'undefined' && id !== 'null')
        .map(id => {
          if (mongoose.Types.ObjectId.isValid(id)) {
            return new mongoose.Types.ObjectId(id);
          }
          return id;
        })
        .filter(id => id);

      if (interviewerObjectIds.length > 0) {
        if (interviewerMode === 'exclude') {
          matchFilter.interviewer = { $nin: interviewerObjectIds };
        } else {
          matchFilter.interviewer = { $in: interviewerObjectIds };
        }
      }
    }

    // For project managers: filter by assigned interviewers
    if (req.user.userType === 'project_manager') {
      const currentUser = await User.findById(req.user.id).populate('assignedTeamMembers.user', '_id userType');
      if (currentUser && currentUser.assignedTeamMembers && currentUser.assignedTeamMembers.length > 0) {
        // Extract interviewer IDs from assignedTeamMembers structure
        // assignedTeamMembers is an array of objects: [{ userType: 'interviewer', user: ObjectId or User object }, ...]
        const assignedIds = currentUser.assignedTeamMembers
          .filter(tm => tm.userType === 'interviewer' && tm.user)
          .map(tm => {
            // Handle both ObjectId and populated user object
            const userId = tm.user._id ? tm.user._id : tm.user;
            return mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
          })
          .filter(id => id && mongoose.Types.ObjectId.isValid(id));
        
        if (assignedIds.length > 0) {
          if (!matchFilter.interviewer) {
            matchFilter.interviewer = { $in: assignedIds };
            console.log(`🔍 getACWiseStatsV2 - Project Manager: Filtering by ${assignedIds.length} assigned interviewer(s)`);
          } else if (matchFilter.interviewer.$in) {
            const originalIds = matchFilter.interviewer.$in;
            matchFilter.interviewer.$in = originalIds.filter(id => {
              const idStr = id.toString();
              return assignedIds.some(assignedId => assignedId.toString() === idStr);
            });
            console.log(`🔍 getACWiseStatsV2 - Project Manager: Intersected ${originalIds.length} selected with ${assignedIds.length} assigned, result: ${matchFilter.interviewer.$in.length} interviewer(s)`);
          } else if (matchFilter.interviewer.$nin) {
            const excludedIds = matchFilter.interviewer.$nin;
            const assignedIdsStr = assignedIds.map(id => id.toString());
            matchFilter.interviewer.$nin = excludedIds.filter(id => assignedIdsStr.includes(id.toString()));
            console.log(`🔍 getACWiseStatsV2 - Project Manager: Excluding ${matchFilter.interviewer.$nin.length} interviewer(s) from assigned list`);
          }
        } else {
          // No assigned interviewers found, return empty results
          console.log(`⚠️ getACWiseStatsV2 - Project Manager: No valid assigned interviewers found`);
          matchFilter.interviewer = { $in: [] }; // Empty array will return no results
        }
      } else {
        // No assigned team members, return empty results
        console.log(`⚠️ getACWiseStatsV2 - Project Manager: No assigned team members`);
        matchFilter.interviewer = { $in: [] }; // Empty array will return no results
      }
    }

    // Build aggregation pipeline - pure MongoDB aggregation
    const pipeline = [];

    // Stage 1: Match filtered responses
    pipeline.push({ $match: matchFilter });

    // Stage 2: Add fields for AC extraction and polling station key
    pipeline.push({
      $addFields: {
        // Extract AC from selectedAC or selectedPollingStation (simple and fast)
        extractedAC: {
          $ifNull: [
            '$selectedAC',
            '$selectedPollingStation.acName'
          ]
        },
        // Create polling station key for PS Covered calculation
        pollingStationKey: {
          $concat: [
            { $ifNull: ['$selectedPollingStation.stationName', ''] },
            '-',
            { $ifNull: ['$selectedPollingStation.groupName', ''] }
          ]
        },
        // Extract AC code from selectedPollingStation
        extractedACCode: {
          $ifNull: [
            '$selectedPollingStation.acNo',
            null
          ]
        },
        // Extract PC code and name from selectedPollingStation
        extractedPCCode: {
          $ifNull: [
            '$selectedPollingStation.pcNo',
            null
          ]
        },
        extractedPCName: {
          $ifNull: [
            '$selectedPollingStation.pcName',
            null
          ]
        }
      }
    });

    // Stage 3: Filter by AC if provided
    if (ac && ac.trim()) {
      const acPattern = ac.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pipeline.push({
        $match: {
          $or: [
            { extractedAC: { $regex: acPattern, $options: 'i' } },
            { 'selectedPollingStation.acName': { $regex: acPattern, $options: 'i' } }
          ]
        }
      });
    }

    // Stage 4: Group by AC for AC stats
    pipeline.push({
      $group: {
        _id: {
          $ifNull: ['$extractedAC', 'N/A']
        },
        total: { $sum: 1 },
        capi: {
          $sum: {
            $cond: [{ $eq: [{ $toUpper: { $ifNull: ['$interviewMode', ''] } }, 'CAPI'] }, 1, 0]
          }
        },
        cati: {
          $sum: {
            $cond: [{ $eq: [{ $toUpper: { $ifNull: ['$interviewMode', ''] } }, 'CATI'] }, 1, 0]
          }
        },
        approved: {
          $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] }
        },
        autoRejected: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'Rejected'] },
                  {
                    $or: [
                      { $eq: ['$verificationData.autoRejected', true] },
                      { $gt: [{ $size: { $ifNull: ['$verificationData.autoRejectionReasons', []] } }, 0] },
                      // Also check feedback field for auto-rejection patterns (matches current reports page logic)
                      {
                        $and: [
                          { $ne: ['$verificationData.feedback', null] },
                          {
                            $or: [
                              { $regexMatch: { input: { $ifNull: ['$verificationData.feedback', ''] }, regex: 'Interview Too Short', options: 'i' } },
                              { $regexMatch: { input: { $ifNull: ['$verificationData.feedback', ''] }, regex: 'Not Voter', options: 'i' } },
                              { $regexMatch: { input: { $ifNull: ['$verificationData.feedback', ''] }, regex: 'Not a Registered Voter', options: 'i' } },
                              { $regexMatch: { input: { $ifNull: ['$verificationData.feedback', ''] }, regex: 'Duplicate Response', options: 'i' } }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              1,
              0
            ]
          }
        },
        manualRejected: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'Rejected'] },
                  {
                    $and: [
                      { $ne: ['$verificationData.autoRejected', true] },
                      { $eq: [{ $size: { $ifNull: ['$verificationData.autoRejectionReasons', []] } }, 0] },
                      // Not matching auto-rejection feedback patterns
                      {
                        $or: [
                          { $eq: ['$verificationData.feedback', null] },
                          {
                            $and: [
                              { $not: { $regexMatch: { input: { $ifNull: ['$verificationData.feedback', ''] }, regex: 'Interview Too Short', options: 'i' } } },
                              { $not: { $regexMatch: { input: { $ifNull: ['$verificationData.feedback', ''] }, regex: 'Not Voter', options: 'i' } } },
                              { $not: { $regexMatch: { input: { $ifNull: ['$verificationData.feedback', ''] }, regex: 'Not a Registered Voter', options: 'i' } } },
                              { $not: { $regexMatch: { input: { $ifNull: ['$verificationData.feedback', ''] }, regex: 'Duplicate Response', options: 'i' } } }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              1,
              0
            ]
          }
        },
        underQC: {
          $sum: { $cond: [{ $eq: ['$status', 'Pending_Approval'] }, 1, 0] }
        },
        pollingStations: { $addToSet: '$pollingStationKey' },
        interviewers: { $addToSet: '$interviewer' },
        acCodes: { $addToSet: '$extractedACCode' },
        pcCodes: { $addToSet: '$extractedPCCode' },
        pcNames: { $addToSet: '$extractedPCName' }
      }
    });

    // Stage 5: Project final fields
    pipeline.push({
      $project: {
        _id: 0,
        ac: '$_id',
        completedInterviews: '$total',
        capi: '$capi',
        cati: '$cati',
        approved: '$approved',
        rejected: '$manualRejected',
        autoRejected: '$autoRejected',
        underQC: '$underQC',
        interviewersCount: { $size: { $filter: { input: { $ifNull: ['$interviewers', []] }, cond: { $ne: ['$$this', null] } } } },
        psCovered: { $size: { $filter: { input: { $ifNull: ['$pollingStations', []] }, cond: { $ne: ['$$this', null] } } } },
        acCode: { $arrayElemAt: [{ $filter: { input: '$acCodes', cond: { $ne: ['$$this', null] } } }, 0] },
        pcCode: { $arrayElemAt: [{ $filter: { input: '$pcCodes', cond: { $ne: ['$$this', null] } } }, 0] },
        pcName: { $arrayElemAt: [{ $filter: { input: '$pcNames', cond: { $ne: ['$$this', null] } } }, 0] }
      }
    });

    // Stage 6: Sort by completed interviews (descending)
    pipeline.push({
      $sort: { completedInterviews: -1 }
    });

    // Execute aggregation with performance optimizations
    const acStats = await SurveyResponse.aggregate(pipeline, {
      allowDiskUse: true,
      maxTimeMS: 300000 // 5 minutes timeout
    });

    // Calculate countsAfterRejection for each AC
    const acStatsWithCalculations = acStats.map(stat => ({
      ...stat,
      countsAfterRejection: Math.max(0, stat.completedInterviews - stat.autoRejected),
      gpsPending: 0, // Not calculated yet
      gpsFail: 0 // Not calculated yet
    }));

    res.status(200).json({
      success: true,
      data: acStatsWithCalculations
    });
  } catch (error) {
    console.error('Get AC-wise stats V2 error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get Interviewer-wise stats (optimized for big data)
// @route   GET /api/surveys/:id/interviewer-wise-stats-v2
// @access  Private (Company Admin, Project Manager)
exports.getInterviewerWiseStatsV2 = async (req, res) => {
  try {
    const surveyId = req.params.id || req.params.surveyId;
    const {
      dateRange,
      startDate,
      endDate,
      status,
      interviewMode,
      ac,
      district,
      lokSabha,
      interviewerIds,
      interviewerMode = 'include'
    } = req.query;

    // Verify survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Build match filter for MongoDB aggregation (NO LIMITS - handles millions of records)
    const matchFilter = { survey: mongoose.Types.ObjectId.isValid(surveyId) ? new mongoose.Types.ObjectId(surveyId) : surveyId };

    // Status filter
    if (status && status !== 'all') {
      if (status === 'approved_rejected_pending') {
        matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
      } else if (status === 'approved_pending') {
        matchFilter.status = { $in: ['Approved', 'Pending_Approval'] };
      } else if (status === 'pending') {
        matchFilter.status = 'Pending_Approval';
      } else {
        matchFilter.status = status;
      }
    } else {
      matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
    }

    // Interview mode filter
    if (interviewMode) {
      matchFilter.interviewMode = interviewMode.toLowerCase();
    }

    // Date range filter (using IST timezone)
    // If dateRange is 'custom', ignore it and use startDate/endDate instead
    if (dateRange && dateRange !== 'all' && dateRange !== 'custom') {
      const istOffset = 5.5 * 60 * 60 * 1000; // IST offset: 5.5 hours
      let dateStart, dateEnd;

      switch (dateRange) {
        case 'today':
          // Get today's date in IST, convert to UTC
          const todayIST = getISTDateString();
          dateStart = getISTDateStartUTC(todayIST);
          dateEnd = getISTDateEndUTC(todayIST);
          break;
        case 'yesterday':
          // Get yesterday's date in IST
          const now = new Date();
          const istTime = new Date(now.getTime() + istOffset);
          istTime.setUTCDate(istTime.getUTCDate() - 1);
          const yesterdayISTStr = getISTDateStringFromDate(new Date(istTime.getTime() - istOffset));
          dateStart = getISTDateStartUTC(yesterdayISTStr);
          dateEnd = getISTDateEndUTC(yesterdayISTStr);
          break;
        case 'week':
          // Get date 7 days ago in IST
          const nowWeek = new Date();
          const istTimeWeek = new Date(nowWeek.getTime() + istOffset);
          istTimeWeek.setUTCDate(istTimeWeek.getUTCDate() - 7);
          const weekAgoISTStr = getISTDateStringFromDate(new Date(istTimeWeek.getTime() - istOffset));
          const todayISTStr = getISTDateString();
          dateStart = getISTDateStartUTC(weekAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr);
          break;
        case 'month':
          // Get date 30 days ago in IST
          const nowMonth = new Date();
          const istTimeMonth = new Date(nowMonth.getTime() + istOffset);
          istTimeMonth.setUTCDate(istTimeMonth.getUTCDate() - 30);
          const monthAgoISTStr = getISTDateStringFromDate(new Date(istTimeMonth.getTime() - istOffset));
          const todayISTStr2 = getISTDateString();
          dateStart = getISTDateStartUTC(monthAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr2);
          break;
      }

      if (dateStart && dateEnd) {
        matchFilter.createdAt = { $gte: dateStart, $lte: dateEnd };
      }
    }
    
    // Custom date range - parse as IST dates (check this separately to allow override)
    if (startDate || endDate) {
      let dateStart, dateEnd;
      // Handle single day selection (startDate === endDate) or date range
      if (startDate && endDate) {
        // Both dates provided - date range
        dateStart = getISTDateStartUTC(startDate);
        dateEnd = getISTDateEndUTC(endDate);
      } else if (startDate && !endDate) {
        // Only start date provided - from start date to end of that day
        dateStart = getISTDateStartUTC(startDate);
        dateEnd = getISTDateEndUTC(startDate);
      } else if (!startDate && endDate) {
        // Only end date provided - from beginning of that day to end date
        dateStart = getISTDateStartUTC(endDate);
        dateEnd = getISTDateEndUTC(endDate);
      }
      
      if (dateStart && dateEnd) {
        // Override any dateRange filter with custom dates
        matchFilter.createdAt = { $gte: dateStart, $lte: dateEnd };
      }
    }

    // Interviewer filter - Handle both array and single value from query params
    let interviewerIdsArray = [];
    if (interviewerIds) {
      if (Array.isArray(interviewerIds)) {
        interviewerIdsArray = interviewerIds;
      } else if (typeof interviewerIds === 'string') {
        interviewerIdsArray = interviewerIds.split(',').map(id => id.trim()).filter(id => id);
      }
    }

    if (interviewerIdsArray.length > 0) {
      const interviewerObjectIds = interviewerIdsArray
        .filter(id => id && id !== 'undefined' && id !== 'null')
        .map(id => {
          if (mongoose.Types.ObjectId.isValid(id)) {
            return new mongoose.Types.ObjectId(id);
          }
          return id;
        })
        .filter(id => id);

      if (interviewerObjectIds.length > 0) {
        if (interviewerMode === 'exclude') {
          matchFilter.interviewer = { $nin: interviewerObjectIds };
        } else {
          matchFilter.interviewer = { $in: interviewerObjectIds };
        }
      }
    }

    // For project managers: filter by assigned interviewers
    if (req.user.userType === 'project_manager') {
      const currentUser = await User.findById(req.user.id).populate('assignedTeamMembers.user', '_id userType');
      if (currentUser && currentUser.assignedTeamMembers && currentUser.assignedTeamMembers.length > 0) {
        // Extract interviewer IDs from assignedTeamMembers structure
        // assignedTeamMembers is an array of objects: [{ userType: 'interviewer', user: ObjectId or User object }, ...]
        const assignedIds = currentUser.assignedTeamMembers
          .filter(tm => tm.userType === 'interviewer' && tm.user)
          .map(tm => {
            // Handle both ObjectId and populated user object
            const userId = tm.user._id ? tm.user._id : tm.user;
            return mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
          })
          .filter(id => id && mongoose.Types.ObjectId.isValid(id));
        
        if (assignedIds.length > 0) {
          if (!matchFilter.interviewer) {
            matchFilter.interviewer = { $in: assignedIds };
            console.log(`🔍 getACWiseStatsV2 - Project Manager: Filtering by ${assignedIds.length} assigned interviewer(s)`);
          } else if (matchFilter.interviewer.$in) {
            const originalIds = matchFilter.interviewer.$in;
            matchFilter.interviewer.$in = originalIds.filter(id => {
              const idStr = id.toString();
              return assignedIds.some(assignedId => assignedId.toString() === idStr);
            });
            console.log(`🔍 getACWiseStatsV2 - Project Manager: Intersected ${originalIds.length} selected with ${assignedIds.length} assigned, result: ${matchFilter.interviewer.$in.length} interviewer(s)`);
          } else if (matchFilter.interviewer.$nin) {
            const excludedIds = matchFilter.interviewer.$nin;
            const assignedIdsStr = assignedIds.map(id => id.toString());
            matchFilter.interviewer.$nin = excludedIds.filter(id => assignedIdsStr.includes(id.toString()));
            console.log(`🔍 getACWiseStatsV2 - Project Manager: Excluding ${matchFilter.interviewer.$nin.length} interviewer(s) from assigned list`);
          }
        } else {
          // No assigned interviewers found, return empty results
          console.log(`⚠️ getACWiseStatsV2 - Project Manager: No valid assigned interviewers found`);
          matchFilter.interviewer = { $in: [] }; // Empty array will return no results
        }
      } else {
        // No assigned team members, return empty results
        console.log(`⚠️ getACWiseStatsV2 - Project Manager: No assigned team members`);
        matchFilter.interviewer = { $in: [] }; // Empty array will return no results
      }
    }

    // Build aggregation pipeline - pure MongoDB aggregation
    const pipeline = [];

    // Stage 1: Match filtered responses
    pipeline.push({ $match: matchFilter });

    // Stage 2: Add fields for polling station key
    pipeline.push({
      $addFields: {
        // Create polling station key for PS Covered calculation
        pollingStationKey: {
          $concat: [
            { $ifNull: ['$selectedPollingStation.stationName', ''] },
            '-',
            { $ifNull: ['$selectedPollingStation.groupName', ''] }
          ]
        }
      }
    });

    // Stage 3: Filter by AC if provided
    if (ac && ac.trim()) {
      const acPattern = ac.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pipeline.push({
        $match: {
          $or: [
            { selectedAC: { $regex: acPattern, $options: 'i' } },
            { 'selectedPollingStation.acName': { $regex: acPattern, $options: 'i' } }
          ]
        }
      });
    }

    // Stage 4: Lookup interviewer details
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'interviewer',
        foreignField: '_id',
        as: 'interviewerDetails'
      }
    });

    // Stage 5: Unwind interviewer details
    pipeline.push({
      $unwind: {
        path: '$interviewerDetails',
        preserveNullAndEmptyArrays: true
      }
    });

    // Stage 6: Group by interviewer for interviewer stats
    pipeline.push({
      $group: {
        _id: '$interviewer',
        total: { $sum: 1 },
        capi: {
          $sum: {
            $cond: [{ $eq: [{ $toUpper: { $ifNull: ['$interviewMode', ''] } }, 'CAPI'] }, 1, 0]
          }
        },
        cati: {
          $sum: {
            $cond: [{ $eq: [{ $toUpper: { $ifNull: ['$interviewMode', ''] } }, 'CATI'] }, 1, 0]
          }
        },
        approved: {
          $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] }
        },
        autoRejected: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'Rejected'] },
                  {
                    $or: [
                      { $eq: ['$verificationData.autoRejected', true] },
                      { $gt: [{ $size: { $ifNull: ['$verificationData.autoRejectionReasons', []] } }, 0] },
                      // Also check feedback field for auto-rejection patterns
                      {
                        $and: [
                          { $ne: ['$verificationData.feedback', null] },
                          {
                            $or: [
                              { $regexMatch: { input: { $ifNull: ['$verificationData.feedback', ''] }, regex: 'Interview Too Short', options: 'i' } },
                              { $regexMatch: { input: { $ifNull: ['$verificationData.feedback', ''] }, regex: 'Not Voter', options: 'i' } },
                              { $regexMatch: { input: { $ifNull: ['$verificationData.feedback', ''] }, regex: 'Not a Registered Voter', options: 'i' } },
                              { $regexMatch: { input: { $ifNull: ['$verificationData.feedback', ''] }, regex: 'Duplicate Response', options: 'i' } }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              1,
              0
            ]
          }
        },
        manualRejected: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'Rejected'] },
                  {
                    $and: [
                      { $ne: ['$verificationData.autoRejected', true] },
                      { $eq: [{ $size: { $ifNull: ['$verificationData.autoRejectionReasons', []] } }, 0] },
                      // Not matching auto-rejection feedback patterns
                      {
                        $or: [
                          { $eq: ['$verificationData.feedback', null] },
                          {
                            $and: [
                              { $not: { $regexMatch: { input: { $ifNull: ['$verificationData.feedback', ''] }, regex: 'Interview Too Short', options: 'i' } } },
                              { $not: { $regexMatch: { input: { $ifNull: ['$verificationData.feedback', ''] }, regex: 'Not Voter', options: 'i' } } },
                              { $not: { $regexMatch: { input: { $ifNull: ['$verificationData.feedback', ''] }, regex: 'Not a Registered Voter', options: 'i' } } },
                              { $not: { $regexMatch: { input: { $ifNull: ['$verificationData.feedback', ''] }, regex: 'Duplicate Response', options: 'i' } } }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              1,
              0
            ]
          }
        },
        underQC: {
          $sum: { $cond: [{ $eq: ['$status', 'Pending_Approval'] }, 1, 0] }
        },
        pollingStations: { $addToSet: '$pollingStationKey' },
        interviewerName: { $first: { $concat: ['$interviewerDetails.firstName', ' ', '$interviewerDetails.lastName'] } },
        interviewerMemberId: { $first: '$interviewerDetails.memberId' }
      }
    });

    // Stage 7: Project final fields
    pipeline.push({
      $project: {
        _id: 0,
        interviewerId: '$_id',
        interviewer: '$interviewerName',
        memberId: '$interviewerMemberId',
        completedInterviews: '$total',
        capi: '$capi',
        cati: '$cati',
        approved: '$approved',
        rejected: '$manualRejected',
        autoRejected: '$autoRejected',
        underQC: '$underQC',
        psCovered: { $size: { $filter: { input: { $ifNull: ['$pollingStations', []] }, cond: { $ne: ['$$this', null] } } } }
      }
    });

    // Stage 8: Sort by completed interviews (descending)
    pipeline.push({
      $sort: { completedInterviews: -1 }
    });

    // Execute aggregation
    const interviewerStats = await SurveyResponse.aggregate(pipeline);

    // Calculate countsAfterRejection for each interviewer
    const interviewerStatsWithCalculations = interviewerStats.map(stat => ({
      ...stat,
      countsAfterRejection: Math.max(0, stat.completedInterviews - stat.autoRejected),
      gpsPending: 0, // Not calculated yet
      gpsFail: 0 // Not calculated yet
    }));

    res.status(200).json({
      success: true,
      data: interviewerStatsWithCalculations
    });
  } catch (error) {
    console.error('Get Interviewer-wise stats V2 error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get Chart Data (optimized for big data - daily stats only for performance)
// @route   GET /api/surveys/:id/chart-data-v2
// @access  Private (Company Admin, Project Manager)
exports.getChartDataV2 = async (req, res) => {
  try {
    const surveyId = req.params.id || req.params.surveyId;
    const {
      dateRange,
      startDate,
      endDate,
      status,
      interviewMode,
      ac,
      district,
      lokSabha,
      interviewerIds,
      interviewerMode = 'include'
    } = req.query;

    // Verify survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Build match filter for MongoDB aggregation (NO LIMITS - handles millions of records)
    const matchFilter = { survey: mongoose.Types.ObjectId.isValid(surveyId) ? new mongoose.Types.ObjectId(surveyId) : surveyId };

    // Status filter
    if (status && status !== 'all') {
      if (status === 'approved_rejected_pending') {
        matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
      } else if (status === 'approved_pending') {
        matchFilter.status = { $in: ['Approved', 'Pending_Approval'] };
      } else if (status === 'pending') {
        matchFilter.status = 'Pending_Approval';
      } else {
        matchFilter.status = status;
      }
    } else {
      matchFilter.status = { $in: ['Approved', 'Rejected', 'Pending_Approval'] };
    }

    // Interview mode filter
    if (interviewMode) {
      matchFilter.interviewMode = interviewMode.toLowerCase();
    }

    // Date range filter (using IST timezone)
    // If dateRange is 'custom', ignore it and use startDate/endDate instead
    if (dateRange && dateRange !== 'all' && dateRange !== 'custom') {
      const istOffset = 5.5 * 60 * 60 * 1000; // IST offset: 5.5 hours
      let dateStart, dateEnd;

      switch (dateRange) {
        case 'today':
          // Get today's date in IST, convert to UTC
          const todayIST = getISTDateString();
          dateStart = getISTDateStartUTC(todayIST);
          dateEnd = getISTDateEndUTC(todayIST);
          break;
        case 'yesterday':
          // Get yesterday's date in IST
          const now = new Date();
          const istTime = new Date(now.getTime() + istOffset);
          istTime.setUTCDate(istTime.getUTCDate() - 1);
          const yesterdayISTStr = getISTDateStringFromDate(new Date(istTime.getTime() - istOffset));
          dateStart = getISTDateStartUTC(yesterdayISTStr);
          dateEnd = getISTDateEndUTC(yesterdayISTStr);
          break;
        case 'week':
          // Get date 7 days ago in IST
          const nowWeek = new Date();
          const istTimeWeek = new Date(nowWeek.getTime() + istOffset);
          istTimeWeek.setUTCDate(istTimeWeek.getUTCDate() - 7);
          const weekAgoISTStr = getISTDateStringFromDate(new Date(istTimeWeek.getTime() - istOffset));
          const todayISTStr = getISTDateString();
          dateStart = getISTDateStartUTC(weekAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr);
          break;
        case 'month':
          // Get date 30 days ago in IST
          const nowMonth = new Date();
          const istTimeMonth = new Date(nowMonth.getTime() + istOffset);
          istTimeMonth.setUTCDate(istTimeMonth.getUTCDate() - 30);
          const monthAgoISTStr = getISTDateStringFromDate(new Date(istTimeMonth.getTime() - istOffset));
          const todayISTStr2 = getISTDateString();
          dateStart = getISTDateStartUTC(monthAgoISTStr);
          dateEnd = getISTDateEndUTC(todayISTStr2);
          break;
      }

      if (dateStart && dateEnd) {
        matchFilter.createdAt = { $gte: dateStart, $lte: dateEnd };
      }
    }
    
    // Custom date range - parse as IST dates (check this separately to allow override)
    if (startDate || endDate) {
      let dateStart, dateEnd;
      // Handle single day selection (startDate === endDate) or date range
      if (startDate && endDate) {
        // Both dates provided - date range
        dateStart = getISTDateStartUTC(startDate);
        dateEnd = getISTDateEndUTC(endDate);
      } else if (startDate && !endDate) {
        // Only start date provided - from start date to end of that day
        dateStart = getISTDateStartUTC(startDate);
        dateEnd = getISTDateEndUTC(startDate);
      } else if (!startDate && endDate) {
        // Only end date provided - from beginning of that day to end date
        dateStart = getISTDateStartUTC(endDate);
        dateEnd = getISTDateEndUTC(endDate);
      }
      
      if (dateStart && dateEnd) {
        // Override any dateRange filter with custom dates
        matchFilter.createdAt = { $gte: dateStart, $lte: dateEnd };
      }
    }

    // Interviewer filter
    let interviewerIdsArray = [];
    if (interviewerIds) {
      if (Array.isArray(interviewerIds)) {
        interviewerIdsArray = interviewerIds;
      } else if (typeof interviewerIds === 'string') {
        interviewerIdsArray = interviewerIds.split(',').map(id => id.trim()).filter(id => id);
      }
    }

    if (interviewerIdsArray.length > 0) {
      const interviewerObjectIds = interviewerIdsArray
        .filter(id => id && id !== 'undefined' && id !== 'null')
        .map(id => {
          if (mongoose.Types.ObjectId.isValid(id)) {
            return new mongoose.Types.ObjectId(id);
          }
          return id;
        })
        .filter(id => id);

      if (interviewerObjectIds.length > 0) {
        if (interviewerMode === 'exclude') {
          matchFilter.interviewer = { $nin: interviewerObjectIds };
        } else {
          matchFilter.interviewer = { $in: interviewerObjectIds };
        }
      }
    }

    // For project managers: filter by assigned interviewers
    if (req.user.userType === 'project_manager') {
      const currentUser = await User.findById(req.user.id).populate('assignedTeamMembers.user', '_id userType');
      if (currentUser && currentUser.assignedTeamMembers && currentUser.assignedTeamMembers.length > 0) {
        // Extract interviewer IDs from assignedTeamMembers structure
        // assignedTeamMembers is an array of objects: [{ userType: 'interviewer', user: ObjectId or User object }, ...]
        const assignedIds = currentUser.assignedTeamMembers
          .filter(tm => tm.userType === 'interviewer' && tm.user)
          .map(tm => {
            // Handle both ObjectId and populated user object
            const userId = tm.user._id ? tm.user._id : tm.user;
            return mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
          })
          .filter(id => id && mongoose.Types.ObjectId.isValid(id));
        
        if (assignedIds.length > 0) {
          if (!matchFilter.interviewer) {
            matchFilter.interviewer = { $in: assignedIds };
            console.log(`🔍 getACWiseStatsV2 - Project Manager: Filtering by ${assignedIds.length} assigned interviewer(s)`);
          } else if (matchFilter.interviewer.$in) {
            const originalIds = matchFilter.interviewer.$in;
            matchFilter.interviewer.$in = originalIds.filter(id => {
              const idStr = id.toString();
              return assignedIds.some(assignedId => assignedId.toString() === idStr);
            });
            console.log(`🔍 getACWiseStatsV2 - Project Manager: Intersected ${originalIds.length} selected with ${assignedIds.length} assigned, result: ${matchFilter.interviewer.$in.length} interviewer(s)`);
          } else if (matchFilter.interviewer.$nin) {
            const excludedIds = matchFilter.interviewer.$nin;
            const assignedIdsStr = assignedIds.map(id => id.toString());
            matchFilter.interviewer.$nin = excludedIds.filter(id => assignedIdsStr.includes(id.toString()));
            console.log(`🔍 getACWiseStatsV2 - Project Manager: Excluding ${matchFilter.interviewer.$nin.length} interviewer(s) from assigned list`);
          }
        } else {
          // No assigned interviewers found, return empty results
          console.log(`⚠️ getACWiseStatsV2 - Project Manager: No valid assigned interviewers found`);
          matchFilter.interviewer = { $in: [] }; // Empty array will return no results
        }
      } else {
        // No assigned team members, return empty results
        console.log(`⚠️ getACWiseStatsV2 - Project Manager: No assigned team members`);
        matchFilter.interviewer = { $in: [] }; // Empty array will return no results
      }
    }

    // Daily Stats Pipeline (optimized - only daily stats, no gender/age for performance)
    // MongoDB 7.0 fix: Ensure createdAt is properly converted to Date before using $dateToString
    const dailyStatsPipeline = [
      { $match: matchFilter },
      {
        $addFields: {
          createdAtDate: {
            $cond: {
              if: { $eq: [{ $type: '$createdAt' }, 'date'] },
              then: '$createdAt',
              else: {
                $cond: {
                  if: { $eq: [{ $type: '$createdAt' }, 'string'] },
                  then: {
                    $dateFromString: {
                      dateString: '$createdAt',
                      onError: new Date(0) // Fallback to epoch if conversion fails
                    }
                  },
                  else: new Date(0) // Fallback for other types
                }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAtDate',
              timezone: 'Asia/Kolkata' // Use IST timezone
            }
          },
          count: { $sum: 1 },
          capi: {
            $sum: {
              $cond: [{ $eq: [{ $toUpper: { $ifNull: ['$interviewMode', ''] } }, 'CAPI'] }, 1, 0]
            }
          },
          cati: {
            $sum: {
              $cond: [{ $eq: [{ $toUpper: { $ifNull: ['$interviewMode', ''] } }, 'CATI'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          count: 1,
          capi: 1,
          cati: 1
        }
      }
    ];

    // Execute daily stats pipeline only (removed gender/age for performance)
    const dailyStats = await SurveyResponse.aggregate(dailyStatsPipeline);

    res.status(200).json({
      success: true,
      data: {
        dailyStats
      }
    });
  } catch (error) {
    console.error('Get Chart Data V2 error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Export multer middleware for use in routes
exports.uploadRespondentContactsMiddleware = upload.single('file');
