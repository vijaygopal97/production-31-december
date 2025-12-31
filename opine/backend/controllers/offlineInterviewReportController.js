const OfflineInterviewReport = require('../models/OfflineInterviewReport');

/**
 * @desc    Report offline interview status from mobile app
 * @route   POST /api/survey-responses/offline-interviews/report
 * @access  Private (Authenticated users)
 */
exports.reportOfflineInterviews = async (req, res) => {
  try {
    const interviewerId = req.user.id;
    const { interviews, deviceId } = req.body;

    if (!interviews || !Array.isArray(interviews)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: interviews array required'
      });
    }

    let reportedCount = 0;

    // Upsert each interview report
    for (const interview of interviews) {
      try {
        await OfflineInterviewReport.findOneAndUpdate(
          { 
            deviceId, 
            interviewId: interview.interviewId 
          },
          {
            interviewerId,
            deviceId,
            interviewId: interview.interviewId,
            sessionId: interview.sessionId,
            surveyId: interview.surveyId,
            status: interview.status,
            syncAttempts: interview.syncAttempts || 0,
            lastSyncAttempt: interview.lastSyncAttempt ? new Date(interview.lastSyncAttempt) : new Date(),
            error: interview.error,
            errorDetails: interview.errorDetails || {},
            metadata: interview.metadata || {},
            reportedAt: new Date()
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
          }
        );
        reportedCount++;
      } catch (error) {
        console.error(`Error reporting interview ${interview.interviewId}:`, error);
        // Continue with other interviews
      }
    }

    res.status(200).json({
      success: true,
      reported: reportedCount,
      message: `Reported ${reportedCount} offline interviews`
    });
  } catch (error) {
    console.error('Error reporting offline interviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to report offline interviews',
      error: error.message
    });
  }
};

/**
 * @desc    Get offline interview reports (Admin)
 * @route   GET /api/survey-responses/offline-interviews/reports
 * @access  Private (Company Admin, Super Admin)
 */
exports.getOfflineInterviewReports = async (req, res) => {
  try {
    const { interviewerId, status, surveyId, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (interviewerId) query.interviewerId = interviewerId;
    if (status) query.status = status;
    if (surveyId) query.surveyId = surveyId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, total] = await Promise.all([
      OfflineInterviewReport.find(query)
        .populate('interviewerId', 'firstName lastName email')
        .populate('surveyId', 'surveyName')
        .sort({ lastSyncAttempt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      OfflineInterviewReport.countDocuments(query)
    ]);

    // Get statistics
    const stats = await OfflineInterviewReport.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statsObj = {
      pending: 0,
      failed: 0,
      syncing: 0
    };

    stats.forEach(stat => {
      statsObj[stat._id] = stat.count;
    });

    res.status(200).json({
      success: true,
      data: {
        reports,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
        stats: statsObj
      }
    });
  } catch (error) {
    console.error('Error getting offline interview reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get offline interview reports',
      error: error.message
    });
  }
};

/**
 * @desc    Get offline interview summary (Admin Dashboard)
 * @route   GET /api/survey-responses/offline-interviews/summary
 * @access  Private (Company Admin, Super Admin)
 */
exports.getOfflineInterviewSummary = async (req, res) => {
  try {
    // Overall stats
    const totalStats = await OfflineInterviewReport.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statsObj = {
      pending: 0,
      failed: 0,
      syncing: 0
    };

    totalStats.forEach(stat => {
      statsObj[stat._id] = stat.count;
    });

    // By interviewer
    const byInterviewer = await OfflineInterviewReport.aggregate([
      {
        $group: {
          _id: '$interviewerId',
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          syncing: {
            $sum: { $cond: [{ $eq: ['$status', 'syncing'] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'interviewer'
        }
      },
      {
        $unwind: {
          path: '$interviewer',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          interviewerId: '$_id',
          interviewerName: {
            $concat: [
              { $ifNull: ['$interviewer.firstName', ''] },
              ' ',
              { $ifNull: ['$interviewer.lastName', ''] }
            ]
          },
          interviewerEmail: '$interviewer.email',
          pending: 1,
          failed: 1,
          syncing: 1
        }
      },
      { $sort: { failed: -1, pending: -1 } },
      { $limit: 20 }
    ]);

    // Failed interviews by error type
    const failedByError = await OfflineInterviewReport.aggregate([
      { $match: { status: 'failed' } },
      {
        $group: {
          _id: '$error',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: statsObj.pending + statsObj.failed + statsObj.syncing,
        byStatus: statsObj,
        byInterviewer,
        failedWithErrors: failedByError.map(item => ({
          error: item._id || 'Unknown error',
          count: item.count
        }))
      }
    });
  } catch (error) {
    console.error('Error getting offline interview summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get summary',
      error: error.message
    });
  }
};





