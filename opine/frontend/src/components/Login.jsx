import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader, CheckCircle, XCircle, LogIn } from 'lucide-react';
import SEO from './SEO';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, getDashboardPath } = useAuth();
  const [formData, setFormData] = useState({
    email: '', // Can be email or memberId
    password: ''
  });

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      navigate(getDashboardPath());
    }
  }, [isAuthenticated, getDashboardPath, navigate]);

  const [formStatus, setFormStatus] = useState({
    loading: false,
    success: false,
    error: null,
  });

  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    const errors = [];

    if (!formData.email.trim()) {
      errors.push('Email or Member ID is required');
    }

    // Validate email format only if it's not a memberId (alphanumeric, no @)
    if (formData.email.trim()) {
      const trimmed = formData.email.trim();
      const isEmail = trimmed.includes('@');
      const isMemberId = !isEmail && /^[A-Za-z0-9]+$/.test(trimmed);
      
      if (!isEmail && !isMemberId) {
        errors.push('Please provide a valid email address or Member ID (alphanumeric)');
      } else if (isEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
          errors.push('Please provide a valid email address');
        }
      }
    }

    if (!formData.password) {
      errors.push('Password is required');
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

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
      const response = await authAPI.login({
        email: formData.email.trim(),
        password: formData.password
      });

      if (response.success) {
        setFormStatus({ loading: false, success: true, error: null });

        // Use auth context to store user data
        login(response.data.user, response.data.token);

        // Redirect to appropriate dashboard
        setTimeout(() => {
          navigate(getDashboardPath());
        }, 1500);
      } else {
        setFormStatus({
          loading: false,
          success: false,
          error: response.message || 'Login failed'
        });
      }
    } catch (error) {
      console.error('Login error:', error);

      let errorMessage = 'Login failed. Please try again.';

      if (error.response?.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.errors) {
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

  return (
    <>
      <SEO pathname="/login" />
      <div className="login-page bg-gradient-to-br from-[#E6F0F8] via-white to-[#E8E6F5] py-12 min-h-screen flex items-center justify-center">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 max-w-[800px]">
          <div className="bg-white p-8 rounded-lg shadow-xl border border-gray-200">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome Back to <span className="bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] bg-clip-text text-transparent">Convergent</span>
              </h1>
              <p className="text-gray-600">
                Sign in to your account to continue
              </p>
            </div>

            {/* Form Status Messages */}
            {formStatus.success && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-6 flex items-center" role="alert">
                <CheckCircle className="w-5 h-5 mr-3" />
                <span className="block sm:inline">
                  {formStatus.success === true ? 'Login successful! Redirecting to dashboard...' : formStatus.success}
                </span>
              </div>
            )}
            {formStatus.error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6 flex items-center" role="alert">
                <XCircle className="w-5 h-5 mr-3" />
                <span className="block sm:inline">{formStatus.error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email or Member ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="your.email@example.com or Member ID"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter your email address or Member ID
                </p>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 pr-10"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-[#001D48] focus:ring-[#001D48] border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <Link to="/forgot-password" className="font-medium text-[#001D48] hover:text-[#373177]">
                    Forgot your password?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                className="w-full px-6 py-3 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white font-semibold rounded-lg hover:from-[#002855] hover:via-[#3d3a8a] hover:to-[#4bb8d9] transition-all duration-200 shadow-md flex items-center justify-center"
                disabled={formStatus.loading}
              >
                {formStatus.loading ? (
                  <>
                    <Loader className="w-5 h-5 mr-3 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-3" />
                    Sign In
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link to="/register" className="font-medium text-[#001D48] hover:text-[#373177]">
                  Register here
                </Link>
              </p>
            </div>

            {/* Demo Credentials */}
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Demo Credentials:</h3>
              <div className="text-xs text-gray-600 space-y-1">
                <p><strong>Super Admin:</strong> test5@convergent.com / Password</p>
                <p><em>Use these credentials to test the login functionality</em></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
