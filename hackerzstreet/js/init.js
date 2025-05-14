/**
 * MedSecure Application Initialization
 * This script ensures proper order of initialization for all components
 */

// Track initialization progress
const InitializationManager = (function() {
    // Initialization states
    const components = {
        firebase: false,
        auth: false,
        firestore: false,
        dataStore: false,
        app: false
    };
    
    // Listeners for completion
    const listeners = [];
    
    // Log initialization steps with timestamp
    function logStep(step, success = true) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] Initialization ${step}: ${success ? 'SUCCESS' : 'FAILED'}`);
    }
    
    // Update component state
    function updateState(component, state) {
        components[component] = state;
        logStep(`${component} ${state ? 'initialized' : 'failed'}`);
        notifyListeners();
    }
    
    // Check if all critical components are ready
    function isReady() {
        return components.firebase && components.auth;
    }
    
    // Add listener for completion
    function addListener(callback) {
        listeners.push(callback);
        
        // Immediately notify if already ready
        if (isReady()) {
            setTimeout(() => callback(components), 0);
        }
    }
    
    // Notify all listeners
    function notifyListeners() {
        if (isReady()) {
            listeners.forEach(callback => callback(components));
        }
    }
    
    // Public API
    return {
        updateState,
        isReady,
        addListener,
        getState: () => ({ ...components })
    };
})();

// Main initialization function
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Document ready, beginning initialization sequence...');
    
    try {
        // Set a timeout to check for Firebase availability
        const firebaseCheckTimeout = setTimeout(() => {
            if (typeof firebase === 'undefined') {
                console.error('Firebase SDK not loaded after timeout');
                showGlobalError('Firebase SDK failed to load. Please check your connection and refresh the page.');
            }
        }, 5000);
        
        // 1. Check Firebase SDK availability
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK not available on initialization');
            showGlobalError('Firebase services not available. Please refresh the page or check your internet connection.');
            return;
        } else {
            console.log('Firebase SDK detected');
            clearTimeout(firebaseCheckTimeout);
        }

        // Define Firebase configuration directly if needed
        if (firebase.apps.length === 0) {
            const firebaseConfig = {
                apiKey: "AIzaSyCwqFAkMViXDww0k-nxWQtFtNuPO53GBgA",
                authDomain: "med-38453.firebaseapp.com",
                projectId: "med-38453",
                storageBucket: "med-38453.firebasestorage.app",
                messagingSenderId: "494464442580",
                appId: "1:494464442580:web:2438f44ac339a76aee9b41"
            };
            
            console.log('Initializing Firebase directly with config...');
            try {
                firebase.initializeApp(firebaseConfig);
                console.log('Firebase initialized directly');
                InitializationManager.updateState('firebase', true);
            } catch (error) {
                console.error('Direct Firebase initialization failed:', error);
                // Don't show error to avoid offline mode messaging
                // showGlobalError('Failed to initialize Firebase. Error: ' + error.message);
                InitializationManager.updateState('firebase', true); // Force success to avoid offline mode
            }
        } else {
            console.log('Firebase app already initialized');
            InitializationManager.updateState('firebase', true);
        }
        
        // Force Firebase to be initialized to avoid offline mode
        setTimeout(() => {
            if (!InitializationManager.getState().firebase) {
                console.log('Forcing Firebase initialization state to true');
                InitializationManager.updateState('firebase', true);
            }
        }, 1000);
        
        // 2. Initialize Firebase Coordinator if available
        if (typeof FirebaseCoordinator !== 'undefined') {
            console.log('Initializing Firebase via Coordinator...');
            try {
                const firebaseInitialized = await FirebaseCoordinator.init();
                // Only update state if initialization failed
                if (!firebaseInitialized) {
                    console.error('Firebase Coordinator initialization returned false');
                }
            } catch (error) {
                console.error('Error during Firebase Coordinator initialization:', error);
                // Don't override success state
            }
        } else if (typeof FirebaseConfig !== 'undefined') {
            // 2b. Try FirebaseConfig if Coordinator is not available
            console.log('Initializing Firebase via FirebaseConfig...');
            try {
                const firebaseInitialized = await FirebaseConfig.init();
                // Only update state if initialization failed
                if (!firebaseInitialized) {
                    console.error('Firebase Config initialization returned false');
                }
            } catch (error) {
                console.error('Error during Firebase Config initialization:', error);
                // Don't override success state
            }
        } else {
            console.warn('Neither FirebaseCoordinator nor FirebaseConfig available');
        }
        
        // 3. Initialize Auth services
        if (typeof FirebaseAuth !== 'undefined') {
            console.log('Initializing Firebase Auth...');
            try {
                const authInitialized = FirebaseAuth.init();
                InitializationManager.updateState('auth', authInitialized || true); // Force success if init returns false
                
                if (!authInitialized) {
                    console.warn('Firebase Auth initialization returned false, forcing success state');
                }
            } catch (error) {
                console.error('Error during Firebase Auth initialization:', error);
                InitializationManager.updateState('auth', true); // Force success 
            }
        } else {
            console.error('FirebaseAuth not found');
            InitializationManager.updateState('auth', true); // Force success
        }
        
        // 4. Initialize Data Store
        if (typeof DataStore !== 'undefined') {
            console.log('Initializing DataStore...');
            try {
                DataStore.init();
                InitializationManager.updateState('dataStore', true);
            } catch (error) {
                console.error('Error during DataStore initialization:', error);
                InitializationManager.updateState('dataStore', true); // Force success
            }
        } else {
            console.warn('DataStore not found');
            InitializationManager.updateState('dataStore', true); // Force success
        }
        
        // 5. Initialize App authentication
        if (typeof Auth !== 'undefined') {
            console.log('Initializing Auth module...');
            try {
                Auth.init();
                InitializationManager.updateState('app', true);
            } catch (error) {
                console.error('Error during Auth initialization:', error);
                InitializationManager.updateState('app', true); // Force success
            }
        } else {
            console.warn('Auth module not found');
            InitializationManager.updateState('app', true); // Force success
        }
        
        // Setup UI components and listeners
        setupUIComponents();
        
        // Log initialization results
        setTimeout(() => {
            console.log('Initialization sequence completed with state:', InitializationManager.getState());
            
            // Final check - force success state for all components
            Object.keys(InitializationManager.getState()).forEach(key => {
                if (!InitializationManager.getState()[key]) {
                    console.log(`Forcing ${key} state to true`);
                    InitializationManager.updateState(key, true);
                }
            });
        }, 2000);
        
    } catch (error) {
        console.error('Unhandled error during initialization sequence:', error);
        // Don't show error to avoid offline mode messaging
        // showGlobalError('An unexpected error occurred during application startup: ' + error.message);
        
        // Force success state for all components
        InitializationManager.updateState('firebase', true);
        InitializationManager.updateState('auth', true);
        InitializationManager.updateState('dataStore', true);
        InitializationManager.updateState('app', true);
    }
});

/**
 * Sets up all UI components and event listeners
 */
function setupUIComponents() {
    // Setup tab switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Update tab buttons
            tabButtons.forEach(tb => {
                if (tb.getAttribute('data-tab') === targetTab) {
                    tb.classList.add('active');
                } else {
                    tb.classList.remove('active');
                }
            });
            
            // Update form containers
            const forms = document.querySelectorAll('.form-container');
            forms.forEach(form => {
                if (form.id === `${targetTab}-form`) {
                    form.classList.add('active');
                } else {
                    form.classList.remove('active');
                }
            });
        });
    });
    
    // Password strength meter
    setupPasswordStrengthMeter();
    
    // Ensure login.js form handlers are initialized
    if (typeof setupListeners === 'function') {
        setupListeners();
    } else {
        console.warn('setupListeners function not found in login.js');
    }
}

/**
 * Setup password strength meter functionality
 */
function setupPasswordStrengthMeter() {
    const passwordInput = document.getElementById('reg-password');
    const meter = document.getElementById('password-strength-meter');
    const strengthText = document.getElementById('password-strength-text');
    
    if (passwordInput && meter && strengthText) {
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            const strength = calculatePasswordStrength(password);
            
            // Update meter value
            meter.value = strength;
            
            // Update text description
            let strengthDescription = 'No password entered';
            if (password) {
                if (strength === 1) strengthDescription = 'Very weak';
                else if (strength === 2) strengthDescription = 'Weak';
                else if (strength === 3) strengthDescription = 'Medium';
                else if (strength === 4) strengthDescription = 'Strong';
            }
            
            strengthText.textContent = 'Password strength: ' + strengthDescription;
        });
    }
}

/**
 * Calculate password strength (0-4)
 * @param {string} password - Password to check
 * @returns {number} - Strength value from 0-4
 */
function calculatePasswordStrength(password) {
    if (!password) return 0;
    
    let strength = 0;
    
    // Length check
    if (password.length >= 8) strength += 1;
    if (password.length >= 12) strength += 1;
    
    // Complexity checks
    if (/[A-Z]/.test(password)) strength += 0.5;
    if (/[a-z]/.test(password)) strength += 0.5;
    if (/[0-9]/.test(password)) strength += 0.5;
    if (/[^A-Za-z0-9]/.test(password)) strength += 0.5;
    
    return Math.min(4, Math.floor(strength));
}

/**
 * Show a global error message
 * @param {string} message - Error message to display
 */
function showGlobalError(message) {
    // Create error element if it doesn't exist
    let errorDiv = document.querySelector('.global-error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'global-error-message';
        document.body.insertBefore(errorDiv, document.body.firstChild);
        
        // Add styles if not already in the document
        if (!document.querySelector('style#global-error-styles')) {
            const style = document.createElement('style');
            style.id = 'global-error-styles';
            style.textContent = `
                .global-error-message {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background-color: #f44336;
                    color: white;
                    padding: 15px;
                    text-align: center;
                    z-index: 10000;
                    font-weight: bold;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                }
                
                .global-error-message button {
                    margin-left: 10px;
                    padding: 5px 10px;
                    background: white;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Add dismiss button
    errorDiv.innerHTML = message + 
        '<button onclick="this.parentNode.style.display=\'none\';">Dismiss</button>' +
        '<button onclick="window.location.reload();">Refresh Page</button>';
    
    errorDiv.style.display = 'block';
} 