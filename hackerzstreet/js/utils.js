/**
 * MedSecure Utilities Module
 * Common utility functions used across the application
 */

const Utils = (function() {
    /**
     * Format a date as a readable string
     * @param {Date|string} date - Date to format
     * @param {boolean} includeTime - Whether to include the time
     * @returns {string} Formatted date string
     */
    function formatDate(date, includeTime = false) {
        if (!date) return '';
        
        const d = typeof date === 'string' ? new Date(date) : date;
        
        if (isNaN(d.getTime())) return '';
        
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric'
        };
        
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        
        return d.toLocaleDateString('en-US', options);
    }
    
    /**
     * Truncate a string to a maximum length
     * @param {string} str - String to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} Truncated string
     */
    function truncateString(str, maxLength = 50) {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - 3) + '...';
    }
    
    /**
     * Generate a random ID
     * @param {number} length - Length of the ID
     * @returns {string} Random ID
     */
    function generateId(length = 10) {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = '';
        for (let i = 0; i < length; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }
    
    /**
     * Delay execution using a promise
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after the delay
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Debounce a function to limit how often it runs
     * @param {Function} func - Function to debounce
     * @param {number} wait - Milliseconds to wait
     * @returns {Function} Debounced function
     */
    function debounce(func, wait = 300) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    /**
     * Convert file size in bytes to human-readable format
     * @param {number} bytes - File size in bytes
     * @returns {string} Human-readable file size
     */
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Public API
    return {
        formatDate,
        truncateString,
        generateId,
        delay,
        debounce,
        formatFileSize
    };
})(); 