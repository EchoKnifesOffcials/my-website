// ============================================================
// BLOXVIEW - MAIN APPLICATION
// Navigation, modals, initialization, event handlers
// ============================================================

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

// Initialize application
function initApp() {
    // Load data
    loadInventory();
    loadMarketItems();
    
    // Setup UI
    setupNavigation();
    setupModals();
    setupSearchFilters();
    setupChartControls();
    setupEventListeners();
    
    // Initialize economy
    initEconomy();
    
    // Render initial views
    renderTrending();
    renderMarketItems();
    
    // Update price chart
    updatePriceChart();
    
    console.log('Bloxview initialized');
}

// Setup navigation between pages
function setupNavigation() {
    // Navigation links
    document.querySelectorAll('.nav-link, .bottom-nav-item, .mobile-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            if (page) switchPage(page);
        });
    });
    
    // Logo click
    const logo = document.getElementById('logoBtn');
    if (logo) {
        logo.addEventListener('click', () => switchPage('home'));
    }
    
    // Explore button
    const exploreBtn = document.getElementById('exploreBtn');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', () => switchPage('mm2'));
    }
    
    // Login button
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            Toast.show('Connected to Roblox account!', 'success');
        });
    }
}

// Switch between pages
function switchPage(page) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    
    // Show selected page
    const targetPage = document.getElementById(page + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // Update active nav links
    document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(nav => {
        nav.classList.remove('active');
        if (nav.dataset.page === page) {
            nav.classList.add('active');
        }
    });
    
    // Close mobile menu
    const mobileNav = document.getElementById('mobileNav');
    const mobileOverlay = document.getElementById('mobileOverlay');
    if (mobileNav) mobileNav.classList.remove('open');
    if (mobileOverlay) mobileOverlay.classList.remove('active');
    
    // Refresh page content
    if (page === 'mm2') {
        renderItems(MM2_ITEMS, 'mm2Grid', 'mm2', 'mm2Loading');
    } else if (page === 'adoptme') {
        renderItems(ADOPT_ITEMS, 'adoptGrid', 'adoptme', 'adoptLoading');
    } else if (page === 'inventory') {
        renderInventory();
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
}

// Setup modals
function setupModals() {
    // Deposit buttons
    const depositButtons = ['depositNavBtn', 'depositHeroBtn', 'depositInventoryBtn', 'mobileDepositBtn'];
    depositButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                const dummyItem = MM2_ITEMS[0];
                openDepositModal(dummyItem, 'mm2');
            });
        }
    });
    
    // Close deposit modal
    const closeModalBtn = document.getElementById('closeDepositModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeDepositModal);
    }
    
    // Close modal on overlay click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Escape key closes modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
    });
}

// Setup search and filters
function setupSearchFilters() {
    // MM2 search
    const mm2Search = document.getElementById('mm2Search');
    if (mm2Search) {
        mm2Search.addEventListener('input', debounce(() => {
            const term = mm2Search.value.toLowerCase();
            const filtered = MM2_ITEMS.filter(i => i.name.toLowerCase().includes(term));
            renderItems(filtered, 'mm2Grid', 'mm2', 'mm2Loading');
        }, 300));
    }
    
    // Adopt Me search
    const adoptSearch = document.getElementById('adoptSearch');
    if (adoptSearch) {
        adoptSearch.addEventListener('input', debounce(() => {
            const term = adoptSearch.value.toLowerCase();
            const filtered = ADOPT_ITEMS.filter(i => i.name.toLowerCase().includes(term));
            renderItems(filtered, 'adoptGrid', 'adoptme', 'adoptLoading');
        }, 300));
    }
}

// Setup general event listeners
function setupEventListeners() {
    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileNav = document.getElementById('mobileNav');
    const mobileOverlay = document.getElementById('mobileOverlay');
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileNav.classList.toggle('open');
            mobileOverlay.classList.toggle('active');
        });
    }
    
    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', () => {
            mobileNav.classList.remove('open');
            mobileOverlay.classList.remove('active');
        });
    }
    
    // Window resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (priceChart) priceChart.resize();
        }, 250);
    });
}

// Render trending items on home page
function renderTrending() {
    const container = document.getElementById('trendingGrid');
    if (!container) return;
    
    const trending = [...MM2_ITEMS, ...ADOPT_ITEMS]
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    
    container.innerHTML = trending.map(item => `
        <div class="item-card" onclick='openItemModal(${JSON.stringify(item)}, "${item.id < 100 ? 'mm2' : 'adoptme'}")'>
            <div class="item-image">${item.icon}</div>
            <h3 class="font-bold">${item.name}</h3>
            <div class="price-tag">${Format.currency(item.value)}</div>
            <div class="flex justify-between mt-2">
                <span class="${item.change.startsWith('+') ? 'trend-up' : 'trend-down'}">${item.change}</span>
            </div>
        </div>
    `).join('');
}

// Render items grid (MM2 or Adopt Me)
function renderItems(items, containerId, game, loadingId) {
    const container = document.getElementById(containerId);
    const loading = document.getElementById(loadingId);
    
    if (!container) return;
    
    if (loading) loading.style.display = 'block';
    if (container) container.style.opacity = '0.5';
    
    setTimeout(() => {
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state">No items found</div>';
        } else {
            container.innerHTML = items.map(item => `
                <div class="item-card" onclick='openItemModal(${JSON.stringify(item)}, "${game}")'>
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
                            onclick="event.stopPropagation(); openDepositModal(${JSON.stringify(item)}, '${game}')">
                        Deposit
                    </button>
                </div>
            `).join('');
        }
        
        if (loading) loading.style.display = 'none';
        if (container) container.style.opacity = '1';
    }, 200);
}

// Global exports for HTML onclick handlers
window.openItemModal = openItemModal;
window.closeItemModal = closeItemModal;
window.openDepositModal = openDepositModal;
window.closeDepositModal = closeDepositModal;
window.withdrawItem = withdrawItem;
window.switchPage = switchPage;
