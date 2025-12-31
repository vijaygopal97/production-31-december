import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Users, 
  Globe, 
  Phone,
  ArrowRight,
  CheckCircle,
  Clock,
  DollarSign,
  Target,
  Zap,
  AlertCircle
} from 'lucide-react';

const SurveyModeSelection = ({ onUpdate, initialData }) => {
  const [selectedMode, setSelectedMode] = useState(initialData?.mode || '');
  const [selectedModes, setSelectedModes] = useState(initialData?.modes || []);
  const [modeAllocation, setModeAllocation] = useState(initialData?.modeAllocation || { capi: 0, cati: 0 });
  const [includeGigWorkers, setIncludeGigWorkers] = useState(initialData?.includeGigWorkers || false);
  const [modeGigWorkers, setModeGigWorkers] = useState(initialData?.modeGigWorkers || { capi: false, cati: false });

  // Update selected mode when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      if (typeof initialData === 'string') {
        // Legacy format - just mode string
        setSelectedMode(initialData);
        setSelectedModes([]);
        setModeAllocation({ capi: 0, cati: 0 });
        setIncludeGigWorkers(false);
        setModeGigWorkers({ capi: false, cati: false });
      } else {
        // New format - object with mode and includeGigWorkers
        setSelectedMode(initialData.mode || '');
        setSelectedModes(initialData.modes || []);
        setModeAllocation(initialData.modeAllocation || { capi: 0, cati: 0 });
        setIncludeGigWorkers(initialData.includeGigWorkers || false);
        // Only update modeGigWorkers if it's actually provided and not empty
        if (initialData.modeGigWorkers && Object.keys(initialData.modeGigWorkers).length > 0) {
          setModeGigWorkers(initialData.modeGigWorkers);
        }
      }
    }
  }, [initialData]);

  const surveyModes = [
    {
      id: 'capi',
      title: 'Personal Interviews (CAPI)',
      description: 'Computer Assisted Personal Interviews with your dedicated team',
      icon: Home,
      features: [
        'Dedicated team members',
        'Company-specific training',
        'Higher quality control',
        'Direct management'
      ],
      pricing: 'Fixed cost per interview',
      time: '2-5 days setup',
      color: 'blue',
      supportsGigWorkers: true
    },
    {
      id: 'cati',
      title: 'Telephonic Interviews (CATI)',
      description: 'Computer Assisted Telephone Interviews for remote data collection',
      icon: Phone,
      features: [
        'Remote data collection',
        'Flexible scheduling',
        'Cost-effective pricing',
        'Quality guaranteed'
      ],
      pricing: 'Competitive rates',
      time: '1-3 days setup',
      color: 'green',
      supportsGigWorkers: true
    },
    {
      id: 'multi_mode',
      title: 'Combined CAPI + CATI',
      description: 'Use both Personal and Telephonic interviews with customizable allocation',
      icon: Target,
      features: [
        'Flexible mode combination',
        'Customizable percentage allocation',
        'Maximum coverage and reach',
        'Cost optimization'
      ],
      pricing: 'Mixed pricing model',
      time: '2-5 days setup',
      color: 'purple',
      supportsGigWorkers: true,
      isMultiMode: true
    },
    {
      id: 'online_interview',
      title: 'Online Interview',
      description: 'Conduct surveys through email and WhatsApp',
      icon: Globe,
      features: [
        'Email & WhatsApp delivery',
        'Automated distribution',
        'Real-time responses',
        'Global reach'
      ],
      pricing: 'Per response',
      time: 'Instant setup',
      color: 'purple',
      supportsGigWorkers: false
    },
    {
      id: 'ai_telephonic',
      title: 'AI Telephonic Interview',
      description: 'Automated phone interviews using AI calling agents',
      icon: Phone,
      features: [
        'AI-powered calling',
        '24/7 availability',
        'Multi-language support',
        'Automatic retries'
      ],
      pricing: 'Per successful call',
      time: 'Same day setup',
      color: 'orange',
      supportsGigWorkers: false
    }
  ];

  const handleModeSelect = (modeId) => {
    
    if (modeId === 'multi_mode') {
      // For multi-mode, default to both CAPI and CATI selected
      setSelectedMode(modeId);
      setSelectedModes(['capi', 'cati']);
      setModeAllocation({ capi: 50, cati: 50 });
      
      onUpdate({ 
        mode: modeId, 
        modes: ['capi', 'cati'], 
        modeAllocation: { capi: 50, cati: 50 },
        includeGigWorkers: includeGigWorkers,
        modeGigWorkers: modeGigWorkers
      });
    } else if (modeId === 'capi' || modeId === 'cati') {
      // Handle individual CAPI/CATI selection
      const isCurrentlySelected = selectedModes.includes(modeId);
      
      if (isCurrentlySelected) {
        // If already selected, remove it
        const newModes = selectedModes.filter(m => m !== modeId);
        setSelectedModes(newModes);
        
        if (newModes.length === 0) {
          // No modes selected, reset to single mode
          setSelectedMode(modeId);
          setModeAllocation({ capi: 0, cati: 0 });
          onUpdate({ mode: modeId, includeGigWorkers: includeGigWorkers, modeGigWorkers: modeGigWorkers });
        } else if (newModes.length === 1) {
          // Only one mode left, switch to single mode
          setSelectedMode(newModes[0]);
          setModeAllocation({ 
            capi: newModes[0] === 'capi' ? 100 : 0, 
            cati: newModes[0] === 'cati' ? 100 : 0 
          });
          onUpdate({ 
            mode: newModes[0], 
            modes: newModes,
            modeAllocation: { 
              capi: newModes[0] === 'capi' ? 100 : 0, 
              cati: newModes[0] === 'cati' ? 100 : 0 
            },
            includeGigWorkers: includeGigWorkers,
            modeGigWorkers: modeGigWorkers
          });
        } else {
          // Multiple modes still selected, keep multi-mode
          setSelectedMode('multi_mode');
          const newAllocation = { capi: 0, cati: 0 };
          newModes.forEach(mode => {
            newAllocation[mode] = 100 / newModes.length;
          });
          setModeAllocation(newAllocation);
          onUpdate({ 
            mode: 'multi_mode', 
            modes: newModes,
            modeAllocation: newAllocation,
            includeGigWorkers: includeGigWorkers,
            modeGigWorkers: modeGigWorkers
          });
        }
      } else {
        // Add the mode to selection
        const newModes = [...selectedModes, modeId];
        setSelectedModes(newModes);
        
        if (newModes.length === 1) {
          // First mode selected
          setSelectedMode(modeId);
          setModeAllocation({ 
            capi: modeId === 'capi' ? 100 : 0, 
            cati: modeId === 'cati' ? 100 : 0 
          });
          onUpdate({ 
            mode: modeId, 
            modes: newModes,
            modeAllocation: { 
              capi: modeId === 'capi' ? 100 : 0, 
              cati: modeId === 'cati' ? 100 : 0 
            },
            includeGigWorkers: includeGigWorkers,
            modeGigWorkers: modeGigWorkers
          });
        } else {
          // Multiple modes selected, switch to multi-mode
          setSelectedMode('multi_mode');
          const newAllocation = { capi: 0, cati: 0 };
          newModes.forEach(mode => {
            newAllocation[mode] = 100 / newModes.length;
          });
          setModeAllocation(newAllocation);
          onUpdate({ 
            mode: 'multi_mode', 
            modes: newModes,
            modeAllocation: newAllocation,
            includeGigWorkers: includeGigWorkers,
            modeGigWorkers: modeGigWorkers
          });
        }
      }
    } else {
      // For other modes (online, ai_telephonic, etc.), reset multi-mode selections
      setSelectedMode(modeId);
      setSelectedModes([]);
      setModeAllocation({ capi: 0, cati: 0 });
      setIncludeGigWorkers(false);
      onUpdate({ mode: modeId, includeGigWorkers: false });
    }
  };

  const handleGigWorkersToggle = (checked) => {
    setIncludeGigWorkers(checked);
    onUpdate({ 
      mode: selectedMode, 
      modes: selectedModes,
      modeAllocation: modeAllocation,
      includeGigWorkers: checked,
      modeGigWorkers: modeGigWorkers
    });
  };

  const handleModeGigWorkersToggle = (mode, checked) => {
    const newModeGigWorkers = { ...modeGigWorkers, [mode]: checked };
    setModeGigWorkers(newModeGigWorkers);
    onUpdate({ 
      mode: selectedMode, 
      modes: selectedModes,
      modeAllocation: modeAllocation,
      includeGigWorkers: includeGigWorkers,
      modeGigWorkers: newModeGigWorkers
    });
  };

  const handleModeToggle = (mode) => {
    const newSelectedModes = selectedModes.includes(mode)
      ? selectedModes.filter(m => m !== mode)
      : [...selectedModes, mode];
    
    setSelectedModes(newSelectedModes);
    
    // Auto-adjust percentages when modes change
    if (newSelectedModes.length === 2) {
      setModeAllocation({ capi: 50, cati: 50 });
    } else if (newSelectedModes.length === 1) {
      const singleMode = newSelectedModes[0];
      setModeAllocation({ 
        capi: singleMode === 'capi' ? 100 : 0, 
        cati: singleMode === 'cati' ? 100 : 0 
      });
    } else {
      setModeAllocation({ capi: 0, cati: 0 });
    }
    
    onUpdate({ 
      mode: selectedMode, 
      modes: newSelectedModes,
      modeAllocation: newSelectedModes.length === 2 ? { capi: 50, cati: 50 } : 
                     newSelectedModes.length === 1 ? 
                       { capi: newSelectedModes[0] === 'capi' ? 100 : 0, 
                         cati: newSelectedModes[0] === 'cati' ? 100 : 0 } : 
                       { capi: 0, cati: 0 },
      includeGigWorkers: includeGigWorkers 
    });
  };

  const handleAllocationChange = (mode, value) => {
    const newAllocation = { ...modeAllocation, [mode]: parseInt(value) || 0 };
    
    // Ensure total doesn't exceed 100%
    const total = newAllocation.capi + newAllocation.cati;
    if (total > 100) {
      const excess = total - 100;
      const otherMode = mode === 'capi' ? 'cati' : 'capi';
      newAllocation[otherMode] = Math.max(0, newAllocation[otherMode] - excess);
    }
    
    setModeAllocation(newAllocation);
    onUpdate({ 
      mode: selectedMode, 
      modes: selectedModes,
      modeAllocation: newAllocation,
      includeGigWorkers: includeGigWorkers 
    });
  };


  const getColorClasses = (color) => {
    const colors = {
      blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
        button: 'bg-[#001D48] hover:bg-blue-700'
      },
      green: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-700',
        button: 'bg-green-600 hover:bg-green-700'
      },
      purple: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-700',
        button: 'bg-[#373177] hover:bg-purple-700'
      },
      orange: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-700',
        button: 'bg-orange-600 hover:bg-orange-700'
      }
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Survey Mode</h2>
          <p className="text-lg text-gray-600">
            Select how you want to conduct your survey. Each mode offers different benefits and pricing.
          </p>
        </div>

        {/* Survey Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {surveyModes.map((mode) => {
            const Icon = mode.icon;
            const colors = getColorClasses(mode.color);
            let isSelected = false;
            if (mode.id === 'capi' || mode.id === 'cati') {
              // For CAPI/CATI, check if they're in the selectedModes array
              isSelected = selectedModes.includes(mode.id);
            } else {
              // For other modes, use the old logic
              isSelected = selectedMode === mode.id;
            }
            
            return (
              <div
                key={mode.id}
                onClick={() => handleModeSelect(mode.id)}
                className={`relative cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                  isSelected 
                    ? 'ring-2 ring-blue-500 shadow-xl' 
                    : 'hover:shadow-lg'
                }`}
              >
                <div className={`p-6 rounded-xl border-2 ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : `${colors.bg} ${colors.border} border-2`
                }`}>
                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className="absolute top-4 right-4">
                      <CheckCircle className="w-6 h-6 text-[#373177]" />
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-center space-x-4 mb-4">
                    <div className={`p-3 rounded-lg ${colors.bg}`}>
                      <Icon className={`w-8 h-8 ${colors.text}`} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{mode.title}</h3>
                      <p className="text-gray-600">{mode.description}</p>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Key Features:</h4>
                    <ul className="space-y-1">
                      {mode.features.map((feature, index) => (
                        <li key={index} className="flex items-center space-x-2 text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pricing & Time */}
                  <div className="flex items-center justify-between text-sm mb-4">
                    <div className="flex items-center space-x-1">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">{mode.pricing}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">{mode.time}</span>
                    </div>
                  </div>

                  {/* Gig Workers Checkbox for CAPI and CATI (not for multi_mode or when multi_mode is selected) */}
                  {mode.supportsGigWorkers && isSelected && mode.id !== 'multi_mode' && selectedMode !== 'multi_mode' && !(selectedModes.includes('capi') && selectedModes.includes('cati')) && (
                    <div className="border-t pt-4">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeGigWorkers}
                          onChange={(e) => handleGigWorkersToggle(e.target.checked)}
                          className="w-4 h-4 text-[#373177] bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">
                            Include Gig Workers
                          </span>
                        </div>
                      </label>
                      <p className="text-xs text-gray-500 mt-1 ml-7">
                        Allow freelance interviewers to participate in this survey
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Multi-Mode Selection and Allocation */}
        {(selectedMode === 'multi_mode' || (selectedModes.includes('capi') && selectedModes.includes('cati'))) && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 mb-8">
            <div className="flex items-center space-x-3 mb-6">
              <Target className="w-6 h-6 text-[#373177]" />
              <h3 className="text-lg font-semibold text-gray-900">Configure Mode Allocation</h3>
            </div>
            
            <div className="space-y-6">

              {/* Percentage Allocation */}
              {selectedModes.length > 1 && (
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">
                    Set Percentage Allocation (Total: {modeAllocation.capi + modeAllocation.cati}%)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedModes.map((mode) => {
                      const modeInfo = mode === 'capi' ? 
                        { name: 'CAPI', color: 'blue', icon: Home } : 
                        { name: 'CATI', color: 'green', icon: Phone };
                      const Icon = modeInfo.icon;
                      
                      return (
                        <div key={mode} className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center space-x-2 mb-3">
                            <Icon className={`w-5 h-5 text-${modeInfo.color}-600`} />
                            <span className="font-medium text-gray-900">{modeInfo.name} Percentage</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={modeAllocation[mode]}
                              onChange={(e) => handleAllocationChange(mode, e.target.value)}
                              className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <span className="text-gray-600">%</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`bg-${modeInfo.color}-500 h-2 rounded-full transition-all duration-300`}
                                style={{ width: `${modeAllocation[mode]}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {modeAllocation.capi + modeAllocation.cati !== 100 && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm text-yellow-800">
                          Total allocation should equal 100%. Current total: {modeAllocation.capi + modeAllocation.cati}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mode-Specific Gig Workers Toggle */}
              <div className="border-t pt-4">
                <h4 className="text-md font-medium text-gray-900 mb-4">Gig Worker Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(() => {
                    // Show toggles for selected modes, or for both CAPI and CATI if multi-mode
                    const modesToShow = selectedModes.length > 0 ? selectedModes : 
                      (selectedMode === 'multi_mode' ? ['capi', 'cati'] : 
                       (selectedMode === 'capi' ? ['capi'] : 
                        (selectedMode === 'cati' ? ['cati'] : [])));
                    
                    return modesToShow.map((mode) => {
                      const modeInfo = mode === 'capi' ? 
                        { name: 'CAPI', color: 'blue', icon: Home } : 
                        { name: 'CATI', color: 'green', icon: Phone };
                      const Icon = modeInfo.icon;
                      
                      return (
                        <div key={mode} className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center space-x-2 mb-3">
                            <Icon className={`w-5 h-5 text-${modeInfo.color}-600`} />
                            <span className="font-medium text-gray-900">{modeInfo.name} Gig Workers</span>
                          </div>
                          <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={modeGigWorkers[mode] || false}
                              onChange={(e) => {
                                handleModeGigWorkersToggle(mode, e.target.checked);
                              }}
                              className="w-4 h-4 text-[#373177] bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                            />
                            <div className="flex items-center space-x-2">
                              <Users className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-700">
                                Include Gig Workers
                              </span>
                            </div>
                          </label>
                          <p className="text-xs text-gray-500 mt-1 ml-7">
                            Allow freelance interviewers for {modeInfo.name} interviews
                          </p>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recommendation */}
        {selectedMode && (
          <div className="bg-gradient-to-r from-blue-50 to-[#E8E6F5] rounded-xl p-6 mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <Zap className="w-6 h-6 text-[#373177]" />
              <h3 className="text-lg font-semibold text-gray-900">Recommended for you</h3>
            </div>
            <p className="text-gray-700">
              Based on your company profile, we recommend this survey mode for optimal results and cost-effectiveness.
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default SurveyModeSelection;
