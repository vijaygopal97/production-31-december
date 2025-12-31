import React, { useState } from 'react';
import { 
  ArrowRight, 
  ArrowLeft,
  FileText,
  Plus,
  Search,
  Filter,
  Star,
  Users,
  Clock,
  CheckCircle,
  Eye,
  Download,
  Sparkles
} from 'lucide-react';

const SurveyTemplateSuggestions = ({ onUpdate, initialData, specifications }) => {
  const [selectedTemplate, setSelectedTemplate] = useState(initialData || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showCreateFromScratch, setShowCreateFromScratch] = useState(false);

  // Mock template data - in real app, this would come from API based on specifications
  const templates = [
    {
      id: 1,
      name: 'Consumer Preferences Survey',
      description: 'Comprehensive survey to understand consumer preferences and buying behavior',
      category: 'Consumer Research',
      questions: 15,
      estimatedTime: '8-12 minutes',
      rating: 4.8,
      usageCount: 1247,
      tags: ['preferences', 'buying behavior', 'demographics'],
      isRecommended: true,
      preview: [
        'What is your age group?',
        'How often do you purchase this type of product?',
        'What factors influence your purchase decision?',
        'Rate your satisfaction with current products'
      ]
    },
    {
      id: 2,
      name: 'Brand Awareness Study',
      description: 'Measure brand recognition, recall, and perception in the market',
      category: 'Brand Research',
      questions: 12,
      estimatedTime: '6-10 minutes',
      rating: 4.6,
      usageCount: 892,
      tags: ['brand awareness', 'recognition', 'perception'],
      isRecommended: false,
      preview: [
        'Which brands come to mind when you think of [category]?',
        'How familiar are you with [brand name]?',
        'What words do you associate with [brand name]?',
        'How likely are you to recommend [brand name]?'
      ]
    },
    {
      id: 3,
      name: 'Customer Satisfaction Survey',
      description: 'Comprehensive customer satisfaction and experience measurement',
      category: 'Customer Research',
      questions: 18,
      estimatedTime: '10-15 minutes',
      rating: 4.9,
      usageCount: 2156,
      tags: ['satisfaction', 'experience', 'service quality'],
      isRecommended: true,
      preview: [
        'How satisfied are you with our service?',
        'How likely are you to recommend us?',
        'What could we improve?',
        'Rate your overall experience'
      ]
    },
    {
      id: 4,
      name: 'Product Testing Survey',
      description: 'Test new products and gather feedback on features and usability',
      category: 'Product Research',
      questions: 20,
      estimatedTime: '12-18 minutes',
      rating: 4.7,
      usageCount: 743,
      tags: ['product testing', 'usability', 'features'],
      isRecommended: false,
      preview: [
        'How easy was it to use this product?',
        'What features did you like most?',
        'What would you change?',
        'How likely are you to purchase?'
      ]
    }
  ];

  const categories = [
    'All Categories',
    'Consumer Research',
    'Brand Research',
    'Customer Research',
    'Product Research',
    'Market Analysis',
    'Healthcare Research',
    'Education Research'
  ];

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = !filterCategory || template.category === filterCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
  };


  const getRatingColor = (rating) => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 4.0) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Survey Template Suggestions</h2>
          <p className="text-lg text-gray-600">
            Choose from our curated templates or create your survey from scratch
          </p>
        </div>

        {/* AI Recommendations */}
        {specifications && (
          <div className="bg-gradient-to-r from-[#E6F0F8] to-purple-50 rounded-xl p-6 mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <Sparkles className="w-6 h-6 text-[#001D48]" />
              <h3 className="text-lg font-semibold text-gray-900">AI Recommendations</h3>
            </div>
            <p className="text-gray-700 mb-4">
              Based on your survey specifications, we recommend these templates that match your research objectives.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                {specifications.category}
              </span>
              <span className="px-3 py-1 bg-[#E8E6F5] text-purple-700 rounded-full text-sm">
                {specifications.sampleSize} responses
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                {specifications.purpose?.substring(0, 30)}...
              </span>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {categories.map(category => (
                  <option key={category} value={category === 'All Categories' ? '' : category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setShowCreateFromScratch(!showCreateFromScratch)}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  showCreateFromScratch 
                    ? 'bg-[#001D48] text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Create from Scratch</span>
              </button>
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredTemplates.map((template) => {
            const isSelected = selectedTemplate?.id === template.id;
            
            return (
              <div
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className={`cursor-pointer transition-all duration-200 ${
                  isSelected 
                    ? 'ring-2 ring-blue-500 bg-[#E6F0F8]' 
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 h-full">
                  {/* Template Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                        {template.isRecommended && (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        {template.category}
                      </span>
                    </div>
                    {isSelected && (
                      <CheckCircle className="w-6 h-6 text-[#001D48]" />
                    )}
                  </div>

                  {/* Template Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">{template.questions}</div>
                      <p className="text-xs text-gray-600">Questions</p>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">{template.estimatedTime}</div>
                      <p className="text-xs text-gray-600">Duration</p>
                    </div>
                  </div>

                  {/* Rating and Usage */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className={`text-sm font-medium ${getRatingColor(template.rating)}`}>
                        {template.rating}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>{template.usageCount} uses</span>
                    </div>
                  </div>

                  {/* Preview Questions */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Preview Questions:</h4>
                    <ul className="space-y-1">
                      {template.preview.slice(0, 3).map((question, index) => (
                        <li key={index} className="text-xs text-gray-600 flex items-start space-x-2">
                          <span className="text-gray-400">•</span>
                          <span>{question}</span>
                        </li>
                      ))}
                      {template.preview.length > 3 && (
                        <li className="text-xs text-gray-500">... and {template.preview.length - 3} more</li>
                      )}
                    </ul>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {template.tags.slice(0, 3).map((tag, index) => (
                      <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Preview template
                      }}
                      className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-sm text-[#001D48] border border-blue-200 rounded-lg hover:bg-[#E6F0F8] transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Preview</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Import template
                      }}
                      className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-sm bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Import</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* No Results */}
        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-600">Try adjusting your search criteria or create from scratch</p>
          </div>
        )}

        {/* Create from Scratch Option */}
        {showCreateFromScratch && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <Plus className="w-6 h-6 text-[#373177]" />
              <h3 className="text-lg font-semibold text-gray-900">Create from Scratch</h3>
            </div>
            <p className="text-gray-700 mb-4">
              Start with a blank canvas and build your survey questions step by step. 
              You'll have full control over question types, logic, and flow.
            </p>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Full customization</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Advanced logic</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Save as template</span>
              </div>
            </div>
          </div>
        )}

        {/* Selection Summary */}
        {(selectedTemplate || showCreateFromScratch) && (
          <div className="bg-[#E6F0F8] rounded-xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Selected Option</h3>
            {selectedTemplate ? (
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-[#001D48] rounded-lg flex items-center justify-center text-white font-bold">
                  {selectedTemplate.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{selectedTemplate.name}</h4>
                  <p className="text-sm text-gray-600">{selectedTemplate.description}</p>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                    <span>{selectedTemplate.questions} questions</span>
                    <span>•</span>
                    <span>{selectedTemplate.estimatedTime}</span>
                    <span>•</span>
                    <span>Rating: {selectedTemplate.rating}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-[#373177] rounded-lg flex items-center justify-center text-white">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Create from Scratch</h4>
                  <p className="text-sm text-gray-600">Build your survey from the ground up with full customization</p>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default SurveyTemplateSuggestions;




