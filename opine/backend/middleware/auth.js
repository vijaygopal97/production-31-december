const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;
    const requestInfo = {
      path: req.path,
      method: req.method,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent') || 'unknown'
    };

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check for token in cookies
    if (!token && req.cookies.token) {
      token = req.cookies.token;
    }

    // Make sure token exists
    if (!token) {
      console.error('❌ AUTH FAILED: No token provided', {
        ...requestInfo,
        hasAuthHeader: !!req.headers.authorization,
        authHeaderFormat: req.headers.authorization ? (req.headers.authorization.startsWith('Bearer') ? 'Bearer prefix found' : 'No Bearer prefix') : 'No header',
        hasCookie: !!req.cookies.token,
        timestamp: new Date().toISOString()
      });
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    // Log token preview for debugging (first 20 chars + last 5 chars for identification)
    const tokenPreview = token.length > 25 
      ? `${token.substring(0, 20)}...${token.substring(token.length - 5)}`
      : `${token.substring(0, Math.min(20, token.length))}...`;

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Get user from token
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        console.error('❌ AUTH FAILED: User not found in database', {
          ...requestInfo,
          userIdFromToken: decoded.userId,
          tokenPreview,
          timestamp: new Date().toISOString()
        });
        return res.status(401).json({
          success: false,
          message: 'No user found with this token'
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        console.error('❌ AUTH FAILED: User account is not active', {
          ...requestInfo,
          userId: user._id.toString(),
          userEmail: user.email,
          userStatus: user.status,
          tokenPreview,
          timestamp: new Date().toISOString()
        });
        return res.status(403).json({
          success: false,
          message: `Account is ${user.status}. Please contact support.`
        });
      }

      // Log successful authentication (only for critical endpoints to avoid log spam)
      if (req.path.includes('/complete') || req.path.includes('/sync') || req.path.includes('/interview')) {
        console.log('✅ AUTH SUCCESS', {
          ...requestInfo,
          userId: user._id.toString(),
          userEmail: user.email,
          userType: user.userType,
          timestamp: new Date().toISOString()
        });
      }

      req.user = user;
      next();
    } catch (error) {
      // Log JWT verification errors with detailed information
      const errorDetails = {
        ...requestInfo,
        errorName: error.name,
        errorMessage: error.message,
        tokenPreview,
        tokenLength: token.length,
        timestamp: new Date().toISOString()
      };

      // Add specific details based on error type
      if (error.name === 'TokenExpiredError') {
        errorDetails.expiredAt = error.expiredAt;
        errorDetails.expiredAtISO = new Date(error.expiredAt).toISOString();
        errorDetails.secondsSinceExpiry = Math.floor((Date.now() - error.expiredAt) / 1000);
        console.error('❌ AUTH FAILED: Token expired', errorDetails);
      } else if (error.name === 'JsonWebTokenError') {
        errorDetails.jwtErrorType = error.message; // e.g., "invalid signature", "jwt malformed"
        console.error('❌ AUTH FAILED: Invalid JWT token', errorDetails);
      } else if (error.name === 'NotBeforeError') {
        errorDetails.notBefore = error.date;
        console.error('❌ AUTH FAILED: Token not yet valid', errorDetails);
      } else {
        console.error('❌ AUTH FAILED: JWT verification error (unknown type)', errorDetails);
      }

      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    console.error('❌ AUTH MIDDLEWARE: Unexpected error', {
      path: req.path,
      method: req.method,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    if (!roles.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.userType} is not authorized to access this route`
      });
    }

    next();
  };
};

// Check if user belongs to specific company
exports.checkCompany = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  // Super admin can access any company
  if (req.user.userType === 'super_admin') {
    return next();
  }

  // Check if user has company
  if (!req.user.company) {
    return res.status(403).json({
      success: false,
      message: 'User does not belong to any company'
    });
  }

  // Check if company ID in params matches user's company
  if (req.params.companyId && req.params.companyId !== req.user.company.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this company data'
    });
  }

  next();
};

// Optional auth - doesn't fail if no token
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check for token in cookies
    if (!token && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Get user from token
        const user = await User.findById(decoded.userId).select('-password');
        
        if (user && user.status === 'active') {
          req.user = user;
        }
      } catch (error) {
        // Token is invalid, but we don't fail the request
        console.log('Invalid token in optional auth:', error.message);
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue even if there's an error
  }
};
