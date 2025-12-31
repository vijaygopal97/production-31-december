const { body, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// User registration validation
exports.validateRegistration = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please provide a valid phone number'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])/)
    .withMessage('Password must contain at least one uppercase letter and one lowercase letter'),

  body('userType')
    .notEmpty()
    .withMessage('User type is required')
    .isIn(['super_admin', 'company_admin', 'project_manager', 'interviewer', 'quality_agent', 'Data_Analyst'])
    .withMessage('Invalid user type'),

  body('status')
    .optional()
    .isIn(['active', 'pending', 'inactive', 'suspended'])
    .withMessage('Invalid user status'),

  body('companyCode')
    .if(body('userType').isIn(['company_admin', 'project_manager']))
    .trim()
    .notEmpty()
    .withMessage('Company code is required for this user type')
    .isLength({ min: 2, max: 20 })
    .withMessage('Company code must be between 2 and 20 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Company code can only contain uppercase letters, numbers, and underscores'),

  // Company information validation (for company_admin)
  body('companyName')
    .if(body('userType').equals('company_admin'))
    .trim()
    .notEmpty()
    .withMessage('Company name is required for company admin')
    .isLength({ min: 2, max: 100 })
    .withMessage('Company name must be between 2 and 100 characters'),

  body('industry')
    .if(body('userType').equals('company_admin'))
    .trim()
    .notEmpty()
    .withMessage('Industry is required for company admin')
    .isLength({ min: 2, max: 100 })
    .withMessage('Industry must be between 2 and 100 characters'),

  body('companySize')
    .if(body('userType').equals('company_admin'))
    .notEmpty()
    .withMessage('Company size is required for company admin')
    .isIn(['startup', 'small', 'medium', 'large', 'enterprise'])
    .withMessage('Invalid company size'),

  body('companyEmail')
    .if(body('userType').equals('company_admin'))
    .trim()
    .notEmpty()
    .withMessage('Company email is required for company admin')
    .isEmail()
    .withMessage('Please provide a valid company email address')
    .normalizeEmail(),

  body('companyPhone')
    .if(body('userType').equals('company_admin'))
    .trim()
    .notEmpty()
    .withMessage('Company phone is required for company admin')
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please provide a valid company phone number'),

  body('companyWebsite')
    .optional()
    .trim()
    .isURL()
    .withMessage('Please provide a valid website URL'),

  body('referralCode')
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Referral code must be between 3 and 20 characters'),

  handleValidationErrors
];

// User login validation
exports.validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email or Member ID is required')
    .custom((value) => {
      // Allow either email format (contains @) or memberId (alphanumeric, no @)
      const isEmail = value.includes('@');
      const isMemberId = !isEmail && /^[A-Za-z0-9]+$/.test(value);
      
      if (!isEmail && !isMemberId) {
        throw new Error('Please provide a valid email address or Member ID (alphanumeric)');
      }
      
      // If it's an email, validate email format
      if (isEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          throw new Error('Please provide a valid email address');
        }
      }
      
      return true;
    }),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  handleValidationErrors
];

// Profile update validation
exports.validateProfileUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please provide a valid phone number'),

  body('profile.bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),

  body('profile.dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),

  body('profile.gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer_not_to_say'])
    .withMessage('Invalid gender selection'),

  handleValidationErrors
];

// Password change validation
exports.validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])/)
    .withMessage('New password must contain at least one uppercase letter and one lowercase letter'),

  body('confirmPassword')
    .notEmpty()
    .withMessage('Confirm password is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),

  handleValidationErrors
];

// Company creation validation
exports.validateCompanyCreation = [
  body('companyName')
    .trim()
    .notEmpty()
    .withMessage('Company name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Company name must be between 2 and 100 characters'),

  body('companyCode')
    .trim()
    .notEmpty()
    .withMessage('Company code is required')
    .isLength({ min: 2, max: 20 })
    .withMessage('Company code must be between 2 and 20 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Company code can only contain uppercase letters, numbers, and underscores'),

  body('industry')
    .trim()
    .notEmpty()
    .withMessage('Industry is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Industry must be between 2 and 100 characters'),

  body('companySize')
    .notEmpty()
    .withMessage('Company size is required')
    .isIn(['startup', 'small', 'medium', 'large', 'enterprise'])
    .withMessage('Invalid company size'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please provide a valid phone number'),

  body('website')
    .optional()
    .trim()
    .isURL()
    .withMessage('Please provide a valid website URL'),

  handleValidationErrors
];

// Generic validation error handler
exports.handleValidationErrors = handleValidationErrors;
