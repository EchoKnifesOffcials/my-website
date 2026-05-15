// ============================================================
// BLOXVIEW - MARKETPLACE
// Item display, filtering, sorting, trading
// ============================================================

// Global market data
let marketItems = [];
let currentMarketFilter = 'all';
let currentMarketSort = 'value_desc';
let marketSearchTerm = '';

// Load market items
function loadMarketItems() {
    marketItems = [...MM2_ITEMS, ...ADOPT_ITEMS];
    renderMarketItems();
}

// Render market items with filters and sorting
function renderMarketItems() {
    const container = document.getElementById('marketGrid');
    if (!container) return;
    
    let filtered = [...marketItems];
    
    // Apply search filter
    if (marketSearchTerm) {
        filtered = filtered.filter(item => 
            item.name.toLowerCase().includes(marketSearchTerm.toLowerCase())
        );
    }
    
    // Apply category filter
    if (currentMarketFilter !== 'all') {
        if (currentMarketFilter === 'mm2') {
            filtered = filtered.filter(item => item.id < 100);
        } else if (currentMarketFilter === 'adoptme') {
            filtered = filtered.filter(item => item.id >= 100);
        }
    }
    
    // Apply sorting
    switch (currentMarketSort) {
        case 'value_desc':
            filtered.sort((a, b) => b.value - a.value);
            break;
        case 'value_asc':
            filtered.sort((a, b) => a.value - b.value);
            break;
        case 'name_asc':
            filtered.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'demand_high':
            filtered.sort((a, b) => {
                const demandOrder = { high: 3, medium: 2, low: 1 };
                return demandOrder[b.demand] - demandOrder[a.demand];
            });
            break;
        case 'trending':
            filtered.sort((a, b) => parseFloat(b.change) - parseFloat(a.change));
            break;
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-search fa-3x mb-3"></i><p>No items found</p></div>';
        return;
    }
    
    container.innerHTML = filtered.map(item => `
        <div class="item-card" onclick="openItemModal(${JSON.stringify(item).replace(/"/g, '&quot;')}, '${item.id < 100 ? 'mm2' : 'adoptme'}')">
            <div class="item-image">${item.icon}</div>
            <h3 class="font-bold">${item.name}</h3>
            <div class="price-tag mt-2">${Format.currency(item.value)}</div>
            <div class="flex justify-between mt-2">
                <span class="${item.change.startsWith('+') ? 'trend-up' : 'trend-down'}">${item.change}</span>
                <span style="color:${item.demand === 'high' ? '#10b981' : '#f59e0b'}">
                    <i class="fas ${item.demand === 'high' ? 'fa-fire' : 'fa-chart-line'}"></i> ${item.demand}
                </span>
            </div>
            <button class="w-full mt-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-700" 
                    onclick="event.stopPropagation(); openDepositModal(${JSON.stringify(item).replace(/"/g, '&quot;')}, '${item.id < 100 ? 'mm2' : 'adoptme'}')">
                Deposit
            </button>
        </div>
    `).join('');
}

// Setup market filters
function setupMarketFilters() {
    const filterButtons = document.querySelectorAll('.market-filter');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMarketFilter = btn.dataset.filter;
            renderMarketItems();
        });
    });
    
    const sortSelect = document.getElementById('marketSort');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentMarketSort = e.target.value;
            renderMarketItems();
        });
    }
    
    const searchInput = document.getElementById('marketSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            marketSearchTerm = e.target.value;
            renderMarketItems();
        }, 300));
    }
}

// Get price history for chart
function getPriceHistory(itemId, timeframe = '1D') {
    const periods = { '1D': 24, '1W': 30, '1M': 60, '3M': 90 };
    const count = periods[timeframe] || 24;
    const data = [];
    let currentPrice = 1000; // Base price
    
    for (let i = 0; i < count; i++) {
        const change = (Math.random() - 0.5) * 100;
        currentPrice = Math.max(100, currentPrice + change);
        data.push({
            timestamp: Date.now() - (count - i) * 3600000,
            price: currentPrice
        });
    }
    
    return data;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { loadMarketItems, renderMarketItems, setupMarketFilters, getPriceHistory };
}
