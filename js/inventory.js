// ============================================================
// BLOXVIEW - INVENTORY SYSTEM
// Deposits, withdrawals, user inventory tracking
// ============================================================

let userInventory = [];

// Load inventory from localStorage
function loadInventory() {
    userInventory = Storage.get('bloxview_inventory', []);
    renderInventory();
    updateProfileStats();
}

// Save inventory to localStorage
function saveInventory() {
    Storage.set('bloxview_inventory', userInventory);
    updateProfileStats();
}

// Render inventory grid
function renderInventory() {
    const container = document.getElementById('inventoryGrid');
    const loading = document.getElementById('inventoryLoading');
    const empty = document.getElementById('inventoryEmpty');
    
    if (!container) return;
    
    if (loading) loading.style.display = 'block';
    
    setTimeout(() => {
        if (userInventory.length === 0) {
            if (container) container.innerHTML = '';
            if (empty) empty.style.display = 'block';
            if (loading) loading.style.display = 'none';
            return;
        }
        
        if (empty) empty.style.display = 'none';
        
        container.innerHTML = userInventory.map(item => `
            <div class="item-card">
                <div class="item-image">${item.icon}</div>
                <h3 class="font-bold">${item.name}</h3>
                <div class="price-tag">${Format.currency(item.value)}</div>
                <div class="text-xs text-gray-400 mt-2">Deposited: ${item.date}</div>
                <button class="w-full mt-3 py-2 rounded-xl bg-red-500/20 text-red-400" 
                        onclick="withdrawItem(${item.id}, '${item.game}')">
                    Withdraw
                </button>
            </div>
        `).join('');
        
        if (loading) loading.style.display = 'none';
    }, 200);
}

// Update profile statistics
function updateProfileStats() {
    const depositsEl = document.getElementById('profileDeposits');
    if (depositsEl) {
        depositsEl.innerText = userInventory.length;
    }
    
    // Calculate total value
    const totalValue = userInventory.reduce((sum, item) => sum + item.value, 0);
    const totalValueEl = document.getElementById('inventoryTotalValue');
    if (totalValueEl) {
        totalValueEl.innerText = Format.currency(totalValue);
    }
}

// Deposit item to inventory
function depositItem(item, game, quantity = 1) {
    if (quantity < 1) {
        Toast.show('Quantity must be at least 1', 'error');
        return false;
    }
    
    // Check daily limit
    const todayDeposits = userInventory.filter(i => i.date === new Date().toLocaleDateString()).length;
    if (todayDeposits + quantity > 50) {
        Toast.show('Daily deposit limit reached (50 items)', 'error');
        return false;
    }
    
    // Calculate fee
    const totalValue = item.value * quantity;
    const fee = Economy.calculateFee(totalValue, 'deposit');
    
    for (let i = 0; i < quantity; i++) {
        userInventory.push({
            ...item,
            game: game,
            date: new Date().toLocaleDateString(),
            timestamp: Date.now()
        });
    }
    
    saveInventory();
    renderInventory();
    
    // Update economy metrics
    Economy.updateMetrics(item.id, 'deposit', quantity);
    
    Toast.show(`Deposited ${quantity}x ${item.name}!`, 'success');
    return true;
}

// Withdraw item from inventory
function withdrawItem(itemId, game) {
    const index = userInventory.findIndex(i => i.id === itemId && i.game === game);
    
    if (index === -1) {
        Toast.show('Item not found in inventory', 'error');
        return false;
    }
    
    const item = userInventory[index];
    
    // Calculate withdrawal fee
    const fee = Economy.calculateFee(item.value, 'withdraw');
    
    userInventory.splice(index, 1);
    saveInventory();
    renderInventory();
    
    // Update economy metrics
    Economy.updateMetrics(item.id, 'withdraw', 1);
    
    Toast.show(`Withdrawn ${item.name}!`, 'success');
    return true;
}

// Check if user has item in inventory
function hasItem(itemId, game) {
    return userInventory.some(i => i.id === itemId && i.game === game);
}

// Get inventory value
function getInventoryValue() {
    return userInventory.reduce((sum, item) => sum + item.value, 0);
}

// Get inventory by game
function getInventoryByGame(game) {
    return userInventory.filter(item => item.game === game);
}

// Clear inventory (for testing)
function clearInventory() {
    if (confirm('Are you sure? This will delete all your deposited items.')) {
        userInventory = [];
        saveInventory();
        renderInventory();
        Toast.show('Inventory cleared', 'info');
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadInventory,
        renderInventory,
        depositItem,
        withdrawItem,
        hasItem,
        getInventoryValue,
        getInventoryByGame,
        clearInventory
    };
}
