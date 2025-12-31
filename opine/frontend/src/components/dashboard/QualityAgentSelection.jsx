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
  Shield
} from 'lucide-react';
import { authAPI } from '../../services/api';
import { getACsForState, getACNamesForState, getAllStates } from '../../utils/assemblyConstituencies';

const QualityAgentSelection = ({ onUpdate, onACSettingsUpdate, initialData, mode, geographicTargeting, acSettings }) => {
  const [selectedQualityAgents, setSelectedQualityAgents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
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

  // State for quality agents data (must be declared before useEffects that use it)
  const [qualityAgents, setQualityAgents] = useState([]);
  const [filteredQualityAgents, setFilteredQualityAgents] = useState([]);

  // Initialize selectedQualityAgents from initialData (exactly like InterviewerSelection)
  useEffect(() => {
    console.log('🔍 QualityAgentSelection received initialData:', initialData);
    console.log('🔍 initialData type:', typeof initialData, 'isArray:', Array.isArray(initialData), 'length:', initialData?.length);
    console.log('🔍 Current selectedQualityAgents:', selectedQualityAgents);
    
    if (initialData && Array.isArray(initialData) && initialData.length > 0) {
      // Check if we need to update (avoid unnecessary updates)
      const initialIds = initialData.map(a => {
        const id = a.id || a._id || (a.qualityAgent && (a.qualityAgent._id || a.qualityAgent));
        return id?.toString();
      }).filter(Boolean).sort().join(',');
      
      const currentIds = selectedQualityAgents.map(a => {
        const id = a.id || a._id || (a.qualityAgent && (a.qualityAgent._id || a.qualityAgent));
        return id?.toString();
      }).filter(Boolean).sort().join(',');
      
      console.log('🔍 Comparing IDs - initialIds:', initialIds, 'currentIds:', currentIds);
      
      if (initialIds !== currentIds && initialIds.length > 0) {
        const processedData = initialData.map(agent => {
          // Handle different ID formats
          const agentId = agent.id || agent._id || 
            (agent.qualityAgent && (agent.qualityAgent._id || agent.qualityAgent));
          
          return {
            ...agent,
            id: agentId, // Ensure id is set
            selectedState: agent.selectedState || '',
            selectedCountry: agent.selectedCountry || '',
            assignedACs: agent.assignedACs || []
          };
        });
        console.log('🔍 Setting selectedQualityAgents from initialData:', processedData);
        setSelectedQualityAgents(processedData);
      } else {
        console.log('🔍 No change needed, IDs match or initialIds is empty');
      }
    } else {
      console.log('🔍 initialData is empty or invalid:', initialData);
      // Don't clear selectedQualityAgents if initialData is empty - might be loading
    }
  }, [initialData]); // Watch initialData for changes (for edit mode)

  // Update parent component whenever selected quality agents change
  useEffect(() => {
    console.log('📝 QualityAgentSelection updating parent with:', selectedQualityAgents);
    console.log('📝 Selected quality agents details:', selectedQualityAgents.map(a => ({ id: a.id, selectedState: a.selectedState, assignedACs: a.assignedACs })));
    onUpdate(selectedQualityAgents);
  }, [selectedQualityAgents]); // Removed onUpdate from dependencies to prevent infinite loop

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

  // Clear ACs from selected quality agents when assignACs is unchecked
  useEffect(() => {
    if (!assignACs) {
      // Clear ACs from all selected quality agents
      setSelectedQualityAgents(prev => prev.map(agent => ({
        ...agent,
        assignedACs: []
      })));
    }
  }, [assignACs]);

  // Fetch quality agents based on mode
  useEffect(() => {
    const fetchQualityAgents = async () => {
      setLoading(true);
      setError(null);
      
      console.log('Fetching quality agents for mode:', mode);
      console.log('🔍 initialData when fetching:', initialData);
      
      try {
        let response;
        
        const modeValue = typeof mode === 'object' ? mode.mode : mode;
        
        // Fetch ALL quality agents from the company (don't filter by status)
        // This ensures all assigned agents are visible, even if they have different statuses
        response = await authAPI.getCompanyUsers({
          userType: 'quality_agent',
          page: 1,
          limit: 1000 // Get all quality agents
          // Don't filter by status - include all quality agents
        });
        
        if (response.success) {
          console.log('Fetched quality agents:', response.data.users);
          // Transform the data to match our component structure
          const transformedAgents = response.data.users.map(user => ({
            id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            phone: user.phone,
            location: user.profile?.address ? 
              `${user.profile.address.city}, ${user.profile.address.state}` : 
              'Location not specified',
            rating: user.performance?.averageRating || 0,
            completedApprovals: user.performance?.approvedInterviews || 0,
            averageRating: user.performance?.averageRating || 0,
            trustScore: user.performance?.trustScore || 0,
            // Quality agents are always "Available" for assignment - status doesn't affect availability
            availability: 'Available',
            lastActive: user.lastLogin ? 
              new Date(user.lastLogin).toLocaleDateString() : 
              'Never',
            specialties: user.profile?.experience?.map(exp => exp.title) || [],
            languages: user.profile?.languages?.map(lang => lang.language) || [],
            experience: user.profile?.experience?.length ? 
              `${user.profile.experience.length} years` : 
              'No experience listed',
            isCompanyMember: true,
            userType: user.userType,
            status: user.status,
            company: user.company,
            companyCode: user.companyCode
          }));
          
          setQualityAgents(transformedAgents);
        } else {
          setError('Failed to fetch quality agents');
        }
      } catch (err) {
        console.error('Error fetching quality agents:', err);
        setError('Failed to fetch quality agents. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchQualityAgents();
  }, [mode]);

  // IMPORTANT: After quality agents are fetched, ensure all assigned agents from initialData are included
  // This handles cases where assigned agents might not be in the fetched list (different status, etc.)
  useEffect(() => {
    if (qualityAgents.length > 0 && initialData && Array.isArray(initialData) && initialData.length > 0) {
      const fetchedIds = new Set(qualityAgents.map(a => a.id?.toString()));
      const missingAgents = initialData.filter(assigned => {
        const assignedId = assigned.id || assigned._id || 
          (assigned.qualityAgent && (assigned.qualityAgent._id || assigned.qualityAgent));
        return assignedId && !fetchedIds.has(assignedId.toString());
      });

      if (missingAgents.length > 0) {
        console.log('🔍 Found assigned agents not in fetched list, adding them:', missingAgents.length);
        const transformedMissing = missingAgents.map(assigned => {
          const agentId = assigned.id || assigned._id || 
            (assigned.qualityAgent && (assigned.qualityAgent._id || assigned.qualityAgent));
          const qualityAgent = assigned.qualityAgent || assigned;
          
          return {
            id: agentId,
            name: qualityAgent.firstName && qualityAgent.lastName ? 
              `${qualityAgent.firstName} ${qualityAgent.lastName}` : 
              qualityAgent.firstName || qualityAgent.lastName || 'Unknown',
            email: qualityAgent.email || '',
            phone: qualityAgent.phone || '',
            location: qualityAgent.location || qualityAgent.city || 'Location not specified',
            rating: qualityAgent.rating || 0,
            completedApprovals: 0,
            averageRating: qualityAgent.avgRating || 0,
            trustScore: qualityAgent.trustScore || 0,
            availability: 'Available', // Always available for assignment
            lastActive: 'Unknown',
            specialties: [],
            languages: [],
            experience: 'Unknown',
            isCompanyMember: true,
            userType: qualityAgent.userType || 'quality_agent',
            status: assigned.status || qualityAgent.status || 'active',
            company: qualityAgent.company,
            companyCode: qualityAgent.companyCode,
            selectedState: assigned.selectedState || '',
            assignedACs: assigned.assignedACs || [],
            selectedCountry: assigned.selectedCountry || ''
          };
        });
        
        setQualityAgents(prev => [...prev, ...transformedMissing]);
        console.log('✅ Added missing assigned agents to quality agents list');
      }
    }
  }, [qualityAgents, initialData]);

  // Filter and sort quality agents
  useEffect(() => {
    let filtered = [...qualityAgents];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(agent =>
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.specialties.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by location
    if (filterLocation) {
      filtered = filtered.filter(agent =>
        agent.location.toLowerCase().includes(filterLocation.toLowerCase())
      );
    }

    // Filter by rating
    if (filterRating) {
      const minRating = parseFloat(filterRating);
      filtered = filtered.filter(agent => agent.rating >= minRating);
    }

    // IMPORTANT: Always include selected quality agents even if they're filtered out
    // This ensures that assigned agents are always visible in edit mode
    const selectedIds = new Set(selectedQualityAgents.map(a => a.id?.toString()));
    const selectedButNotInFiltered = selectedQualityAgents.filter(selected => {
      const selectedId = selected.id?.toString();
      return selectedId && !filtered.some(f => f.id?.toString() === selectedId);
    });
    
    // Add selected agents that are not in the filtered list
    if (selectedButNotInFiltered.length > 0) {
      filtered = [...filtered, ...selectedButNotInFiltered];
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'experience':
          return b.completedApprovals - a.completedApprovals;
        case 'trustScore':
          return b.trustScore - a.trustScore;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    setFilteredQualityAgents(filtered);
  }, [qualityAgents, searchTerm, filterLocation, filterRating, sortBy, selectedQualityAgents]);

  const handleQualityAgentSelect = (agent) => {
    setSelectedQualityAgents(prev => {
      const isSelected = prev.some(selected => selected.id === agent.id);
      const currentAssignment = prev.find(selected => selected.id === agent.id);
      
      if (isSelected) {
        return prev.filter(selected => selected.id !== agent.id);
      } else {
        // Add quality agent with default AC assignment fields
        const newAgent = {
          ...agent,
          selectedState: currentAssignment?.selectedState || '',
          selectedCountry: currentAssignment?.selectedCountry || '',
          assignedACs: currentAssignment?.assignedACs || [],
          status: 'assigned'
        };
        console.log('🔍 Adding new quality agent:', newAgent);
        return [...prev, newAgent];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedQualityAgents.length === filteredQualityAgents.length) {
      setSelectedQualityAgents([]);
    } else {
      // Add all quality agents with default AC assignment fields
      const newAgents = filteredQualityAgents.map(agent => ({
        ...agent,
        selectedState: '',
        selectedCountry: '',
        assignedACs: []
      }));
      console.log('🔍 Adding all quality agents:', newAgents);
      setSelectedQualityAgents(newAgents);
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

  // Local countries data
  const LOCAL_COUNTRIES_DATA = [
    { name: 'India', code: 'IN' },
    { name: 'United States', code: 'US' },
    { name: 'United Kingdom', code: 'GB' },
    { name: 'Canada', code: 'CA' },
    { name: 'Australia', code: 'AU' },
    // Add more countries as needed
  ];
  
  // Function to load countries from local data
  const fetchCountries = async () => {
    if (loadingCountries || countriesFetched) {
      console.log('🚫 Skipping fetchCountries - already loading or fetched');
      return;
    }
    
    console.log('🌍 Loading countries from local data...');
    setLoadingCountries(true);
    
    try {
      const countryList = [...LOCAL_COUNTRIES_DATA].sort((a, b) => a.name.localeCompare(b.name));
      setAvailableCountries(countryList);
      setCountriesFetched(true);
      console.log('✅ Countries loaded successfully from local data:', countryList.length);
    } catch (error) {
      console.error('Error loading countries from local data:', error);
      setAvailableCountries([
        { name: 'India', code: 'IN' },
        { name: 'United States', code: 'US' },
        { name: 'United Kingdom', code: 'GB' }
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
        const indiaStates = getAllStates();
        setAvailableStates(indiaStates);
      } else {
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
      await new Promise(resolve => setTimeout(resolve, 500));
      const acs = getACNamesForState(state);
      setAvailableACs(acs);
    } catch (error) {
      console.error('Error fetching ACs:', error);
      setAvailableACs([]);
    } finally {
      setLoadingACs(false);
    }
  };

  // Function to count assigned quality agents per constituency
  const getACAssignmentCount = (acName) => {
    return selectedQualityAgents.reduce((count, agent) => {
      if (agent.assignedACs && agent.assignedACs.includes(acName)) {
        return count + 1;
      }
      return count;
    }, 0);
  };

  // Function to handle AC assignment for a quality agent
  const handleACAssignment = (agentId, acs) => {
    console.log('🔍 handleACAssignment called:', { agentId, acs });
    
    setSelectedQualityAgents(prev => 
      prev.map(agent => {
        if (agent.id === agentId) {
          const updatedAgent = { ...agent, assignedACs: acs };
          console.log('🔍 Updated quality agent with ACs:', updatedAgent);
          return updatedAgent;
        }
        return agent;
      })
    );
  };

  // Function to handle individual state selection for a quality agent
  const handleAgentStateSelection = (agentId, state) => {
    console.log('🔍 handleAgentStateSelection called:', { agentId, state });
    
    setSelectedQualityAgents(prev => 
      prev.map(agent => {
        if (agent.id === agentId) {
          const updatedAgent = { ...agent, selectedState: state, assignedACs: [] };
          console.log('🔍 Updated quality agent with state:', updatedAgent);
          return updatedAgent;
        }
        return agent;
      })
    );
  };

  // Function to handle bulk state selection
  const handleBulkStateSelection = (state) => {
    console.log('🔍 handleBulkStateSelection called:', { state });
    setSelectedState(state);
    if (state) {
      fetchACsForState(state);
      
      setSelectedQualityAgents(prev => {
        const updated = prev.map(agent => ({
          ...agent,
          selectedState: state,
          assignedACs: []
        }));
        console.log('🔍 Bulk updated all quality agents:', updated);
        return updated;
      });
    } else {
      setAvailableACs([]);
    }
  };

  // Function to handle country selection
  const handleCountrySelection = (countryCode) => {
    setSelectedCountry(countryCode);
    setSelectedState('');
    setAvailableStates([]);
    fetchStatesForCountry(countryCode);
  };

  // Modern multi-select helper functions
  const toggleDropdown = (agentId) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [agentId]: !prev[agentId]
    }));
  };

  const handleACSearch = (agentId, searchTerm) => {
    setSearchACs(prev => ({
      ...prev,
      [agentId]: searchTerm
    }));
  };

  const addAC = (agentId, ac) => {
    const currentAgent = selectedQualityAgents.find(a => a.id === agentId);
    if (currentAgent && currentAgent.assignedACs && !currentAgent.assignedACs.includes(ac)) {
      const updatedACs = [...currentAgent.assignedACs, ac];
      handleACAssignment(agentId, updatedACs);
    } else if (currentAgent && !currentAgent.assignedACs) {
      handleACAssignment(agentId, [ac]);
    }
  };

  const handleAgentCountrySelection = (agentId, country) => {
    console.log('🔍 handleAgentCountrySelection called:', { agentId, country });
    
    setSelectedQualityAgents(prev => 
      prev.map(agent => {
        if (agent.id === agentId) {
          const updatedAgent = { ...agent, selectedCountry: country, selectedState: '', assignedACs: [] };
          console.log('🔍 Updated quality agent with country:', updatedAgent);
          return updatedAgent;
        }
        return agent;
      })
    );
  };

  const removeAC = (agentId, ac) => {
    const currentAgent = selectedQualityAgents.find(a => a.id === agentId);
    if (currentAgent && currentAgent.assignedACs) {
      const updatedACs = currentAgent.assignedACs.filter(assignedAC => assignedAC !== ac);
      handleACAssignment(agentId, updatedACs);
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

  const getFilteredACs = (agentId, allACs, allACObjects) => {
    const searchTerm = searchACs[agentId] || '';
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
      Object.keys(dropdownRefs.current).forEach(agentId => {
        const ref = dropdownRefs.current[agentId];
        if (ref && !ref.contains(event.target)) {
          setOpenDropdowns(prev => ({
            ...prev,
            [agentId]: false
          }));
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Initialize data for edit mode
  useEffect(() => {
    let isMounted = true;
    
    const initializeFromACSettings = async () => {
      if (acSettings && (acSettings.selectedCountry || acSettings.selectedState || acSettings.assignACs)) {
        if (isMounted) {
          setAssignACs(!!acSettings.assignACs);
          // Ensure countries are loaded first so the dropdown can show the selected country
          if (!countriesFetched) {
            await fetchCountries();
          }
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
  }, [acSettings]); // Run when acSettings changes (for edit mode)

  // Show loading state
  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Select Quality Agents</h2>
            <p className="text-lg text-gray-600">Loading available quality agents...</p>
          </div>
          <div className="flex justify-center items-center py-12">
            <div className="flex flex-col items-center space-y-4">
              <Loader className="w-8 h-8 animate-spin text-[#373177]" />
              <p className="text-gray-600">Fetching quality agents...</p>
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
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Select Quality Agents</h2>
            <p className="text-lg text-gray-600">Unable to load quality agents</p>
          </div>
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-[#373177] text-white rounded-lg hover:bg-blue-700"
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
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Select Quality Agents</h2>
          <p className="text-lg text-gray-600">
            Choose quality agents who will review and approve survey responses
          </p>
          <div className="mt-4 inline-flex items-center px-4 py-2 rounded-full text-sm bg-[#E8E6F5] text-purple-800">
            <Shield className="w-4 h-4 mr-2" />
            Quality Agents ({filteredQualityAgents.length} available)
          </div>
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
              Restrict quality agents to specific geographic areas
            </div>
          </div>
          
          {assignACs && (
            <div className="mt-4 p-4 bg-[#E8E6F5] rounded-lg border border-purple-200">
              <div className="space-y-4">
                {/* Country Selection - always visible and changeable in bulk section */}
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

                {/* State Selection */}
                {(selectedCountry || availableStates.length > 0) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bulk State Selection (Optional)
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Select a state here to apply it to all quality agents, or leave empty to let each agent choose their own state.
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
                {[...new Set(qualityAgents.map(a => a.location.split(',')[0]))].map(location => (
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
                className="flex items-center space-x-2 px-4 py-2 bg-[#373177] text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <UserCheck className="w-4 h-4" />
                <span>
                  {selectedQualityAgents.length === filteredQualityAgents.length ? 'Deselect All' : 'Select All'}
                </span>
              </button>

              <span className="text-sm text-gray-600">
                {selectedQualityAgents.length} of {filteredQualityAgents.length} selected
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Show:</span>
              <button
                onClick={() => setShowAll(!showAll)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  showAll ? 'bg-[#373177] text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {showAll ? 'All' : 'Available Only'}
              </button>
            </div>
          </div>
        </div>

        {/* Quality Agents List */}
        <div className="space-y-4">
          {filteredQualityAgents.map((agent) => {
            const isSelected = selectedQualityAgents.some(selected => selected.id === agent.id);
            const isAvailable = agent.availability === 'Available';
            
            const currentAgent = isSelected 
              ? selectedQualityAgents.find(selected => selected.id === agent.id) 
              : agent;
            
            return (
              <div
                key={agent.id}
                className={`transition-all duration-200 ${
                  isSelected 
                    ? 'ring-2 ring-purple-500 bg-[#E8E6F5]'
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
                            handleQualityAgentSelect(agent);
                          }}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                          isSelected 
                              ? 'bg-[#373177] border-[#373177] hover:bg-purple-700' 
                              : 'border-gray-300 hover:border-purple-400'
                          }`}
                        >
                          {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                      </div>

                      {/* Quality Agent Info */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{agent.name}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAvailabilityColor(agent.availability)}`}>
                            {agent.availability}
                          </span>
                          {agent.isCompanyMember && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                              Company Member
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            <span>{agent.location}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4" />
                            <span>Last active: {agent.lastActive}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Shield className="w-4 h-4" />
                            <span>{agent.experience} experience</span>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="text-center">
                            <div className="flex items-center justify-center space-x-1 mb-1">
                              <Star className="w-4 h-4 text-yellow-500" />
                              <span className="font-semibold text-gray-900">{agent.rating}</span>
                            </div>
                            <p className="text-xs text-gray-600">Rating</p>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-gray-900">{agent.completedApprovals}</div>
                            <p className="text-xs text-gray-600">Approvals</p>
                          </div>
                          <div className="text-center">
                            <div className={`font-semibold ${getTrustScoreColor(agent.trustScore)}`}>
                              {agent.trustScore}%
                            </div>
                            <p className="text-xs text-gray-600">Trust Score</p>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-gray-900">{agent.averageRating}</div>
                            <p className="text-xs text-gray-600">Avg Rating</p>
                          </div>
                        </div>

                        {/* Specialties and Languages */}
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm font-medium text-gray-700">Specialties: </span>
                            <span className="text-sm text-gray-600">
                              {agent.specialties.join(', ')}
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-700">Languages: </span>
                            <span className="text-sm text-gray-600">
                              {agent.languages.join(', ')}
                            </span>
                          </div>
                        </div>

                        {/* AC Assignment for this quality agent - only show if selected and AC assignment is enabled */}
                        {isSelected && assignACs && (selectedCountry || availableStates.length > 0) && (
                          <div 
                            className="mt-4 pt-4 border-t border-gray-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                              Geographic Assignment
                            </label>
                            <div className="space-y-3">
                              {/* Individual Country Selection */}
                              {!selectedCountry && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Select Country
                                  </label>
                                  <select
                                    value={currentAgent.selectedCountry || ''}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleAgentCountrySelection(currentAgent.id, e.target.value);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                  >
                                    <option value="">Choose a country</option>
                                    {availableCountries.map(country => (
                                      <option key={country.code} value={country.code}>{country.name}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* Individual State Selection */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Select State
                                </label>
                                <select
                                  value={currentAgent.selectedState || ''}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleAgentStateSelection(currentAgent.id, e.target.value);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                              </div>

                              {/* AC Selection - show if state is selected */}
                              {currentAgent.selectedState && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Assign Assembly Constituencies
                                  </label>
                                  {(() => {
                                    const acs = getACsForState(currentAgent.selectedState);
                                    console.log('🔍 AC dropdown for state:', currentAgent.selectedState, 'ACs:', acs);
                                    
                                    if (acs.length === 0) {
                                      return (
                                        <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                                          No Assembly Constituencies available for {currentAgent.selectedState}. 
                                          This state will be added to the database soon.
                                        </div>
                                      );
                                    }
                                    
                                    return (
                                      <div className="relative" ref={el => dropdownRefs.current[currentAgent.id] = el}>
                                        {/* Selected ACs Display */}
                                        <div 
                                          className="min-h-[40px] p-2 border border-gray-300 rounded-lg bg-white flex flex-wrap gap-1 items-center cursor-pointer hover:border-gray-400 focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleDropdown(currentAgent.id);
                                          }}
                                        >
                                          {currentAgent.assignedACs && currentAgent.assignedACs.length > 0 ? (
                                            currentAgent.assignedACs.map(ac => (
                                              <span
                                                key={ac}
                                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-[#E8E6F5] text-purple-800 border border-purple-200"
                                              >
                                                {ac}
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeAC(currentAgent.id, ac);
                                                  }}
                                                  className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-purple-200 transition-colors"
                                                >
                                                  <X className="w-3 h-3" />
                                                </button>
                                              </span>
                                            ))
                                          ) : (
                                            <span className="text-gray-400 text-sm">Click to select ACs...</span>
                                          )}
                                          
                                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ml-auto ${openDropdowns[currentAgent.id] ? 'rotate-180' : ''}`} />
                                        </div>

                                        {/* Dropdown Menu */}
                                        {openDropdowns[currentAgent.id] && (
                                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
                                            {/* Search Input */}
                                            <div className="p-2 border-b border-gray-200">
                                              <div className="relative">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                  type="text"
                                                  placeholder="Search by AC name or code..."
                                                  value={searchACs[currentAgent.id] || ''}
                                                  onChange={(e) => {
                                                    e.stopPropagation();
                                                    handleACSearch(currentAgent.id, e.target.value);
                                                  }}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                />
                                              </div>
                                            </div>

                                            {/* AC Options */}
                                            <div className="max-h-48 overflow-y-auto">
                                              {getFilteredACs(currentAgent.id, acs.map(ac => ac.acName), acs).length > 0 ? (
                                                getFilteredACs(currentAgent.id, acs.map(ac => ac.acName), acs).map(acName => {
                                                  const acData = acs.find(ac => ac.acName === acName);
                                                  const isSelected = currentAgent.assignedACs && currentAgent.assignedACs.includes(acName);
                                                  const assignmentCount = getACAssignmentCount(acName);
                                                  return (
                                                    <button
                                                      key={acName}
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (isSelected) {
                                                          removeAC(currentAgent.id, acName);
                                                        } else {
                                                          addAC(currentAgent.id, acName);
                                                        }
                                                      }}
                                                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                                                        isSelected ? 'bg-[#E8E6F5] text-purple-700' : 'text-gray-700'
                                                      }`}
                                                    >
                                                      <div className="flex flex-col items-start">
                                                        <div className="flex items-center space-x-2">
                                                          <span className="font-medium text-[#373177] text-xs bg-[#E8E6F5] px-2 py-1 rounded">
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
                        className="px-3 py-1 text-sm text-[#373177] hover:text-purple-700 border border-purple-200 rounded-lg hover:bg-[#E8E6F5] transition-colors"
                      >
                        View Profile
                      </button>
                      {!isAvailable && (
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
        {filteredQualityAgents.length === 0 && (
          <div className="text-center py-12">
            <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No quality agents found</h3>
            <p className="text-gray-600">Try adjusting your search criteria or filters</p>
          </div>
        )}


      </div>
    </div>
  );
};

export default QualityAgentSelection;


