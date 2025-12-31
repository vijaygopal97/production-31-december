import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  ArrowLeft,
  Calendar,
  Target,
  Users,
  MapPin,
  Filter,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle,
  Globe
} from 'lucide-react';

const SurveySpecifications = ({ onUpdate, initialData, mode }) => {
  
  // Helper function to safely access targetAudience properties
  const getTargetAudience = (category) => {
    return formData.targetAudience?.[category] || {};
  };
  
  const [formData, setFormData] = useState({
    surveyName: '',
    description: '',
    startDate: '',
    endDate: '',
    category: '',
    purpose: '',
    sampleSize: '',
    targetAudience: {
      demographics: {},
      geographic: {},
      behavioral: {},
      psychographic: {},
      custom: '',
      quotaManagement: false
    },
    thresholdInterviewsPerDay: '',
    maxInterviewsPerInterviewer: '',
    contactMode: 'email', // for online interviews
    ...initialData
  });

  const [errors, setErrors] = useState({});

  // Initialize form data only once when component mounts
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      // Ensure targetAudience is properly initialized
      const updatedData = {
        ...initialData,
        targetAudience: {
          demographics: {},
          geographic: {},
          behavioral: {},
          psychographic: {},
          custom: '',
          quotaManagement: false,
          ...initialData.targetAudience
        }
      };
      setFormData(updatedData);
    }
  }, []); // Empty dependency array - only run once on mount

  // Debounced onUpdate call to prevent infinite loops
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onUpdate(formData);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [formData, onUpdate]);

  const surveyCategories = [
    'Consumer Research',
    'Market Analysis',
    'Brand Awareness',
    'Product Testing',
    'Customer Satisfaction',
    'Employee Feedback',
    'Healthcare Research',
    'Education Research',
    'Social Research',
    'Political Research',
    'Other'
  ];

  const demographicOptions = [
    'Age Group',
    'Gender',
    'Income Level',
    'Education',
    'Occupation',
    'Marital Status',
    'Family Size'
  ];

  const geographicOptions = [
    'Country',
    'State/Province',
    'City',
    'Urban/Rural',
    'Postal Code',
    'Timezone'
  ];

  const behavioralOptions = [
    'Purchase Behavior',
    'Brand Loyalty',
    'Online Activity',
    'Shopping Frequency',
    'Media Consumption',
    'Technology Usage'
  ];

  const psychographicOptions = [
    'Lifestyle',
    'Values',
    'Interests',
    'Personality Traits',
    'Attitudes',
    'Opinions'
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      return newData;
    });
    setErrors(prev => ({
      ...prev,
      [field]: ''
    }));
  };

  const handleNestedInputChange = (parent, field, value) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [parent]: {
          ...prev[parent],
          [field]: value
        }
      };
      return newData;
    });
  };


  const calculateRecommendedSampleSize = () => {
    const baseSize = 100;
    const complexity = formData.targetAudience?.demographics ? 
      Object.keys(formData.targetAudience.demographics).length : 0;
    return baseSize + (complexity * 25);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.surveyName.trim()) {
      newErrors.surveyName = 'Survey name is required';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }
    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }
    if (!formData.purpose.trim()) {
      newErrors.purpose = 'Purpose is required';
    }
    if (!formData.sampleSize) {
      newErrors.sampleSize = 'Sample size is required';
    } else if (parseInt(formData.sampleSize) > 10000000) {
      newErrors.sampleSize = 'Sample size cannot exceed 10,000,000';
    } else if (parseInt(formData.sampleSize) < 1) {
      newErrors.sampleSize = 'Sample size must be at least 1';
    }

    if (formData.startDate && formData.endDate && new Date(formData.startDate) >= new Date(formData.endDate)) {
      newErrors.endDate = 'End date must be after start date';
    }

    // Validate gender percentages - only when multiple genders are selected
    if (formData.targetAudience?.demographics?.Gender) {
      const requirements = formData.targetAudience.demographics.genderRequirements || {};
      const selectedGenders = Object.keys(requirements).filter(g => requirements[g] && !g.includes('Percentage'));
      
      if (selectedGenders.length > 1) {
        const totalPercentage = selectedGenders.reduce((sum, gender) => {
          return sum + (requirements[`${gender}Percentage`] || 0);
        }, 0);
        
        if (totalPercentage !== 100) {
          newErrors.genderPercentages = 'Gender percentages must total exactly 100%';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };




  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Survey Specifications</h2>
          <p className="text-lg text-gray-600">
            Define the details and requirements for your survey
          </p>
        </div>

        <div className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Target className="w-6 h-6 mr-2 text-[#001D48]" />
              Basic Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Survey Name *
                </label>
                <input
                  type="text"
                  value={formData.surveyName || ''}
                  onChange={(e) => handleInputChange('surveyName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.surveyName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter survey name"
                />
                {errors.surveyName && (
                  <p className="mt-1 text-sm text-red-600">{errors.surveyName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category || ''}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.category ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select category</option>
                  {surveyCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                {errors.category && (
                  <p className="mt-1 text-sm text-red-600">{errors.category}</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.description ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Describe your survey objectives and goals"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purpose of Survey *
              </label>
              <textarea
                value={formData.purpose || ''}
                onChange={(e) => handleInputChange('purpose', e.target.value)}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.purpose ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="What is the core study you want to conduct? This will be used for AI interpretations."
              />
              {errors.purpose && (
                <p className="mt-1 text-sm text-red-600">{errors.purpose}</p>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Calendar className="w-6 h-6 mr-2 text-green-600" />
              Timeline
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={formData.startDate || ''}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.startDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.startDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date *
                </label>
                <input
                  type="date"
                  value={formData.endDate || ''}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.endDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.endDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
                )}
              </div>
            </div>
          </div>

          {/* Sample Size & Target Audience */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Users className="w-6 h-6 mr-2 text-[#373177]" />
              Sample Size & Target Audience
            </h3>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sample Size *
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="number"
                  value={formData.sampleSize || ''}
                  onChange={(e) => handleInputChange('sampleSize', e.target.value)}
                  className={`w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.sampleSize ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="100"
                  min="1"
                  max="100000"
                />
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <BarChart3 className="w-4 h-4" />
                  <span>Recommended: {calculateRecommendedSampleSize()} responses</span>
                </div>
              </div>
              {errors.sampleSize && (
                <p className="mt-1 text-sm text-red-600">{errors.sampleSize}</p>
              )}
            </div>


            {/* Target Audience Profiling */}
            <div className="space-y-6">
              <h4 className="text-lg font-medium text-gray-900">Target Audience Profiling</h4>
              
              {/* Demographics */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Demographics
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {demographicOptions.map(option => (
                    <label key={option} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={getTargetAudience('demographics')[option] || false}
                        onChange={(e) => handleNestedInputChange('targetAudience', 'demographics', {
                          ...getTargetAudience('demographics'),
                          [option]: e.target.checked
                        })}
                        className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
                
                {/* Dynamic Demographics Fields */}
                {Object.keys(getTargetAudience('demographics')).some(key => getTargetAudience('demographics')[key]) && (
                  <div className="mt-4 p-4 bg-[#E6F0F8] rounded-lg border border-blue-200">
                    <h5 className="text-sm font-medium text-blue-900 mb-3">Demographic Conditions</h5>
                    <div className="space-y-4">
                      {getTargetAudience('demographics')['Age Group'] && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Age</label>
                            <input
                              type="number"
                              value={formData.targetAudience.demographics.ageRange?.min || ''}
                              onChange={(e) => handleNestedInputChange('targetAudience', 'demographics', {
                                ...formData.targetAudience.demographics,
                                ageRange: {
                                  ...formData.targetAudience.demographics.ageRange,
                                  min: e.target.value
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="18"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Age</label>
                            <input
                              type="number"
                              value={formData.targetAudience.demographics.ageRange?.max || ''}
                              onChange={(e) => handleNestedInputChange('targetAudience', 'demographics', {
                                ...formData.targetAudience.demographics,
                                ageRange: {
                                  ...formData.targetAudience.demographics.ageRange,
                                  max: e.target.value
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="65"
                            />
                          </div>
                        </div>
                      )}
                      
                      {formData.targetAudience.demographics['Gender'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Gender Requirements</label>
                          <div className="space-y-3">
                            {['Male', 'Female', 'Non-binary'].map(gender => (
                              <div key={gender} className="flex items-center space-x-3">
                                <label className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.targetAudience.demographics.genderRequirements?.[gender] || false}
                                    onChange={(e) => {
                                      const isChecked = e.target.checked;
                                      const currentRequirements = formData.targetAudience.demographics.genderRequirements || {};
                                      const selectedGenders = Object.keys(currentRequirements).filter(g => currentRequirements[g]);
                                      
                                      let newRequirements = {
                                        ...currentRequirements,
                                        [gender]: isChecked
                                      };
                                      
                                      // If unchecking, remove percentage
                                      if (!isChecked) {
                                        delete newRequirements[`${gender}Percentage`];
                                      } else {
                                        // If checking and it's the only selected gender, set to 100%
                                        const newSelectedGenders = Object.keys(newRequirements).filter(g => newRequirements[g] && g !== `${gender}Percentage`);
                                        if (newSelectedGenders.length === 1) {
                                          newRequirements[`${gender}Percentage`] = 100;
                                        }
                                        // Note: For single gender selection, we set 100% but don't show input field
                                        // For multiple gender selection, we show input fields for manual entry
                                      }
                                      
                                      handleNestedInputChange('targetAudience', 'demographics', {
                                        ...formData.targetAudience.demographics,
                                        genderRequirements: newRequirements
                                      });
                                    }}
                                  className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{gender}</span>
                              </label>
                                
                                {/* Percentage input - only show if gender is selected AND multiple genders are selected */}
                                {formData.targetAudience.demographics.genderRequirements?.[gender] && (() => {
                                  const requirements = formData.targetAudience.demographics.genderRequirements || {};
                                  const selectedGenders = Object.keys(requirements).filter(g => requirements[g] && !g.includes('Percentage'));
                                  return selectedGenders.length > 1;
                                })() && (
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={formData.targetAudience.demographics.genderRequirements?.[`${gender}Percentage`] || ''}
                                      onChange={(e) => {
                                        const percentage = parseInt(e.target.value) || 0;
                                        const currentRequirements = formData.targetAudience.demographics.genderRequirements || {};
                                        
                                        handleNestedInputChange('targetAudience', 'demographics', {
                                          ...formData.targetAudience.demographics,
                                          genderRequirements: {
                                            ...currentRequirements,
                                            [`${gender}Percentage`]: percentage
                                          }
                                        });
                                      }}
                                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      placeholder="%"
                                    />
                                    <span className="text-sm text-gray-500">%</span>
                                  </div>
                                )}
                                
                                {/* Show "100%" text when only one gender is selected */}
                                {formData.targetAudience.demographics.genderRequirements?.[gender] && (() => {
                                  const requirements = formData.targetAudience.demographics.genderRequirements || {};
                                  const selectedGenders = Object.keys(requirements).filter(g => requirements[g] && !g.includes('Percentage'));
                                  return selectedGenders.length === 1;
                                })() && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">100%</span>
                                  </div>
                                )}
                              </div>
                            ))}
                            
                            {/* Validation message - only show for multiple genders */}
                            {(() => {
                              const requirements = formData.targetAudience.demographics.genderRequirements || {};
                              const selectedGenders = Object.keys(requirements).filter(g => requirements[g] && !g.includes('Percentage'));
                              
                              if (selectedGenders.length > 1) {
                                const totalPercentage = selectedGenders.reduce((sum, gender) => {
                                  return sum + (requirements[`${gender}Percentage`] || 0);
                                }, 0);
                                
                                if (totalPercentage !== 100) {
                                  return (
                                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                                      Total percentage must equal 100%. Current total: {totalPercentage}%
                                    </div>
                                  );
                                }
                              }
                              return null;
                            })()}
                            
                            {/* Form validation error */}
                            {errors.genderPercentages && (
                              <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                                {errors.genderPercentages}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {formData.targetAudience.demographics['Income Level'] && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Income (₹)</label>
                            <input
                              type="number"
                              value={formData.targetAudience.demographics.incomeRange?.min || ''}
                              onChange={(e) => handleNestedInputChange('targetAudience', 'demographics', {
                                ...formData.targetAudience.demographics,
                                incomeRange: {
                                  ...formData.targetAudience.demographics.incomeRange,
                                  min: e.target.value
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="300000"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Income (₹)</label>
                            <input
                              type="number"
                              value={formData.targetAudience.demographics.incomeRange?.max || ''}
                              onChange={(e) => handleNestedInputChange('targetAudience', 'demographics', {
                                ...formData.targetAudience.demographics,
                                incomeRange: {
                                  ...formData.targetAudience.demographics.incomeRange,
                                  max: e.target.value
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="1000000"
                            />
                          </div>
                        </div>
                      )}
                      
                      {formData.targetAudience.demographics['Education'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Education Level Requirements</label>
                          <div className="space-y-2">
                            {['High School', 'Bachelor\'s Degree', 'Master\'s Degree', 'PhD', 'Professional Degree'].map(education => (
                              <label key={education} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.targetAudience.demographics.educationRequirements?.[education] || false}
                                  onChange={(e) => handleNestedInputChange('targetAudience', 'demographics', {
                                    ...formData.targetAudience.demographics,
                                    educationRequirements: {
                                      ...formData.targetAudience.demographics.educationRequirements,
                                      [education]: e.target.checked
                                    }
                                  })}
                                  className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{education}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {formData.targetAudience.demographics['Occupation'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Occupation Requirements</label>
                          <textarea
                            value={formData.targetAudience.demographics.occupationRequirements || ''}
                            onChange={(e) => handleNestedInputChange('targetAudience', 'demographics', {
                              ...formData.targetAudience.demographics,
                              occupationRequirements: e.target.value
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows={3}
                            placeholder="e.g., Software Engineer, Teacher, Doctor, Business Owner..."
                          />
                        </div>
                      )}
                      
                      {formData.targetAudience.demographics['Marital Status'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Marital Status Requirements</label>
                          <div className="space-y-2">
                            {['Single', 'Married', 'Divorced', 'Widowed', 'Prefer not to say'].map(status => (
                              <label key={status} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.targetAudience.demographics.maritalStatusRequirements?.[status] || false}
                                  onChange={(e) => handleNestedInputChange('targetAudience', 'demographics', {
                                    ...formData.targetAudience.demographics,
                                    maritalStatusRequirements: {
                                      ...formData.targetAudience.demographics.maritalStatusRequirements,
                                      [status]: e.target.checked
                                    }
                                  })}
                                  className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{status}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {formData.targetAudience.demographics['Family Size'] && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Family Size</label>
                            <input
                              type="number"
                              value={formData.targetAudience.demographics.familySizeRange?.min || ''}
                              onChange={(e) => handleNestedInputChange('targetAudience', 'demographics', {
                                ...formData.targetAudience.demographics,
                                familySizeRange: {
                                  ...formData.targetAudience.demographics.familySizeRange,
                                  min: e.target.value
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="1"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Family Size</label>
                            <input
                              type="number"
                              value={formData.targetAudience.demographics.familySizeRange?.max || ''}
                              onChange={(e) => handleNestedInputChange('targetAudience', 'demographics', {
                                ...formData.targetAudience.demographics,
                                familySizeRange: {
                                  ...formData.targetAudience.demographics.familySizeRange,
                                  max: e.target.value
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="6"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Geographic */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Geographic Targeting
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {geographicOptions.map(option => (
                    <label key={option} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.targetAudience.geographic[option] || false}
                        onChange={(e) => handleNestedInputChange('targetAudience', 'geographic', {
                          ...formData.targetAudience.geographic,
                          [option]: e.target.checked
                        })}
                        className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
                
                {/* Dynamic Geographic Fields */}
                {Object.keys(formData.targetAudience.geographic).some(key => formData.targetAudience.geographic[key]) && (
                  <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <h5 className="text-sm font-medium text-green-900 mb-3">Geographic Conditions</h5>
                    <div className="space-y-4">
                      {formData.targetAudience.geographic['Country'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Target Countries</label>
                          <textarea
                            value={formData.targetAudience.geographic.countryRequirements || ''}
                            onChange={(e) => handleNestedInputChange('targetAudience', 'geographic', {
                              ...formData.targetAudience.geographic,
                              countryRequirements: e.target.value
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows={2}
                            placeholder="e.g., India, USA, UK, Canada..."
                          />
                        </div>
                      )}
                      
                      {formData.targetAudience.geographic['State/Province'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Target States/Provinces</label>
                          <textarea
                            value={formData.targetAudience.geographic.stateRequirements || ''}
                            onChange={(e) => handleNestedInputChange('targetAudience', 'geographic', {
                              ...formData.targetAudience.geographic,
                              stateRequirements: e.target.value
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows={2}
                            placeholder="e.g., Maharashtra, Karnataka, Tamil Nadu..."
                          />
                        </div>
                      )}
                      
                      {formData.targetAudience.geographic['City'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Target Cities</label>
                          <textarea
                            value={formData.targetAudience.geographic.cityRequirements || ''}
                            onChange={(e) => handleNestedInputChange('targetAudience', 'geographic', {
                              ...formData.targetAudience.geographic,
                              cityRequirements: e.target.value
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows={2}
                            placeholder="e.g., Mumbai, Delhi, Bangalore, Chennai..."
                          />
                        </div>
                      )}
                      
                      {formData.targetAudience.geographic['Urban/Rural'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Area Type Requirements</label>
                          <div className="space-y-2">
                            {['Urban', 'Rural', 'Semi-urban'].map(areaType => (
                              <label key={areaType} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.targetAudience.geographic.areaTypeRequirements?.[areaType] || false}
                                  onChange={(e) => handleNestedInputChange('targetAudience', 'geographic', {
                                    ...formData.targetAudience.geographic,
                                    areaTypeRequirements: {
                                      ...formData.targetAudience.geographic.areaTypeRequirements,
                                      [areaType]: e.target.checked
                                    }
                                  })}
                                  className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{areaType}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {formData.targetAudience.geographic['Postal Code'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code Requirements</label>
                          <textarea
                            value={formData.targetAudience.geographic.postalCodeRequirements || ''}
                            onChange={(e) => handleNestedInputChange('targetAudience', 'geographic', {
                              ...formData.targetAudience.geographic,
                              postalCodeRequirements: e.target.value
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows={2}
                            placeholder="e.g., 400001, 560001, 110001..."
                          />
                        </div>
                      )}
                      
                      {formData.targetAudience.geographic['Timezone'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Timezone Requirements</label>
                          <div className="space-y-2">
                            {['IST (UTC+5:30)', 'EST (UTC-5)', 'PST (UTC-8)', 'GMT (UTC+0)', 'CET (UTC+1)'].map(timezone => (
                              <label key={timezone} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.targetAudience.geographic.timezoneRequirements?.[timezone] || false}
                                  onChange={(e) => handleNestedInputChange('targetAudience', 'geographic', {
                                    ...formData.targetAudience.geographic,
                                    timezoneRequirements: {
                                      ...formData.targetAudience.geographic.timezoneRequirements,
                                      [timezone]: e.target.checked
                                    }
                                  })}
                                  className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{timezone}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Behavioral */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Behavioral Criteria
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {behavioralOptions.map(option => (
                    <label key={option} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.targetAudience.behavioral[option] || false}
                        onChange={(e) => handleNestedInputChange('targetAudience', 'behavioral', {
                          ...formData.targetAudience.behavioral,
                          [option]: e.target.checked
                        })}
                        className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
                
                {/* Dynamic Behavioral Fields */}
                {Object.keys(formData.targetAudience.behavioral).some(key => formData.targetAudience.behavioral[key]) && (
                  <div className="mt-4 p-4 bg-[#E8E6F5] rounded-lg border border-purple-200">
                    <h5 className="text-sm font-medium text-purple-900 mb-3">Behavioral Conditions</h5>
                    <div className="space-y-4">
                      {formData.targetAudience.behavioral['Purchase Behavior'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Purchase Behavior Requirements</label>
                          <div className="space-y-2">
                            {['Frequent Buyer', 'Occasional Buyer', 'Bargain Hunter', 'Brand Loyal', 'Impulse Buyer'].map(behavior => (
                              <label key={behavior} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.targetAudience.behavioral.purchaseBehaviorRequirements?.[behavior] || false}
                                  onChange={(e) => handleNestedInputChange('targetAudience', 'behavioral', {
                                    ...formData.targetAudience.behavioral,
                                    purchaseBehaviorRequirements: {
                                      ...formData.targetAudience.behavioral.purchaseBehaviorRequirements,
                                      [behavior]: e.target.checked
                                    }
                                  })}
                                  className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{behavior}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {formData.targetAudience.behavioral['Brand Loyalty'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Brand Loyalty Level</label>
                          <div className="space-y-2">
                            {['High Loyalty', 'Medium Loyalty', 'Low Loyalty', 'Brand Switcher'].map(loyalty => (
                              <label key={loyalty} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.targetAudience.behavioral.brandLoyaltyRequirements?.[loyalty] || false}
                                  onChange={(e) => handleNestedInputChange('targetAudience', 'behavioral', {
                                    ...formData.targetAudience.behavioral,
                                    brandLoyaltyRequirements: {
                                      ...formData.targetAudience.behavioral.brandLoyaltyRequirements,
                                      [loyalty]: e.target.checked
                                    }
                                  })}
                                  className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{loyalty}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {formData.targetAudience.behavioral['Online Activity'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Online Activity Level</label>
                          <div className="space-y-2">
                            {['Heavy Internet User', 'Moderate User', 'Light User', 'Social Media Active', 'E-commerce Active'].map(activity => (
                              <label key={activity} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.targetAudience.behavioral.onlineActivityRequirements?.[activity] || false}
                                  onChange={(e) => handleNestedInputChange('targetAudience', 'behavioral', {
                                    ...formData.targetAudience.behavioral,
                                    onlineActivityRequirements: {
                                      ...formData.targetAudience.behavioral.onlineActivityRequirements,
                                      [activity]: e.target.checked
                                    }
                                  })}
                                  className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{activity}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {formData.targetAudience.behavioral['Shopping Frequency'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Shopping Frequency</label>
                          <div className="space-y-2">
                            {['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Rarely'].map(frequency => (
                              <label key={frequency} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.targetAudience.behavioral.shoppingFrequencyRequirements?.[frequency] || false}
                                  onChange={(e) => handleNestedInputChange('targetAudience', 'behavioral', {
                                    ...formData.targetAudience.behavioral,
                                    shoppingFrequencyRequirements: {
                                      ...formData.targetAudience.behavioral.shoppingFrequencyRequirements,
                                      [frequency]: e.target.checked
                                    }
                                  })}
                                  className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{frequency}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {formData.targetAudience.behavioral['Media Consumption'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Media Consumption Preferences</label>
                          <div className="space-y-2">
                            {['TV', 'Radio', 'Newspaper', 'Online News', 'Social Media', 'Streaming Services'].map(media => (
                              <label key={media} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.targetAudience.behavioral.mediaConsumptionRequirements?.[media] || false}
                                  onChange={(e) => handleNestedInputChange('targetAudience', 'behavioral', {
                                    ...formData.targetAudience.behavioral,
                                    mediaConsumptionRequirements: {
                                      ...formData.targetAudience.behavioral.mediaConsumptionRequirements,
                                      [media]: e.target.checked
                                    }
                                  })}
                                  className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{media}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {formData.targetAudience.behavioral['Technology Usage'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Technology Usage Level</label>
                          <div className="space-y-2">
                            {['Tech Savvy', 'Moderate User', 'Basic User', 'Tech Reluctant'].map(techLevel => (
                              <label key={techLevel} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.targetAudience.behavioral.technologyUsageRequirements?.[techLevel] || false}
                                  onChange={(e) => handleNestedInputChange('targetAudience', 'behavioral', {
                                    ...formData.targetAudience.behavioral,
                                    technologyUsageRequirements: {
                                      ...formData.targetAudience.behavioral.technologyUsageRequirements,
                                      [techLevel]: e.target.checked
                                    }
                                  })}
                                  className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{techLevel}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Psychographic */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Psychographic Segmentation
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {psychographicOptions.map(option => (
                    <label key={option} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.targetAudience.psychographic[option] || false}
                        onChange={(e) => handleNestedInputChange('targetAudience', 'psychographic', {
                          ...formData.targetAudience.psychographic,
                          [option]: e.target.checked
                        })}
                        className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
                
                {/* Dynamic Psychographic Fields */}
                {Object.keys(formData.targetAudience.psychographic).some(key => formData.targetAudience.psychographic[key]) && (
                  <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <h5 className="text-sm font-medium text-orange-900 mb-3">Psychographic Conditions</h5>
                    <div className="space-y-4">
                      {formData.targetAudience.psychographic['Lifestyle'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Lifestyle Preferences</label>
                          <div className="space-y-2">
                            {['Active/Outdoor', 'Homebody', 'Social Butterfly', 'Workaholic', 'Family-Oriented', 'Adventure Seeker'].map(lifestyle => (
                              <label key={lifestyle} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.targetAudience.psychographic.lifestyleRequirements?.[lifestyle] || false}
                                  onChange={(e) => handleNestedInputChange('targetAudience', 'psychographic', {
                                    ...formData.targetAudience.psychographic,
                                    lifestyleRequirements: {
                                      ...formData.targetAudience.psychographic.lifestyleRequirements,
                                      [lifestyle]: e.target.checked
                                    }
                                  })}
                                  className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{lifestyle}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {formData.targetAudience.psychographic['Values'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Core Values</label>
                          <div className="space-y-2">
                            {['Family', 'Career', 'Health', 'Education', 'Environment', 'Social Justice', 'Innovation'].map(value => (
                              <label key={value} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.targetAudience.psychographic.valuesRequirements?.[value] || false}
                                  onChange={(e) => handleNestedInputChange('targetAudience', 'psychographic', {
                                    ...formData.targetAudience.psychographic,
                                    valuesRequirements: {
                                      ...formData.targetAudience.psychographic.valuesRequirements,
                                      [value]: e.target.checked
                                    }
                                  })}
                                  className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{value}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {formData.targetAudience.psychographic['Interests'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Interest Areas</label>
                          <div className="space-y-2">
                            {['Technology', 'Sports', 'Arts', 'Music', 'Travel', 'Cooking', 'Reading', 'Gaming'].map(interest => (
                              <label key={interest} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.targetAudience.psychographic.interestsRequirements?.[interest] || false}
                                  onChange={(e) => handleNestedInputChange('targetAudience', 'psychographic', {
                                    ...formData.targetAudience.psychographic,
                                    interestsRequirements: {
                                      ...formData.targetAudience.psychographic.interestsRequirements,
                                      [interest]: e.target.checked
                                    }
                                  })}
                                  className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{interest}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {formData.targetAudience.psychographic['Personality Traits'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Personality Characteristics</label>
                          <div className="space-y-2">
                            {['Extroverted', 'Introverted', 'Analytical', 'Creative', 'Practical', 'Optimistic', 'Cautious'].map(trait => (
                              <label key={trait} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.targetAudience.psychographic.personalityRequirements?.[trait] || false}
                                  onChange={(e) => handleNestedInputChange('targetAudience', 'psychographic', {
                                    ...formData.targetAudience.psychographic,
                                    personalityRequirements: {
                                      ...formData.targetAudience.psychographic.personalityRequirements,
                                      [trait]: e.target.checked
                                    }
                                  })}
                                  className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{trait}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {formData.targetAudience.psychographic['Attitudes'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Attitude Requirements</label>
                          <div className="space-y-2">
                            {['Open-minded', 'Traditional', 'Progressive', 'Conservative', 'Liberal', 'Neutral'].map(attitude => (
                              <label key={attitude} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.targetAudience.psychographic.attitudesRequirements?.[attitude] || false}
                                  onChange={(e) => handleNestedInputChange('targetAudience', 'psychographic', {
                                    ...formData.targetAudience.psychographic,
                                    attitudesRequirements: {
                                      ...formData.targetAudience.psychographic.attitudesRequirements,
                                      [attitude]: e.target.checked
                                    }
                                  })}
                                  className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{attitude}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {formData.targetAudience.psychographic['Opinions'] && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Opinion Requirements</label>
                          <textarea
                            value={formData.targetAudience.psychographic.opinionsRequirements || ''}
                            onChange={(e) => handleNestedInputChange('targetAudience', 'psychographic', {
                              ...formData.targetAudience.psychographic,
                              opinionsRequirements: e.target.value
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows={3}
                            placeholder="e.g., Environmental consciousness, Technology adoption, Social issues..."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Specifications */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Specifications
                </label>
                <textarea
                  value={formData.targetAudience.custom}
                  onChange={(e) => handleNestedInputChange('targetAudience', 'custom', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Any specific requirements or criteria for your target audience"
                />
              </div>
            </div>
          </div>

          {/* Interview Limits */}
          {((typeof mode === 'object' ? mode.mode : mode) === 'capi' || (typeof mode === 'object' ? mode.mode : mode) === 'cati') && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Users className="w-6 h-6 mr-2 text-[#001D48]" />
                Interview Limits
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Threshold Interviews per Day
                    </label>
                    <input
                      type="number"
                      value={formData.thresholdInterviewsPerDay || ''}
                      onChange={(e) => handleInputChange('thresholdInterviewsPerDay', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Interviews per Interviewer
                    </label>
                    <input
                      type="number"
                      value={formData.maxInterviewsPerInterviewer || ''}
                      onChange={(e) => handleInputChange('maxInterviewsPerInterviewer', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="5"
                    />
                  </div>
                </div>
              </div>
          )}

          {/* Contact Mode for Online Interviews */}
          {((typeof mode === 'object' ? mode.mode : mode) === 'online_interview') && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Globe className="w-6 h-6 mr-2 text-green-600" />
                Contact Mode
              </h3>
              
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="contactMode"
                    value="email"
                    checked={formData.contactMode === 'email'}
                    onChange={(e) => handleInputChange('contactMode', e.target.value)}
                    className="w-4 h-4 text-[#001D48] border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Email</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="contactMode"
                    value="whatsapp"
                    checked={formData.contactMode === 'whatsapp'}
                    onChange={(e) => handleInputChange('contactMode', e.target.value)}
                    className="w-4 h-4 text-[#001D48] border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">WhatsApp</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="contactMode"
                    value="both"
                    checked={formData.contactMode === 'both'}
                    onChange={(e) => handleInputChange('contactMode', e.target.value)}
                    className="w-4 h-4 text-[#001D48] border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Both</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SurveySpecifications;
