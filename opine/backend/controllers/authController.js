const User = require('../models/User');
const Company = require('../models/Company');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { generateOTP, createOTPSignature, verifyOTPSignature, validatePassword, sendOTPEmail } = require('../config/auth');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Generate verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Generate unique 6-digit member ID for interviewers and quality agents
const generateMemberId = async () => {
  let memberId;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100;

  while (!isUnique && attempts < maxAttempts) {
    // Generate a random 6-digit number (100000 to 999999)
    memberId = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Check if this memberId already exists
    const existingUser = await User.findOne({ memberId });
    if (!existingUser) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique member ID after multiple attempts');
  }

  return memberId;
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      userType,
      companyCode,
      companyName,
      industry,
      companySize,
      companyEmail,
      companyPhone,
      companyWebsite,
      address,
      referralCode,
      status,
      gig_enabled,
      interviewModes,
      canSelectMode
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !password || !userType) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Check if phone already exists
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: 'User with this phone number already exists'
      });
    }

    let company = null;
    let companyId = null;

    // Handle company creation/selection based on user type
    // Company code is required for company_admin and project_manager
    // Optional for interviewer, quality_agent, and Data_Analyst (independent workers)
    if (userType !== 'super_admin') {
      const requiresCompanyCode = ['company_admin', 'project_manager'].includes(userType);
      
      if (requiresCompanyCode && !companyCode) {
        return res.status(400).json({
          success: false,
          message: 'Company code is required for this user type'
        });
      }

      // Check if company exists (only if companyCode is provided)
      if (companyCode) {
        company = await Company.findOne({ companyCode: companyCode.toUpperCase() });
        
        if (!company) {
        // Create new company if it doesn't exist (for company_admin registration)
        if (userType === 'company_admin') {
          if (!companyName || !industry || !companySize || !companyEmail || !companyPhone) {
            return res.status(400).json({
              success: false,
              message: 'Company information is required for company admin registration'
            });
          }

          // Check if company email already exists
          const existingCompany = await Company.findOne({ email: companyEmail });
          if (existingCompany) {
            return res.status(400).json({
              success: false,
              message: 'Company with this email already exists'
            });
          }

          // Create new company
          company = await Company.create({
            companyName,
            companyCode: companyCode.toUpperCase(),
            industry,
            companySize,
            email: companyEmail,
            phone: companyPhone,
            website: companyWebsite,
            address: address || {},
            status: 'pending',
            createdBy: null // Will be updated after user creation
          });

          companyId = company._id;
        } else {
          return res.status(400).json({
            success: false,
            message: 'Company does not exist. Please contact your company admin for the correct company code.'
          });
        }
      } else {
        companyId = company._id;
        
        // Check if company is active
        if (company.status !== 'active') {
          return res.status(400).json({
            success: false,
            message: 'Company is not active. Please contact support.'
          });
        }
      }
      } // Close the if (companyCode) block
    }

    // Handle referral code
    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        referredBy = referrer._id;
      }
    }

    // Generate user data
    const userData = {
      firstName,
      lastName,
      email,
      phone,
      password,
      userType,
      company: companyId,
      companyCode: companyCode ? companyCode.toUpperCase() : null,
      emailVerificationToken: generateVerificationToken(),
      registrationSource: 'direct',
      referralCode: referralCode,
      referredBy,
      status: status || (userType === 'super_admin' || userType === 'interviewer' ? 'active' : 'pending'),
      gig_enabled: gig_enabled || false, // Admin can enable gig feature
      gig_availability: true // Set to true for public registrations
    };

    // Add interview mode settings for interviewer users
    if (userType === 'interviewer') {
      userData.interviewModes = interviewModes || 'Both';
      userData.canSelectMode = canSelectMode || false;
    }

    // Generate memberId for interviewers and quality agents
    if (userType === 'interviewer' || userType === 'quality_agent') {
      try {
        userData.memberId = await generateMemberId();
      } catch (error) {
        console.error('Error generating member ID:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to generate member ID. Please try again.'
        });
      }
    }

    // Create user
    const user = await User.create(userData);

    // Update company's createdBy field if this is a company admin
    if (userType === 'company_admin' && company) {
      company.createdBy = user._id;
      await company.save();
    }

    // Generate token
    const token = generateToken(user._id);

    // Remove sensitive data from response
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      userType: user.userType,
      memberId: user.memberId, // Include memberId in response
      company: user.company,
      companyCode: user.companyCode,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token,
        company: company ? {
          _id: company._id,
          companyName: company.companyName,
          companyCode: company.companyCode,
          status: company.status
        } : null
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const loginIdentifier = email; // Can be email or memberId

    console.log('🔐 Login attempt:', { 
      loginIdentifier: loginIdentifier ? (loginIdentifier.length > 0 ? 'provided' : 'empty') : 'missing',
      hasPassword: !!password 
    });

    // Validate required fields
    if (!loginIdentifier || !password) {
      console.log('❌ Login failed: Missing credentials');
      return res.status(400).json({
        success: false,
        message: 'Please provide email/member ID and password'
      });
    }

    // Find user by email or memberId and include password
    // Check if it's a memberId (alphanumeric, no @) or email (contains @)
    // If it contains @, it's an email; otherwise, if it's alphanumeric, it's a memberId
    const isEmail = loginIdentifier.includes('@');
    const isMemberId = !isEmail && /^[A-Za-z0-9]+$/.test(loginIdentifier);
    
    // For memberID, use case-insensitive regex to allow login with any case (CAPI299, capi299, Capi299, etc.)
    // Escape special regex characters to prevent regex injection
    // For email, use lowercase as emails are stored in lowercase
    let query;
    if (isMemberId) {
      // Escape special regex characters and create case-insensitive regex
      const escapedMemberId = loginIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query = { memberId: { $regex: new RegExp(`^${escapedMemberId}$`, 'i') } };
    } else {
      query = { email: loginIdentifier.toLowerCase() };
    }
    
    const user = await User.findOne(query).select('+password').populate('company', 'companyName companyCode status');

    if (!user) {
      console.log('❌ Login failed: User not found', { query, isMemberId });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    console.log('✅ User found:', { 
      userId: user._id, 
      email: user.email, 
      userType: user.userType, 
      status: user.status,
      companyStatus: user.company?.status 
    });

    // Account locking has been disabled - users can attempt login unlimited times
    // Removed: Account lock check and login attempt tracking

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log('❌ Login failed: Invalid password', { userId: user._id });
      // Removed: await user.incLoginAttempts(); - Account locking disabled
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    console.log('✅ Password validated successfully');

    // Check if user is active
    if (user.status !== 'active') {
      console.log('❌ Login failed: User not active', { userId: user._id, status: user.status });
      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Please contact support.`
      });
    }

    // Check if company is active (for non-super-admin users)
    if (user.userType !== 'super_admin' && user.company && user.company.status !== 'active') {
      console.log('❌ Login failed: Company not active', { 
        userId: user._id, 
        companyId: user.company._id, 
        companyStatus: user.company.status 
      });
      return res.status(403).json({
        success: false,
        message: 'Your company account is not active. Please contact support.'
      });
    }

    // Reset login attempts and update last login
    await user.resetLoginAttempts();
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Remove sensitive data from response
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      userType: user.userType,
      company: user.company,
      companyCode: user.companyCode,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    };

    console.log('✅ Login successful:', { userId: user._id, userType: user.userType });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Protected
// Note: Since JWT tokens are stateless, logout is primarily handled client-side
// This endpoint exists for consistency and potential future token blacklisting
exports.logout = async (req, res) => {
  try {
    // JWT tokens are stateless, so logout is primarily handled client-side
    // by clearing the token from storage. This endpoint provides a clean
    // way for clients to notify the server of logout if needed.
    
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('company', 'companyName companyCode status industry')
      .populate('referredBy', 'firstName lastName email')
      .populate('assignedTeamMembers.user', 'firstName lastName email phone memberId userType interviewModes status preferences createdAt')
      .select('-password -emailVerificationToken -phoneVerificationOTP');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const allowedUpdates = [
      'firstName', 'lastName', 'phone', 'profile', 'preferences'
    ];
    
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password -emailVerificationToken -phoneVerificationOTP');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    // Find user with password
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({ emailVerificationToken: token });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Resend email verification
// @route   POST /api/auth/resend-verification
// @access  Private
exports.resendVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    user.emailVerificationToken = generateVerificationToken();
    await user.save();

    // TODO: Send verification email
    console.log(`Verification token for ${user.email}: ${user.emailVerificationToken}`);

    res.status(200).json({
      success: true,
      message: 'Verification email sent'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get available companies for registration
// @route   GET /api/auth/companies
// @access  Public
exports.getCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ status: 'active' })
      .select('companyName companyCode industry companySize')
      .sort({ companyName: 1 });

    res.status(200).json({
      success: true,
      data: companies
    });

  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get all users with pagination, search, and filtering
// @route   GET /api/auth/users
// @access  Private (Super Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;
    
    // Build search and filter criteria
    const search = req.query.search || '';
    const userType = req.query.userType || '';
    const status = req.query.status || '';
    const company = req.query.company || '';
    
    let query = {};
    
    // Search functionality
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by user type
    if (userType) {
      query.userType = userType;
    }
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // Filter by company
    if (company) {
      query.company = company;
    }
    
    // Get users with pagination
    const users = await User.find(query)
      .populate('company', 'companyName companyCode')
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await User.countDocuments(query);
    
    // Get companies for filter dropdown
    const companies = await Company.find({ status: 'active' }).select('companyName companyCode');
    
    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          limit,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        },
        filters: {
          companies,
          userTypes: ['super_admin', 'company_admin', 'project_manager', 'interviewer', 'quality_agent'],
          statuses: ['pending', 'active', 'inactive', 'suspended']
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/auth/users/:id
// @access  Private (Super Admin only)
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('company', 'companyName companyCode industry companySize')
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Update user
// @route   PUT /api/auth/users/:id
// @access  Private (Super Admin only)
exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const updateData = req.body;
    
    // Handle password update if provided
    if (updateData.password) {
      const bcrypt = require('bcryptjs');
      const saltRounds = 12;
      updateData.password = await bcrypt.hash(updateData.password, saltRounds);
    }
    
    // Handle gig_enabled logic: if gig_enabled is false, set gig_availability to false
    if (updateData.hasOwnProperty('gig_enabled') && !updateData.gig_enabled) {
      updateData.gig_availability = false;
    }
    
    // Handle interview mode fields: only set for interviewer users
    if (updateData.userType && updateData.userType !== 'interviewer') {
      // Remove interview mode fields if user type is not interviewer
      delete updateData.interviewModes;
      delete updateData.canSelectMode;
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).populate('company', 'companyName companyCode');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/auth/users/:id
// @access  Private (Super Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get user statistics
// @route   GET /api/auth/users/stats
// @access  Private (Super Admin only)
exports.getUserStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: '$userType',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const statusStats = await User.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const pendingUsers = await User.countDocuments({ status: 'pending' });
    
    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        pendingUsers,
        userTypeStats: stats,
        statusStats: statusStats
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ==================== COMPANY MANAGEMENT ====================

// @desc    Get all companies with pagination, search, and filtering
// @route   GET /api/auth/companies
// @access  Private (Super Admin only)
exports.getAllCompanies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    // Build search and filter criteria
    const search = req.query.search || '';
    const status = req.query.status || '';
    const industry = req.query.industry || '';

    let query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { companyCode: { $regex: search, $options: 'i' } },
        { industry: { $regex: search, $options: 'i' } },
        { companyEmail: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by industry
    if (industry) {
      query.industry = industry;
    }

    // Get companies with pagination
    const companies = await Company.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await Company.countDocuments(query);

    // Get unique industries for filter dropdown
    const industries = await Company.distinct('industry');

    res.status(200).json({
      success: true,
      data: {
        companies,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCompanies: total,
          limit,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        },
        filters: {
          industries,
          statuses: ['active', 'pending', 'inactive', 'suspended']
        }
      }
    });
  } catch (error) {
    console.error('Get all companies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get company by ID
// @route   GET /api/auth/companies/:id
// @access  Private (Super Admin only)
exports.getCompanyById = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email userType');

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    // Get all company admins for this company
    const companyAdmins = await User.find({ 
      company: company._id, 
      userType: 'company_admin' 
    }).select('firstName lastName email status createdAt');

    res.status(200).json({ 
      success: true, 
      data: { 
        company, 
        companyAdmins 
      } 
    });
  } catch (error) {
    console.error('Get company by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Update company
// @route   PUT /api/auth/companies/:id
// @access  Private (Super Admin only)
exports.updateCompany = async (req, res) => {
  try {
    const companyId = req.params.id;
    const updateData = req.body;

    const company = await Company.findByIdAndUpdate(
      companyId,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email');

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Company updated successfully',
      data: company
    });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Delete company
// @route   DELETE /api/auth/companies/:id
// @access  Private (Super Admin only)
exports.deleteCompany = async (req, res) => {
  try {
    const companyId = req.params.id;

    // Check if company has any users
    const userCount = await User.countDocuments({ company: companyId });
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete company. It has ${userCount} associated users. Please reassign or delete users first.`
      });
    }

    const company = await Company.findByIdAndDelete(companyId);

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Company deleted successfully'
    });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Add company admin to company
// @route   POST /api/auth/companies/:id/admins
// @access  Private (Super Admin only)
exports.addCompanyAdmin = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;
    const companyId = req.params.id;

    // Check if company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Sanitize phone number (remove spaces and special characters except digits)
    const sanitizedPhone = phone ? phone.replace(/\s+/g, '').replace(/[^\d]/g, '') : phone;

    // Validate required fields
    if (!firstName || !lastName || !email || !sanitizedPhone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Create new company admin
    const companyAdmin = new User({
      firstName,
      lastName,
      email,
      phone: sanitizedPhone,
      password,
      userType: 'company_admin',
      company: companyId,
      companyCode: company.companyCode,
      status: 'active',
      isEmailVerified: true,
      isPhoneVerified: true
    });

    await companyAdmin.save();

    // Populate company data
    await companyAdmin.populate('company', 'companyName companyCode');

    res.status(201).json({
      success: true,
      message: 'Company admin added successfully',
      data: companyAdmin
    });
  } catch (error) {
    console.error('Add company admin error:', error);
    
    // Handle validation errors specifically
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      const phoneError = messages.find(msg => msg.toLowerCase().includes('phone'));
      
      if (phoneError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number. Please enter a valid phone number without spaces.'
        });
      }
      
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Remove company admin from company
// @route   DELETE /api/auth/companies/:id/admins/:adminId
// @access  Private (Super Admin only)
exports.removeCompanyAdmin = async (req, res) => {
  try {
    const { id: companyId, adminId } = req.params;

    // Check if company admin exists and belongs to the company
    const companyAdmin = await User.findOne({
      _id: adminId,
      company: companyId,
      userType: 'company_admin'
    });

    if (!companyAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Company admin not found or does not belong to this company'
      });
    }

    // Delete the company admin
    await User.findByIdAndDelete(adminId);

    res.status(200).json({
      success: true,
      message: 'Company admin removed successfully'
    });
  } catch (error) {
    console.error('Remove company admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get company statistics
// @route   GET /api/auth/companies/stats
// @access  Private (Super Admin only)
exports.getCompanyStats = async (req, res) => {
  try {
    const stats = await Company.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const industryStats = await Company.aggregate([
      {
        $group: {
          _id: '$industry',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalCompanies = await Company.countDocuments();
    const activeCompanies = await Company.countDocuments({ status: 'active' });
    const pendingCompanies = await Company.countDocuments({ status: 'pending' });

    res.status(200).json({
      success: true,
      data: {
        totalCompanies,
        activeCompanies,
        pendingCompanies,
        statusStats: stats,
        industryStats: industryStats
      }
    });
  } catch (error) {
    console.error('Get company stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get company users (for company admin)
// @route   GET /api/auth/company/users
// @access  Private (Company Admin)
exports.getCompanyUsers = async (req, res) => {
  try {
    const { page = 1, limit = 15, search = '', userType = '', status = '' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get current user's company
    const currentUser = await User.findById(req.user.id).populate('company');
    if (!currentUser || !currentUser.company) {
      return res.status(400).json({
        success: false,
        message: 'User not associated with any company'
      });
    }

    // Build query for company users
    const query = {
      company: currentUser.company._id,
      userType: { $ne: 'super_admin' } // Exclude super admins
    };

    // Add search filter (includes memberId for interviewers and quality agents)
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { memberId: { $regex: search, $options: 'i' } } // Include memberId in search
      ];
    }

    // Add user type filter
    if (userType) {
      query.userType = userType;
    }

    // Add status filter
    if (status) {
      query.status = status;
    }

    // Get users with pagination
    let users = await User.find(query)
      .populate('company', 'companyName companyCode')
      .populate('assignedTeamMembers.user', 'firstName lastName email memberId userType')
      .select('-password -emailVerificationToken -phoneVerificationToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Add signed URLs to document fields for users with interviewerProfile
    const { getSignedUrl } = require('../utils/cloudStorage');
    const usersWithSignedUrls = await Promise.all(users.map(async (user) => {
      const userObj = user.toObject ? user.toObject() : user;
      if (userObj.interviewerProfile) {
        const docFields = ['cvUpload', 'aadhaarDocument', 'panDocument', 'passportPhoto', 'bankDocumentUpload'];
        for (const field of docFields) {
          if (userObj.interviewerProfile[field]) {
            try {
              const signedUrl = await getSignedUrl(userObj.interviewerProfile[field], 3600);
              userObj.interviewerProfile[field + 'SignedUrl'] = signedUrl;
            } catch (error) {
              console.error(`Error generating signed URL for ${field}:`, error);
              // Continue without signed URL
            }
          }
        }
      }
      return userObj;
    }));

    // Get total count
    const totalUsers = await User.countDocuments(query);

    // Get available filters
    const userTypes = await User.distinct('userType', { 
      company: currentUser.company._id,
      userType: { $ne: 'super_admin' }
    });
    const statuses = await User.distinct('status', { 
      company: currentUser.company._id,
      userType: { $ne: 'super_admin' }
    });

    res.status(200).json({
      success: true,
      data: {
        users: usersWithSignedUrls,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalUsers / limitNum),
          totalUsers,
          hasNext: pageNum < Math.ceil(totalUsers / limitNum),
          hasPrev: pageNum > 1
        },
        filters: {
          userTypes,
          statuses
        }
      }
    });
  } catch (error) {
    console.error('Get company users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Register company user (for company admin)
// @route   POST /api/auth/company/register-user
// @access  Private (Company Admin)
exports.registerCompanyUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      userType,
      status,
      gig_enabled,
      interviewModes,
      canSelectMode,
      assignedTeamMembers
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !password || !userType) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Validate user type (company admin can only create certain types)
    const allowedUserTypes = ['project_manager', 'interviewer', 'quality_agent', 'Data_Analyst'];
    if (!allowedUserTypes.includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type for company user'
      });
    }

    // Get current user's company
    const currentUser = await User.findById(req.user.id).populate('company');
    if (!currentUser || !currentUser.company) {
      return res.status(400).json({
        success: false,
        message: 'User not associated with any company'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Check if phone already exists
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: 'User with this phone number already exists'
      });
    }

    // Generate user data
    const userData = {
      firstName,
      lastName,
      email,
      phone,
      password,
      userType,
      company: currentUser.company._id,
      companyCode: currentUser.company.companyCode,
      emailVerificationToken: generateVerificationToken(),
      registrationSource: 'company_admin',
      status: status || 'active',
      gig_enabled: gig_enabled || false, // Admin can enable gig feature
      gig_availability: false // Company users are not available for gig work by default
    };

    // Add interview mode settings for interviewer users
    if (userType === 'interviewer') {
      userData.interviewModes = interviewModes || 'Both';
      userData.canSelectMode = canSelectMode || false;
    }

    // Add assignedTeamMembers for project managers
    if (userType === 'project_manager' && assignedTeamMembers && Array.isArray(assignedTeamMembers)) {
      // Validate assigned team members
      for (const assignment of assignedTeamMembers) {
        if (!assignment.user || !assignment.userType) {
          return res.status(400).json({
            success: false,
            message: 'Each assigned team member must have a user ID and userType'
          });
        }

        // Validate userType
        if (!['interviewer', 'quality_agent'].includes(assignment.userType)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid userType for assigned team member. Must be interviewer or quality_agent'
          });
        }

        // Check if the assigned user exists and belongs to the same company
        const assignedUser = await User.findById(assignment.user);
        if (!assignedUser) {
          return res.status(400).json({
            success: false,
            message: `Assigned ${assignment.userType} with ID ${assignment.user} not found`
          });
        }

        if (assignedUser.company.toString() !== currentUser.company._id.toString()) {
          return res.status(400).json({
            success: false,
            message: `Assigned ${assignment.userType} must belong to the same company`
          });
        }

        if (assignedUser.userType !== assignment.userType) {
          return res.status(400).json({
            success: false,
            message: `User type mismatch for assigned ${assignment.userType}`
          });
        }
      }
      userData.assignedTeamMembers = assignedTeamMembers;
    }

    // Generate memberId for interviewers and quality agents
    if (userType === 'interviewer' || userType === 'quality_agent') {
      try {
        userData.memberId = await generateMemberId();
      } catch (error) {
        console.error('Error generating member ID:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to generate member ID. Please try again.'
        });
      }
    }

    // Create user
    const user = await User.create(userData);

    // Populate assignedTeamMembers for response
    await user.populate('assignedTeamMembers.user', 'firstName lastName email memberId userType');

    // Generate token
    const token = generateToken(user._id);

    // Remove sensitive data from response
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      userType: user.userType,
      memberId: user.memberId, // Include memberId in response
      company: user.company,
      companyCode: user.companyCode,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      assignedTeamMembers: user.assignedTeamMembers, // Include assignedTeamMembers in response
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'Company user created successfully',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Register company user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Update company user (for company admin)
// @route   PUT /api/auth/company/users/:id
// @access  Private (Company Admin)
exports.updateCompanyUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Get current user's company
    const currentUser = await User.findById(req.user.id).populate('company');
    if (!currentUser || !currentUser.company) {
      return res.status(400).json({
        success: false,
        message: 'User not associated with any company'
      });
    }

    // Find the user to update
    const userToUpdate = await User.findById(id).populate('company');
    if (!userToUpdate) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if the user belongs to the same company
    if (userToUpdate.company._id.toString() !== currentUser.company._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update users from your own company'
      });
    }

    // Prevent updating super admins
    if (userToUpdate.userType === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot update super admin users'
      });
    }

    // Clean up empty strings for enum fields
    if (updateData.profile) {
      if (updateData.profile.gender === '') {
        updateData.profile.gender = undefined;
      }
      if (updateData.profile.languageLevel === '') {
        updateData.profile.languageLevel = undefined;
      }
    }
    
    // Clean up other enum fields
    if (updateData.status === '') {
      updateData.status = undefined;
    }
    if (updateData.userType === '') {
      updateData.userType = undefined;
    }
    if (updateData.registrationSource === '') {
      updateData.registrationSource = undefined;
    }

    // Handle password update if provided
    if (updateData.password) {
      const bcrypt = require('bcryptjs');
      const saltRounds = 12;
      updateData.password = await bcrypt.hash(updateData.password, saltRounds);
    }

    // Handle gig_enabled logic: if gig_enabled is false, set gig_availability to false
    if (updateData.hasOwnProperty('gig_enabled') && !updateData.gig_enabled) {
      updateData.gig_availability = false;
    }
    
    // Handle interview mode fields: only set for interviewer users
    if (updateData.userType && updateData.userType !== 'interviewer') {
      // Remove interview mode fields if user type is not interviewer
      delete updateData.interviewModes;
      delete updateData.canSelectMode;
    }

    // Handle assignedTeamMembers for project managers
    if (updateData.assignedTeamMembers && Array.isArray(updateData.assignedTeamMembers)) {
      // Validate assigned team members
      for (const assignment of updateData.assignedTeamMembers) {
        if (!assignment.user || !assignment.userType) {
          return res.status(400).json({
            success: false,
            message: 'Each assigned team member must have a user ID and userType'
          });
        }

        // Validate userType
        if (!['interviewer', 'quality_agent'].includes(assignment.userType)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid userType for assigned team member. Must be interviewer or quality_agent'
          });
        }

        // Check if the assigned user exists and belongs to the same company
        const assignedUser = await User.findById(assignment.user);
        if (!assignedUser) {
          return res.status(400).json({
            success: false,
            message: `Assigned ${assignment.userType} with ID ${assignment.user} not found`
          });
        }

        if (assignedUser.company.toString() !== currentUser.company._id.toString()) {
          return res.status(400).json({
            success: false,
            message: `Assigned ${assignment.userType} must belong to the same company`
          });
        }

        if (assignedUser.userType !== assignment.userType) {
          return res.status(400).json({
            success: false,
            message: `User type mismatch for assigned ${assignment.userType}`
          });
        }
      }
    }

    // Update the user
    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('company', 'companyName companyCode')
    .populate('assignedTeamMembers.user', 'firstName lastName email memberId userType')
    .select('-password -emailVerificationToken -phoneVerificationToken');

    res.status(200).json({
      success: true,
      message: 'Company user updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('Update company user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Delete company user (for company admin)
// @route   DELETE /api/auth/company/users/:id
// @access  Private (Company Admin)
exports.deleteCompanyUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Get current user's company
    const currentUser = await User.findById(req.user.id).populate('company');
    if (!currentUser || !currentUser.company) {
      return res.status(400).json({
        success: false,
        message: 'User not associated with any company'
      });
    }

    // Find the user to delete
    const userToDelete = await User.findById(id).populate('company');
    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if the user belongs to the same company
    if (userToDelete.company._id.toString() !== currentUser.company._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete users from your own company'
      });
    }

    // Prevent deleting super admins
    if (userToDelete.userType === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete super admin users'
      });
    }

    // Delete the user
    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Company user deleted successfully'
    });
  } catch (error) {
    console.error('Delete company user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Forgot password - send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Input validation
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        success: true,
        message: 'If an account with this email exists, a verification code has been sent'
      });
    }

    // Generate 6-digit OTP
    const otp = generateOTP();
    
    // Create HMAC signature with email and OTP
    const signature = createOTPSignature(email.trim().toLowerCase(), otp);
    
    // Set expiry to 5 minutes from now
    const expiry = Date.now() + (5 * 60 * 1000); // 5 minutes in milliseconds
    
    // Create emailHash: signature.expiry
    const emailHash = `${signature}.${expiry}`;

    // Send OTP via email
    await sendOTPEmail(email.trim().toLowerCase(), otp);

    // Log the attempt (but not the OTP) for security monitoring
    console.log(`Password reset requested for email: ${email.trim().toLowerCase()}`);

    res.status(200).json({
      success: true,
      emailHash: emailHash,
      message: 'OTP sent successfully'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};

// @desc    Verify OTP for password reset
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp, emailHash } = req.body;

    // Input validation
    if (!email || !otp || !emailHash) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and emailHash are required'
      });
    }

    // Parse emailHash to get signature and expiry
    const [signature, expiryStr] = emailHash.split('.');
    if (!signature || !expiryStr) {
      return res.status(400).json({
        success: false,
        message: 'Invalid emailHash format'
      });
    }

    // Check if OTP has expired
    const expiry = parseInt(expiryStr);
    if (isNaN(expiry) || Date.now() > expiry) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // Verify OTP signature using timing-safe comparison
    if (!verifyOTPSignature(email.trim().toLowerCase(), otp, signature)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create JWT reset token with short expiry (15 minutes)
    const resetToken = jwt.sign(
      { 
        email: email.trim().toLowerCase(),
        type: 'password_reset'
      },
      process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
      { expiresIn: '15m' }
    );

    // Log successful verification for security monitoring
    console.log(`OTP verified successfully for email: ${email.trim().toLowerCase()}`);

    res.status(200).json({
      success: true,
      resetToken: resetToken,
      message: 'OTP verified successfully'
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};

// @desc    Reset password with new password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, email, newPassword, confirmPassword } = req.body;

    // Input validation
    if (!resetToken || !email || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'your-jwt-secret-change-in-production');
    } catch (jwtError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Check if token is for password reset
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    // Verify email matches token
    if (decoded.email !== email.trim().toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Token email mismatch'
      });
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Validate password strength
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: passwordErrors.join(', ')
      });
    }

    // Find user
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user password - let the pre-save middleware handle hashing
    // The User model has a pre-save hook that automatically hashes the password
    // when it's modified, so we don't need to hash it manually here
    user.password = newPassword;
    await user.save();

    // Log successful password reset for security monitoring
    console.log(`Password reset successfully for email: ${email.trim().toLowerCase()}`);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};

// @desc    Check if member ID is available
// @route   GET /api/auth/check-member-id/:memberId
// @access  Private (Project Manager, Company Admin)
exports.checkMemberIdAvailability = async (req, res) => {
  try {
    const { memberId } = req.params;

    if (!memberId || memberId.trim() === '') {
      return res.status(400).json({
        success: false,
        available: false,
        message: 'Member ID is required'
      });
    }

    // Check if member ID already exists (case-insensitive)
    const existingUser = await User.findOne({
      memberId: { $regex: new RegExp(`^${memberId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });

    if (existingUser) {
      return res.status(200).json({
        success: true,
        available: false,
        message: 'Member ID already exists',
        existingUser: {
          name: `${existingUser.firstName} ${existingUser.lastName}`,
          email: existingUser.email,
          userType: existingUser.userType
        }
      });
    }

    return res.status(200).json({
      success: true,
      available: true,
      message: 'Member ID is available'
    });
  } catch (error) {
    console.error('Check member ID availability error:', error);
    res.status(500).json({
      success: false,
      available: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Add interviewer by project manager
// @route   POST /api/auth/project-manager/add-interviewer
// @access  Private (Project Manager)
exports.addInterviewerByProjectManager = async (req, res) => {
  try {
    const {
      interviewerType, // 'CAPI' or 'CATI'
      interviewerId, // Member ID (optional - will be auto-generated if not provided)
      firstName,
      lastName,
      phone,
      password,
      usePhoneAsPassword,
      surveyIds, // Array of survey IDs to assign interviewer to
      capiSurveyIds, // For CAPI interviewers
      catiSurveyIds // For CATI interviewers
    } = req.body;

    // Validate required fields
    if (!interviewerType || !firstName || !lastName || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Interviewer type, first name, last name, and phone are required'
      });
    }

    if (!['CAPI', 'CATI'].includes(interviewerType)) {
      return res.status(400).json({
        success: false,
        message: 'Interviewer type must be either CAPI or CATI'
      });
    }

    // Get current user (project manager)
    const projectManager = await User.findById(req.user.id).populate('company');
    if (!projectManager || projectManager.userType !== 'project_manager') {
      return res.status(403).json({
        success: false,
        message: 'Only project managers can add interviewers'
      });
    }

    if (!projectManager.company) {
      return res.status(400).json({
        success: false,
        message: 'Project manager not associated with any company'
      });
    }

    // Normalize phone number (remove country code)
    let normalizedPhone = phone.replace(/^\+91/, '').replace(/^91/, '').trim();
    if (normalizedPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 10 digits'
      });
    }

    // Determine password
    const finalPassword = usePhoneAsPassword ? normalizedPhone : password;
    if (!finalPassword || finalPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Handle member ID
    let finalMemberId = interviewerId;
    if (!finalMemberId || finalMemberId.trim() === '') {
      // Auto-generate member ID
      if (interviewerType === 'CAPI') {
        // For CAPI, generate like CAPI12345 (up to 5 digits)
        let attempts = 0;
        let isUnique = false;
        while (!isUnique && attempts < 100) {
          const randomNum = Math.floor(10000 + Math.random() * 90000); // 5 digits
          finalMemberId = `CAPI${randomNum}`;
          const existing = await User.findOne({ memberId: finalMemberId });
          if (!existing) {
            isUnique = true;
          }
          attempts++;
        }
        if (!isUnique) {
          return res.status(500).json({
            success: false,
            message: 'Failed to generate unique CAPI member ID'
          });
        }
      } else {
        // For CATI, generate numeric ID (up to 5 digits)
        finalMemberId = await generateMemberId();
      }
    } else {
      // Validate provided member ID
      if (interviewerType === 'CAPI') {
        // CAPI must start with "CAPI" prefix
        if (!finalMemberId.toUpperCase().startsWith('CAPI')) {
          finalMemberId = `CAPI${finalMemberId.replace(/^CAPI/i, '')}`;
        }
        // Extract numeric part and ensure it's max 5 digits
        const numericPart = finalMemberId.replace(/^CAPI/i, '');
        if (numericPart.length > 5) {
          return res.status(400).json({
            success: false,
            message: 'CAPI Interviewer ID can only have up to 5 digits after "CAPI" prefix'
          });
        }
        finalMemberId = `CAPI${numericPart.padStart(1, '0')}`;
      } else {
        // CATI must be numeric, max 5 digits
        if (!/^\d+$/.test(finalMemberId)) {
          return res.status(400).json({
            success: false,
            message: 'CATI Interviewer ID must be numeric (up to 5 digits)'
          });
        }
        if (finalMemberId.length > 5) {
          return res.status(400).json({
            success: false,
            message: 'CATI Interviewer ID can only have up to 5 digits'
          });
        }
      }

      // Check if member ID is available
      const existingUser = await User.findOne({
        memberId: { $regex: new RegExp(`^${finalMemberId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: `Interviewer ID "${finalMemberId}" is already taken`
        });
      }
    }

    // Check if email/phone already exists
    const emailToCheck = `${interviewerType.toLowerCase()}${finalMemberId}@gmail.com`;
    const existingEmail = await User.findOne({ email: emailToCheck.toLowerCase() });
    const existingPhoneUser = await User.findOne({ phone: normalizedPhone });

    if (existingEmail || existingPhoneUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or phone already exists'
      });
    }

    // Get reference user for default values
    const referenceUser = await User.findOne({
      userType: 'interviewer',
      company: projectManager.company._id,
      interviewModes: interviewerType === 'CAPI' ? 'CAPI (Face To Face)' : 'CATI (Telephonic interview)'
    }).limit(1);

    // Password will be hashed by User model's pre-save hook
    // Don't pre-hash it, let the model handle it

    // Create user data
    const userData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: emailToCheck.toLowerCase(),
      phone: normalizedPhone,
      password: finalPassword, // Plain password - will be hashed by pre-save hook
      userType: 'interviewer',
      interviewModes: interviewerType === 'CAPI' ? 'CAPI (Face To Face)' : 'CATI (Telephonic interview)',
      canSelectMode: false,
      company: projectManager.company._id,
      companyCode: projectManager.companyCode,
      memberId: finalMemberId,
      status: 'active',
      isActive: true,
      isEmailVerified: false,
      isPhoneVerified: false,
      gig_enabled: false,
      gig_availability: false,
      registrationSource: 'company_admin',
      profile: referenceUser?.profile || { languages: [], education: [], experience: [] },
      documents: referenceUser?.documents || {
        aadhaar: { isVerified: false },
        pan: { isVerified: false },
        drivingLicense: { isVerified: false },
        bankDetails: { isVerified: false }
      },
      performance: referenceUser?.performance || {
        trustScore: 100,
        totalInterviews: 0,
        approvedInterviews: 0,
        rejectedInterviews: 0,
        averageRating: 0,
        totalEarnings: 0,
        qualityMetrics: {
          audioQuality: 0,
          responseAccuracy: 0,
          timeliness: 0,
          professionalism: 0
        }
      },
      preferences: {
        notifications: {
          email: true,
          sms: true,
          push: true,
          surveyAssignments: true,
          paymentUpdates: true,
          qualityFeedback: true
        },
        workingHours: {
          startTime: '09:00',
          endTime: '18:00',
          workingDays: [],
          timezone: 'Asia/Kolkata'
        },
        surveyPreferences: {
          maxDistance: 50,
          preferredLocations: [],
          minPayment: 0,
          maxInterviewsPerDay: 10
        },
        locationControlBooster: false // Default to false
      },
      training: {
        completedModules: [],
        certificationStatus: 'not_started'
      },
      interviewerProfile: {
        age: referenceUser?.interviewerProfile?.age || 28,
        gender: referenceUser?.interviewerProfile?.gender || 'male',
        languagesSpoken: referenceUser?.interviewerProfile?.languagesSpoken || ['Hindi', 'English'],
        highestDegree: referenceUser?.interviewerProfile?.highestDegree || {
          name: 'B.Tech',
          institution: 'NIT',
          year: 2019
        },
        hasSurveyExperience: true,
        surveyExperienceYears: 3,
        surveyExperienceDescription: `Experienced in ${interviewerType === 'CAPI' ? 'face-to-face' : 'telephonic'} surveys`,
        cvUpload: referenceUser?.interviewerProfile?.cvUpload || 'cvUpload-1764630127133-571761495.docx',
        ownsSmartphone: true,
        smartphoneType: 'Both',
        androidVersion: '13',
        iosVersion: '',
        willingToTravel: true,
        hasVehicle: true,
        willingToRecordAudio: true,
        agreesToRemuneration: true,
        bankAccountNumber: referenceUser?.interviewerProfile?.bankAccountNumber || '786897980',
        bankAccountHolderName: `${firstName.toUpperCase()} ${lastName.toUpperCase()}`,
        bankName: referenceUser?.interviewerProfile?.bankName || 'HDFC',
        bankIfscCode: referenceUser?.interviewerProfile?.bankIfscCode || 'HDFC0001234',
        bankDocumentUpload: referenceUser?.interviewerProfile?.bankDocumentUpload || 'bankDocumentUpload-1764630178675-881719772.png',
        aadhaarNumber: referenceUser?.interviewerProfile?.aadhaarNumber || '876897697890',
        aadhaarDocument: referenceUser?.interviewerProfile?.aadhaarDocument || 'aadhaarDocument-1764630188489-204099240.png',
        panNumber: referenceUser?.interviewerProfile?.panNumber || '7868979879',
        panDocument: referenceUser?.interviewerProfile?.panDocument || 'panDocument-1764630192433-387051607.png',
        passportPhoto: referenceUser?.interviewerProfile?.passportPhoto || 'passportPhoto-1764630195659-468808359.png',
        agreesToShareInfo: true,
        agreesToParticipateInSurvey: true,
        approvalStatus: 'approved',
        approvalFeedback: `Approved for ${interviewerType}`,
        approvedBy: projectManager._id,
        approvedAt: new Date(),
        lastSubmittedAt: new Date()
      },
      loginAttempts: 0,
      assignedTeamMembers: []
    };

    // Create the interviewer
    const newInterviewer = await User.create(userData);

    // Verify password was hashed correctly (like addCAPIInterviewers.js does)
    const bcrypt = require('bcryptjs');
    const savedUser = await User.findById(newInterviewer._id).select('+password');
    const passwordValid = await savedUser.comparePassword(finalPassword);
    
    if (!passwordValid) {
      console.log(`⚠️  Password verification failed, retrying...`);
      // Re-hash and update directly (bypassing pre-save hook)
      const retrySalt = await bcrypt.genSalt(12);
      const retryHashedPassword = await bcrypt.hash(finalPassword, retrySalt);
      await User.updateOne(
        { _id: savedUser._id },
        { $set: { password: retryHashedPassword } }
      );
      
      // Verify again
      const retryUser = await User.findById(savedUser._id).select('+password');
      const retryValid = await retryUser.comparePassword(finalPassword);
      if (!retryValid) {
        // If still fails, delete the user and return error
        await User.deleteOne({ _id: newInterviewer._id });
        return res.status(500).json({
          success: false,
          message: 'Failed to set password correctly. Please try again.'
        });
      }
    }

    // Assign interviewer to project manager
    if (!projectManager.assignedTeamMembers) {
      projectManager.assignedTeamMembers = [];
    }

    // Check if already assigned
    const alreadyAssigned = projectManager.assignedTeamMembers.some(
      member => member.user && member.user.toString() === newInterviewer._id.toString()
    );

    if (!alreadyAssigned) {
      projectManager.assignedTeamMembers.push({
        user: newInterviewer._id,
        userType: 'interviewer',
        assignedAt: new Date(),
        assignedBy: projectManager._id
      });
      await projectManager.save();
    }

    // Assign to surveys if provided
    const Survey = require('../models/Survey');
    if (surveyIds && Array.isArray(surveyIds) && surveyIds.length > 0) {
      for (const surveyId of surveyIds) {
        try {
          const survey = await Survey.findById(surveyId);
          if (!survey) continue;

          // Check if survey belongs to same company
          if (survey.company.toString() !== projectManager.company._id.toString()) {
            continue;
          }

          if (interviewerType === 'CAPI') {
            // Assign to CAPI interviewers
            if (!survey.capiInterviewers) {
              survey.capiInterviewers = [];
            }
            const existingCAPI = survey.capiInterviewers.find(
              assignment => assignment.interviewer.toString() === newInterviewer._id.toString()
            );
            if (!existingCAPI) {
              survey.capiInterviewers.push({
                interviewer: newInterviewer._id,
                assignedBy: projectManager._id,
                assignedAt: new Date(),
                status: 'assigned',
                maxInterviews: 0,
                completedInterviews: 0
              });
            }
          } else {
            // Assign to CATI interviewers
            if (!survey.catiInterviewers) {
              survey.catiInterviewers = [];
            }
            const existingCATI = survey.catiInterviewers.find(
              assignment => assignment.interviewer.toString() === newInterviewer._id.toString()
            );
            if (!existingCATI) {
              survey.catiInterviewers.push({
                interviewer: newInterviewer._id,
                assignedBy: projectManager._id,
                assignedAt: new Date(),
                status: 'assigned',
                maxInterviews: 0,
                completedInterviews: 0
              });
            }
          }
          await survey.save();
        } catch (error) {
          console.error(`Error assigning interviewer to survey ${surveyId}:`, error);
          // Continue with other surveys
        }
      }
    }

    // Also handle separate CAPI/CATI survey assignments if provided
    if (capiSurveyIds && Array.isArray(capiSurveyIds) && capiSurveyIds.length > 0 && interviewerType === 'CAPI') {
      for (const surveyId of capiSurveyIds) {
        try {
          const survey = await Survey.findById(surveyId);
          if (!survey || survey.company.toString() !== projectManager.company._id.toString()) continue;

          if (!survey.capiInterviewers) {
            survey.capiInterviewers = [];
          }
          const existing = survey.capiInterviewers.find(
            assignment => assignment.interviewer.toString() === newInterviewer._id.toString()
          );
          if (!existing) {
            survey.capiInterviewers.push({
              interviewer: newInterviewer._id,
              assignedBy: projectManager._id,
              assignedAt: new Date(),
              status: 'assigned',
              maxInterviews: 0,
              completedInterviews: 0
            });
            await survey.save();
          }
        } catch (error) {
          console.error(`Error assigning CAPI interviewer to survey ${surveyId}:`, error);
        }
      }
    }

    if (catiSurveyIds && Array.isArray(catiSurveyIds) && catiSurveyIds.length > 0 && interviewerType === 'CATI') {
      for (const surveyId of catiSurveyIds) {
        try {
          const survey = await Survey.findById(surveyId);
          if (!survey || survey.company.toString() !== projectManager.company._id.toString()) continue;

          if (!survey.catiInterviewers) {
            survey.catiInterviewers = [];
          }
          const existing = survey.catiInterviewers.find(
            assignment => assignment.interviewer.toString() === newInterviewer._id.toString()
          );
          if (!existing) {
            survey.catiInterviewers.push({
              interviewer: newInterviewer._id,
              assignedBy: projectManager._id,
              assignedAt: new Date(),
              status: 'assigned',
              maxInterviews: 0,
              completedInterviews: 0
            });
            await survey.save();
          }
        } catch (error) {
          console.error(`Error assigning CATI interviewer to survey ${surveyId}:`, error);
        }
      }
    }

    // Populate for response
    await newInterviewer.populate('company', 'companyName companyCode');

    res.status(201).json({
      success: true,
      message: 'Interviewer added successfully',
      data: {
        interviewer: {
          _id: newInterviewer._id,
          firstName: newInterviewer.firstName,
          lastName: newInterviewer.lastName,
          email: newInterviewer.email,
          phone: newInterviewer.phone,
          memberId: newInterviewer.memberId,
          userType: newInterviewer.userType,
          interviewModes: newInterviewer.interviewModes,
          status: newInterviewer.status,
          company: newInterviewer.company
        }
      }
    });
  } catch (error) {
    console.error('Add interviewer by project manager error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Update interviewer preferences by project manager
// @route   PUT /api/auth/project-manager/interviewer/:id/preferences
// @access  Private (Project Manager)
exports.updateInterviewerPreferencesByPM = async (req, res) => {
  try {
    const { id } = req.params;
    const { preferences } = req.body;

    // Get current user (project manager)
    const projectManager = await User.findById(req.user.id).populate('company');
    if (!projectManager || projectManager.userType !== 'project_manager') {
      return res.status(403).json({
        success: false,
        message: 'Only project managers can update interviewer preferences'
      });
    }

    if (!projectManager.company) {
      return res.status(400).json({
        success: false,
        message: 'Project manager not associated with any company'
      });
    }

    // Find the interviewer to update
    const interviewer = await User.findById(id).populate('company');
    if (!interviewer) {
      return res.status(404).json({
        success: false,
        message: 'Interviewer not found'
      });
    }

    // Check if interviewer belongs to the same company
    if (interviewer.company._id.toString() !== projectManager.company._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Interviewer does not belong to your company'
      });
    }

    // Check if interviewer is assigned to this project manager
    if (!projectManager.assignedTeamMembers || !Array.isArray(projectManager.assignedTeamMembers)) {
      return res.status(403).json({
        success: false,
        message: 'Interviewer is not assigned to you'
      });
    }

    const isAssigned = projectManager.assignedTeamMembers.some(
      member => member.user && member.user.toString() === interviewer._id.toString()
    );

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You can only update preferences for interviewers assigned to you'
      });
    }

    // Update preferences
    if (preferences) {
      interviewer.preferences = {
        ...interviewer.preferences,
        ...preferences
      };
    }

    await interviewer.save();

    res.status(200).json({
      success: true,
      message: 'Interviewer preferences updated successfully',
      data: {
        interviewer: {
          _id: interviewer._id,
          firstName: interviewer.firstName,
          lastName: interviewer.lastName,
          preferences: interviewer.preferences
        }
      }
    });
  } catch (error) {
    console.error('Update interviewer preferences by PM error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get surveys assigned to an interviewer
// @route   GET /api/auth/project-manager/interviewer/:id/surveys
// @access  Private (Project Manager)
exports.getInterviewerSurveys = async (req, res) => {
  try {
    const { id } = req.params;
    const projectManager = await User.findById(req.user.id).populate('company');
    
    if (!projectManager || projectManager.userType !== 'project_manager') {
      return res.status(403).json({
        success: false,
        message: 'Only project managers can view interviewer surveys'
      });
    }

    if (!projectManager.company) {
      return res.status(400).json({
        success: false,
        message: 'Project manager not associated with any company'
      });
    }

    // Find the interviewer
    const interviewer = await User.findById(id).populate('company');
    if (!interviewer) {
      return res.status(404).json({
        success: false,
        message: 'Interviewer not found'
      });
    }

    // Check if interviewer belongs to the same company
    if (interviewer.company._id.toString() !== projectManager.company._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Interviewer does not belong to your company'
      });
    }

    // Check if interviewer is assigned to this project manager
    if (!projectManager.assignedTeamMembers || !Array.isArray(projectManager.assignedTeamMembers)) {
      return res.status(403).json({
        success: false,
        message: 'Interviewer is not assigned to you'
      });
    }

    const isAssigned = projectManager.assignedTeamMembers.some(
      member => member.user && member.user.toString() === interviewer._id.toString()
    );

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You can only view surveys for interviewers assigned to you'
      });
    }

    const Survey = require('../models/Survey');
    const mongoose = require('mongoose');
    const interviewerId = new mongoose.Types.ObjectId(id);

    // Find all surveys where this interviewer is assigned
    const surveys = await Survey.find({
      company: projectManager.company._id,
      $or: [
        { 'capiInterviewers.interviewer': interviewerId },
        { 'catiInterviewers.interviewer': interviewerId }
      ]
    })
    .select('surveyName description status mode capiInterviewers catiInterviewers createdAt')
    .lean();

    // Map surveys with assignment mode
    const surveysWithMode = surveys.map(survey => {
      const isCAPI = survey.capiInterviewers?.some(
        assignment => assignment.interviewer.toString() === id
      );
      const isCATI = survey.catiInterviewers?.some(
        assignment => assignment.interviewer.toString() === id
      );
      
      let assignedMode = null;
      if (isCAPI && isCATI) {
        assignedMode = 'Both';
      } else if (isCAPI) {
        assignedMode = 'CAPI';
      } else if (isCATI) {
        assignedMode = 'CATI';
      }

      return {
        _id: survey._id,
        surveyName: survey.surveyName,
        description: survey.description,
        status: survey.status,
        mode: survey.mode,
        assignedMode,
        createdAt: survey.createdAt
      };
    });

    res.status(200).json({
      success: true,
      data: {
        surveys: surveysWithMode
      }
    });
  } catch (error) {
    console.error('Get interviewer surveys error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Update interviewer (basic info and password)
// @route   PUT /api/auth/project-manager/interviewer/:id
// @access  Private (Project Manager)
exports.updateInterviewerByPM = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, password, resetPasswordToPhone } = req.body;
    const projectManager = await User.findById(req.user.id).populate('company');
    
    if (!projectManager || projectManager.userType !== 'project_manager') {
      return res.status(403).json({
        success: false,
        message: 'Only project managers can update interviewers'
      });
    }

    if (!projectManager.company) {
      return res.status(400).json({
        success: false,
        message: 'Project manager not associated with any company'
      });
    }

    // Find the interviewer
    const interviewer = await User.findById(id).populate('company');
    if (!interviewer) {
      return res.status(404).json({
        success: false,
        message: 'Interviewer not found'
      });
    }

    // Check if interviewer belongs to the same company
    if (interviewer.company._id.toString() !== projectManager.company._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Interviewer does not belong to your company'
      });
    }

    // Check if interviewer is assigned to this project manager
    if (!projectManager.assignedTeamMembers || !Array.isArray(projectManager.assignedTeamMembers)) {
      return res.status(403).json({
        success: false,
        message: 'Interviewer is not assigned to you'
      });
    }

    const isAssigned = projectManager.assignedTeamMembers.some(
      member => member.user && member.user.toString() === interviewer._id.toString()
    );

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You can only update interviewers assigned to you'
      });
    }

    // Update basic info
    if (firstName) interviewer.firstName = firstName.trim();
    if (lastName) interviewer.lastName = lastName.trim();
    if (phone) {
      // Normalize phone number
      let normalizedPhone = phone.replace(/^\+91/, '').replace(/^91/, '').trim();
      interviewer.phone = normalizedPhone;
    }

    // Handle password reset
    const bcrypt = require('bcryptjs');
    if (resetPasswordToPhone) {
      const phoneForPassword = interviewer.phone || phone;
      if (phoneForPassword) {
        // Hash password manually to ensure it works (like addCAPIInterviewers.js)
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(phoneForPassword, salt);
        // Use updateOne to bypass pre-save hook and set hashed password directly
        await User.updateOne(
          { _id: interviewer._id },
          { $set: { password: hashedPassword } }
        );
        // Verify password
        const updatedUser = await User.findById(interviewer._id).select('+password');
        const passwordValid = await updatedUser.comparePassword(phoneForPassword);
        if (!passwordValid) {
          // Retry if verification fails
          const retrySalt = await bcrypt.genSalt(12);
          const retryHashedPassword = await bcrypt.hash(phoneForPassword, retrySalt);
          await User.updateOne(
            { _id: interviewer._id },
            { $set: { password: retryHashedPassword } }
          );
        }
      }
    } else if (password) {
      // Hash password manually to ensure it works
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);
      // Use updateOne to bypass pre-save hook and set hashed password directly
      await User.updateOne(
        { _id: interviewer._id },
        { $set: { password: hashedPassword } }
      );
      // Verify password
      const updatedUser = await User.findById(interviewer._id).select('+password');
      const passwordValid = await updatedUser.comparePassword(password);
      if (!passwordValid) {
        // Retry if verification fails
        const retrySalt = await bcrypt.genSalt(12);
        const retryHashedPassword = await bcrypt.hash(password, retrySalt);
        await User.updateOne(
          { _id: interviewer._id },
          { $set: { password: retryHashedPassword } }
        );
      }
    }

    await interviewer.save();

    res.status(200).json({
      success: true,
      message: 'Interviewer updated successfully',
      data: {
        interviewer: {
          _id: interviewer._id,
          firstName: interviewer.firstName,
          lastName: interviewer.lastName,
          phone: interviewer.phone,
          email: interviewer.email
        }
      }
    });
  } catch (error) {
    console.error('Update interviewer by PM error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Search interviewers by memberId (for Reports V2)
// @route   GET /api/auth/search-interviewer
// @access  Private (Company Admin, Project Manager)
exports.searchInterviewerByMemberId = async (req, res) => {
  try {
    const { memberId, surveyId } = req.query;
    const mongoose = require('mongoose');

    if (!memberId || !memberId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Member ID is required'
      });
    }

    // Build query - search for interviewers, but also allow searching for supervisors (project managers)
    // For CSV download, we need to find supervisors too, so we'll search for any user with matching memberId
    // But for normal search, we'll restrict to interviewers
    const searchForSupervisors = req.query.includeSupervisors === 'true';
    const query = {
      memberId: { $regex: new RegExp(`^${memberId.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') }
    };
    
    // If not searching for supervisors, restrict to interviewers only
    if (!searchForSupervisors) {
      query.userType = 'interviewer';
    } else {
      // For supervisors, search for project_manager or interviewer
      query.userType = { $in: ['interviewer', 'project_manager'] };
    }

    // For project managers, filter by assigned interviewers
    if (req.user.userType === 'project_manager') {
      const currentUser = await User.findById(req.user.id);
      if (currentUser && currentUser.assignedTeamMembers && currentUser.assignedTeamMembers.length > 0) {
        const assignedIds = currentUser.assignedTeamMembers.map(id => 
          mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
        );
        query._id = { $in: assignedIds };
      }
    }

    // Find interviewers matching memberId
    const interviewers = await User.find(query)
      .select('_id firstName lastName email phone memberId')
      .limit(10)
      .lean();

    // If surveyId provided, check if interviewer has responses for this survey
    let interviewersWithStats = interviewers;
    if (surveyId && mongoose.Types.ObjectId.isValid(surveyId)) {
      const SurveyResponse = require('../models/SurveyResponse');
      const interviewerIds = interviewers.map(i => i._id);
      
      if (interviewerIds.length > 0) {
        const responseCounts = await SurveyResponse.aggregate([
          {
            $match: {
              survey: new mongoose.Types.ObjectId(surveyId),
              interviewer: { $in: interviewerIds }
            }
          },
          {
            $group: {
              _id: '$interviewer',
              totalResponses: { $sum: 1 }
            }
          }
        ]);

        const countsMap = new Map();
        responseCounts.forEach(item => {
          countsMap.set(item._id.toString(), item.totalResponses);
        });

        interviewersWithStats = interviewers.map(interviewer => ({
          ...interviewer,
          responseCount: countsMap.get(interviewer._id.toString()) || 0
        }));
      }
    }

    res.status(200).json({
      success: true,
      data: interviewersWithStats
    });
  } catch (error) {
    console.error('Search interviewer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
