import React, { useState, useEffect } from 'react';

const ConditionalQuestionDisplay = ({ 
  question, 
  allQuestions, 
  responses, 
  onResponseChange 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [evaluatedConditions, setEvaluatedConditions] = useState([]);

  // Evaluate if conditions are met
  const evaluateConditions = () => {
    if (!question.conditions || question.conditions.length === 0) {
      return { visible: true, conditions: [] };
    }

    const results = question.conditions.map(condition => {
      const targetQuestion = allQuestions.find(q => q.id === condition.questionId);
      if (!targetQuestion) return { met: false, condition };

      const response = responses[condition.questionId];
      if (!response) return { met: false, condition };

      let met = false;

      switch (condition.operator) {
        case 'equals':
          met = response === condition.value;
          break;
        case 'not_equals':
          met = response !== condition.value;
          break;
        case 'contains':
          met = String(response).toLowerCase().includes(condition.value.toLowerCase());
          break;
        case 'not_contains':
          met = !String(response).toLowerCase().includes(condition.value.toLowerCase());
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
            met = response.includes(condition.value);
          } else {
            met = response === condition.value;
          }
          break;
        case 'is_not_selected':
          if (Array.isArray(response)) {
            met = !response.includes(condition.value);
          } else {
            met = response !== condition.value;
          }
          break;
        default:
          met = false;
      }

      return { met, condition };
    });

    // Apply logic (AND/OR)
    let visible = false;
    if (results.length === 1) {
      visible = results[0].met;
    } else if (results.length > 1) {
      // Check if all conditions use AND logic
      const allAnd = results.every((_, index) => 
        index === 0 || question.conditions[index - 1].logic === 'AND'
      );
      
      if (allAnd) {
        visible = results.every(result => result.met);
      } else {
        // Mixed logic - evaluate step by step
        let currentResult = results[0].met;
        for (let i = 1; i < results.length; i++) {
          const logic = question.conditions[i - 1].logic;
          if (logic === 'AND') {
            currentResult = currentResult && results[i].met;
          } else {
            currentResult = currentResult || results[i].met;
          }
        }
        visible = currentResult;
      }
    }

    return { visible, conditions: results };
  };

  useEffect(() => {
    const evaluation = evaluateConditions();
    setIsVisible(evaluation.visible);
    setEvaluatedConditions(evaluation.conditions);
  }, [question.conditions, responses]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="conditional-question">
      {/* Question content will be rendered by parent component */}
    </div>
  );
};

export default ConditionalQuestionDisplay;


















