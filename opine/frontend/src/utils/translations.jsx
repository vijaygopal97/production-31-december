import React from 'react';

/**
 * Translation utility functions
 * Handles parsing and displaying translations in formats:
 * - Single: "Main Text {Translation}"
 * - Multiple: "Main Text {Translation1{Translation2{Translation3}}}"
 */

/**
 * Parse text with nested translation format: "Main Text {Translation1{Translation2{Translation3}}}"
 * Returns an array of languages extracted from nested braces
 * @param {string} text - Text that may contain nested translations in curly braces
 * @returns {Array<string>} - Array of language texts, first is main text
 */
export const parseMultiTranslation = (text) => {
  // Handle null, undefined, or non-string values
  if (!text) {
    return [''];
  }
  
  if (typeof text !== 'string') {
    // Convert to string if it's not already
    try {
      text = String(text);
    } catch (error) {
      return [''];
    }
  }

  // Handle empty string
  if (text.trim().length === 0) {
    return [''];
  }

  const languages = [];
  let remaining = text.trim();
  
  // Recursively extract languages from nested braces
  while (remaining.length > 0) {
    // Find the first opening brace
    const openBraceIndex = remaining.indexOf('{');
    
    if (openBraceIndex === -1) {
      // No more braces, add remaining text as a language
      if (remaining.trim()) {
        languages.push(remaining.trim());
      }
      break;
    }
    
    // Extract text before the brace as a language
    const beforeBrace = remaining.substring(0, openBraceIndex).trim();
    if (beforeBrace) {
      languages.push(beforeBrace);
    }
    
    // Find matching closing brace (handle nested braces)
    let braceCount = 0;
    let closeBraceIndex = -1;
    
    for (let i = openBraceIndex; i < remaining.length; i++) {
      if (remaining[i] === '{') {
        braceCount++;
      } else if (remaining[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          closeBraceIndex = i;
          break;
        }
      }
    }
    
    if (closeBraceIndex === -1) {
      // No matching closing brace, treat rest as text
      const restText = remaining.substring(openBraceIndex + 1).trim();
      if (restText) {
        languages.push(restText);
      }
      break;
    }
    
    // Extract content inside braces (may contain nested translations)
    const insideBraces = remaining.substring(openBraceIndex + 1, closeBraceIndex);
    
    // Recursively parse nested translations
    const nestedLanguages = parseMultiTranslation(insideBraces);
    if (nestedLanguages && Array.isArray(nestedLanguages) && nestedLanguages.length > 0) {
      languages.push(...nestedLanguages);
    }
    
    // Continue with text after closing brace
    remaining = remaining.substring(closeBraceIndex + 1).trim();
  }
  
  // If no languages found, return original text
  if (languages.length === 0) {
    return [text.trim()];
  }
  
  return languages;
};

/**
 * Parse text with translation format: "Main Text {Translation}"
 * Returns an object with mainText and translation (for backward compatibility)
 * @param {string} text - Text that may contain translation in curly braces
 * @returns {object} - { mainText: string, translation: string|null }
 */
export const parseTranslation = (text) => {
  const languages = parseMultiTranslation(text);

  return {
    mainText: languages[0] || '',
    translation: languages.length > 1 ? languages[1] : null
  };
};

/**
 * Get main text without translation (for CSV exports, conditional logic, etc.)
 * Always returns the first language (main text)
 * @param {string} text - Text that may contain translation
 * @returns {string} - Main text without translation
 */
export const getMainText = (text) => {
  const languages = parseMultiTranslation(text);
  return languages[0] || '';
};

/**
 * Get text for a specific language index
 * @param {string} text - Text that may contain multiple translations
 * @param {number} languageIndex - Index of language (0 = main, 1 = first translation, etc.)
 * @returns {string} - Text for the specified language, or main text if index out of range
 */
export const getLanguageText = (text, languageIndex = 0) => {
  try {
    if (languageIndex < 0) {
      languageIndex = 0;
    }
    const languages = parseMultiTranslation(text);
    if (languages && Array.isArray(languages) && languages.length > 0) {
      if (languageIndex >= 0 && languageIndex < languages.length) {
        return languages[languageIndex] || '';
      }
      return languages[0] || '';
    }
    return '';
  } catch (error) {
    console.warn('Error getting language text:', error);
    return text || '';
  }
};

/**
 * Render text with translation for display
 * Returns JSX element showing main text and translation if available
 * @param {string} text - Text that may contain translation
 * @param {object} options - Display options
 * @param {string} options.translationClass - CSS class for translation text
 * @param {string} options.mainClass - CSS class for main text
 * @param {string} options.separator - Separator between main and translation
 * @returns {JSX.Element} - React element
 */
export const renderWithTranslation = (text, options = {}) => {
  const {
    translationClass = 'text-sm text-gray-500 italic',
    mainClass = '',
    separator = ' / '
  } = options;

  const { mainText, translation } = parseTranslation(text);

  if (!translation) {
    return <span className={mainClass}>{mainText}</span>;
  }

  return (
    <span className={mainClass}>
      <span>{mainText}</span>
      <span className={translationClass}>
        {separator}{translation}
      </span>
    </span>
  );
};

/**
 * Render text with translation in a professional format (for modals)
 * Shows main text on one line and translation below in smaller, italic text
 * @param {string} text - Text that may contain translation
 * @param {object} options - Display options
 * @returns {JSX.Element} - React element
 */
export const renderWithTranslationProfessional = (text, options = {}) => {
  const {
    mainClass = 'text-base font-medium text-gray-900',
    translationClass = 'text-sm text-gray-500 italic mt-1 block'
  } = options;

  const { mainText, translation } = parseTranslation(text);

  if (!translation) {
    return <span className={mainClass}>{mainText}</span>;
  }

  return (
    <div>
      <div className={mainClass}>{mainText}</div>
      <div className={translationClass}>{translation}</div>
    </div>
  );
};

/**
 * Parse array of options/items that may contain translations
 * @param {Array} items - Array of strings or objects with text property
 * @returns {Array} - Array with parsed translations
 */
export const parseTranslationsArray = (items) => {
  if (!Array.isArray(items)) return [];

  return items.map(item => {
    if (typeof item === 'string') {
      return parseTranslation(item);
    } else if (typeof item === 'object' && item !== null) {
      const text = item.text || item.value || item.label || '';
      const parsed = parseTranslation(text);
      return {
        ...item,
        mainText: parsed.mainText,
        translation: parsed.translation,
        originalText: text
      };
    }
    return item;
  });
};

