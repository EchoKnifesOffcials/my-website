// ============================================================
// BLOXVIEW - UTILITY FUNCTIONS
// Toast, Formatting, Debounce, Storage, Helpers
// ============================================================

// Toast Notifications
const Toast = {
    container: null,
    
    init() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            this.container.id = 'toastContainer';
            document.body.appendChild(this.container);
        }
    },
    
    show(message, type = 'info') {
        this.init();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas ${this.getIcon(type)}"></i> ${message}`;
        this.container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(50px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    getIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }
};

// Number Formatting
const Format = {
    currency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    },
    
    number(value) {
        return new Intl.NumberFormat('en-US').format(value);
    },
    
    compact(value) {
        return new Intl.NumberFormat('en-US', {
            notation: 'compact',
            compactDisplay: 'short'
        }).format(value);
    },
    
    percent(value) {
        return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
    },
    
    date(timestamp) {
        return new Date(timestamp).toLocaleDateString();
    },
    
    datetime(timestamp) {
        return new Date(timestamp).toLocaleString();
    }
};

// Debounce Function
function debounce(func, delay = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, delay);
    };
}

// Throttle Function
function throttle(func, limit = 300) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Local Storage Helpers
const Storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Storage get error:', e);
            return defaultValue;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },
    
    remove(key) {
        localStorage.removeItem(key);
    },
    
    clear() {
        localStorage.clear();
    }
};

// DOM Helpers
const DOM = {
    hide(element) {
        if (element) element.style.display = 'none';
    },
    
    show(element, display = 'block') {
        if (element) element.style.display = display;
    },
    
    toggle(element) {
        if (element) {
            element.style.display = element.style.display === 'none' ? 'block' : 'none';
        }
    },
    
    addClass(element, className) {
        if (element) element.classList.add(className);
    },
    
    removeClass(element, className) {
        if (element) element.classList.remove(className);
    },
    
    hasClass(element, className) {
        return element ? element.classList.contains(className) : false;
    }
};

// Random Helpers
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function truncate(str, length = 50) {
    if (str.length <= length) return str;
    return str.substring(0, length) + '...';
}

function isEmpty(obj) {
    return obj === null || obj === undefined || (typeof obj === 'object' && Object.keys(obj).length === 0);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Toast, Format, debounce, throttle, Storage, DOM, generateId, capitalize, truncate, isEmpty };
}
