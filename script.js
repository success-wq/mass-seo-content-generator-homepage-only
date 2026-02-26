//v9 (modified from v8)
class SEOGenerator {
    constructor() {
        console.log('SEOGenerator constructor called');
        
        // Get DOM elements
        this.form = document.getElementById('seoForm');
        this.resultsSection = document.getElementById('results');
        this.webhookResponse = document.getElementById('webhookResponse');
        this.statusMessage = document.getElementById('statusMessage');
        this.submitBtn = document.getElementById('submitBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.darkModeToggle = document.getElementById('darkModeToggle');
        this.promptTypeGroup = document.getElementById('promptTypeGroup');
        this.selectPagesRadio = document.getElementById('selectPagesRadio');
        this.selectAllRadio = document.getElementById('selectAllRadio');
        this.multiselectSearch = document.getElementById('multiselectSearch');
        this.multiselectDropdown = document.getElementById('multiselectDropdown');
        this.multiselectOptions = document.getElementById('multiselectOptions');
        this.selectedTags = document.getElementById('selectedTags');
        this.addLocationBtn = document.getElementById('addLocationBtn');
        this.locationsContainer = document.getElementById('locationsContainer');
        this.locationLabel = document.querySelector('label[for="cityState"]');
        this.locationHelpText = document.getElementById('locationHelpText');
        this.primaryService = document.getElementById('primaryService');
        this.phoneNumber = document.getElementById('phoneNumber');
        
        // Initialize data
        this.currentMatrix = [];
        this.promptTypes = [];
        this.selectedPrompts = []; // Track selected prompts
        this.locationCount = 1;
        this.currentPlaceholder = "Enter city and state (e.g. Rexburg, ID)";
        this.pollInterval = null; // Store polling interval reference
        this.sheetsData = {
            sectionNames: [],
            docUrlsMap: {}
        };
        
        this.init();
    }
    
    init() {
        console.log('SEOGenerator init() called');
        
        // Add event listeners with safety checks
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }
        
        if (this.darkModeToggle) {
            this.darkModeToggle.addEventListener('click', () => this.toggleDarkMode());
        }
        
        if (this.addLocationBtn) {
            this.addLocationBtn.addEventListener('click', () => this.addLocationInput());
        }
        
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.handleClearAll());
        }
        
        if (this.selectPagesRadio) {
            this.selectPagesRadio.addEventListener('change', () => this.handleSelectionModeChange());
        }
        
        if (this.selectAllRadio) {
            this.selectAllRadio.addEventListener('change', () => this.handleSelectionModeChange());
        }
        
        if (this.multiselectSearch) {
            this.multiselectSearch.addEventListener('focus', () => this.showDropdown());
            this.multiselectSearch.addEventListener('input', (e) => this.filterOptions(e.target.value));
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.promptTypeGroup?.contains(e.target)) {
                this.hideDropdown();
            }
        });
        
        console.log('Event listeners attached');
        
        // Initialize features
        this.initDarkMode();
        this.loadInitialSheetsData();
    }
    
    initDarkMode() {
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
        }
    }
    
    toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkMode);
        console.log('Dark mode toggled:', isDarkMode);
    }
    
    async loadInitialSheetsData() {
        console.log('loadInitialSheetsData() called');
        
        const webAppUrl = '';
        
        try {
            console.log('Calling fetchFromWebApp with URL:', webAppUrl);
            this.showStatus('Loading data from Google Apps Script...', 'info');
            await this.fetchFromWebApp(webAppUrl);
        } catch (error) {
            console.error('Failed to load data from web app:', error);
            this.showStatus('Failed to load data from Google Sheets Web App. Please check the deployment.', 'error');
        }
    }
    
    async fetchFromWebApp(webAppUrl) {
        console.log('fetchFromWebApp() called');
        
        try {
            console.log('Fetching from:', webAppUrl);
            
            const response = await fetch(webAppUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Data received:', data);
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.mapWebAppDataToUI(data);
            this.showStatus('Successfully loaded data from Google Apps Script!', 'success');
            
        } catch (error) {
            console.error('fetchFromWebApp error:', error);
            throw error;
        }
    }
    
    fetchViaJSONP(url) {
        return new Promise((resolve, reject) => {
            const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
            const urlWithCallback = url + (url.includes('?') ? '&' : '?') + 'callback=' + callbackName;
            
            console.log('JSONP URL:', urlWithCallback);
            
            const script = document.createElement('script');
            script.src = urlWithCallback;
            
            window[callbackName] = function(data) {
                console.log('JSONP callback received:', data);
                resolve(data);
                document.head.removeChild(script);
                delete window[callbackName];
            };
            
            script.onerror = function() {
                console.error('JSONP script failed to load');
                reject(new Error('JSONP request failed'));
                document.head.removeChild(script);
                delete window[callbackName];
            };
            
            document.head.appendChild(script);
            
            setTimeout(() => {
                if (window[callbackName]) {
                    console.error('JSONP request timed out');
                    reject(new Error('JSONP request timed out'));
                    if (document.head.contains(script)) {
                        document.head.removeChild(script);
                    }
                    delete window[callbackName];
                }
            }, 10000);
        });
    }
    
    mapWebAppDataToUI(jsonData) {
        console.log('mapWebAppDataToUI called with:', jsonData);
        
        if (!jsonData.section_names || !Array.isArray(jsonData.section_names)) {
            throw new Error('Invalid data format: section_names array not found');
        }
        
        this.sheetsData = {
            sectionNames: jsonData.section_names,
            docUrlsMap: jsonData.doc_urls_map || {}
        };
        
        console.log('Mapped data:', this.sheetsData);
        this.updatePromptTypesFromSheets();
    }
    
    updatePromptTypesFromSheets() {
        console.log('updatePromptTypesFromSheets called');
        
        if (this.sheetsData.sectionNames.length === 0) {
            this.showStatus('No section prompts found in Google Sheets', 'error');
            return;
        }
        
        this.promptTypes = [...this.sheetsData.sectionNames];
        this.updatePromptTypeOptions();
        
        this.showStatus(`Loaded ${this.promptTypes.length} section prompts from Google Sheets`, 'success');
    }
    
    updatePromptTypeOptions() {
        console.log('updatePromptTypeOptions called with:', this.promptTypes);
        
        if (!this.multiselectOptions) return;
        
        this.multiselectOptions.innerHTML = '';
        
        this.promptTypes.forEach(promptType => {
            const option = document.createElement('div');
            option.className = 'multiselect-option';
            option.textContent = this.formatPromptTypeName(promptType);
            option.dataset.value = promptType;
            
            option.addEventListener('click', () => this.toggleSelection(promptType));
            
            this.multiselectOptions.appendChild(option);
            console.log(`Added option: ${promptType}`);
        });
    }
    
    showDropdown() {
        if (this.multiselectDropdown) {
            this.multiselectDropdown.style.display = 'block';
        }
    }
    
    hideDropdown() {
        if (this.multiselectDropdown) {
            this.multiselectDropdown.style.display = 'none';
        }
    }
    
    toggleSelection(promptType) {
        const index = this.selectedPrompts.indexOf(promptType);
        
        if (index > -1) {
            // Remove from selection
            this.selectedPrompts.splice(index, 1);
        } else {
            // Add to selection
            this.selectedPrompts.push(promptType);
        }
        
        this.updateSelectedTags();
        this.updateDropdownSelections();
        
        console.log('Selected prompts:', this.selectedPrompts);
    }
    
    removeSelection(promptType) {
        const index = this.selectedPrompts.indexOf(promptType);
        if (index > -1) {
            this.selectedPrompts.splice(index, 1);
            this.updateSelectedTags();
            this.updateDropdownSelections();
        }
    }
    
    updateSelectedTags() {
        if (!this.selectedTags) return;
        
        this.selectedTags.innerHTML = '';
        
        this.selectedPrompts.forEach(promptType => {
            const tag = document.createElement('div');
            tag.className = 'selected-tag';
            
            const tagText = document.createElement('span');
            tagText.textContent = this.formatPromptTypeName(promptType);
            
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-tag';
            removeBtn.innerHTML = '×';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeSelection(promptType);
            });
            
            tag.appendChild(tagText);
            tag.appendChild(removeBtn);
            this.selectedTags.appendChild(tag);
        });
        
        // Update placeholder
        if (this.multiselectSearch) {
            if (this.selectedPrompts.length === 0) {
                this.multiselectSearch.placeholder = 'Choose pages...';
            } else {
                this.multiselectSearch.placeholder = 'Search or add more...';
            }
        }
    }
    
    updateDropdownSelections() {
        if (!this.multiselectOptions) return;
        
        const options = this.multiselectOptions.querySelectorAll('.multiselect-option');
        options.forEach(option => {
            const value = option.dataset.value;
            if (this.selectedPrompts.includes(value)) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });
    }
    
    filterOptions(searchTerm) {
        if (!this.multiselectOptions) return;
        
        const options = this.multiselectOptions.querySelectorAll('.multiselect-option');
        const lowerSearch = searchTerm.toLowerCase();
        
        options.forEach(option => {
            const text = option.textContent.toLowerCase();
            if (text.includes(lowerSearch)) {
                option.style.display = 'block';
            } else {
                option.style.display = 'none';
            }
        });
    }
    
    formatPromptTypeName(sectionName) {
        return sectionName.replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    handleSelectionModeChange() {
        const selectAllMode = this.selectAllRadio && this.selectAllRadio.checked;
        
        if (this.promptTypeGroup) {
            if (selectAllMode) {
                this.promptTypeGroup.style.display = 'none';
            } else {
                this.promptTypeGroup.style.display = 'block';
            }
        }
        
        console.log('Selection mode changed. Select All:', selectAllMode);
    }
    
    updateLocationInputLabeling(selectedPrompt) {
        if (!selectedPrompt) {
            return;
        }
        
        const lowerPrompt = selectedPrompt.toLowerCase();
        
        if (lowerPrompt.includes('service_area') || lowerPrompt.includes('service area')) {
            this.currentPlaceholder = "Enter service area (e.g. Northern Idaho, Rexburg Metro Area)";
            if (this.locationLabel) {
                this.locationLabel.textContent = "Service Area(s)";
            }
            if (this.locationHelpText) {
                this.locationHelpText.textContent = "Enter your primary service area. Items must be separated by commas (,) as shown in the example.";
            }
        } else if (lowerPrompt.includes('county') || lowerPrompt.includes('counties')) {
            this.currentPlaceholder = "Enter county (e.g. Madison County, ID)";
            if (this.locationLabel) {
                this.locationLabel.textContent = "County/Counties";
            }
            if (this.locationHelpText) {
                this.locationHelpText.textContent = "Enter counties you serve. Items must be separated by commas (,) as shown in the example.";
            }
        } else {
            this.currentPlaceholder = "Enter city and state (e.g. Rexburg, ID)";
            if (this.locationLabel) {
                this.locationLabel.textContent = "City + State";
            }
            if (this.locationHelpText) {
                this.locationHelpText.textContent = "Enter the primary city and state for your service area. Items must be separated by commas (,) as shown in the example.";
            }
        }
        
        const allLocationInputs = this.locationsContainer.querySelectorAll('input[type="text"]');
        allLocationInputs.forEach(input => {
            input.placeholder = this.currentPlaceholder;
        });
    }
    
    addLocationInput() {
        this.locationCount++;
        
        const newInputGroup = document.createElement('div');
        newInputGroup.className = 'location-input-group';
        
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.placeholder = this.currentPlaceholder;
        newInput.required = true;
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-location-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => {
            newInputGroup.remove();
            this.locationCount--;
        });
        
        newInputGroup.appendChild(newInput);
        newInputGroup.appendChild(removeBtn);
        
        this.locationsContainer.appendChild(newInputGroup);
        
        console.log('Added location input. Total count:', this.locationCount);
    }
    
    async handleFormSubmit(e) {
        e.preventDefault();
        console.log('Form submitted');
        
        this.showLoading(true);
        this.hideStatus();
        
        try {
            const formData = this.getFormData();
            console.log('Form data:', formData);
            
            if (!this.validateFormData(formData)) {
                this.showLoading(false);
                return;
            }
            
            await this.sendToWebhook(formData);
            
        } catch (error) {
            console.error('Form submission error:', error);
            this.showStatus('Error: ' + error.message, 'error');
            this.showLoading(false);
        }
    }
    
    getFormData() {
        const selectAllMode = this.selectAllRadio && this.selectAllRadio.checked;
        let promptType;
        
        if (selectAllMode) {
            // Send all available section names
            promptType = [...this.promptTypes];
        } else {
            // Get selected prompts from our custom multiselect
            promptType = [...this.selectedPrompts];
        }
        
        // Build docUrls array in same order as promptType
        const docUrls = promptType.map(section => this.sheetsData.docUrlsMap[section] || '');
        
        const companyName = document.getElementById('companyName')?.value || '';
        const userName = document.getElementById('userName')?.value || '';
        const primaryService = this.primaryService?.value || '';
        const phoneNumber = this.phoneNumber?.value || '';
        
        const locationInputs = this.locationsContainer.querySelectorAll('input[type="text"]');
        const locations = Array.from(locationInputs)
            .map(input => input.value.trim())
            .filter(value => value !== '');
        
        return {
            promptType,
            docUrls,
            companyName,
            userName,
            locations,
            primaryService,
            phoneNumber
        };
    }
    
    validateFormData(data) {
        const selectAllMode = this.selectAllRadio && this.selectAllRadio.checked;
        
        if (!selectAllMode) {
            if (!data.promptType || data.promptType.length === 0) {
                this.showStatus('Please select at least one section prompt', 'error');
                return false;
            }
        }
        
        if (!data.companyName) {
            this.showStatus('Please enter a company name', 'error');
            return false;
        }
        
        if (!data.userName) {
            this.showStatus('Please enter your name', 'error');
            return false;
        }
        
        if (data.locations.length === 0) {
            this.showStatus('Please enter at least one location', 'error');
            return false;
        }
        
        if (!data.primaryService) {
            this.showStatus('Please enter your primary service', 'error');
            return false;
        }
        
        if (!data.phoneNumber) {
            this.showStatus('Please enter a phone number', 'error');
            return false;
        }
        
        return true;
    }
    
    async sendToWebhook(data) {
        const webhookUrl = 'https://bsmteam.app.n8n.cloud/webhook/748785ad-ea00-429b-8071-28ebd3756200';
        
        console.log('Sending to webhook:', webhookUrl);
        console.log('Data:', data);
        
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Webhook response:', result);
            
            this.showStatus('Request submitted successfully! Polling for results...', 'success');
            
            this.startPollingForResult();
            
        } catch (error) {
            console.error('Webhook error:', error);
            throw new Error('Failed to send data to webhook: ' + error.message);
        }
    }
    
    startPollingForResult() {
        console.log('Starting to poll for results...');
        
        const webAppUrl = 'https://script.google.com/macros/s/AKfycbyfRLYsXOB_pe1_XaDMbTJ2O8yB2NcEymEAz56yWysxT20O9wUv6haxb61L4eBwr2T9/exec';
        const pollUrl = webAppUrl + '?action=getResult';
        
        let pollCount = 0;
        const maxPolls = 60;
        
        this.pollInterval = setInterval(async () => {
            pollCount++;
            console.log(`Polling attempt ${pollCount}/${maxPolls}`);
            
            if (pollCount > maxPolls) {
                this.stopPolling();
                this.showStatus('Polling timed out. Please try again.', 'error');
                this.showLoading(false);
                return;
            }
            
            try {
                const data = await this.fetchViaJSONP(pollUrl);
                console.log('Poll response:', data);
                
                if (data.found && data.message) {
                    this.stopPolling();
                    this.displayWebhookResult(data.message);
                    this.showStatus('Results retrieved successfully!', 'success');
                    this.showLoading(false);
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 2000);
    }
    
    stopPolling() {
        if (this.pollInterval) {
            console.log('Stopping polling interval');
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
    
    displayWebhookResult(message) {
        console.log('Displaying webhook result:', message);
        
        if (!this.webhookResponse || !this.resultsSection) return;
        
        this.webhookResponse.innerHTML = `
            <div class="webhook-result">
                <p><strong>Result from n8n:</strong></p>
                <pre>${JSON.stringify(message, null, 2)}</pre>
            </div>
        `;
        
        this.showResults();
    }
    
    showResults() {
        if (this.resultsSection) {
            this.resultsSection.style.display = 'block';
            this.resultsSection.scrollIntoView({ behavior: 'smooth' });
        }
        
        // Enable clear button when results are shown
        if (this.clearBtn) {
            this.clearBtn.disabled = false;
        }
    }
    
    handleClearAll() {
        console.log('Clear All button clicked');
        
        // Stop any active polling
        this.stopPolling();
        
        // Clear form inputs
        if (this.form) {
            this.form.reset();
        }
        
        // Clear multiselect selections
        this.selectedPrompts = [];
        this.updateSelectedTags();
        this.updateDropdownSelections();
        if (this.multiselectSearch) {
            this.multiselectSearch.value = '';
        }
        
        // Reset radio buttons to default (Select Pages)
        if (this.selectPagesRadio) {
            this.selectPagesRadio.checked = true;
        }
        if (this.selectAllRadio) {
            this.selectAllRadio.checked = false;
        }
        
        // Show dropdown again
        if (this.promptTypeGroup) {
            this.promptTypeGroup.style.display = 'block';
        }
        
        // Clear additional location inputs (keep only the first one)
        const locationInputs = this.locationsContainer.querySelectorAll('.location-input-group');
        for (let i = 1; i < locationInputs.length; i++) {
            locationInputs[i].remove();
        }
        this.locationCount = 1;
        
        // Reset location labeling to default
        this.updateLocationInputLabeling('');
        
        // Clear and hide results
        if (this.resultsSection) {
            this.resultsSection.style.display = 'none';
        }
        if (this.webhookResponse) {
            this.webhookResponse.innerHTML = '';
        }
        
        // Reset current matrix
        this.currentMatrix = [];
        
        // Disable clear button again
        if (this.clearBtn) {
            this.clearBtn.disabled = true;
        }
        
        // Hide status message
        this.hideStatus();
        
        // Show success message
        this.showStatus('All selections and results have been cleared', 'success');
        
        console.log('Clear All completed');
    }
    
    showLoading(show) {
        if (!this.submitBtn) return;
        
        const btnText = this.submitBtn.querySelector('.btn-text');
        const loader = this.submitBtn.querySelector('.loader');
        
        if (show) {
            if (btnText) btnText.style.display = 'none';
            if (loader) loader.style.display = 'inline-block';
            this.submitBtn.disabled = true;
        } else {
            if (btnText) btnText.style.display = 'inline-block';
            if (loader) loader.style.display = 'none';
            this.submitBtn.disabled = false;
        }
    }
    
    showStatus(message, type) {
        if (!this.statusMessage) return;
        
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type}`;
        this.statusMessage.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => this.hideStatus(), 5000);
        }
    }
    
    hideStatus() {
        if (this.statusMessage) {
            this.statusMessage.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');
    
    try {
        const seoGenerator = new SEOGenerator();
        console.log('SEOGenerator instance created successfully');
        window.seoGenerator = seoGenerator;
    } catch (error) {
        console.error('Error creating SEOGenerator:', error);
        console.error('Error stack:', error.stack);
    }
});
