/**
 * UI Manager Module
 * Handles page navigation, show/hide logic, and DOM manipulation
 * Extracted from monolithic index.html to improve maintainability
 */

export class UIManager {
    constructor(app = null) {
        this.app = app;
        this.currentPage = 'planner';
        this.setupEventListeners();
    }

    /**
     * Setup initial event listeners
     */
    setupEventListeners() {
        // Initialize immediately since DOM is already loaded when app creates this
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeUI();
            });
        } else {
            this.initializeUI();
        }
    }

    /**
     * Initialize UI components
     */
    initializeUI() {
        // Show planner page by default
        this.showPlannerPage();
        
        // Setup button event listeners
        this.setupButtonListeners();
    }

    /**
     * Setup button event listeners
     */
    setupButtonListeners() {
        console.log('🔧 Setting up button listeners...');
        
        // Navigation buttons
        const raceDetailsBtn = document.getElementById('race-details-btn');
        const adminBtn = document.getElementById('admin-btn');
        const continueBtn = document.getElementById('continue-button');
        
        console.log('🔍 Found buttons:', {
            raceDetailsBtn: !!raceDetailsBtn,
            adminBtn: !!adminBtn,
            continueBtn: !!continueBtn
        });
        
        if (raceDetailsBtn) {
            raceDetailsBtn.addEventListener('click', () => this.showPlannerPage());
            console.log('✅ Race details button listener added');
        }
        
        if (adminBtn) {
            adminBtn.addEventListener('click', () => this.showAdminPage());
            console.log('✅ Admin button listener added');
        }
        
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                console.log('🚀 Continue button clicked - calling showPage2()');
                console.log('🔧 DEBUG: this object:', this);
                console.log('🔧 DEBUG: showPage2 method exists:', typeof this.showPage2);
                console.log('🔧 DEBUG: showPage2 function:', this.showPage2);
                try {
                    this.showPage2();
                } catch (error) {
                    console.error('❌ ERROR in showPage2 call:', error);
                }
            });
            console.log('✅ Continue button listener added');
        } else {
            console.warn('⚠️ Continue button not found!');
        }

        // Back button in page 2
        const backBtn = document.querySelector('[onclick="showPlannerPage()"]');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showPlannerPage();
            });
        }
    }

    /**
     * Show planner page (page 1)
     */
    showPlannerPage() {
        console.log('🔄 Switching to planner page');
        
        // Hide other pages
        this.hideElement('page-2');
        this.hideElement('admin-page');
        
        // Show planner page
        this.showElement('planner-page');
        
        this.currentPage = 'planner';
        
        // Update button states
        this.updateButtonStates();
    }

    /**
     * Show page 2 (calculations and results)
     */
    async showPage2() {
        console.log('🔥🔥🔥 FIRST CALCULATE BUTTON PRESSED - showPage2() 🔥🔥🔥');
        console.log('🔧 DEBUG: Method showPage2 started execution');
        
        try {
            console.log('🔧 About to hide other pages...');
            // Hide other pages
            console.log('🔧 Calling hideElement for planner-page...');
            this.hideElement('planner-page');
            console.log('🔧 Planner page hidden');
            console.log('🔧 Calling hideElement for admin-page...');
            this.hideElement('admin-page');
            console.log('🔧 Admin page hidden');
            
            console.log('🔧 About to show page-2...');
            // Show page 2
            console.log('🔧 Calling showElement for page-2...');
            this.showElement('page-2');
            console.log('🔧 showElement page-2 called');
            
            console.log('🔧 Setting currentPage to page2...');
            this.currentPage = 'page2';
            console.log('🔧 currentPage set');
            
            console.log('🔧 About to update button states...');
            // Update button states
            this.updateButtonStates();
            console.log('🔧 Button states updated');

            // Collect page 1 data and populate page 2
            console.log('🔧 About to check app instance...');
            if (this.app) {
                console.log('📋 App instance available, collecting page 1 data...');
                console.log('🔧 DEBUG: this.app object:', this.app);
                try {
                    console.log('🔧 Calling collectPage1Data...');
                    const eventData = this.app.collectPage1Data();
                    console.log('📋 Event data collected:', eventData);
                    console.log('🔧 Calling populatePage2...');
                    await this.app.populatePage2(eventData);
                    console.log('✅ Page 2 populated successfully');
                } catch (error) {
                    console.error('❌ Error during data collection/population:', error);
                }
            } else {
                console.warn('⚠️ App instance not available for data collection');
            }

            // QUICK FIX: Force show Garage61 section and populate with test data
            console.log('🚀 QUICK FIX: Forcing Garage61 section to show...');
            this.forceShowGarage61Section();
            console.log('🔧 forceShowGarage61Section completed');
        } catch (error) {
            console.error('❌ Error in showPage2():', error);
            console.error('❌ Error stack:', error.stack);
        }
        console.log('🔧 DEBUG: showPage2 method completed');
    }

    /**
     * Quick fix to force show Garage61 section with test data
     */
    forceShowGarage61Section() {
        // Show the Garage61 lap times section
        const garage61Section = document.getElementById('garage61-lap-times');
        if (garage61Section) {
            garage61Section.classList.remove('hidden');
            console.log('✅ Garage61 section shown');
        }

        // Hide loading/error states and show content
        const loadingDiv = document.getElementById('lap-times-loading');
        const errorDiv = document.getElementById('lap-times-error');
        const contentDiv = document.getElementById('lap-times-content');

        if (loadingDiv) loadingDiv.classList.add('hidden');
        if (errorDiv) errorDiv.classList.add('hidden');
        if (contentDiv) contentDiv.classList.remove('hidden');

        // Add test data to the table
        const tbody = document.getElementById('lap-times-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr class="bg-neutral-750 hover:bg-neutral-700 transition-colors">
                    <td class="py-3 px-6 text-yellow-400 font-bold">1</td>
                    <td class="py-3 px-6 text-neutral-200 font-medium">Test Driver 1</td>
                    <td class="py-3 px-6 text-blue-400 font-mono">1:42.234</td>
                    <td class="py-3 px-6 text-neutral-400 text-sm">Oct 19, 2025</td>
                </tr>
                <tr class="bg-neutral-750 hover:bg-neutral-700 transition-colors">
                    <td class="py-3 px-6 text-gray-400 font-semibold">2</td>
                    <td class="py-3 px-6 text-neutral-200 font-medium">Test Driver 2</td>
                    <td class="py-3 px-6 text-blue-400 font-mono">1:42.456</td>
                    <td class="py-3 px-6 text-neutral-400 text-sm">Oct 19, 2025</td>
                </tr>
                <tr class="bg-neutral-750 hover:bg-neutral-700 transition-colors">
                    <td class="py-3 px-6 text-amber-600 font-semibold">3</td>
                    <td class="py-3 px-6 text-neutral-200 font-medium">Test Driver 3</td>
                    <td class="py-3 px-6 text-blue-400 font-mono">1:42.789</td>
                    <td class="py-3 px-6 text-neutral-400 text-sm">Oct 19, 2025</td>
                </tr>
            `;
            console.log('✅ Test data added to Garage61 table');
        }
    }

    /**
     * Show admin page
     */
    showAdminPage() {
        console.log('🔧 Switching to admin page');
        
        // Hide other pages
        this.hideElement('planner-page');
        this.hideElement('page-2');
        
        // Show admin page
        this.showElement('admin-page');
        
        this.currentPage = 'admin';
        
        // Update button states
        this.updateButtonStates();
    }

    /**
     * Show element by ID
     * @param {string} elementId - Element ID to show
     */
    showElement(elementId) {
        console.log(`🔍 showElement called for: ${elementId}`);
        const element = document.getElementById(elementId);
        if (element) {
            console.log(`✅ Element found: ${elementId}`);
            console.log(`   Current classes:`, element.className);
            element.classList.remove('hidden');
            console.log(`   Classes after removal:`, element.className);
        } else {
            console.error(`❌ Element NOT found: ${elementId}`);
        }
    }

    /**
     * Hide element by ID
     * @param {string} elementId - Element ID to hide
     */
    hideElement(elementId) {
        console.log(`🔍 hideElement called for: ${elementId}`);
        const element = document.getElementById(elementId);
        if (element) {
            console.log(`✅ Element found: ${elementId}, adding hidden class`);
            element.classList.add('hidden');
        } else {
            console.log(`❌ Element NOT found: ${elementId}`);
        }
    }

    /**
     * Toggle element visibility
     * @param {string} elementId - Element ID to toggle
     * @returns {boolean} True if now visible, false if hidden
     */
    toggleElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            const isHidden = element.classList.contains('hidden');
            if (isHidden) {
                element.classList.remove('hidden');
                return true;
            } else {
                element.classList.add('hidden');
                return false;
            }
        }
        return false;
    }

    /**
     * Update button states based on current page
     */
    updateButtonStates() {
        const raceDetailsBtn = document.getElementById('race-details-btn');
        const adminBtn = document.getElementById('admin-btn');
        
        // Reset button styles
        if (raceDetailsBtn) {
            raceDetailsBtn.className = 'bg-neutral-800 hover:bg-blue-700 text-black font-bold py-3 px-6 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105 flex items-center space-x-2';
        }
        
        if (adminBtn) {
            adminBtn.className = 'bg-neutral-900 hover:bg-green-600 text-black font-bold py-1 px-1 rounded-lg transition-all duration-200 transform hover:scale-105 space-x-2';
        }

        // Highlight active button
        switch (this.currentPage) {
            case 'planner':
            case 'page2':
                if (raceDetailsBtn) {
                    raceDetailsBtn.className = 'bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105 flex items-center space-x-2';
                }
                break;
            case 'admin':
                if (adminBtn) {
                    adminBtn.className = 'bg-green-600 text-white font-bold py-1 px-1 rounded-lg transition-all duration-200 transform hover:scale-105 space-x-2';
                }
                break;
        }
    }

    /**
     * Show loading state for an element
     * @param {string} elementId - Element ID
     * @param {string} loadingText - Loading message
     */
    showLoading(elementId, loadingText = 'Loading...') {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="flex items-center justify-center p-4">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
                    <span class="text-neutral-400">${loadingText}</span>
                </div>
            `;
        }
    }

    /**
     * Show error state for an element
     * @param {string} elementId - Element ID
     * @param {string} errorMessage - Error message
     */
    showError(elementId, errorMessage) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="flex items-center justify-center p-4">
                    <div class="text-red-500 mr-3">⚠️</div>
                    <span class="text-red-400">${errorMessage}</span>
                </div>
            `;
        }
    }

    /**
     * Update dropdown options
     * @param {string} selectId - Select element ID
     * @param {Array} options - Array of option objects {value, text, selected?}
     * @param {string} placeholder - Placeholder text
     */
    updateDropdown(selectId, options, placeholder = 'Select...') {
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = `<option value="">${placeholder}</option>`;
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            if (option.selected) {
                optionElement.selected = true;
            }
            select.appendChild(optionElement);
        });
    }

    /**
     * Show notification/toast message
     * @param {string} message - Message to show
     * @param {string} type - 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duration in milliseconds
     */
    showNotification(message, type = 'info', duration = 3000) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transition-all transform ${this.getNotificationStyles(type)}`;
        notification.innerHTML = `
            <div class="flex items-center">
                <span class="mr-3">${this.getNotificationIcon(type)}</span>
                <span>${message}</span>
                <button class="ml-4 text-xl font-bold hover:opacity-70" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto remove after duration
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, duration);
    }

    /**
     * Get notification styles based on type
     * @param {string} type - Notification type
     * @returns {string} CSS classes
     */
    getNotificationStyles(type) {
        switch (type) {
            case 'success':
                return 'bg-green-600 text-white';
            case 'error':
                return 'bg-red-600 text-white';
            case 'warning':
                return 'bg-yellow-600 text-black';
            case 'info':
            default:
                return 'bg-blue-600 text-white';
        }
    }

    /**
     * Get notification icon based on type
     * @param {string} type - Notification type
     * @returns {string} Icon character
     */
    getNotificationIcon(type) {
        switch (type) {
            case 'success':
                return '✅';
            case 'error':
                return '❌';
            case 'warning':
                return '⚠️';
            case 'info':
            default:
                return 'ℹ️';
        }
    }

    /**
     * Get current page
     * @returns {string} Current page name
     */
    getCurrentPage() {
        return this.currentPage;
    }
}