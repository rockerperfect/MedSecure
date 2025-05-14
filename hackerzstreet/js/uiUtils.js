/**
 * UI Utilities for MedSecure
 * 
 * Provides helper functions for fixing UI issues across the application.
 */

const UIUtils = {
    /**
     * Fix caret visibility issues across the entire application
     * Sets transparent caret color globally except for text inputs
     */
    fixCaretVisibility: function() {
        // Hide caret on all elements (and set default cursor)
        document.querySelectorAll('*').forEach(el => {
            el.style.caretColor = 'transparent';
            el.style.cursor = 'default';
        });
        
        // Enable caret only on text inputs with primary color
        const textInputs = document.querySelectorAll('input[type="text"], input[type="password"], input[type="email"], input[type="search"], input[type="tel"], input[type="url"], input[type="number"], textarea');
        textInputs.forEach(input => {
            input.style.caretColor = 'var(--primary-color)';
            input.style.cursor = 'text';
        });
        
        // Set pointer cursor on interactive elements
        const clickables = document.querySelectorAll('a, button, .btn, select, input[type="checkbox"], input[type="radio"], input[type="submit"], input[type="button"], label[for], .nav-link, .tab-btn, .record-card, .card');
        clickables.forEach(el => {
            el.style.cursor = 'pointer';
        });
        
        // Specifically target problematic areas
        document.querySelectorAll('.checkbox-container, #two-factor-auth-container, .form-group label, label[for]').forEach(el => {
            el.style.caretColor = 'transparent';
        });
    },
    
    /**
     * Initialize UI utilities
     */
    init: function() {
        console.log('Initializing UI utilities');
        
        // Fix caret visibility issues
        this.fixCaretVisibility();
        
        // Re-apply fixes whenever focus changes
        document.addEventListener('focusin', () => {
            setTimeout(() => this.fixCaretVisibility(), 0);
        });
        
        // Apply fixes on any click
        document.addEventListener('click', () => {
            setTimeout(() => this.fixCaretVisibility(), 0);
        });
    }
};

// Auto-initialize when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
    UIUtils.init();
}); 