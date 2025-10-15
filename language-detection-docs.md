# Language Detection Feature

## Overview
The language detection feature automatically identifies the language of user input and displays it in the chat interface. This helps users understand what language the AI assistant is processing their input in.

## Supported Languages
- English
- Arabic
- Kurdish (Sorani)

## How It Works
The language detection algorithm uses a combination of techniques:

1. **Character Set Detection**: Identifies the script used in the text (Latin, Arabic, etc.)
2. **Specific Character Recognition**: Looks for language-specific characters (e.g., Kurdish Sorani has unique Arabic script characters)
3. **Common Word Matching**: Matches common words in the text to known language patterns

## Implementation Details

### Language Detection Function
The core of the feature is the `detectLanguage()` function in `script.js`:

```javascript
const detectLanguage = (text) => {
  // Implementation details...
}
```

### Visual Indicator
The detected language is displayed as a small badge above each user message:
- English messages: Blue badge
- Arabic messages: Gray badge
- Kurdish messages: Blue badge

## Technical Details

### Character Detection
- **Kurdish (Sorani)**: Detected by specific Arabic script characters (ژ, ک, گ, پ, چ)
- **Arabic**: Detected by general Arabic script characters
- **English**: Detected by Latin script characters

### Accuracy
The detection is most accurate for:
1. Kurdish (Sorani) - Near 100% due to unique characters
2. Arabic - High accuracy with Arabic script
3. English - High accuracy with Latin script

## Customization
To add support for more languages:
1. Add the language to the language map
2. Update the detection function with new character sets
3. Add CSS styling for the new language badge

## Limitations
- Short texts may be harder to detect accurately
- Mixed language texts will be classified based on the dominant language
- Some languages with similar scripts may be misclassified