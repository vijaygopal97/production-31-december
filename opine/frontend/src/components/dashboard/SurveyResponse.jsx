import React, { useState, useEffect } from 'react';
import ConditionalQuestionDisplay from './ConditionalQuestionDisplay';

const SurveyResponse = ({ survey, onResponseChange, initialResponses = {} }) => {
  const [responses, setResponses] = useState(initialResponses);
  const [visibleQuestions, setVisibleQuestions] = useState(new Set());

  // Get all questions from all sections
  const getAllQuestions = () => {
    const allQuestions = [];
    survey.sections?.forEach(section => {
      section.questions?.forEach(question => {
        allQuestions.push({
          ...question,
          sectionId: section.id,
          sectionTitle: section.title
        });
      });
    });
    return allQuestions;
  };

  // Evaluate conditional logic for a question
  const evaluateConditions = (question) => {
    if (!question.conditions || question.conditions.length === 0) {
      return true;
    }

    const allQuestions = getAllQuestions();
    const results = question.conditions.map(condition => {
      const targetQuestion = allQuestions.find(q => q.id === condition.questionId);
      if (!targetQuestion) return false;

      const response = responses[condition.questionId];
      if (response === undefined || response === null) return false;

      let met = false;

      // Import getMainText for comparison (strip translations)
      const getMainText = (text) => {
        if (!text || typeof text !== 'string') return text || '';
        const translationRegex = /^(.+?)\s*\{([^}]+)\}\s*$/;
        const match = text.match(translationRegex);
        return match ? match[1].trim() : text.trim();
      };

      // Helper function to get main text (without translation) for comparison
      const getComparisonValue = (val) => {
        if (val === null || val === undefined) return val;
        return getMainText(String(val)).toLowerCase().trim();
      };

      switch (condition.operator) {
        case 'equals':
          met = getComparisonValue(response) === getComparisonValue(condition.value);
          break;
        case 'not_equals':
          met = getComparisonValue(response) !== getComparisonValue(condition.value);
          break;
        case 'contains':
          met = getComparisonValue(response).includes(getComparisonValue(condition.value));
          break;
        case 'not_contains':
          met = !getComparisonValue(response).includes(getComparisonValue(condition.value));
          break;
        case 'greater_than':
          met = parseFloat(response) > parseFloat(condition.value);
          break;
        case 'less_than':
          met = parseFloat(response) < parseFloat(condition.value);
          break;
        case 'is_empty':
          met = !response || response === '';
          break;
        case 'is_not_empty':
          met = response && response !== '';
          break;
        case 'is_selected':
          if (Array.isArray(response)) {
            met = response.some(r => getComparisonValue(r) === getComparisonValue(condition.value));
          } else {
            met = getComparisonValue(response) === getComparisonValue(condition.value);
          }
          break;
        case 'is_not_selected':
          if (Array.isArray(response)) {
            met = !response.some(r => getComparisonValue(r) === getComparisonValue(condition.value));
          } else {
            met = getComparisonValue(response) !== getComparisonValue(condition.value);
          }
          break;
        default:
          met = false;
      }

      return { met, logic: condition.logic };
    });

    // Apply logic (AND/OR)
    if (results.length === 1) {
      return results[0].met;
    }

    let currentResult = results[0].met;
    for (let i = 1; i < results.length; i++) {
      const logic = results[i - 1].logic || 'AND';
      if (logic === 'AND') {
        currentResult = currentResult && results[i].met;
      } else {
        currentResult = currentResult || results[i].met;
      }
    }

    return currentResult;
  };

  // Update visible questions based on responses
  const updateVisibleQuestions = () => {
    const allQuestions = getAllQuestions();
    const newVisibleQuestions = new Set();

    allQuestions.forEach(question => {
      if (evaluateConditions(question)) {
        newVisibleQuestions.add(question.id);
      }
    });

    setVisibleQuestions(newVisibleQuestions);
  };

  // Handle response change
  const handleResponseChange = (questionId, value) => {
    const newResponses = {
      ...responses,
      [questionId]: value
    };
    setResponses(newResponses);
    
    // Update visible questions after a short delay to allow state to update
    setTimeout(() => {
      updateVisibleQuestions();
    }, 100);

    if (onResponseChange) {
      onResponseChange(newResponses);
    }
  };

  // Update visible questions when responses change
  useEffect(() => {
    updateVisibleQuestions();
  }, [responses]);

  // Render question based on type
  const renderQuestion = (question) => {
    const isVisible = visibleQuestions.has(question.id);
    if (!isVisible) return null;

    const handleChange = (value) => {
      handleResponseChange(question.id, value);
    };

    switch (question.type) {
      case 'multiple_choice':
        return (
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900">{question.text}</h3>
            {question.description && (
              <p className="text-gray-600">{question.description}</p>
            )}
            <div className="space-y-2">
              {question.options?.map((option, index) => (
                <label key={option.id || index} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type={question.settings?.allowMultiple ? 'checkbox' : 'radio'}
                    name={`question-${question.id}`}
                    value={option.value}
                    onChange={(e) => {
                      if (question.settings?.allowMultiple) {
                        const currentValues = responses[question.id] || [];
                        const newValues = e.target.checked
                          ? [...currentValues, option.value]
                          : currentValues.filter(v => v !== option.value);
                        handleChange(newValues);
                      } else {
                        handleChange(option.value);
                      }
                    }}
                    checked={
                      question.settings?.allowMultiple
                        ? (responses[question.id] || []).includes(option.value)
                        : responses[question.id] === option.value
                    }
                    className="w-4 h-4 text-[#373177] border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{option.text}</span>
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
              value={responses[question.id] || ''}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Your answer here..."
            />
            {question.required && (
              <p className="text-sm text-red-600">* Required</p>
            )}
          </div>
        );

      case 'rating':
        return (
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900">{question.text}</h3>
            {question.description && (
              <p className="text-gray-600">{question.description}</p>
            )}
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => handleChange(rating)}
                  className={`w-10 h-10 border rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 ${
                    responses[question.id] === rating
                      ? 'bg-[#001D48] text-white border-[#001D48]'
                      : 'border-gray-300'
                  }`}
                >
                  {rating}
                </button>
              ))}
            </div>
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
                  value="yes"
                  checked={responses[question.id] === 'yes'}
                  onChange={(e) => handleChange(e.target.value)}
                  className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
                />
                <span className="text-gray-700">Yes</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value="no"
                  checked={responses[question.id] === 'no'}
                  onChange={(e) => handleChange(e.target.value)}
                  className="w-4 h-4 text-[#373177] border-gray-300 focus:ring-blue-500"
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
              {question.type} question type not implemented
            </div>
          </div>
        );
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {survey.sections?.map((section, sectionIndex) => (
        <div key={section.id} className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
          {section.questions?.map((question, questionIndex) => (
            <div key={question.id} className="p-6 border border-gray-200 rounded-lg">
              {renderQuestion(question)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default SurveyResponse;


















