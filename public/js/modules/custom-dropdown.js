/**
 * CustomDropdown - Fully styleable dropdown component
 * Replaces native <select> elements with custom HTML/CSS for full control
 */
export class CustomDropdown {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.selectedValue = '';
        this.selectedText = options.placeholder || 'Select an option...';
        this.isOpen = false;
        this.isDisabled = options.disabled || false;
        this.options = [];
        this.onChange = options.onChange || null;
        
        this.render();
        this.attachEventListeners();
    }

    render() {
        this.container.innerHTML = `
            <div class="custom-dropdown ${this.isDisabled ? 'disabled' : ''}" data-dropdown="${this.containerId}" style="position: relative;">
                <div class="dropdown-header p-3 panel-list glass-strip-list rounded-lg cursor-pointer text-neutral-400 text-sm transition duration-200 flex items-center justify-between">
                    <span class="selected-text">${this.selectedText}</span>
                    <i class="fas fa-chevron-down transition-transform duration-200"></i>
                </div>
            </div>
        `;
        
        // Create dropdown list separately and append to body for proper z-index layering
        const dropdownList = document.createElement('div');
        dropdownList.className = 'dropdown-list hidden absolute w-full panel-list glass-strip-list ov-dark-list rounded-lg shadow-lg overflow-y-auto';
        dropdownList.style.cssText = 'max-height: 16rem; z-index: 9999;';
        document.body.appendChild(dropdownList);
        
        this.headerEl = this.container.querySelector('.dropdown-header');
        this.listEl = dropdownList;
        this.iconEl = this.container.querySelector('.fa-chevron-down');
    }

    attachEventListeners() {
        // Toggle dropdown on header click
        this.headerEl.addEventListener('click', (e) => {
            if (this.isDisabled) return;
            this.toggle();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target) && !this.listEl.contains(e.target)) {
                this.close();
            }
        });
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        if (this.isDisabled) return;
        
        // Position dropdown list relative to header button
        const rect = this.headerEl.getBoundingClientRect();
        const listMaxHeight = 256; // 16rem = 256px
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        // Determine if dropdown should open upward or downward
        const shouldOpenUpward = spaceBelow < listMaxHeight && spaceAbove > spaceBelow;
        
        this.listEl.style.position = 'fixed';
        this.listEl.style.left = `${rect.left}px`;
        this.listEl.style.width = `${rect.width}px`;
        
        if (shouldOpenUpward) {
            // Open upward - position bottom of list above the header
            this.listEl.style.bottom = `${viewportHeight - rect.top + 4}px`;
            this.listEl.style.top = 'auto';
        } else {
            // Open downward - position top of list below the header
            this.listEl.style.top = `${rect.bottom + 4}px`;
            this.listEl.style.bottom = 'auto';
        }
        
        this.isOpen = true;
        this.listEl.classList.remove('hidden');
        this.iconEl.style.transform = 'rotate(180deg)';
    }

    close() {
        this.isOpen = false;
        this.listEl.classList.add('hidden');
        this.iconEl.style.transform = 'rotate(0deg)';
    }

    populateOptions(optionsArray) {
        this.options = optionsArray;
        this.listEl.innerHTML = '';
        
        optionsArray.forEach(option => {
            const optionEl = document.createElement('div');
            optionEl.className = 'dropdown-option p-3 cursor-pointer text-neutral-400 text-sm hover:bg-neutral-700 transition duration-150';
            optionEl.textContent = option.text;
            optionEl.dataset.value = option.value;
            
            optionEl.addEventListener('click', () => {
                this.selectOption(option.value, option.text);
            });
            
            this.listEl.appendChild(optionEl);
        });
    }

    selectOption(value, text) {
        this.selectedValue = value;
        this.selectedText = text;
        
        // Update header text
        this.container.querySelector('.selected-text').textContent = text;
        
        // Highlight selected option
        this.listEl.querySelectorAll('.dropdown-option').forEach(opt => {
            opt.classList.remove('bg-blue-600');
            if (opt.dataset.value === value) {
                opt.classList.add('bg-blue-600');
            }
        });
        
        this.close();
        
        // Trigger change callback
        if (this.onChange) {
            this.onChange(value, text);
        }
    }

    getValue() {
        return this.selectedValue;
    }

    setText(text) {
        this.selectedText = text;
        this.container.querySelector('.selected-text').textContent = text;
    }

    setValue(value) {
        const option = this.options.find(opt => opt.value === value);
        if (option) {
            this.selectOption(option.value, option.text);
        }
    }

    disable() {
        this.isDisabled = true;
        this.close();
        this.headerEl.classList.add('opacity-50', 'cursor-not-allowed');
        this.headerEl.classList.remove('cursor-pointer');
    }

    enable() {
        this.isDisabled = false;
        this.headerEl.classList.remove('opacity-50', 'cursor-not-allowed');
        this.headerEl.classList.add('cursor-pointer');
    }

    reset() {
        this.selectedValue = '';
        this.selectedText = 'Select an option...';
        this.container.querySelector('.selected-text').textContent = this.selectedText;
        this.listEl.innerHTML = '';
    }
}
