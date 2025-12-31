import React, { useState, useEffect } from 'react';
import { X, Save, Loader, AlertCircle, CheckCircle, Eye, EyeOff, Plus, Trash2, UserPlus, Mail, Phone, Building2, MapPin, Globe, Calendar } from 'lucide-react';
import { companyAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const companySizes = [
  { value: 'startup', label: 'Startup (1-10 employees)' },
  { value: 'small', label: 'Small (11-50 employees)' },
  { value: 'medium', label: 'Medium (51-200 employees)' },
  { value: 'large', label: 'Large (201-1000 employees)' },
  { value: 'enterprise', label: 'Enterprise (1000+ employees)' }
];

const companyStatuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

const EditCompanyModal = ({ company, onSave, onCancel }) => {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [companyAdmins, setCompanyAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const { showSuccess, showError, showWarning } = useToast();
  
  // Add new admin form
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdminData, setNewAdminData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState(null);

  useEffect(() => {
    // Initialize form data from company prop
    setFormData({
      companyName: company.companyName || '',
      companyCode: company.companyCode || '',
      industry: company.industry || '',
      companySize: company.companySize || 'medium',
      companyEmail: company.email || company.companyEmail || '',
      companyPhone: company.phone || company.companyPhone || '',
      companyWebsite: company.website || company.companyWebsite || '',
      status: company.status || 'pending',
      address: {
        street: company.address?.street || '',
        city: company.address?.city || '',
        state: company.address?.state || '',
        country: company.address?.country || '',
        postalCode: company.address?.postalCode || '',
      },
      description: company.description || '',
      foundedYear: company.foundedYear || '',
      employeeCount: company.employeeCount || '',
      revenue: company.revenue || '',
      socialMedia: {
        linkedin: company.socialMedia?.linkedin || '',
        twitter: company.socialMedia?.twitter || '',
        facebook: company.socialMedia?.facebook || '',
      }
    });

    // Load company admins
    loadCompanyAdmins();
  }, [company]);

  const loadCompanyAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const response = await companyAPI.getCompanyById(company._id);
      if (response.success) {
        setCompanyAdmins(response.data.companyAdmins || []);
      }
    } catch (error) {
      console.error('Failed to load company admins:', error);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        address: {
          ...(prev.address || {}),
          [addressField]: value,
        },
      }));
    } else if (name.startsWith('socialMedia.')) {
      const socialField = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        socialMedia: {
          ...(prev.socialMedia || {}),
          [socialField]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  };

  const handleNewAdminChange = (e) => {
    const { name, value } = e.target;
    setNewAdminData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    const errors = [];

    if (!formData.companyName.trim()) errors.push('Company name is required');
    if (!formData.companyCode.trim()) errors.push('Company code is required');
    if (!formData.industry.trim()) errors.push('Industry is required');
    if (!formData.companyEmail.trim()) errors.push('Company email is required');
    
    if (formData.companyEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.companyEmail.trim())) {
        errors.push('Please provide a valid company email address');
      }
    }

    if (formData.companyCode.trim()) {
      const companyCodeRegex = /^[A-Z0-9_]+$/;
      if (!companyCodeRegex.test(formData.companyCode.trim())) {
        errors.push('Company code can only contain uppercase letters, numbers, and underscores');
      }
      if (formData.companyCode.trim().length < 2 || formData.companyCode.trim().length > 20) {
        errors.push('Company code must be between 2 and 20 characters');
      }
    }

    return errors;
  };

  const isPasswordValid = () => {
    const password = newAdminData.password;
    return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password);
  };

  const validateNewAdmin = () => {
    const errors = [];

    if (!newAdminData.firstName.trim()) errors.push('First name is required');
    if (!newAdminData.lastName.trim()) errors.push('Last name is required');
    if (!newAdminData.email.trim()) errors.push('Email is required');
    if (!newAdminData.phone.trim()) errors.push('Phone number is required');
    if (!newAdminData.password.trim()) errors.push('Password is required');

    if (newAdminData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newAdminData.email.trim())) {
        errors.push('Please provide a valid email address');
      }
    }

    if (newAdminData.password.trim()) {
      if (newAdminData.password.length < 8) {
        errors.push('Password must be at least 8 characters long');
      }
      const hasUpperCase = /[A-Z]/.test(newAdminData.password);
      const hasLowerCase = /[a-z]/.test(newAdminData.password);
      if (!hasUpperCase || !hasLowerCase) {
        errors.push('Password must contain at least one uppercase letter and one lowercase letter');
      }
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      return;
    }

    setLoading(true);
    try {
      const dataToUpdate = {
        companyName: formData.companyName.trim(),
        companyCode: formData.companyCode.trim(),
        industry: formData.industry.trim(),
        companySize: formData.companySize,
        companyEmail: formData.companyEmail.trim(),
        companyPhone: formData.companyPhone.trim(),
        companyWebsite: formData.companyWebsite.trim(),
        status: formData.status,
        description: formData.description.trim(),
        foundedYear: formData.foundedYear || undefined,
        employeeCount: formData.employeeCount || undefined,
        revenue: formData.revenue || undefined,
        address: {
          street: formData.address?.street?.trim() || undefined,
          city: formData.address?.city?.trim() || undefined,
          state: formData.address?.state?.trim() || undefined,
          country: formData.address?.country?.trim() || undefined,
          postalCode: formData.address?.postalCode?.trim() || undefined,
        },
        socialMedia: {
          linkedin: formData.socialMedia?.linkedin?.trim() || undefined,
          twitter: formData.socialMedia?.twitter?.trim() || undefined,
          facebook: formData.socialMedia?.facebook?.trim() || undefined,
        }
      };

      // Remove empty address fields
      if (dataToUpdate.address) {
        Object.keys(dataToUpdate.address).forEach(key => {
          if (dataToUpdate.address[key] === undefined) {
            delete dataToUpdate.address[key];
          }
        });
        if (Object.keys(dataToUpdate.address).length === 0) {
          delete dataToUpdate.address;
        }
      }

      // Remove empty social media fields
      if (dataToUpdate.socialMedia) {
        Object.keys(dataToUpdate.socialMedia).forEach(key => {
          if (dataToUpdate.socialMedia[key] === undefined) {
            delete dataToUpdate.socialMedia[key];
          }
        });
        if (Object.keys(dataToUpdate.socialMedia).length === 0) {
          delete dataToUpdate.socialMedia;
        }
      }

      await onSave(dataToUpdate);
      setSuccess(true);
      showSuccess('Company Updated!', 'Company information has been updated successfully.');
      setTimeout(() => {
        onCancel();
      }, 1500);
    } catch (err) {
      console.error('Failed to update company:', err);
      const errorMessage = err.response?.data?.message || 'Failed to update company';
      setError(errorMessage);
      showError('Update Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async (e) => {
    try {
      setError(null);

      const validationErrors = validateNewAdmin();
      if (validationErrors.length > 0) {
        setError(validationErrors.join(', '));
        return;
      }

      setAddingAdmin(true);
      
      const response = await companyAPI.addCompanyAdmin(company._id, {
        firstName: newAdminData.firstName.trim(),
        lastName: newAdminData.lastName.trim(),
        email: newAdminData.email.trim(),
        phone: newAdminData.phone.trim(),
        password: newAdminData.password
      });

      if (response.success) {
        // Reset form
        setNewAdminData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          password: ''
        });
        setShowAddAdmin(false);
        // Reload admins
        await loadCompanyAdmins();
      } else {
        setError(response.message || 'Failed to add company admin');
      }
    } catch (err) {
      console.error('Failed to add company admin:', err);
      setError(err.response?.data?.message || 'Failed to add company admin');
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = (adminId) => {
    const admin = companyAdmins.find(a => a._id === adminId);
    setAdminToDelete({ id: adminId, name: admin?.firstName + ' ' + admin?.lastName });
    setShowDeleteConfirm(true);
  };

  const confirmRemoveAdmin = async () => {
    try {
      const response = await companyAPI.removeCompanyAdmin(company._id, adminToDelete.id);
      if (response.success) {
        loadCompanyAdmins();
        showSuccess('Admin Removed', 'Company admin has been removed successfully.');
      }
    } catch (err) {
      console.error('Failed to remove company admin:', err);
      showError('Failed to Remove Admin', err.response?.data?.message || 'Failed to remove company admin');
    } finally {
      setShowDeleteConfirm(false);
      setAdminToDelete(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 !mt-0">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900">Edit Company: {company.companyName}</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1">
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 mr-3" />
              <span>Company updated successfully!</span>
            </div>
          )}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 flex items-center">
              <AlertCircle className="w-5 h-5 mr-3" />
              <span>{error}</span>
            </div>
          )}

          {/* Basic Company Information */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-800">Basic Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input type="text" name="companyName" id="companyName" value={formData.companyName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" required />
              </div>
              <div>
                <label htmlFor="companyCode" className="block text-sm font-medium text-gray-700 mb-1">Company Code</label>
                <input type="text" name="companyCode" id="companyCode" value={formData.companyCode} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" required />
              </div>
              <div>
                <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                <input type="text" name="industry" id="industry" value={formData.industry} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" required />
              </div>
              <div>
                <label htmlFor="companySize" className="block text-sm font-medium text-gray-700 mb-1">Company Size</label>
                <select name="companySize" id="companySize" value={formData.companySize} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  {companySizes.map(size => (
                    <option key={size.value} value={size.value}>{size.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select name="status" id="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  {companyStatuses.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <h4 className="text-lg font-semibold text-gray-800">Contact Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="companyEmail" className="block text-sm font-medium text-gray-700 mb-1">Company Email</label>
                <input type="email" name="companyEmail" id="companyEmail" value={formData.companyEmail} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" required />
              </div>
              <div>
                <label htmlFor="companyPhone" className="block text-sm font-medium text-gray-700 mb-1">Company Phone</label>
                <input type="tel" name="companyPhone" id="companyPhone" value={formData.companyPhone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="companyWebsite" className="block text-sm font-medium text-gray-700 mb-1">Company Website</label>
                <input type="url" name="companyWebsite" id="companyWebsite" value={formData.companyWebsite} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <h4 className="text-lg font-semibold text-gray-800">Address Information</h4>
            <div className="space-y-2">
              <input type="text" name="address.street" placeholder="Street Address" value={formData.address?.street || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" name="address.city" placeholder="City" value={formData.address?.city || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                <input type="text" name="address.state" placeholder="State" value={formData.address?.state || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" name="address.country" placeholder="Country" value={formData.address?.country || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                <input type="text" name="address.postalCode" placeholder="Postal Code" value={formData.address?.postalCode || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <h4 className="text-lg font-semibold text-gray-800">Additional Information</h4>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows="3" className="w-full px-3 py-2 border border-gray-300 rounded-md"></textarea>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="foundedYear" className="block text-sm font-medium text-gray-700 mb-1">Founded Year</label>
                <input type="number" name="foundedYear" id="foundedYear" value={formData.foundedYear} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label htmlFor="employeeCount" className="block text-sm font-medium text-gray-700 mb-1">Employee Count</label>
                <input type="number" name="employeeCount" id="employeeCount" value={formData.employeeCount} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label htmlFor="revenue" className="block text-sm font-medium text-gray-700 mb-1">Annual Revenue</label>
                <input type="text" name="revenue" id="revenue" value={formData.revenue} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <h4 className="text-lg font-semibold text-gray-800">Social Media</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="socialMedia.linkedin" className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
                <input type="url" name="socialMedia.linkedin" id="socialMedia.linkedin" value={formData.socialMedia?.linkedin || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label htmlFor="socialMedia.twitter" className="block text-sm font-medium text-gray-700 mb-1">Twitter</label>
                <input type="url" name="socialMedia.twitter" id="socialMedia.twitter" value={formData.socialMedia?.twitter || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label htmlFor="socialMedia.facebook" className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
                <input type="url" name="socialMedia.facebook" id="socialMedia.facebook" value={formData.socialMedia?.facebook || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>
          </div>

          {/* Company Admins Management */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-800">Company Admins</h4>
              <button
                type="button"
                onClick={() => setShowAddAdmin(!showAddAdmin)}
                className="flex items-center px-3 py-2 bg-[#373177] text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Admin
              </button>
            </div>

            {/* Add New Admin Form */}
            {showAddAdmin && (
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h5 className="text-md font-medium text-gray-700 mb-3">Add New Company Admin</h5>
                <form className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      name="firstName"
                      placeholder="First Name"
                      value={newAdminData.firstName}
                      onChange={handleNewAdminChange}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <input
                      type="text"
                      name="lastName"
                      placeholder="Last Name"
                      value={newAdminData.lastName}
                      onChange={handleNewAdminChange}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <input
                      type="email"
                      name="email"
                      placeholder="Email"
                      value={newAdminData.email}
                      onChange={handleNewAdminChange}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <input
                      type="tel"
                      name="phone"
                      placeholder="Phone"
                      value={newAdminData.phone}
                      onChange={handleNewAdminChange}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <div className="md:col-span-2">
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          placeholder="Password"
                          value={newAdminData.password}
                          onChange={handleNewAdminChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className="mt-1 text-xs text-gray-600">
                        <p>Password must contain:</p>
                        <ul className="list-disc list-inside ml-2">
                          <li className={newAdminData.password.length >= 8 ? "text-green-600" : "text-gray-500"}>
                            At least 8 characters
                          </li>
                          <li className={/[A-Z]/.test(newAdminData.password) ? "text-green-600" : "text-gray-500"}>
                            One uppercase letter
                          </li>
                          <li className={/[a-z]/.test(newAdminData.password) ? "text-green-600" : "text-gray-500"}>
                            One lowercase letter
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowAddAdmin(false)}
                      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={addingAdmin || !isPasswordValid()}
                      onClick={async (e) => {
                        e.preventDefault();
                        await handleAddAdmin(e);
                      }}
                      className={`px-3 py-2 rounded-md transition-colors flex items-center ${
                        addingAdmin || !isPasswordValid() 
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {addingAdmin ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      Add Admin
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Current Company Admins */}
            <div className="space-y-2">
              {loadingAdmins ? (
                <div className="flex items-center justify-center py-4">
                  <Loader className="w-4 h-4 animate-spin text-[#001D48] mr-2" />
                  <span className="text-gray-600">Loading admins...</span>
                </div>
              ) : companyAdmins.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>No company admins found</p>
                </div>
              ) : (
                companyAdmins.map((admin) => (
                  <div key={admin._id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gradient-to-r from-[#373177] to-[#373177] rounded-full flex items-center justify-center text-white font-medium text-sm">
                        {admin.firstName.charAt(0)}{admin.lastName.charAt(0)}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {admin.firstName} {admin.lastName}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <Mail className="w-3 h-3 mr-1" />
                          {admin.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        admin.status === 'active' ? 'bg-green-100 text-green-800' :
                        admin.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {admin.status}
                      </span>
                      <button
                        onClick={() => handleRemoveAdmin(admin._id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Remove Admin"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#373177] text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              disabled={loading}
            >
              {loading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </button>
          </div>
        </form>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Remove Company Admin</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 mb-2">
                  Are you sure you want to remove <strong>{adminToDelete?.name}</strong> as a company admin?
                </p>
                <p className="text-sm text-gray-600">
                  They will lose access to company management features.
                </p>
              </div>
              
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setAdminToDelete(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveAdmin}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Remove Admin
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditCompanyModal;
