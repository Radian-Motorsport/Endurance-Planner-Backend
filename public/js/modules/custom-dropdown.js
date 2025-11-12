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
            <div class="custom-dropdown ${this.isDisabled ? 'disabled' : ''}" data-dropdown="${this.containerId}">
                <div class="dropdown-header p-3 panel glass-strip rounded-lg cursor-pointer text-neutral-400 text-sm transition duration-200 flex items-center justify-between">
                    <span class="selected-text">${this.selectedText}</span>
                    <i class="fas fa-chevron-down transition-transform duration-200"></i>
                </div>
                <div class="dropdown-list hidden absolute z-50 w-full mt-1 panel glass-strip ov-dark rounded-lg shadow-lg overflow-y-auto" style="max-height: 16rem;">
                </div>
            </div>
        `;
        
        this.headerEl = this.container.querySelector('.dropdown-header');
        this.listEl = this.container.querySelector('.dropdown-list');
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
            if (!this.container.contains(e.target)) {
                this.close();
            }
        });
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        if (this.isDisabled) return;
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
