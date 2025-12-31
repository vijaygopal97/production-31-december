const AppLog = require('../models/AppLog');

/**
 * @desc    Receive app logs from mobile app
 * @route   POST /api/app-logs
 * @access  Private (Authenticated users)
 */
exports.receiveAppLogs = async (req, res) => {
  try {
    const { logs, deviceInfo, userId, appVersion } = req.body;

    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: logs array required'
      });
    }

    // Use userId from token if not provided
    const interviewerId = req.user?.id || userId;

    // Prepare log documents
    const logDocuments = logs.map(log => ({
      userId: interviewerId,
      deviceId: deviceInfo?.deviceId || 'unknown',
      appVersion: appVersion || 'unknown',
      level: log.level || 'info',
      category: log.category || 'general',
      message: log.message || '',
      metadata: log.metadata || {},
      stackTrace: log.stackTrace,
      deviceInfo: deviceInfo || {},
      timestamp: log.timestamp ? new Date(log.timestamp) : new Date()
    }));

    // Insert logs in bulk
    await AppLog.insertMany(logDocuments);

    console.log(`📝 Received ${logs.length} app logs from device ${deviceInfo?.deviceId || 'unknown'}`);

    res.status(200).json({
      success: true,
      received: logs.length,
      message: 'Logs received successfully'
    });
  } catch (error) {
    console.error('Error receiving app logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to receive logs',
      error: error.message
    });
  }
};

/**
 * @desc    Get app logs (Admin)
 * @route   GET /api/app-logs
 * @access  Private (Company Admin, Super Admin)
 */
exports.getAppLogs = async (req, res) => {
  try {
    const { 
      deviceId, 
      userId, 
      category, 
      level, 
      startDate, 
      endDate,
      page = 1, 
      limit = 100 
    } = req.query;

    const query = {};

    if (deviceId) query.deviceId = deviceId;
    if (userId) query.userId = userId;
    if (category) query.category = category;
    if (level) query.level = level;

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      AppLog.find(query)
        .populate('userId', 'firstName lastName email')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AppLog.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        logs,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting app logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get logs',
      error: error.message
    });
  }
};





