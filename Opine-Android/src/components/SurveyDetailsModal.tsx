import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Modal,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  Divider,
  Surface,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Survey } from '../types';

const { width, height } = Dimensions.get('window');

interface SurveyDetailsModalProps {
  visible: boolean;
  survey: Survey | null;
  onClose: () => void;
}

export default function SurveyDetailsModal({ visible, survey, onClose }: SurveyDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'specifications' | 'questionnaire'>('specifications');

  if (!survey) return null;

  // Helper function to get operator description
  const getOperatorDescription = (operator: string) => {
    switch (operator) {
      case 'equals': return 'is exactly';
      case 'not_equals': return 'is not';
      case 'contains': return 'contains';
      case 'not_contains': return 'does not contain';
      case 'greater_than': return 'is greater than';
      case 'less_than': return 'is less than';
      case 'is_empty': return 'is empty';
      case 'is_not_empty': return 'is not empty';
      case 'is_selected': return 'is selected';
      case 'is_not_selected': return 'is not selected';
      default: return operator;
    }
  };

  // Helper function to find question by ID
  const findQuestionById = (questionId: string) => {
    if (survey.sections) {
      for (const section of survey.sections) {
        if (section.questions) {
          for (const question of section.questions) {
            if ((question.id || question._id) === questionId) {
              return question;
            }
          }
        }
      }
    }
    if (survey.questions) {
      for (const question of survey.questions) {
        if ((question.id || question._id) === questionId) {
          return question;
        }
      }
    }
    return null;
  };

  // Helper function to format conditional logic
  const formatConditionalLogic = (conditions: any[]) => {
    if (!conditions || conditions.length === 0) return '';
    
    return conditions.map((condition, index) => {
      const question = findQuestionById(condition.questionId);
      const operator = getOperatorDescription(condition.operator);
      const value = condition.value;
      
      let conditionText = '';
      if (question) {
        conditionText = `"${question.text}" ${operator} "${value}"`;
      } else {
        conditionText = `Question ${condition.questionId} ${operator} "${value}"`;
      }
      
      if (index > 0) {
        const logic = condition.logic || 'AND';
        conditionText = ` ${logic} ${conditionText}`;
      }
      
      return conditionText;
    }).join('');
  };

  // Helper function to format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString();
  };

  // Helper function to format date time
  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleString();
  };

  // Helper function to get days remaining
  const getDaysRemaining = (deadline?: string) => {
    if (!deadline) return 'Not specified';
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? `${diffDays} days` : 'Expired';
  };

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'draft': return '#f59e0b';
      case 'completed': return '#3b82f6';
      case 'archived': return '#6b7280';
      default: return '#6b7280';
    }
  };

  // Helper function to get mode color
  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'capi': return '#3b82f6';
      case 'cati': return '#8b5cf6';
      case 'online': return '#10b981';
      default: return '#6b7280';
    }
  };

  // Helper function to get mode label
  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'capi': return 'CAPI';
      case 'cati': return 'CATI';
      case 'online': return 'Online';
      default: return mode.toUpperCase();
    }
  };

  const renderSpecificationsTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Overview Cards */}
      <View style={styles.overviewCards}>
        <Card style={styles.overviewCard}>
          <Card.Content style={styles.overviewCardContent}>
            <View style={styles.overviewIcon}>
              <Ionicons name="calendar" size={20} color="#3b82f6" />
            </View>
            <View style={styles.overviewText}>
              <Text style={styles.overviewLabel}>Start Date</Text>
              <Text style={styles.overviewValue}>{formatDate(survey.startDate || '')}</Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.overviewCard}>
          <Card.Content style={styles.overviewCardContent}>
            <View style={styles.overviewIcon}>
              <Ionicons name="time" size={20} color="#ef4444" />
            </View>
            <View style={styles.overviewText}>
              <Text style={styles.overviewLabel}>Deadline</Text>
              <Text style={styles.overviewValue}>{formatDate(survey.deadline || '')}</Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.overviewCard}>
          <Card.Content style={styles.overviewCardContent}>
            <View style={styles.overviewIcon}>
              <Ionicons name="trending-up" size={20} color="#10b981" />
            </View>
            <View style={styles.overviewText}>
              <Text style={styles.overviewLabel}>Days Remaining</Text>
              <Text style={styles.overviewValue}>{getDaysRemaining(survey.deadline || '')}</Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.overviewCard}>
          <Card.Content style={styles.overviewCardContent}>
            <View style={styles.overviewIcon}>
              <Ionicons name="cash" size={20} color="#8b5cf6" />
            </View>
            <View style={styles.overviewText}>
              <Text style={styles.overviewLabel}>Cost per Interview</Text>
              <Text style={styles.overviewValue}>₹{survey.costPerInterview || 0}</Text>
            </View>
          </Card.Content>
        </Card>
      </View>

      {/* Description Section */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={20} color="#374151" />
            <Text style={styles.sectionTitle}>Survey Description</Text>
          </View>
          <Text style={styles.description}>{survey.description}</Text>
          {survey.purpose && (
            <View style={styles.purposeContainer}>
              <Text style={styles.purposeTitle}>Purpose</Text>
              <Text style={styles.purposeText}>{survey.purpose}</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Assignment Information */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={20} color="#374151" />
            <Text style={styles.sectionTitle}>Assignment Details</Text>
          </View>
          
          <View style={styles.assignmentInfo}>
            <View style={styles.assignmentItem}>
              <Text style={styles.assignmentLabel}>Assigned At</Text>
              <Text style={styles.assignmentValue}>{formatDateTime(survey.assignedAt || '')}</Text>
            </View>
            <View style={styles.assignmentItem}>
              <Text style={styles.assignmentLabel}>Assignment Status</Text>
              <Chip 
                style={[styles.statusChip, { backgroundColor: getStatusColor(survey.assignmentStatus || '') }]}
                textStyle={styles.statusChipText}
              >
                {survey.assignmentStatus}
              </Chip>
            </View>
            <View style={styles.assignmentItem}>
              <Text style={styles.assignmentLabel}>State</Text>
              <Text style={styles.assignmentValue}>{survey.selectedState || 'Not specified'}</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Assigned Areas */}
      {survey.assignedACs && survey.assignedACs.length > 0 && (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Ionicons name="location" size={20} color="#374151" />
              <Text style={styles.sectionTitle}>Assigned Areas</Text>
            </View>
            <View style={styles.acChipsContainer}>
              {survey.assignedACs.map((ac, index) => (
                <Chip key={index} style={styles.acChip}>
                  {ac}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Target Audience Requirements */}
      {survey.targetAudience && (
        <Card style={styles.sectionCard}>
          <Card.Content>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={20} color="#374151" />
            <Text style={styles.sectionTitle}>Target Audience Requirements</Text>
          </View>
            
            {/* Demographics */}
            {survey.targetAudience.demographics && (
              <View style={styles.targetingSection}>
                <Text style={styles.targetingSectionTitle}>Demographics</Text>
                
                {/* Age Group */}
                {survey.targetAudience.demographics['Age Group'] && survey.targetAudience.demographics.ageRange && (
                  <View style={styles.targetingItem}>
                    <Text style={styles.targetingLabel}>Age Range:</Text>
                    <Text style={styles.targetingValue}>
                      {survey.targetAudience.demographics.ageRange.min || 'Not specified'} - {survey.targetAudience.demographics.ageRange.max || 'Not specified'} years
                    </Text>
                  </View>
                )}
                
                {/* Gender Requirements */}
                {survey.targetAudience.demographics['Gender'] && survey.targetAudience.demographics.genderRequirements && (
                  <View style={styles.targetingItem}>
                    <Text style={styles.targetingLabel}>Gender:</Text>
                    <View style={styles.genderChips}>
                      {(() => {
                        const requirements = survey.targetAudience.demographics.genderRequirements;
                        const selectedGenders = Object.keys(requirements).filter(g => requirements[g] && !g.includes('Percentage'));
                        
                        return selectedGenders.map(gender => {
                          const percentage = requirements[`${gender}Percentage`];
                          const displayPercentage = selectedGenders.length === 1 && !percentage ? 100 : (percentage || 0);
                          return (
                            <Chip key={gender} style={styles.genderChip}>
                              {gender}: {displayPercentage}%
                            </Chip>
                          );
                        });
                      })()}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Geographic */}
            {survey.targetAudience.geographic && (
              (() => {
                const hasGeographicData = 
                  (survey.targetAudience.geographic['Country'] && survey.targetAudience.geographic.countryRequirements) ||
                  (survey.targetAudience.geographic['State/Province'] && survey.targetAudience.geographic.stateRequirements) ||
                  (survey.targetAudience.geographic['City'] && survey.targetAudience.geographic.cityRequirements);
                
                return hasGeographicData ? (
                  <View style={styles.targetingSection}>
                    <Text style={styles.targetingSectionTitle}>Geographic</Text>
                    {survey.targetAudience.geographic['Country'] && survey.targetAudience.geographic.countryRequirements && (
                      <View style={styles.targetingItem}>
                        <Text style={styles.targetingLabel}>Country:</Text>
                        <Text style={styles.targetingValue}>{survey.targetAudience.geographic.countryRequirements}</Text>
                      </View>
                    )}
                    {survey.targetAudience.geographic['State/Province'] && survey.targetAudience.geographic.stateRequirements && (
                      <View style={styles.targetingItem}>
                        <Text style={styles.targetingLabel}>State:</Text>
                        <Text style={styles.targetingValue}>{survey.targetAudience.geographic.stateRequirements}</Text>
                      </View>
                    )}
                    {survey.targetAudience.geographic['City'] && survey.targetAudience.geographic.cityRequirements && (
                      <View style={styles.targetingItem}>
                        <Text style={styles.targetingLabel}>City:</Text>
                        <Text style={styles.targetingValue}>{survey.targetAudience.geographic.cityRequirements}</Text>
                      </View>
                    )}
                  </View>
                ) : null;
              })()
            )}
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );

  const renderQuestionnaireTab = () => (
    <ScrollView style={styles.tabContent}>
      {survey.sections && survey.sections.length > 0 ? (
        survey.sections.map((section, sectionIndex) => (
          <Card key={section.id || sectionIndex} style={styles.sectionCard}>
            <Card.Content>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionNumber}>
                  <Text style={styles.sectionNumberText}>{sectionIndex + 1}</Text>
                </View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              {section.description && (
                <Text style={styles.sectionDescription}>{section.description}</Text>
              )}
              
              <View style={styles.questionsContainer}>
                {section.questions && section.questions.map((question, questionIndex) => (
                  <View key={question.id || questionIndex} style={styles.questionCard}>
                    <View style={styles.questionHeader}>
                      <View style={styles.questionNumber}>
                        <Text style={styles.questionNumberText}>{questionIndex + 1}</Text>
                      </View>
                      <View style={styles.questionContent}>
                        <Text style={styles.questionTitle}>
                          {question.text}
                          {question.required && <Text style={styles.required}> *</Text>}
                        </Text>
                        
                        {/* Question Tags - moved below question */}
                        <View style={styles.questionTagsContainer}>
                          {question.conditions && question.conditions.length > 0 && (
                            <Chip style={styles.conditionalChip} textStyle={styles.conditionalChipText}>
                              Conditional
                            </Chip>
                          )}
                          <Chip style={styles.typeChip} textStyle={styles.typeChipText}>
                            {question.type.replace('_', ' ')}
                          </Chip>
                        </View>
                        
                        {question.description && (
                          <Text style={styles.questionDescription}>{question.description}</Text>
                        )}
                        
                        {/* Conditional Logic Display */}
                        {question.conditions && question.conditions.length > 0 && (
                          <View style={styles.conditionalLogic}>
                            <View style={styles.conditionalLogicHeader}>
                              <Ionicons name="flash" size={16} color="#f59e0b" />
                              <Text style={styles.conditionalLogicTitle}>Conditional Logic:</Text>
                            </View>
                            <Text style={styles.conditionalLogicText}>
                              This question will only appear when: {formatConditionalLogic(question.conditions)}
                            </Text>
                          </View>
                        )}
                        
                        {/* Options for multiple choice questions */}
                        {question.options && question.options.length > 0 && (
                          <View style={styles.optionsContainer}>
                            <Text style={styles.optionsTitle}>Answer Options:</Text>
                            <View style={styles.optionsGrid}>
                              {question.options.map((option, optionIndex) => (
                                <View key={typeof option === 'string' ? optionIndex : (option.id || optionIndex)} style={styles.optionItem}>
                                  <View style={styles.optionLetter}>
                                    <Text style={styles.optionLetterText}>
                                      {String.fromCharCode(65 + optionIndex)}
                                    </Text>
                                  </View>
                                  <Text style={styles.optionText}>
                                    {typeof option === 'string' ? option : (option.text || option.value || String(option))}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                        
                        {/* Scale for rating questions */}
                        {question.scale && (
                          <View style={styles.scaleContainer}>
                            <Text style={styles.scaleTitle}>Rating Scale:</Text>
                            <View style={styles.scaleBar}>
                              <Text style={styles.scaleMin}>{question.scale.min}</Text>
                              <View style={styles.scaleTrack}>
                                <View style={styles.scaleFill} />
                              </View>
                              <Text style={styles.scaleMax}>{question.scale.max}</Text>
                            </View>
                            {question.scale.minLabel && question.scale.maxLabel && (
                              <View style={styles.scaleLabels}>
                                <Text style={styles.scaleLabel}>{question.scale.minLabel}</Text>
                                <Text style={styles.scaleLabel}>{question.scale.maxLabel}</Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </Card.Content>
          </Card>
        ))
      ) : survey.questions && survey.questions.length > 0 ? (
        <View style={styles.questionsContainer}>
          {survey.questions.map((question, questionIndex) => (
            <Card key={question.id || questionIndex} style={styles.questionCard}>
              <Card.Content>
                <View style={styles.questionHeader}>
                  <View style={styles.questionNumber}>
                    <Text style={styles.questionNumberText}>{questionIndex + 1}</Text>
                  </View>
                  <View style={styles.questionContent}>
                    <Text style={styles.questionTitle}>
                      {question.text}
                      {question.required && <Text style={styles.required}> *</Text>}
                    </Text>
                    
                    {/* Question Tags - moved below question */}
                    <View style={styles.questionTagsContainer}>
                      {question.conditions && question.conditions.length > 0 && (
                        <Chip style={styles.conditionalChip} textStyle={styles.conditionalChipText}>
                          Conditional
                        </Chip>
                      )}
                      <Chip style={styles.typeChip} textStyle={styles.typeChipText}>
                        {question.type.replace('_', ' ')}
                      </Chip>
                    </View>
                    
                    {question.description && (
                      <Text style={styles.questionDescription}>{question.description}</Text>
                    )}
                    
                    {/* Conditional Logic Display */}
                    {question.conditions && question.conditions.length > 0 && (
                      <View style={styles.conditionalLogic}>
                        <View style={styles.conditionalLogicHeader}>
                          <Ionicons name="flash" size={16} color="#f59e0b" />
                          <Text style={styles.conditionalLogicTitle}>Conditional Logic:</Text>
                        </View>
                        <Text style={styles.conditionalLogicText}>
                          This question will only appear when: {formatConditionalLogic(question.conditions)}
                        </Text>
                      </View>
                    )}
                    
                    {/* Options for multiple choice questions */}
                    {question.options && question.options.length > 0 && (
                      <View style={styles.optionsContainer}>
                        <Text style={styles.optionsTitle}>Answer Options:</Text>
                        <View style={styles.optionsGrid}>
                              {question.options.map((option, optionIndex) => (
                                <View key={typeof option === 'string' ? optionIndex : (option.id || optionIndex)} style={styles.optionItem}>
                                  <View style={styles.optionLetter}>
                                    <Text style={styles.optionLetterText}>
                                      {String.fromCharCode(65 + optionIndex)}
                                    </Text>
                                  </View>
                                  <Text style={styles.optionText}>
                                    {typeof option === 'string' ? option : (option.text || option.value || String(option))}
                                  </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      ) : (
        <Card style={styles.emptyCard}>
          <Card.Content style={styles.emptyContent}>
            <View style={styles.emptyIcon}>
              <Ionicons name="document-text" size={40} color="#9ca3af" />
            </View>
            <Text style={styles.emptyTitle}>No Questions Available</Text>
            <Text style={styles.emptyText}>
              This survey doesn't have any questions configured yet. Please contact the survey administrator for more information.
            </Text>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerInfo}>
              <Text style={styles.surveyTitle}>{survey.surveyName}</Text>
              <View style={styles.headerBadges}>
                <Chip 
                  style={[styles.statusChip, { backgroundColor: getStatusColor(survey.status) }]}
                  textStyle={styles.statusChipText}
                >
                  {survey.status.charAt(0).toUpperCase() + survey.status.slice(1)}
                </Chip>
                <Chip 
                  style={[styles.modeChip, { backgroundColor: getModeColor(survey.mode) }]}
                  textStyle={styles.modeChipText}
                >
                  {getModeLabel(survey.mode)}
                </Chip>
              </View>
              <View style={styles.headerMeta}>
                <View style={styles.headerMetaItem}>
                  <Ionicons name="folder" size={16} color="#6b7280" />
                  <Text style={styles.headerMetaText}>{survey.category}</Text>
                </View>
                <View style={styles.headerMetaItem}>
                  <Ionicons name="people" size={16} color="#6b7280" />
                  <Text style={styles.headerMetaText}>{survey.sampleSize?.toLocaleString() || 0} samples</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'specifications' && styles.activeTab]}
            onPress={() => setActiveTab('specifications')}
          >
            <Ionicons 
              name="bar-chart" 
              size={16} 
              color={activeTab === 'specifications' ? '#3b82f6' : '#6b7280'} 
            />
            <Text style={[
              styles.tabText, 
              activeTab === 'specifications' && styles.activeTabText
            ]}>
              Survey Details
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'questionnaire' && styles.activeTab]}
            onPress={() => setActiveTab('questionnaire')}
          >
            <Ionicons 
              name="document-text" 
              size={16} 
              color={activeTab === 'questionnaire' ? '#3b82f6' : '#6b7280'} 
            />
            <Text style={[
              styles.tabText, 
              activeTab === 'questionnaire' && styles.activeTabText
            ]}>
              Questionnaire
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === 'specifications' && renderSpecificationsTab()}
        {activeTab === 'questionnaire' && renderQuestionnaireTab()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingTop: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerInfo: {
    flex: 1,
  },
  surveyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  headerBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statusChip: {
    height: 28,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  modeChip: {
    height: 28,
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  headerMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerMetaText: {
    fontSize: 14,
    color: '#6b7280',
  },
  closeButton: {
    padding: 8,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#eff6ff',
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#3b82f6',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  overviewCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  overviewCard: {
    width: (width - 48) / 2,
    elevation: 2,
  },
  overviewCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  overviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  overviewText: {
    flex: 1,
  },
  overviewLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  overviewValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  sectionCard: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  sectionNumber: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  purposeContainer: {
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    marginTop: 16,
  },
  purposeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  purposeText: {
    fontSize: 14,
    color: '#1e40af',
  },
  assignmentInfo: {
    gap: 8,
  },
  assignmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  assignmentLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  assignmentValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  acChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  acChip: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  targetingSection: {
    marginBottom: 16,
  },
  targetingSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  targetingItem: {
    marginBottom: 8,
  },
  targetingLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  targetingValue: {
    fontSize: 12,
    color: '#374151',
  },
  genderChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  genderChip: {
    backgroundColor: '#f3e8ff',
    borderColor: '#c084fc',
  },
  questionsContainer: {
    gap: 12,
  },
  questionCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 12,
  },
  questionHeader: {
    flexDirection: 'row',
    padding: 16,
  },
  questionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  questionNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  questionContent: {
    flex: 1,
  },
  questionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 20,
  },
  required: {
    color: '#ef4444',
  },
  questionTagsContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  conditionalChip: {
    backgroundColor: '#fef3c7',
    height: 28,
    borderRadius: 14,
  },
  conditionalChipText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '500',
  },
  typeChip: {
    backgroundColor: '#f3f4f6',
    height: 28,
    borderRadius: 14,
  },
  typeChipText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '500',
  },
  questionDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 16,
  },
  conditionalLogic: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fbbf24',
    marginBottom: 12,
  },
  conditionalLogicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  conditionalLogicTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  conditionalLogicText: {
    fontSize: 11,
    color: '#92400e',
    lineHeight: 14,
  },
  optionsContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 6,
  },
  optionsTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  optionsGrid: {
    gap: 6,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  optionLetter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetterText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3b82f6',
  },
  optionText: {
    fontSize: 12,
    color: '#374151',
    flex: 1,
  },
  scaleContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 6,
  },
  scaleTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  scaleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scaleMin: {
    fontSize: 12,
    color: '#6b7280',
  },
  scaleTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
  },
  scaleFill: {
    height: 4,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
    width: '100%',
  },
  scaleMax: {
    fontSize: 12,
    color: '#6b7280',
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  scaleLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  emptyCard: {
    elevation: 1,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
});
