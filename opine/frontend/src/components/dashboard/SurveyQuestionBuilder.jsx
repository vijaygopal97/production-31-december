import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ArrowRight, 
  ArrowLeft,
  Plus,
  Save,
  Eye,
  Send,
  Trash2,
  Copy,
  Move,
  Settings,
  Type,
  CheckSquare,
  BarChart3,
  Star,
  FileText,
  Image,
  Video,
  Upload,
  GripVertical,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Lock,
  Shield,
  Hash
} from 'lucide-react';
import ConditionalLogic from './ConditionalLogic';
import SurveyResponse from './SurveyResponse';
import { ensureFixedQuestionsInSurvey, isFixedQuestion } from '../../utils/fixedQuestions';

const SurveyQuestionBuilder = ({ onSave, onUpdate, initialData, surveyData }) => {
  
  // Utility function to generate unique IDs
  const generateUniqueId = (prefix = '') => {
    const baseId = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    return prefix ? `${prefix}_${baseId}_${randomSuffix}` : `${baseId}_${randomSuffix}`;
  };
  
  // Check if this is the specific survey that should not have protected questions
  // Check multiple possible sources for the survey ID
  const surveyId = surveyData?._id || surveyData?.id;
  const isSpecialSurvey = surveyId === '68fd1915d41841da463f0d46';
  
  const [sections, setSections] = useState(() => {
    if (initialData && initialData.length > 0) {
      // For the special survey, don't add fixed questions
      if (isSpecialSurvey) {
        return initialData;
      }
      return ensureFixedQuestionsInSurvey(initialData);
    } else {
      if (isSpecialSurvey) {
        return [{
          id: 1,
          title: 'Respondent Information',
          questions: []
        }];
      }
      return ensureFixedQuestionsInSurvey([
        {
          id: 1,
          title: 'Respondent Information',
          questions: []
        }
      ]);
    }
  });
  
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showQuestionTypes, setShowQuestionTypes] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [showConditionalLogic, setShowConditionalLogic] = useState(false);
  const [previewResponses, setPreviewResponses] = useState({});
  const [showDeleteSectionModal, setShowDeleteSectionModal] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState(null);
  const [editingQuestionNumber, setEditingQuestionNumber] = useState(null); // {sectionIndex, questionIndex}
  const [editingQuestionNumberValue, setEditingQuestionNumberValue] = useState('');
  const [draggedQuestion, setDraggedQuestion] = useState(null); // {sectionIndex, questionIndex}
  const hasInitialized = useRef(false);

  // Update sections when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData && Array.isArray(initialData) && initialData.length > 0 && !hasInitialized.current) {
      hasInitialized.current = true;
      
      // For the special survey, don't add fixed questions
      const sectionsWithFixedQuestions = isSpecialSurvey 
        ? initialData 
        : ensureFixedQuestionsInSurvey(initialData);
      
      // Ensure all questions have proper order numbers and preserve settings
      let globalOrder = 0;
      const updatedSections = sectionsWithFixedQuestions.map((section, sectionIndex) => ({
        ...section,
        questions: section.questions.map((question, questionIndex) => {
          // Preserve settings object if it exists
          const preservedSettings = question.settings && typeof question.settings === 'object' 
            ? { ...question.settings } 
            : {};
          
          // Ensure question has questionNumber (auto-generate if missing)
          const questionNumber = question.questionNumber || generateAutoQuestionNumber(sectionIndex, questionIndex);
          
          const updatedQuestion = {
            ...question,
            order: question.order !== undefined ? question.order : globalOrder,
            questionNumber: questionNumber,
            settings: preservedSettings
          };
          globalOrder++;
          return updatedQuestion;
        })
      }));
      
      setSections(updatedSections);
      // Only call onUpdate if the sections actually changed
      if (JSON.stringify(updatedSections) !== JSON.stringify(initialData)) {
        onUpdate(updatedSections);
      }
    }
  }, [initialData?.length]); // Remove onUpdate from dependencies to prevent infinite loop

  // Note: Parent updates are handled through user actions only

  const questionTypes = [
    {
      id: 'multiple_choice',
      name: 'Multiple Choice',
      icon: CheckSquare,
      description: 'Single or multiple selection from options',
      color: 'blue'
    },
    {
      id: 'text',
      name: 'Text Input',
      icon: Type,
      description: 'Open-ended text response',
      color: 'green'
    },
    {
      id: 'numeric',
      name: 'Numeric',
      icon: Hash,
      description: 'Numeric input only',
      color: 'cyan'
    },
    {
      id: 'rating',
      name: 'Rating Scale',
      icon: Star,
      description: 'Rate on a scale (1-5, 1-10, etc.)',
      color: 'yellow'
    },
    {
      id: 'yes_no',
      name: 'Yes/No',
      icon: CheckCircle,
      description: 'Simple binary choice',
      color: 'purple'
    },
    {
      id: 'dropdown',
      name: 'Dropdown',
      icon: ChevronDown,
      description: 'Select from dropdown list',
      color: 'indigo'
    },
    {
      id: 'file_upload',
      name: 'File Upload',
      icon: Upload,
      description: 'Upload documents or images',
      color: 'orange'
    },
    {
      id: 'date',
      name: 'Date/Time',
      icon: Clock,
      description: 'Date or time selection',
      color: 'teal'
    }
  ];
  // Re-add Matrix type (UI-only). Note: Backend may not support persisting it.
  questionTypes.push({
    id: 'matrix',
    name: 'Matrix',
    icon: BarChart3,
    description: 'Grid of questions with same options',
    color: 'pink'
  });

  const addNewSection = () => {
    const newSection = {
      id: generateUniqueId('section'),
      title: `Section ${sections.length + 1}`,
      questions: []
    };
    const updatedSections = [...sections, newSection];
    setSections(updatedSections);
    setCurrentSection(updatedSections.length - 1);
    onUpdate(updatedSections);
  };

  const deleteSection = (sectionIndex) => {
    // Prevent deletion of the first section (contains protected questions)
    if (sectionIndex === 0) {
      return; // Do nothing - first section is protected
    }
    
    const section = sections[sectionIndex];
    
    // Check if section has questions
    if (section.questions && section.questions.length > 0) {
      setSectionToDelete({ index: sectionIndex, section });
      setShowDeleteSectionModal(true);
      return;
    }
    
    // If no questions, delete directly
    confirmDeleteSection(sectionIndex);
  };

  const confirmDeleteSection = (sectionIndex) => {
    const updatedSections = sections.filter((_, index) => index !== sectionIndex);
    setSections(updatedSections);
    
    // Adjust current section if needed
    if (currentSection >= updatedSections.length) {
      setCurrentSection(Math.max(0, updatedSections.length - 1));
    }
    
    setShowDeleteSectionModal(false);
    setSectionToDelete(null);
    onUpdate(updatedSections);
  };

  const addNewQuestion = (type) => {
    // Calculate global order for the new question
    let globalOrder = 0;
    sections.forEach((section, sectionIndex) => {
      section.questions.forEach((question, questionIndex) => {
        globalOrder++;
      });
    });

    // Generate unique ID for the new question
    const questionId = generateUniqueId('question');

    const newQuestion = {
      id: questionId,
      type: type,
      text: 'New Question',
      description: '',
      required: true,
      order: globalOrder, // Add order number
      questionNumber: generateAutoQuestionNumber(currentSection, sections[currentSection].questions.length),
      enabledForCAPI: true, // Default: enabled for CAPI
      enabledForCATI: true, // Default: enabled for CATI
      setsForThisQuestion: false, // Default: not a sets question
      setNumber: null, // Default: no set number
      options: type === 'multiple_choice' || type === 'dropdown' ? [
        { id: `${questionId}_opt_1`, text: 'Option 1', value: 'option1', code: '1' },
        { id: `${questionId}_opt_2`, text: 'Option 2', value: 'option2', code: '2' }
      ] : [],
      scale: type === 'rating' ? {
        min: 1,
        max: 5,
        labels: [],
        minLabel: '',
        maxLabel: ''
      } : undefined,
      settings: {
        allowMultiple: type === 'multiple_choice',
        allowOther: false,
        required: true,
        shuffleOptions: type === 'multiple_choice' ? true : undefined // Default to true for multiple_choice questions
      }
    };

    const updatedSections = [...sections];
    updatedSections[currentSection].questions.push(newQuestion);
    setSections(updatedSections);
    setCurrentQuestion(updatedSections[currentSection].questions.length - 1);
    setShowQuestionTypes(false);
    onUpdate(updatedSections);
  };

  const updateQuestion = useCallback((sectionIndex, questionIndex, updates) => {
    setSections(prevSections => {
      const updatedSections = [...prevSections];
      // Deep clone to ensure proper state updates
      updatedSections[sectionIndex] = {
        ...updatedSections[sectionIndex],
        questions: [...updatedSections[sectionIndex].questions]
      };
      
      // Preserve existing settings when updating
      const currentQuestion = updatedSections[sectionIndex].questions[questionIndex];
      const currentSettings = currentQuestion?.settings && typeof currentQuestion.settings === 'object' 
        ? { ...currentQuestion.settings } 
        : {};
      
      // Merge settings if updates contain settings
      let mergedSettings = currentSettings;
      if (updates.settings) {
        mergedSettings = {
          ...currentSettings,
          ...updates.settings
        };
      }
      
      updatedSections[sectionIndex].questions[questionIndex] = {
        ...currentQuestion,
        ...updates,
        settings: mergedSettings
      };
      
      
      // Update parent component for any changes (not just conditions)
      setTimeout(() => {
        onUpdate(updatedSections);
      }, 0);
      
      return updatedSections;
    });
  }, [onUpdate]);

  // Note: Parent updates are handled directly in input change handlers

  const deleteQuestion = (sectionIndex, questionIndex) => {
    const updatedSections = [...sections];
    
    // Safety check to ensure the question exists
    if (!updatedSections[sectionIndex] || !updatedSections[sectionIndex].questions[questionIndex]) {
      console.warn('Question not found for deletion');
      return;
    }

    const question = updatedSections[sectionIndex].questions[questionIndex];
    
    // Prevent deletion of fixed questions
    if (question.isFixed || isFixedQuestion(question.id)) {
      console.warn('Cannot delete fixed questions');
      return;
    }
    
    updatedSections[sectionIndex].questions.splice(questionIndex, 1);
    setSections(updatedSections);
    
    if (currentQuestion >= updatedSections[currentSection].questions.length) {
      setCurrentQuestion(Math.max(0, updatedSections[currentSection].questions.length - 1));
    }
    onUpdate(updatedSections);
  };

  const duplicateQuestion = (sectionIndex, questionIndex) => {
    const question = sections[sectionIndex]?.questions[questionIndex];
    
    // Safety check to ensure the question exists
    if (!question) {
      console.warn('Question not found for duplication');
      return;
    }

    // Prevent duplication of fixed questions (unless it's the special survey)
    if (!isSpecialSurvey && (question.isFixed || isFixedQuestion(question.id))) {
      console.warn('Cannot duplicate fixed questions');
      return;
    }
    
    // Generate unique ID for duplicated question
    const duplicatedId = generateUniqueId('question');
    
    const duplicatedQuestion = {
      ...question,
      id: duplicatedId,
      text: `${question.text} (Copy)`,
      // Generate new IDs for options if they exist
      options: question.options ? question.options.map((option, index) => ({
        ...option,
        id: generateUniqueId(`opt_${duplicatedId}`)
      })) : []
    };
    
    const updatedSections = [...sections];
    updatedSections[sectionIndex].questions.splice(questionIndex + 1, 0, duplicatedQuestion);
    setSections(updatedSections);
    onUpdate(updatedSections);
  };

  // Helper function to auto-generate question number based on position
  const generateAutoQuestionNumber = (sectionIndex, questionIndex) => {
    // If question already has a custom number, don't auto-generate
    // Auto-generate format: sectionIndex + 1 . questionIndex + 1
    return `${sectionIndex + 1}.${questionIndex + 1}`;
  };

  // Helper function to update question numbers after reordering
  const updateQuestionNumbers = (updatedSections) => {
    return updatedSections.map((section, sectionIndex) => ({
      ...section,
      questions: section.questions.map((question, questionIndex) => {
        // Only auto-generate if question doesn't have a custom number
        // or if it's a new question without a number
        if (!question.questionNumber) {
          return {
            ...question,
            questionNumber: generateAutoQuestionNumber(sectionIndex, questionIndex)
          };
        }
        return question;
      })
    }));
  };

  const moveQuestion = (fromSection, fromIndex, toSection, toIndex) => {
    const updatedSections = [...sections];
    const question = updatedSections[fromSection].questions[fromIndex];
    
    updatedSections[fromSection].questions.splice(fromIndex, 1);
    updatedSections[toSection].questions.splice(toIndex, 0, question);
    
    // Update question numbers after moving (only auto-generate for questions without custom numbers)
    const sectionsWithNumbers = updateQuestionNumbers(updatedSections);
    
    // Update order numbers for all questions
    let globalOrder = 0;
    sectionsWithNumbers.forEach((section) => {
      section.questions.forEach((q) => {
        q.order = globalOrder;
        globalOrder++;
      });
    });
    
    setSections(sectionsWithNumbers);
    onUpdate(sectionsWithNumbers);
  };

  // Drag and drop handlers
  const handleDragStart = (e, sectionIndex, questionIndex) => {
    setDraggedQuestion({ sectionIndex, questionIndex });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
    e.target.style.opacity = '0.5';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedQuestion(null);
  };

  const handleDrop = (e, targetSectionIndex, targetQuestionIndex) => {
    e.preventDefault();
    
    if (!draggedQuestion) return;
    
    const { sectionIndex: sourceSectionIndex, questionIndex: sourceQuestionIndex } = draggedQuestion;
    
    // Don't do anything if dropped on itself
    if (sourceSectionIndex === targetSectionIndex && sourceQuestionIndex === targetQuestionIndex) {
      return;
    }
    
    // Move the question
    moveQuestion(sourceSectionIndex, sourceQuestionIndex, targetSectionIndex, targetQuestionIndex);
    
    // Update current selection
    setCurrentSection(targetSectionIndex);
    setCurrentQuestion(targetQuestionIndex);
    
    setDraggedQuestion(null);
  };

  // Handle double-click to edit question number
  const handleQuestionNumberDoubleClick = (e, sectionIndex, questionIndex) => {
    e.stopPropagation();
    const question = sections[sectionIndex].questions[questionIndex];
    setEditingQuestionNumber({ sectionIndex, questionIndex });
    setEditingQuestionNumberValue(question.questionNumber || generateAutoQuestionNumber(sectionIndex, questionIndex));
  };

  // Handle question number change
  const handleQuestionNumberChange = (e) => {
    const newValue = e.target.value;
    setEditingQuestionNumberValue(newValue);
  };

  // Handle question number save
  const handleQuestionNumberSave = () => {
    if (!editingQuestionNumber) return;
    const { sectionIndex, questionIndex } = editingQuestionNumber;
    
    // Deep clone sections to ensure proper update
    const updatedSections = sections.map((section, sIdx) => {
      if (sIdx === sectionIndex) {
        return {
          ...section,
          questions: section.questions.map((question, qIdx) => {
            if (qIdx === questionIndex) {
              const newNumber = editingQuestionNumberValue.trim();
              return {
                ...question,
                questionNumber: newNumber || null
              };
            }
            return question;
          })
        };
      }
      return section;
    });
    
    setSections(updatedSections);
    setEditingQuestionNumber(null);
    setEditingQuestionNumberValue('');
    onUpdate(updatedSections);
  };

  // Handle question number cancel
  const handleQuestionNumberCancel = () => {
    setEditingQuestionNumber(null);
    setEditingQuestionNumberValue('');
  };

  // Get display question number
  const getDisplayQuestionNumber = (question, sectionIndex, questionIndex) => {
    if (question.questionNumber) {
      return question.questionNumber;
    }
    return generateAutoQuestionNumber(sectionIndex, questionIndex);
  };

  const getQuestionIcon = (type) => {
    if (!type) return Type;
    const questionType = questionTypes.find(qt => qt.id === type);
    return questionType ? questionType.icon : Type;
  };

  const getQuestionColor = (type) => {
    if (!type) return 'gray';
    const questionType = questionTypes.find(qt => qt.id === type);
    return questionType ? questionType.color : 'gray';
  };

  // Get all questions for conditional logic
  const getAllQuestions = useCallback(() => {
    const allQuestions = [];
    
    sections.forEach((section, sectionIndex) => {
      section.questions.forEach((question, questionIndex) => {
        allQuestions.push({
          ...question,
          sectionId: section.id,
          sectionTitle: section.title,
          sectionIndex: sectionIndex,
          questionIndex: questionIndex,
          order: question.order || 0, // Use saved order or default to 0
          displayNumber: `${sectionIndex + 1}.${questionIndex + 1}`
        });
      });
    });
    
    // Sort by order to ensure proper sequence
    allQuestions.sort((a, b) => a.order - b.order);
    
    return allQuestions;
  }, [sections]);

  const renderQuestionPreview = (question) => {
    switch (question.type) {
      case 'multiple_choice':
        return (
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900">{question.text}</h3>
            {question.description && (
              <p className="text-gray-600">{question.description}</p>
            )}
            {question.settings?.allowMultiple && question.settings?.maxSelections && (
              <p className="text-sm text-[#001D48] font-medium">
                Maximum {question.settings.maxSelections} selection{question.settings.maxSelections > 1 ? 's' : ''} allowed
              </p>
            )}
            <div className="space-y-2">
              {question.options.map((option, index) => (
                <label key={index} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type={question.settings?.allowMultiple ? 'checkbox' : 'radio'}
                    name={`question-${question.id}`}
                    className="w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{option.text || option}</span>
                </label>
              ))}
            </div>
            {question.required && (
              <p className="text-sm text-red-600">* Required</p>
            )}
          </div>
        );

      case 'text':
        return (
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900">{question.text}</h3>
            {question.description && (
              <p className="text-gray-600">{question.description}</p>
            )}
            <textarea
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Your answer here..."
            />
            {question.required && (
              <p className="text-sm text-red-600">* Required</p>
            )}
          </div>
        );

      case 'rating':
        const scale = question.scale || { min: 1, max: 5 };
        const min = scale.min || 1;
        const max = scale.max || 5;
        const labels = scale.labels || [];
        const minLabel = scale.minLabel || '';
        const maxLabel = scale.maxLabel || '';
        const ratings = [];
        for (let i = min; i <= max; i++) {
          ratings.push(i);
        }
        return (
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900">{question.text}</h3>
            {question.description && (
              <p className="text-gray-600">{question.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {ratings.map((rating) => (
                <button
                  key={rating}
                  className="w-12 h-12 border-2 border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 flex flex-col items-center justify-center"
                  title={labels[rating - min] || ''}
                >
                  <span className="text-lg font-semibold">{rating}</span>
                  {labels[rating - min] && (
                    <span className="text-xs text-gray-500 mt-0.5">{labels[rating - min]}</span>
                  )}
                </button>
              ))}
            </div>
            {(minLabel || maxLabel) && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>{minLabel}</span>
                <span>{maxLabel}</span>
              </div>
            )}
            {question.required && (
              <p className="text-sm text-red-600">* Required</p>
            )}
          </div>
        );

      case 'yes_no':
        return (
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900">{question.text}</h3>
            {question.description && (
              <p className="text-gray-600">{question.description}</p>
            )}
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  className="w-4 h-4 text-[#001D48] border-gray-300 focus:ring-blue-500"
                />
                <span className="text-gray-700">Yes</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  className="w-4 h-4 text-[#001D48] border-gray-300 focus:ring-blue-500"
                />
                <span className="text-gray-700">No</span>
              </label>
            </div>
            {question.required && (
              <p className="text-sm text-red-600">* Required</p>
            )}
          </div>
        );

      default:
        return (
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900">{question.text}</h3>
            {question.description && (
              <p className="text-gray-600">{question.description}</p>
            )}
            <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500">
              {question.type} question preview
            </div>
          </div>
        );
    }
  };

  const handleSave = () => {
    onUpdate(sections);
  };

  // Remove automatic updates to prevent infinite loops
  // Updates will be handled manually in specific functions

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Survey Builder</h2>
            <p className="text-lg text-gray-600">Create your survey questions with our intuitive builder</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                isPreviewMode 
                  ? 'bg-[#001D48] text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>{isPreviewMode ? 'Edit Mode' : 'Preview'}</span>
            </button>
            
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save Survey</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Sections and Questions */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 sticky top-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Survey Structure</h3>
              
              <div className="space-y-4">
                {sections.map((section, sectionIndex) => (
                  <div 
                    key={section.id} 
                    onClick={(e) => {
                      // Only navigate if click is not on a child element that should handle its own clicks
                      if (!e.target.closest('.question-number-area') && !e.target.closest('.question-item')) {
                        setCurrentSection(sectionIndex);
                      }
                    }}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      currentSection === sectionIndex
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">
                        <span className="text-sm text-gray-500 mr-2">Section {sectionIndex + 1}:</span>
                        {section.title}
                        {sectionIndex === 0 && (
                          <span className="ml-2 text-xs text-[#001D48] bg-blue-100 px-2 py-1 rounded-full">
                            <Lock className="w-3 h-3 inline mr-1" />
                            Protected
                          </span>
                        )}
                      </h4>
                      {sections.length > 1 && sectionIndex !== 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent section selection when clicking delete
                            deleteSection(sectionIndex);
                          }}
                          className="text-red-600 hover:text-red-700 text-sm focus:outline-none"
                          title="Delete section"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {sectionIndex === 0 && !isSpecialSurvey && (
                        <div className="flex items-center text-xs text-[#001D48] bg-blue-50 px-2 py-1 rounded">
                          <Shield className="w-3 h-3 mr-1" />
                          Protected
                        </div>
                      )}
                    </div>
                    
                    {sectionIndex === 0 && !isSpecialSurvey && (
                      <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-xs text-blue-700">
                          <Shield className="w-3 h-3 inline mr-1" />
                          This section contains required respondent information and cannot be deleted.
                        </p>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      {section.questions.filter(question => question && question.id).map((question, questionIndex) => {
                        // For special survey, ignore isFixed flag
                        const isFixed = isSpecialSurvey ? false : (question.isFixed || isFixedQuestion(question.id));
                        const isEditing = editingQuestionNumber?.sectionIndex === sectionIndex && editingQuestionNumber?.questionIndex === questionIndex;
                        const displayNumber = getDisplayQuestionNumber(question, sectionIndex, questionIndex);
                        const isDragging = draggedQuestion?.sectionIndex === sectionIndex && draggedQuestion?.questionIndex === questionIndex;
                        
                        return (
                          <div
                            key={question.id}
                            className="question-item"
                            draggable={!isEditing}
                            onDragStart={(e) => {
                              if (!isEditing) {
                                handleDragStart(e, sectionIndex, questionIndex);
                              } else {
                                e.preventDefault();
                              }
                            }}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                            onDrop={(e) => handleDrop(e, sectionIndex, questionIndex)}
                            onClick={(e) => {
                              // Don't navigate if clicking on question number area
                              if (e.target.closest('.question-number-area')) {
                                e.stopPropagation();
                                return;
                              }
                              if (!isEditing) {
                                e.stopPropagation(); // Prevent section selection when clicking question
                                setCurrentSection(sectionIndex);
                                setCurrentQuestion(questionIndex);
                              }
                            }}
                            className={`flex items-center space-x-2 p-2 rounded transition-colors ${
                              isEditing ? 'cursor-default' : 'cursor-move'
                            } ${
                              currentSection === sectionIndex && currentQuestion === questionIndex
                                ? 'bg-blue-50 text-blue-700'
                                : 'hover:bg-gray-50'
                            } ${isDragging ? 'opacity-50' : ''}`}
                          >
                            <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingQuestionNumberValue}
                                onChange={handleQuestionNumberChange}
                                onBlur={handleQuestionNumberSave}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleQuestionNumberSave();
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    handleQuestionNumberCancel();
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="text-xs font-medium text-gray-700 w-16 px-1 py-0.5 border-2 border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white z-10"
                                autoFocus
                              />
                            ) : (
                              <span 
                                className="question-number-area text-xs font-medium text-gray-500 w-12 flex-shrink-0 cursor-text hover:text-[#001D48] hover:bg-blue-50 px-1 py-0.5 rounded transition-colors select-none"
                                onClick={(e) => {
                                  // Stop all propagation to prevent section navigation
                                  e.stopPropagation();
                                  e.preventDefault();
                                }}
                                onDoubleClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleQuestionNumberDoubleClick(e, sectionIndex, questionIndex);
                                }}
                                onMouseDown={(e) => {
                                  // Stop propagation on mouse down to prevent any navigation
                                  e.stopPropagation();
                                }}
                                title="Double-click to edit question number"
                              >
                                {displayNumber}
                              </span>
                            )}
                            {question.type && React.createElement(getQuestionIcon(question.type), {
                              className: `w-4 h-4 text-${getQuestionColor(question.type)}-600 flex-shrink-0`
                            })}
                            <span className="text-sm truncate flex-1">{question.text || question.title}</span>
                            {question.conditions && question.conditions.length > 0 && (
                              <Zap className="w-3 h-3 text-yellow-600 flex-shrink-0" title="Conditional question" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent section selection when clicking add question
                        setCurrentSection(sectionIndex);
                        setShowQuestionTypes(true);
                      }}
                      className="w-full mt-2 flex items-center justify-center space-x-2 py-2 text-sm text-[#001D48] border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Question</span>
                    </button>
                  </div>
                ))}
                
                <button
                  onClick={addNewSection}
                  className="w-full flex items-center justify-center space-x-2 py-3 text-sm text-gray-600 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Section</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {isPreviewMode ? (
              /* Preview Mode with Conditional Logic */
              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
                <div className="max-w-2xl mx-auto">
                  <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
                    {surveyData?.specifications?.surveyName || 'Survey Preview'}
                  </h2>
                  
                  <SurveyResponse
                    survey={{ sections }}
                    onResponseChange={setPreviewResponses}
                    initialResponses={previewResponses}
                  />
                  
                  <div className="text-center mt-8">
                    <button className="px-8 py-3 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors">
                      Submit Survey
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Edit Mode */
              <div className="space-y-6">
                {sections.length > 0 && sections[currentSection] && (
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    {/* Section Header */}
                    <div className="mb-6">
                      <input
                        type="text"
                        value={sections[currentSection].title}
                        onChange={(e) => {
                          const updatedSections = [...sections];
                          updatedSections[currentSection].title = e.target.value;
                          setSections(updatedSections);
                          onUpdate(updatedSections);
                        }}
                        className="text-xl font-semibold text-gray-900 bg-transparent border-none outline-none w-full"
                      />
                    </div>

                    {/* Questions */}
                    <div className="space-y-6">
                      {sections[currentSection].questions.filter(question => question && question.id).map((question, questionIndex) => {
                        // For special survey, ignore isFixed flag
                        const isFixed = isSpecialSurvey ? false : (question.isFixed || isFixedQuestion(question.id));
                        return (
                        <div key={question.id} className={`border rounded-lg p-6 ${isFixed ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'}`}>
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                            {editingQuestionNumber?.sectionIndex === currentSection && editingQuestionNumber?.questionIndex === questionIndex ? (
                              <input
                                type="text"
                                value={editingQuestionNumberValue}
                                onChange={handleQuestionNumberChange}
                                onBlur={handleQuestionNumberSave}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleQuestionNumberSave();
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    handleQuestionNumberCancel();
                                  }
                                }}
                                className="text-sm font-bold px-2 py-1 rounded border border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                              />
                            ) : (
                              <span 
                                className={`text-sm font-bold px-2 py-1 rounded cursor-text hover:bg-blue-200 transition-colors ${isFixed ? 'text-blue-700 bg-blue-200' : 'text-[#001D48] bg-blue-100'}`}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  handleQuestionNumberDoubleClick(e, currentSection, questionIndex);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                title="Double-click to edit question number"
                              >
                                Q{getDisplayQuestionNumber(question, currentSection, questionIndex)}
                              </span>
                            )}
                              {question.type && React.createElement(getQuestionIcon(question.type), {
                                className: `w-5 h-5 text-${getQuestionColor(question.type)}-600`
                              })}
                              <span className="text-sm font-medium text-gray-600 capitalize">
                                {question.type ? question.type.replace('_', ' ') : 'Unknown'}
                              </span>
                              {isFixed && (
                                <div className="flex items-center space-x-1">
                                  <Lock className="w-3 h-3 text-[#001D48]" />
                                  <span className="text-xs text-[#001D48] font-medium">Required</span>
                                </div>
                              )}
                            {question.conditions && question.conditions.length > 0 && (
                              <div className="flex items-center space-x-1">
                                <Zap className="w-3 h-3 text-yellow-600" />
                                <span className="text-xs text-yellow-600">Conditional</span>
                              </div>
                            )}
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              {!isFixed && (
                                <>
                                  <button
                                    onClick={() => duplicateQuestion(currentSection, questionIndex)}
                                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteQuestion(currentSection, questionIndex)}
                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {isFixed && (
                                <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 rounded-md">
                                  <Shield className="w-4 h-4 text-[#001D48]" />
                                  <span className="text-xs text-[#001D48] font-medium">Protected</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <input
                                type="text"
                                value={question.text}
                                onChange={(e) => {
                                  if (!isFixed) {
                                    updateQuestion(currentSection, questionIndex, { text: e.target.value });
                                    // Update parent component
                                    setTimeout(() => {
                                      onUpdate(sections);
                                    }, 0);
                                  }
                                }}
                                className={`w-full text-lg font-medium bg-transparent border-none outline-none ${isFixed ? 'text-gray-700 cursor-not-allowed' : 'text-gray-900'}`}
                                placeholder="Question text"
                                disabled={isFixed}
                              />
                            </div>

                            <div>
                              <textarea
                                value={question.description}
                                onChange={(e) => {
                                  if (!isFixed) {
                                    updateQuestion(currentSection, questionIndex, { description: e.target.value });
                                    // Update parent component
                                    setTimeout(() => {
                                      onUpdate(sections);
                                    }, 0);
                                  }
                                }}
                                className={`w-full bg-transparent border-none outline-none resize-none ${isFixed ? 'text-gray-600 cursor-not-allowed' : 'text-gray-600'}`}
                                placeholder="Question description (optional)"
                                rows={2}
                                disabled={isFixed}
                              />
                            </div>

                            {/* Question-specific options */}
                            {(question.type === 'multiple_choice' || question.type === 'dropdown') && (
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Options</label>
                                <div className="text-xs text-gray-500 mb-2">Each option can have a code (default: 1, 2, 3, 4...)</div>
                                {question.options.map((option, optionIndex) => {
                                  // Ensure option has a unique ID
                                  const optionId = option.id || generateUniqueId(`opt_${question.id}`);
                                  // Default code is optionIndex + 1 if not set
                                  const defaultCode = option.code || String(optionIndex + 1);
                                  return (
                                    <div key={optionId} className="flex items-center space-x-2">
                                      {/* Code input */}
                                      <input
                                        type="text"
                                        value={option.code || defaultCode}
                                        onChange={(e) => {
                                          if (!isFixed) {
                                            const updatedOptions = [...question.options];
                                            updatedOptions[optionIndex] = {
                                              ...option,
                                              id: optionId,
                                              code: e.target.value || String(optionIndex + 1)
                                            };
                                            updateQuestion(currentSection, questionIndex, { options: updatedOptions });
                                            setTimeout(() => {
                                              onUpdate(sections);
                                            }, 0);
                                          }
                                        }}
                                        className={`w-16 px-2 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${isFixed ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' : 'border-gray-300'}`}
                                        placeholder={String(optionIndex + 1)}
                                        disabled={isFixed}
                                        title="Option Code"
                                      />
                                      {/* Option text input */}
                                      <input
                                        type="text"
                                        value={option.text || ''}
                                        onChange={(e) => {
                                          if (!isFixed) {
                                            const updatedOptions = [...question.options];
                                            updatedOptions[optionIndex] = {
                                              ...option,
                                              id: optionId,
                                              text: e.target.value,
                                              value: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                                              code: option.code || String(optionIndex + 1)
                                            };
                                            updateQuestion(currentSection, questionIndex, { options: updatedOptions });
                                            // Update parent component
                                            setTimeout(() => {
                                              onUpdate(sections);
                                            }, 0);
                                          }
                                        }}
                                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isFixed ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' : 'border-gray-300'}`}
                                        placeholder={`Option ${optionIndex + 1}`}
                                        disabled={isFixed}
                                      />
                                      {!isFixed && (
                                        <button
                                          onClick={() => {
                                            const updatedOptions = question.options.filter((_, i) => i !== optionIndex);
                                            // Reassign codes after deletion
                                            const reindexedOptions = updatedOptions.map((opt, idx) => ({
                                              ...opt,
                                              code: opt.code || String(idx + 1)
                                            }));
                                            updateQuestion(currentSection, questionIndex, { options: reindexedOptions });
                                          }}
                                          className="p-2 text-red-600 hover:text-red-700 transition-colors"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                                {!isFixed && (
                                  <button
                                    onClick={() => {
                                      const newOption = {
                                        id: generateUniqueId(`opt_${question.id}`),
                                        text: `Option ${question.options.length + 1}`,
                                        value: `option${question.options.length + 1}`,
                                        code: String(question.options.length + 1)
                                      };
                                      const updatedOptions = [...question.options, newOption];
                                      updateQuestion(currentSection, questionIndex, { options: updatedOptions });
                                    }}
                                    className="flex items-center space-x-2 text-sm text-[#001D48] hover:text-[#373177]"
                                  >
                                    <Plus className="w-4 h-4" />
                                    <span>Add Option</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Question Settings */}
                            <div className="flex items-center space-x-4 pt-4 border-t border-gray-200">
                              <label className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={question.required}
                                  onChange={(e) => !isFixed && updateQuestion(currentSection, questionIndex, { required: e.target.checked })}
                                  className={`w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500 ${isFixed ? 'cursor-not-allowed opacity-50' : ''}`}
                                  disabled={isFixed}
                                />
                                <span className={`text-sm ${isFixed ? 'text-gray-500' : 'text-gray-700'}`}>Required</span>
                              </label>
                              
                              {/* CAPI/CATI Visibility Settings */}
                              <div className="ml-4 pl-4 border-l border-gray-300">
                                <div className="space-y-2">
                                  <label className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      checked={question.enabledForCAPI !== false} // Default to true
                                      onChange={(e) => !isFixed && updateQuestion(currentSection, questionIndex, { enabledForCAPI: e.target.checked })}
                                      className={`w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500 ${isFixed ? 'cursor-not-allowed opacity-50' : ''}`}
                                      disabled={isFixed}
                                    />
                                    <span className={`text-xs ${isFixed ? 'text-gray-500' : 'text-gray-700'}`}>CAPI</span>
                                  </label>
                                  <label className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      checked={question.enabledForCATI !== false} // Default to true
                                      onChange={(e) => !isFixed && updateQuestion(currentSection, questionIndex, { enabledForCATI: e.target.checked })}
                                      className={`w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500 ${isFixed ? 'cursor-not-allowed opacity-50' : ''}`}
                                      disabled={isFixed}
                                    />
                                    <span className={`text-xs ${isFixed ? 'text-gray-500' : 'text-gray-700'}`}>CATI</span>
                                  </label>
                                      <label className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          checked={question.setsForThisQuestion || false}
                                          onChange={(e) => {
                                            if (!isFixed) {
                                              const updates = { 
                                                setsForThisQuestion: e.target.checked,
                                                // Clear setNumber if unchecking Sets
                                                setNumber: e.target.checked ? (question.setNumber || 1) : null
                                              };
                                              updateQuestion(currentSection, questionIndex, updates);
                                            }
                                          }}
                                          className={`w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500 ${isFixed ? 'cursor-not-allowed opacity-50' : ''}`}
                                          disabled={isFixed}
                                        />
                                        <span className={`text-xs ${isFixed ? 'text-gray-500' : 'text-gray-700'}`}>Sets</span>
                                      </label>
                                      {question.setsForThisQuestion && (
                                        <div className="flex items-center space-x-2 ml-6">
                                          <label className="text-xs text-gray-700">Set Number:</label>
                                          <input
                                            type="number"
                                            min="1"
                                            value={question.setNumber || 1}
                                            onChange={(e) => !isFixed && updateQuestion(currentSection, questionIndex, { 
                                              setNumber: parseInt(e.target.value) || 1 
                                            })}
                                            className={`w-16 px-2 py-1 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isFixed ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' : 'border-gray-300'}`}
                                            disabled={isFixed}
                                            placeholder="1"
                                          />
                                        </div>
                                      )}
                                </div>
                              </div>
                              
                              {question.type === 'multiple_choice' && (
                                <div className="space-y-3">
                                  <div className="flex items-center space-x-4 flex-wrap">
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        checked={question.settings?.allowMultiple || false}
                                        onChange={(e) => !isFixed && updateQuestion(currentSection, questionIndex, {
                                          settings: { 
                                            ...question.settings, 
                                            allowMultiple: e.target.checked,
                                            // Reset maxSelections when disabling multiple selections
                                            maxSelections: e.target.checked ? (question.settings?.maxSelections || null) : null
                                          }
                                        })}
                                        className={`w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500 ${isFixed ? 'cursor-not-allowed opacity-50' : ''}`}
                                        disabled={isFixed}
                                      />
                                      <span className={`text-sm ${isFixed ? 'text-gray-500' : 'text-gray-700'}`}>Allow multiple selections</span>
                                    </label>
                                    
                                    {question.settings?.allowMultiple && (
                                      <div className="flex items-center space-x-2">
                                        <label className="text-sm text-gray-700">Maximum selections:</label>
                                        <input
                                          type="number"
                                          min="2"
                                          max={question.options?.length || 999}
                                          value={question.settings?.maxSelections || ''}
                                          onChange={(e) => !isFixed && updateQuestion(currentSection, questionIndex, {
                                            settings: { 
                                              ...question.settings, 
                                              maxSelections: e.target.value ? parseInt(e.target.value) : null
                                            }
                                          })}
                                          placeholder="Unlimited"
                                          className={`w-24 px-2 py-1 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isFixed ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' : 'border-gray-300'}`}
                                          disabled={isFixed}
                                        />
                                        {question.settings?.maxSelections && (
                                          <span className="text-xs text-gray-500">
                                            (Max {question.settings.maxSelections} can be selected)
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <label className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      checked={question.settings?.shuffleOptions !== false} // Default to true if not set
                                      onChange={(e) => !isFixed && updateQuestion(currentSection, questionIndex, {
                                        settings: { 
                                          ...question.settings, 
                                          shuffleOptions: e.target.checked
                                        }
                                      })}
                                      className={`w-4 h-4 text-[#001D48] border-gray-300 rounded focus:ring-blue-500 ${isFixed ? 'cursor-not-allowed opacity-50' : ''}`}
                                      disabled={isFixed}
                                    />
                                    <span className={`text-sm ${isFixed ? 'text-gray-500' : 'text-gray-700'}`}>Shuffle options</span>
                                  </label>
                                </div>
                              )}

                              {/* Rating Scale Configuration */}
                              {question.type === 'rating' && (
                                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                  <label className="block text-sm font-medium text-gray-700 mb-3">Rating Scale Configuration</label>
                                  
                                  <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">Minimum Value</label>
                                      <input
                                        type="number"
                                        min="1"
                                        value={question.scale?.min || 1}
                                        onChange={(e) => !isFixed && updateQuestion(currentSection, questionIndex, {
                                          scale: {
                                            ...question.scale,
                                            min: parseInt(e.target.value) || 1,
                                            max: Math.max(parseInt(e.target.value) || 1, question.scale?.max || 5)
                                          }
                                        })}
                                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isFixed ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' : 'border-gray-300'}`}
                                        disabled={isFixed}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">Maximum Value</label>
                                      <input
                                        type="number"
                                        min={question.scale?.min || 1}
                                        value={question.scale?.max || 5}
                                        onChange={(e) => !isFixed && updateQuestion(currentSection, questionIndex, {
                                          scale: {
                                            ...question.scale,
                                            max: Math.max(parseInt(e.target.value) || 5, question.scale?.min || 1)
                                          }
                                        })}
                                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isFixed ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' : 'border-gray-300'}`}
                                        disabled={isFixed}
                                      />
                                    </div>
                                  </div>

                                  {/* Labels for each point */}
                                  <div className="mb-4">
                                    <label className="block text-xs text-gray-600 mb-2">Labels for Each Point (Optional)</label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                      {(() => {
                                        const min = question.scale?.min || 1;
                                        const max = question.scale?.max || 5;
                                        const labels = question.scale?.labels || [];
                                        const points = [];
                                        for (let i = min; i <= max; i++) {
                                          points.push(i);
                                        }
                                        return points.map((point) => (
                                          <div key={point} className="flex items-center space-x-2">
                                            <span className="text-sm font-medium text-gray-700 w-8">{point}:</span>
                                            <input
                                              type="text"
                                              value={labels[point - min] || ''}
                                              onChange={(e) => {
                                                if (!isFixed) {
                                                  const newLabels = [...labels];
                                                  newLabels[point - min] = e.target.value;
                                                  updateQuestion(currentSection, questionIndex, {
                                                    scale: {
                                                      ...question.scale,
                                                      labels: newLabels
                                                    }
                                                  });
                                                }
                                              }}
                                              placeholder={`Label for ${point} (optional)`}
                                              className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isFixed ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' : 'border-gray-300'}`}
                                              disabled={isFixed}
                                            />
                                          </div>
                                        ));
                                      })()}
                                    </div>
                                  </div>

                                  {/* Min and Max Labels (Alternative to individual labels) */}
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">Minimum Label (Optional)</label>
                                      <input
                                        type="text"
                                        value={question.scale?.minLabel || ''}
                                        onChange={(e) => !isFixed && updateQuestion(currentSection, questionIndex, {
                                          scale: {
                                            ...question.scale,
                                            minLabel: e.target.value
                                          }
                                        })}
                                        placeholder="e.g., Poor, Disagree"
                                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isFixed ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' : 'border-gray-300'}`}
                                        disabled={isFixed}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">Maximum Label (Optional)</label>
                                      <input
                                        type="text"
                                        value={question.scale?.maxLabel || ''}
                                        onChange={(e) => !isFixed && updateQuestion(currentSection, questionIndex, {
                                          scale: {
                                            ...question.scale,
                                            maxLabel: e.target.value
                                          }
                                        })}
                                        placeholder="e.g., Excellent, Agree"
                                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isFixed ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' : 'border-gray-300'}`}
                                        disabled={isFixed}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Conditional Logic - Disabled for fixed questions */}
                            {!isFixed && !question.isFixed && (
                              <div className="mt-6">
                                <ConditionalLogic
                                  question={question}
                                  allQuestions={getAllQuestions()}
                                  onUpdate={updateQuestion}
                                  sectionIndex={currentSection}
                                  questionIndex={questionIndex}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>

                    {/* Add Question Button */}
                    <div className="mt-6">
                      <button
                        onClick={() => setShowQuestionTypes(true)}
                        className="w-full flex items-center justify-center space-x-2 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                        <span>Add Question</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Question Type Modal */}
        {showQuestionTypes && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Choose Question Type</h3>
                <button
                  onClick={() => setShowQuestionTypes(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {questionTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => addNewQuestion(type.id)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        <Icon className={`w-5 h-5 text-${type.color}-600`} />
                        <span className="font-medium text-gray-900">{type.name}</span>
                      </div>
                      <p className="text-sm text-gray-600">{type.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}


        {/* Delete Section Confirmation Modal */}
        {showDeleteSectionModal && sectionToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Section</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 mb-2">
                  Are you sure you want to delete <strong>"{sectionToDelete.section.title}"</strong>?
                </p>
                <p className="text-sm text-gray-600">
                  This section contains <strong>{sectionToDelete.section.questions.length} question{sectionToDelete.section.questions.length !== 1 ? 's' : ''}</strong> that will also be deleted.
                </p>
              </div>
              
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteSectionModal(false);
                    setSectionToDelete(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmDeleteSection(sectionToDelete.index)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete Section
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyQuestionBuilder;
