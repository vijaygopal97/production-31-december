import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  ArrowLeft,
  Users,
  Search,
  Filter,
  MapPin,
  Star,
  CheckCircle,
  Clock,
  DollarSign,
  Target,
  UserCheck,
  UserX,
  AlertCircle,
  Loader,
  ChevronDown,
  X,
  Plus,
  Home,
  Phone
} from 'lucide-react';
import { authAPI } from '../../services/api';
import { getACsForState, getACNamesForState, getAllStates } from '../../utils/assemblyConstituencies';

const InterviewerSelection = ({ onUpdate, onACSettingsUpdate, initialData, mode, modes, modeAllocation, geographicTargeting, acSettings }) => {
  const [selectedInterviewers, setSelectedInterviewers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Multi-mode assignment states
  const [currentAssignmentStep, setCurrentAssignmentStep] = useState(0); // 0: CAPI, 1: CATI
  const [capiInterviewers, setCapiInterviewers] = useState([]);
  const [catiInterviewers, setCatiInterviewers] = useState([]);
  
  // Check if this is a multi-mode survey
  const isMultiMode = mode === 'multi_mode' || (modes && modes.length > 1);
  
  // AC Assignment states
  const [assignACs, setAssignACs] = useState(acSettings?.assignACs || false);
  const [availableACs, setAvailableACs] = useState([]);
  const [availableStates, setAvailableStates] = useState([]);
  const [availableCountries, setAvailableCountries] = useState([]);
  const [selectedState, setSelectedState] = useState(acSettings?.selectedState || '');
  const [selectedCountry, setSelectedCountry] = useState(acSettings?.selectedCountry || '');
  const [loadingACs, setLoadingACs] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [countriesFetched, setCountriesFetched] = useState(false);
  
  // Modern multi-select states
  const [openDropdowns, setOpenDropdowns] = useState({});
  const [searchACs, setSearchACs] = useState({});
  const dropdownRefs = useRef({});

  // Initialize selectedInterviewers from initialData only once
  useEffect(() => {
    const modeValue = typeof mode === 'object' ? mode.mode : mode;
    console.log('🔧 InterviewerSelection useEffect - initialData received:', initialData?.length || 0, 'items, mode:', modeValue, 'isMultiMode:', isMultiMode);
    console.log('🔧 InitialData sample:', initialData?.slice(0, 3)?.map(i => ({ id: i.id || i._id, name: i.name || `${i.firstName} ${i.lastName}` })));
    // Only update if initialData has actually changed
    if (initialData && Array.isArray(initialData) && initialData.length > 0) {
      const processedData = initialData.map(interviewer => {
        // Normalize ID - handle both _id and id fields, and convert to string for consistency
        const normalizedId = interviewer.id?.toString() || interviewer._id?.toString() || interviewer.id || interviewer._id;
        return {
          ...interviewer,
          id: normalizedId, // Ensure consistent ID format (string)
          _id: normalizedId, // Also set _id for compatibility
          selectedState: interviewer.selectedState || '',
          selectedCountry: interviewer.selectedCountry || '',
          assignedACs: interviewer.assignedACs || [],
          assignedMode: interviewer.assignedMode || modeValue // Set assignedMode to current mode
        };
      });
      
      console.log('🔧 Processed initialData:', processedData.length, 'interviewers');
      console.log('🔧 Processed IDs (first 5):', processedData.slice(0, 5).map(i => i.id));
      
      // For multi-mode, update the appropriate state based on mode prop (not currentAssignmentStep)
      if (isMultiMode) {
        if (modeValue === 'capi') {
          // CAPI step
          setCapiInterviewers(prev => {
            const prevIds = new Set(prev.map(p => p.id?.toString() || p._id?.toString()).filter(Boolean));
            const newIds = new Set(processedData.map(p => p.id?.toString()).filter(Boolean));
            const isDifferent = prevIds.size !== newIds.size || 
              !Array.from(prevIds).every(id => newIds.has(id)) ||
              !Array.from(newIds).every(id => prevIds.has(id));
            
            if (isDifferent) {
              console.log('🔧 Updating capiInterviewers from initialData');
              return processedData;
            }
            console.log('🔧 No change detected in capiInterviewers initialData');
            return prev;
          });
        } else if (modeValue === 'cati') {
          // CATI step
          setCatiInterviewers(prev => {
            const prevIds = new Set(prev.map(p => p.id?.toString() || p._id?.toString()).filter(Boolean));
            const newIds = new Set(processedData.map(p => p.id?.toString()).filter(Boolean));
            const isDifferent = prevIds.size !== newIds.size || 
              !Array.from(prevIds).every(id => newIds.has(id)) ||
              !Array.from(newIds).every(id => prevIds.has(id));
            
            if (isDifferent) {
              console.log('🔧 Updating catiInterviewers from initialData');
              return processedData;
            }
            console.log('🔧 No change detected in catiInterviewers initialData');
            return prev;
          });
        }
      } else {
        // Single mode: use selectedInterviewers
        setSelectedInterviewers(prev => {
          const prevIds = new Set(prev.map(p => p.id?.toString() || p._id?.toString()).filter(Boolean));
          const newIds = new Set(processedData.map(p => p.id?.toString()).filter(Boolean));
          const isDifferent = prevIds.size !== newIds.size || 
            !Array.from(prevIds).every(id => newIds.has(id)) ||
            !Array.from(newIds).every(id => prevIds.has(id));
          
          if (isDifferent) {
            console.log('🔧 Updating selectedInterviewers from initialData');
            return processedData;
          }
          console.log('🔧 No change detected in selectedInterviewers initialData');
          return prev;
        });
      }
    } else if (!initialData || initialData.length === 0) {
      // Only clear if we actually have data to clear
      if (isMultiMode) {
        const modeValue = typeof mode === 'object' ? mode.mode : mode;
        if (modeValue === 'capi') {
          setCapiInterviewers(prev => {
            if (prev.length > 0) {
              console.log('🔧 Clearing capiInterviewers (no initialData)');
              return [];
            }
            return prev;
          });
        } else if (modeValue === 'cati') {
          setCatiInterviewers(prev => {
            if (prev.length > 0) {
              console.log('🔧 Clearing catiInterviewers (no initialData)');
              return [];
            }
            return prev;
          });
        }
      } else {
        setSelectedInterviewers(prev => {
          if (prev.length > 0) {
            console.log('🔧 Clearing selectedInterviewers (no initialData)');
            return [];
          }
          return prev;
        });
      }
    }
  }, [initialData, mode, isMultiMode]); // Use mode prop, not currentAssignmentStep

  // Update parent component whenever selected interviewers change
  useEffect(() => {
    // Use a timeout to debounce updates and prevent infinite loops
    const timeoutId = setTimeout(() => {
      if (isMultiMode) {
        // For multi-mode, use the appropriate state based on mode prop
        const modeValue = typeof mode === 'object' ? mode.mode : mode;
        if (modeValue === 'capi') {
          // CAPI step: update capiInterviewers
          if (capiInterviewers.length > 0) {
            onUpdate(capiInterviewers);
          }
        } else if (modeValue === 'cati') {
          // CATI step: update catiInterviewers
          if (catiInterviewers.length > 0) {
            onUpdate(catiInterviewers);
          }
        }
      } else {
        // Single mode: use selectedInterviewers
        if (selectedInterviewers.length > 0) {
          onUpdate(selectedInterviewers);
        }
      }
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [selectedInterviewers, capiInterviewers, catiInterviewers, mode, isMultiMode, onUpdate]);

  // Update parent component whenever AC settings change
  useEffect(() => {
    if (onACSettingsUpdate) {
      onACSettingsUpdate({
        assignACs,
        selectedCountry,
        selectedState
      });
    }
  }, [assignACs, selectedCountry, selectedState]); // Removed onACSettingsUpdate from dependencies

  // Clear ACs from selected interviewers when assignACs is unchecked
  useEffect(() => {
    if (!assignACs) {
      // Clear ACs from all selected interviewers
      setSelectedInterviewers(prev => prev.map(interviewer => ({
        ...interviewer,
        assignedACs: []
      })));
      
      // Also clear from CAPI and CATI interviewers if in multi-mode
      if (mode === 'multi_mode' || (modes && modes.length > 1)) {
        setCapiInterviewers(prev => prev.map(interviewer => ({
          ...interviewer,
          assignedACs: []
        })));
        setCatiInterviewers(prev => prev.map(interviewer => ({
          ...interviewer,
          assignedACs: []
        })));
      }
    }
  }, [assignACs, mode, modes]);

  // State for interviewers data
  const [interviewers, setInterviewers] = useState([]);

  const [filteredInterviewers, setFilteredInterviewers] = useState([]);

  // Fetch interviewers based on mode
  // Add retry functionality
  useEffect(() => {
    const handleRetry = () => {
      setError(null);
      setLoading(true);
    };
    
    window.addEventListener('retry-fetch', handleRetry);
    return () => window.removeEventListener('retry-fetch', handleRetry);
  }, []);

  useEffect(() => {
    const fetchInterviewers = async () => {
      setLoading(true);
      setError(null);
      
      console.log('Fetching interviewers for mode:', mode);
      
      try {
        let response;
        
        const modeValue = typeof mode === 'object' ? mode.mode : mode;
        
        // Fetch all active interviewers first, then filter by interviewModes
          response = await authAPI.getCompanyUsers({
            userType: 'interviewer',
            status: 'active'
          });
        
        if (response.success) {
          console.log('Fetched interviewers:', response.data.users);
          // Transform the data to match our component structure
          const transformedInterviewers = response.data.users.map(user => ({
            id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            phone: user.phone,
            location: user.profile?.address ? 
              `${user.profile.address.city}, ${user.profile.address.state}` : 
              'Location not specified',
            rating: user.performance?.averageRating || 0,
            completedInterviews: user.performance?.totalInterviews || 0,
            averageRating: user.performance?.averageRating || 0,
            trustScore: user.performance?.trustScore || 0,
            availability: user.status === 'active' ? 'Available' : 'Busy',
            lastActive: user.lastLogin ? 
              new Date(user.lastLogin).toLocaleDateString() : 
              'Never',
            specialties: user.profile?.experience?.map(exp => exp.title) || [],
            languages: user.profile?.languages?.map(lang => lang.language) || [],
            experience: user.profile?.experience?.length ? 
              `${user.profile.experience.length} years` : 
              'No experience listed',
            isGigEnabled: user.gig_availability || false,
            isCompanyMember: true, // All users from company API are company members
            userType: user.userType,
            status: user.status,
            company: user.company,
            companyCode: user.companyCode,
            // Add interview mode fields for filtering
            interviewModes: user.interviewModes || 'Both',
            canSelectMode: user.canSelectMode || false,
            // Add location control booster from user preferences
            locationControlBooster: user.preferences?.locationControlBooster || false
          }));

          // Filter interviewers based on survey mode
          // Determine filter mode - use mode prop directly (parent passes "capi" or "cati" explicitly)
          let filterMode = modeValue;
          if (isMultiMode) {
            // For multi-mode, the parent component passes mode="capi" or mode="cati" explicitly
            // So we use that directly
            filterMode = modeValue;
          }
          
          let filteredInterviewers = transformedInterviewers;
          
          if (filterMode === 'capi') {
            // For CAPI mode: show interviewers who can do CAPI or Both
            // Also include interviewers with null/undefined interviewModes (default to Both)
            filteredInterviewers = transformedInterviewers.filter(interviewer => {
              const modes = interviewer.interviewModes;
              return modes === 'CAPI (Face To Face)' || 
                     modes === 'Both' ||
                     !modes || // Include if null/undefined (defaults to Both)
                     modes === null ||
                     modes === undefined;
            });
            console.log(`Filtered for CAPI mode: ${filteredInterviewers.length} interviewers out of ${transformedInterviewers.length} total`);
          } else if (filterMode === 'cati') {
            // For CATI mode: show interviewers who can do CATI or Both
            // Also include interviewers with null/undefined interviewModes (default to Both)
            filteredInterviewers = transformedInterviewers.filter(interviewer => {
              const modes = interviewer.interviewModes;
              return modes === 'CATI (Telephonic interview)' || 
                     modes === 'Both' ||
                     !modes || // Include if null/undefined (defaults to Both)
                     modes === null ||
                     modes === undefined;
            });
            console.log(`Filtered for CATI mode: ${filteredInterviewers.length} interviewers out of ${transformedInterviewers.length} total`);
          } else {
            // For other modes or no mode specified: show all interviewers
            console.log(`No mode filtering applied: ${filteredInterviewers.length} interviewers`);
          }
          
          // IMPORTANT: Ensure assigned interviewers from initialData are included even if they don't match filter
          // This handles cases where an interviewer's mode was changed after assignment
          if (initialData && Array.isArray(initialData) && initialData.length > 0) {
            // Normalize IDs for comparison
            const normalizeId = (id) => {
              if (!id) return null;
              const str = id.toString();
              return str;
            };
            
            const assignedIds = new Set(
              initialData.map(i => {
                const id = normalizeId(i.id || i._id);
                return id;
              }).filter(Boolean)
            );
            console.log('🔧 Assigned interviewer IDs from initialData:', Array.from(assignedIds).slice(0, 10));
            console.log('🔧 Total assigned interviewers:', assignedIds.size);
            console.log('🔧 Total fetched interviewers:', transformedInterviewers.length);
            console.log('🔧 Filtered interviewers before adding assigned:', filteredInterviewers.length);
            
            // Create a map of fetched interviewers by ID for quick lookup
            const fetchedInterviewersMap = new Map();
            transformedInterviewers.forEach(interviewer => {
              const id = normalizeId(interviewer.id);
              if (id) {
                fetchedInterviewersMap.set(id, interviewer);
              }
            });
            
            // Add assigned interviewers that aren't already in filtered list
            const filteredIds = new Set(filteredInterviewers.map(i => normalizeId(i.id)).filter(Boolean));
            initialData.forEach(assignedInterviewer => {
              const assignedId = normalizeId(assignedInterviewer.id || assignedInterviewer._id);
              if (assignedId && !filteredIds.has(assignedId)) {
                // This interviewer is assigned but not in filtered list (mode mismatch)
                // Find them in the full list and add them
                const fullInterviewer = fetchedInterviewersMap.get(assignedId);
                if (fullInterviewer) {
                  // Merge assigned data (ACs, state, etc.) with fetched interviewer data
                  filteredInterviewers.push({
                    ...fullInterviewer,
                    ...assignedInterviewer,
                    id: assignedId, // Ensure consistent ID
                    selectedState: assignedInterviewer.selectedState || '',
                    selectedCountry: assignedInterviewer.selectedCountry || '',
                    assignedACs: assignedInterviewer.assignedACs || []
                  });
                  filteredIds.add(assignedId);
                  console.log(`➕ Added assigned interviewer (not in filter): ${assignedInterviewer.name || fullInterviewer.name}`);
                } else {
                  // Interviewer not found in fetched list, add assigned data as-is
                  filteredInterviewers.push({
                    ...assignedInterviewer,
                    id: assignedId,
                    selectedState: assignedInterviewer.selectedState || '',
                    selectedCountry: assignedInterviewer.selectedCountry || '',
                    assignedACs: assignedInterviewer.assignedACs || []
                  });
                  filteredIds.add(assignedId);
                  console.log(`➕ Added assigned interviewer (not in fetched list): ${assignedInterviewer.name || 'Unknown'}`);
                }
              }
            });
            
            console.log('🔧 Filtered interviewers after adding assigned:', filteredInterviewers.length);
          }
          
          setInterviewers(filteredInterviewers);
        } else {
          setError('Failed to fetch interviewers');
        }
      } catch (err) {
        console.error('Error fetching interviewers:', err);
        
        // Handle different types of errors
        if (err.code === 'ERR_NETWORK' || err.code === 'ERR_NAME_NOT_RESOLVED') {
          setError('Network error. Please check your connection and try again.');
        } else if (err.response?.status === 401) {
          setError('Authentication error. Please log in again.');
        } else if (err.response?.status === 403) {
          setError('Access denied. You do not have permission to view interviewers.');
        } else {
          setError('Failed to fetch interviewers. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInterviewers();
  }, [mode, isMultiMode, currentAssignmentStep]);

  // Filter and sort interviewers
  useEffect(() => {
    let filtered = [...interviewers];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(interviewer =>
        interviewer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        interviewer.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        interviewer.specialties.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by location
    if (filterLocation) {
      filtered = filtered.filter(interviewer =>
        interviewer.location.toLowerCase().includes(filterLocation.toLowerCase())
      );
    }

    // Filter by rating
    if (filterRating) {
      const minRating = parseFloat(filterRating);
      filtered = filtered.filter(interviewer => interviewer.rating >= minRating);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'experience':
          return b.completedInterviews - a.completedInterviews;
        case 'trustScore':
          return b.trustScore - a.trustScore;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    setFilteredInterviewers(filtered);
  }, [interviewers, searchTerm, filterLocation, filterRating, sortBy]);

  const handleInterviewerSelect = (interviewer) => {
    const modeValue = typeof mode === 'object' ? mode.mode : mode;
    const normalizeId = (id) => id?.toString() || '';
    const interviewerId = normalizeId(interviewer.id);
    
    if (isMultiMode) {
      // For multi-mode, update the appropriate state based on mode prop
      if (modeValue === 'capi') {
        setCapiInterviewers(prev => {
          const isSelected = prev.some(selected => {
            const selectedId = normalizeId(selected.id || selected._id);
            return selectedId === interviewerId;
          });
          const currentAssignment = prev.find(selected => {
            const selectedId = normalizeId(selected.id || selected._id);
            return selectedId === interviewerId;
          });
          
          if (isSelected) {
            return prev.filter(selected => {
              const selectedId = normalizeId(selected.id || selected._id);
              return selectedId !== interviewerId;
            });
          } else {
            // Add interviewer with default AC assignment fields
            const newInterviewer = {
              ...interviewer,
              id: interviewerId,
              selectedState: currentAssignment?.selectedState || '',
              selectedCountry: currentAssignment?.selectedCountry || '',
              assignedACs: currentAssignment?.assignedACs || [],
              assignedMode: modeValue,
              status: 'assigned'
            };
            console.log('🔍 Adding new CAPI interviewer:', newInterviewer);
            return [...prev, newInterviewer];
          }
        });
      } else if (modeValue === 'cati') {
        setCatiInterviewers(prev => {
          const isSelected = prev.some(selected => {
            const selectedId = normalizeId(selected.id || selected._id);
            return selectedId === interviewerId;
          });
          const currentAssignment = prev.find(selected => {
            const selectedId = normalizeId(selected.id || selected._id);
            return selectedId === interviewerId;
          });
          
          if (isSelected) {
            return prev.filter(selected => {
              const selectedId = normalizeId(selected.id || selected._id);
              return selectedId !== interviewerId;
            });
          } else {
            // Add interviewer with default AC assignment fields
            const newInterviewer = {
              ...interviewer,
              id: interviewerId,
              selectedState: currentAssignment?.selectedState || '',
              selectedCountry: currentAssignment?.selectedCountry || '',
              assignedACs: currentAssignment?.assignedACs || [],
              assignedMode: modeValue,
              status: 'assigned'
            };
            console.log('🔍 Adding new CATI interviewer:', newInterviewer);
            return [...prev, newInterviewer];
          }
        });
      }
    } else {
      // Single mode: use selectedInterviewers
      setSelectedInterviewers(prev => {
        const isSelected = prev.some(selected => {
          const selectedId = normalizeId(selected.id || selected._id);
          return selectedId === interviewerId;
        });
        const currentAssignment = prev.find(selected => {
          const selectedId = normalizeId(selected.id || selected._id);
          return selectedId === interviewerId;
        });
        
        if (isSelected) {
          return prev.filter(selected => {
            const selectedId = normalizeId(selected.id || selected._id);
            return selectedId !== interviewerId;
          });
        } else {
          // Add interviewer with default AC assignment fields
          const newInterviewer = {
            ...interviewer,
            id: interviewerId,
            selectedState: currentAssignment?.selectedState || '',
            selectedCountry: currentAssignment?.selectedCountry || '',
            assignedACs: currentAssignment?.assignedACs || [],
            assignedMode: modeValue,
            status: 'assigned'
          };
          console.log('🔍 Adding new interviewer:', newInterviewer);
          return [...prev, newInterviewer];
        }
      });
    }
  };

  const handleSelectAll = () => {
    if (selectedInterviewers.length === filteredInterviewers.length) {
      setSelectedInterviewers([]);
    } else {
      // Add all interviewers with default AC assignment fields
      const newInterviewers = filteredInterviewers.map(interviewer => ({
        ...interviewer,
        selectedState: '',
        selectedCountry: '',
        assignedACs: []
      }));
      setSelectedInterviewers(newInterviewers);
    }
  };

  const getAvailabilityColor = (availability) => {
    switch (availability) {
      case 'Available':
        return 'text-green-600 bg-green-50';
      case 'Busy':
        return 'text-yellow-600 bg-yellow-50';
      case 'Offline':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getTrustScoreColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Local countries data to avoid external API calls and 400 errors
  const LOCAL_COUNTRIES_DATA = [
    { name: 'India', code: 'IN' },
    { name: 'United States', code: 'US' },
    { name: 'United Kingdom', code: 'GB' },
    { name: 'Canada', code: 'CA' },
    { name: 'Australia', code: 'AU' },
    { name: 'Germany', code: 'DE' },
    { name: 'France', code: 'FR' },
    { name: 'Japan', code: 'JP' },
    { name: 'China', code: 'CN' },
    { name: 'Brazil', code: 'BR' },
    { name: 'Russia', code: 'RU' },
    { name: 'South Africa', code: 'ZA' },
    { name: 'Mexico', code: 'MX' },
    { name: 'Italy', code: 'IT' },
    { name: 'Spain', code: 'ES' },
    { name: 'Netherlands', code: 'NL' },
    { name: 'Sweden', code: 'SE' },
    { name: 'Norway', code: 'NO' },
    { name: 'Denmark', code: 'DK' },
    { name: 'Finland', code: 'FI' },
    { name: 'Switzerland', code: 'CH' },
    { name: 'Austria', code: 'AT' },
    { name: 'Belgium', code: 'BE' },
    { name: 'Poland', code: 'PL' },
    { name: 'Czech Republic', code: 'CZ' },
    { name: 'Hungary', code: 'HU' },
    { name: 'Portugal', code: 'PT' },
    { name: 'Greece', code: 'GR' },
    { name: 'Turkey', code: 'TR' },
    { name: 'Israel', code: 'IL' },
    { name: 'United Arab Emirates', code: 'AE' },
    { name: 'Saudi Arabia', code: 'SA' },
    { name: 'Singapore', code: 'SG' },
    { name: 'South Korea', code: 'KR' },
    { name: 'Thailand', code: 'TH' },
    { name: 'Malaysia', code: 'MY' },
    { name: 'Indonesia', code: 'ID' },
    { name: 'Philippines', code: 'PH' },
    { name: 'Vietnam', code: 'VN' },
    { name: 'New Zealand', code: 'NZ' },
    { name: 'Argentina', code: 'AR' },
    { name: 'Chile', code: 'CL' },
    { name: 'Colombia', code: 'CO' },
    { name: 'Peru', code: 'PE' },
    { name: 'Venezuela', code: 'VE' },
    { name: 'Egypt', code: 'EG' },
    { name: 'Nigeria', code: 'NG' },
    { name: 'Kenya', code: 'KE' },
    { name: 'Morocco', code: 'MA' },
    { name: 'Tunisia', code: 'TN' },
    { name: 'Ghana', code: 'GH' },
    { name: 'Ethiopia', code: 'ET' },
    { name: 'Bangladesh', code: 'BD' },
    { name: 'Pakistan', code: 'PK' },
    { name: 'Sri Lanka', code: 'LK' },
    { name: 'Nepal', code: 'NP' },
    { name: 'Bhutan', code: 'BT' },
    { name: 'Myanmar', code: 'MM' },
    { name: 'Cambodia', code: 'KH' },
    { name: 'Laos', code: 'LA' },
    { name: 'Mongolia', code: 'MN' },
    { name: 'Kazakhstan', code: 'KZ' },
    { name: 'Uzbekistan', code: 'UZ' },
    { name: 'Ukraine', code: 'UA' },
    { name: 'Romania', code: 'RO' },
    { name: 'Bulgaria', code: 'BG' },
    { name: 'Croatia', code: 'HR' },
    { name: 'Serbia', code: 'RS' },
    { name: 'Slovenia', code: 'SI' },
    { name: 'Slovakia', code: 'SK' },
    { name: 'Lithuania', code: 'LT' },
    { name: 'Latvia', code: 'LV' },
    { name: 'Estonia', code: 'EE' },
    { name: 'Iceland', code: 'IS' },
    { name: 'Ireland', code: 'IE' },
    { name: 'Luxembourg', code: 'LU' },
    { name: 'Malta', code: 'MT' },
    { name: 'Cyprus', code: 'CY' }
  ];
  
  // AC data is now loaded from JSON file via utility functions

  // Function to load countries from local data (no external API calls)
  const fetchCountries = async () => {
    // Prevent multiple simultaneous calls or if already fetched
    if (loadingCountries || countriesFetched) {
      console.log('🚫 Skipping fetchCountries - already loading or fetched');
      return;
    }
    
    console.log('🌍 Loading countries from local data...');
    setLoadingCountries(true);
    
    try {
      // Use local countries data - no external API calls
      const countryList = [...LOCAL_COUNTRIES_DATA].sort((a, b) => a.name.localeCompare(b.name));
      setAvailableCountries(countryList);
      setCountriesFetched(true);
      console.log('✅ Countries loaded successfully from local data:', countryList.length);
    } catch (error) {
      console.error('Error loading countries from local data:', error);
      // Fallback to essential countries only
      setAvailableCountries([
        { name: 'India', code: 'IN' },
        { name: 'United States', code: 'US' },
        { name: 'United Kingdom', code: 'GB' },
        { name: 'Canada', code: 'CA' },
        { name: 'Australia', code: 'AU' }
      ]);
      setCountriesFetched(true);
    } finally {
      setLoadingCountries(false);
    }
  };

  // Function to fetch states for a specific country
  const fetchStatesForCountry = async (countryCode) => {
    setLoadingStates(true);
    try {
      if (countryCode === 'IN') {
        // For India, use states from our AC data
        const indiaStates = getAllStates();
        setAvailableStates(indiaStates);
      } else {
        // For other countries, use a generic approach
        // This would need to be expanded with more APIs
        setAvailableStates(['State 1', 'State 2', 'State 3']); // Placeholder
      }
    } catch (error) {
      console.error('Error fetching states:', error);
      setAvailableStates([]);
    } finally {
      setLoadingStates(false);
    }
  };

  // Function to fetch ACs for a specific state
  const fetchACsForState = async (state) => {
    setLoadingACs(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get ACs from JSON data
      const acs = getACNamesForState(state);
      setAvailableACs(acs);
    } catch (error) {
      console.error('Error fetching ACs:', error);
      setAvailableACs([]);
    } finally {
      setLoadingACs(false);
    }
  };

  // Function to count assigned interviewers per constituency
  const getACAssignmentCount = (acName) => {
    return selectedInterviewers.reduce((count, interviewer) => {
      if (interviewer.assignedACs && interviewer.assignedACs.includes(acName)) {
        return count + 1;
      }
      return count;
    }, 0);
  };

  // Function to handle AC assignment for an interviewer
  const handleACAssignment = (interviewerId, acs) => {
    const modeValue = typeof mode === 'object' ? mode.mode : mode;
    const normalizeId = (id) => id?.toString() || '';
    const targetId = normalizeId(interviewerId);
    
    if (isMultiMode) {
      if (modeValue === 'capi') {
        setCapiInterviewers(prev => 
          prev.map(interviewer => {
            const interviewerIdNormalized = normalizeId(interviewer.id || interviewer._id);
            if (interviewerIdNormalized === targetId) {
              return { ...interviewer, assignedACs: acs };
            }
            return interviewer;
          })
        );
      } else if (modeValue === 'cati') {
        setCatiInterviewers(prev => 
          prev.map(interviewer => {
            const interviewerIdNormalized = normalizeId(interviewer.id || interviewer._id);
            if (interviewerIdNormalized === targetId) {
              return { ...interviewer, assignedACs: acs };
            }
            return interviewer;
          })
        );
      }
    } else {
      setSelectedInterviewers(prev => 
        prev.map(interviewer => {
          const interviewerIdNormalized = normalizeId(interviewer.id || interviewer._id);
          if (interviewerIdNormalized === targetId) {
            return { ...interviewer, assignedACs: acs };
          }
          return interviewer;
        })
      );
    }
  };

  // Function to handle individual state selection for an interviewer
  const handleInterviewerStateSelection = (interviewerId, state) => {
    const modeValue = typeof mode === 'object' ? mode.mode : mode;
    const normalizeId = (id) => id?.toString() || '';
    const targetId = normalizeId(interviewerId);
    
    if (isMultiMode) {
      if (modeValue === 'capi') {
        setCapiInterviewers(prev => 
          prev.map(interviewer => {
            const interviewerIdNormalized = normalizeId(interviewer.id || interviewer._id);
            if (interviewerIdNormalized === targetId) {
              const updatedInterviewer = { ...interviewer, selectedState: state, assignedACs: [] };
              console.log('🔍 Updated CAPI interviewer with state:', updatedInterviewer);
              return updatedInterviewer;
            }
            return interviewer;
          })
        );
      } else if (modeValue === 'cati') {
        setCatiInterviewers(prev => 
          prev.map(interviewer => {
            const interviewerIdNormalized = normalizeId(interviewer.id || interviewer._id);
            if (interviewerIdNormalized === targetId) {
              const updatedInterviewer = { ...interviewer, selectedState: state, assignedACs: [] };
              console.log('🔍 Updated CATI interviewer with state:', updatedInterviewer);
              return updatedInterviewer;
            }
            return interviewer;
          })
        );
      }
    } else {
      setSelectedInterviewers(prev => 
        prev.map(interviewer => {
          const interviewerIdNormalized = normalizeId(interviewer.id || interviewer._id);
          if (interviewerIdNormalized === targetId) {
            const updatedInterviewer = { ...interviewer, selectedState: state, assignedACs: [] };
            console.log('🔍 Updated interviewer with state:', updatedInterviewer);
            return updatedInterviewer;
          }
          return interviewer;
        })
      );
    }
  };

  // Function to handle bulk state selection (from main AC section)
  const handleBulkStateSelection = (state) => {
    console.log('🔍 handleBulkStateSelection called:', { state });
    const modeValue = typeof mode === 'object' ? mode.mode : mode;
    setSelectedState(state);
    if (state) {
      fetchACsForState(state);
      
      // Pre-fill this state for all selected interviewers (but don't lock them)
      if (isMultiMode) {
        if (modeValue === 'capi') {
          setCapiInterviewers(prev => {
            const updated = prev.map(interviewer => ({
              ...interviewer,
              selectedState: state,
              assignedACs: [] // Reset ACs when state changes
            }));
            console.log('🔍 Bulk updated all CAPI interviewers:', updated);
            return updated;
          });
        } else if (modeValue === 'cati') {
          setCatiInterviewers(prev => {
            const updated = prev.map(interviewer => ({
              ...interviewer,
              selectedState: state,
              assignedACs: [] // Reset ACs when state changes
            }));
            console.log('🔍 Bulk updated all CATI interviewers:', updated);
            return updated;
          });
        }
      } else {
        setSelectedInterviewers(prev => {
          const updated = prev.map(interviewer => ({
            ...interviewer,
            selectedState: state,
            assignedACs: [] // Reset ACs when state changes
          }));
          console.log('🔍 Bulk updated all interviewers:', updated);
          return updated;
        });
      }
    } else {
      // If bulk state is cleared, don't change individual selections
      setAvailableACs([]);
    }
  };

  // Function to handle country selection
  const handleCountrySelection = (countryCode) => {
    setSelectedCountry(countryCode);
    setSelectedState(''); // Reset state when country changes
    setAvailableStates([]); // Clear states
    fetchStatesForCountry(countryCode);
  };

  // Modern multi-select helper functions
  const toggleDropdown = (interviewerId) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [interviewerId]: !prev[interviewerId]
    }));
  };

  const handleACSearch = (interviewerId, searchTerm) => {
    setSearchACs(prev => ({
      ...prev,
      [interviewerId]: searchTerm
    }));
  };

  const addAC = (interviewerId, ac) => {
    const modeValue = typeof mode === 'object' ? mode.mode : mode;
    const normalizeId = (id) => id?.toString() || '';
    const targetId = normalizeId(interviewerId);
    
    let currentInterviewer = null;
    if (isMultiMode) {
      if (modeValue === 'capi') {
        currentInterviewer = capiInterviewers.find(i => normalizeId(i.id || i._id) === targetId);
      } else if (modeValue === 'cati') {
        currentInterviewer = catiInterviewers.find(i => normalizeId(i.id || i._id) === targetId);
      }
    } else {
      currentInterviewer = selectedInterviewers.find(i => normalizeId(i.id || i._id) === targetId);
    }
    
    if (currentInterviewer && currentInterviewer.assignedACs && !currentInterviewer.assignedACs.includes(ac)) {
      const updatedACs = [...currentInterviewer.assignedACs, ac];
      handleACAssignment(interviewerId, updatedACs);
    } else if (currentInterviewer && !currentInterviewer.assignedACs) {
      handleACAssignment(interviewerId, [ac]);
    }
  };

  const handleInterviewerCountrySelection = (interviewerId, country) => {
    console.log('🔍 handleInterviewerCountrySelection called:', { interviewerId, country });
    
    // Update selected interviewers
    setSelectedInterviewers(prev => 
      prev.map(interviewer => {
        if (interviewer.id === interviewerId) {
          const updatedInterviewer = { ...interviewer, selectedCountry: country, selectedState: '', assignedACs: [] };
          console.log('🔍 Updated interviewer with country:', updatedInterviewer);
          return updatedInterviewer;
        }
        return interviewer;
      })
    );
  };

  const removeAC = (interviewerId, ac) => {
    const modeValue = typeof mode === 'object' ? mode.mode : mode;
    const normalizeId = (id) => id?.toString() || '';
    const targetId = normalizeId(interviewerId);
    
    let currentInterviewer = null;
    if (isMultiMode) {
      if (modeValue === 'capi') {
        currentInterviewer = capiInterviewers.find(i => normalizeId(i.id || i._id) === targetId);
      } else if (modeValue === 'cati') {
        currentInterviewer = catiInterviewers.find(i => normalizeId(i.id || i._id) === targetId);
      }
    } else {
      currentInterviewer = selectedInterviewers.find(i => normalizeId(i.id || i._id) === targetId);
    }
    
    if (currentInterviewer && currentInterviewer.assignedACs) {
      const updatedACs = currentInterviewer.assignedACs.filter(assignedAC => assignedAC !== ac);
      handleACAssignment(interviewerId, updatedACs);
    }
  };

  // Helper function to extract numeric AC code (remove state prefix and leading zeros)
  // e.g., "WB001" -> "1", "WB010" -> "10", "WB100" -> "100"
  const getNumericACCode = (acCode) => {
    if (!acCode || typeof acCode !== 'string') return '';
    
    // Remove state prefix (alphabets at the start) and extract numeric part
    const numericPart = acCode.replace(/^[A-Z]+/, '');
    
    // Remove leading zeros and return as string
    // If all zeros, return "0", otherwise return the number without leading zeros
    const numericValue = parseInt(numericPart, 10);
    return isNaN(numericValue) ? '' : numericValue.toString();
  };

  const getFilteredACs = (interviewerId, allACs, allACObjects) => {
    const searchTerm = searchACs[interviewerId] || '';
    if (!searchTerm.trim()) {
      return allACs;
    }
    
    const searchLower = searchTerm.toLowerCase();
    const searchNumeric = searchTerm.trim(); // For numeric search, don't lowercase
    
    return allACs.filter(acName => {
      // Search by AC name (case-insensitive)
      const nameMatch = acName.toLowerCase().includes(searchLower);
      
      // Search by numeric AC code
      const acData = allACObjects.find(ac => ac.acName === acName);
      if (acData && acData.acCode) {
        const numericCode = getNumericACCode(acData.acCode);
        const numericCodeMatch = numericCode && (
          numericCode === searchNumeric || 
          numericCode.includes(searchNumeric) ||
          searchNumeric.includes(numericCode)
        );
        
        return nameMatch || numericCodeMatch;
      }
      
      return nameMatch;
    });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      Object.keys(dropdownRefs.current).forEach(interviewerId => {
        const ref = dropdownRefs.current[interviewerId];
        if (ref && !ref.contains(event.target)) {
          setOpenDropdowns(prev => ({
            ...prev,
            [interviewerId]: false
          }));
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Initialize data for edit mode from acSettings first, then fallback to geographic targeting
  useEffect(() => {
    let isMounted = true;
    
    const initializeFromACSettings = async () => {
      if (acSettings && (acSettings.selectedCountry || acSettings.selectedState || acSettings.assignACs)) {
        if (isMounted) {
          setAssignACs(!!acSettings.assignACs);
          if (acSettings.selectedCountry) {
            setSelectedCountry(acSettings.selectedCountry);
            await fetchStatesForCountry(acSettings.selectedCountry);
          }
          if (acSettings.selectedState) {
            setSelectedState(acSettings.selectedState);
            await fetchACsForState(acSettings.selectedState);
          }
        }
        return true;
      }
      return false;
    };

    const initializeFromTargeting = async () => {
    if (geographicTargeting) {
      const { stateRequirements, countryRequirements } = geographicTargeting;
      if (stateRequirements && stateRequirements.trim()) {
          if (isMounted) {
        const states = stateRequirements.split(',').map(s => s.trim()).filter(s => s);
        setAvailableStates(states);
            setSelectedCountry('IN');
          }
      } else if (countryRequirements && countryRequirements.toLowerCase().includes('india')) {
          if (isMounted) {
        setSelectedCountry('IN');
            await fetchStatesForCountry('IN');
          }
        } else if (!countriesFetched) {
          await fetchCountries();
        }
      } else if (!countriesFetched) {
        await fetchCountries();
      }
    };

    (async () => {
      const initialized = await initializeFromACSettings();
      if (!initialized && isMounted) {
        await initializeFromTargeting();
      }
    })();
    
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array to run only once on mount

  // Show loading state
  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Select Interviewers</h2>
            <p className="text-lg text-gray-600">Loading available interviewers...</p>
          </div>
          <div className="flex justify-center items-center py-12">
            <div className="flex flex-col items-center space-y-4">
              <Loader className="w-8 h-8 animate-spin text-[#373177]" />
              <p className="text-gray-600">Fetching interviewers...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Select Interviewers</h2>
            <p className="text-lg text-gray-600">Unable to load interviewers</p>
          </div>
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">{error}</p>
              <button 
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  // Trigger the useEffect to refetch
                  const event = new Event('retry-fetch');
                  window.dispatchEvent(event);
                }} 
                className="px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {isMultiMode 
              ? `Step ${currentAssignmentStep + 1}: ${currentAssignmentStep === 0 ? 'CAPI' : 'CATI'} Interviewer Selection`
              : 'Select Interviewers'
            }
          </h2>
          <p className="text-lg text-gray-600">
            {isMultiMode
              ? currentAssignmentStep === 0 
                ? 'Select interviewers who can conduct face-to-face interviews'
                : 'Select interviewers who can conduct telephone interviews'
              : (typeof mode === 'object' ? mode.mode : mode) === 'capi' 
              ? 'Choose from your company\'s dedicated interviewers'
              : (typeof mode === 'object' ? mode.mode : mode) === 'cati'
              ? 'Select from our network of experienced gig interviewers'
              : 'Choose interviewers for your survey'
            }
          </p>
          {isMultiMode && (
            <div className="mt-4 inline-flex items-center px-4 py-2 rounded-full text-sm bg-purple-100 text-purple-800">
              <Target className="w-4 h-4 mr-2" />
              Multi-Mode Assignment ({modeAllocation?.capi || 0}% CAPI, {modeAllocation?.cati || 0}% CATI)
            </div>
          )}
          {(typeof mode === 'object' ? mode.mode : mode) === 'capi' && !isMultiMode && (
            <div className="mt-4 inline-flex items-center px-4 py-2 rounded-full text-sm bg-[#E6F0F8] text-[#001D48]">
              <Users className="w-4 h-4 mr-2" />
              Company Interviewers Only ({filteredInterviewers.length} available)
            </div>
          )}
        </div>


        {/* AC Assignment Option */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="assignACs"
                checked={assignACs}
                onChange={(e) => setAssignACs(e.target.checked)}
                className="w-4 h-4 text-[#373177] border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="assignACs" className="text-sm font-medium text-gray-700">
                Assign Assembly Constituencies
              </label>
            </div>
            <div className="text-xs text-gray-500">
              Restrict interviewers to specific geographic areas
            </div>
          </div>
          
          {assignACs && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="space-y-4">
                {/* Country Selection - only show if no country from geographic targeting */}
                {!selectedCountry && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Country
                    </label>
                    <select
                      value={selectedCountry}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleCountrySelection(e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={loadingCountries}
                    >
                      <option value="">Choose a country</option>
                      {availableCountries.map(country => (
                        <option key={country.code} value={country.code}>{country.name}</option>
                      ))}
                    </select>
                    {loadingCountries && (
                      <div className="flex items-center space-x-2 text-gray-500 mt-2">
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>Loading countries...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* State Selection - show if country is selected or states are available */}
                {(selectedCountry || availableStates.length > 0) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bulk State Selection (Optional)
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Select a state here to apply it to all interviewers, or leave empty to let each interviewer choose their own state.
                    </p>
                    <select
                      value={selectedState}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleBulkStateSelection(e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={loadingStates}
                    >
                      <option value="">No bulk selection</option>
                      {availableStates.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                    {loadingStates && (
                      <div className="flex items-center space-x-2 text-gray-500 mt-2">
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>Loading states...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* AC Information */}
                {selectedState && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Available Assembly Constituencies
                    </label>
                    {loadingACs ? (
                      <div className="flex items-center space-x-2 text-gray-500">
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>Loading ACs...</span>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">
                        {availableACs.length} ACs available in {selectedState}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, location, or specialty..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Locations</option>
                {[...new Set(interviewers.map(i => i.location.split(',')[0]))].map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filterRating}
                onChange={(e) => setFilterRating(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Ratings</option>
                <option value="4.5">4.5+ Stars</option>
                <option value="4.0">4.0+ Stars</option>
                <option value="3.5">3.5+ Stars</option>
              </select>
            </div>

            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="rating">Sort by Rating</option>
                <option value="experience">Sort by Experience</option>
                <option value="trustScore">Sort by Trust Score</option>
                <option value="name">Sort by Name</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleSelectAll}
                className="flex items-center space-x-2 px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <UserCheck className="w-4 h-4" />
                <span>
                  {selectedInterviewers.length === filteredInterviewers.length ? 'Deselect All' : 'Select All'}
                </span>
              </button>

              <span className="text-sm text-gray-600">
                {selectedInterviewers.length} of {filteredInterviewers.length} selected
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Show:</span>
              <button
                onClick={() => setShowAll(!showAll)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  showAll ? 'bg-[#001D48] text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {showAll ? 'All' : 'Available Only'}
              </button>
            </div>
          </div>
        </div>

        {/* Interviewers List */}
        <div className="space-y-4">
          {filteredInterviewers.map((interviewer) => {
            let isSelected = false;
            let isSelectedInCurrentMode = false;
            let isSelectedInOtherMode = false;
            
            const modeValue = typeof mode === 'object' ? mode.mode : mode;
            const normalizeId = (id) => id?.toString() || '';
            const interviewerId = normalizeId(interviewer.id);
            
            if (isMultiMode) {
              // For multi-mode, check the appropriate state based on mode prop
              if (modeValue === 'capi') {
                isSelectedInCurrentMode = capiInterviewers.some(selected => {
                  const selectedId = normalizeId(selected.id || selected._id);
                  return selectedId === interviewerId;
                });
                isSelectedInOtherMode = catiInterviewers.some(selected => {
                  const selectedId = normalizeId(selected.id || selected._id);
                  return selectedId === interviewerId;
                });
                isSelected = isSelectedInCurrentMode;
              } else if (modeValue === 'cati') {
                isSelectedInCurrentMode = catiInterviewers.some(selected => {
                  const selectedId = normalizeId(selected.id || selected._id);
                  return selectedId === interviewerId;
                });
                isSelectedInOtherMode = capiInterviewers.some(selected => {
                  const selectedId = normalizeId(selected.id || selected._id);
                  return selectedId === interviewerId;
                });
                isSelected = isSelectedInCurrentMode;
              }
            } else {
              isSelected = selectedInterviewers.some(selected => {
                const selectedId = normalizeId(selected.id || selected._id);
                return selectedId === interviewerId;
              });
            }
            
            // For selected interviewers, always show as available (they can be edited/unselected)
            // Only check availability for unselected interviewers
            const isAvailable = isSelected ? true : (interviewer.availability === 'Available');
            
            // Get the updated interviewer data from the correct state if selected
            let currentInterviewer = interviewer;
            if (isSelected) {
              if (isMultiMode) {
                if (modeValue === 'capi') {
                  currentInterviewer = capiInterviewers.find(selected => {
                    const selectedId = normalizeId(selected.id || selected._id);
                    return selectedId === interviewerId;
                  }) || interviewer;
                } else if (modeValue === 'cati') {
                  currentInterviewer = catiInterviewers.find(selected => {
                    const selectedId = normalizeId(selected.id || selected._id);
                    return selectedId === interviewerId;
                  }) || interviewer;
                }
              } else {
                currentInterviewer = selectedInterviewers.find(selected => {
                  const selectedId = normalizeId(selected.id || selected._id);
                  return selectedId === interviewerId;
                }) || interviewer;
              }
            }
            
            // Check if this interviewer has a rejected status
            const isRejected = currentInterviewer && currentInterviewer.status === 'rejected';
            
            
            return (
              <div
                key={interviewer.id}
                className={`transition-all duration-200 ${
                  isSelected 
                    ? isRejected 
                      ? 'ring-2 ring-red-500 bg-red-50' 
                      : 'ring-2 ring-blue-500 bg-blue-50'
                    : 'hover:bg-gray-50'
                } ${!isAvailable && !showAll ? 'opacity-50' : ''}`}
              >
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      {/* Selection Checkbox */}
                      <div className="mt-1">
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInterviewerSelect(interviewer);
                          }}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                          isSelected 
                              ? isRejected
                                ? 'bg-red-600 border-red-600 hover:bg-red-700'
                                : 'bg-[#001D48] border-[#001D48] hover:bg-blue-700' 
                              : 'border-gray-300 hover:border-blue-400'
                          }`}
                        >
                          {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                      </div>

                      {/* Interviewer Info */}
                      <div className="flex-1">
                        {/* Multi-Mode Status Indicators */}
                        {isMultiMode && (isSelectedInCurrentMode || isSelectedInOtherMode) && (
                          <div className="flex items-center space-x-2 mb-2">
                            {isSelectedInCurrentMode && (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                modeValue === 'capi'
                                  ? 'bg-[#E6F0F8] text-[#001D48]' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {modeValue === 'capi' ? 'CAPI' : 'CATI'} - Current Step
                              </span>
                            )}
                            {isSelectedInOtherMode && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {modeValue === 'capi' ? 'CATI' : 'CAPI'} - Other Step
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{interviewer.name}</h3>
                          {/* Location Control (Booster) Toggle - Only for selected interviewers */}
                          {isSelected && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const modeValue = typeof mode === 'object' ? mode.mode : mode;
                                const normalizeId = (id) => id?.toString() || '';
                                const interviewerIdNormalized = normalizeId(interviewer.id);
                                
                                if (isMultiMode) {
                                  if (modeValue === 'capi') {
                                    const updated = capiInterviewers.map((inv) => {
                                      const invId = normalizeId(inv.id || inv._id);
                                      if (invId === interviewerIdNormalized) {
                                        return {
                                          ...inv,
                                          locationControlBooster: !(inv.locationControlBooster || false)
                                        };
                                      }
                                      return inv;
                                    });
                                    setCapiInterviewers(updated);
                                  } else if (modeValue === 'cati') {
                                    const updated = catiInterviewers.map((inv) => {
                                      const invId = normalizeId(inv.id || inv._id);
                                      if (invId === interviewerIdNormalized) {
                                        return {
                                          ...inv,
                                          locationControlBooster: !(inv.locationControlBooster || false)
                                        };
                                      }
                                      return inv;
                                    });
                                    setCatiInterviewers(updated);
                                  }
                                } else {
                                  const updated = selectedInterviewers.map((inv) => {
                                    const invId = normalizeId(inv.id || inv._id);
                                    if (invId === interviewerIdNormalized) {
                                      return {
                                        ...inv,
                                        locationControlBooster: !(inv.locationControlBooster || false)
                                      };
                                    }
                                    return inv;
                                  });
                                  setSelectedInterviewers(updated);
                                }
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                currentInterviewer?.locationControlBooster
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                              title="Location Control (Booster) - Allow interviewer to bypass geofencing"
                            >
                              <MapPin className="w-4 h-4" />
                            </button>
                          )}
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAvailabilityColor(interviewer.availability)}`}>
                            {interviewer.availability}
                          </span>
                          {interviewer.isCompanyMember && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                              Company Member
                            </span>
                          )}
                          {isRejected && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 border border-red-200">
                              Rejected by Interviewer
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            <span>{interviewer.location}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4" />
                            <span>Last active: {interviewer.lastActive}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <DollarSign className="w-4 h-4" />
                            <span>{interviewer.experience} experience</span>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="text-center">
                            <div className="flex items-center justify-center space-x-1 mb-1">
                              <Star className="w-4 h-4 text-yellow-500" />
                              <span className="font-semibold text-gray-900">{interviewer.rating}</span>
                            </div>
                            <p className="text-xs text-gray-600">Rating</p>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-gray-900">{interviewer.completedInterviews}</div>
                            <p className="text-xs text-gray-600">Interviews</p>
                          </div>
                          <div className="text-center">
                            <div className={`font-semibold ${getTrustScoreColor(interviewer.trustScore)}`}>
                              {interviewer.trustScore}%
                            </div>
                            <p className="text-xs text-gray-600">Trust Score</p>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-gray-900">{interviewer.averageRating}</div>
                            <p className="text-xs text-gray-600">Avg Rating</p>
                          </div>
                        </div>

                        {/* Specialties and Languages */}
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm font-medium text-gray-700">Specialties: </span>
                            <span className="text-sm text-gray-600">
                              {interviewer.specialties.join(', ')}
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-700">Languages: </span>
                            <span className="text-sm text-gray-600">
                              {interviewer.languages.join(', ')}
                            </span>
                          </div>
                        </div>

                        {/* AC Assignment for this interviewer - only show if selected and AC assignment is enabled */}
                        {isSelected && assignACs && (selectedCountry || availableStates.length > 0) && (
                          <div 
                            className="mt-4 pt-4 border-t border-gray-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                              Geographic Assignment
                            </label>
                            <div className="space-y-3">
                              {/* Individual Country Selection - only show if no country from geographic targeting */}
                              {!selectedCountry && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Select Country
                                  </label>
                                  <select
                                    value={currentInterviewer.selectedCountry || ''}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      console.log('🔍 Country dropdown changed:', { interviewerId: currentInterviewer.id, selectedValue: e.target.value });
                                      handleInterviewerCountrySelection(currentInterviewer.id, e.target.value);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  >
                                    <option value="">Choose a country</option>
                                    {availableCountries.map(country => (
                                      <option key={country.code} value={country.code}>{country.name}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* Individual State Selection - always show, but pre-filled if bulk state is selected */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Select State
                                </label>
                                <select
                                  value={currentInterviewer.selectedState || ''}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    console.log('🔍 State dropdown changed:', { interviewerId: currentInterviewer.id, selectedValue: e.target.value });
                                    handleInterviewerStateSelection(currentInterviewer.id, e.target.value);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="">Choose a state</option>
                                  {(availableStates.length === 0 && selectedCountry === 'IN') ? (
                                    getAllStates().map(state => (
                                    <option key={state} value={state}>{state}</option>
                                    ))
                                  ) : (
                                    availableStates.map(state => (
                                    <option key={state} value={state}>{state}</option>
                                    ))
                                  )}
                                </select>
                                {/* Debug info */}
                                <div className="text-xs text-gray-400 mt-1">
                                  Debug: Current state = "{currentInterviewer.selectedState || 'none'}" | ID: {currentInterviewer.id}
                                  <br />
                                  Full interviewer: {JSON.stringify({ selectedState: currentInterviewer.selectedState, assignedACs: currentInterviewer.assignedACs })}
                                </div>
                              </div>

                              {/* AC Selection - show if state is selected */}
                              {currentInterviewer.selectedState && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Assign Assembly Constituencies
                                  </label>
                                  {(() => {
                                    const acs = getACsForState(currentInterviewer.selectedState);
                                    console.log('🔍 AC dropdown for state:', currentInterviewer.selectedState, 'ACs:', acs);
                                    
                                    if (acs.length === 0) {
                                      return (
                                        <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                                          No Assembly Constituencies available for {currentInterviewer.selectedState}. 
                                          This state will be added to the database soon.
                                        </div>
                                      );
                                    }
                                    
                                    return (
                                      <div className="relative" ref={el => dropdownRefs.current[currentInterviewer.id] = el}>
                                        {/* Selected ACs Display - Clickable Field */}
                                        <div 
                                          className="min-h-[40px] p-2 border border-gray-300 rounded-lg bg-white flex flex-wrap gap-1 items-center cursor-pointer hover:border-gray-400 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleDropdown(currentInterviewer.id);
                                          }}
                                        >
                                          {currentInterviewer.assignedACs && currentInterviewer.assignedACs.length > 0 ? (
                                            currentInterviewer.assignedACs.map(ac => (
                                              <span
                                                key={ac}
                                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-[#E6F0F8] text-[#001D48] border border-blue-200"
                                              >
                                                {ac}
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeAC(currentInterviewer.id, ac);
                                                  }}
                                                  className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200 transition-colors"
                                                >
                                                  <X className="w-3 h-3" />
                                                </button>
                                              </span>
                                            ))
                                          ) : (
                                            <span className="text-gray-400 text-sm">Click to select ACs...</span>
                                          )}
                                          
                                          {/* Dropdown Toggle Arrow */}
                                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ml-auto ${openDropdowns[currentInterviewer.id] ? 'rotate-180' : ''}`} />
                                        </div>

                                        {/* Dropdown Menu */}
                                        {openDropdowns[currentInterviewer.id] && (
                                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
                                            {/* Search Input */}
                                            <div className="p-2 border-b border-gray-200">
                                              <div className="relative">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                  type="text"
                                                  placeholder="Search by AC name or code..."
                                                  value={searchACs[currentInterviewer.id] || ''}
                                                  onChange={(e) => {
                                                    e.stopPropagation();
                                                    handleACSearch(currentInterviewer.id, e.target.value);
                                                  }}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                              </div>
                                            </div>

                                            {/* AC Options */}
                                            <div className="max-h-48 overflow-y-auto">
                                              {getFilteredACs(currentInterviewer.id, acs.map(ac => ac.acName), acs).length > 0 ? (
                                                getFilteredACs(currentInterviewer.id, acs.map(ac => ac.acName), acs).map(acName => {
                                                  const acData = acs.find(ac => ac.acName === acName);
                                                  const isSelected = currentInterviewer.assignedACs && currentInterviewer.assignedACs.includes(acName);
                                                  const assignmentCount = getACAssignmentCount(acName);
                                                  return (
                                                    <button
                                                      key={acName}
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (isSelected) {
                                                          removeAC(currentInterviewer.id, acName);
                                                        } else {
                                                          addAC(currentInterviewer.id, acName);
                                                        }
                                                      }}
                                                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                                                        isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                                                      }`}
                                                    >
                                                      <div className="flex flex-col items-start">
                                                        <div className="flex items-center space-x-2">
                                                          <span className="font-medium text-[#373177] text-xs bg-[#E6F0F8] px-2 py-1 rounded">
                                                            {acData?.acCode || 'N/A'}
                                                          </span>
                                                          <span className="font-medium">{acName}</span>
                                                        </div>
                                                        {acData?.district && (
                                                          <span className="text-xs text-gray-500 mt-1">
                                                            {acData.district}
                                                          </span>
                                                        )}
                                                      </div>
                                                      <div className="flex items-center space-x-2">
                                                        {assignmentCount > 0 && (
                                                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                                            {assignmentCount} assigned
                                                          </span>
                                                        )}
                                                      {isSelected && (
                                                        <CheckCircle className="w-4 h-4 text-[#373177]" />
                                                      )}
                                                      </div>
                                                    </button>
                                                  );
                                                })
                                              ) : (
                                                <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                                  No ACs found
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col space-y-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // View profile action
                        }}
                        className="px-3 py-1 text-sm text-[#373177] hover:text-[#373177] border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        View Profile
                      </button>
                      {!isAvailable && !isSelected && (
                        <div className="flex items-center space-x-1 text-xs text-yellow-600">
                          <AlertCircle className="w-3 h-3" />
                          <span>Currently Busy</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* No Results */}
        {filteredInterviewers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No interviewers found</h3>
            <p className="text-gray-600">Try adjusting your search criteria or filters</p>
          </div>
        )}


      </div>
    </div>
  );
};

export default InterviewerSelection;
