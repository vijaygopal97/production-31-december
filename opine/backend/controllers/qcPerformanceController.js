const SurveyResponse = require('../models/SurveyResponse');
const Survey = require('../models/Survey');
const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Get QC Performance for a specific survey (all quality agents)
// @route   GET /api/qc-performance/survey/:surveyId
// @access  Private (Company Admin)
exports.getQCPerformanceBySurvey = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { 
      startDate, 
      endDate,
      search,
      qualityAgentIds // Filter by quality agent IDs (for project managers)
    } = req.query;

    // Verify the survey belongs to the company
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Check if user has access to this survey
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
        message: 'Access denied. You can only view QC performance for surveys from your company.'
      });
    }

    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter['verificationData.reviewedAt'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Base filter for responses reviewed for this survey
    const baseFilter = {
      survey: new mongoose.Types.ObjectId(surveyId),
      'verificationData.reviewer': { $exists: true, $ne: null },
      ...dateFilter
    };

    // Get all quality agents assigned to this survey
    const assignedQualityAgentIds = [];
    const qualityAgentAssignmentsMap = {}; // Map to store assignedACs for each quality agent
    if (survey.assignedQualityAgents && Array.isArray(survey.assignedQualityAgents)) {
      survey.assignedQualityAgents.forEach(assignment => {
        if (assignment.qualityAgent) {
          const qaId = new mongoose.Types.ObjectId(assignment.qualityAgent);
          assignedQualityAgentIds.push(qaId);
          // Store assignedACs for this quality agent
          qualityAgentAssignmentsMap[qaId.toString()] = {
            assignedACs: assignment.assignedACs || [],
            selectedState: assignment.selectedState,
            selectedCountry: assignment.selectedCountry
          };
        }
      });
    }

    // Aggregate to get quality agent performance (only for those who have reviewed)
    const qcPerformance = await SurveyResponse.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: '$verificationData.reviewer',
          totalReviews: { $sum: 1 },
          approvedResponses: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
          },
          rejectedResponses: {
            $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] }
          }
        }
      }
    ]);

    // Create a map of performance data by reviewer ID
    const performanceMap = {};
    qcPerformance.forEach(perf => {
      const reviewerId = perf._id.toString();
      performanceMap[reviewerId] = {
        totalReviews: perf.totalReviews,
        approvedResponses: perf.approvedResponses,
        rejectedResponses: perf.rejectedResponses
      };
    });

    // Get all assigned quality agents details
    // For project managers: filter by assigned quality agents if they have any
    let targetQualityAgentIds = [];
    if (qualityAgentIds) {
      targetQualityAgentIds = Array.isArray(qualityAgentIds)
        ? qualityAgentIds
        : qualityAgentIds.split(',').filter(id => id.trim());
    }

    let assignedQualityAgents = [];
    if (assignedQualityAgentIds.length > 0) {
      const filterQuery = {
        _id: { $in: assignedQualityAgentIds },
        company: currentUser.company._id
      };
      
      // If project manager has assigned quality agents, further filter
      if (targetQualityAgentIds.length > 0 && currentUser.userType === 'project_manager') {
        filterQuery._id = { 
          $in: assignedQualityAgentIds.filter(id => 
            targetQualityAgentIds.some(qaId => id.toString() === qaId.toString())
          )
        };
      }
      
      assignedQualityAgents = await User.find(filterQuery)
        .select('firstName lastName email phone userType memberId');
    } else if (targetQualityAgentIds.length > 0 && currentUser.userType === 'project_manager') {
      // If survey has no assigned quality agents but project manager has assigned ones, show those
      assignedQualityAgents = await User.find({
        _id: { $in: targetQualityAgentIds.map(id => new mongoose.Types.ObjectId(id.trim())) },
        company: currentUser.company._id,
        userType: 'quality_agent'
      }).select('firstName lastName email phone userType memberId');
    }

    // Also get any reviewers who reviewed but might not be in assigned list (company admins or other reviewers)
    const reviewerIds = qcPerformance.map(qc => {
      try {
        return new mongoose.Types.ObjectId(qc._id);
      } catch (error) {
        console.error('Invalid reviewer ID:', qc._id, error);
        return null;
      }
    }).filter(id => id !== null);

    // Get additional reviewers (company admins who reviewed but aren't assigned)
    const assignedQAIds = assignedQualityAgents.map(qa => qa._id.toString());
    const additionalReviewerIds = reviewerIds.filter(id => !assignedQAIds.includes(id.toString()));
    
    let additionalReviewers = [];
    if (additionalReviewerIds.length > 0) {
      additionalReviewers = await User.find({
        _id: { $in: additionalReviewerIds },
        $or: [
          { userType: 'quality_agent' },
          { userType: 'company_admin' }
        ],
        company: currentUser.company._id
      }).select('firstName lastName email phone userType memberId');
    }

    // Combine all reviewers
    const allReviewers = [...assignedQualityAgents, ...additionalReviewers];

    // Create a map for quick lookup
    const reviewerMap = {};
    allReviewers.forEach(reviewer => {
      reviewerMap[reviewer._id.toString()] = reviewer;
    });

    // Calculate assigned (pending) responses count for each quality agent
    const assignedCountsMap = {};
    
    // For each quality agent, count pending responses in their assigned ACs
    for (const qaId of assignedQualityAgentIds) {
      const assignment = qualityAgentAssignmentsMap[qaId.toString()];
      if (!assignment) continue;
      
      const assignedACs = assignment.assignedACs || [];
      
      // Build filter for pending responses in this quality agent's scope
      // A response is pending if it hasn't been reviewed (verificationData.reviewer is null/undefined)
      // Exclude responses that are already Approved or Rejected
      const pendingFilter = {
        survey: new mongoose.Types.ObjectId(surveyId),
        $or: [
          { 'verificationData': { $exists: false } },
          { 'verificationData.reviewer': { $exists: false } },
          { 'verificationData.reviewer': null }
        ],
        status: { $nin: ['Approved', 'Rejected'] } // Exclude already reviewed responses
      };
      
      // If quality agent has assignedACs, filter by selectedAC
      // Only count responses that belong to the ACs assigned to this quality agent
      if (assignedACs.length > 0) {
        // Trim and filter out empty strings from assignedACs
        const validACs = assignedACs.filter(ac => ac && ac.trim().length > 0).map(ac => ac.trim());
        if (validACs.length > 0) {
          pendingFilter.selectedAC = { $in: validACs };
        } else {
          // No valid ACs, set count to 0
          assignedCountsMap[qaId.toString()] = 0;
          continue;
        }
      } else {
        // If no assignedACs, this quality agent doesn't have a specific scope
        // Set assigned count to 0 as they don't have assigned ACs
        assignedCountsMap[qaId.toString()] = 0;
        continue;
      }
      
      // Count pending responses
      const assignedCount = await SurveyResponse.countDocuments(pendingFilter);
      assignedCountsMap[qaId.toString()] = assignedCount;
    }

    // Combine all assigned quality agents with their performance data
    let combinedData = assignedQualityAgentIds.map((qaId) => {
      const reviewer = reviewerMap[qaId.toString()];
      const reviewerIdStr = qaId.toString();
      const performance = performanceMap[reviewerIdStr] || {
        totalReviews: 0,
        approvedResponses: 0,
        rejectedResponses: 0
      };

      return {
        _id: qaId,
        name: reviewer ? `${reviewer.firstName || ''} ${reviewer.lastName || ''}`.trim() || reviewer.email || 'Unknown' : 'Unknown',
        email: reviewer ? reviewer.email || 'N/A' : 'N/A',
        phone: reviewer ? (reviewer.phone || 'N/A') : 'N/A',
        assigned: assignedCountsMap[reviewerIdStr] || 0,
        totalReviews: performance.totalReviews,
        approvedResponses: performance.approvedResponses,
        rejectedResponses: performance.rejectedResponses
      };
    });

    // Add any additional reviewers who reviewed but aren't assigned (like company admins)
    additionalReviewers.forEach(reviewer => {
      const reviewerIdStr = reviewer._id.toString();
      if (!assignedQAIds.includes(reviewerIdStr)) {
        const performance = performanceMap[reviewerIdStr] || {
          totalReviews: 0,
          approvedResponses: 0,
          rejectedResponses: 0
        };

        combinedData.push({
          _id: reviewer._id,
          name: `${reviewer.firstName || ''} ${reviewer.lastName || ''}`.trim() || reviewer.email || 'Unknown',
          email: reviewer.email || 'N/A',
          phone: reviewer.phone || 'N/A',
          memberId: reviewer.memberId || null,
          assigned: 0, // Additional reviewers don't have assigned ACs, so assigned count is 0
          totalReviews: performance.totalReviews,
          approvedResponses: performance.approvedResponses,
          rejectedResponses: performance.rejectedResponses
        });
      }
    });

    // Sort by total reviews (descending) by default
    combinedData.sort((a, b) => b.totalReviews - a.totalReviews);

    // Apply search filter if provided (name, email, or memberId)
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      combinedData = combinedData.filter(qa => {
        const nameMatch = qa.name?.toLowerCase().includes(searchLower) || false;
        const emailMatch = qa.email?.toLowerCase().includes(searchLower) || false;
        const memberIdMatch = qa.memberId?.toString().includes(searchLower) || false;
        return nameMatch || emailMatch || memberIdMatch;
      });
    }

    res.status(200).json({
      success: true,
      data: {
        qualityAgents: combinedData,
        survey: {
          _id: survey._id,
          surveyName: survey.surveyName
        },
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          search: search || null
        }
      }
    });

  } catch (error) {
    console.error('Get QC performance by survey error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get QC Performance trends for a specific survey (daily breakdown)
// @route   GET /api/performance/qc-performance/survey/:surveyId/trends
// @access  Private (Company Admin)
exports.getQCPerformanceTrends = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { 
      startDate, 
      endDate,
      qualityAgentIds // Filter by quality agent IDs (for project managers)
    } = req.query;

    // Verify the survey belongs to the company
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }

    // Check if user has access to this survey
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
        message: 'Access denied. You can only view QC performance for surveys from your company.'
      });
    }

    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter['verificationData.reviewedAt'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Base filter for responses reviewed for this survey
    const baseFilter = {
      survey: new mongoose.Types.ObjectId(surveyId),
      'verificationData.reviewer': { $exists: true, $ne: null },
      ...dateFilter
    };

    // Aggregate to get daily performance breakdown
    const dailyPerformance = await SurveyResponse.aggregate([
      { $match: baseFilter },
      {
        $project: {
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$verificationData.reviewedAt'
            }
          },
          status: 1
        }
      },
      {
        $group: {
          _id: '$date',
          totalReviewed: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Calculate totals and averages
    const totalReviewed = dailyPerformance.reduce((sum, day) => sum + day.totalReviewed, 0);
    const totalApproved = dailyPerformance.reduce((sum, day) => sum + day.approved, 0);
    const totalRejected = dailyPerformance.reduce((sum, day) => sum + day.rejected, 0);
    const daysCount = dailyPerformance.length;
    const averageDaily = daysCount > 0 ? Math.round(totalReviewed / daysCount * 10) / 10 : 0;

    // Format daily performance data
    const formattedDailyPerformance = dailyPerformance.map(day => ({
      date: day._id,
      totalReviewed: day.totalReviewed,
      approved: day.approved,
      rejected: day.rejected
    }));

    res.status(200).json({
      success: true,
      data: {
        dailyPerformance: formattedDailyPerformance,
        summary: {
          totalReviewed,
          totalApproved,
          totalRejected,
          averageDaily,
          daysCount
        },
        filters: {
          startDate: startDate || null,
          endDate: endDate || null
        }
      }
    });

  } catch (error) {
    console.error('Get QC performance trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

