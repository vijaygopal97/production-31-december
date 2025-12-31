import axios from 'axios';

// Get API base URL from environment variables
// Use relative path in production to go through nginx proxy
// In production (HTTPS), use empty string so relative paths work through nginx
// In development, use localhost:5000 directly
const isProduction = window.location.protocol === 'https:' || window.location.hostname !== 'localhost';
const isHTTPS = window.location.protocol === 'https:';

// Check if VITE_API_BASE_URL is explicitly set (including empty string)
// If on HTTPS, always use empty string (relative paths) to avoid mixed content errors
// This ensures requests go through nginx proxy which handles HTTPS
const envApiUrl = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL = isHTTPS 
  ? ''  // Always use relative paths on HTTPS (production) - ignore env var to prevent mixed content
  : (envApiUrl !== undefined ? envApiUrl : (isProduction ? '' : 'http://localhost:5000'));

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // 10 minutes timeout for all API requests (increased from 30 seconds)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add JWT token to headers if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized errors (token expired or invalid)
    if (error.response && error.response.status === 401) {
      // Clear token and user data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Redirect to login page if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Test backend connection
export const testBackendConnection = async () => {
  try {
    const response = await api.get('/');
    console.log('✅ Database connected successfully');
    return { success: true, data: response.data };
  } catch (error) {
    console.log('❌ Database connection failed');
    return { success: false, error: error.message };
  }
};

// Authentication API functions
export const authAPI = {
  // Register new user
  register: async (userData) => {
    try {
      const response = await api.post('/api/auth/register', userData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Login user
  login: async (credentials) => {
    try {
      const response = await api.post('/api/auth/login', credentials);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get current user profile
  getMe: async () => {
    try {
      const response = await api.get('/api/auth/me');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update user profile
  updateProfile: async (profileData) => {
    try {
      const response = await api.put('/api/auth/profile', profileData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Change password
  changePassword: async (passwordData) => {
    try {
      const response = await api.put('/api/auth/change-password', passwordData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Verify email
  verifyEmail: async (token) => {
    try {
      const response = await api.get(`/api/auth/verify-email/${token}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Resend email verification
  resendVerification: async () => {
    try {
      const response = await api.post('/api/auth/resend-verification');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Search interviewer by memberId (for Reports V2)
  searchInterviewerByMemberId: async (memberId, surveyId, includeSupervisors = false) => {
    try {
      const params = new URLSearchParams();
      params.append('memberId', memberId);
      if (surveyId) params.append('surveyId', surveyId);
      if (includeSupervisors) params.append('includeSupervisors', 'true');
      const response = await api.get(`/api/auth/search-interviewer?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Forgot password - send OTP
  forgotPassword: async (email) => {
    try {
      const response = await api.post('/api/auth/forgot-password', { email });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Verify OTP for password reset
  verifyOTP: async (email, otp, emailHash) => {
    try {
      const response = await api.post('/api/auth/verify-otp', { 
        email, 
        otp, 
        emailHash 
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Reset password with new password
  resetPassword: async (resetToken, email, newPassword, confirmPassword) => {
    try {
      const response = await api.post('/api/auth/reset-password', { 
        resetToken,
        email, 
        newPassword,
        confirmPassword
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

        // Get available companies
        getCompanies: async () => {
          try {
            const response = await api.get('/api/auth/companies');
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        // Get all users with pagination and filtering
        getAllUsers: async (params = {}) => {
          try {
            const response = await api.get('/api/auth/users', { params });
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        // Get user by ID
        getUserById: async (id) => {
          try {
            const response = await api.get(`/api/auth/users/${id}`);
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        // Update user
        updateUser: async (id, userData) => {
          try {
            const response = await api.put(`/api/auth/users/${id}`, userData);
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        // Delete user
        deleteUser: async (id) => {
          try {
            const response = await api.delete(`/api/auth/users/${id}`);
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        // Get user statistics
        getUserStats: async () => {
          try {
            const response = await api.get('/api/auth/users/stats');
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        // Company-specific user management
        getCompanyUsers: async (params = {}) => {
          try {
            const response = await api.get('/api/auth/company/users', { params });
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        // Register company user (no company code needed)
        registerCompanyUser: async (userData) => {
          try {
            const response = await api.post('/api/auth/company/register-user', userData);
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        // Update company user
        updateCompanyUser: async (id, userData) => {
          try {
            const response = await api.put(`/api/auth/company/users/${id}`, userData);
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        // Delete company user
        deleteCompanyUser: async (id) => {
          try {
            const response = await api.delete(`/api/auth/company/users/${id}`);
            return response.data;
          } catch (error) {
            throw error;
          }
        },


        // Check member ID availability
        checkMemberIdAvailability: async (memberId) => {
          try {
            const response = await api.get(`/api/auth/check-member-id/${encodeURIComponent(memberId)}`);
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        // Add interviewer by project manager
        addInterviewerByProjectManager: async (interviewerData) => {
          try {
            const response = await api.post('/api/auth/project-manager/add-interviewer', interviewerData);
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        // Update interviewer preferences by project manager
        updateInterviewerPreferencesByPM: async (interviewerId, preferencesData) => {
          try {
            const response = await api.put(`/api/auth/project-manager/interviewer/${interviewerId}/preferences`, preferencesData);
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        // Get surveys assigned to an interviewer
        getInterviewerSurveys: async (interviewerId) => {
          try {
            const response = await api.get(`/api/auth/project-manager/interviewer/${interviewerId}/surveys`);
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        // Update interviewer by project manager (basic info and password)
        updateInterviewerByPM: async (interviewerId, updateData) => {
          try {
            const response = await api.put(`/api/auth/project-manager/interviewer/${interviewerId}`, updateData);
            return response.data;
          } catch (error) {
            throw error;
          }
        },

  // Interviewer Profile API functions
  getInterviewerProfile: async () => {
    try {
      const response = await api.get('/api/interviewer-profile/profile');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getInterviewerProfileById: async (userId) => {
    try {
      const response = await api.get(`/api/interviewer-profile/profile/${userId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Super admin APIs for independent interviewers
  getIndependentInterviewerProfiles: async () => {
    try {
      const response = await api.get('/api/interviewer-profile/independent/pending-profiles');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  reviewIndependentInterviewerProfile: async (userId, data) => {
    try {
      const response = await api.post(`/api/interviewer-profile/independent/review-profile/${userId}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

        updateInterviewerProfile: async (profileData) => {
          try {
            const response = await api.put('/api/interviewer-profile/profile', profileData);
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        submitProfileForApproval: async () => {
          try {
            const response = await api.post('/api/interviewer-profile/profile/submit');
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        uploadDocuments: async (formData) => {
          try {
            const response = await api.post('/api/interviewer-profile/upload-documents', formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            });
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        // Document Verification API functions (for Company Admin)
        getPendingProfiles: async () => {
          try {
            const response = await api.get('/api/interviewer-profile/pending-profiles');
            return response.data;
          } catch (error) {
            throw error;
          }
        },

        reviewProfile: async (reviewData) => {
          try {
            const response = await api.post('/api/interviewer-profile/review-profile', reviewData);
            return response.data;
          } catch (error) {
            throw error;
          }
        }
    };

// Survey API functions
export const surveyAPI = {
  // Create a new survey
  createSurvey: async (surveyData) => {
    try {
      // Creating survey via API
      // Increase timeout to 5 minutes for large surveys with many contacts
      const response = await api.post('/api/surveys', surveyData, {
        timeout: 300000 // 5 minutes timeout for large payloads
      });
      // Survey API response received
      return response.data;
    } catch (error) {
      console.error('Survey API error:', error);
      console.error('Error response:', error.response?.data);
      throw error;
    }
  },

  // Get all surveys for the company
  getSurveys: async (params = {}) => {
    try {
      const response = await api.get('/api/surveys', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get a single survey
  getSurvey: async (id) => {
    try {
      const response = await api.get(`/api/surveys/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get overall statistics (optimized endpoint using aggregation)
  getOverallStats: async () => {
    try {
      const response = await api.get('/api/surveys/overall-stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get survey analytics (optimized endpoint using aggregation)
  getSurveyAnalytics: async (surveyId, filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.dateRange) params.append('dateRange', filters.dateRange);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.status) params.append('status', filters.status);
      if (filters.interviewMode) params.append('interviewMode', filters.interviewMode);
      if (filters.ac) params.append('ac', filters.ac);
      if (filters.district) params.append('district', filters.district);
      if (filters.lokSabha) params.append('lokSabha', filters.lokSabha);
      if (filters.interviewerIds && Array.isArray(filters.interviewerIds) && filters.interviewerIds.length > 0) {
        filters.interviewerIds.forEach(id => params.append('interviewerIds', id));
      }
      if (filters.interviewerMode) params.append('interviewerMode', filters.interviewerMode);

      const response = await api.get(`/api/surveys/${surveyId}/analytics?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get survey analytics V2 (optimized for big data, no limits)
  getSurveyAnalyticsV2: async (surveyId, filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.dateRange) params.append('dateRange', filters.dateRange);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.status) params.append('status', filters.status);
      if (filters.interviewMode) params.append('interviewMode', filters.interviewMode);
      if (filters.ac) params.append('ac', filters.ac);
      if (filters.district) params.append('district', filters.district);
      if (filters.lokSabha) params.append('lokSabha', filters.lokSabha);
      if (filters.interviewerIds && Array.isArray(filters.interviewerIds) && filters.interviewerIds.length > 0) {
        filters.interviewerIds.forEach(id => params.append('interviewerIds', id));
      }
      if (filters.interviewerMode) params.append('interviewerMode', filters.interviewerMode);

      const response = await api.get(`/api/surveys/${surveyId}/analytics-v2?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get AC-wise stats V2 (optimized for big data, no limits)
  getACWiseStatsV2: async (surveyId, filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.dateRange) params.append('dateRange', filters.dateRange);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.status) params.append('status', filters.status);
      if (filters.interviewMode) params.append('interviewMode', filters.interviewMode);
      if (filters.ac) params.append('ac', filters.ac);
      if (filters.district) params.append('district', filters.district);
      if (filters.lokSabha) params.append('lokSabha', filters.lokSabha);
      if (filters.interviewerIds && Array.isArray(filters.interviewerIds) && filters.interviewerIds.length > 0) {
        filters.interviewerIds.forEach(id => params.append('interviewerIds', id));
      }
      if (filters.interviewerMode) params.append('interviewerMode', filters.interviewerMode);

      const response = await api.get(`/api/surveys/${surveyId}/ac-wise-stats-v2?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get Interviewer-wise stats V2 (optimized for big data, no limits)
  getInterviewerWiseStatsV2: async (surveyId, filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.dateRange) params.append('dateRange', filters.dateRange);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.status) params.append('status', filters.status);
      if (filters.interviewMode) params.append('interviewMode', filters.interviewMode);
      if (filters.ac) params.append('ac', filters.ac);
      if (filters.district) params.append('district', filters.district);
      if (filters.lokSabha) params.append('lokSabha', filters.lokSabha);
      if (filters.interviewerIds && Array.isArray(filters.interviewerIds) && filters.interviewerIds.length > 0) {
        filters.interviewerIds.forEach(id => params.append('interviewerIds', id));
      }
      if (filters.interviewerMode) params.append('interviewerMode', filters.interviewerMode);

      const response = await api.get(`/api/surveys/${surveyId}/interviewer-wise-stats-v2?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get Chart Data V2 (optimized for big data, no limits)
  getChartDataV2: async (surveyId, filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.dateRange) params.append('dateRange', filters.dateRange);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.status) params.append('status', filters.status);
      if (filters.interviewMode) params.append('interviewMode', filters.interviewMode);
      if (filters.ac) params.append('ac', filters.ac);
      if (filters.district) params.append('district', filters.district);
      if (filters.lokSabha) params.append('lokSabha', filters.lokSabha);
      if (filters.interviewerIds && Array.isArray(filters.interviewerIds) && filters.interviewerIds.length > 0) {
        filters.interviewerIds.forEach(id => params.append('interviewerIds', id));
      }
      if (filters.interviewerMode) params.append('interviewerMode', filters.interviewerMode);

      const response = await api.get(`/api/surveys/${surveyId}/chart-data-v2?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update an existing survey
  updateSurvey: async (id, surveyData) => {
    try {
      // Updating survey via API
      // Increase timeout to 5 minutes for large surveys with many contacts
      const response = await api.put(`/api/surveys/${id}`, surveyData, {
        timeout: 300000 // 5 minutes timeout for large payloads
      });
      // Survey update API response received
      return response.data;
    } catch (error) {
      console.error('Survey update API error:', error);
      console.error('Error response:', error.response?.data);
      throw error;
    }
  },


  // Delete a survey
  deleteSurvey: async (id) => {
    try {
      const response = await api.delete(`/api/surveys/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Publish a survey
  publishSurvey: async (id) => {
    try {
      const response = await api.post(`/api/surveys/${id}/publish`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Assign interviewers to survey
  assignInterviewers: async (id, interviewerData) => {
    try {
      const response = await api.post(`/api/surveys/${id}/assign-interviewers`, interviewerData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Assign quality agents to a survey
  assignQualityAgents: async (id, qualityAgentData) => {
    try {
      const response = await api.post(`/api/surveys/${id}/assign-quality-agents`, qualityAgentData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get survey statistics
  getSurveyStats: async () => {
    try {
      const response = await api.get('/api/surveys/stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get CATI performance stats for a survey
  getCatiStats: async (surveyId, startDate, endDate, interviewerIds = [], interviewerMode = 'include', ac = '') => {
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (interviewerIds && interviewerIds.length > 0) {
        params.interviewerIds = interviewerIds.join(',');
        params.interviewerMode = interviewerMode;
      }
      if (ac) params.ac = ac;
      const response = await api.get(`/api/surveys/${surveyId}/cati-stats`, { 
        params,
        timeout: 600000 // 10 minutes timeout for complex CATI stats queries
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get available surveys for interviewer
  getAvailableSurveys: async (params = {}) => {
    try {
      const response = await api.get('/api/surveys/available', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Reject an interview assignment
  rejectInterview: async (surveyId) => {
    try {
      const response = await api.post(`/api/surveys/${surveyId}/reject-interview`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Download respondent contacts template
  downloadRespondentTemplate: async () => {
    try {
      const response = await api.get('/api/surveys/respondent-contacts/template', {
        responseType: 'blob'
      });
      // Create blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'CATI_Respondent_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return { success: true };
    } catch (error) {
      throw error;
    }
  },

  // Upload respondent contacts Excel file
  uploadRespondentContacts: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/api/surveys/respondent-contacts/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get respondent contacts for a survey (with pagination)
  getRespondentContacts: async (surveyId, params = {}) => {
    try {
      const response = await api.get(`/api/surveys/${surveyId}/respondent-contacts`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Save respondent contacts modifications (added/deleted)
  saveRespondentContacts: async (surveyId, modifications) => {
    try {
      const response = await api.put(`/api/surveys/${surveyId}/respondent-contacts`, modifications);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// Contact API functions
export const contactAPI = {
  // Get all contacts
  getAllContacts: async (params = {}) => {
    try {
      const response = await api.get('/api/contacts', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get contact by ID
  getContact: async (id) => {
    try {
      const response = await api.get(`/api/contacts/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create new contact
  createContact: async (contactData) => {
    try {
      const response = await api.post('/api/contacts', contactData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update contact
  updateContact: async (id, contactData) => {
    try {
      const response = await api.put(`/api/contacts/${id}`, contactData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete contact
  deleteContact: async (id) => {
    try {
      const response = await api.delete(`/api/contacts/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get contact statistics
  getContactStats: async () => {
    try {
      const response = await api.get('/api/contacts/stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Respond to contact
  respondToContact: async (id, responseData) => {
    try {
      const response = await api.patch(`/api/contacts/${id}/respond`, responseData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

// Company Management API functions
export const companyAPI = {
  // Get all companies with pagination and filtering
  getAllCompanies: async (params = {}) => {
    try {
      const response = await api.get('/api/auth/manage-companies', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get company by ID
  getCompanyById: async (id) => {
    try {
      const response = await api.get(`/api/auth/manage-companies/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update company
  updateCompany: async (id, companyData) => {
    try {
      const response = await api.put(`/api/auth/manage-companies/${id}`, companyData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete company
  deleteCompany: async (id) => {
    try {
      const response = await api.delete(`/api/auth/manage-companies/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Add company admin
  addCompanyAdmin: async (companyId, adminData) => {
    try {
      const response = await api.post(`/api/auth/manage-companies/${companyId}/admins`, adminData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Remove company admin
  removeCompanyAdmin: async (companyId, adminId) => {
    try {
      const response = await api.delete(`/api/auth/manage-companies/${companyId}/admins/${adminId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get company statistics
  getCompanyStats: async () => {
    try {
      const response = await api.get('/api/auth/manage-companies/stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// Survey Response API
export const surveyResponseAPI = {
  // Start a new interview session
  startInterview: async (surveyId) => {
    try {
      const response = await api.post(`/api/survey-responses/start/${surveyId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get interview session
  getInterviewSession: async (sessionId) => {
    try {
      const response = await api.get(`/api/survey-responses/session/${sessionId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update response (temporary storage)
  updateResponse: async (sessionId, questionId, response) => {
    try {
      const apiResponse = await api.post(`/api/survey-responses/session/${sessionId}/response`, {
        questionId,
        response
      });
      return apiResponse.data;
    } catch (error) {
      throw error;
    }
  },

  // Navigate to a specific question
  navigateToQuestion: async (sessionId, navigationData) => {
    try {
      const response = await api.post(`/api/survey-responses/session/${sessionId}/navigate`, navigationData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Mark question as reached
  markQuestionReached: async (sessionId, questionData) => {
    try {
      const response = await api.post(`/api/survey-responses/session/${sessionId}/reach`, questionData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Pause interview
  pauseInterview: async (sessionId) => {
    try {
      const response = await api.post(`/api/survey-responses/session/${sessionId}/pause`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Resume interview
  resumeInterview: async (sessionId) => {
    try {
      const response = await api.post(`/api/survey-responses/session/${sessionId}/resume`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Complete interview and save final response
  completeInterview: async (sessionId, responses, qualityMetrics, metadata) => {
    try {
      const response = await api.post(`/api/survey-responses/session/${sessionId}/complete`, {
        responses,
        qualityMetrics,
        metadata
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Abandon interview
  abandonInterview: async (sessionId, responses, metadata) => {
    try {
      const response = await api.post(`/api/survey-responses/session/${sessionId}/abandon`, {
        responses,
        metadata
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get gender response counts for quota management
  getGenderResponseCounts: async (surveyId) => {
    try {
      const response = await api.get(`/api/survey-responses/survey/${surveyId}/gender-counts`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get all interviews conducted by the logged-in interviewer
  getMyInterviews: async (params = {}) => {
    try {
      const response = await api.get('/api/survey-responses/my-interviews', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get pending approval responses for company admin
  getPendingApprovals: async (params = {}) => {
    try {
      const response = await api.get('/api/survey-responses/pending-approvals', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get approval statistics (optimized endpoint using aggregation)
  getApprovalStats: async () => {
    try {
      const response = await api.get('/api/survey-responses/approval-stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get next available response from queue for review (Queue-based assignment)
  getNextReviewAssignment: async (params = {}) => {
    try {
      const response = await api.get('/api/survey-responses/next-review', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Release review assignment (when user abandons review)
  releaseReviewAssignment: async (responseId) => {
    try {
      const response = await api.post(`/api/survey-responses/release-review/${responseId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

    // Submit survey response verification
    submitVerification: async (verificationData) => {
      try {
        const response = await api.post('/api/survey-responses/verify', verificationData);
        return response.data;
      } catch (error) {
        throw error;
      }
    },

    // Get all survey responses for stats (internal use)
    getDebugResponses: async () => {
      try {
        const response = await api.get('/api/survey-responses/debug-responses');
        return response.data;
      } catch (error) {
        throw error;
      }
    },

    // Get survey responses for View Responses modal
    getACPerformanceStats: async (surveyId) => {
      try {
        const response = await api.get(`/api/survey-responses/survey/${surveyId}/ac-performance`);
        return response.data;
      } catch (error) {
        console.error('Error fetching AC performance stats:', error);
        throw error;
      }
    },
    getInterviewerPerformanceStats: async (surveyId) => {
      try {
        const response = await api.get(`/api/survey-responses/survey/${surveyId}/interviewer-performance`);
        return response.data;
      } catch (error) {
        console.error('Error fetching interviewer performance stats:', error);
        throw error;
      }
    },
    getSurveyResponsesV2: async (surveyId, params = {}) => {
      try {
        // Use extended timeout for large chunks (especially during CSV download)
        const isLargeChunk = params.limit && parseInt(params.limit) >= 500;
        const timeout = isLargeChunk ? 600000 : 60000; // 10 min for large chunks (500+), 1 min for normal
        const response = await api.get(`/api/survey-responses/survey/${surveyId}/responses-v2`, { 
          params,
          timeout,
          // Add cache control header (Connection header is controlled by browser)
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        return response.data;
      } catch (error) {
        console.error('Error fetching survey responses V2:', error);
        // Re-throw with more context for network errors
        if (error.code === 'ERR_NETWORK' || error.code === 'ERR_NETWORK_CHANGED') {
          error.message = `Network error: ${error.message}`;
        }
        throw error;
      }
    },
    getSurveyResponsesV2ForCSV: async (surveyId, params = {}) => {
      try {
        // Use extended timeout for CSV downloads (2 hours = 7200000ms)
        const response = await api.get(`/api/survey-responses/survey/${surveyId}/responses-v2-csv`, { 
          params,
          timeout: 7200000 // 2 hours timeout for large CSV downloads
        });
        return response.data;
      } catch (error) {
        console.error('Error fetching survey responses V2 for CSV:', error);
        throw error;
      }
    },
    getSurveyResponses: async (surveyId, params = {}) => {
      try {
        const response = await api.get(`/api/survey-responses/survey/${surveyId}/responses`, { params });
        return response.data;
      } catch (error) {
        throw error;
      }
    },

  // Get last CATI set number for a survey (to alternate sets)
  getLastCatiSetNumber: async (surveyId) => {
    try {
      if (!surveyId) {
        return {
          success: false,
          message: 'Survey ID is required',
          error: 'Missing surveyId parameter'
        };
      }
      // Use validateStatus to prevent axios from throwing on 404
      // 404 is expected for first CATI response (no previous set number)
      const response = await api.get(`/api/survey-responses/survey/${surveyId}/last-cati-set`, {
        validateStatus: (status) => status < 500 // Don't throw for 4xx errors, only 5xx
      });
      
      // If 404, return a success response with null data (frontend will default to Set 1)
      if (response.status === 404) {
        return {
          success: true,
          data: {
            lastSetNumber: null,
            nextSetNumber: null // Frontend will default to Set 1
          }
        };
      }
      
      return response.data;
    } catch (error) {
      // Only catch unexpected errors (5xx or network errors)
      // 4xx errors are handled by validateStatus above
      return {
        success: false,
        message: 'Failed to get last CATI set number',
        error: error.message || 'Unknown error',
        data: {
          lastSetNumber: null,
          nextSetNumber: null // Frontend will default to Set 1
        }
      };
    }
  },

    // Approve survey response
    approveResponse: async (responseId) => {
      try {
        const response = await api.patch(`/api/survey-responses/${responseId}/approve`);
        return response.data;
      } catch (error) {
        throw error;
      }
    },

    // Reject survey response
    rejectResponse: async (responseId, data) => {
      try {
        const response = await api.patch(`/api/survey-responses/${responseId}/reject`, data);
        return response.data;
      } catch (error) {
        throw error;
      }
    },

    // Get survey response by ID (full details)
    getSurveyResponseById: async (responseId) => {
      try {
        const response = await api.get(`/api/survey-responses/${responseId}`);
        return response.data;
      } catch (error) {
        throw error;
      }
    },

    // Set response to Pending Approval
    setPendingApproval: async (responseId) => {
      try {
        const response = await api.patch(`/api/survey-responses/${responseId}/set-pending`);
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    
    // Get CSV file info (last updated timestamp)
    getCSVFileInfo: async (surveyId) => {
      try {
        const response = await api.get(`/api/survey-responses/survey/${surveyId}/csv-info`);
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    
    // Download pre-generated CSV file
    downloadPreGeneratedCSV: async (surveyId, mode = 'codes') => {
      try {
        const response = await api.get(`/api/survey-responses/survey/${surveyId}/csv-download?mode=${mode}`, {
          responseType: 'blob',
          timeout: 300000 // 5 minutes timeout
        });
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    
    // Trigger CSV generation manually
    triggerCSVGeneration: async (surveyId) => {
      try {
        const response = await api.post(`/api/survey-responses/survey/${surveyId}/generate-csv`);
        return response.data;
      } catch (error) {
        throw error;
      }
    }
  };

// Performance API
export const performanceAPI = {
  // Get comprehensive performance analytics
  getPerformanceAnalytics: async (params = {}) => {
    try {
      const response = await api.get('/api/performance/analytics', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get performance trends over time
  getPerformanceTrends: async (params = {}) => {
    try {
      const response = await api.get('/api/performance/trends', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get detailed interview history
  getInterviewHistory: async (params = {}) => {
    try {
      const response = await api.get('/api/performance/interviews', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Quality Agent Performance APIs
  // Get quality agent performance analytics
  getQualityAgentAnalytics: async (params = {}) => {
    try {
      const response = await api.get('/api/performance/quality-agent/analytics', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get quality agent performance trends
  getQualityAgentTrends: async (params = {}) => {
    try {
      const response = await api.get('/api/performance/quality-agent/trends', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get quality agent reviewed responses
  getQualityAgentReviews: async (params = {}) => {
    try {
      const response = await api.get('/api/performance/quality-agent/reviews', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get QC performance for a specific survey (Company Admin)
  getQCPerformanceBySurvey: async (surveyId, params = {}) => {
    try {
      const response = await api.get(`/api/performance/qc-performance/survey/${surveyId}`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getQCPerformanceTrends: async (surveyId, params = {}) => {
    try {
      const response = await api.get(`/api/performance/qc-performance/survey/${surveyId}/trends`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// QC Batch API
export const qcBatchAPI = {
  // Get all batches for a survey
  getBatchesBySurvey: async (surveyId) => {
    try {
      const response = await api.get(`/api/qc-batches/survey/${surveyId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get a single batch by ID
  getBatchById: async (batchId) => {
    try {
      const response = await api.get(`/api/qc-batches/${batchId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Manually trigger batch processing
  triggerBatchProcessing: async () => {
    try {
      const response = await api.post('/api/qc-batches/process');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Manually send a batch to QC (premature completion)
  sendBatchToQC: async (batchId) => {
    try {
      const response = await api.post(`/api/qc-batches/${batchId}/send-to-qc`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// QC Batch Config API
export const qcBatchConfigAPI = {
  // Get active config for a survey
  getConfigBySurvey: async (surveyId) => {
    try {
      const response = await api.get(`/api/qc-batch-config/survey/${surveyId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get all configs for company
  getConfigsByCompany: async () => {
    try {
      const response = await api.get('/api/qc-batch-config/company');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create or update config
  createOrUpdateConfig: async (configData) => {
    try {
      const response = await api.post('/api/qc-batch-config', configData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export const masterDataAPI = {
  // Get MP and MLA names for an AC
  getACData: async (acName) => {
    try {
      const response = await api.get(`/api/master-data/ac/${encodeURIComponent(acName)}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching AC data:', error);
      throw error;
    }
  }
};

export const pollingStationAPI = {
  // Get available round numbers for an AC
  getRoundNumbersByAC: async (state, acIdentifier) => {
    try {
      const response = await api.get(`/api/polling-stations/rounds/${encodeURIComponent(state)}/${encodeURIComponent(acIdentifier)}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching round numbers:', error);
      throw error;
    }
  },
  
  // Get groups for an AC (state and AC name or number)
  getGroupsByAC: async (state, acIdentifier, roundNumber = null) => {
    try {
      let url = `/api/polling-stations/groups/${encodeURIComponent(state)}/${encodeURIComponent(acIdentifier)}`;
      if (roundNumber) {
        url += `?roundNumber=${encodeURIComponent(roundNumber)}`;
      }
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching groups:', error);
      throw error;
    }
  },
  
  // Get polling stations for a group
  getPollingStationsByGroup: async (state, acIdentifier, groupName, roundNumber = null) => {
    try {
      let url = `/api/polling-stations/stations/${encodeURIComponent(state)}/${encodeURIComponent(acIdentifier)}/${encodeURIComponent(groupName)}`;
      if (roundNumber) {
        url += `?roundNumber=${encodeURIComponent(roundNumber)}`;
      }
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching polling stations:', error);
      throw error;
    }
  },
  
  // Get GPS location for a polling station
  getPollingStationGPS: async (state, acIdentifier, groupName, stationName) => {
    try {
      const response = await api.get(`/api/polling-stations/gps/${encodeURIComponent(state)}/${encodeURIComponent(acIdentifier)}/${encodeURIComponent(groupName)}/${encodeURIComponent(stationName)}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching polling station GPS:', error);
      throw error;
    }
  }
};

// Report Generation API
export const reportAPI = {
  // Generate report from Excel file
  generateReport: async (excelFile, referenceDate) => {
    try {
      const formData = new FormData();
      formData.append('excelFile', excelFile);
      if (referenceDate) {
        formData.append('referenceDate', referenceDate);
      }
      
      const response = await api.post('/api/reports/generate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 7200000, // 2 hours timeout for very large file uploads and report generation (up to 800MB)
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Generate audit trail
  generateAuditTrail: async (excelPath, referenceDate) => {
    try {
      const response = await api.post('/api/reports/audit', {
        excelPath,
        referenceDate
      }, {
        timeout: 7200000, // 2 hours timeout for large file processing
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Download generated file
  downloadFile: async (filename) => {
    try {
      const response = await api.get(`/api/reports/download/${filename}`, {
        responseType: 'blob',
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Download Excel template
  downloadTemplate: async () => {
    try {
      const response = await api.get('/api/reports/template', {
        responseType: 'blob',
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// CATI Test API
export const catiAPI = {
  // Make a call
  makeCall: async (callData) => {
    try {
      const response = await api.post('/api/cati/make-call', callData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get all calls
  getCalls: async (params = {}) => {
    try {
      const response = await api.get('/api/cati/calls', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get call by ID
  getCallById: async (callId) => {
    try {
      const response = await api.get(`/api/cati/calls/${callId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get call statistics
  getCallStats: async () => {
    try {
      const response = await api.get('/api/cati/stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// CATI Interview API
export const catiInterviewAPI = {
  // Start CATI interview session
  startCatiInterview: async (surveyId) => {
    try {
      const response = await api.post(`/api/cati-interview/start/${surveyId}`);
      return response.data;
    } catch (error) {
      // Return the error response data if available, otherwise throw
      if (error.response && error.response.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  // Make call to respondent
  makeCallToRespondent: async (queueId) => {
    try {
      const response = await api.post(`/api/cati-interview/make-call/${queueId}`);
      return response.data;
    } catch (error) {
      // Return error response if available
      if (error.response && error.response.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  // Abandon interview
  abandonInterview: async (queueId, reason, notes, callLaterDate, callStatus = null) => {
    try {
      const response = await api.post(`/api/cati-interview/abandon/${queueId}`, {
        reason,
        notes,
        callLaterDate,
        callStatus // Pass call status for stats tracking
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Complete CATI interview
  completeCatiInterview: async (queueId, sessionId, responses, selectedAC, selectedPollingStation, totalTimeSpent, startTime, endTime, totalQuestions, answeredQuestions, completionPercentage, setNumber = null, OldinterviewerID = null, callStatus = null, supervisorID = null) => {
    try {
      const response = await api.post(`/api/cati-interview/complete/${queueId}`, {
        sessionId,
        responses,
        selectedAC,
        selectedPollingStation,
        totalTimeSpent,
        startTime,
        endTime,
        totalQuestions,
        answeredQuestions,
        completionPercentage,
        setNumber, // Save which Set was shown in this CATI interview
        OldinterviewerID, // Save old interviewer ID
        callStatus, // Send call status (success, busy, switched_off, etc.)
        supervisorID // Save supervisor ID
      });
      return response.data;
    } catch (error) {
      // Return error response if available
      if (error.response && error.response.data) {
        return error.response.data;
      }
      throw error;
    }
  }
};

export default api;
