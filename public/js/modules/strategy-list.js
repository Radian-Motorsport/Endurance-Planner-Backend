// Strategy List Module
// Fetches and displays recent strategies from the database

export class StrategyListComponent {
    constructor(apiBaseUrl = 'https://planner.radianmotorsport.com') {
        this.apiBaseUrl = apiBaseUrl;
        this.strategies = [];
    }

    // Fetch recent strategies from API
    async fetchStrategies() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/strategies/recent`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.strategies = await response.json();
            return this.strategies;
        } catch (error) {
            console.error('Failed to fetch strategies:', error);
            return [];
        }
    }

    // Format date for display
    formatDate(dateString) {
        if (!dateString) return 'No date';
        const date = new Date(dateString);
        return date.toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Generate link URLs
    getLiveTrackerLink(strategyId) {
        return `https://planner.radianmotorsport.com/live-tracker.html?strategy=${strategyId}`;
    }

    getPlannerLink(strategyId) {
        return `https://planner.radianmotorsport.com/?strategy=${strategyId}`;
    }

    // Render for connections page (full card view)
    renderConnectionsView(containerElement) {
        if (!containerElement) return;

        if (this.strategies.length === 0) {
            containerElement.innerHTML = `
                <div class="text-center py-12 text-neutral-500">
                    <i class="fas fa-clipboard-list text-5xl mb-4"></i>
                    <p class="text-lg">No strategies saved yet</p>
                    <p class="text-sm mt-2">Strategies will appear here when created</p>
                </div>
            `;
            return;
        }

        containerElement.innerHTML = '';

        this.strategies.forEach(strategy => {
            const card = document.createElement('div');
            card.className = 'card mb-3';
            
            const driversText = strategy.drivers.length > 0 
                ? strategy.drivers.join(', ') 
                : 'No drivers assigned';

            const liveTrackerLink = this.getLiveTrackerLink(strategy.id);
            const plannerLink = this.getPlannerLink(strategy.id);

            card.innerHTML = `
                <div class="flex items-center justify-between gap-4">
                    <div class="flex-1 min-w-0">
                        <div class="text-lg font-bold text-white truncate">${strategy.carName}</div>
                        <div class="text-sm text-neutral-400 truncate">${strategy.trackName} • ${strategy.seasonName}</div>
                        <div class="text-xs text-neutral-500 mt-1">${driversText}</div>
                        <div class="text-xs text-neutral-600 mt-1">
                            Session: ${this.formatDate(strategy.sessionDate)} | Updated: ${this.formatDate(strategy.updatedAt)}
                        </div>
                    </div>
                    <div class="flex gap-2 flex-shrink-0">
                        <button class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-sm transition" 
                                onclick="window.open('${plannerLink}', '_blank')">
                            <i class="fas fa-clipboard-list mr-1"></i>Planner
                        </button>
                        <button class="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded text-sm transition" 
                                onclick="window.open('${liveTrackerLink}', '_blank')">
                            <i class="fas fa-broadcast-tower mr-1"></i>Live
                        </button>
                    </div>
                </div>
            `;

            containerElement.appendChild(card);
        });
    }

    // Render for planner page (dropdown select)
    renderPlannerDropdown(selectElement) {
        if (!selectElement) return;

        selectElement.innerHTML = '<option value="">-- Load Recent Strategy --</option>';

        this.strategies.forEach(strategy => {
            const option = document.createElement('option');
            option.value = strategy.id;
            
            const driversText = strategy.drivers.length > 0 
                ? strategy.drivers.slice(0, 2).join(', ') + (strategy.drivers.length > 2 ? '...' : '')
                : 'Unassigned';
            
            option.textContent = `${strategy.carName} | ${strategy.trackName} | ${driversText}`;
            selectElement.appendChild(option);
        });

        // Add change handler to auto-load strategy
        selectElement.addEventListener('change', (e) => {
            const strategyId = e.target.value;
            if (strategyId) {
                const plannerLink = this.getPlannerLink(strategyId);
                window.location.href = plannerLink;
            }
        });
    }

    // Initialize and render for connections page
    async initConnectionsPage(containerElement) {
        await this.fetchStrategies();
        this.renderConnectionsView(containerElement);
    }

    // Initialize and render for planner page
    async initPlannerPage(selectElement) {
        await this.fetchStrategies();
        this.renderPlannerDropdown(selectElement);
    }
}
