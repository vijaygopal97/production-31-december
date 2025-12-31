import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Eye, 
  FileText, 
  User, 
  Phone, 
  Mail, 
  Calendar,
  AlertCircle,
  Loader,
  Shield,
  Download,
  X,
  ChevronRight,
  MapPin,
  GraduationCap,
  Smartphone,
  CreditCard,
  FileImage,
  FileCheck,
  Clock,
  Star,
  Search,
  Filter,
  ChevronLeft,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { authAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { getFileUrl } from '../../utils/config';

const DocumentVerification = () => {
  const { showSuccess, showError } = useToast();
  const [pendingProfiles, setPendingProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [feedback, setFeedback] = useState('');
  
  // Document preview states
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [previewType, setPreviewType] = useState('');
  const [previewDocumentNumber, setPreviewDocumentNumber] = useState('');
  const [previewBankDetails, setPreviewBankDetails] = useState(null);

  // Filter and pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('lastSubmittedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchPendingProfiles();
  }, []);

  const fetchPendingProfiles = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getPendingProfiles();
      setPendingProfiles(response.data);
    } catch (error) {
      console.error('Error fetching pending profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (action) => {
    try {
      setReviewing(true);
      await authAPI.reviewProfile({
        userId: selectedProfile._id,
        status: action,
        feedback
      });
      
      const actionText = action === 'approved' ? 'approved' : 'rejected';
      showSuccess('Profile Review Complete', `Profile has been ${actionText} successfully.`);
      
      setShowModal(false);
      setFeedback('');
      fetchPendingProfiles();
    } catch (error) {
      console.error('Error reviewing profile:', error);
      showError('Review Failed', 'Failed to review profile. Please try again.');
    } finally {
      setReviewing(false);
    }
  };

  const openModal = (profile) => {
    setSelectedProfile(profile);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedProfile(null);
    setFeedback('');
  };

  // Document preview functions
  const handleDocumentPreview = async (documentPath, documentType, documentNumber = '', bankDetails = null, signedUrl = null) => {
    if (documentPath) {
      let documentUrl = signedUrl;
      
      // If no signed URL provided, try to get it
      if (!documentUrl) {
        // Check if it's an S3 key
        if (documentPath.startsWith('documents/') || documentPath.startsWith('audio/') || documentPath.startsWith('reports/')) {
          try {
            const isProduction = window.location.protocol === 'https:' || window.location.hostname !== 'localhost';
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isProduction ? '' : 'http://localhost:5000');
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/survey-responses/audio-signed-url?audioUrl=${encodeURIComponent(documentPath)}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
              const data = await response.json();
              if (data.signedUrl) {
                documentUrl = data.signedUrl;
              }
            }
          } catch (error) {
            console.error('Error fetching signed URL:', error);
          }
        }
      }
      
      // Fallback to getFileUrl if no signed URL
      if (!documentUrl) {
        documentUrl = getFileUrl(documentPath);
      }
      
      setPreviewDocument(documentUrl);
      setPreviewType(documentType);
      setPreviewDocumentNumber(documentNumber);
      setPreviewBankDetails(bankDetails);
      setShowDocumentPreview(true);
    }
  };

  const closeDocumentPreview = () => {
    setShowDocumentPreview(false);
    setPreviewDocument(null);
    setPreviewType('');
    setPreviewDocumentNumber('');
    setPreviewBankDetails(null);
  };

  // Filter and search functions
  const filteredProfiles = pendingProfiles.filter(profile => {
    const matchesSearch = !searchTerm || 
      profile.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.phone?.includes(searchTerm);
    
    return matchesSearch;
  });

  const sortedProfiles = [...filteredProfiles].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'lastSubmittedAt':
        aValue = new Date(a.interviewerProfile.lastSubmittedAt);
        bValue = new Date(b.interviewerProfile.lastSubmittedAt);
        break;
      case 'name':
        aValue = `${a.firstName} ${a.lastName}`.toLowerCase();
        bValue = `${b.firstName} ${b.lastName}`.toLowerCase();
        break;
      case 'email':
        aValue = a.email?.toLowerCase() || '';
        bValue = b.email?.toLowerCase() || '';
        break;
      default:
        aValue = a[sortBy];
        bValue = b[sortBy];
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedProfiles.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProfiles = sortedProfiles.slice(startIndex, endIndex);

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    if (searchTerm) count++;
    return count;
  };

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Handle sort
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-[#373177]" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Document Verification</h1>
        <p className="text-gray-600">Review and approve interviewer profile submissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-50 rounded-lg">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Reviews</p>
              <p className="text-2xl font-bold text-gray-900">{filteredProfiles.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Approved Today</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-red-50 rounded-lg">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Rejected Today</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-600 mb-1 invisible">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by interviewer name, email, or phone number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
            >
              Clear All
            </button>
          </div>
        </div>
        
        {/* Active Filters Display */}
        {getActiveFilterCount() > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">Active filters:</span>
              {searchTerm && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#E6F0F8] text-[#001D48]">
                  Search: {searchTerm}
                  <button
                    onClick={() => setSearchTerm('')}
                    className="ml-1 text-[#373177] hover:text-[#001D48]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pending Profiles Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Pending Profile Reviews</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                    Interviewer
                    {sortBy === 'name' && (
                      sortOrder === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center">
                    Contact
                    {sortBy === 'email' && (
                      sortOrder === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('lastSubmittedAt')}
                >
                  <div className="flex items-center">
                    Submitted
                    {sortBy === 'lastSubmittedAt' && (
                      sortOrder === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Documents
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedProfiles.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No profiles found</h3>
                      <p className="text-gray-500">
                        {searchTerm ? 'No profiles match your search criteria.' : 'No pending profile verifications at the moment.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProfiles.map((profile) => (
                <tr key={profile._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <User className="h-5 w-5 text-gray-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {profile.firstName} {profile.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {profile._id.slice(-8)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{profile.email}</div>
                    <div className="text-sm text-gray-500">{profile.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(profile.interviewerProfile.lastSubmittedAt).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(profile.interviewerProfile.lastSubmittedAt).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      {profile.interviewerProfile.cvUpload && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          CV
                        </span>
                      )}
                      {profile.interviewerProfile.aadhaarDocument && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Aadhaar
                        </span>
                      )}
                      {profile.interviewerProfile.panDocument && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          PAN
                        </span>
                      )}
                      {profile.interviewerProfile.passportPhoto && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Photo
                        </span>
                      )}
                      {profile.interviewerProfile.bankDocumentUpload && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Bank
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => openModal(profile)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#001D48] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Verify Details
                    </button>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4 rounded-lg shadow-sm">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                <span className="font-medium">{Math.min(endIndex, sortedProfiles.length)}</span> of{' '}
                <span className="font-medium">{sortedProfiles.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          page === currentPage
                            ? 'z-10 bg-[#E6F0F8] border-blue-500 text-[#373177]'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return (
                      <span key={page} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Professional Review Modal */}
      {showModal && selectedProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full h-[95vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-[#E6F0F8] rounded-lg">
                  <Shield className="h-6 w-6 text-[#373177]" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Profile Verification
                  </h3>
                  <p className="text-sm text-gray-600">
                    {selectedProfile.firstName} {selectedProfile.lastName} • ID: {selectedProfile._id.slice(-8)}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Profile Details */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Basic Information */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <User className="h-5 w-5 text-[#373177] mr-2" />
                      <h4 className="text-lg font-semibold text-gray-900">Basic Information</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Full Name</label>
                        <p className="text-gray-900">{selectedProfile.firstName} {selectedProfile.lastName}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Email Address</label>
                        <p className="text-gray-900">{selectedProfile.email}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Phone Number</label>
                        <p className="text-gray-900">{selectedProfile.phone}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Age</label>
                        <p className="text-gray-900">{selectedProfile.interviewerProfile.age} years</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Gender</label>
                        <p className="text-gray-900 capitalize">{selectedProfile.interviewerProfile.gender || 'Not specified'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Personal Details */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <GraduationCap className="h-5 w-5 text-green-600 mr-2" />
                      <h4 className="text-lg font-semibold text-gray-900">Personal Details</h4>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Languages Spoken</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedProfile.interviewerProfile.languagesSpoken?.map((lang, index) => (
                            <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F0F8] text-[#001D48]">
                              {lang}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-600">Highest Degree</label>
                          <p className="text-gray-900">{selectedProfile.interviewerProfile.highestDegree?.name || 'Not specified'}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-600">Institution</label>
                          <p className="text-gray-900">{selectedProfile.interviewerProfile.highestDegree?.institution || 'Not specified'}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-600">Year</label>
                          <p className="text-gray-900">{selectedProfile.interviewerProfile.highestDegree?.year || 'Not specified'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Survey Experience */}
                  <div className="bg-orange-50 rounded-lg p-6 border border-orange-200">
                    <div className="flex items-center mb-4">
                      <FileCheck className="h-5 w-5 text-orange-600 mr-2" />
                      <h4 className="text-lg font-semibold text-gray-900">Survey Experience</h4>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Previous Survey Experience</label>
                        <p className="text-gray-900 mt-1">
                          {selectedProfile.interviewerProfile.hasSurveyExperience === true 
                            ? 'Yes' 
                            : selectedProfile.interviewerProfile.hasSurveyExperience === false 
                            ? 'No' 
                            : 'Not specified'
                          }
                        </p>
                      </div>
                      
                      {selectedProfile.interviewerProfile.hasSurveyExperience === true && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-sm font-medium text-gray-600">Years of Experience</label>
                              <p className="text-gray-900">
                                {selectedProfile.interviewerProfile.surveyExperienceYears || 'Not specified'}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">Experience Description</label>
                            <p className="text-gray-900 text-sm leading-relaxed">
                              {selectedProfile.interviewerProfile.surveyExperienceDescription || 'Not provided'}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Survey Requirements */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <Smartphone className="h-5 w-5 text-[#373177] mr-2" />
                      <h4 className="text-lg font-semibold text-gray-900">Survey Requirements</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Owns Smartphone</label>
                        <p className="text-gray-900">{selectedProfile.interviewerProfile.ownsSmartphone ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Smartphone Type</label>
                        <p className="text-gray-900">{selectedProfile.interviewerProfile.smartphoneType || 'Not specified'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Willing to Travel</label>
                        <p className="text-gray-900">{selectedProfile.interviewerProfile.willingToTravel ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Has Vehicle</label>
                        <p className="text-gray-900">{selectedProfile.interviewerProfile.hasVehicle ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Willing to Record Audio</label>
                        <p className="text-gray-900">{selectedProfile.interviewerProfile.willingToRecordAudio ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Agrees to Remuneration</label>
                        <p className="text-gray-900">{selectedProfile.interviewerProfile.agreesToRemuneration ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <CreditCard className="h-5 w-5 text-orange-600 mr-2" />
                      <h4 className="text-lg font-semibold text-gray-900">Payment Details</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Account Number</label>
                        <p className="text-gray-900 font-mono">{selectedProfile.interviewerProfile.bankAccountNumber || 'Not provided'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Account Holder</label>
                        <p className="text-gray-900">{selectedProfile.interviewerProfile.bankAccountHolderName || 'Not provided'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Bank Name</label>
                        <p className="text-gray-900">{selectedProfile.interviewerProfile.bankName || 'Not provided'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">IFSC Code</label>
                        <p className="text-gray-900 font-mono">{selectedProfile.interviewerProfile.bankIfscCode || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Verification Documents */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <FileCheck className="h-5 w-5 text-red-600 mr-2" />
                      <h4 className="text-lg font-semibold text-gray-900">Verification Documents</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Aadhaar Number</label>
                        <p className="text-gray-900 font-mono">{selectedProfile.interviewerProfile.aadhaarNumber || 'Not provided'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">PAN Number</label>
                        <p className="text-gray-900 font-mono">{selectedProfile.interviewerProfile.panNumber || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Agreements */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <Star className="h-5 w-5 text-yellow-600 mr-2" />
                      <h4 className="text-lg font-semibold text-gray-900">Agreements</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Agrees to Share Information</label>
                        <p className="text-gray-900">{selectedProfile.interviewerProfile.agreesToShareInfo ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600">Agrees to Participate in Surveys</label>
                        <p className="text-gray-900">{selectedProfile.interviewerProfile.agreesToParticipateInSurvey ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Documents & Actions */}
                <div className="space-y-6">
                  {/* Document Previews */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Uploaded Documents</h4>
                    <div className="space-y-3">
                      {/* CV Document */}
                      {selectedProfile.interviewerProfile.cvUpload && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <FileText className="h-5 w-5 text-[#373177] mr-3" />
                            <span className="text-sm font-medium text-gray-900">CV Document</span>
                          </div>
                          <button
                            onClick={() => handleDocumentPreview(
                              selectedProfile.interviewerProfile.cvUpload, 
                              'CV Document',
                              '',
                              null,
                              selectedProfile.interviewerProfile.cvUploadSignedUrl
                            )}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-[#E6F0F8] hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </button>
                        </div>
                      )}

                      {/* Aadhaar Document */}
                      {selectedProfile.interviewerProfile.aadhaarDocument && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <FileImage className="h-5 w-5 text-green-600 mr-3" />
                            <span className="text-sm font-medium text-gray-900">Aadhaar Card</span>
                          </div>
                          <button
                            onClick={() => handleDocumentPreview(
                              selectedProfile.interviewerProfile.aadhaarDocument, 
                              'Aadhaar Card', 
                              selectedProfile.interviewerProfile.aadhaarNumber,
                              null,
                              selectedProfile.interviewerProfile.aadhaarDocumentSignedUrl
                            )}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-[#E6F0F8] hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </button>
                        </div>
                      )}

                      {/* PAN Document */}
                      {selectedProfile.interviewerProfile.panDocument && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <FileImage className="h-5 w-5 text-[#373177] mr-3" />
                            <span className="text-sm font-medium text-gray-900">PAN Card</span>
                          </div>
                          <button
                            onClick={() => handleDocumentPreview(
                              selectedProfile.interviewerProfile.panDocument, 
                              'PAN Card', 
                              selectedProfile.interviewerProfile.panNumber,
                              null,
                              selectedProfile.interviewerProfile.panDocumentSignedUrl
                            )}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-[#E6F0F8] hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </button>
                        </div>
                      )}

                      {/* Passport Photo */}
                      {selectedProfile.interviewerProfile.passportPhoto && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <FileImage className="h-5 w-5 text-orange-600 mr-3" />
                            <span className="text-sm font-medium text-gray-900">Passport Photo</span>
                          </div>
                          <button
                            onClick={() => handleDocumentPreview(
                              selectedProfile.interviewerProfile.passportPhoto, 
                              'Passport Photo',
                              '',
                              null,
                              selectedProfile.interviewerProfile.passportPhotoSignedUrl
                            )}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-[#E6F0F8] hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </button>
                        </div>
                      )}

                      {/* Bank Document */}
                      {selectedProfile.interviewerProfile.bankDocumentUpload && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <FileImage className="h-5 w-5 text-red-600 mr-3" />
                            <span className="text-sm font-medium text-gray-900">Bank Document</span>
                          </div>
                          <button
                            onClick={() => handleDocumentPreview(
                              selectedProfile.interviewerProfile.bankDocumentUpload, 
                              'Bank Document', 
                              '', // documentNumber (empty for bank document)
                              {
                                accountNumber: selectedProfile.interviewerProfile.bankAccountNumber,
                                accountHolderName: selectedProfile.interviewerProfile.bankAccountHolderName,
                                bankName: selectedProfile.interviewerProfile.bankName,
                                ifscCode: selectedProfile.interviewerProfile.bankIfscCode
                              }
                            )}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-[#E6F0F8] hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submission Info */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Submission Details</h4>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <Clock className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(selectedProfile.interviewerProfile.lastSubmittedAt).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(selectedProfile.interviewerProfile.lastSubmittedAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Feedback Section */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Review Feedback</h4>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Add your feedback or comments for the interviewer..."
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Review Decision</h4>
                    <div className="space-y-3">
                      <button
                        onClick={() => handleReview('approved')}
                        disabled={reviewing}
                        className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      >
                        {reviewing ? (
                          <Loader className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Approve Profile
                      </button>
                      <button
                        onClick={() => handleReview('rejected')}
                        disabled={reviewing}
                        className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      >
                        {reviewing ? (
                          <Loader className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2" />
                        )}
                        Request Changes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {showDocumentPreview && previewDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full h-[95vh] flex flex-col">
            {/* Preview Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <FileImage className="h-6 w-6 text-[#373177]" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{previewType} Preview</h3>
                  {(previewType === 'Aadhaar Card' || previewType === 'PAN Card') && previewDocumentNumber && (
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">
                        {previewType === 'Aadhaar Card' ? 'Aadhaar Number:' : 'PAN Number:'}
                      </span>{' '}
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-800">
                        {previewDocumentNumber}
                      </span>
                    </p>
                  )}
                  {previewType === 'Bank Document' && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Account Number:</span>{' '}
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-800">
                            {previewBankDetails?.accountNumber || 'Not provided'}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">IFSC Code:</span>{' '}
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-800">
                            {previewBankDetails?.ifscCode || 'Not provided'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Account Holder:</span>{' '}
                          <span className="bg-gray-100 px-2 py-1 rounded text-gray-800">
                            {previewBankDetails?.accountHolderName || 'Not provided'}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Bank Name:</span>{' '}
                          <span className="bg-gray-100 px-2 py-1 rounded text-gray-800">
                            {previewBankDetails?.bankName || 'Not provided'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={closeDocumentPreview}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Preview Content */}
            <div className="flex-1 p-6 overflow-hidden">
              <div className="w-full h-full border border-gray-300 rounded-lg overflow-hidden">
                {previewDocument.endsWith('.pdf') ? (
                  <iframe
                    src={previewDocument}
                    className="w-full h-full"
                    title={`${previewType} Preview`}
                  />
                ) : (
                  <img
                    src={previewDocument}
                    alt={`${previewType} Preview`}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            </div>
            
            {/* Preview Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={closeDocumentPreview}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                Close
              </button>
              <a
                href={previewDocument}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#001D48] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentVerification;



