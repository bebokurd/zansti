/**
 * DoodStream File Uploader - JavaScript Implementation
 * Built by 01 dev for advanced AI coding research
 * 
 * Features:
 * - Local file upload to DoodAPI
 * - Drag & drop support
 * - Progress tracking
 * - Rate limiting compliance
 * - Error handling
 */

class DoodUploader {
    constructor() {
        this.apiKey = '';
        this.selectedFiles = new Map();
        this.uploadQueue = [];
        this.uploadResults = [];
        this.failedUploads = [];
        this.isUploading = false;
        this.rateLimit = 100; // 100ms between requests to stay under 10/second
        this.maxRetries = 3;
        this.maxConcurrentUploads = 2; // Batch processing optimization
        this.uploadQueue = new Map(); // Track upload status
        this.analytics = {
            totalFiles: 0,
            successCount: 0,
            errorCount: 0,
            retryCount: 0,
            startTime: null,
            endTime: null
        };
        
        this.initializeElements();
        this.bindEvents();
        this.loadApiKey();
        this.initializeKeyboardShortcuts();
    }

    initializeElements() {
        this.elements = {
            apiKey: document.getElementById('apiKey'),
            toggleKey: document.getElementById('toggleKey'),
            uploadArea: document.getElementById('uploadArea'),
            fileInput: document.getElementById('fileInput'),
            fileList: document.getElementById('fileList'),
            uploadBtn: document.getElementById('uploadBtn'),
            clearBtn: document.getElementById('clearBtn'),
            statusDisplay: document.getElementById('statusDisplay'),
            resultsList: document.getElementById('resultsList'),
            copyAllLinks: document.getElementById('copyAllLinks'),
            copyAllEmbeds: document.getElementById('copyAllEmbeds'),
            exportResults: document.getElementById('exportResults'),
            retryBtn: document.getElementById('retryBtn'),
            analyticsDisplay: document.getElementById('analyticsDisplay'),
            progressOverlay: document.getElementById('progressOverlay'),
            progressText: document.getElementById('progressText'),
            progressDetail: document.getElementById('progressDetail')
        };
    }

    bindEvents() {
        // API Key management
        this.elements.apiKey.addEventListener('input', (e) => {
            this.apiKey = e.target.value.trim();
            this.saveApiKey();
            this.updateUploadButton();
        });

        this.elements.toggleKey.addEventListener('click', () => {
            const input = this.elements.apiKey;
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            this.elements.toggleKey.textContent = isPassword ? '🙈' : '👁️';
        });

        // File selection
        this.elements.fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });

        // Drag and drop
        this.elements.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.add('dragover');
        });

        this.elements.uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.remove('dragover');
        });

        this.elements.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.remove('dragover');
            this.handleFileSelection(e.dataTransfer.files);
        });

        // Control buttons
        this.elements.uploadBtn.addEventListener('click', () => {
            this.startUpload();
        });

        this.elements.clearBtn.addEventListener('click', () => {
            this.clearAllFiles();
        });

        // Results management
        this.elements.copyAllLinks.addEventListener('click', () => {
            this.copyAllLinks();
        });

        this.elements.copyAllEmbeds.addEventListener('click', () => {
            this.copyAllEmbeds();
        });

        this.elements.exportResults.addEventListener('click', () => {
            this.exportResults();
        });

        // Retry functionality
        if (this.elements.retryBtn) {
            this.elements.retryBtn.addEventListener('click', () => {
                this.retryFailedUploads();
            });
        }

        // File validation on selection
        this.elements.fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });
    }

    loadApiKey() {
        const savedKey = localStorage.getItem('doodapi_key');
        if (savedKey) {
            this.elements.apiKey.value = savedKey;
            this.apiKey = savedKey;
        }
        this.updateUploadButton();
    }

    saveApiKey() {
        if (this.apiKey) {
            localStorage.setItem('doodapi_key', this.apiKey);
        } else {
            localStorage.removeItem('doodapi_key');
        }
    }

    handleFileSelection(files) {
        const validFiles = this.validateFiles(files);
        
        validFiles.forEach(file => {
            if (!this.selectedFiles.has(file.name)) {
                this.selectedFiles.set(file.name, file);
                this.addFileToList(file);
            }
        });
        
        this.updateUploadButton();
        this.elements.fileInput.value = ''; // Reset input
        this.updateAnalytics();
    }

    addFileToList(file) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-info">
                <span>📄</span>
                <span>${file.name}</span>
                <span class="file-size">(${this.formatFileSize(file.size)})</span>
            </div>
            <button class="remove-file" onclick="uploader.removeFile('${file.name}')">✖️</button>
        `;
        this.elements.fileList.appendChild(fileItem);
    }

    removeFile(fileName) {
        this.selectedFiles.delete(fileName);
        this.updateFileList();
        this.updateUploadButton();
    }

    clearAllFiles() {
        this.selectedFiles.clear();
        this.uploadResults = [];
        this.updateFileList();
        this.updateUploadButton();
        this.updateStatus('Ready to upload files...');
        this.elements.resultsList.innerHTML = '';
    }

    updateFileList() {
        this.elements.fileList.innerHTML = '';
        this.selectedFiles.forEach(file => {
            this.addFileToList(file);
        });
    }

    updateUploadButton() {
        const hasFiles = this.selectedFiles.size > 0;
        const hasApiKey = this.apiKey.length > 0;
        this.elements.uploadBtn.disabled = !hasFiles || !hasApiKey || this.isUploading;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    updateStatus(message, type = 'info') {
        const statusHtml = `
            <div class="status-message ${type}">
                <strong>${new Date().toLocaleTimeString()}</strong>: ${message}
            </div>
        `;
        this.elements.statusDisplay.innerHTML = statusHtml + this.elements.statusDisplay.innerHTML;
    }

    async startUpload() {
        if (this.isUploading) return;
        
        this.isUploading = true;
        this.analytics.startTime = new Date();
        this.analytics.totalFiles = this.selectedFiles.size;
        this.failedUploads = [];
        this.updateUploadButton();
        this.showProgressOverlay();
        
        try {
            this.updateProgressText('Initializing upload...', 'Preparing for file transfer');
            
            // Get upload server
            this.updateProgressText('Getting upload server...', 'Connecting to DoodStream API');
            const serverInfo = await this.getUploadServerWithRetry();
            if (!serverInfo) {
                throw new Error('Failed to get upload server after retries');
            }

            this.updateStatus(`📡 Upload server obtained: ${serverInfo}`, 'success');
            
            // Upload files with optimized batch processing
            let currentFile = 1;
            const fileEntries = Array.from(this.selectedFiles.entries());
            
            // Process files in batches for better performance
            for (let i = 0; i < fileEntries.length; i += this.maxConcurrentUploads) {
                const batch = fileEntries.slice(i, i + this.maxConcurrentUploads);
                const batchPromises = batch.map(async ([fileName, file]) => {
                    const fileIndex = fileEntries.findIndex(([name]) => name === fileName) + 1;
                    this.updateProgressText(
                        `Uploading batch ${Math.ceil(fileIndex / this.maxConcurrentUploads)}/${Math.ceil(fileEntries.length / this.maxConcurrentUploads)}`,
                        `${fileName} (${this.formatFileSize(file.size)})`
                    );
                    
                    return this.uploadFileWithRetry(file, serverInfo, fileName);
                });
                
                // Wait for current batch to complete before starting next
                await Promise.all(batchPromises);
                
                // Rate limiting delay between batches
                if (i + this.maxConcurrentUploads < fileEntries.length) {
                    await this.delay(this.rateLimit * this.maxConcurrentUploads);
                }
            }
            
            this.analytics.endTime = new Date();
            const duration = (this.analytics.endTime - this.analytics.startTime) / 1000;
            
            this.updateProgressText('Upload Complete!', `${this.analytics.successCount} files uploaded successfully`);
            await this.delay(1500); // Show completion message
            
            this.updateStatus(`🎉 Upload complete! Success: ${this.analytics.successCount}, Errors: ${this.analytics.errorCount}, Duration: ${duration.toFixed(1)}s`, 'info');
            this.updateAnalyticsDisplay();
            
            if (this.failedUploads.length > 0) {
                this.showRetryOption();
            }
            
        } catch (error) {
            this.updateStatus(`❌ Upload process failed: ${error.message}`, 'error');
        } finally {
            this.isUploading = false;
            this.hideProgressOverlay();
            this.updateUploadButton();
        }
    }

    async getUploadServer() {
        try {
            const response = await fetch(`https://doodapi.co/api/upload/server?key=${this.apiKey}`);
            const data = await response.json();
            
            if (data.status === 200) {
                return data.result;
            } else {
                throw new Error(data.msg || 'Failed to get upload server');
            }
        } catch (error) {
            console.error('Error getting upload server:', error);
            return null;
        }
    }

    async uploadFile(file, uploadServer) {
        const formData = new FormData();
        formData.append('api_key', this.apiKey);
        formData.append('file', file);

        const uploadUrl = `${uploadServer}?${this.apiKey}`;

        try {
            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    addUploadResult(result, success) {
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${success ? 'success' : 'error'}`;
        
        if (success) {
            const embedCode = this.generateEmbedCode(result);
            const iframeCode = this.generateIframeCode(result);
            
            resultItem.innerHTML = `
                <h4>✅ ${result.title}</h4>
                <div class="result-details">
                    <p><strong>File Code:</strong> ${result.filecode}</p>
                    <p><strong>Size:</strong> ${this.formatFileSize(result.size)}</p>
                    <p><strong>Length:</strong> ${result.length} seconds</p>
                    <p><strong>Uploaded:</strong> ${result.uploaded}</p>
                </div>
                
                <div class="result-links">
                    <a href="${result.download_url}" target="_blank">📥 Download</a>
                    <a href="${result.protected_embed}" target="_blank">🎬 Embed</a>
                    <a href="${result.protected_dl}" target="_blank">🔒 Protected DL</a>
                    <a href="${result.single_img}" target="_blank">🖼️ Thumbnail</a>
                    <a href="${result.splash_img}" target="_blank">🎨 Splash</a>
                </div>
                
                <div class="quick-actions">
                    <button class="quick-action" onclick="uploader.copyToClipboard('${result.download_url}')">Copy Download Link</button>
                    <button class="quick-action" onclick="uploader.copyToClipboard('${result.protected_embed}')">Copy Embed Link</button>
                    <button class="quick-action" onclick="uploader.copyToClipboard('${result.filecode}')">Copy File Code</button>
                </div>
                
                <div class="embed-section">
                    <h5>📝 Embed Codes</h5>
                    
                    <strong>HTML Embed:</strong>
                    <div class="code-block">
                        <button class="copy-code-btn" onclick="uploader.copyToClipboard(\`${embedCode}\`)">Copy</button>${embedCode}</div>
                    
                    <strong>iframe Embed:</strong>
                    <div class="code-block">
                        <button class="copy-code-btn" onclick="uploader.copyToClipboard(\`${iframeCode}\`)">Copy</button>${iframeCode}</div>
                    
                    <strong>Discord Embed (for bots):</strong>
                    <div class="code-block">
                        <button class="copy-code-btn" onclick="uploader.copyDiscordEmbed('${result.title}', '${result.download_url}', '${result.single_img}')">Copy</button>{
  "title": "${result.title}",
  "url": "${result.download_url}",
  "thumbnail": {
    "url": "${result.single_img}"
  },
  "fields": [
    {
      "name": "File Size",
      "value": "${this.formatFileSize(result.size)}",
      "inline": true
    },
    {
      "name": "Duration",
      "value": "${result.length}s",
      "inline": true
    }
  ]
}</div>
                </div>
            `;
        } else {
            resultItem.innerHTML = `
                <h4>❌ ${result.title}</h4>
                <p><strong>Error:</strong> ${result.error}</p>
            `;
        }
        
        this.elements.resultsList.appendChild(resultItem);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Generate HTML embed code
    generateEmbedCode(result) {
        return `<iframe width="560" height="315" src="${result.protected_embed}" frameborder="0" allowfullscreen></iframe>`;
    }

    // Generate iframe embed code
    generateIframeCode(result) {
        return `<iframe src="${result.protected_embed}" width="100%" height="400" frameborder="0" allowfullscreen></iframe>`;
    }

    // Copy text to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('📋 Copied to clipboard!', 'success');
        } catch (err) {
            console.error('Failed to copy:', err);
            this.showToast('❌ Failed to copy to clipboard', 'error');
        }
    }

    // Copy Discord embed format
    async copyDiscordEmbed(title, url, thumbnail) {
        const discordEmbed = {
            title: title,
            url: url,
            thumbnail: {
                url: thumbnail
            },
            color: 0x667eea,
            timestamp: new Date().toISOString(),
            footer: {
                text: "DoodStream Upload - 01 dev"
            }
        };
        
        await this.copyToClipboard(JSON.stringify(discordEmbed, null, 2));
    }

    // Copy all download links
    async copyAllLinks() {
        if (this.uploadResults.length === 0) {
            this.updateStatus('⚠️ No upload results to copy', 'error');
            return;
        }
        
        const links = this.uploadResults.map(result => {
            return `${result.title}: ${result.download_url}`;
        }).join('\n');
        
        await this.copyToClipboard(links);
        this.updateStatus(`📋 Copied ${this.uploadResults.length} download links!`, 'success');
    }

    // Copy all embed links
    async copyAllEmbeds() {
        if (this.uploadResults.length === 0) {
            this.updateStatus('⚠️ No upload results to copy', 'error');
            return;
        }
        
        const embeds = this.uploadResults.map(result => {
            return `${result.title}: ${result.protected_embed}`;
        }).join('\n');
        
        await this.copyToClipboard(embeds);
        this.updateStatus(`📋 Copied ${this.uploadResults.length} embed links!`, 'success');
    }

    // Export results as JSON
    async exportResults() {
        if (this.uploadResults.length === 0) {
            this.updateStatus('⚠️ No upload results to export', 'error');
            return;
        }
        
        const exportData = {
            exported_by: "01 dev",
            export_date: new Date().toISOString(),
            total_files: this.uploadResults.length,
            results: this.uploadResults.map(result => ({
                title: result.title,
                filecode: result.filecode,
                download_url: result.download_url,
                embed_url: result.protected_embed,
                protected_dl: result.protected_dl,
                thumbnail: result.single_img,
                splash: result.splash_img,
                size: result.size,
                length: result.length,
                uploaded: result.uploaded,
                embed_codes: {
                    html: this.generateEmbedCode(result),
                    iframe: this.generateIframeCode(result)
                }
            }))
        };
        
        // Create and download JSON file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `doodstream-exports-${new Date().getTime()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.updateStatus(`📄 Exported ${this.uploadResults.length} results to JSON file!`, 'success');
    }

    // File validation system
    validateFiles(files) {
        const validFiles = [];
        const maxSize = 500 * 1024 * 1024; // 500MB
        const allowedTypes = ['video/', 'audio/', 'image/', 'application/zip', 'application/rar'];
        
        Array.from(files).forEach(file => {
            let isValid = true;
            let reason = '';
            
            // Size validation
            if (file.size > maxSize) {
                isValid = false;
                reason = `File too large (${this.formatFileSize(file.size)}). Max: 500MB`;
            }
            
            // Type validation
            const isAllowedType = allowedTypes.some(type => file.type.startsWith(type));
            if (!isAllowedType) {
                isValid = false;
                reason = `File type not supported: ${file.type}`;
            }
            
            if (isValid) {
                validFiles.push(file);
            } else {
                this.updateStatus(`⚠️ ${file.name}: ${reason}`, 'error');
            }
        });
        
        return validFiles;
    }

    // Upload server with retry
    async getUploadServerWithRetry(retries = this.maxRetries) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const server = await this.getUploadServer();
                if (server) return server;
            } catch (error) {
                this.updateStatus(`⚠️ Server request attempt ${attempt}/${retries} failed: ${error.message}`, 'error');
                if (attempt < retries) {
                    await this.delay(1000 * attempt); // Exponential backoff
                }
            }
        }
        return null;
    }

    // Upload file with retry logic
    async uploadFileWithRetry(file, serverInfo, fileName, retries = this.maxRetries) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                this.updateStatus(`📤 Uploading: ${fileName} (attempt ${attempt}/${retries})...`, 'info');
                const result = await this.uploadFile(file, serverInfo);
                
                if (result && result.status === 200) {
                    this.addUploadResult(result.result[0], true);
                    this.uploadResults.push(result.result[0]);
                    this.analytics.successCount++;
                    this.updateStatus(`✅ ${fileName} uploaded successfully!`, 'success');
                    return;
                } else {
                    throw new Error(result?.msg || 'Upload failed');
                }
            } catch (error) {
                this.analytics.retryCount++;
                if (attempt < retries) {
                    this.updateStatus(`⚠️ Upload attempt ${attempt}/${retries} failed for ${fileName}: ${error.message}`, 'error');
                    await this.delay(1000 * attempt); // Exponential backoff
                } else {
                    // Final failure
                    this.analytics.errorCount++;
                    this.failedUploads.push({ file, fileName, error: error.message });
                    this.updateStatus(`❌ Failed to upload ${fileName} after ${retries} attempts: ${error.message}`, 'error');
                    this.addUploadResult({ title: fileName, error: error.message }, false);
                }
            }
        }
    }

    // Retry failed uploads
    async retryFailedUploads() {
        if (this.failedUploads.length === 0) {
            this.showToast('No failed uploads to retry', 'info');
            return;
        }
        
        const failedCopy = [...this.failedUploads];
        this.failedUploads = [];
        
        this.updateStatus(`🔁 Retrying ${failedCopy.length} failed uploads...`, 'info');
        
        try {
            const serverInfo = await this.getUploadServerWithRetry();
            if (!serverInfo) {
                throw new Error('Failed to get upload server for retry');
            }
            
            for (const { file, fileName } of failedCopy) {
                await this.uploadFileWithRetry(file, serverInfo, fileName);
                await this.delay(this.rateLimit);
            }
            
            this.updateStatus(`🎉 Retry complete! Check results above.`, 'success');
            
        } catch (error) {
            this.updateStatus(`❌ Retry process failed: ${error.message}`, 'error');
        }
    }

    // Show retry option
    showRetryOption() {
        if (this.elements.retryBtn) {
            this.elements.retryBtn.style.display = 'block';
            this.elements.retryBtn.textContent = `🔁 Retry ${this.failedUploads.length} Failed Uploads`;
        }
    }

    // Update analytics display
    updateAnalytics() {
        this.analytics.totalFiles = this.selectedFiles.size;
    }
    
    updateAnalyticsDisplay() {
        if (this.elements.analyticsDisplay) {
            const duration = this.analytics.endTime && this.analytics.startTime 
                ? (this.analytics.endTime - this.analytics.startTime) / 1000 
                : 0;
            
            this.elements.analyticsDisplay.innerHTML = `
                <div class="analytics-grid">
                    <div class="metric">
                        <span class="metric-value">${this.analytics.totalFiles}</span>
                        <span class="metric-label">Total Files</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${this.analytics.successCount}</span>
                        <span class="metric-label">Successful</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${this.analytics.errorCount}</span>
                        <span class="metric-label">Failed</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${this.analytics.retryCount}</span>
                        <span class="metric-label">Retries</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${duration.toFixed(1)}s</span>
                        <span class="metric-label">Duration</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${(this.analytics.successCount / Math.max(this.analytics.totalFiles, 1) * 100).toFixed(1)}%</span>
                        <span class="metric-label">Success Rate</span>
                    </div>
                </div>
            `;
        }
    }

    // Keyboard shortcuts
    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + U: Upload
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                if (!this.isUploading && this.selectedFiles.size > 0 && this.apiKey) {
                    this.startUpload();
                }
            }
            
            // Ctrl/Cmd + D: Clear
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                this.clearAllFiles();
            }
            
            // Ctrl/Cmd + A: Select files (when in upload area)
            if ((e.ctrlKey || e.metaKey) && e.key === 'a' && e.target.closest('.upload-area')) {
                e.preventDefault();
                this.elements.fileInput.click();
            }
            
            // Escape: Cancel upload
            if (e.key === 'Escape' && this.isUploading) {
                this.cancelUpload();
            }
        });
    }
    
    // Cancel upload
    cancelUpload() {
        this.isUploading = false;
        this.hideProgressOverlay();
        this.updateUploadButton();
        this.updateStatus('❌ Upload cancelled by user', 'error');
    }

    // Progress overlay methods
    showProgressOverlay() {
        if (this.elements.progressOverlay) {
            this.elements.progressOverlay.classList.add('active');
            this.elements.uploadArea.classList.add('processing');
        }
    }
    
    hideProgressOverlay() {
        if (this.elements.progressOverlay) {
            this.elements.progressOverlay.classList.remove('active');
            this.elements.uploadArea.classList.remove('processing');
        }
    }
    
    updateProgressText(main, detail) {
        if (this.elements.progressText) {
            this.elements.progressText.textContent = main;
        }
        if (this.elements.progressDetail) {
            this.elements.progressDetail.textContent = detail;
        }
    }

    // Show toast notification
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize the uploader when DOM is loaded
let uploader;
document.addEventListener('DOMContentLoaded', () => {
    uploader = new DoodUploader();
    console.log('🎮 DoodStream Uploader initialized by 01 dev');
});

// Expose uploader globally for HTML onclick handlers
window.uploader = uploader;