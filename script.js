const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggleBtn = document.querySelector("#theme-toggle-btn");
const languageSelect = document.querySelector("#language-select");
const suggestionsContainer = document.querySelector(".suggestions");

// API Setup
const GEMINI_API_KEY = "AIzaSyCq2YpHXbY90aMIZmCgll4QxfKIcAU4rWY";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_IMAGE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${GEMINI_API_KEY}`;

// DeepAI API Setup (for image generation)
const DEEP_AI_API_URL = "https://api.deepai.org/api/text2img";
const DEEP_AI_API_KEY = "b32201ab-245b-4103-b5e5-73823fcb11a8";

// Pollinations API (browser-friendly, no key, good CORS)
const POLLINATIONS_BASE_URL = "https://image.pollinations.ai/prompt/";

// Hugging Face Inference API (optional, user-provided key)
// Key is NOT hardcoded; it can be provided at runtime via `/set hf <key>` command
const getHfApiKey = () => localStorage.getItem('hfApiKey') || '';
const setHfApiKey = (key) => {
  if (typeof key === 'string' && key.trim()) {
    localStorage.setItem('hfApiKey', key.trim());
    return true;
  }
  return false;
};
const HF_DEFAULT_MODEL = "stabilityai/stable-diffusion-2-1";

let controller, typingInterval;
const chatHistory = [];
const userData = { message: "", file: {} };

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
    { text: "How do I make an HTTP request in JavaScript?", icon: "code" },
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
    suggestion.addEventListener("click", () => {
      const text = suggestion.querySelector(".text")?.textContent || "";
      promptInput.value = text;
      promptForm.dispatchEvent(new Event("submit"));
    });
    suggestion.addEventListener("mouseenter", () => { suggestion.style.transform = "translateY(-10px)"; });
    suggestion.addEventListener("mouseleave", () => { suggestion.style.transform = "translateY(0)"; });
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

// Function to detect language of a text
const detectLanguage = (text) => {
  // Remove extra whitespace and get a clean text sample
  const cleanText = text.trim().toLowerCase();
  
  // If text is empty, return default
  if (cleanText.length === 0) return 'Unknown';
  
  // Define regex patterns for different scripts and languages
  const arabicRegex = /[\u0600-\u06FF]/g;
  const kurdishSoraniSpecific = /[\u0698\u06A9\u06AF\u067E\u0686]/g; // Specific Kurdish characters
  const englishRegex = /[a-zA-Z]/g;
  
  // Common words for language detection
  const englishCommonWords = ['the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must'];
  const arabicCommonWords = ['الذي', 'التي', 'أن', 'إن', 'من', 'على', 'في', 'إلى', 'عن', 'على', 'مع', 'بعد', 'قبل', 'أثناء', 'منذ', 'لأن', 'حتى', 'كل', 'جميع', 'بعض', 'أي', 'ما', 'كيف', 'متى', 'أين', 'почему', 'как', 'что', 'кто'];
  
  // Check for Kurdish (Sorani) first as it uses Arabic script with specific characters
  const kurdishChars = cleanText.match(kurdishSoraniSpecific);
  if (kurdishChars && kurdishChars.length > 0) {
    return 'Kurdish (Sorani)';
  }
  
  // Check for Arabic script
  const arabicChars = cleanText.match(arabicRegex);
  if (arabicChars && arabicChars.length > 3) { // At least 3 Arabic characters to be considered Arabic
    // Check for common Arabic words
    const arabicWords = arabicCommonWords.some(word => cleanText.includes(word));
    if (arabicWords) {
      return 'Arabic';
    }
    return 'Arabic';
  }
  
  // Check for English/Latin script
  const englishChars = cleanText.match(englishRegex);
  if (englishChars && englishChars.length > 3) { // At least 3 English characters
    // Check for common English words
    const englishWords = englishCommonWords.some(word => cleanText.includes(word));
    if (englishWords) {
      return 'English';
    }
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

// Scroll to the bottom of the container
const scrollToBottom = () => container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });

// Simulate typing effect for bot responses
const typingEffect = (text, textElement, botMsgDiv) => {
  textElement.textContent = "";
  const words = text.split(" ");
  let wordIndex = 0;
  // Set an interval to type each word
  typingInterval = setInterval(() => {
    if (wordIndex < words.length) {
      textElement.textContent += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
      scrollToBottom();
    } else {
      clearInterval(typingInterval);
      botMsgDiv.classList.remove("loading");
      document.body.classList.remove("bot-responding");
    }
  }, 30); // 30 ms delay for smoother typing
};

// Create typing indicator
const createTypingIndicator = () => {
  const typingDiv = document.createElement("div");
  typingDiv.classList.add("message", "bot-message", "typing-indicator");
  typingDiv.innerHTML = `
    <div class="avatar">
      <img src="https://i.ibb.co/21jpMNhw/234421810-326887782452132-7028869078528396806-n-removebg-preview-1.png" alt="Bot Avatar" class="avatar-image">
    </div>
    <div class="typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
  return typingDiv;
};

// Sanitize and normalize prompts for image models
const sanitizePrompt = (text) => {
  if (!text) return "";
  return String(text)
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, 800); // keep under typical provider limits
};

// Promise timeout helper
const withTimeout = (promise, ms, onTimeoutMessage = "Operation timed out") => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(onTimeoutMessage)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

// Helper to construct a Pollinations image URL
const buildPollinationsImageUrl = (prompt) => {
  const params = new URLSearchParams({
    width: "1024",
    height: "1024",
    nologo: "true",
    enhance: "true"
  });
  return `${POLLINATIONS_BASE_URL}${encodeURIComponent(sanitizePrompt(prompt))}?${params.toString()}`;
};

// Helper to load an image and await success/failure
const waitForImageLoad = (img, timeoutMs = 25000) => withTimeout(new Promise((resolve, reject) => {
  const onLoad = () => { cleanup(); resolve(); };
  const onError = (e) => { cleanup(); reject(e); };
  const cleanup = () => {
    img.removeEventListener("load", onLoad);
    img.removeEventListener("error", onError);
  };
  img.addEventListener("load", onLoad);
  img.addEventListener("error", onError);
}), timeoutMs, "Image load timed out");

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
  const modelId = options.modelId || HF_DEFAULT_MODEL;
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
  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(modelId)}`;
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
      const res = await withTimeout(req, 60000, "Hugging Face request timed out");
      if (res.status === 503) {
        // Model loading/warmup
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
      // quick verify load
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
      const req = fetch(DEEP_AI_API_URL, {
        method: "POST",
        headers: { "api-key": DEEP_AI_API_KEY },
        body: formData,
        signal: abortController.signal
      });

      const response = await withTimeout(req, 30000, "DeepAI request timed out");
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
      const GEMINI_FLASH_IMAGE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(GEMINI_FLASH_IMAGE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [{
            role: "user",
            parts: [{
              text: `Please provide a detailed description for generating an image based on: ${prompt}. Include specific visual details, colors, style, and composition.`
            }]
          }]
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
      
      try {
        // Try Pollinations first for fast, keyless generation
        textElement.textContent = "Generating image...";
        let imageUrl = await generateImageWithPollinations(userData.message);
        
        // Display the generated image
        const imgElement = document.createElement("img");
        imgElement.src = imageUrl;
        imgElement.className = "generated-image";
        imgElement.alt = "Generated image";
        
        imgElement.onload = () => {
          // Image loaded successfully
          textElement.innerHTML = "";
          textElement.appendChild(imgElement);
          
          // Add download button
          const downloadBtn = document.createElement("button");
          downloadBtn.className = "download-btn neon-glow";
          downloadBtn.innerHTML = '<span class="material-symbols-rounded">download</span> Download Image';
          downloadBtn.onclick = () => {
            const link = document.createElement("a");
            link.href = imageUrl;
            link.download = `generated-image-${Date.now()}.png`;
            link.target = "_blank";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          };
          textElement.appendChild(downloadBtn);
        };
        
        imgElement.onerror = () => {
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
              finalImg.src = finalUrl;
              finalImg.className = "generated-image";
              finalImg.alt = "Generated image";
              finalImg.onload = () => {
                textElement.innerHTML = "";
                textElement.appendChild(finalImg);
                const downloadBtn = document.createElement("button");
                downloadBtn.className = "download-btn neon-glow";
                downloadBtn.innerHTML = '<span class="material-symbols-rounded">download</span> Download Image';
                downloadBtn.onclick = () => {
                  const link = document.createElement("a");
                  link.href = finalUrl;
                  link.download = `generated-image-${Date.now()}.png`;
                  link.target = "_blank";
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                };
                textElement.appendChild(downloadBtn);
              };
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
      // Handle regular text response using Gemini
      const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [{
            role: "user",
            parts: [{
              text: userData.message
            }]
          }]
        }),
        signal: controller.signal,
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error.message);
      
      // Process the response
      const responsePart = data.candidates[0].content.parts[0];
      const responseText = responsePart.text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
      typingEffect(responseText, textElement, botMsgDiv);
    }
  } catch (error) {
    textElement.textContent = error.name === "AbortError" ? "Response generation stopped." : `Error: ${error.message}`;
    textElement.style.color = "var(--error-color)";
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
    scrollToBottom();
  } finally {
    userData.file = {};
  }
};

// Handle the form submission
const handleFormSubmit = (e) => {
  e.preventDefault();
  const userMessage = promptInput.value.trim();
  if (!userMessage || document.body.classList.contains("bot-responding")) return;

  // Handle secret command to set Hugging Face key: /set hf <key>
  if (userMessage.toLowerCase().startsWith('/set hf ')) {
    const key = userMessage.slice(8).trim();
    const ok = setHfApiKey(key);
    promptInput.value = "";
    const systemMsg = createMessageElement(`
      <div class="avatar">
        <img src="https://i.ibb.co/21jpMNhw/234421810-326887782452132-7028869078528396806-n-removebg-preview-1.png" alt="Bot Avatar" class="avatar-image">
      </div>
      <div class="message-content">
        <p class="message-text">${ok ? 'HF key saved locally.' : 'Invalid key.'}</p>
      </div>
    `, "bot-message");
    chatsContainer.appendChild(systemMsg);
    scrollToBottom();
    return;
  }
  userData.message = userMessage;
  promptInput.value = "";
  document.body.classList.add("chats-active", "bot-responding");
  fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");
  
  // Detect language of the user message
  const detectedLanguage = detectLanguage(userMessage);
  
  // Generate user message HTML with optional file attachment and language indicator
  const userMsgHTML = `
    <div class="avatar">
      <img src="https://i.ibb.co/21jpMNhw/234421810-326887782452132-7028869078528396806-n-removebg-preview-1.png" alt="User Avatar" class="avatar-image">
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="language-indicator">Language: ${detectedLanguage}</span>
      </div>
      <p class="message-text"></p>
      ${userData.file.data ? (userData.file.isImage ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" />` : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`) : ""}
    </div>
  `;
  const userMsgDiv = createMessageElement(userMsgHTML, "user-message");
  userMsgDiv.querySelector(".message-text").textContent = userData.message;
  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();
  
  // Add typing indicator
  const typingIndicator = createTypingIndicator();
  chatsContainer.appendChild(typingIndicator);
  scrollToBottom();
  
  setTimeout(() => {
    // Remove typing indicator
    typingIndicator.remove();
    
    // Generate bot message HTML and add in the chat container
    const botMsgHTML = `
      <div class="avatar">
        <img src="https://i.ibb.co/21jpMNhw/234421810-326887782452132-7028869078528396806-n-removebg-preview-1.png" alt="Bot Avatar" class="avatar-image">
      </div>
      <div class="message-content">
        <p class="message-text">Just a sec...</p>
      </div>
    `;
    const botMsgDiv = createMessageElement(botMsgHTML, "bot-message", "loading");
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();
    generateResponse(botMsgDiv);
  }, 800); // 800 ms delay
};

// Handle file input change (file upload)
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const isImage = file.type.startsWith("image/");
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (e) => {
    fileInput.value = "";
    const base64String = e.target.result.split(",")[1];
    fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
    fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");
    // Store file data in userData obj
    userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage };
  };
});

// Cancel file upload
document.querySelector("#cancel-file-btn").addEventListener("click", () => {
  userData.file = {};
  fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");
});

// Stop Bot Response
document.querySelector("#stop-response-btn").addEventListener("click", () => {
  controller?.abort();
  userData.file = {};
  clearInterval(typingInterval);
  const loadingBotMsg = chatsContainer.querySelector(".bot-message.loading");
  if (loadingBotMsg) {
    loadingBotMsg.classList.remove("loading");
    loadingBotMsg.querySelector(".message-text").textContent = "Response generation stopped.";
  }
  document.body.classList.remove("bot-responding");
});

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

// Delete all chats
document.querySelector("#delete-chats-btn").addEventListener("click", () => {
  if (confirm("Are you sure you want to clear the chat history?")) {
    chatHistory.length = 0;
    chatsContainer.innerHTML = "";
    document.body.classList.remove("chats-active", "bot-responding");
  }
});

// Handle suggestions click
document.querySelectorAll(".suggestions-item").forEach((suggestion) => {
  suggestion.addEventListener("click", () => {
    promptInput.value = suggestion.querySelector(".text").textContent;
    promptForm.dispatchEvent(new Event("submit"));
  });
  
  // Add hover effect to suggestions
  suggestion.addEventListener("mouseenter", () => {
    suggestion.style.transform = "translateY(-10px)";
  });
  
  suggestion.addEventListener("mouseleave", () => {
    suggestion.style.transform = "translateY(0)";
  });
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

// Disable right-click context menu
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// Add welcome message
document.addEventListener("DOMContentLoaded", () => {
  const welcomeMsgHTML = `
    <div class="avatar">
      <img src="https://i.ibb.co/21jpMNhw/234421810-326887782452132-7028869078528396806-n-removebg-preview-1.png" alt="Bot Avatar" class="avatar-image">
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="language-indicator">Language: English</span>
      </div>
      <p class="message-text">Hello! I'm your zansti sardam institute AI assistant. How can I help you today? You can ask me anything, generate images, or upload files for analysis.</p>
    </div>
  `;
  const welcomeMsgDiv = createMessageElement(welcomeMsgHTML, "bot-message");
  chatsContainer.appendChild(welcomeMsgDiv);
  
  // Add subtle animation to welcome message
  setTimeout(() => {
    welcomeMsgDiv.style.opacity = "1";
    welcomeMsgDiv.style.transform = "translateY(0)";
  }, 100);
});