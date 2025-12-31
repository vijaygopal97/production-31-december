const express = require('express');
const {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
  verifyEmail,
  resendVerification,
  getCompanies,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
  addCompanyAdmin,
  removeCompanyAdmin,
  getCompanyStats,
  getCompanyUsers,
  registerCompanyUser,
  updateCompanyUser,
  deleteCompanyUser,
  forgotPassword,
  verifyOTP,
  resetPassword,
  checkMemberIdAvailability,
  addInterviewerByProjectManager,
  updateInterviewerPreferencesByPM,
  getInterviewerSurveys,
  updateInterviewerByPM,
  searchInterviewerByMemberId
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const {
  validateRegistration,
  validateLogin,
  validateProfileUpdate,
  validatePasswordChange
} = require('../middleware/validation');

const router = express.Router();

// Public routes
router.post('/register', validateRegistration, register);
router.post('/login', validateLogin, login);
router.post('/logout', logout); // Logout doesn't require authentication (token cleared client-side)
router.get('/verify-email/:token', verifyEmail);
router.get('/companies', getCompanies);

// Forgot password routes (public)
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', protect, getMe);
router.put('/profile', protect, validateProfileUpdate, updateProfile);
router.put('/change-password', protect, validatePasswordChange, changePassword);
router.post('/resend-verification', protect, resendVerification);

// Super Admin only routes - User Management
router.get('/users', protect, authorize('super_admin'), getAllUsers);
router.get('/users/stats', protect, authorize('super_admin'), getUserStats);
router.get('/users/:id', protect, authorize('super_admin'), getUserById);
router.put('/users/:id', protect, authorize('super_admin'), updateUser);
router.delete('/users/:id', protect, authorize('super_admin'), deleteUser);

// Super Admin only routes - Company Management
router.get('/manage-companies', protect, authorize('super_admin'), getAllCompanies);
router.get('/manage-companies/stats', protect, authorize('super_admin'), getCompanyStats);
router.get('/manage-companies/:id', protect, authorize('super_admin'), getCompanyById);
router.put('/manage-companies/:id', protect, authorize('super_admin'), updateCompany);
router.delete('/manage-companies/:id', protect, authorize('super_admin'), deleteCompany);

// Company Admin Management
router.post('/manage-companies/:id/admins', protect, authorize('super_admin'), addCompanyAdmin);
router.delete('/manage-companies/:id/admins/:adminId', protect, authorize('super_admin'), removeCompanyAdmin);

// Company Admin routes - User Management
router.get('/company/users', protect, authorize('company_admin'), getCompanyUsers);
router.post('/company/register-user', protect, authorize('company_admin'), registerCompanyUser);
router.put('/company/users/:id', protect, authorize('company_admin'), updateCompanyUser);
router.delete('/company/users/:id', protect, authorize('company_admin'), deleteCompanyUser);

// Project Manager routes - Team Management
router.get('/check-member-id/:memberId', protect, authorize('project_manager', 'company_admin'), checkMemberIdAvailability);
router.post('/project-manager/add-interviewer', protect, authorize('project_manager'), addInterviewerByProjectManager);
router.put('/project-manager/interviewer/:id/preferences', protect, authorize('project_manager'), updateInterviewerPreferencesByPM);
router.get('/project-manager/interviewer/:id/surveys', protect, authorize('project_manager'), getInterviewerSurveys);

// Search interviewer by memberId (for Reports V2)
router.get('/search-interviewer', protect, authorize('company_admin', 'project_manager'), searchInterviewerByMemberId);
router.put('/project-manager/interviewer/:id', protect, authorize('project_manager'), updateInterviewerByPM);

module.exports = router;
