const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggleBtn = document.querySelector("#theme-toggle-btn");
const languageSelect = document.querySelector("#language-select");
const suggestionsContainer = document.querySelector(".suggestions");
const sidebar = document.querySelector(".sidebar");
const sidebarOverlay = document.querySelector(".sidebar-overlay");
const sidebarToggleBtn = document.querySelector("#sidebar-toggle-btn");
const backBtn = document.querySelector("#back-btn");

// ==========================================
// CONSTANTS AND CONFIGURATION
// ==========================================
const CONFIG = {
  API: {
    GEMINI_MODEL: 'gemini-2.5-flash',
    GEMINI_IMAGE_MODEL: 'gemini-pro-vision',
    GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models',
    DEEP_AI_URL: 'https://api.deepai.org/api/text2img',
    POLLINATIONS_BASE_URL: 'https://image.pollinations.ai/prompt/',
    HF_BASE_URL: 'https://api-inference.huggingface.co/models',
    HF_DEFAULT_MODEL: 'stabilityai/stable-diffusion-2-1'
  },
  DEFAULTS: {
    GEMINI_KEY: 'AIzaSyCq2YpHXbY90aMIZmCgll4QxfKIcAU4rWY',
    DEEP_AI_KEY: 'b32201ab-245b-4103-b5e5-73823fcb11a8'
  },
  LIMITS: {
    FILE_SIZE: 5 * 1024 * 1024, // 5MB
    BASE64_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_PROMPT_LENGTH: 1000,
    MAX_IMAGE_PROMPT_LENGTH: 800,
    RATE_LIMIT_WINDOW: 60000, // 1 minute
    MAX_REQUESTS_PER_WINDOW: 10,
    MAX_CONTEXT_HISTORY: 5,
    TYPING_DELAY: 25,
    TYPING_MAX_DELAY: 50
  },
  TIMEOUTS: {
    IMAGE_LOAD: 25000,
    API_REQUEST: 60000,
    DEEP_AI: 30000,
    HF_REQUEST: 60000
  },
  ANIMATIONS: {
    TYPING_INDICATOR_DELAY: 800,
    SCROLL_UPDATE_INTERVAL: 5 // Update scroll every N words
  }
};

// ==========================================
// UTILITY FUNCTIONS - API KEY MANAGEMENT
// ==========================================
class ApiKeyManager {
  static ENCRYPTION_KEY = 'zansti-sardam-key';
  
  static encrypt(text, key = this.ENCRYPTION_KEY) {
  if (!text) return '';
  try {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
      return btoa(result);
  } catch (e) {
    console.error('Encryption failed:', e);
      return text;
  }
}

  static decrypt(encryptedText, key = this.ENCRYPTION_KEY) {
  if (!encryptedText) return '';
  try {
    const text = atob(encryptedText);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch (e) {
    console.error('Decryption failed:', e);
      return encryptedText;
    }
  }
  
  static get(keyName) {
    try {
      const encryptedKey = localStorage.getItem(keyName);
      return encryptedKey ? this.decrypt(encryptedKey) : null;
  } catch (e) {
      console.warn(`Could not retrieve ${keyName}:`, e);
    return null;
  }
}

  static set(keyName, keyValue) {
    try {
      if (keyValue) {
        const encryptedKey = this.encrypt(keyValue);
        localStorage.setItem(keyName, encryptedKey);
        return true;
      }
      return false;
  } catch (e) {
      console.error(`Failed to store ${keyName}:`, e);
      return false;
    }
  }
  
  static remove(keyName) {
    try {
      localStorage.removeItem(keyName);
    return true;
  } catch (e) {
      console.error(`Failed to remove ${keyName}:`, e);
    return false;
    }
  }
}

// API key getters with fallback to defaults
const getGeminiApiKey = () => ApiKeyManager.get('geminiApiKey') || CONFIG.DEFAULTS.GEMINI_KEY;
const getDeepAiApiKey = () => ApiKeyManager.get('deepAiApiKey') || CONFIG.DEFAULTS.DEEP_AI_KEY;
const getHfApiKey = () => ApiKeyManager.get('hfApiKey') || '';
const setHfApiKey = (key) => typeof key === 'string' && key.trim() 
  ? ApiKeyManager.set('hfApiKey', key.trim()) 
  : false;

// Build API URLs dynamically
const buildGeminiApiUrl = (model = CONFIG.API.GEMINI_MODEL) => 
  `${CONFIG.API.GEMINI_BASE_URL}/${model}:generateContent?key=${getGeminiApiKey()}`;

const GEMINI_API_URL = buildGeminiApiUrl();
const GEMINI_IMAGE_API_URL = buildGeminiApiUrl(CONFIG.API.GEMINI_IMAGE_MODEL);

// Function to securely set API keys
const setApiKeys = (geminiKey, deepAiKey) => {
  const results = [];
  if (geminiKey) results.push(ApiKeyManager.set('geminiApiKey', geminiKey));
  if (deepAiKey) results.push(ApiKeyManager.set('deepAiApiKey', deepAiKey));
  return results.every(r => r);
};

let controller, typingInterval;
const chatHistory = [];
const userData = { message: "", file: {} };
let isOnline = true;
const networkStatus = document.getElementById('network-status');

// Voice recognition state
let recognition = null;
let isListening = false;

// Chat persistence keys
const STORAGE_KEYS = {
  CHAT_HISTORY: 'zansti_chat_history',
  THEME: 'zansti_theme',
  LANGUAGE: 'zansti_language'
};

// Enhanced system prompts for better AI responses
const SYSTEM_PROMPTS = {
  default: `You are zansti sardam AI, an intelligent and helpful assistant created by chya luqman. You are knowledgeable, friendly, and always strive to provide accurate and helpful responses.

Guidelines:
- Be concise but comprehensive
- Use clear, natural language
- Format responses with proper structure (use line breaks, lists, or paragraphs as appropriate)
- If you don't know something, admit it honestly
- Be respectful and professional
- Support multiple languages (English, Kurdish/Sorani, Arabic)
- When discussing technical topics, explain in accessible terms
- For code examples, provide clear, commented code
- Always prioritize accuracy and user safety`,

  vehicle: `You are zansti sardam AI specializing in vehicle information. Provide accurate, detailed information about cars, EVs, maintenance, and automotive topics.

- Include specific numbers and metrics when relevant
- Compare options objectively
- Mention environmental impact when discussing EVs vs gas vehicles
- Provide practical, actionable advice
- Include maintenance schedules and cost estimates when relevant`,

  coding: `You are zansti sardam AI specializing in programming and software development. Provide clear, accurate code examples and explanations.

- Include working code examples when requested
- Explain complex concepts in simple terms
- Mention best practices and common pitfalls
- Support multiple programming languages
- Format code clearly with proper indentation
- Explain what the code does, not just provide it`,

  creative: `You are zansti sardam AI with creative writing capabilities. Help users with storytelling, poetry, and creative content.

- Be imaginative and creative
- Adapt to different writing styles as requested
- Provide original content
- Use vivid descriptions and engaging language
- Match the tone and style requested by the user`
};

// Get appropriate system prompt based on message content
const getSystemPrompt = (message) => {
  const lowerMessage = message.toLowerCase();
  
  if (isVehicleQuery(message)) {
    return SYSTEM_PROMPTS.vehicle;
  }
  
  if (lowerMessage.includes('code') || lowerMessage.includes('programming') || 
      lowerMessage.includes('function') || lowerMessage.includes('script') ||
      lowerMessage.includes('python') || lowerMessage.includes('javascript') ||
      lowerMessage.includes('html') || lowerMessage.includes('css')) {
    return SYSTEM_PROMPTS.coding;
  }
  
  if (lowerMessage.includes('write') || lowerMessage.includes('poem') || 
      lowerMessage.includes('story') || lowerMessage.includes('creative') ||
      lowerMessage.includes('narrative')) {
    return SYSTEM_PROMPTS.creative;
  }
  
  return SYSTEM_PROMPTS.default;
};

// ==========================================
// UTILITY CLASSES AND MANAGERS
// ==========================================

// Rate Limiter with improved implementation
class RateLimiter {
  constructor(windowMs = CONFIG.LIMITS.RATE_LIMIT_WINDOW, maxRequests = CONFIG.LIMITS.MAX_REQUESTS_PER_WINDOW) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requestCount = 0;
    this.resetTime = Date.now() + windowMs;
  }
  
  check() {
    const now = Date.now();
    
    if (now > this.resetTime) {
      this.requestCount = 0;
      this.resetTime = now + this.windowMs;
    }
    
    if (this.requestCount >= this.maxRequests) {
      const timeLeft = Math.ceil((this.resetTime - now) / 1000);
      throw new Error(`Rate limit exceeded. Please wait ${timeLeft} seconds before making another request.`);
    }
    
    this.requestCount++;
    return true;
  }
  
  reset() {
    this.requestCount = 0;
    this.resetTime = Date.now() + this.windowMs;
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

// Enhanced context builder for conversation history
const buildConversationContext = (history = chatHistory, maxHistory = CONFIG.LIMITS.MAX_CONTEXT_HISTORY) => {
  if (!history?.length) return [];
  
  const recentMessages = history.slice(-maxHistory * 2);
  const context = [];
  
  for (const item of recentMessages) {
    if (item.type === 'user') {
      context.push({ role: 'user', parts: [{ text: item.text }] });
    } else if (item.type === 'bot') {
      context.push({ role: 'model', parts: [{ text: item.text }] });
    }
  }
  
  return context;
};

// ==========================================
// VALIDATION CONSTANTS
// ==========================================
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
  'text/csv',
  'application/pdf'
];

const AVATAR_IMAGE_URL = 'https://i.ibb.co/21jpMNhw/234421810-326887782452132-7028869078528396806-n-removebg-preview-1.png';

// Legacy functions for backward compatibility (using ApiKeyManager internally)
const simpleEncrypt = (text, key) => ApiKeyManager.encrypt(text, key);
const simpleDecrypt = (encryptedText, key) => ApiKeyManager.decrypt(encryptedText, key);

// Basic translations for UI (en, ckb (Sorani), ar)
const translations = {
  en: {
    heading: "zansti sardam ai Chatbot",
    subheading: "Your intelligent assistant powered by chya luqman",
    disclaimer: "zansti sardam may display inaccurate info, including about people. Use responsibly.",
    language_label: "Language:",
    prompt_placeholder: "Message zansti sardam ...",
  },
  ckb: {
    heading: "چاتبۆتی زانستی سەردەم",
    subheading: "یارمەتی‌دەرێکی زیرەک بەهێزکراوە لە لایەن چیا لوقمان",
    disclaimer: "زانستی سەردەم ڕەنگە زانیاری نەدرۆست پیشان بدات. بە وریایی بەکاربێنە.",
    language_label: "زمان:",
    prompt_placeholder: "نامە بنوسە بۆ زانستی سەردەم...",
  },
  ar: {
    heading: "بوت دردشة زانستي سەردەم",
    subheading: "مساعد ذكي مدعوم من چيا لوقمان",
    disclaimer: "قد يعرض زانستي سەردەم معلومات غير دقيقة، بما في ذلك عن الأشخاص. استخدمه بمسؤولية.",
    language_label: "اللغة:",
    prompt_placeholder: "أرسل رسالة إلى زانستي سەردەم...",
  },
};

const isRtl = (lang) => lang === 'ar' || lang === 'fa' || lang === 'ckb';

const applyI18n = (lang) => {
  const dict = translations[lang] || translations.en;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key]) el.setAttribute('placeholder', dict[key]);
  });
  // Direction and alignment
  const rtl = isRtl(lang);
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  document.body.style.direction = rtl ? 'rtl' : 'ltr';
};

// Basic HTML escape for user-derived strings to prevent XSS
const escapeHTML = (str) => {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

// Allow only http(s), data, blob URLs when injecting into DOM
const safeUrl = (url) => {
  try {
    const u = new URL(url, window.location.origin);
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'data:' || u.protocol === 'blob:') {
      return u.toString();
    }
  } catch (_) {
    // ignore
  }
  return '#';
};

// Initialize language from localStorage or default
const initLanguage = () => {
  const saved = localStorage.getItem('appLanguage') || 'en';
  if (languageSelect) languageSelect.value = saved;
  applyI18n(saved);
  renderSuggestions(saved);
};

// Localized suggestions content
const suggestionsByLang = {
  en: [
    { text: "Explain quantum computing in simple terms", icon: "science" },
    { text: "Create a majestic dragon soaring over misty mountains", icon: "image" },
    { text: "HHTTP request in JavaScript?", icon: "code" },
    { text: "Write a poem about the beauty of nature", icon: "nature" },
  ],
  ckb: [
    { text: "کۆانتەم بە سادەیی ڕوون بکەرەوە", icon: "science" },
    { text: "/img ئەژدیهایەکێکی شاخەوان لەسەر دەشتی مۆڵەو پەروەردە دەکات", icon: "image" },
    { text: "چۆن داواکردنی HTTP لە جاڤاسکریپت دروست بکەم؟", icon: "code" },
    { text: "شاعیرانەکە لە سەربەخۆیی سرووشت بنووسە", icon: "nature" },
  ],
  ar: [
    { text: "اشرح الحوسبة الكمية ببساطة", icon: "science" },
    { text: "/img تنين مهيب يحلق فوق جبال ضبابية", icon: "image" },
    { text: "كيف أرسل طلب HTTP في جافاسكريبت؟", icon: "code" },
    { text: "اكتب قصيدة عن جمال الطبيعة", icon: "nature" },
  ],
};

const bindSuggestionHandlers = () => {
  if (!suggestionsContainer) return;
  suggestionsContainer.querySelectorAll('.suggestions-item').forEach((suggestion) => {
    // Remove existing listeners to prevent duplicates
    const newSuggestion = suggestion.cloneNode(true);
    suggestion.parentNode.replaceChild(newSuggestion, suggestion);
    
    const handleSuggestionSelect = () => {
      const text = newSuggestion.querySelector(".text")?.textContent || "";
      if (text) {
      promptInput.value = text;
      promptForm.dispatchEvent(new Event("submit"));
        promptInput.focus();
      }
    };
    
    // Click handler
    newSuggestion.addEventListener("click", handleSuggestionSelect);
    
    // Keyboard navigation support
    newSuggestion.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSuggestionSelect();
      }
    });
    
    // Hover effects (for non-touch devices)
    if (window.matchMedia('(hover: hover)').matches) {
      newSuggestion.addEventListener("mouseenter", () => { 
        newSuggestion.style.transform = "translateY(-10px)"; 
      });
      newSuggestion.addEventListener("mouseleave", () => { 
        newSuggestion.style.transform = "translateY(0)"; 
      });
    }
  });
};

const renderSuggestions = (lang) => {
  if (!suggestionsContainer) return;
  const items = suggestionsByLang[lang] || suggestionsByLang.en;
  suggestionsContainer.innerHTML = items.map((it) => `
    <li class="suggestions-item">
      <p class="text">${it.text}</p>
      <span class="icon material-symbols-rounded">${it.icon}</span>
    </li>
  `).join("");
  bindSuggestionHandlers();
};

// Language detection map
const languageMap = {
  'en': 'English',
  'ar': 'Arabic',
  'ku': 'Kurdish (Sorani)',
  'ckb': 'Kurdish (Sorani)',
  'fa': 'Persian/Farsi',
  'tr': 'Turkish',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'ko': 'Korean'
};

// Set initial theme from local storage
const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";

// Enhanced language detection with better accuracy
const detectLanguage = (text) => {
  // Remove extra whitespace and get a clean text sample
  const cleanText = text.trim().toLowerCase();
  
  // If text is empty, return default
  if (cleanText.length === 0) return 'Unknown';
  
  // Define regex patterns for different scripts and languages
  const arabicRegex = /[\u0600-\u06FF]/g;
  const kurdishSoraniSpecific = /[\u0698\u06A9\u06AF\u067E\u0686\u0695\u0688\u0689]/g; // Extended Kurdish characters
  const englishRegex = /[a-zA-Z]/g;
  const latinExtendedRegex = /[a-zA-Z\u00C0-\u017F]/g; // Extended Latin for European languages
  
  // Enhanced common words for language detection
  const englishCommonWords = ['the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'this', 'that', 'these', 'those'];
  const arabicCommonWords = ['الذي', 'التي', 'أن', 'إن', 'من', 'على', 'في', 'إلى', 'عن', 'مع', 'بعد', 'قبل', 'أثناء', 'منذ', 'لأن', 'حتى', 'كل', 'جميع', 'بعض', 'أي', 'ما', 'كيف', 'متى', 'أين', 'لماذا'];
  const kurdishCommonWords = ['ئەم', 'ئەو', 'لە', 'بە', 'دە', 'نا', 'بێت', 'هەیە', 'ئەکات', 'دەکات', 'کرد', 'بوو', 'دەبێت'];
  
  // Scoring system for better accuracy
  let scores = {
    kurdish: 0,
    arabic: 0,
    english: 0
  };
  
  // Check for Kurdish (Sorani) first - most specific
  const kurdishChars = cleanText.match(kurdishSoraniSpecific);
  if (kurdishChars) {
    scores.kurdish += kurdishChars.length * 2; // Weight Kurdish-specific chars more
  }
  const kurdishWords = kurdishCommonWords.filter(word => cleanText.includes(word));
  scores.kurdish += kurdishWords.length * 3;
  
  // Check for Arabic script
  const arabicChars = cleanText.match(arabicRegex);
  if (arabicChars && arabicChars.length > 2) {
    scores.arabic += arabicChars.length;
    const arabicWords = arabicCommonWords.filter(word => cleanText.includes(word));
    scores.arabic += arabicWords.length * 2;
    
    // If Kurdish chars found but Arabic score is high, it might be Arabic
    if (!kurdishChars || scores.arabic > scores.kurdish * 1.5) {
      return 'Arabic';
    }
  }
  
  // Check for English/Latin script
  const englishChars = cleanText.match(englishRegex);
  if (englishChars && englishChars.length > 2) {
    scores.english += englishChars.length;
    const englishWords = englishCommonWords.filter(word => cleanText.includes(word));
    scores.english += englishWords.length * 2;
  }
  
  // Return language with highest score
  if (scores.kurdish > 0 && scores.kurdish >= scores.arabic && scores.kurdish >= scores.english) {
    return 'Kurdish (Sorani)';
  }
  
  if (scores.arabic > scores.english && scores.arabic > 2) {
    return 'Arabic';
  }
  
  if (scores.english > 2) {
    return 'English';
  }
  
  // Default to Unknown for ambiguous cases
  return 'Unknown';
};

// Function to create message elements
const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

// Function to check if message is related to vehicles
const isVehicleQuery = (message) => {
  const lowerMessage = message.toLowerCase();
  const vehicleKeywords = [
    'car', 'vehicle', 'automobile', 'electric car', 'ev', 'hybrid',
    'fuel efficiency', 'mpg', 'maintenance', 'oil change', 'tire',
    'brake', 'battery', 'engine', 'transmission', 'fuel', 'emission',
    'insurance', 'cost', 'price', 'value', 'depreciation', 'repair'
  ];
  
  return vehicleKeywords.some(keyword => lowerMessage.includes(keyword));
};

// Function to generate vehicle maintenance schedule
const generateMaintenanceSchedule = (vehicleType = 'car') => {
  const schedules = {
    car: [
      { task: 'Oil Change', interval: 'Every 3,000-5,000 miles or 3-6 months' },
      { task: 'Tire Rotation', interval: 'Every 5,000-7,500 miles' },
      { task: 'Air Filter Replacement', interval: 'Every 12,000-15,000 miles' },
      { task: 'Brake Inspection', interval: 'Every 10,000 miles' },
      { task: 'Coolant Flush', interval: 'Every 30,000 miles' },
      { task: 'Transmission Fluid Change', interval: 'Every 30,000-60,000 miles' },
      { task: 'Spark Plug Replacement', interval: 'Every 30,000-100,000 miles' }
    ],
    ev: [
      { task: 'Battery Health Check', interval: 'Every 6 months' },
      { task: 'Tire Rotation', interval: 'Every 5,000-7,500 miles' },
      { task: 'Brake Fluid Check', interval: 'Every 2 years' },
      { task: 'Coolant System Check', interval: 'Every 30,000 miles' },
      { task: '12V Battery Check', interval: 'Every 6 months' },
      { task: 'Motor and Inverter Inspection', interval: 'Every 20,000 miles' },
      { task: 'Regenerative Brake System Check', interval: 'Every 15,000 miles' }
    ],
    hybrid: [
      { task: 'Oil Change', interval: 'Every 5,000-10,000 miles' },
      { task: 'Tire Rotation', interval: 'Every 5,000-7,500 miles' },
      { task: 'Battery Health Check', interval: 'Every 6 months' },
      { task: 'Brake Inspection', interval: 'Every 10,000 miles' },
      { task: 'Coolant Flush', interval: 'Every 30,000 miles' },
      { task: 'Hybrid System Inspection', interval: 'Every 15,000 miles' },
      { task: 'Transmission Fluid Change', interval: 'Every 30,000-60,000 miles' }
    ]
  };
  
  return schedules[vehicleType] || schedules.car;
};

// Function to calculate fuel cost
const calculateFuelCost = (mpg, distance, fuelPrice) => {
  if (!mpg || !distance || !fuelPrice) return null;
  const gallonsNeeded = distance / mpg;
  return (gallonsNeeded * fuelPrice).toFixed(2);
};

// Function to calculate emission savings
const calculateEmissionSavings = (gasMpg, evMpg, distance, gasEmissionFactor = 0.35, evEmissionFactor = 0.1) => {
  // Gas emission factor in kg CO2 per mile, EV emission factor accounts for electricity generation
  const gasEmissions = distance * gasEmissionFactor;
  const evEmissions = distance * evEmissionFactor;
  const savings = gasEmissions - evEmissions;
  
  return {
    gasEmissions: gasEmissions.toFixed(2),
    evEmissions: evEmissions.toFixed(2),
    savings: savings.toFixed(2)
  };
};

// Function to estimate insurance cost
const estimateInsuranceCost = (vehicleType, age, value) => {
  // Base rates per year
  const baseRates = {
    car: 1200,
    ev: 1500,
    hybrid: 1300
  };
  
  // Age adjustment factors
  const ageFactors = {
    new: 1.2,    // 0-2 years
    young: 1.0,  // 3-5 years
    mid: 0.8,    // 6-10 years
    old: 0.6     // 11+ years
  };
  
  // Value adjustment (per $10,000 of value)
  const valueFactor = value ? (value / 10000) * 100 : 0;
  
  const baseRate = baseRates[vehicleType] || baseRates.car;
  const ageFactor = ageFactors[age] || ageFactors.mid;
  
  // Calculate estimated annual insurance cost
  const estimatedCost = (baseRate * ageFactor) + valueFactor;
  
  return estimatedCost.toFixed(2);
};

// Function to compare vehicles
const compareVehicles = (vehicle1, vehicle2) => {
  const comparisons = {
    teslaModel3: {
      name: 'Tesla Model 3',
      type: 'Electric',
      efficiency: '120 MPGe',
      range: '272 miles',
      chargingTime: '15 min (Supercharger)',
      maintenance: 'Low',
      emissions: '0g/mile',
      insurance: '$1,500/year',
      depreciation: '20%/year'
    },
    toyotaCamry: {
      name: 'Toyota Camry',
      type: 'Gasoline',
      efficiency: '28 MPG',
      range: '420 miles',
      chargingTime: '5 min',
      maintenance: 'Medium',
      emissions: '350g/mile',
      insurance: '$1,200/year',
      depreciation: '15%/year'
    },
    toyotaPrius: {
      name: 'Toyota Prius',
      type: 'Hybrid',
      efficiency: '55 MPG',
      range: '550 miles',
      chargingTime: 'N/A',
      maintenance: 'Low',
      emissions: '150g/mile',
      insurance: '$1,300/year',
      depreciation: '18%/year'
    },
    fordF150: {
      name: 'Ford F-150',
      type: 'Gasoline',
      efficiency: '20 MPG',
      range: '450 miles',
      chargingTime: '5 min',
      maintenance: 'Medium',
      emissions: '450g/mile',
      insurance: '$1,800/year',
      depreciation: '17%/year'
    },
    chevyBolt: {
      name: 'Chevy Bolt EV',
      type: 'Electric',
      efficiency: '118 MPGe',
      range: '259 miles',
      chargingTime: '30 min (DC Fast)',
      maintenance: 'Low',
      emissions: '0g/mile',
      insurance: '$1,600/year',
      depreciation: '22%/year'
    }
  };
  
  const v1 = comparisons[vehicle1] || comparisons.teslaModel3;
  const v2 = comparisons[vehicle2] || comparisons.toyotaCamry;
  
  return { v1, v2 };
};

// Function to check if text is Kurdish
const isKurdishText = (text) => {
  // Check for Kurdish-specific characters
  const kurdishRegex = /[\u0698\u06A9\u06AF\u067E\u0686\u0695]/;
  return kurdishRegex.test(text);
};

// Function to create error message elements with better styling
const createErrorMessageElement = (errorMessage, ...classes) => {
  const errorContent = `
    <div class="avatar" aria-hidden="true">
      <img src="${AVATAR_IMAGE_URL}" alt="Bot Avatar" class="avatar-image">
    </div>
    <div class="message-content">
      <div class="message-header" role="alert" aria-live="assertive">
        <span class="language-indicator error-indicator" aria-label="Error message">Error</span>
      </div>
      <p class="message-text error-message">${escapeHTML(errorMessage)}</p>
    </div>
  `;
  return createMessageElement(errorContent, "bot-message", "error", ...classes);
};

// Performance: Optimize scroll handling
let scrollTimeout;
const optimizedScrollToBottom = () => {
  if (scrollTimeout) {
    cancelAnimationFrame(scrollTimeout);
  }
  scrollTimeout = requestAnimationFrame(() => {
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth"
      });
    }
  });
};

// Scroll to the bottom of the container (optimized wrapper)
const scrollToBottom = () => {
  optimizedScrollToBottom();
};

// Render a simple recent chat summary as a bot message
const renderRecentChats = () => {
  const recent = chatHistory.slice(-10);
  const listItems = recent.map((item) => {
    if (item.type === 'user') {
      return `<li><strong>User:</strong> ${escapeHTML(item.text)}</li>`;
    }
    if (item.type === 'bot-image') {
      const url = safeUrl(item.url);
      return `<li><strong>Bot (image):</strong> <a href="${url}" target="_blank" rel="noopener noreferrer">view</a></li>`;
    }
    return `<li><strong>Bot:</strong> ${escapeHTML(item.text)}</li>`;
  }).join("");
  const html = `
    <div class="avatar">
      <img src="${AVATAR_IMAGE_URL}" alt="Bot Avatar" class="avatar-image">
    </div>
    <div class="message-content">
      <p class="message-text"><strong>Recent chat (last ${recent.length}):</strong>\n<ul>${listItems || '<li>No recent messages.</li>'}</ul></p>
    </div>
  `;
  const botMsgDiv = createMessageElement(html, "bot-message");
  chatsContainer.appendChild(botMsgDiv);
  optimizedScrollToBottom();
};

// Enhanced typing effect with better formatting support and cleanup
const typingEffect = (text, textElement, botMsgDiv) => {
  // Clear any existing typing interval
  if (typingInterval) {
    clearInterval(typingInterval);
    typingInterval = null;
  }
  
  // Check if the text is Kurdish and add the appropriate class
  if (isKurdishText(text)) {
    textElement.classList.add('kurdish-text');
  }
  
  // Clear existing content
  textElement.textContent = "";
  botMsgDiv.classList.add("loading");
  
  // Enhanced parsing for better formatting
  const words = text.split(/(\s+)/);
  let wordIndex = 0;
  let lastUpdateTime = Date.now();
  
  // Adaptive typing speed based on content length
  const getDelay = () => {
    const progress = wordIndex / words.length;
    return progress > 0.8 ? CONFIG.LIMITS.TYPING_MAX_DELAY : CONFIG.LIMITS.TYPING_DELAY;
  };
  
  // Optimized scroll function using requestAnimationFrame
  const throttledScroll = throttle(scrollToBottom, 100);
  
  // Set an interval to type each word with adaptive speed
  typingInterval = setInterval(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTime;
    
    if (timeSinceLastUpdate >= getDelay()) {
    if (wordIndex < words.length) {
        textElement.textContent += words[wordIndex++];
        
        // Scroll periodically for better performance
        if (wordIndex % CONFIG.ANIMATIONS.SCROLL_UPDATE_INTERVAL === 0) {
          throttledScroll();
        }
        lastUpdateTime = now;
    } else {
      clearInterval(typingInterval);
        typingInterval = null;
      botMsgDiv.classList.remove("loading");
      document.body.classList.remove("bot-responding");
        
        // Apply formatting after typing completes
        const originalText = botMsgDiv.dataset.originalText || textElement.textContent;
        if (originalText) {
          const formattedText = formatMessageText(originalText);
          if (formattedText && formattedText !== `<p>${originalText}</p>`) {
            textElement.innerHTML = formattedText;
          }
        }
        
        optimizedScrollToBottom(); // Final scroll
      }
    }
  }, 10);
};

// Create typing indicator
const createTypingIndicator = () => {
  const typingDiv = document.createElement("div");
  typingDiv.classList.add("message", "bot-message");
  typingDiv.innerHTML = `
    <div class="avatar" aria-hidden="true">
      <img src="${AVATAR_IMAGE_URL}" alt="Bot Avatar" class="avatar-image">
    </div>
    <div class="message-content">
      <div class="typing-indicator" role="status" aria-live="polite" aria-label="Bot is typing">
      <span></span>
      <span></span>
      <span></span>
      </div>
    </div>
  `;
  return typingDiv;
};

// Enhanced input validation and sanitization
const validateAndSanitizeInput = (text) => {
  if (!text) return "";
  
    // Convert to string and trim
    let sanitized = String(text).trim();
    
    // Remove excessive whitespace
    sanitized = sanitized.replace(/\s+/g, " ");
    
  // Remove control characters
  sanitized = sanitized.replace(/[\u0000-\u001F\u007F]/g, " ");
  
  // Limit length to prevent abuse
  sanitized = sanitized.slice(0, CONFIG.LIMITS.MAX_PROMPT_LENGTH);
    
    // Additional security checks
    // Remove potentially dangerous patterns
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    sanitized = sanitized.replace(/javascript:/gi, "");
    sanitized = sanitized.replace(/vbscript:/gi, "");
  sanitized = sanitized.replace(/data:/gi, "");
    
    return sanitized;
};

// Sanitize and normalize prompts for image models
const sanitizePrompt = (text) => {
  if (!text) return "";
  return String(text)
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, CONFIG.LIMITS.MAX_IMAGE_PROMPT_LENGTH);
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

// Enhanced promise timeout helper
const withTimeout = (promise, ms, onTimeoutMessage = "Operation timed out") => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(onTimeoutMessage)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
};

// Debounce function for performance optimization
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function for performance optimization
const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Helper to construct a Pollinations image URL
const buildPollinationsImageUrl = (prompt) => {
  const params = new URLSearchParams({
    width: "1024",
    height: "1024",
    nologo: "true",
    enhance: "true"
  });
  return `${CONFIG.API.POLLINATIONS_BASE_URL}${encodeURIComponent(sanitizePrompt(prompt))}?${params.toString()}`;
};

// Helper to load an image and await success/failure with cleanup
const waitForImageLoad = (img, timeoutMs = CONFIG.TIMEOUTS.IMAGE_LOAD) => {
  return withTimeout(
    new Promise((resolve, reject) => {
  const onLoad = () => { cleanup(); resolve(); };
  const onError = (e) => { cleanup(); reject(e); };
  const cleanup = () => {
    img.removeEventListener("load", onLoad);
    img.removeEventListener("error", onError);
  };
      img.addEventListener("load", onLoad, { once: true });
      img.addEventListener("error", onError, { once: true });
    }),
    timeoutMs,
    "Image load timed out"
  );
};

// Function to generate image using Pollinations (no API key, direct image URL)
const generateImageWithPollinations = async (prompt) => {
  const url = buildPollinationsImageUrl(prompt);
  // We create an off-DOM image to verify it loads (catching network/CORS issues)
  const testImg = new Image();
  testImg.crossOrigin = "anonymous"; // allow canvas usage if needed later
  testImg.src = url;
  await waitForImageLoad(testImg);
  return url;
};

// Function to generate image using Hugging Face Inference API (returns blob URL)
const generateImageWithHF = async (prompt, options = {}) => {
  const modelId = options.modelId || CONFIG.API.HF_DEFAULT_MODEL;
  const HF_API_KEY = getHfApiKey();
  if (!HF_API_KEY) throw new Error("Hugging Face API key not configured");
  
  const payload = {
    inputs: sanitizePrompt(prompt),
    parameters: {
      num_inference_steps: 30,
      guidance_scale: 7.5,
      ...(options.parameters || {})
    }
  };
  
  const url = `${CONFIG.API.HF_BASE_URL}/${encodeURIComponent(modelId)}`;
  const maxAttempts = 3;
  let lastErr;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const req = fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
          "x-use-cache": "false",
        },
        body: JSON.stringify(payload),
      });
      
      const res = await withTimeout(req, CONFIG.TIMEOUTS.HF_REQUEST, "Hugging Face request timed out");
      
      if (res.status === 503) {
        const body = await res.json().catch(() => ({}));
        const wait = Math.min(4000 * attempt, 10000);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      
      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        throw new Error(`HF error ${res.status}: ${res.statusText}${bodyText ? ` - ${bodyText}` : ''}`);
      }
      
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      // Verify load
      const testImg = new Image();
      testImg.src = objectUrl;
      await waitForImageLoad(testImg, 20000);
      return objectUrl;
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts) continue;
    }
  }
  throw lastErr || new Error("Hugging Face generation failed");
};

// Function to generate image using DeepAI API
const generateImageWithDeepAI = async (prompt) => {
  const maxAttempts = 2;
  const backoffBaseMs = 1200;
  const sanitized = sanitizePrompt(prompt);
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const formData = new FormData();
      formData.append('text', sanitized);

      const abortController = new AbortController();
      const req = fetch(CONFIG.API.DEEP_AI_URL, {
        method: "POST",
        headers: { "api-key": getDeepAiApiKey() },
        body: formData,
        signal: abortController.signal
      });

      const response = await withTimeout(req, CONFIG.TIMEOUTS.DEEP_AI, "DeepAI request timed out");
      
      if (!response.ok) {
        const maybeJson = await response.clone().text().catch(() => "");
        throw new Error(`DeepAI API error ${response.status}: ${response.statusText}${maybeJson ? ` - ${maybeJson}` : ''}`);
      }

      const data = await response.json();
      if (!data.output_url) throw new Error("DeepAI API returned no image URL");
      return data.output_url;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, backoffBaseMs * attempt));
        continue;
      }
    }
  }
  
  console.error("DeepAI API error:", lastError);
  throw lastError;
};

// Function to generate image using Gemini API
const generateImageWithGemini = async (prompt) => {
    try {
      // Try with gemini-pro-vision model first
    const response = await fetch(GEMINI_IMAGE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        contents: [{
          role: "user",
          parts: [{
            text: `Please create a detailed visualization based on this description: ${prompt}. If you cannot generate an image, please provide a detailed description that could be used by an image generation tool.`
          }]
        }]
      }),
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Gemini API error: ${data.error?.message || response.statusText}`);
    }
    
    // Process the response
    const responsePart = data.candidates[0].content.parts[0];
    return responsePart;
  } catch (error) {
    console.error("Gemini API error:", error);
      // If gemini-pro-vision fails, try with gemini-2.0-flash-exp
      try {
      const GEMINI_FLASH_IMAGE_API_URL = buildGeminiApiUrl('gemini-2.0-flash-exp');
        const response = await fetch(GEMINI_FLASH_IMAGE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [{
            role: "user",
            parts: [{
              text: `You are an expert at creating detailed image generation prompts. Based on this request: "${prompt}", create a comprehensive, detailed description optimized for AI image generation. 

Include:
- Specific visual details (objects, people, scenery)
- Color palette and lighting
- Art style (realistic, cartoon, abstract, etc.)
- Composition and framing
- Mood and atmosphere
- Technical details (resolution, quality)

Provide a single, well-structured prompt that would produce the best image.`
            }]
          }],
          systemInstruction: {
            parts: [{
              text: "You specialize in creating detailed, optimized prompts for AI image generation. Always provide comprehensive, specific descriptions."
            }]
          }
        }),
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Gemini Flash API error: ${data.error?.message || response.statusText}`);
      }
      
      // Process the response
      const responsePart = data.candidates[0].content.parts[0];
      return responsePart;
    } catch (flashError) {
      console.error("Gemini Flash API error:", flashError);
      throw error; // Throw the original error
    }
  }
};

// Function to check if a message is requesting image generation
const isImageGenerationRequest = (message) => {
  const lowerMessage = message.toLowerCase();
  return lowerMessage.startsWith("/img ") ||
         lowerMessage.startsWith("/image ") ||
         lowerMessage.includes("image") || 
         lowerMessage.includes("picture") || 
         lowerMessage.includes("photo") ||
         lowerMessage.includes("generate") ||
         lowerMessage.includes("create") ||
         lowerMessage.includes("draw") ||
         lowerMessage.includes("design") ||
         lowerMessage.includes("art") ||
         lowerMessage.includes("paint") ||
         lowerMessage.includes("illustration") ||
         lowerMessage.includes("visual") ||
         lowerMessage.includes("show me") ||
         lowerMessage.includes("make a") ||
         lowerMessage.includes("can you show");
};

// Make the API call and generate the bot's response
const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector(".message-text");
  controller = new AbortController();
  
  // Check if this is an image generation request
  const imageRequest = isImageGenerationRequest(userData.message);
  
  try {
    if (imageRequest) {
      // Handle image generation request
      textElement.textContent = "Preparing your image generation request...";
      
      // Create progress indicator
      const progressIndicator = document.createElement('div');
      progressIndicator.className = 'image-generation-progress';
      progressIndicator.innerHTML = `
        <div class="progress-bar">
          <div class="progress-fill" style="width: 0%"></div>
        </div>
        <p class="progress-text">Initializing...</p>
      `;
      textElement.innerHTML = '';
      textElement.appendChild(progressIndicator);
      
      const progressFill = progressIndicator.querySelector('.progress-fill');
      const progressText = progressIndicator.querySelector('.progress-text');
      
      const updateProgress = (percent, text) => {
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressText) progressText.textContent = text;
      };
      
      try {
        // Try Pollinations first for fast, keyless generation
        updateProgress(20, 'Connecting to image service...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        updateProgress(40, 'Generating image...');
        let imageUrl = await generateImageWithPollinations(userData.message);
        updateProgress(80, 'Processing image...');
        
        // Display the generated image with optimized loading
        const imgElement = document.createElement("img");
        imgElement.className = "generated-image";
        imgElement.alt = "Generated image";
        imgElement.loading = "lazy";
        imgElement.decoding = "async";
        imgElement.fetchpriority = "low";
        
        // Create placeholder for smooth loading
        const placeholder = document.createElement("div");
        placeholder.className = "image-placeholder";
        placeholder.innerHTML = `
          <div class="placeholder-spinner"></div>
          <p>Loading image...</p>
        `;
        textElement.innerHTML = "";
        textElement.appendChild(placeholder);
        
        // Load image with error handling
        imgElement.src = imageUrl;
        
        updateProgress(90, 'Loading image...');
        
        imgElement.onload = () => {
          // Image loaded successfully - fade in effect
          updateProgress(100, 'Complete!');
          
          setTimeout(() => {
            placeholder.style.opacity = "0";
            placeholder.style.transition = "opacity 0.3s ease-out";
            
            setTimeout(() => {
              textElement.innerHTML = "";
              imgElement.style.opacity = "0";
              textElement.appendChild(imgElement);
              
              // Fade in image
              requestAnimationFrame(() => {
                imgElement.style.transition = "opacity 0.5s ease-in";
                imgElement.style.opacity = "1";
              });
              
              // Add download button
              const downloadBtn = document.createElement("button");
              downloadBtn.className = "download-btn";
              downloadBtn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">download</span> Download Image';
              downloadBtn.setAttribute("aria-label", "Download generated image");
              downloadBtn.onclick = () => {
                const link = document.createElement("a");
                link.href = imageUrl;
                link.download = `generated-image-${Date.now()}.png`;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                document.body.appendChild(link);
                link.click();
                setTimeout(() => document.body.removeChild(link), 100);
              };
              textElement.appendChild(downloadBtn);
              
              // Track successful generation
              chatHistory.push({ type: 'bot-image', url: imageUrl, ts: Date.now() });
              saveChatHistory();
              optimizedScrollToBottom();
            }, 300);
          }, 500);
        };
        
        imgElement.onerror = () => {
          updateProgress(50, 'Primary method failed, trying alternative...');
          // If Pollinations preview fails, try DeepAI or HF as fallbacks
          (async () => {
            try {
              textElement.textContent = "Retrying via DeepAI...";
              const deepUrl = await generateImageWithDeepAI(userData.message);
              imageUrl = deepUrl;
              imgElement.src = deepUrl;
            } catch (fallbackErr) {
              try {
                textElement.textContent = "Retrying via Hugging Face...";
                const hfUrl = await generateImageWithHF(userData.message);
                imageUrl = hfUrl;
                imgElement.src = hfUrl;
              } catch (hfErr) {
                const safe = safeUrl(imageUrl);
                textElement.innerHTML = `
                  <p>Image generated successfully but failed to load preview.</p>
                  <p><a href="${safe}" target="_blank" rel="noopener noreferrer">Click here to view the image</a></p>
                  <button class="download-btn" onclick="window.open('${safe}', '_blank', 'noopener,noreferrer')">
                    <span class="material-symbols-rounded">open_in_new</span> View Image
                  </button>
                `;
              }
            }
          })();
        };
        // Record successful Pollinations URL if it loads later
        waitForImageLoad(imgElement).then(() => {
          chatHistory.push({ type: 'bot-image', url: imageUrl, ts: Date.now() });
        }).catch(() => {});
      } catch (firstError) {
        // Fallback order: DeepAI -> Hugging Face -> Gemini description
        console.error("Primary image source error:", firstError);
        textElement.textContent = `Primary image source failed, trying DeepAI...`;
        
        try {
          // Try DeepAI direct from original user prompt
          const deepUrl = await generateImageWithDeepAI(userData.message);
          // Display the generated image
          const imgElement = document.createElement("img");
          imgElement.src = deepUrl;
          imgElement.className = "generated-image";
          imgElement.alt = "Generated image";

          imgElement.onload = () => {
            textElement.innerHTML = "";
            textElement.appendChild(imgElement);

            const downloadBtn = document.createElement("button");
            downloadBtn.className = "download-btn neon-glow";
            downloadBtn.innerHTML = '<span class="material-symbols-rounded">download</span> Download Image';
            downloadBtn.onclick = () => {
              const link = document.createElement("a");
              link.href = deepUrl;
              link.download = `generated-image-${Date.now()}.png`;
              link.target = "_blank";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            };
            textElement.appendChild(downloadBtn);
          };
          waitForImageLoad(imgElement).then(() => {
            chatHistory.push({ type: 'bot-image', url: deepUrl, ts: Date.now() });
          }).catch(() => {});

          imgElement.onerror = async () => {
            // Next fallback: Hugging Face
            try {
              textElement.textContent = "Retrying via Hugging Face...";
              const hfUrl = await generateImageWithHF(userData.message);
              imgElement.src = hfUrl;
              return; // let onload handler take over
            } catch (_) {}

            // As a last resort, ask Gemini for a descriptive prompt, then try DeepAI again
            try {
              textElement.textContent = "Generating detailed image description with Gemini...";
              const geminiResponsePart = await generateImageWithGemini(userData.message);
              const responseText = geminiResponsePart.text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
              textElement.textContent = "Attempting to generate image from detailed description...";
              const finalUrl = await generateImageWithDeepAI(responseText);

              const finalImg = document.createElement("img");
              finalImg.className = "generated-image";
              finalImg.alt = "Generated image";
              finalImg.loading = "lazy";
              finalImg.decoding = "async";
              
              // Create placeholder
              const placeholder = document.createElement("div");
              placeholder.className = "image-placeholder";
              placeholder.innerHTML = `
                <div class="placeholder-spinner"></div>
                <p>Loading image...</p>
              `;
              textElement.innerHTML = "";
              textElement.appendChild(placeholder);
              
              finalImg.src = finalUrl;
              finalImg.onload = () => {
                placeholder.style.opacity = "0";
                placeholder.style.transition = "opacity 0.3s ease-out";
                
                setTimeout(() => {
                textElement.innerHTML = "";
                  finalImg.style.opacity = "0";
                textElement.appendChild(finalImg);
                  
                  requestAnimationFrame(() => {
                    finalImg.style.transition = "opacity 0.5s ease-in";
                    finalImg.style.opacity = "1";
                  });
                  
                const downloadBtn = document.createElement("button");
                  downloadBtn.className = "download-btn";
                  downloadBtn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">download</span> Download Image';
                  downloadBtn.setAttribute("aria-label", "Download generated image");
                downloadBtn.onclick = () => {
                  const link = document.createElement("a");
                  link.href = finalUrl;
                  link.download = `generated-image-${Date.now()}.png`;
                  link.target = "_blank";
                    link.rel = "noopener noreferrer";
                  document.body.appendChild(link);
                  link.click();
                    setTimeout(() => document.body.removeChild(link), 100);
                };
                textElement.appendChild(downloadBtn);
                  optimizedScrollToBottom();
                }, 300);
              };
              waitForImageLoad(finalImg).then(() => {
                chatHistory.push({ type: 'bot-image', url: finalUrl, ts: Date.now() });
              }).catch(() => {});
              finalImg.onerror = () => {
                textElement.innerHTML = `
                  <p>I couldn't generate an image, but here's a detailed description you can use with other tools:</p>
                  <p>${escapeHTML(responseText)}</p>
                `;
              };
            } catch (geminiError) {
              console.error("Gemini API error:", geminiError);
              textElement.textContent = `All image generation options failed. Error: ${geminiError.message}`;
              textElement.style.color = "var(--error-color)";
              botMsgDiv.classList.remove("loading");
              document.body.classList.remove("bot-responding");
            }
          };
        } catch (deepAIError) {
          // DeepAI also failed: try Gemini description then give text
          console.error("DeepAI API error:", deepAIError);
          try {
            textElement.textContent = "Generating detailed image description with Gemini...";
            const geminiResponsePart = await generateImageWithGemini(userData.message);
            const responseText = geminiResponsePart.text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
            textElement.innerHTML = `
              <p>I couldn't generate an image, but here's a detailed description you can use with other image generation tools:</p>
              <p>${escapeHTML(responseText)}</p>
            `;
          } catch (geminiError) {
            console.error("Gemini API error:", geminiError);
            textElement.textContent = `Both image generation services failed. Error: ${geminiError.message}`;
            textElement.style.color = "var(--error-color)";
            botMsgDiv.classList.remove("loading");
            document.body.classList.remove("bot-responding");
          }
        }
      }
    } else {
      // Handle regular text response using Gemini with enhanced prompts and context
      const systemInstruction = getSystemPrompt(userData.message);
      const conversationContext = buildConversationContext(chatHistory, 3); // Last 3 conversation pairs
      
      // Build the request payload with system instruction and conversation context
      const requestBody = {
        contents: [
          // Include conversation history if available
          ...conversationContext,
          // Current user message
          {
            role: "user",
            parts: [{
              text: userData.message
            }]
          }
        ],
        systemInstruction: {
          parts: [{
            text: systemInstruction
          }]
        },
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
          responseMimeType: "text/plain"
        }
      };

      // Wrap fetch in retry logic
      const fetchWithRetry = async () => {
        const response = await fetch(GEMINI_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
          throw new Error(error.error?.message || error.error || `HTTP ${response.status}`);
        }
        
        return response;
      };
      
      const response = await fetchWithRetry().catch(async (error) => {
        // Try auto-retry for network errors
        if (isRetryableError(error) && !controller.signal.aborted) {
          showToast('Network issue detected. Retrying...', 'warning', 2000);
          const retriedResponse = await autoRetry(fetchWithRetry, error);
          if (retriedResponse) return retriedResponse;
        }
        throw error;
      });
      
      const data = await response.json();
      if (!response.ok) {
        // Enhanced error handling
        const errorMsg = data.error?.message || data.error || `API Error: ${response.status}`;
        throw new Error(errorMsg);
      }
      
      // Process the response with better formatting
      const responsePart = data.candidates[0]?.content?.parts[0];
      if (!responsePart || !responsePart.text) {
        throw new Error("No response generated from AI");
      }
      
      // Enhanced text processing: preserve formatting while cleaning markdown
      let responseText = responsePart.text
        .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold markdown
        .replace(/\*([^*]+)\*/g, "$1") // Remove italic markdown
        .replace(/```[\s\S]*?```/g, (match) => match) // Preserve code blocks
        .trim();
      
      // Ensure proper line breaks for readability
      responseText = responseText.replace(/\n{3,}/g, '\n\n'); // Max 2 line breaks
      
      // Use typing effect for better UX, but add formatting support
      typingEffect(responseText, textElement, botMsgDiv);
      
      // Store original text for TTS (before formatting)
      botMsgDiv.dataset.originalText = responseText;
      
      chatHistory.push({ type: 'bot', text: responseText, ts: Date.now() });
      saveChatHistory(); // Auto-save after each response
      
      // Add TTS and copy controls after message is complete
      setTimeout(() => {
        addTTSControls(botMsgDiv, responseText);
        addCopyButton(botMsgDiv);
        
        // Apply formatting after typing completes
        if (textElement.textContent === responseText) {
          const formattedText = formatMessageText(responseText);
          if (formattedText && formattedText !== `<p>${responseText}</p>`) {
            textElement.innerHTML = formattedText;
          }
        }
      }, 100);
    }
  } catch (error) {
    console.error("API Error:", error);
    
    // Enhanced error handling with more helpful messages
    let errorMessage;
    if (error.name === "AbortError") {
      errorMessage = "Response generation stopped by user.";
    } else if (error.message.includes("API key")) {
      errorMessage = "API authentication error. Please check your API key in Security Settings.";
    } else if (error.message.includes("timeout") || error.message.includes("timed out")) {
      errorMessage = "The request took too long. Please try again with a simpler query.";
    } else if (error.message.includes("rate limit") || error.message.includes("quota")) {
      errorMessage = "API rate limit exceeded. Please wait a moment and try again.";
    } else if (error.message.includes("network") || error.message.includes("fetch")) {
      errorMessage = "Network error. Please check your internet connection and try again.";
    } else {
      errorMessage = `Sorry, I encountered an error: ${error.message}. Please try rephrasing your question or try again later.`;
    }
    
    textElement.textContent = errorMessage;
    textElement.style.color = "var(--error-color)";
    textElement.classList.add("error-message");
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
    optimizedScrollToBottom();
    
    // Add error to chat history
    chatHistory.push({ type: 'error', text: errorMessage, ts: Date.now() });
    
    // Add retry button
    addRetryButton(botMsgDiv, userData.message || promptInput.value);
    saveChatHistory();
    
    // Show network status if it's a network error
    if (error.message.includes("network") || error.message.includes("fetch")) {
      if (networkStatus) {
        networkStatus.classList.add("show");
        setTimeout(() => {
          networkStatus.classList.remove("show");
        }, 5000);
      }
    }
  } finally {
    userData.file = {};
  }
};

// Handle the form submission with enhanced security
const handleFormSubmit = (e) => {
  e.preventDefault();
  const userMessage = promptInput.value.trim();
  if (!userMessage || document.body.classList.contains("bot-responding")) return;
  
  // Apply enhanced input validation
  const sanitizedMessage = validateAndSanitizeInput(userMessage);
  if (!sanitizedMessage) return;
  
  // Check rate limiting
  try {
    rateLimiter.check();
  } catch (error) {
    const errorMsgDiv = createErrorMessageElement(error.message);
    chatsContainer.appendChild(errorMsgDiv);
    optimizedScrollToBottom();
    return;
  }

  // Handle secret command to set Hugging Face key: /set hf <key>
  if (userMessage.toLowerCase().startsWith('/set hf ')) {
    const key = userMessage.slice(8).trim();
    const ok = setHfApiKey(key);
    promptInput.value = "";
    showToast(ok ? 'HF key saved locally.' : 'Invalid key.', ok ? 'success' : 'error');
    return;
  }
  
  // Handle vehicle maintenance query
  if (userMessage.toLowerCase().includes('maintenance') && isVehicleQuery(userMessage)) {
    const vehicleType = userMessage.toLowerCase().includes('electric') || userMessage.toLowerCase().includes('ev') ? 'ev' : 
                       userMessage.toLowerCase().includes('hybrid') ? 'hybrid' : 'car';
    const schedule = generateMaintenanceSchedule(vehicleType);
    
    const scheduleList = schedule.map(item => 
      `<li><strong>${item.task}:</strong> ${item.interval}</li>`
    ).join('');
    
    const response = `
      <div class="avatar">
        <img src="${AVATAR_IMAGE_URL}" alt="Bot Avatar" class="avatar-image">
      </div>
      <div class="message-content">
        <p class="message-text"><strong>Vehicle Maintenance Schedule (${vehicleType.toUpperCase()}):</strong></p>
        <ul>${scheduleList}</ul>
        <p>Would you like more specific information about any of these maintenance tasks?</p>
      </div>
    `;
    
    promptInput.value = "";
    const botMsgDiv = createMessageElement(response, "bot-message");
    chatsContainer.appendChild(botMsgDiv);
    optimizedScrollToBottom();
    addTTSControls(botMsgDiv, response.replace(/<[^>]*>/g, ''));
    return;
  }
  
  // Handle vehicle comparison
  if (userMessage.toLowerCase().includes('compare') && isVehicleQuery(userMessage)) {
    const response = `
      <div class="avatar">
        <img src="${AVATAR_IMAGE_URL}" alt="Bot Avatar" class="avatar-image">
      </div>
      <div class="message-content">
        <p class="message-text"><strong>Vehicle Comparison:</strong></p>
        <table style="width:100%; border-collapse: collapse; margin: 10px 0;">
          <tr>
            <th style="border: 1px solid #444; padding: 8px; text-align: left;">Feature</th>
            <th style="border: 1px solid #444; padding: 8px; text-align: left;">Tesla Model 3</th>
            <th style="border: 1px solid #444; padding: 8px; text-align: left;">Toyota Camry</th>
          </tr>
          <tr>
            <td style="border: 1px solid #444; padding: 8px;">Type</td>
            <td style="border: 1px solid #444; padding: 8px;">Electric</td>
            <td style="border: 1px solid #444; padding: 8px;">Gasoline</td>
          </tr>
          <tr>
            <td style="border: 1px solid #444; padding: 8px;">Efficiency</td>
            <td style="border: 1px solid #444; padding: 8px;">120 MPGe</td>
            <td style="border: 1px solid #444; padding: 8px;">28 MPG</td>
          </tr>
          <tr>
            <td style="border: 1px solid #444; padding: 8px;">Range</td>
            <td style="border: 1px solid #444; padding: 8px;">272 miles</td>
            <td style="border: 1px solid #444; padding: 8px;">420 miles</td>
          </tr>
          <tr>
            <td style="border: 1px solid #444; padding: 8px;">Charging/Fueling</td>
            <td style="border: 1px solid #444; padding: 8px;">15 min (Supercharger)</td>
            <td style="border: 1px solid #444; padding: 8px;">5 min</td>
          </tr>
          <tr>
            <td style="border: 1px solid #444; padding: 8px;">Maintenance</td>
            <td style="border: 1px solid #444; padding: 8px;">Low</td>
            <td style="border: 1px solid #444; padding: 8px;">Medium</td>
          </tr>
          <tr>
            <td style="border: 1px solid #444; padding: 8px;">Emissions</td>
            <td style="border: 1px solid #444; padding: 8px;">0g/mile</td>
            <td style="border: 1px solid #444; padding: 8px;">350g/mile</td>
          </tr>
          <tr>
            <td style="border: 1px solid #444; padding: 8px;">Insurance</td>
            <td style="border: 1px solid #444; padding: 8px;">$1,500/year</td>
            <td style="border: 1px solid #444; padding: 8px;">$1,200/year</td>
          </tr>
          <tr>
            <td style="border: 1px solid #444; padding: 8px;">Depreciation</td>
            <td style="border: 1px solid #444; padding: 8px;">20%/year</td>
            <td style="border: 1px solid #444; padding: 8px;">15%/year</td>
          </tr>
        </table>
        <p>Would you like to compare different vehicles or get more details about any specific model?</p>
      </div>
    `;
    
    promptInput.value = "";
    const botMsgDiv = createMessageElement(response, "bot-message");
    chatsContainer.appendChild(botMsgDiv);
    optimizedScrollToBottom();
    addTTSControls(botMsgDiv, response.replace(/<[^>]*>/g, ''));
    return;
  }
  
  // Handle fuel cost calculation
  if ((userMessage.toLowerCase().includes('fuel cost') || userMessage.toLowerCase().includes('cost to drive')) && isVehicleQuery(userMessage)) {
    // Extract numbers from message
    const numbers = userMessage.match(/\d+/g);
    if (numbers && numbers.length >= 3) {
      const mpg = parseFloat(numbers[0]);
      const distance = parseFloat(numbers[1]);
      const fuelPrice = parseFloat(numbers[2]);
      
      const cost = calculateFuelCost(mpg, distance, fuelPrice);
      
      if (cost) {
        const response = `
          <div class="avatar">
            <img src="${AVATAR_IMAGE_URL}" alt="Bot Avatar" class="avatar-image">
          </div>
          <div class="message-content">
            <p class="message-text">Based on your inputs:
            <ul>
              <li>MPG: ${mpg}</li>
              <li>Distance: ${distance} miles</li>
              <li>Fuel Price: $${fuelPrice.toFixed(2)} per gallon</li>
              <li><strong>Estimated Fuel Cost: $${cost}</strong></li>
            </ul>
            Would you like to calculate for a different scenario?</p>
          </div>
        `;
        
        promptInput.value = "";
        const botMsgDiv = createMessageElement(response, "bot-message");
        chatsContainer.appendChild(botMsgDiv);
        optimizedScrollToBottom();
        addTTSControls(botMsgDiv, response.replace(/<[^>]*>/g, ''));
        return;
      }
    }
  }
  
  // Handle emission savings calculation
  if ((userMessage.toLowerCase().includes('emission') || userMessage.toLowerCase().includes('environmental impact')) && isVehicleQuery(userMessage)) {
    // Extract numbers from message
    const numbers = userMessage.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
      const gasMpg = parseFloat(numbers[0]);
      const distance = parseFloat(numbers[1]);
      
      const savings = calculateEmissionSavings(gasMpg, 120, distance); // Assuming 120 MPGe for EV
      
      const response = `
        <div class="avatar">
          <img src="${AVATAR_IMAGE_URL}" alt="Bot Avatar" class="avatar-image">
        </div>
        <div class="message-content">
          <p class="message-text"><strong>Environmental Impact Comparison:</strong></p>
          <ul>
            <li>Distance: ${distance} miles</li>
            <li>Gas Vehicle Emissions: ${savings.gasEmissions} kg CO2</li>
            <li>Electric Vehicle Emissions: ${savings.evEmissions} kg CO2</li>
            <li><strong>Emission Savings: ${savings.savings} kg CO2</strong></li>
          </ul>
          <p>Switching to an electric vehicle could save approximately ${savings.savings} kg of CO2 emissions for this trip!</p>
        </div>
      `;
      
      promptInput.value = "";
      const botMsgDiv = createMessageElement(response, "bot-message");
      chatsContainer.appendChild(botMsgDiv);
      optimizedScrollToBottom();
      addTTSControls(botMsgDiv, response.replace(/<[^>]*>/g, ''));
      return;
    }
  }
  
  // Handle insurance cost estimation
  if ((userMessage.toLowerCase().includes('insurance') || userMessage.toLowerCase().includes('cost')) && isVehicleQuery(userMessage)) {
    // Extract vehicle type, age, and value from message
    const lowerMessage = userMessage.toLowerCase();
    const vehicleType = lowerMessage.includes('electric') || lowerMessage.includes('ev') ? 'ev' : 
                       lowerMessage.includes('hybrid') ? 'hybrid' : 'car';
    
    // Extract numbers for age and value
    const numbers = userMessage.match(/\d+/g);
    let age = 'mid';
    let value = 0;
    
    if (numbers) {
      if (numbers.length >= 1) {
        const ageNum = parseInt(numbers[0]);
        if (ageNum <= 2) age = 'new';
        else if (ageNum <= 5) age = 'young';
        else if (ageNum <= 10) age = 'mid';
        else age = 'old';
      }
      
      if (numbers.length >= 2) {
        value = parseInt(numbers[1]) * 1000; // Assuming value is in thousands
      }
    }
    
    const insuranceCost = estimateInsuranceCost(vehicleType, age, value);
    
    const response = `
      <div class="avatar">
        <img src="${AVATAR_IMAGE_URL}" alt="Bot Avatar" class="avatar-image">
      </div>
      <div class="message-content">
        <p class="message-text"><strong>Insurance Cost Estimation:</strong></p>
        <ul>
          <li>Vehicle Type: ${vehicleType.toUpperCase()}</li>
          <li>Vehicle Age: ${age}</li>
          ${value > 0 ? `<li>Vehicle Value: $${value.toLocaleString()}</li>` : ''}
          <li><strong>Estimated Annual Insurance: $${insuranceCost}</strong></li>
        </ul>
        <p>Note: This is an estimate based on average rates. Actual costs may vary based on location, driving history, and other factors.</p>
      </div>
    `;
    
    promptInput.value = "";
    const botMsgDiv = createMessageElement(response, "bot-message");
    chatsContainer.appendChild(botMsgDiv);
    optimizedScrollToBottom();
    addTTSControls(botMsgDiv, response.replace(/<[^>]*>/g, ''));
    return;
  }
  
  // Show recent chats
  if (userMessage.toLowerCase() === '/recent') {
    promptInput.value = "";
    renderRecentChats();
    return;
  }
  userData.message = sanitizedMessage;
  promptInput.value = "";
  document.body.classList.add("chats-active", "bot-responding");
  fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");
  
  // Detect language of the user message
  const detectedLanguage = detectLanguage(sanitizedMessage);
  
  // Check if the message is in Kurdish
  const isKurdish = isKurdishText(userMessage);
  
  // Generate user message HTML with optional file attachment and language indicator
  const currentTimestamp = Date.now();
  const userMsgHTML = `
    <div class="avatar" aria-hidden="true">
      <img src="${AVATAR_IMAGE_URL}" alt="User Avatar" class="avatar-image">
    </div>
    <div class="message-content">
      <div class="message-header" aria-label="Message language: ${detectedLanguage}">
        <span class="language-indicator" aria-hidden="true">Language: ${detectedLanguage}</span>
        <span class="message-timestamp" aria-label="Sent ${formatTimestamp(currentTimestamp)}">${formatTimestamp(currentTimestamp)}</span>
      </div>
      <p class="message-text ${isKurdish ? 'kurdish-text' : ''}"></p>
      ${userData.file.data ? (userData.file.isImage ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" alt="Uploaded image" loading="lazy" decoding="async" />` : `<p class="file-attachment"><span class="material-symbols-rounded" aria-hidden="true">description</span>${userData.file.fileName}</p>`) : ""}
    </div>
  `;
  const userMsgDiv = createMessageElement(userMsgHTML, "user-message");
  userMsgDiv.querySelector(".message-text").textContent = userData.message;
  
  // Add copy button to user messages
  setTimeout(() => addCopyButton(userMsgDiv), 100);
  userMsgDiv.style.animation = "messageEntrance 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  chatsContainer.appendChild(userMsgDiv);
  optimizedScrollToBottom();
    chatHistory.push({ type: 'user', text: userData.message, ts: currentTimestamp });
    saveChatHistory(); // Auto-save after each message
  
  // Add typing indicator
  const typingIndicator = createTypingIndicator();
  chatsContainer.appendChild(typingIndicator);
  optimizedScrollToBottom();
  
  setTimeout(() => {
    // Remove typing indicator
    typingIndicator.remove();
    
    // Generate bot message HTML and add in the chat container
    const botTimestamp = Date.now();
    const botMsgHTML = `
      <div class="avatar">
        <img src="${AVATAR_IMAGE_URL}" alt="Bot Avatar" class="avatar-image">
      </div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-timestamp" aria-label="Responding at ${formatTimestamp(botTimestamp)}">${formatTimestamp(botTimestamp)}</span>
        </div>
        <p class="message-text">Just a sec...</p>
      </div>
    `;
    const botMsgDiv = createMessageElement(botMsgHTML, "bot-message", "loading");
    botMsgDiv.style.animation = "messageEntrance 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    chatsContainer.appendChild(botMsgDiv);
    optimizedScrollToBottom();
    generateResponse(botMsgDiv);
  }, CONFIG.ANIMATIONS.TYPING_INDICATOR_DELAY);
};

// File upload handler with drag & drop support
const handleFileUpload = (file) => {
  if (!file) return;
  
  // Validate file size
  if (file.size > CONFIG.LIMITS.FILE_SIZE) {
    showToast(`File size exceeds ${CONFIG.LIMITS.FILE_SIZE / (1024 * 1024)}MB limit. Please choose a smaller file.`, 'error');
    return;
  }
  
  // Validate file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    showToast('File type not allowed. Please upload an image, PDF, TXT, or CSV file.', 'error');
    return;
  }
  
  // Additional security check for file name
  const fileName = file.name;
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    showToast('Invalid file name. File name contains illegal characters.', 'error');
    return;
  }
  
  const isImage = file.type.startsWith("image/");
  const reader = new FileReader();
  
  // Show loading state
  fileUploadWrapper.classList.add("uploading");
  const existingStatus = fileUploadWrapper.querySelector('.file-upload-status');
  if (existingStatus) existingStatus.remove();
  
  const loadingText = document.createElement('div');
  loadingText.className = 'file-upload-status';
  loadingText.textContent = 'Reading file...';
  fileUploadWrapper.appendChild(loadingText);
  
  reader.readAsDataURL(file);
  reader.onload = (e) => {
    fileInput.value = "";
    const base64String = e.target.result.split(",")[1];
    
    // Additional validation of base64 content
    if (base64String.length > CONFIG.LIMITS.BASE64_SIZE) {
      showToast('File content too large after encoding.', 'error');
      fileUploadWrapper.classList.remove("uploading");
      loadingText.remove();
      return;
    }
    
    showToast('File attached successfully!', 'success');
    
    fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
    fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");
    fileUploadWrapper.classList.remove("uploading");
    loadingText.remove();
    
    // Store file data in userData obj
    userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage };
  };
  
  reader.onerror = () => {
    showToast('Failed to read file. Please try again.', 'error');
    fileInput.value = "";
    fileUploadWrapper.classList.remove("uploading");
    loadingText.remove();
  };
  
  reader.onprogress = (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      loadingText.textContent = `Reading file... ${percent}%`;
    }
  };
};

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  handleFileUpload(file);
});

// Drag & Drop functionality
const promptContainer = document.querySelector('.prompt-container');

if (promptContainer) {
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    promptContainer.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  // Visual feedback for drag over
  ['dragenter', 'dragover'].forEach(eventName => {
    promptContainer.addEventListener(eventName, () => {
      promptContainer.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    promptContainer.addEventListener(eventName, () => {
      promptContainer.classList.remove('drag-over');
    }, false);
  });

  // Handle dropped files
  promptContainer.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // Only handle first file
      handleFileUpload(files[0]);
    }
  }, false);
}

// Cancel file upload
document.querySelector("#cancel-file-btn").addEventListener("click", () => {
  userData.file = {};
  fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");
});

// Stop Bot Response with proper cleanup
const stopResponse = () => {
  controller?.abort();
  controller = null;
  userData.file = {};
  
  if (typingInterval) {
  clearInterval(typingInterval);
    typingInterval = null;
  }
  
  const loadingBotMsg = chatsContainer.querySelector(".bot-message.loading");
  if (loadingBotMsg) {
    loadingBotMsg.classList.remove("loading");
    const textEl = loadingBotMsg.querySelector(".message-text");
    if (textEl) {
      textEl.textContent = "Response generation stopped.";
    }
  }
  document.body.classList.remove("bot-responding");
};

document.querySelector("#stop-response-btn")?.addEventListener("click", stopResponse);

// Toggle dark/light theme
themeToggleBtn.addEventListener("click", () => {
  const isLightTheme = document.body.classList.toggle("light-theme");
  localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
  themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";
  
  // Add a visual effect when toggling theme
  themeToggleBtn.style.transform = "scale(1.2)";
  setTimeout(() => {
    themeToggleBtn.style.transform = "scale(1)";
  }, 300);
});

// Language selection
if (languageSelect) {
  languageSelect.addEventListener('change', (e) => {
    const lang = e.target.value;
    localStorage.setItem('appLanguage', lang);
    applyI18n(lang);
    renderSuggestions(lang);
  });
}

// Export chat history
document.querySelector("#export-chats-btn")?.addEventListener("click", () => {
  showExportMenu();
});

// Voice input toggle
document.querySelector("#voice-input-btn")?.addEventListener("click", () => {
  toggleVoiceInput();
});

// Delete all chats with better UX
document.querySelector("#delete-chats-btn").addEventListener("click", () => {
  if (chatHistory.length === 0) {
    showToast('No chat history to clear.', 'info');
    return;
  }
  
    // Create a custom confirmation
    const confirmDelete = () => {
    chatHistory.length = 0;
    chatsContainer.innerHTML = "";
    document.body.classList.remove("chats-active", "bot-responding");
      clearSavedChatHistory();
      showToast('Chat history cleared successfully!', 'success');
    };
    
    // Use browser confirm for now, but show toast
    if (confirm("Are you sure you want to clear the chat history?")) {
      confirmDelete();
    }
});

  // Enhanced keyboard shortcuts and navigation
  document.addEventListener('keydown', (e) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    const target = e.target;
    const isInputFocused = target === promptInput || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    
    // Escape key: Close modals, sidebars
    if (e.key === 'Escape') {
      if (sidebar?.classList.contains('open')) {
        closeSidebar();
        e.preventDefault();
        return;
      }
      if (securityPanel?.classList.contains('open')) {
        securityPanel.classList.remove('open');
        e.preventDefault();
        return;
      }
      if (document.querySelector('.export-menu')?.classList.contains('show')) {
        document.querySelector('.export-menu')?.classList.remove('show');
        setTimeout(() => document.querySelector('.export-menu')?.remove(), 300);
        e.preventDefault();
        return;
      }
      if (document.querySelector('.image-zoom-viewer')?.classList.contains('show')) {
        document.querySelector('.image-zoom-viewer')?.classList.remove('show');
        e.preventDefault();
        return;
      }
      // Focus back to input
      if (!isInputFocused) {
        promptInput?.focus();
      }
    }
    
    // Ctrl/Cmd + K: Focus input (works everywhere)
    if (isCtrl && e.key === 'k') {
      e.preventDefault();
      promptInput?.focus();
      return;
    }
    
    // Ctrl/Cmd + /: Toggle theme (works everywhere)
    if (isCtrl && e.key === '/') {
      e.preventDefault();
      themeToggleBtn?.click();
      return;
    }
    
    // Ctrl/Cmd + E: Export chat (works everywhere)
    if (isCtrl && e.key === 'e') {
      e.preventDefault();
      document.querySelector("#export-chats-btn")?.click();
      return;
    }
    
    // Ctrl/Cmd + Shift + D: Clear chat (works everywhere)
    if (isCtrl && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      document.querySelector("#delete-chats-btn")?.click();
      return;
    }
    
    // Ctrl/Cmd + Shift + M: Toggle voice input (works everywhere)
    if (isCtrl && e.shiftKey && e.key === 'M') {
      e.preventDefault();
      document.querySelector("#voice-input-btn")?.click();
      return;
    }
    
    // Arrow Up: Edit last message (when input is focused and empty)
    if (e.key === 'ArrowUp' && isInputFocused && promptInput.value === '') {
      const lastUserMessage = chatHistory.filter(msg => msg.type === 'user').pop();
      if (lastUserMessage) {
        e.preventDefault();
        promptInput.value = lastUserMessage.text;
        showToast('Last message loaded. Edit and press Enter to send.', 'info', 2000);
      }
    }
 });

// Show/hide controls for mobile on prompt input focus
document.addEventListener("click", ({ target }) => {
  const wrapper = document.querySelector(".prompt-wrapper");
  const shouldHide = target.classList.contains("prompt-input") || (wrapper.classList.contains("hide-controls") && (target.id === "add-file-btn" || target.id === "stop-response-btn"));
  wrapper.classList.toggle("hide-controls", shouldHide);
});

// Add event listeners for form submission and file input click
promptForm.addEventListener("submit", handleFormSubmit);
promptForm.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());

// Add keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Ctrl + Enter to submit
  if (e.ctrlKey && e.key === "Enter") {
    promptForm.dispatchEvent(new Event("submit"));
  }
  
  // Escape to stop response
  if (e.key === "Escape" && document.body.classList.contains("bot-responding")) {
    document.querySelector("#stop-response-btn").click();
  }

  // Block common DevTools/view-source shortcuts
  const key = e.key?.toLowerCase();
  const isCtrl = e.ctrlKey || e.metaKey; // meta for macOS
  const isShift = e.shiftKey;
  // F12
  if (key === 'f12') { e.preventDefault(); e.stopPropagation(); }
  // Ctrl+Shift+I/J/C
  if (isCtrl && isShift && (key === 'i' || key === 'j' || key === 'c')) { e.preventDefault(); e.stopPropagation(); }
  // Ctrl+U (view source)
  if (isCtrl && key === 'u') { e.preventDefault(); e.stopPropagation(); }
  // Optional: block print/save (Ctrl+P / Ctrl+S)
  if (isCtrl && (key === 'p' || key === 's')) { e.preventDefault(); e.stopPropagation(); }
});

// Focus input on page load
window.addEventListener("load", () => {
  promptInput.focus();
  initLanguage();
});

// Network status event listeners
window.addEventListener('online', () => {
  isOnline = true;
  if (networkStatus) {
    networkStatus.classList.remove('show');
  }
});

window.addEventListener('offline', () => {
  isOnline = false;
  if (networkStatus) {
    networkStatus.classList.add('show');
  }
});

// Disable right-click context menu
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// Sidebar controls
const openSidebar = () => {
  if (!sidebar || !sidebarOverlay) return;
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('show');
};
const closeSidebar = () => {
  if (!sidebar || !sidebarOverlay) return;
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
};
sidebarToggleBtn?.addEventListener('click', openSidebar);
sidebarOverlay?.addEventListener('click', closeSidebar);
document.querySelector('.sidebar-close')?.addEventListener('click', closeSidebar);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sidebar?.classList.contains('open')) closeSidebar();
});
document.getElementById('sidebar-clear-chats')?.addEventListener('click', () => {
  document.getElementById('delete-chats-btn')?.click();
  closeSidebar();
});
document.querySelector('.sidebar-nav [data-action="recent"]')?.addEventListener('click', () => {
  renderRecentChats();
  closeSidebar();
});
document.querySelector('.sidebar-nav [data-action="theme"]')?.addEventListener('click', () => {
  themeToggleBtn?.click();
});

// Back button
backBtn?.addEventListener('click', () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    // Fallback: focus input
    promptInput.focus();
  }
});

// Security panel functionality
const securityPanel = document.getElementById('security-panel');
const securityPanelClose = document.querySelector('.security-panel-close');
const sidebarSecurityBtn = document.getElementById('sidebar-security');

// Open security panel
sidebarSecurityBtn?.addEventListener('click', () => {
  // Close sidebar first
  closeSidebar();
  
  // Open security panel
  if (securityPanel) {
    securityPanel.classList.add('open');
  }
});

// Close security panel
securityPanelClose?.addEventListener('click', () => {
  if (securityPanel) {
    securityPanel.classList.remove('open');
  }
});

// Close security panel when clicking overlay
document.addEventListener('click', (e) => {
  if (securityPanel && securityPanel.classList.contains('open') && 
      e.target === securityPanel) {
    securityPanel.classList.remove('open');
  }
});

// Close security panel with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && securityPanel?.classList.contains('open')) {
    securityPanel.classList.remove('open');
  }
});

// Save API keys functionality
document.getElementById('save-gemini-key')?.addEventListener('click', () => {
  const keyInput = document.getElementById('gemini-api-key');
  if (keyInput && keyInput.value.trim()) {
    if (setApiKeys(keyInput.value.trim(), null)) {
      showToast('Gemini API key saved successfully!', 'success');
      keyInput.value = '';
    } else {
      showToast('Failed to save Gemini API key. Please try again.', 'error');
    }
  }
});

document.getElementById('save-deepai-key')?.addEventListener('click', () => {
  const keyInput = document.getElementById('deepai-api-key');
  if (keyInput && keyInput.value.trim()) {
    if (setApiKeys(null, keyInput.value.trim())) {
      showToast('DeepAI API key saved successfully!', 'success');
      keyInput.value = '';
    } else {
      showToast('Failed to save DeepAI API key. Please try again.', 'error');
    }
  }
});

document.getElementById('save-hf-key')?.addEventListener('click', () => {
  const keyInput = document.getElementById('hf-api-key');
  if (keyInput && keyInput.value.trim()) {
    if (setHfApiKey(keyInput.value.trim())) {
      showToast('Hugging Face API key saved successfully!', 'success');
      keyInput.value = '';
    } else {
      showToast('Failed to save Hugging Face API key. Please try again.', 'error');
    }
  }
});

// Clear all API keys
document.getElementById('clear-all-keys')?.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all saved API keys?')) {
    try {
      localStorage.removeItem('geminiApiKey');
      localStorage.removeItem('deepAiApiKey');
      localStorage.removeItem('hfApiKey');
      showToast('All API keys have been cleared successfully!', 'success');
    } catch (e) {
      console.error('Failed to clear API keys:', e);
      showToast('Failed to clear API keys. Please try again.', 'error');
    }
  }
});

// Performance: Lazy load images with optimized observer
const lazyLoadImages = () => {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            // Add loading class for fade-in effect
            img.classList.add('loading');
            
            // Create a new image to preload
            const preloadImg = new Image();
            preloadImg.onload = () => {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              img.classList.remove('loading');
              img.classList.add('loaded');
            };
            preloadImg.onerror = () => {
              img.classList.remove('loading');
              img.classList.add('error');
            };
            preloadImg.src = img.dataset.src;
          }
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px', // Start loading 50px before image enters viewport
      threshold: 0.01
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  } else {
    // Fallback for browsers without IntersectionObserver
    document.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
  }
};


// Add welcome message
document.addEventListener("DOMContentLoaded", () => {
  const welcomeTimestamp = Date.now();
  const welcomeMsgHTML = `
    <div class="avatar" aria-hidden="true">
      <img src="${AVATAR_IMAGE_URL}" alt="Bot Avatar" class="avatar-image">
    </div>
    <div class="message-content">
      <div class="message-header" aria-label="Message language: English">
        <span class="language-indicator" aria-hidden="true">Language: English</span>
        <span class="message-timestamp" aria-label="Sent ${formatTimestamp(welcomeTimestamp)}">${formatTimestamp(welcomeTimestamp)}</span>
      </div>
      <p class="message-text">Hello! I'm your zansti sardam institute AI assistant. How can I help you today? You can ask me anything, generate images, or upload files for analysis.</p>
    </div>
  `;
  const welcomeMsgDiv = createMessageElement(welcomeMsgHTML, "bot-message");
  chatsContainer.appendChild(welcomeMsgDiv);
  
  // Add copy button to welcome message
  setTimeout(() => {
    addCopyButton(welcomeMsgDiv);
    addTTSControls(welcomeMsgDiv, welcomeMsgDiv.querySelector('.message-text').textContent);
    welcomeMsgDiv.style.opacity = "1";
    welcomeMsgDiv.style.transform = "translateY(0)";
  }, 100);
  
  // Load saved chat history
  const hasHistory = loadChatHistory();
  if (hasHistory) {
    renderLoadedChatHistory();
  }
  
  // Initialize lazy loading
  lazyLoadImages();
  
  // Create particle effects for logo
  createLogoParticles();
  
  // Initialize voice recognition
  initSpeechRecognition();
  
  // Add image zoom handlers
  setTimeout(() => {
    addImageZoomHandlers();
    // Observer for new images
    const observer = new MutationObserver(() => {
      addImageZoomHandlers();
    });
    observer.observe(chatsContainer, { childList: true, subtree: true });
  }, 500);
  
  // Performance: Preconnect to critical domains
  if ('connection' in navigator) {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection && connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      // Reduce animations on slow connections
      document.body.classList.add('slow-connection');
    }
  }
  
  // Announce page load to screen readers
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';
  announcement.textContent = 'zansti sardam AI Chatbot loaded. Ready to assist.';
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    if (document.body.contains(announcement)) {
      document.body.removeChild(announcement);
    }
  }, 3000);
});

// Create particle effects around logo
const createLogoParticles = () => {
  const logoContainer = document.querySelector('.logo-container');
  if (!logoContainer || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  
  const particleCount = 8;
  const particles = [];
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    const angle = (360 / particleCount) * i;
    const distance = 80;
    const tx = Math.cos(angle * Math.PI / 180) * distance;
    const ty = Math.sin(angle * Math.PI / 180) * distance;
    particle.style.setProperty('--tx', `${tx}px`);
    particle.style.setProperty('--ty', `${ty}px`);
    particle.style.animationDelay = `${i * 0.5}s`;
    logoContainer.appendChild(particle);
    particles.push(particle);
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    particles.forEach(p => p.remove());
  });
};

// ==========================================
// TEXT-TO-SPEECH FUNCTIONALITY
// ==========================================

// Add TTS controls to bot messages
const addTTSControls = (messageElement, textContent) => {
  if (!textContent || !messageElement) return;
  
  // Check if browser supports Web Speech API
  if (!('speechSynthesis' in window)) return;
  
  const messageContent = messageElement.querySelector('.message-content');
  if (!messageContent) return;
  
  // Check if TTS controls already exist
  if (messageContent.querySelector('.tts-controls')) return;
  
  // Create TTS controls container
  const ttsControls = document.createElement('div');
  ttsControls.className = 'tts-controls';
  ttsControls.innerHTML = `
    <button class="tts-btn" aria-label="Read message aloud" title="Read message">
      <span class="material-symbols-rounded" aria-hidden="true">volume_up</span>
    </button>
    <button class="tts-stop-btn" style="display: none;" aria-label="Stop reading" title="Stop reading">
      <span class="material-symbols-rounded" aria-hidden="true">stop</span>
    </button>
  `;
  
  const playBtn = ttsControls.querySelector('.tts-btn');
  const stopBtn = ttsControls.querySelector('.tts-stop-btn');
  let currentUtterance = null;
  
  playBtn.addEventListener('click', () => {
    if (currentUtterance && speechSynthesis.speaking) {
      speechSynthesis.cancel();
      return;
    }
    
    // Clean text for speech
    const cleanText = textContent
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]+`/g, '') // Remove inline code
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .trim();
    
    if (!cleanText) return;
    
    // Create speech utterance
    currentUtterance = new SpeechSynthesisUtterance(cleanText);
    
    // Detect language and set voice
    const detectedLang = detectLanguage(cleanText);
    let lang = 'en-US';
    if (detectedLang.includes('Arabic') || detectedLang.includes('العربية')) {
      lang = 'ar-SA';
    } else if (detectedLang.includes('Kurdish')) {
      lang = 'ckb'; // Kurdish Sorani
    }
    
    currentUtterance.lang = lang;
    currentUtterance.rate = 1.0;
    currentUtterance.pitch = 1.0;
    currentUtterance.volume = 0.8;
    
    // Event handlers
    currentUtterance.onstart = () => {
      playBtn.style.display = 'none';
      stopBtn.style.display = 'inline-flex';
      messageElement.classList.add('speaking');
    };
    
    currentUtterance.onend = () => {
      playBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'none';
      messageElement.classList.remove('speaking');
      currentUtterance = null;
    };
    
    currentUtterance.onerror = () => {
      playBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'none';
      messageElement.classList.remove('speaking');
      currentUtterance = null;
      showToast('Text-to-speech failed. Please try again.', 'error');
    };
    
    speechSynthesis.speak(currentUtterance);
  });
  
  stopBtn.addEventListener('click', () => {
    speechSynthesis.cancel();
    playBtn.style.display = 'inline-flex';
    stopBtn.style.display = 'none';
    messageElement.classList.remove('speaking');
    currentUtterance = null;
  });
  
  messageContent.appendChild(ttsControls);
};

// ==========================================
// COPY TO CLIPBOARD FUNCTIONALITY
// ==========================================

// Copy message text to clipboard
const copyToClipboard = async (text, button) => {
  try {
    const cleanText = text.replace(/<[^>]*>/g, '').trim();
    await navigator.clipboard.writeText(cleanText);
    
    // Visual feedback
    if (button) {
      const originalHTML = button.innerHTML;
      button.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">check</span>';
      button.classList.add('copied');
      setTimeout(() => {
        button.innerHTML = originalHTML;
        button.classList.remove('copied');
      }, 2000);
    }
    
    showToast('Message copied to clipboard!', 'success');
  } catch (err) {
    console.error('Failed to copy:', err);
    showToast('Failed to copy message', 'error');
  }
};

// Add copy button to messages
const addCopyButton = (messageElement) => {
  const messageContent = messageElement.querySelector('.message-content');
  if (!messageContent || messageContent.querySelector('.copy-btn')) return;
  
  const messageText = messageElement.querySelector('.message-text');
  if (!messageText) return;
  
  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.setAttribute('aria-label', 'Copy message');
  copyBtn.title = 'Copy message';
  copyBtn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">content_copy</span>';
  
  copyBtn.addEventListener('click', () => {
    copyToClipboard(messageText.textContent || messageText.innerHTML, copyBtn);
  });
  
  messageContent.appendChild(copyBtn);
};

// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================

// Show toast notification
const showToast = (message, type = 'info', duration = 3000) => {
  // Remove existing toasts
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(toast => toast.remove());
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  
  const iconMap = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info'
  };
  
  toast.innerHTML = `
    <span class="material-symbols-rounded toast-icon" aria-hidden="true">${iconMap[type] || iconMap.info}</span>
    <span class="toast-message">${escapeHTML(message)}</span>
    <button class="toast-close" aria-label="Close notification">
      <span class="material-symbols-rounded" aria-hidden="true">close</span>
    </button>
  `;
  
  document.body.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // Auto-remove
  const timeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
  
  // Manual close
  toast.querySelector('.toast-close').addEventListener('click', () => {
    clearTimeout(timeout);
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  });
};

// ==========================================
// ENHANCED MESSAGE FORMATTING
// ==========================================

// Format message text with better markdown support
const formatMessageText = (text) => {
  if (!text) return '';
  
  // Preserve code blocks first
  const codeBlocks = [];
  let processedText = text.replace(/```([\s\S]*?)```/g, (match, code) => {
    const index = codeBlocks.length;
    codeBlocks.push(`<pre class="code-block"><code>${escapeHTML(code.trim())}</code></pre>`);
    return `__CODE_BLOCK_${index}__`;
  });
  
  // Preserve inline code
  const inlineCodes = [];
  processedText = processedText.replace(/`([^`]+)`/g, (match, code) => {
    const index = inlineCodes.length;
    inlineCodes.push(`<code class="inline-code">${escapeHTML(code)}</code>`);
    return `__INLINE_CODE_${index}__`;
  });
  
  // Format lists
  processedText = processedText.replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>');
  processedText = processedText.replace(/(<li>.*<\/li>)/s, '<ul class="message-list">$1</ul>');
  
  // Format numbered lists
  processedText = processedText.replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>');
  
  // Format bold (preserving existing)
  processedText = processedText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  processedText = processedText.replace(/(\*\*)([^*]+)(\*\*)/g, '<strong>$2</strong>');
  
  // Format italic
  processedText = processedText.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  
  // Format links
  processedText = processedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Restore code blocks and inline code
  codeBlocks.forEach((block, index) => {
    processedText = processedText.replace(`__CODE_BLOCK_${index}__`, block);
  });
  inlineCodes.forEach((code, index) => {
    processedText = processedText.replace(`__INLINE_CODE_${index}__`, code);
  });
  
  // Format line breaks
  processedText = processedText.replace(/\n\n/g, '</p><p>');
  processedText = processedText.replace(/\n/g, '<br>');
  
  return `<p>${processedText}</p>`;
};

// Format timestamp
const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
};

// ==========================================
// CHAT PERSISTENCE
// ==========================================

// Save chat history to localStorage
const saveChatHistory = () => {
  try {
    localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(chatHistory));
  } catch (e) {
    console.error('Failed to save chat history:', e);
    showToast('Failed to save chat history. Storage may be full.', 'warning');
  }
};

// Load chat history from localStorage
const loadChatHistory = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
    if (saved) {
      const parsed = JSON.parse(saved);
      chatHistory.push(...parsed);
      return parsed.length > 0;
    }
  } catch (e) {
    console.error('Failed to load chat history:', e);
  }
  return false;
};

// Clear saved chat history
const clearSavedChatHistory = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
  } catch (e) {
    console.error('Failed to clear saved chat history:', e);
  }
};

// Render loaded chat history
const renderLoadedChatHistory = () => {
  if (chatHistory.length === 0) return;
  
  chatHistory.forEach((item) => {
    if (item.type === 'user') {
      const userMsgHTML = `
        <div class="avatar" aria-hidden="true">
          <img src="${AVATAR_IMAGE_URL}" alt="User Avatar" class="avatar-image">
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-timestamp">${formatTimestamp(item.ts)}</span>
          </div>
          <p class="message-text">${escapeHTML(item.text)}</p>
        </div>
      `;
      const userMsgDiv = createMessageElement(userMsgHTML, "user-message");
      chatsContainer.appendChild(userMsgDiv);
      setTimeout(() => addCopyButton(userMsgDiv), 50);
    } else if (item.type === 'bot') {
      const botMsgHTML = `
        <div class="avatar">
          <img src="${AVATAR_IMAGE_URL}" alt="Bot Avatar" class="avatar-image">
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-timestamp">${formatTimestamp(item.ts)}</span>
          </div>
          <p class="message-text">${escapeHTML(item.text)}</p>
        </div>
      `;
      const botMsgDiv = createMessageElement(botMsgHTML, "bot-message");
      chatsContainer.appendChild(botMsgDiv);
      setTimeout(() => {
        addTTSControls(botMsgDiv, item.text);
        addCopyButton(botMsgDiv);
      }, 50);
    } else if (item.type === 'bot-image' && item.url) {
      const imgHTML = `
        <div class="avatar">
          <img src="${AVATAR_IMAGE_URL}" alt="Bot Avatar" class="avatar-image">
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-timestamp">${formatTimestamp(item.ts)}</span>
          </div>
          <img src="${item.url}" class="generated-image" alt="Generated image" loading="lazy" />
        </div>
      `;
      const imgMsgDiv = createMessageElement(imgHTML, "bot-message");
      chatsContainer.appendChild(imgMsgDiv);
    }
  });
  
  optimizedScrollToBottom();
  if (chatHistory.length > 0) {
    document.body.classList.add("chats-active");
  }
};

// ==========================================
// EXPORT CHAT HISTORY
// ==========================================

// Export chat history as JSON
const exportChatHistoryJSON = () => {
  if (chatHistory.length === 0) {
    showToast('No chat history to export.', 'info');
    return;
  }
  
  const dataStr = JSON.stringify(chatHistory, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `zansti-chat-history-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Chat history exported as JSON!', 'success');
};

// Export chat history as TXT
const exportChatHistoryTXT = () => {
  if (chatHistory.length === 0) {
    showToast('No chat history to export.', 'info');
    return;
  }
  
  let text = 'zansti sardam Chat History Export\n';
  text += `Generated: ${new Date().toLocaleString()}\n`;
  text += '='.repeat(50) + '\n\n';
  
  chatHistory.forEach((item, index) => {
    const timestamp = new Date(item.ts).toLocaleString();
    text += `[${timestamp}] ${item.type.toUpperCase()}:\n`;
    
    if (item.type === 'user' || item.type === 'bot') {
      text += `${item.text}\n`;
    } else if (item.type === 'bot-image') {
      text += `Image: ${item.url}\n`;
    } else if (item.type === 'error') {
      text += `Error: ${item.text}\n`;
    }
    
    text += '\n' + '-'.repeat(50) + '\n\n';
  });
  
  const dataBlob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `zansti-chat-history-${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Chat history exported as TXT!', 'success');
};

// Export menu handler
const showExportMenu = () => {
  if (chatHistory.length === 0) {
    showToast('No chat history to export.', 'info');
    return;
  }
  
  // Create export menu
  const menu = document.createElement('div');
  menu.className = 'export-menu';
  menu.innerHTML = `
    <div class="export-menu-header">
      <h3>Export Chat History</h3>
      <button class="export-menu-close" aria-label="Close menu">
        <span class="material-symbols-rounded">close</span>
      </button>
    </div>
    <div class="export-menu-options">
      <button class="export-option" data-format="json">
        <span class="material-symbols-rounded">code</span>
        <span>Export as JSON</span>
      </button>
      <button class="export-option" data-format="txt">
        <span class="material-symbols-rounded">description</span>
        <span>Export as TXT</span>
      </button>
    </div>
  `;
  
  document.body.appendChild(menu);
  
  // Close menu handlers
  const closeMenu = () => {
    menu.classList.remove('show');
    setTimeout(() => menu.remove(), 300);
  };
  
  menu.querySelector('.export-menu-close').addEventListener('click', closeMenu);
  menu.addEventListener('click', (e) => {
    if (e.target.closest('.export-option')) {
      const format = e.target.closest('.export-option').dataset.format;
      closeMenu();
      if (format === 'json') {
        exportChatHistoryJSON();
      } else if (format === 'txt') {
        exportChatHistoryTXT();
      }
    }
  });
  
  // Show menu with animation
  requestAnimationFrame(() => menu.classList.add('show'));
};

// ==========================================
// VOICE INPUT (SPEECH RECOGNITION)
// ==========================================

// Initialize speech recognition
const initSpeechRecognition = () => {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    return false;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US'; // Default, will be adjusted based on selected language
  
  recognition.onstart = () => {
    isListening = true;
    const voiceBtn = document.getElementById('voice-input-btn');
    if (voiceBtn) {
      voiceBtn.classList.add('listening');
      voiceBtn.innerHTML = '<span class="material-symbols-rounded">mic</span>';
    }
    showToast('Listening...', 'info', 2000);
    promptInput.placeholder = 'Listening...';
  };
  
  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }
    
    // Update input with interim results
    if (interimTranscript) {
      promptInput.value = finalTranscript + interimTranscript;
    }
    
    // If final result, submit
    if (finalTranscript.trim()) {
      promptInput.value = finalTranscript.trim();
      // Auto-submit after short delay
      setTimeout(() => {
        if (promptInput.value.trim()) {
          promptForm.dispatchEvent(new Event('submit'));
        }
      }, 500);
    }
  };
  
  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    isListening = false;
    const voiceBtn = document.getElementById('voice-input-btn');
    if (voiceBtn) {
      voiceBtn.classList.remove('listening');
      voiceBtn.innerHTML = '<span class="material-symbols-rounded">mic</span>';
    }
    promptInput.placeholder = 'Message zansti sardam ...';
    
    let errorMsg = 'Voice input error. ';
    switch(event.error) {
      case 'no-speech':
        errorMsg += 'No speech detected.';
        break;
      case 'audio-capture':
        errorMsg += 'Microphone not accessible.';
        break;
      case 'not-allowed':
        errorMsg += 'Microphone permission denied.';
        break;
      default:
        errorMsg += 'Please try again.';
    }
    showToast(errorMsg, 'error');
  };
  
  recognition.onend = () => {
    isListening = false;
    const voiceBtn = document.getElementById('voice-input-btn');
    if (voiceBtn) {
      voiceBtn.classList.remove('listening');
      voiceBtn.innerHTML = '<span class="material-symbols-rounded">mic</span>';
    }
    promptInput.placeholder = 'Message zansti sardam ...';
  };
  
  return true;
};

// Toggle voice input
const toggleVoiceInput = () => {
  if (!recognition) {
    if (!initSpeechRecognition()) {
      showToast('Voice input is not supported in your browser.', 'error');
      return;
    }
  }
  
  if (isListening) {
    recognition.stop();
    isListening = false;
  } else {
    // Update language based on selected language
    const lang = languageSelect?.value || 'en';
    if (lang === 'ar') {
      recognition.lang = 'ar-SA';
    } else if (lang === 'ckb') {
      recognition.lang = 'ku'; // Kurdish
    } else {
      recognition.lang = 'en-US';
    }
    
    recognition.start();
  }
};

// ==========================================
// IMAGE ZOOM VIEWER
// ==========================================

// Create image zoom viewer
const createImageZoomViewer = (imageUrl) => {
  const viewer = document.createElement('div');
  viewer.className = 'image-zoom-viewer';
  viewer.innerHTML = `
    <div class="image-zoom-content">
      <button class="image-zoom-close" aria-label="Close image viewer">
        <span class="material-symbols-rounded">close</span>
      </button>
      <img src="${imageUrl}" alt="Zoomed image" class="zoomed-image" />
      <div class="image-zoom-actions">
        <button class="image-zoom-action" aria-label="Download image" title="Download">
          <span class="material-symbols-rounded">download</span>
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(viewer);
  
  // Close handler
  const closeViewer = () => {
    viewer.classList.remove('show');
    setTimeout(() => viewer.remove(), 300);
  };
  
  viewer.querySelector('.image-zoom-close').addEventListener('click', closeViewer);
  viewer.addEventListener('click', (e) => {
    if (e.target === viewer) closeViewer();
  });
  
  // Download handler
  viewer.querySelector('.image-zoom-action').addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `image-${Date.now()}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
  
  // Show with animation
  requestAnimationFrame(() => viewer.classList.add('show'));
  
  // Keyboard close
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeViewer();
      document.removeEventListener('keydown', handleKeyDown);
    }
  };
  document.addEventListener('keydown', handleKeyDown);
};

// Add click handler to images
const addImageZoomHandlers = () => {
  document.querySelectorAll('.generated-image, .img-attachment').forEach(img => {
    if (!img.dataset.zoomAdded) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', () => {
        createImageZoomViewer(img.src);
      });
      img.dataset.zoomAdded = 'true';
    }
  });
};

// ==========================================
// RETRY FUNCTIONALITY
// ==========================================

// Add retry button to error messages
const addRetryButton = (errorElement, originalMessage) => {
  const retryBtn = document.createElement('button');
  retryBtn.className = 'retry-btn';
  retryBtn.innerHTML = '<span class="material-symbols-rounded">refresh</span> Retry';
  retryBtn.setAttribute('aria-label', 'Retry request');
  
  retryBtn.addEventListener('click', () => {
    errorElement.remove();
    // Resubmit the original message
    promptInput.value = originalMessage;
    promptForm.dispatchEvent(new Event('submit'));
  });
  
  const messageContent = errorElement.querySelector('.message-content');
  if (messageContent) {
    messageContent.appendChild(retryBtn);
  }
};