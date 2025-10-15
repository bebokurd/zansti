const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggleBtn = document.querySelector("#theme-toggle-btn");

// API Setup
const GEMINI_API_KEY = "AIzaSyCq2YpHXbY90aMIZmCgll4QxfKIcAU4rWY";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_IMAGE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${GEMINI_API_KEY}`;

// DeepAI API Setup (for image generation)
const DEEP_AI_API_URL = "https://api.deepai.org/api/text2img";
const DEEP_AI_API_KEY = "b32201ab-245b-4103-b5e5-73823fcb11a8";

let controller, typingInterval;
const chatHistory = [];
const userData = { message: "", file: {} };

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

// Function to generate image using DeepAI API
const generateImageWithDeepAI = async (prompt) => {
  try {
    const formData = new FormData();
    formData.append('text', prompt);
    
    const response = await fetch(DEEP_AI_API_URL, {
      method: "POST",
      headers: {
        "api-key": DEEP_AI_API_KEY,
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`DeepAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.output_url) {
      throw new Error("DeepAI API returned no image URL");
    }
    
    return data.output_url;
  } catch (error) {
    console.error("DeepAI API error:", error);
    throw error;
  }
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
  return lowerMessage.includes("image") || 
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
        // Try DeepAI first
        textElement.textContent = "Generating image with DeepAI... This may take up to 30 seconds.";
        const imageUrl = await generateImageWithDeepAI(userData.message);
        
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
          // Handle image loading error
          textElement.innerHTML = `
            <p>Image generated successfully but failed to load preview.</p>
            <p><a href="${imageUrl}" target="_blank">Click here to view the image</a></p>
            <button class="download-btn" onclick="window.open('${imageUrl}', '_blank')">
              <span class="material-symbols-rounded">open_in_new</span> View Image
            </button>
          `;
        };
      } catch (deepAIError) {
        // Fallback to Gemini image generation if DeepAI fails
        console.error("DeepAI API error:", deepAIError);
        textElement.textContent = `DeepAI failed (${deepAIError.message}), trying Gemini...`;
        
        try {
          // Use Gemini for image description
          textElement.textContent = "Generating detailed image description with Gemini...";
          const geminiResponsePart = await generateImageWithGemini(userData.message);
          
          // Handle Gemini response (which will be a text description)
          const responseText = geminiResponsePart.text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
          
          // Try to generate image from the description using DeepAI again
          textElement.textContent = "Attempting to generate image from detailed description...";
          try {
            const imageUrl = await generateImageWithDeepAI(responseText);
            
            // Display the generated image
            const imgElement = document.createElement("img");
            imgElement.src = imageUrl;
            imgElement.className = "generated-image";
            imgElement.alt = "Generated image";
            
            imgElement.onload = () => {
              textElement.innerHTML = `
                <p>Here's the image based on your request:</p>
              `;
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
              // If image fails, show the description
              textElement.innerHTML = `
                <p>I couldn't generate an image, but here's a detailed description you can use with other tools:</p>
                <p>${responseText}</p>
              `;
            };
          } catch (secondDeepAIError) {
            // If second DeepAI attempt fails, just show the description
            textElement.innerHTML = `
              <p>I couldn't generate an image, but here's a detailed description you can use with other image generation tools:</p>
              <p>${responseText}</p>
            `;
          }
        } catch (geminiError) {
          // If both fail, show error message
          console.error("Gemini API error:", geminiError);
          textElement.textContent = `Both image generation services failed. Error: ${geminiError.message}`;
          textElement.style.color = "var(--error-color)";
          botMsgDiv.classList.remove("loading");
          document.body.classList.remove("bot-responding");
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
});

// Focus input on page load
window.addEventListener("load", () => {
  promptInput.focus();
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