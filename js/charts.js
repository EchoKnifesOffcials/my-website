// ============================================================
// BLOXVIEW - CHART COMPONENTS
// Price charts, candlestick alternative, market visualization
// ============================================================

let priceChart = null;
let currentChartItem = "Harvester";
let currentTimeframe = "1D";

// Generate chart data for an item
function generateChartData(item, timeframe) {
    const basePrice = item.value;
    const volatility = basePrice * 0.05;
    const periods = { '1D': 24, '1W': 30, '1M': 60, '3M': 90 };
    const count = periods[timeframe] || 24;
    const data = [];
    let currentPrice = basePrice * 0.9;
    
    for (let i = 0; i < count; i++) {
        const change = (Math.random() - 0.5) * volatility;
        currentPrice = Math.max(basePrice * 0.5, currentPrice + change);
        data.push({
            timestamp: Date.now() - (count - i) * 3600000,
            price: Math.round(currentPrice)
        });
    }
    
    return data;
}

// Update the price chart
function updatePriceChart() {
    const allItems = [...MM2_ITEMS, ...ADOPT_ITEMS];
    const item = allItems.find(i => i.name === currentChartItem);
    if (!item) return;
    
    const chartData = generateChartData(item, currentTimeframe);
    const labels = chartData.map(d => new Date(d.timestamp).toLocaleTimeString());
    const prices = chartData.map(d => d.price);
    
    // Update header info
    document.getElementById('selectedItemName').innerText = item.name;
    document.getElementById('currentPrice').innerText = Format.currency(item.value);
    document.getElementById('priceChange').innerText = item.change;
    document.getElementById('priceChange').className = `price-change ${item.change.startsWith('+') ? 'up' : 'down'}`;
    document.getElementById('volume24h').innerText = Format.number(item.stock);
    document.getElementById('demandLevel').innerHTML = `<span style="color:${item.demand === 'high' ? '#10b981' : '#f59e0b'}">${item.demand.toUpperCase()}</span>`;
    document.getElementById('stockLevel').innerHTML = `<span class="stock-badge ${getStockClass(item.stock)}">${Format.number(item.stock)} units</span>`;
    
    // Destroy existing chart
    if (priceChart) {
        priceChart.destroy();
    }
    
    // Create new chart
    const ctx = document.getElementById('priceChart').getContext('2d');
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${item.name} Price (R$)`,
                data: prices,
                borderColor: '#00f3ff',
                backgroundColor: 'rgba(0, 243, 255, 0.05)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: '#00f3ff',
                pointBorderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: { color: '#ffffff' }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `Price: ${Format.currency(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#8a8f9e', maxRotation: 45, minRotation: 45 },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                y: {
                    ticks: { color: '#8a8f9e', callback: (value) => Format.currency(value) },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                }
            }
        }
    });
}

// Setup chart controls
function setupChartControls() {
    // Timeframe buttons
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTimeframe = btn.dataset.timeframe;
            updatePriceChart();
        });
    });
    
    // Item selector buttons
    document.querySelectorAll('.chart-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentChartItem = btn.dataset.item;
            updatePriceChart();
        });
    });
}

// Get stock class for badge
function getStockClass(stock) {
    if (stock > 500) return 'stock-high';
    if (stock > 100) return 'stock-medium';
    return 'stock-low';
}

// Create mini chart for item cards
function createMiniChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map((_, i) => i),
            datasets: [{
                data: data,
                borderColor: '#00f3ff',
                borderWidth: 2,
                fill: false,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        updatePriceChart,
        setupChartControls,
        createMiniChart,
        getStockClass
    };
}
