const SurveyResponse = require('../models/SurveyResponse');
const Survey = require('../models/Survey');
const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Get interviewer performance analytics
// @route   GET /api/performance/analytics
// @access  Private (Interviewer, Company Admin)
exports.getInterviewerPerformance = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      surveyId, 
      timeRange = '30d', // 7d, 30d, 90d, 1y, all
      interviewerId // Optional: for company admin to view specific interviewer
    } = req.query;

    // Determine target interviewer(s)
    let targetInterviewerId;
    if (req.user.userType === 'company_admin') {
      // Company admin can view all interviewers in their company or a specific one
      if (interviewerId) {
        // Verify the interviewer belongs to the same company
        const interviewer = await User.findById(interviewerId);
        if (!interviewer || interviewer.company?.toString() !== req.user.company?.toString()) {
          return res.status(403).json({
            success: false,
            message: 'You can only view performance of interviewers in your company'
          });
        }
        targetInterviewerId = new mongoose.Types.ObjectId(interviewerId);
      } else {
        // Get all active interviewers in the company
        const companyInterviewers = await User.find({
          company: req.user.company,
          userType: 'interviewer',
          isActive: true
        }).select('_id');
        targetInterviewerId = companyInterviewers.map(u => u._id);
      }
    } else {
      // Regular interviewer views their own performance
      targetInterviewerId = new mongoose.Types.ObjectId(req.user.id);
    }

    // Calculate date range based on timeRange parameter
    let dateFilter = {};
    if (timeRange !== 'all') {
      const now = new Date();
      let start;
      
      switch (timeRange) {
        case '7d':
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      dateFilter.createdAt = { $gte: start };
    }

    // Add custom date range if provided
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Add survey filter if provided
    const surveyFilter = surveyId ? { survey: new mongoose.Types.ObjectId(surveyId) } : {};

    // Build base filter - handle array of interviewer IDs for company admin
    const baseFilter = {
      ...dateFilter,
      ...surveyFilter
    };
    
    if (Array.isArray(targetInterviewerId)) {
      baseFilter.interviewer = { $in: targetInterviewerId };
    } else {
      baseFilter.interviewer = targetInterviewerId;
    }

    // Get performance overview
    const overview = await SurveyResponse.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          totalInterviews: { $sum: 1 },
          approvedInterviews: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
          },
          rejectedInterviews: {
            $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] }
          },
          pendingInterviews: {
            $sum: { $cond: [{ $eq: ['$status', 'Pending_Approval'] }, 1, 0] }
          },
          averageCompletionTime: { $avg: '$totalTimeSpent' },
          averageCompletionPercentage: { $avg: '$completionPercentage' },
          averageQualityScore: { $avg: '$qualityMetrics.dataQualityScore' },
          totalEarnings: { $sum: { $ifNull: ['$metadata.earnings', 0] } }
        }
      }
    ]);

    // Get daily performance data for charts
    const dailyPerformance = await SurveyResponse.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          date: { $first: '$createdAt' },
          interviews: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] }
          },
          averageTime: { $avg: '$totalTimeSpent' },
          averageQuality: { $avg: '$qualityMetrics.dataQualityScore' },
          earnings: { $sum: { $ifNull: ['$metadata.earnings', 0] } }
        }
      },
      { $sort: { date: 1 } }
    ]);

    // Get survey-wise performance
    const surveyPerformance = await SurveyResponse.aggregate([
      { $match: baseFilter },
      {
        $lookup: {
          from: 'surveys',
          localField: 'survey',
          foreignField: '_id',
          as: 'surveyData'
        }
      },
      { $unwind: '$surveyData' },
      {
        $group: {
          _id: '$survey',
          surveyName: { $first: '$surveyData.surveyName' },
          totalInterviews: { $sum: 1 },
          approvedInterviews: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
          },
          rejectedInterviews: {
            $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] }
          },
          averageTime: { $avg: '$totalTimeSpent' },
          averageQuality: { $avg: '$qualityMetrics.dataQualityScore' },
          averageCompletion: { $avg: '$completionPercentage' }
        }
      },
      { $sort: { totalInterviews: -1 } }
    ]);

    // Get quality metrics breakdown
    const qualityMetrics = await SurveyResponse.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          averageResponseTime: { $avg: '$qualityMetrics.averageResponseTime' },
          averageDataQuality: { $avg: '$qualityMetrics.dataQualityScore' },
          totalPauses: { $sum: '$qualityMetrics.totalPauses' },
          totalPauseTime: { $sum: '$qualityMetrics.totalPauseTime' },
          backNavigationCount: { $sum: '$qualityMetrics.backNavigationCount' }
        }
      }
    ]);

    // Get recent interviews
    const recentInterviews = await SurveyResponse.find(baseFilter)
      .populate('survey', 'surveyName category')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('survey status totalTimeSpent completionPercentage qualityMetrics.dataQualityScore createdAt');

    // Get user's current performance metrics (only for single interviewer, not for company admin viewing all)
    let user = null;
    if (!Array.isArray(targetInterviewerId)) {
      user = await User.findById(targetInterviewerId).select('performance');
    }

    // Calculate approval rate
    const overviewData = overview[0] || {
      totalInterviews: 0,
      approvedInterviews: 0,
      rejectedInterviews: 0,
      pendingInterviews: 0,
      averageCompletionTime: 0,
      averageCompletionPercentage: 0,
      averageQualityScore: 0,
      totalEarnings: 0
    };

    const approvalRate = overviewData.totalInterviews > 0 
      ? (overviewData.approvedInterviews / overviewData.totalInterviews) * 100 
      : 0;

    // Get available surveys for filter dropdown
    const availableSurveysFilter = {
      status: 'active'
    };
    
    if (Array.isArray(targetInterviewerId)) {
      availableSurveysFilter['assignedInterviewers.interviewer'] = { $in: targetInterviewerId };
    } else {
      availableSurveysFilter['assignedInterviewers.interviewer'] = targetInterviewerId;
    }
    
    const availableSurveys = await Survey.find(availableSurveysFilter).select('_id surveyName category');

    res.status(200).json({
      success: true,
      data: {
        overview: {
          ...overviewData,
          approvalRate: Math.round(approvalRate * 100) / 100,
          averageRating: user?.performance?.averageRating || 0
        },
        dailyPerformance,
        surveyPerformance,
        qualityMetrics: qualityMetrics[0] || {},
        recentInterviews,
        availableSurveys,
        timeRange,
        dateRange: {
          startDate: dateFilter.createdAt?.$gte || null,
          endDate: dateFilter.createdAt?.$lte || null
        }
      }
    });

  } catch (error) {
    console.error('Get interviewer performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get performance trends over time
// @route   GET /api/performance/trends
// @access  Private (Interviewer, Company Admin)
exports.getPerformanceTrends = async (req, res) => {
  try {
    const { period = 'monthly', interviewerId } = req.query; // daily, weekly, monthly

    // Determine target interviewer(s) - same logic as getInterviewerPerformance
    let targetInterviewerIds;
    if (req.user.userType === 'company_admin') {
      if (interviewerId) {
        const interviewer = await User.findById(interviewerId);
        if (!interviewer || interviewer.company?.toString() !== req.user.company?.toString()) {
          return res.status(403).json({
            success: false,
            message: 'You can only view performance of interviewers in your company'
          });
        }
        targetInterviewerIds = [new mongoose.Types.ObjectId(interviewerId)];
      } else {
        const companyInterviewers = await User.find({
          company: req.user.company,
          userType: 'interviewer',
          isActive: true
        }).select('_id');
        targetInterviewerIds = companyInterviewers.map(u => u._id);
      }
    } else {
      targetInterviewerIds = [new mongoose.Types.ObjectId(req.user.id)];
    }

    let groupFormat;
    switch (period) {
      case 'daily':
        groupFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        break;
      case 'weekly':
        groupFormat = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        };
        break;
      case 'monthly':
      default:
        groupFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
    }

    const trends = await SurveyResponse.aggregate([
      {
        $match: {
          interviewer: { $in: targetInterviewerIds },
          createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } // Last year
        }
      },
      {
        $group: {
          _id: groupFormat,
          period: { $first: '$createdAt' },
          totalInterviews: { $sum: 1 },
          approvedInterviews: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
          },
          rejectedInterviews: {
            $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] }
          },
          averageTime: { $avg: '$totalTimeSpent' },
          averageQuality: { $avg: '$qualityMetrics.dataQualityScore' },
          averageCompletion: { $avg: '$completionPercentage' }
        }
      },
      { $sort: { period: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        trends,
        period
      }
    });

  } catch (error) {
    console.error('Get performance trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get detailed interview history
// @route   GET /api/performance/interviews
// @access  Private (Interviewer, Company Admin)
exports.getInterviewHistory = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      surveyId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      interviewerId // Optional: for company admin to view specific interviewer
    } = req.query;

    // Determine target interviewer(s) - same logic as getInterviewerPerformance
    let targetInterviewerIds;
    if (req.user.userType === 'company_admin') {
      if (interviewerId) {
        const interviewer = await User.findById(interviewerId);
        if (!interviewer || interviewer.company?.toString() !== req.user.company?.toString()) {
          return res.status(403).json({
            success: false,
            message: 'You can only view performance of interviewers in your company'
          });
        }
        targetInterviewerIds = [new mongoose.Types.ObjectId(interviewerId)];
      } else {
        const companyInterviewers = await User.find({
          company: req.user.company,
          userType: 'interviewer',
          isActive: true
        }).select('_id');
        targetInterviewerIds = companyInterviewers.map(u => u._id);
      }
    } else {
      targetInterviewerIds = [new mongoose.Types.ObjectId(req.user.id)];
    }

    const skip = (page - 1) * limit;
    
    // Build filter
    const filter = {
      interviewer: { $in: targetInterviewerIds }
    };

    if (status) filter.status = status;
    if (surveyId) filter.survey = new mongoose.Types.ObjectId(surveyId);
    
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const interviews = await SurveyResponse.find(filter)
      .populate('survey', 'surveyName category')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('survey status totalTimeSpent completionPercentage qualityMetrics createdAt');

    const total = await SurveyResponse.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        interviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get interview history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get quality agent performance analytics
// @route   GET /api/performance/quality-agent/analytics
// @access  Private (Quality Agent)
exports.getQualityAgentPerformance = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      surveyId, 
      timeRange = '30d' // 7d, 30d, 90d, 1y, all
    } = req.query;

    const qualityAgentId = new mongoose.Types.ObjectId(req.user.id);

    // Calculate date range based on timeRange parameter
    let dateFilter = {};
    if (timeRange !== 'all') {
      const now = new Date();
      let start;
      switch (timeRange) {
        case '7d':
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      dateFilter['verificationData.reviewedAt'] = { $gte: start };
    }

    // Override with custom date range if provided
    if (startDate && endDate) {
      dateFilter['verificationData.reviewedAt'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Base filter for quality agent's reviewed responses
    const baseFilter = {
      'verificationData.reviewer': qualityAgentId,
      ...dateFilter
    };

    if (surveyId) {
      baseFilter.survey = new mongoose.Types.ObjectId(surveyId);
    }

    // OPTIMIZATION: If lightweight=true, only get overview stats (skip expensive aggregations)
    const lightweight = req.query.lightweight === 'true';
    
    // Get overview statistics
    const overview = await SurveyResponse.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          totalReviewed: { $sum: 1 },
          totalApproved: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
          },
          totalRejected: {
            $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] }
          },
          totalPending: {
            $sum: { $cond: [{ $eq: ['$status', 'Pending_Approval'] }, 1, 0] }
          },
          averageReviewTime: {
            $avg: {
              $subtract: [
                '$verificationData.reviewedAt',
                '$createdAt'
              ]
            }
          }
        }
      }
    ]);

    // If lightweight mode, return early with only overview stats
    if (lightweight) {
      return res.status(200).json({
        success: true,
        data: {
          overview: overview[0] || {
            totalReviewed: 0,
            totalApproved: 0,
            totalRejected: 0,
            totalPending: 0,
            averageReviewTime: 0
          }
        }
      });
    }

    // Get daily performance (skip in lightweight mode)
    const dailyPerformance = await SurveyResponse.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: {
            year: { $year: '$verificationData.reviewedAt' },
            month: { $month: '$verificationData.reviewedAt' },
            day: { $dayOfMonth: '$verificationData.reviewedAt' }
          },
          date: { $first: '$verificationData.reviewedAt' },
          totalReviewed: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] }
          }
        }
      },
      { $sort: { date: 1 } }
    ]);

    // Get survey-wise performance
    const surveyPerformance = await SurveyResponse.aggregate([
      { $match: baseFilter },
      {
        $lookup: {
          from: 'surveys',
          localField: 'survey',
          foreignField: '_id',
          as: 'surveyData'
        }
      },
      { $unwind: '$surveyData' },
      {
        $group: {
          _id: '$survey',
          surveyName: { $first: '$surveyData.surveyName' },
          totalReviewed: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] }
          }
        }
      },
      { $sort: { totalReviewed: -1 } }
    ]);

    // Get recent reviews
    const recentReviews = await SurveyResponse.find(baseFilter)
      .populate('survey', 'surveyName category sections questions targetAudience settings')
      .populate('interviewer', 'firstName lastName email')
      .sort({ 'verificationData.reviewedAt': -1 })
      .limit(10)
      .select('survey interviewer status verificationData createdAt responseId audioRecording responses location metadata interviewMode selectedAC');

    res.status(200).json({
      success: true,
      data: {
        overview: overview[0] || {
          totalReviewed: 0,
          totalApproved: 0,
          totalRejected: 0,
          totalPending: 0,
          averageReviewTime: 0
        },
        dailyPerformance,
        surveyPerformance,
        recentReviews,
        filters: {
          timeRange,
          startDate: dateFilter['verificationData.reviewedAt']?.$gte || null,
          endDate: dateFilter['verificationData.reviewedAt']?.$lte || null
        }
      }
    });

  } catch (error) {
    console.error('Get quality agent performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get quality agent performance trends
// @route   GET /api/performance/quality-agent/trends
// @access  Private (Quality Agent)
exports.getQualityAgentTrends = async (req, res) => {
  try {
    const { period = 'daily' } = req.query; // daily, weekly, monthly
    const qualityAgentId = new mongoose.Types.ObjectId(req.user.id);

    let groupFormat;
    switch (period) {
      case 'daily':
        groupFormat = {
          year: { $year: '$verificationData.reviewedAt' },
          month: { $month: '$verificationData.reviewedAt' },
          day: { $dayOfMonth: '$verificationData.reviewedAt' }
        };
        break;
      case 'weekly':
        groupFormat = {
          year: { $year: '$verificationData.reviewedAt' },
          week: { $week: '$verificationData.reviewedAt' }
        };
        break;
      case 'monthly':
      default:
        groupFormat = {
          year: { $year: '$verificationData.reviewedAt' },
          month: { $month: '$verificationData.reviewedAt' }
        };
    }

    const trends = await SurveyResponse.aggregate([
      {
        $match: {
          'verificationData.reviewer': qualityAgentId,
          'verificationData.reviewedAt': { 
            $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
          }
        }
      },
      {
        $group: {
          _id: groupFormat,
          period: { $first: '$verificationData.reviewedAt' },
          totalReviewed: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] }
          }
        }
      },
      { $sort: { period: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        trends,
        period
      }
    });

  } catch (error) {
    console.error('Get quality agent trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get quality agent reviewed responses history
// @route   GET /api/performance/quality-agent/reviews
// @access  Private (Quality Agent)
exports.getQualityAgentReviews = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      surveyId,
      startDate,
      endDate,
      sortBy = 'verificationData.reviewedAt',
      sortOrder = 'desc'
    } = req.query;

    const qualityAgentId = new mongoose.Types.ObjectId(req.user.id);
    const skip = (page - 1) * limit;
    
    // Build filter
    const filter = {
      'verificationData.reviewer': qualityAgentId
    };

    if (status) filter.status = status;
    if (surveyId) filter.survey = new mongoose.Types.ObjectId(surveyId);
    
    if (startDate && endDate) {
      filter['verificationData.reviewedAt'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const reviews = await SurveyResponse.find(filter)
      .populate('survey', 'surveyName category sections questions targetAudience settings')
      .populate('interviewer', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('survey interviewer status verificationData createdAt responseId totalTimeSpent completionPercentage responses location metadata interviewMode selectedAC audioRecording');

    const total = await SurveyResponse.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get quality agent reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
