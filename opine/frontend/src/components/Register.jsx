import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle, XCircle, Loader, Building2, Users, UserCheck, Shield, Crown, Brain, ClipboardCheck } from 'lucide-react';
import SEO from './SEO';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Register = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, getDashboardPath } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    userType: 'interviewer',
    companyCode: '',
    companyName: '',
    industry: '',
    companySize: 'medium',
    companyEmail: '',
    companyPhone: '',
    companyWebsite: '',
    referralCode: ''
  });

  const [formStatus, setFormStatus] = useState({
    loading: false,
    success: false,
    error: null,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Public registration allows interviewer, quality_agent, and Data_Analyst users
  const userTypes = [
    {
      value: 'interviewer',
      label: 'Interviewer',
      description: 'Conduct field interviews and earn money',
      icon: <UserCheck className="w-6 h-6" />,
      color: 'from-[#373177] to-[#3FADCC]',
      bgColor: 'bg-[#E8E6F5]',
      borderColor: 'border-[#373177]'
    },
    {
      value: 'quality_agent',
      label: 'Quality Agent',
      description: 'Verify data quality and ensure authenticity',
      icon: <ClipboardCheck className="w-6 h-6" />,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      value: 'Data_Analyst',
      label: 'Data Analyst',
      description: 'Analyze survey data and create professional reports',
      icon: <Brain className="w-6 h-6" />,
      color: 'from-[#001D48] to-[#3FADCC]',
      bgColor: 'bg-[#E6F0F8]',
      borderColor: 'border-[#001D48]'
    }
  ];

  // Company size options
  const companySizes = [
    { value: 'startup', label: 'Startup (1-10 employees)' },
    { value: 'small', label: 'Small (11-50 employees)' },
    { value: 'medium', label: 'Medium (51-200 employees)' },
    { value: 'large', label: 'Large (201-1000 employees)' },
    { value: 'enterprise', label: 'Enterprise (1000+ employees)' }
  ];

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      navigate(getDashboardPath());
    }
  }, [isAuthenticated, getDashboardPath, navigate]);

  // Company loading logic removed - using text input instead of dropdown

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUserTypeChange = (userType) => {
    setFormData(prev => ({
      ...prev,
      userType,
      companyCode: '', // Reset company code when user type changes
      companyName: '',
      industry: '',
      companySize: 'medium',
      companyEmail: '',
      companyPhone: '',
      companyWebsite: ''
    }));
  };

  const validateForm = () => {
    const errors = [];

    // Basic validation
    if (!formData.firstName.trim()) errors.push('First name is required');
    if (!formData.lastName.trim()) errors.push('Last name is required');
    
    // Name validation
    if (formData.firstName.trim() && formData.firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters long');
    }
    if (formData.lastName.trim() && formData.lastName.trim().length < 2) {
      errors.push('Last name must be at least 2 characters long');
    }
    if (!formData.email.trim()) errors.push('Email is required');
    
    // Email validation
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.push('Please provide a valid email address');
      }
    }
    if (!formData.phone.trim()) errors.push('Phone number is required');
    
    // Phone number validation
    if (formData.phone.trim()) {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(formData.phone.trim().replace(/\s+/g, ''))) {
        errors.push('Please provide a valid phone number');
      }
    }
    if (!formData.password) errors.push('Password is required');
    if (formData.password !== formData.confirmPassword) errors.push('Passwords do not match');

    // Password strength validation
    if (formData.password && formData.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    // Check password strength
    if (formData.password) {
      const hasUpperCase = /[A-Z]/.test(formData.password);
      const hasLowerCase = /[a-z]/.test(formData.password);
      
      if (!hasUpperCase || !hasLowerCase) {
        errors.push('Password must contain at least one uppercase letter and one lowercase letter');
      }
    }

    // Company validation for non-super-admin users
    // Company code is required for company_admin and project_manager
    // Optional for interviewer, quality_agent, and Data_Analyst (independent workers)
    if (formData.userType !== 'super_admin') {
      const requiresCompanyCode = ['company_admin', 'project_manager'].includes(formData.userType);
      
      if (requiresCompanyCode && !formData.companyCode.trim()) {
        errors.push('Company code is required');
      }
      
      // Company code validation (only if provided)
      if (formData.companyCode.trim()) {
        const companyCodeRegex = /^[A-Z0-9_]+$/;
        if (!companyCodeRegex.test(formData.companyCode.trim())) {
          errors.push('Company code can only contain uppercase letters, numbers, and underscores');
        }
        if (formData.companyCode.trim().length < 2 || formData.companyCode.trim().length > 20) {
          errors.push('Company code must be between 2 and 20 characters');
        }
      }
    }

    // Company admin specific validation
    if (formData.userType === 'company_admin') {
      if (!formData.companyName.trim()) errors.push('Company name is required');
      
      // Company name validation
      if (formData.companyName.trim() && formData.companyName.trim().length < 2) {
        errors.push('Company name must be at least 2 characters long');
      }
      if (!formData.industry.trim()) errors.push('Industry is required');
      
      // Industry validation
      if (formData.industry.trim() && formData.industry.trim().length < 2) {
        errors.push('Industry must be at least 2 characters long');
      }
      if (!formData.companyEmail.trim()) errors.push('Company email is required');
      
      // Company email validation
      if (formData.companyEmail.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.companyEmail.trim())) {
          errors.push('Please provide a valid company email address');
        }
      }
      if (!formData.companyPhone.trim()) errors.push('Company phone is required');
      
      // Company phone validation
      if (formData.companyPhone.trim()) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(formData.companyPhone.trim().replace(/\s+/g, ''))) {
          errors.push('Please provide a valid company phone number');
        }
      }
      
      // Company website validation
      if (formData.companyWebsite.trim()) {
        const websiteRegex = /^https?:\/\/.+/;
        if (!websiteRegex.test(formData.companyWebsite.trim())) {
          errors.push('Please provide a valid website URL (starting with http:// or https://)');
        }
      }
    }

    // Referral code validation
    if (formData.referralCode.trim()) {
      if (formData.referralCode.trim().length < 3 || formData.referralCode.trim().length > 20) {
        errors.push('Referral code must be between 3 and 20 characters');
      }
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('Form data before validation:', JSON.stringify(formData, null, 2));
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setFormStatus({
        loading: false,
        success: false,
        error: validationErrors.join(', ')
      });
      return;
    }

    setFormStatus({ loading: true, success: false, error: null });

    try {
      // Prepare registration data
      const registrationData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim().replace(/\s+/g, ''), // Remove spaces from phone
        password: formData.password,
        userType: formData.userType,
        companyCode: formData.companyCode.trim() || undefined,
        referralCode: formData.referralCode.trim() || undefined
      };

      // Add company information for company admin
      if (formData.userType === 'company_admin') {
        registrationData.companyName = formData.companyName.trim();
        registrationData.industry = formData.industry.trim();
        registrationData.companySize = formData.companySize;
        registrationData.companyEmail = formData.companyEmail.trim();
        registrationData.companyPhone = formData.companyPhone.trim().replace(/\s+/g, ''); // Remove spaces from phone
        registrationData.companyWebsite = formData.companyWebsite.trim() || undefined;
      }

      console.log('Sending registration data:', JSON.stringify(registrationData, null, 2));
      const response = await authAPI.register(registrationData);
      console.log('Response:', response);
      
      if (response.success) {
        setFormStatus({ loading: false, success: true, error: null });
        
        // Use auth context to store user data
        login(response.data.user, response.data.token);
        
        // Redirect to appropriate dashboard
        setTimeout(() => {
          navigate(getDashboardPath());
        }, 2000);
      } else {
        setFormStatus({
          loading: false,
          success: false,
          error: response.message || 'Registration failed'
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      let errorMessage = 'Registration failed. Please try again.';
      
      if (error.response?.data) {
        console.log('Backend error data:', JSON.stringify(error.response.data, null, 2));
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.errors) {
          // Handle validation errors
          if (Array.isArray(error.response.data.errors)) {
            errorMessage = error.response.data.errors.map(err => err.message || err).join(', ');
          } else {
            errorMessage = JSON.stringify(error.response.data.errors);
          }
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setFormStatus({
        loading: false,
        success: false,
        error: errorMessage
      });
    }
  };

  const selectedUserType = userTypes.find(type => type.value === formData.userType);

  return (
    <>
      <SEO pathname="/register" />
      <div className="min-h-screen bg-gradient-to-br from-[#E6F0F8] via-white to-[#E8E6F5] py-12">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Join as <span className="bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] bg-clip-text text-transparent">Interviewer</span>
              </h1>
              <p className="text-xl text-gray-600">
                Start your journey as a field interviewer and earn money by conducting surveys
              </p>
            </div>

            {/* Success Message */}
            {formStatus.success && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-lg mb-6 flex items-center">
                <CheckCircle className="w-6 h-6 mr-3" />
                <div>
                  <p className="font-semibold">Registration Successful!</p>
                  <p className="text-sm">Redirecting to your dashboard...</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {formStatus.error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg mb-6 flex items-center">
                <XCircle className="w-6 h-6 mr-3" />
                <div>
                  <p className="font-semibold">Registration Failed</p>
                  <p className="text-sm">{formStatus.error}</p>
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-8">
              {/* User Type Selection */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Your Role</h2>
                <div className="space-y-4">
                  {userTypes.map((type) => (
                    <div
                      key={type.value}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                        formData.userType === type.value
                          ? `${type.borderColor} ${type.bgColor} ring-2 ring-offset-2 ring-blue-500`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleUserTypeChange(type.value)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg bg-gradient-to-r ${type.color} text-white`}>
                          {type.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{type.label}</h3>
                          <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                        </div>
                        {formData.userType === type.value && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Registration Form */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {selectedUserType?.label} Registration
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Personal Information */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                        First Name *
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="John"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Doe"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="john.doe@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="+91 98765 43210"
                      required
                    />
                  </div>

                  {/* Password Fields */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                        Password *
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          id="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter password"
                          required
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm Password *
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          id="confirmPassword"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Confirm password"
                          required
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Company Code */}
                  {formData.userType !== 'super_admin' && (
                    <div>
                      <label htmlFor="companyCode" className="block text-sm font-medium text-gray-700 mb-2">
                        Company Code 
                        {['company_admin', 'project_manager'].includes(formData.userType) ? (
                          <span className="text-red-500"> *</span>
                        ) : (
                          <span className="text-gray-500"> (Optional - for independent workers)</span>
                        )}
                      </label>
                      <input
                        type="text"
                        id="companyCode"
                        name="companyCode"
                        value={formData.companyCode}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder={formData.userType === 'company_admin' ? 'YOUR_COMPANY_CODE' : 'Enter company code (if you have one)'}
                        required={['company_admin', 'project_manager'].includes(formData.userType)}
                      />
                      {['interviewer', 'quality_agent', 'Data_Analyst'].includes(formData.userType) && (
                        <p className="text-sm text-[#373177] mt-2">
                          💡 You can work independently without a company affiliation, or join a company later.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Company Information (for Company Admin) */}
                  {formData.userType === 'company_admin' && (
                    <>
                      <div className="border-t pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h3>
                        
                        <div>
                          <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                            Company Name *
                          </label>
                          <input
                            type="text"
                            id="companyName"
                            name="companyName"
                            value={formData.companyName}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Your Company Name"
                            required
                          />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4 mt-4">
                          <div>
                            <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-2">
                              Industry *
                            </label>
                            <input
                              type="text"
                              id="industry"
                              name="industry"
                              value={formData.industry}
                              onChange={handleChange}
                              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Market Research"
                              required
                            />
                          </div>
                          <div>
                            <label htmlFor="companySize" className="block text-sm font-medium text-gray-700 mb-2">
                              Company Size *
                            </label>
                            <select
                              id="companySize"
                              name="companySize"
                              value={formData.companySize}
                              onChange={handleChange}
                              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              required
                            >
                              {companySizes.map((size) => (
                                <option key={size.value} value={size.value}>
                                  {size.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4 mt-4">
                          <div>
                            <label htmlFor="companyEmail" className="block text-sm font-medium text-gray-700 mb-2">
                              Company Email *
                            </label>
                            <input
                              type="email"
                              id="companyEmail"
                              name="companyEmail"
                              value={formData.companyEmail}
                              onChange={handleChange}
                              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              placeholder="contact@yourcompany.com"
                              required
                            />
                          </div>
                          <div>
                            <label htmlFor="companyPhone" className="block text-sm font-medium text-gray-700 mb-2">
                              Company Phone *
                            </label>
                            <input
                              type="tel"
                              id="companyPhone"
                              name="companyPhone"
                              value={formData.companyPhone}
                              onChange={handleChange}
                              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              placeholder="+91 98765 43210"
                              required
                            />
                          </div>
                        </div>

                        <div className="mt-4">
                          <label htmlFor="companyWebsite" className="block text-sm font-medium text-gray-700 mb-2">
                            Company Website
                          </label>
                          <input
                            type="url"
                            id="companyWebsite"
                            name="companyWebsite"
                            value={formData.companyWebsite}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            placeholder="https://yourcompany.com"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Referral Code */}
                  <div>
                    <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700 mb-2">
                      Referral Code (Optional)
                    </label>
                    <input
                      type="text"
                      id="referralCode"
                      name="referralCode"
                      value={formData.referralCode}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter referral code if you have one"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full px-6 py-3 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-md flex items-center justify-center"
                    disabled={formStatus.loading}
                  >
                    {formStatus.loading ? (
                      <>
                        <Loader className="w-5 h-5 mr-3 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </button>

                  {/* Login Link */}
                  <div className="text-center">
                    <p className="text-gray-600">
                      Already have an account?{' '}
                      <Link to="/login" className="text-[#001D48] hover:text-[#373177] font-medium">
                        Sign in here
                      </Link>
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;
