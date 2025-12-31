import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Settings,
  AlertCircle,
  CheckCircle,
  X,
  Zap
} from 'lucide-react';

const ConditionalLogic = ({ 
  question, 
  allQuestions, 
  onUpdate, 
  sectionIndex, 
  questionIndex 
}) => {
  const [showConditions, setShowConditions] = useState(false);
  const [conditions, setConditions] = useState(question.conditions || []);
  const [showAddCondition, setShowAddCondition] = useState(false);
  const isUpdating = useRef(false);
  const prevConditionsRef = useRef(conditions);

  const operators = [
    { value: 'equals', label: 'Equals', description: 'Answer is exactly' },
    { value: 'not_equals', label: 'Not Equals', description: 'Answer is not' },
    { value: 'contains', label: 'Contains', description: 'Answer contains' },
    { value: 'not_contains', label: 'Does not contain', description: 'Answer does not contain' },
    { value: 'greater_than', label: 'Greater than', description: 'Answer is greater than' },
    { value: 'less_than', label: 'Less than', description: 'Answer is less than' },
    { value: 'is_empty', label: 'Is empty', description: 'Answer is empty' },
    { value: 'is_not_empty', label: 'Is not empty', description: 'Answer is not empty' },
    { value: 'is_selected', label: 'Is selected', description: 'Option is selected' },
    { value: 'is_not_selected', label: 'Is not selected', description: 'Option is not selected' }
  ];

  // Get available questions for conditions (exclude current question and questions after it)
  const getAvailableQuestions = () => {
    const currentQuestionOrder = question.order || 0;
    const availableQuestions = allQuestions.filter(q => 
      q.id !== question.id && 
      q.order < currentQuestionOrder
    );
    
    return availableQuestions;
  };

  const addCondition = () => {
    const newCondition = {
      id: Date.now(),
      questionId: '',
      operator: 'equals',
      value: '',
      logic: 'AND'
    };
    setConditions(prevConditions => [...prevConditions, newCondition]);
    setShowAddCondition(true);
  };

  const updateCondition = (index, field, value) => {
    setConditions(prevConditions => {
      const updatedConditions = [...prevConditions];
      updatedConditions[index] = {
        ...updatedConditions[index],
        [field]: value
      };
      return updatedConditions;
    });
  };

  const removeCondition = (index) => {
    setConditions(prevConditions => prevConditions.filter((_, i) => i !== index));
  };

  const getQuestionOptions = (questionId) => {
    const targetQuestion = allQuestions.find(q => q.id === questionId);
    if (!targetQuestion) return [];
    
    if (targetQuestion.type === 'multiple_choice' || targetQuestion.type === 'dropdown') {
      return targetQuestion.options || [];
    }
    return [];
  };

  const getOperatorDescription = (operator) => {
    const op = operators.find(o => o.value === operator);
    return op ? op.description : '';
  };

  const isConditionValid = (condition) => {
    // For operators that don't need a value, check if they're valid
    if (condition.operator === 'is_empty' || condition.operator === 'is_not_empty') {
      return condition.questionId && condition.operator;
    }
    
    // For all other operators, require a value
    return condition.questionId && condition.operator && condition.value && condition.value.trim() !== '';
  };

  const areAllConditionsValid = () => {
    return conditions.every(isConditionValid);
  };

  // Update parent component when conditions change
  useEffect(() => {
    // Only update if conditions actually changed
    if (onUpdate && !isUpdating.current && JSON.stringify(conditions) !== JSON.stringify(prevConditionsRef.current)) {
      isUpdating.current = true;
      prevConditionsRef.current = conditions;
      onUpdate(sectionIndex, questionIndex, { conditions });
      setTimeout(() => {
        isUpdating.current = false;
      }, 0);
    }
  }, [conditions, sectionIndex, questionIndex]);

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-[#373177]" />
          <h4 className="font-medium text-gray-900">Conditional Logic</h4>
          {conditions.length > 0 && (
            <span className="px-2 py-1 text-xs bg-[#E6F0F8] text-blue-700 rounded-full">
              {conditions.length} condition{conditions.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowConditions(!showConditions)}
            className="flex items-center space-x-1 text-sm text-[#373177] hover:text-blue-700"
          >
            {showConditions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>{showConditions ? 'Hide' : 'Show'} Logic</span>
          </button>
        </div>
      </div>

      {conditions.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>This question will be shown when:</span>
            <div className="flex items-center space-x-1">
              {conditions.map((condition, index) => {
                const targetQuestion = allQuestions.find(q => q.id === condition.questionId);
                const isValid = isConditionValid(condition);
                
                return (
                  <React.Fragment key={index}>
                    {index > 0 && (
                      <span className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">
                        {condition.logic}
                      </span>
                    )}
                    <span className={`px-2 py-1 text-xs rounded ${
                      isValid 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {targetQuestion ? `Q${targetQuestion.displayNumber}: ${targetQuestion.text}` : 'Select Question'} {getOperatorDescription(condition.operator)} {condition.value || (condition.operator === 'is_empty' || condition.operator === 'is_not_empty' ? '' : 'Enter value')}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showConditions && (
        <div className="space-y-4">
          {conditions.map((condition, index) => (
            <div key={condition.id || index} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Condition {index + 1}</span>
                <div className="flex items-center space-x-2">
                  {index > 0 && (
                    <select
                      value={condition.logic}
                      onChange={(e) => updateCondition(index, 'logic', e.target.value)}
                      className="text-xs px-2 py-1 border border-gray-300 rounded"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  )}
                  <button
                    onClick={() => removeCondition(index)}
                    className="p-1 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Question Selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    If this question
                  </label>
                  <select
                    value={condition.questionId}
                    onChange={(e) => updateCondition(index, 'questionId', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a question</option>
                    {getAvailableQuestions().map(q => (
                      <option key={q.id} value={q.id}>
                        Q{q.displayNumber}: {q.text || `Question ${q.order + 1}`} ({q.sectionTitle})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Operator Selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Operator
                  </label>
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {operators.map(op => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Value Input */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Value
                  </label>
                  {condition.operator === 'is_empty' || condition.operator === 'is_not_empty' ? (
                    <div className="px-3 py-2 text-sm text-gray-500 bg-gray-100 rounded-lg">
                      No value needed
                    </div>
                  ) : condition.operator === 'is_selected' || condition.operator === 'is_not_selected' ? (
                    <select
                      value={condition.value}
                      onChange={(e) => updateCondition(index, 'value', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select an option</option>
                      {getQuestionOptions(condition.questionId).map(option => (
                        <option key={option.id || option} value={option.value || option}>
                          {option.text || option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={condition.value}
                      onChange={(e) => updateCondition(index, 'value', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter value"
                    />
                  )}
                </div>
              </div>

              {/* Condition Status */}
              <div className="mt-3 flex items-center space-x-2">
                {isConditionValid(condition) ? (
                  <div className="flex items-center space-x-1 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-xs">Condition is valid</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs">Complete all fields</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Add Condition Button */}
          <button
            onClick={addCondition}
            className="w-full flex items-center justify-center space-x-2 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:text-[#373177] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Condition</span>
          </button>

          {/* Logic Summary */}
          {conditions.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <Settings className="w-4 h-4 text-[#373177] mt-0.5" />
                <div>
                  <h5 className="text-sm font-medium text-blue-900">Logic Summary</h5>
                  <p className="text-xs text-blue-700 mt-1">
                    This question will be displayed to respondents when {conditions.length === 1 ? 'the condition' : 'all conditions'} above {conditions.length === 1 ? 'is' : 'are'} met.
                    {conditions.length > 1 && ' Use AND/OR to combine multiple conditions.'}
                    <br />
                    <strong>Note:</strong> These conditions will be evaluated when respondents take the survey.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConditionalLogic;
