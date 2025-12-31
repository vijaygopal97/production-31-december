# Multi-Language Support Implementation Analysis

## Current Implementation

### Current Format
- **Single Translation**: `"Main Text {Translation}"`
- **Example**: `"What is your name? {আপনার নাম কি?}"`

### Current Behavior
- Toggle button switches between:
  - **OFF**: Shows only main text (English)
  - **ON**: Shows only translation (Bengali)
- Uses `parseTranslation()` function with regex: `/^(.+?)\s*\{([^}]+)\}\s*$/`

---

## Proposed Format

### New Format
- **Multiple Translations**: `"Main Text {Translation1{Translation2{Translation3}}}"`
- **Example**: `"What is your name? {আপনার নাম কি?{आपका नाम क्या है?{আপনার নাম কি?}}}"`

### Proposed Behavior
- Dropdown selector with options:
  - Language 1 (Main Text)
  - Language 2 (Translation 1)
  - Language 3 (Translation 2)
  - Language 4 (Translation 3)
  - etc.

---

## Files That Need Changes

### 1. Translation Utility Functions

#### Frontend: `/var/www/opine/frontend/src/utils/translations.jsx`
**Current Functions:**
- `parseTranslation(text)` - Returns `{ mainText, translation }`
- `getMainText(text)` - Returns main text only
- `renderWithTranslation(text, options)` - Renders with translation

**Changes Needed:**
- Update `parseTranslation()` to parse nested translations recursively
- Add `parseMultiTranslation(text)` - Returns `{ languages: ['Main', 'Lang1', 'Lang2', ...] }`
- Add `getLanguageText(text, languageIndex)` - Returns text for specific language index
- Update `getMainText()` to still work (returns first language)

#### React Native: `/var/www/Opine-Android/src/utils/translations.ts`
**Same changes as frontend**

#### Backend: Multiple files use `getMainText()` helper
**Files:**
- `/var/www/opine/backend/utils/autoRejectionHelper.js`
- `/var/www/opine/backend/utils/genderUtils.js`
- `/var/www/opine/backend/controllers/surveyResponseController.js`

**Changes Needed:**
- Keep `getMainText()` working (should still return first language)
- No changes needed if we maintain backward compatibility

---

### 2. Interview Interface Components

#### Frontend: `/var/www/opine/frontend/src/components/dashboard/InterviewInterface.jsx`

**Current State:**
- `showTranslationOnly` (boolean) - Toggle state
- `getDisplayText(text)` - Returns main or translation based on toggle
- `renderDisplayText(text, options)` - Renders based on toggle

**Changes Needed:**
1. **Replace Toggle with Dropdown:**
   ```jsx
   // OLD:
   const [showTranslationOnly, setShowTranslationOnly] = useState(false);
   
   // NEW:
   const [selectedLanguageIndex, setSelectedLanguageIndex] = useState(0);
   ```

2. **Update Display Functions:**
   ```jsx
   // OLD:
   const getDisplayText = (text) => {
     const parsed = parseTranslation(text);
     return showTranslationOnly && parsed.translation 
       ? parsed.translation 
       : parsed.mainText;
   };
   
   // NEW:
   const getDisplayText = (text) => {
     const parsed = parseMultiTranslation(text);
     return parsed.languages[selectedLanguageIndex] || parsed.languages[0];
   };
   ```

3. **Add Language Dropdown UI:**
   - Replace toggle checkbox (line ~4536-4546)
   - Add dropdown with language options
   - Detect available languages from current question

4. **Update All Display Calls:**
   - `getDisplayText()` calls (used throughout component)
   - `renderDisplayText()` calls
   - Question text rendering
   - Option text rendering
   - Description text rendering

#### React Native: `/var/www/Opine-Android/src/screens/InterviewInterface.tsx`

**Current State:**
- `showTranslationOnly` (boolean) - Toggle state
- `getDisplayText(text)` - Returns main or translation
- Switch component for toggle (line ~6113-6117)

**Changes Needed:**
1. **Replace Switch with Dropdown:**
   ```tsx
   // OLD:
   const [showTranslationOnly, setShowTranslationOnly] = useState(false);
   
   // NEW:
   const [selectedLanguageIndex, setSelectedLanguageIndex] = useState(0);
   ```

2. **Update Display Functions:**
   - Same as frontend

3. **Add Language Picker UI:**
   - Use React Native `Picker` or custom dropdown
   - Replace Switch component

---

### 3. Conditional Logic (CRITICAL - Needs Careful Review)

#### Files Using Translations for Comparisons:

1. **Frontend: `/var/www/opine/frontend/src/components/dashboard/InterviewInterface.jsx`**
   - Line ~1660-1681: `evaluateConditions()` function
   - Uses `getMainText()` for option comparisons
   - **Impact**: LOW - Already uses `getMainText()` which strips all translations

2. **Frontend: `/var/www/opine/frontend/src/components/dashboard/SurveyResponse.jsx`**
   - Line ~40-51: Conditional evaluation
   - Uses `getMainText()` for comparisons
   - **Impact**: LOW - Already strips translations

3. **Frontend: `/var/www/opine/frontend/src/components/dashboard/MyInterviews.jsx`**
   - Line ~693-696: Conditional evaluation
   - Uses `getMainText()` for comparisons
   - **Impact**: LOW - Already strips translations

4. **Frontend: `/var/www/opine/frontend/src/components/dashboard/SurveyApprovals.jsx`**
   - Line ~1249-1275: Conditional evaluation
   - Uses `getMainText()` for comparisons
   - **Impact**: LOW - Already strips translations

5. **React Native: `/var/www/Opine-Android/src/screens/InterviewInterface.tsx`**
   - Line ~822-849: Conditional evaluation
   - Uses `getMainText()` for comparisons
   - **Impact**: LOW - Already strips translations

6. **Backend: `/var/www/opine/backend/utils/autoRejectionHelper.js`**
   - Uses `getMainText()` helper
   - **Impact**: LOW - Already strips translations

7. **Backend: `/var/www/opine/backend/utils/genderUtils.js`**
   - Uses `getMainText()` helper
   - **Impact**: LOW - Already strips translations

**Conclusion**: ✅ **Conditional logic is SAFE** - All comparisons use `getMainText()` which strips translations, so multi-language support won't break conditionals.

---

### 4. Other Components Using Translations

#### Files That Display Translations:

1. **`/var/www/opine/frontend/src/components/dashboard/ResponseDetailsModal.jsx`**
   - Uses `getMainText()` for display
   - **Changes**: Update to use new multi-language parser

2. **`/var/www/opine/frontend/src/components/dashboard/SurveyApprovals.jsx`**
   - Uses `getMainText()` for verification
   - **Changes**: Update to use new multi-language parser

3. **`/var/www/opine/frontend/src/pages/ViewResponsesPage.jsx`**
   - Uses `getMainText()` for display
   - **Changes**: Update to use new multi-language parser

4. **`/var/www/opine/frontend/src/pages/SurveyReportsPage.jsx`**
   - Uses `getMainText()` for display
   - **Changes**: Update to use new multi-language parser

5. **`/var/www/Opine-Android/src/components/ResponseDetailsModal.tsx`**
   - Uses `getMainText()` for display
   - **Changes**: Update to use new multi-language parser

---

## Implementation Plan

### Phase 1: Core Translation Parser
1. Update `parseTranslation()` to handle nested translations
2. Add `parseMultiTranslation()` function
3. Add `getLanguageText()` function
4. Maintain backward compatibility with `getMainText()`

### Phase 2: UI Components
1. Replace toggle with dropdown in Frontend
2. Replace switch with picker in React Native
3. Add language detection from current question
4. Update all display functions

### Phase 3: Testing
1. Test with single translation (backward compatibility)
2. Test with multiple translations
3. Test conditional logic still works
4. Test all display components

---

## Technical Considerations

### 1. Parsing Nested Translations

**Regex Pattern Needed:**
```javascript
// Current: /^(.+?)\s*\{([^}]+)\}\s*$/
// New: Recursive parsing for nested braces

function parseMultiTranslation(text) {
  const languages = [];
  let current = text;
  
  while (current.includes('{')) {
    const match = current.match(/^(.+?)\s*\{([^}]+)\}\s*(.*)$/);
    if (match) {
      languages.push(match[1].trim());
      current = match[2] + match[3];
    } else {
      languages.push(current);
      break;
    }
  }
  
  if (languages.length === 0) languages.push(text);
  return { languages };
}
```

### 2. Language Detection

**Strategy:**
- Parse all questions/options in current survey
- Detect maximum number of languages available
- Show dropdown with available languages
- Default to Language 1 (main text)

### 3. Backward Compatibility

**Critical:**
- `getMainText()` must continue to return first language
- Existing conditional logic must continue working
- Single translation format `"Text {Translation}"` must still work

### 4. Performance

**Considerations:**
- Parsing happens on every render (consider memoization)
- Language detection should be cached per survey
- Dropdown should only re-render when language changes

---

## Estimated Impact

### Files to Modify: ~15-20 files
- **Core utilities**: 3 files (Frontend, React Native, Backend)
- **Interview interfaces**: 2 files (Frontend, React Native)
- **Display components**: 5-10 files
- **Conditional logic**: 0 files (already safe)

### Risk Level: **MEDIUM**
- ✅ Conditional logic is safe (uses `getMainText()`)
- ⚠️ UI changes required in multiple places
- ⚠️ Need thorough testing for backward compatibility
- ⚠️ Need to handle edge cases (missing translations, malformed format)

### Testing Required:
1. Single translation format (backward compatibility)
2. Multiple translation format (new feature)
3. Conditional logic (should work unchanged)
4. All display components
5. Edge cases (no translation, partial translations)

---

## Recommendations

1. **Start with Core Parser**: Implement and test `parseMultiTranslation()` first
2. **Maintain Backward Compatibility**: Ensure `getMainText()` continues working
3. **Gradual Rollout**: Update one component at a time
4. **Add Language Labels**: Allow naming languages (e.g., "English", "Bengali", "Hindi")
5. **Consider Configuration**: Allow admins to configure language names/order

---

## Questions to Consider

1. **Language Naming**: How should languages be identified? (Index-based vs. named)
2. **Default Language**: Should default be Language 1 or user preference?
3. **Language Persistence**: Should language selection persist across sessions?
4. **Missing Translations**: What to show if a question has fewer languages than selected?
5. **Survey Builder**: How to add/edit multiple translations in survey builder?

