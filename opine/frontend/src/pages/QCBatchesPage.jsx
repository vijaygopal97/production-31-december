import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Eye, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  FileText,
  RefreshCw,
  Settings,
  Plus,
  Trash2,
  Database,
  Activity,
  ListChecks
} from 'lucide-react';
import { qcBatchAPI, surveyAPI, qcBatchConfigAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import ResponseDetailsModal from '../components/dashboard/ResponseDetailsModal';

// Enhanced Loading Screen Component for QC Batches Page - Modern & Data-Driven
const QCBatchesLoadingScreen = () => {
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [dataPoints, setDataPoints] = useState([]);
  const [particles, setParticles] = useState([]);

  const loadingTexts = [
    'Fetching QC batches...',
    'Loading batch data...',
    'Processing quality control records...',
    'Analyzing batch statistics...',
    'Compiling QC reports...',
    'Finalizing batch dashboard...'
  ];

  const loadingStages = [
    { icon: Database, text: 'Fetching Data', color: 'text-blue-500' },
    { icon: FileText, text: 'Loading Batches', color: 'text-emerald-500' },
    { icon: Activity, text: 'Processing', color: 'text-purple-500' },
    { icon: ListChecks, text: 'Organizing', color: 'text-orange-500' }
  ];

  useEffect(() => {
    const textInterval = setInterval(() => {
      setLoadingTextIndex((prev) => (prev + 1) % loadingTexts.length);
    }, 2500);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 90) return prev + Math.random() * 2;
        return prev;
      });
    }, 350);

    const generateDataPoints = () => {
      const points = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        height: Math.random() * 70 + 15,
        delay: i * 0.08,
        duration: 1 + Math.random() * 0.5
      }));
      setDataPoints(points);
    };

    const generateParticles = () => {
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 4 + 2,
        duration: Math.random() * 3 + 2,
        delay: Math.random() * 2
      }));
      setParticles(newParticles);
    };

    generateDataPoints();
    generateParticles();

    const dataInterval = setInterval(generateDataPoints, 2500);
    const particleInterval = setInterval(generateParticles, 5000);

    return () => {
      clearInterval(textInterval);
      clearInterval(progressInterval);
      clearInterval(dataInterval);
      clearInterval(particleInterval);
    };
  }, []);

  const currentStageIndex = Math.min(Math.floor(progress / 25), 3);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 flex items-center justify-center p-4 z-50 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-gradient-to-br from-[#001D48]/20 to-[#003366]/10 blur-sm"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animation: `float ${particle.duration}s ease-in-out infinite`,
              animationDelay: `${particle.delay}s`
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#001D48 1px, transparent 1px), linear-gradient(90deg, #001D48 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />
      <div className="w-full max-w-3xl mx-auto relative">
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 lg:p-12 relative overflow-hidden">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-[#001D48]/10 via-[#003366]/10 to-[#001D48]/10 opacity-50 animate-border-flow" />
          <div className="relative space-y-8">
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="none" className="text-gray-200" />
                  <circle cx="64" cy="64" r="56" stroke="url(#gradient-qc-batches)" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 56}`} strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`} className="transition-all duration-500 ease-out drop-shadow-lg" />
                  <defs>
                    <linearGradient id="gradient-qc-batches" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#001D48" />
                      <stop offset="50%" stopColor="#003366" />
                      <stop offset="100%" stopColor="#001D48" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[#001D48]">{Math.round(Math.min(progress, 95))}%</div>
                    <div className="text-xs text-gray-500 mt-1">Loading</div>
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center animate-spin-slow">
                  <div className="w-36 h-36 rounded-full border-2 border-dashed border-[#001D48]/20" />
                </div>
              </div>
            </div>
            <div className="w-full">
              <div className="flex items-end justify-center gap-1.5 h-24 px-4">
                {dataPoints.map((point) => (
                  <div key={point.id} className="flex-1 max-w-[40px] rounded-t-lg bg-gradient-to-t from-[#001D48] via-[#003366] to-[#0055AA] relative overflow-hidden group transition-all duration-700 ease-out shadow-lg" style={{ height: `${point.height}%`, animation: `pulse-bar ${point.duration}s ease-in-out infinite alternate` }}>
                    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/30 to-transparent animate-shimmer-up opacity-60" />
                    <div className="absolute top-0 left-0 right-0 h-1 bg-white/50 rounded-full blur-sm" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center gap-6 flex-wrap">
              {loadingStages.map((stage, index) => {
                const Icon = stage.icon;
                const isActive = index === currentStageIndex;
                const isCompleted = index < currentStageIndex;
                return (
                  <div key={index} className={`flex items-center gap-2 transition-all duration-500 ${isActive ? 'scale-110' : isCompleted ? 'opacity-50' : 'opacity-30'}`}>
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-[#001D48] text-white shadow-lg' : isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'} transition-all duration-500`}>
                      <Icon className={`w-4 h-4 ${isActive ? 'animate-pulse' : ''}`} />
                    </div>
                    <span className={`text-sm font-medium ${isActive ? 'text-[#001D48]' : 'text-gray-400'} transition-all duration-500`}>{stage.text}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold text-[#001D48] animate-fade-in-up">{loadingTexts[loadingTextIndex]}</h3>
              <p className="text-sm text-gray-500">Please wait while we load your QC batches</p>
            </div>
            <div className="w-full space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-[#001D48] via-[#003366] to-[#0055AA] rounded-full transition-all duration-500 ease-out relative overflow-hidden" style={{ width: `${Math.min(progress, 95)}%` }}>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-fast" />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Loading batch data...</span>
                <span>{Math.round(Math.min(progress, 95))}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes float{0%,100%{transform:translateY(0px) translateX(0px);opacity:0.7}50%{transform:translateY(-20px) translateX(10px);opacity:1}}@keyframes pulse-bar{0%{transform:scaleY(0.9);opacity:0.8}100%{transform:scaleY(1);opacity:1}}@keyframes fade-in-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.animate-fade-in-up{animation:fade-in-up 0.6s ease-out}@keyframes shimmer-up{0%{transform:translateY(100%)}100%{transform:translateY(-100%)}}.animate-shimmer-up{animation:shimmer-up 2s ease-in-out infinite}@keyframes shimmer-fast{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}.animate-shimmer-fast{animation:shimmer-fast 1.5s ease-in-out infinite}@keyframes border-flow{0%,100%{opacity:0.3}50%{opacity:0.6}}.animate-border-flow{animation:border-flow 3s ease-in-out infinite}@keyframes spin-slow{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.animate-spin-slow{animation:spin-slow 8s linear infinite}`}</style>
    </div>
  );
};

const QCBatchesPage = () => {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showBatchDetails, setShowBatchDetails] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [showResponseDetails, setShowResponseDetails] = useState(false);
  const [responseSurvey, setResponseSurvey] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const { showError, showSuccess } = useToast();

  // Fetch survey and batches
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch survey details
      const surveyResponse = await surveyAPI.getSurvey(surveyId);
      if (surveyResponse.success) {
        setSurvey(surveyResponse.data);
      }
      
      // Fetch batches
      const batchesResponse = await qcBatchAPI.getBatchesBySurvey(surveyId);
      if (batchesResponse.success) {
        // Ensure all batches have proper structure
        const processedBatches = (batchesResponse.data.batches || []).map(batch => ({
          ...batch,
          realTimeStats: batch.realTimeStats || {
            approvedCount: 0,
            rejectedCount: 0,
            pendingCount: 0,
            approvalRate: 0,
            totalQCed: 0
          },
          remainingDecision: batch.remainingDecision || {
            decision: 'pending',
            triggerApprovalRate: undefined
          }
        }));
        setBatches(processedBatches);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showError('Failed to load QC batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (surveyId) {
      fetchData();
      fetchConfig();
    }
  }, [surveyId]);

  // Fetch QC batch configuration
  const fetchConfig = async () => {
    try {
      setConfigLoading(true);
      const response = await qcBatchConfigAPI.getConfigBySurvey(surveyId);
      if (response.success) {
        setConfig(response.data.config);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setConfigLoading(false);
    }
  };

  // Save configuration
  const handleSaveConfig = async () => {
    try {
      setSavingConfig(true);
      
      // Validate sample percentage
      if (!config.samplePercentage || config.samplePercentage < 1 || config.samplePercentage > 100) {
        showError('Sample percentage must be between 1 and 100');
        return;
      }
      
      const rules = config.approvalRules || [];
      
      // Only require approval rules if sample percentage is less than 100%
      // When sample percentage is 100%, all responses go to QC, no rules needed for remaining
      if (config.samplePercentage < 100) {
        if (rules.length === 0) {
          showError('At least one approval rule is required when sample percentage is less than 100%');
          return;
        }
        
        // Validate rules cover 0-100%
        const sortedRules = [...rules].sort((a, b) => a.minRate - b.minRate);
        let coverage = 0;
        for (const rule of sortedRules) {
          if (rule.minRate > coverage) {
            showError(`Approval rules must cover 0-100% without gaps. Gap found at ${coverage}%`);
            return;
          }
          coverage = Math.max(coverage, rule.maxRate);
        }
        
        if (coverage < 100) {
          showError('Approval rules must cover 0-100%. Current coverage: 0-' + coverage + '%');
          return;
        }
      }
      
      const response = await qcBatchConfigAPI.createOrUpdateConfig({
        surveyId,
        samplePercentage: config.samplePercentage,
        approvalRules: rules,
        notes: config.notes || ''
      });
      
      if (response.success) {
        showSuccess('QC batch configuration saved successfully. New batches will use this configuration.');
        setShowConfigModal(false);
        await fetchConfig();
      }
    } catch (error) {
      console.error('Error saving config:', error);
      showError(error.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  // Add new approval rule
  const handleAddRule = () => {
    setConfig({
      ...config,
      approvalRules: [
        ...(config.approvalRules || []),
        { minRate: 0, maxRate: 100, action: 'auto_approve', description: '' }
      ]
    });
  };

  // Remove approval rule
  const handleRemoveRule = (index) => {
    const newRules = [...config.approvalRules];
    newRules.splice(index, 1);
    setConfig({
      ...config,
      approvalRules: newRules
    });
  };

  // Update approval rule
  const handleUpdateRule = (index, field, value) => {
    const newRules = [...config.approvalRules];
    newRules[index] = {
      ...newRules[index],
      [field]: value
    };
    setConfig({
      ...config,
      approvalRules: newRules
    });
  };

  // Add CSS to ensure full width
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .qc-batches-page {
        width: 100vw !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .qc-batches-page * {
        max-width: none !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      collecting: { color: 'bg-[#E6F0F8] text-blue-800', label: 'Collecting', icon: Clock },
      processing: { color: 'bg-yellow-100 text-yellow-800', label: 'Processing', icon: RefreshCw },
      qc_in_progress: { color: 'bg-[#E8E6F5] text-purple-800', label: 'QC In Progress', icon: TrendingUp },
      completed: { color: 'bg-green-100 text-green-800', label: 'Completed', icon: CheckCircle },
      auto_approved: { color: 'bg-green-100 text-green-800', label: 'Auto-Approved', icon: CheckCircle },
      queued_for_qc: { color: 'bg-orange-100 text-orange-800', label: 'Queued for QC', icon: FileText }
    };
    
    const config = statusConfig[status] || statusConfig.collecting;
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  // View batch details
  const handleViewBatch = async (batchId) => {
    try {
      const response = await qcBatchAPI.getBatchById(batchId);
      if (response.success) {
        setSelectedBatch(response.data.batch);
        setShowBatchDetails(true);
      }
    } catch (error) {
      console.error('Error fetching batch details:', error);
      showError('Failed to load batch details');
    }
  };

  // View response details
  const handleViewResponse = async (response) => {
    try {
      console.log('🔍 Viewing response:', {
        _id: response._id,
        responseId: response.responseId,
        interviewMode: response.interviewMode
      });
      
      // Use the response directly - it should have all the data we need
      // The backend already populates survey and includes all necessary fields
      // Make sure we preserve the _id and responseId
      const responseToShow = {
        ...response,
        _id: response._id, // Ensure _id is preserved
        responseId: response.responseId || response._id?.toString() // Use responseId if available, fallback to _id
      };
      
      setSelectedResponse(responseToShow);
      
      // Fetch the full survey data for this response
      if (response.survey && typeof response.survey === 'object' && response.survey._id) {
        // Survey is already populated from backend
        setResponseSurvey(response.survey);
      } else if (survey && survey._id) {
        // Use the survey we already have
        setResponseSurvey(survey);
      } else {
        // Fetch survey if we don't have it
        const surveyResponse = await surveyAPI.getSurvey(surveyId);
        if (surveyResponse.success) {
          setResponseSurvey(surveyResponse.data);
        }
      }
      
      setShowResponseDetails(true);
    } catch (error) {
      console.error('Error preparing response details:', error);
      showError('Failed to load response details');
    }
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return <QCBatchesLoadingScreen />;
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Survey Not Found</h2>
          <button
            onClick={() => navigate('/company/surveys')}
            className="px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Surveys
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 w-full qc-batches-page">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 w-full">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <button
                  onClick={() => navigate('/company/surveys')}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="hidden sm:inline">Back to Surveys</span>
                </button>
                <div className="h-6 w-px bg-gray-300 flex-shrink-0 hidden sm:block"></div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                    QC Batches - {survey.surveyName || survey.title}
                  </h1>
                  <p className="text-sm text-gray-600">
                    {batches.length} batch{batches.length !== 1 ? 'es' : ''}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    // Fetch config if not loaded
                    if (!config && !configLoading) {
                      await fetchConfig();
                    }
                    // Initialize with defaults if still no config
                    if (!config) {
                      setConfig({
                        samplePercentage: 40,
                        approvalRules: [
                          { minRate: 50, maxRate: 100, action: 'auto_approve', description: '50%+ approval rate - Auto approve remaining' },
                          { minRate: 0, maxRate: 50, action: 'send_to_qc', description: 'Below 50% approval rate - Send to QC' }
                        ],
                        notes: ''
                      });
                    }
                    setShowConfigModal(true);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span>Configure Rules</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
          {batches.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center w-full">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No QC Batches Yet</h3>
              <p className="text-gray-600 mb-6">
                QC batches will be created automatically when responses are collected.
              </p>
            </div>
          ) : (
            <div className="space-y-4 w-full">
              {batches.map((batch) => (
                <div
                  key={batch._id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden w-full"
                >
                  {/* Batch Header */}
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div>
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-5 h-5 text-gray-400" />
                            <span className="text-lg font-semibold text-gray-900">
                              {formatDate(batch.batchDate)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 mt-1">
                            <p className="text-sm text-gray-600">
                              Batch ID: {batch._id ? (typeof batch._id === 'string' ? batch._id.slice(-8) : batch._id.toString().slice(-8)) : 'N/A'}
                            </p>
                            {batch.interviewer && (
                              <p className="text-sm text-gray-600">
                                Interviewer: {batch.interviewer.firstName} {batch.interviewer.lastName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        {getStatusBadge(batch.status)}
                        {batch.status === 'collecting' && (
                          <button
                            onClick={async () => {
                              if (window.confirm(`Send this batch to QC now? This will process ${batch.totalResponses} responses immediately.`)) {
                                try {
                                  const response = await qcBatchAPI.sendBatchToQC(batch._id);
                                  if (response.success) {
                                    showSuccess(response.message || 'Batch sent to QC successfully');
                                    await fetchData();
                                  }
                                } catch (error) {
                                  showError(error.response?.data?.message || 'Failed to send batch to QC');
                                }
                              }
                            }}
                            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            <span>Send to QC</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleViewBatch(batch._id)}
                          className="flex items-center space-x-2 px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Batch Stats */}
                  <div className="px-6 py-4">
                    {(() => {
                      const samplePercentage = batch.batchConfig?.samplePercentage || batch.config?.samplePercentage || 40;
                      const is100Percent = samplePercentage >= 100;
                      const remainingPercentage = 100 - samplePercentage;
                      
                      if (is100Percent) {
                        // For 100% sample, only show total responses and QC status
                        return (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Total Responses</p>
                              <p className="text-2xl font-semibold text-gray-900">{batch.totalResponses}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">In QC Queue</p>
                              <p className="text-2xl font-semibold text-[#001D48]">{batch.sampleSize || batch.totalResponses}</p>
                              {batch.realTimeStats && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {batch.realTimeStats.pendingCount} pending QC
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Approval Rate</p>
                              {batch.realTimeStats && batch.realTimeStats.approvalRate !== undefined ? (
                                <>
                                  <p className="text-2xl font-semibold text-green-600">
                                    {batch.realTimeStats.approvalRate.toFixed(1)}%
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {batch.realTimeStats.approvedCount || 0} approved / {batch.realTimeStats.totalQCed || 0} QCed
                                  </p>
                                </>
                              ) : (
                                <p className="text-2xl font-semibold text-gray-400">-</p>
                              )}
                            </div>
                          </div>
                        );
                      } else {
                        // For less than 100%, show the split
                        return (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Total Responses</p>
                              <p className="text-2xl font-semibold text-gray-900">{batch.totalResponses}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">{samplePercentage}% Sample</p>
                              <p className="text-2xl font-semibold text-[#001D48]">{batch.sampleSize}</p>
                              {batch.realTimeStats && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {batch.realTimeStats.pendingCount} pending QC
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">{remainingPercentage}% Remaining</p>
                              <p className="text-2xl font-semibold text-gray-600">{batch.remainingSize}</p>
                              {batch.remainingDecision?.decision && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {batch.remainingDecision.decision === 'auto_approved' ? 'Auto-approved' : 'Queued for QC'}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Approval Rate ({samplePercentage}%)</p>
                              {batch.realTimeStats && batch.realTimeStats.approvalRate !== undefined ? (
                                <>
                                  <p className="text-2xl font-semibold text-green-600">
                                    {batch.realTimeStats.approvalRate.toFixed(1)}%
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {batch.realTimeStats.approvedCount || 0} approved / {batch.realTimeStats.totalQCed || 0} QCed
                                  </p>
                                </>
                              ) : (
                                <p className="text-2xl font-semibold text-gray-400">-</p>
                              )}
                            </div>
                          </div>
                        );
                      }
                    })()}

                    {/* Progress Bar for Sample QC */}
                    {(() => {
                      const samplePercentage = batch.batchConfig?.samplePercentage || batch.config?.samplePercentage || 40;
                      const is100Percent = samplePercentage >= 100;
                      
                      if (!is100Percent && batch.realTimeStats && batch.sampleSize > 0 && batch.realTimeStats.totalQCed !== undefined) {
                        return (
                          <div className="mt-4">
                            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                              <span>{samplePercentage}% Sample QC Progress</span>
                              <span>
                                {batch.realTimeStats.totalQCed || 0} / {batch.sampleSize} completed
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-[#001D48] h-2 rounded-full transition-all"
                                style={{
                                  width: `${((batch.realTimeStats.totalQCed || 0) / batch.sampleSize) * 100}%`
                                }}
                              ></div>
                            </div>
                          </div>
                        );
                      } else if (is100Percent && batch.realTimeStats && batch.sampleSize > 0 && batch.realTimeStats.totalQCed !== undefined) {
                        return (
                          <div className="mt-4">
                            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                              <span>QC Progress</span>
                              <span>
                                {batch.realTimeStats.totalQCed || 0} / {batch.sampleSize} completed
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-[#001D48] h-2 rounded-full transition-all"
                                style={{
                                  width: `${((batch.realTimeStats.totalQCed || 0) / batch.sampleSize) * 100}%`
                                }}
                              ></div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Decision on Remaining - Only show if batch has been processed and decision made, and samplePercentage < 100 */}
                    {(() => {
                      const samplePercentage = batch.batchConfig?.samplePercentage || batch.config?.samplePercentage || 40;
                      const remainingPercentage = 100 - samplePercentage;
                      const is100Percent = samplePercentage >= 100;
                      
                      if (!is100Percent && batch.remainingDecision?.decision && 
                          batch.remainingDecision.decision !== 'pending' && 
                          batch.status !== 'collecting') {
                        return (
                          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-900">
                              Decision on Remaining {remainingPercentage}%:
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {batch.remainingDecision.decision === 'auto_approved' ? (
                                <span className="text-green-600">
                                  ✓ Auto-approved {batch.remainingDecision.triggerApprovalRate !== undefined ? `(Approval rate: ${batch.remainingDecision.triggerApprovalRate.toFixed(1)}%)` : ''}
                                </span>
                              ) : (
                                <span className="text-orange-600">
                                  → Sent to QC Queue {batch.remainingDecision.triggerApprovalRate !== undefined ? `(Approval rate: ${batch.remainingDecision.triggerApprovalRate.toFixed(1)}%)` : ''}
                                </span>
                              )}
                            </p>
                            {batch.remainingDecision.decidedAt && (
                              <p className="text-xs text-gray-500 mt-1">
                                Decided on: {formatDate(batch.remainingDecision.decidedAt)}
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* Show status message for batches still collecting */}
                    {batch.status === 'collecting' && (() => {
                      const samplePercentage = batch.batchConfig?.samplePercentage || batch.config?.samplePercentage || 40;
                      const is100Percent = samplePercentage >= 100;
                      const remainingTo100 = 100 - batch.totalResponses;
                      
                      return (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-blue-900">
                            Batch Status: Collecting Responses ({batch.totalResponses}/100)
                          </p>
                          <p className="text-sm text-blue-700 mt-1">
                            {batch.totalResponses >= 100 
                              ? 'Batch has reached 100 responses and will be processed automatically.'
                              : `This batch will automatically process when it reaches 100 responses (${remainingTo100} remaining). ${is100Percent 
                                ? `All ${samplePercentage}% of responses will be sent to QC queue.`
                                : `${samplePercentage}% of responses will be randomly selected and sent to QC queue.`
                              }`
                            }
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Batch Details Modal */}
      {showBatchDetails && selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Batch Details - {formatDate(selectedBatch.batchDate)}
                </h2>
                <div className="flex items-center space-x-4 mt-1">
                  <p className="text-sm text-gray-600">
                    {selectedBatch.totalResponses} responses
                  </p>
                  {selectedBatch.interviewer && (
                    <p className="text-sm text-gray-600">
                      Interviewer: {selectedBatch.interviewer.firstName} {selectedBatch.interviewer.lastName}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowBatchDetails(false);
                  setSelectedBatch(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Stats Summary */}
              {(() => {
                const samplePercentage = selectedBatch.batchConfig?.samplePercentage || selectedBatch.config?.samplePercentage || 40;
                const is100Percent = samplePercentage >= 100;
                const remainingPercentage = 100 - samplePercentage;
                
                if (is100Percent) {
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Responses</p>
                        <p className="text-2xl font-semibold text-[#001D48]">{selectedBatch.totalResponses}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">In QC Queue</p>
                        <p className="text-2xl font-semibold text-[#373177]">{selectedBatch.sampleSize || selectedBatch.totalResponses}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Approval Rate</p>
                        <p className="text-2xl font-semibold text-green-600">
                          {selectedBatch.realTimeStats?.approvalRate !== undefined ? selectedBatch.realTimeStats.approvalRate.toFixed(1) : '0'}%
                        </p>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Responses</p>
                        <p className="text-2xl font-semibold text-[#001D48]">{selectedBatch.totalResponses}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">{samplePercentage}% Sample</p>
                        <p className="text-2xl font-semibold text-[#373177]">{selectedBatch.sampleSize}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">{remainingPercentage}% Remaining</p>
                        <p className="text-2xl font-semibold text-gray-600">{selectedBatch.remainingSize}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Approval Rate</p>
                        <p className="text-2xl font-semibold text-green-600">
                          {selectedBatch.realTimeStats?.approvalRate !== undefined ? selectedBatch.realTimeStats.approvalRate.toFixed(1) : '0'}%
                        </p>
                      </div>
                    </div>
                  );
                }
              })()}

              {/* Responses Table */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">All Responses</h3>
                {(() => {
                  const samplePercentage = selectedBatch.batchConfig?.samplePercentage || selectedBatch.config?.samplePercentage || 40;
                  const is100Percent = samplePercentage >= 100;
                  
                  return (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response ID</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                            {!is100Percent && (
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">In Sample</th>
                            )}
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">In QC Queue</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {selectedBatch.allResponses?.map((response) => (
                            <tr key={response._id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">{response.responseId || 'N/A'}</td>
                              <td className="px-4 py-3">
                                {response.status === 'Approved' && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Approved
                                  </span>
                                )}
                                {response.status === 'Rejected' && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Rejected
                                  </span>
                                )}
                                {response.status === 'Pending_Approval' && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Pending
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 uppercase">{response.interviewMode || 'N/A'}</td>
                              {!is100Percent && (
                                <td className="px-4 py-3">
                                  {response.isSampleResponse ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#E8E6F5] text-purple-800">
                                      {samplePercentage}% Sample
                                    </span>
                                  ) : (
                                    <span className="text-sm text-gray-400">-</span>
                                  )}
                                </td>
                              )}
                              <td className="px-4 py-3">
                                {(is100Percent || response.isSampleResponse) && response.status === 'Pending_Approval' ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#E6F0F8] text-blue-800">
                                    <Clock className="w-3 h-3 mr-1" />
                                    In QC Queue
                                  </span>
                                ) : (is100Percent || response.isSampleResponse) && (response.status === 'Approved' || response.status === 'Rejected') ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                    QC Completed
                                  </span>
                                ) : (
                                  <span className="text-sm text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{formatDate(response.createdAt)}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => handleViewResponse(response)}
                                  className="text-[#001D48] hover:text-blue-800 text-sm font-medium"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Response Details Modal */}
      {showResponseDetails && selectedResponse && responseSurvey && (
        <ResponseDetailsModal
          response={selectedResponse}
          survey={responseSurvey}
          onClose={() => {
            setShowResponseDetails(false);
            setSelectedResponse(null);
            setResponseSurvey(null);
          }}
        />
      )}

      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">QC Batch Configuration</h2>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {configLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Loading configuration...</p>
                </div>
              ) : config ? (
                <div className="space-y-6">
                  {/* Sample Percentage */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sample Percentage (%)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={config.samplePercentage || 40}
                      onChange={(e) => setConfig({ ...config, samplePercentage: parseInt(e.target.value) || 40 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Percentage of responses to send to QC queue (e.g., 40 for 40%)
                    </p>
                  </div>

                  {/* Approval Rules */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <label className="block text-sm font-medium text-gray-700">
                        Approval Rate Rules
                      </label>
                      {config.samplePercentage < 100 && (
                        <button
                          onClick={handleAddRule}
                          className="flex items-center space-x-2 px-3 py-1.5 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Rule</span>
                        </button>
                      )}
                    </div>
                    
                    {config.samplePercentage >= 100 ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-green-800">
                          <strong>100% Sample:</strong> All responses will be sent to QC. No approval rules are needed since there are no remaining responses to auto-process.
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 mb-4">
                        Define rules based on approval rate. Rules must cover 0-100% without gaps.
                      </p>
                    )}
                    
                    {config.samplePercentage < 100 && (
                    <div className="space-y-4">
                      {config.approvalRules && config.approvalRules.map((rule, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="grid grid-cols-12 gap-4 items-end">
                            <div className="col-span-3">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Min Rate (%)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={rule.minRate}
                                onChange={(e) => handleUpdateRule(index, 'minRate', parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Max Rate (%)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={rule.maxRate}
                                onChange={(e) => handleUpdateRule(index, 'maxRate', parseInt(e.target.value) || 100)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              />
                            </div>
                            <div className="col-span-4">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Action
                              </label>
                              <select
                                value={rule.action}
                                onChange={(e) => handleUpdateRule(index, 'action', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              >
                                <option value="auto_approve">Auto Approve</option>
                                <option value="send_to_qc">Send to QC</option>
                                <option value="reject_all">Reject All</option>
                              </select>
                            </div>
                            <div className="col-span-2">
                              <button
                                onClick={() => handleRemoveRule(index)}
                                className="w-full px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm flex items-center justify-center space-x-1"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Remove</span>
                              </button>
                            </div>
                          </div>
                          <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Description (Optional)
                            </label>
                            <input
                              type="text"
                              value={rule.description || ''}
                              onChange={(e) => handleUpdateRule(index, 'description', e.target.value)}
                              placeholder="e.g., 75%+ approval rate - All Accepted"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={config.notes || ''}
                      onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Add any notes about this configuration..."
                    />
                  </div>

                  {/* Info Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> This configuration will apply to all new batches created after saving. 
                      Existing batches will continue using the configuration that was active when they were created.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">Failed to load configuration</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end space-x-4">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig || configLoading}
                className="px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {savingConfig && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>Save Configuration</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QCBatchesPage;

