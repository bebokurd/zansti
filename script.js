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
const GEMINI_IMAGE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

// DeepAI API Setup (for image generation)
const DEEP_AI_API_URL = "https://api.deepai.org/api/text2img";
const DEEP_AI_API_KEY = "b32201ab-245b-4103-b5e5-73823fcb11a8";

let controller, typingInterval;
const chatHistory = [];
const userData = { message: "", file: {} };

// Set initial theme from local storage
const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";

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
    <div class="avatar">G</div>
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
    throw new Error(`DeepAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.output_url;
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
         lowerMessage.includes("illustration");
};

// Make the API call and generate the bot's response
const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector(".message-text");
  controller = new AbortController();
  
  // Check if this is an image generation request
  const imageRequest = isImageGenerationRequest(userData.message);
  
  // Add user message and file data to the chat history
  chatHistory.push({
    role: "user",
    parts: [{ text: userData.message }, ...(userData.file.data ? [{ inline_data: (({ fileName, isImage, ...rest }) => rest)(userData.file) }] : [])],
  });
  
  try {
    if (imageRequest) {
      // Handle image generation request
      textElement.textContent = "Generating your image... This may take a moment.";
      
      try {
        // First, get an enhanced prompt from Gemini
        const promptEnhancementResponse = await fetch(GEMINI_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{
                text: `Enhance this image prompt for better results: "${userData.message}". Provide only the enhanced prompt without any additional text.`
              }]
            }]
          })
        });
        
        const promptData = await promptEnhancementResponse.json();
        if (promptEnhancementResponse.ok) {
          const enhancedPrompt = promptData.candidates[0].content.parts[0].text.trim();
          textElement.textContent = `Generating image with prompt: "${enhancedPrompt}"`;
          
          // Generate image using DeepAI API
          const imageUrl = await generateImageWithDeepAI(enhancedPrompt);
          
          // Display the generated image
          const imgElement = document.createElement("img");
          imgElement.src = imageUrl;
          imgElement.className = "generated-image";
          imgElement.alt = "Generated image";
          textElement.innerHTML = "";
          textElement.appendChild(imgElement);
          
          // Add download button
          const downloadBtn = document.createElement("button");
          downloadBtn.className = "download-btn";
          downloadBtn.innerHTML = '<span class="material-symbols-rounded">download</span> Download Image';
          downloadBtn.onclick = () => {
            const link = document.createElement("a");
            link.href = imageUrl;
            link.download = `generated-image-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          };
          textElement.appendChild(downloadBtn);
        } else {
          throw new Error("Failed to enhance prompt");
        }
      } catch (deepAIError) {
        // Fallback to Gemini image generation if DeepAI fails
        console.error("DeepAI API error:", deepAIError);
        textElement.textContent = "Using alternative image generation method...";
        
        // Use Gemini for image generation
        const response = await fetch(GEMINI_IMAGE_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: chatHistory }),
          signal: controller.signal,
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error.message);
        
        // Process the response
        const responsePart = data.candidates[0].content.parts[0];
        
        if (responsePart.inlineData) {
          // Handle image response
          const imageData = responsePart.inlineData.data;
          const imageMimeType = responsePart.inlineData.mimeType;
          const imgElement = document.createElement("img");
          imgElement.src = `data:${imageMimeType};base64,${imageData}`;
          imgElement.className = "generated-image";
          imgElement.alt = "Generated image";
          textElement.innerHTML = "";
          textElement.appendChild(imgElement);
        }
      }
    } else {
      // Handle regular text response using Gemini
      const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: chatHistory }),
        signal: controller.signal,
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error.message);
      
      // Process the response
      const responsePart = data.candidates[0].content.parts[0];
      const responseText = responsePart.text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
      typingEffect(responseText, textElement, botMsgDiv);
      
      chatHistory.push({ role: "model", parts: [responsePart] });
    }
  } catch (error) {
    textElement.textContent = error.name === "AbortError" ? "Response generation stopped." : error.message;
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
  
  // Generate user message HTML with optional file attachment
  const userMsgHTML = `
    <div class="avatar">You</div>
    <div class="message-content">
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
    const botMsgHTML = `<div class="avatar">G</div><div class="message-content"><p class="message-text">Just a sec...</p></div>`;
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
    <div class="avatar">G</div>
    <div class="message-content">
      <p class="message-text">Hello! I'm your Gemini AI assistant. How can I help you today? You can ask me anything, generate images, or upload files for analysis.</p>
    </div>
  `;
  const welcomeMsgDiv = createMessageElement(welcomeMsgHTML, "bot-message");
  chatsContainer.appendChild(welcomeMsgDiv);
});