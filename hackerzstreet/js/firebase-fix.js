/**
 * MedSecure Enterprise - Firebase Fix Module
 * Handles recovery from Firebase authentication and connection errors
 */
const FirebaseFix = (function() {
    // Configuration
    const config = {
        maxRecoveryAttempts: 3,
        emulatorHost: 'localhost',
        emulatorPort: 8000,
        connectionTestTimeout: 5000
    };
    
    // Internal state
    let initialized = false;
    let recoveryAttempts = 0;
    let lastErrorTimestamp = 0;
    
    /**
     * Initialize the Firebase Fix module
     * @param {Object} options Configuration options
     */
    function init(options = {}) {
        if (initialized) {
            console.log('FirebaseFix already initialized');
            return;
        }
        
        // Merge options with defaults
        Object.assign(config, options);
        
        console.log('Initializing FirebaseFix module with config:', config);
        
        // Set up error listeners
        setupErrorListeners();
        
        // Mark as initialized
        initialized = true;
    }
    
    /**
     * Set up listeners for Firebase authentication and Firestore errors
     */
    function setupErrorListeners() {
        // Listen for authentication state changes
        if (firebase.auth) {
            firebase.auth().onAuthStateChanged(user => {
                if (user) {
                    console.log('User authenticated:', user.uid);
                    // Reset recovery attempts when user authenticates
                    recoveryAttempts = 0;
                } else {
                    console.log('User not authenticated');
                }
            }, error => {
                console.error('Auth state change error:', error);
                if (isFirebaseError(error)) {
                    handleFirebaseError(error);
                }
            });
        }
        
        // Listen for connection changes from Firebase Coordinator
        document.addEventListener('firebase-connection-change', event => {
            const isOnline = event.detail.state === 'online';
            console.log(`FirebaseFix detected connection change: ${isOnline ? 'online' : 'offline'}`);
            
            if (isOnline) {
                // We're back online, reset recovery attempts
                recoveryAttempts = 0;
                
                // Hide any error notifications
                hideErrorNotifications();
            }
        });
    }
    
    /**
     * Check if Firebase emulators are running
     * @returns {Promise<boolean>} Promise that resolves to whether emulators are running
     */
    function checkEmulators() {
        return new Promise(resolve => {
            // Create a timeout
            const timeoutId = setTimeout(() => {
                console.log('Emulator check timed out, assuming not running');
                resolve(false);
            }, config.connectionTestTimeout);
            
            // Check if we can fetch the Firebase Auth emulator
            fetch(`http://${config.emulatorHost}:${config.emulatorPort}/__/auth/`)
                .then(response => {
                    clearTimeout(timeoutId);
                    const emulatorsRunning = response.status === 200;
                    console.log(`Firebase emulators are ${emulatorsRunning ? 'running' : 'not running'}`);
                    resolve(emulatorsRunning);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    console.log('Error checking emulators, assuming not running:', error);
                    resolve(false);
                });
        });
    }
    
    /**
     * Check if an error is a Firebase error
     * @param {Error} error The error to check
     * @returns {boolean} Whether the error is a Firebase error
     */
    function isFirebaseError(error) {
        if (!error) return false;
        
        // Check for Firebase error code
        if (error.code && typeof error.code === 'string' && 
            (error.code.startsWith('auth/') || 
             error.code.startsWith('firestore/') || 
             error.code.startsWith('storage/'))) {
            return true;
        }
        
        // Check for Firebase error message
        if (error.message && typeof error.message === 'string' && 
            (error.message.includes('Firebase') || 
             error.message.includes('firestore') || 
             error.message.includes('auth'))) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Check if an error is a network authentication error
     * @param {Error} error The error to check
     * @returns {boolean} Whether the error is a network authentication error
     */
    function isNetworkAuthError(error) {
        if (!error) return false;
        
        // Common network authentication error codes
        const networkAuthCodes = [
            'auth/network-request-failed',
            'firestore/unavailable',
            'firestore/failed-precondition'
        ];
        
        // Check for error code
        if (error.code && networkAuthCodes.includes(error.code)) {
            return true;
        }
        
        // Check for error message
        if (error.message && typeof error.message === 'string') {
            const messagePatterns = [
                'network error',
                'network request failed',
                'unable to establish connection',
                'cannot connect to host',
                'connection refused',
                'network authentication',
                'ssl handshake',
                'certificate verify',
                'ECONNREFUSED'
            ];
            
            return messagePatterns.some(pattern => 
                error.message.toLowerCase().includes(pattern.toLowerCase())
            );
        }
        
        return false;
    }
    
    /**
     * Check if an error is a Firestore error
     * @param {Error} error The error to check
     * @returns {boolean} Whether the error is a Firestore error
     */
    function isFirestoreError(error) {
        if (!error) return false;
        
        // Check for Firestore error code
        if (error.code && typeof error.code === 'string' && 
            error.code.startsWith('firestore/')) {
            return true;
        }
        
        // Check for Firestore error message
        if (error.message && typeof error.message === 'string' && 
            (error.message.includes('firestore') || 
             error.message.includes('Firestore'))) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Handle a Firebase error
     * @param {Error} error The error to handle
     */
    function handleFirebaseError(error) {
        // Don't handle the same error multiple times in a short period
        if (Date.now() - lastErrorTimestamp < 5000) {
            console.log('Ignoring rapid repeated error');
            return;
        }
        
        lastErrorTimestamp = Date.now();
        
        console.error('Handling Firebase error:', error);
        
        // Increment recovery attempts
        recoveryAttempts++;
        
        // Don't try too many times
        if (recoveryAttempts > config.maxRecoveryAttempts) {
            console.log(`Exceeded max recovery attempts (${config.maxRecoveryAttempts})`);
            showPersistentNotification(
                'Database connection issues', 
                'We\'re having trouble connecting to the database. Try reloading the app or working offline.',
                [
                    { 
                        text: 'Reload', 
                        action: () => window.location.reload() 
                    },
                    { 
                        text: 'Work Offline', 
                        action: () => {
                            // Enable offline mode if we have the function
                            if (typeof App !== 'undefined' && typeof App.enableOfflineMode === 'function') {
                                App.enableOfflineMode();
                            }
                        } 
                    }
                ]
            );
            return;
        }
        
        // Handle different error types
        if (isNetworkAuthError(error)) {
            showTemporaryNotification('Network issues detected. Attempting to reconnect...');
            fixNetworkAuth();
        } else if (isFirestoreError(error)) {
            showTemporaryNotification('Database connection issues. Trying to fix...');
            fixFirestore();
        } else {
            // General Firebase error
            if (typeof FirebaseCoordinator !== 'undefined' && 
                typeof FirebaseCoordinator.testConnection === 'function') {
                FirebaseCoordinator.testConnection();
            }
            
            showTemporaryNotification('Attempting to recover from error...');
        }
    }
    
    /**
     * Fix network authentication issues
     */
    function fixNetworkAuth() {
        console.log(`Attempting to fix network auth (attempt ${recoveryAttempts}/${config.maxRecoveryAttempts})`);
        
        // Check if emulators are running if needed
        if (window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1') {
            checkEmulators().then(emulatorsRunning => {
                if (!emulatorsRunning) {
                    showPersistentNotification(
                        'Firebase Emulators Not Running', 
                        'It appears the Firebase emulators are not running. Start them and reload the app.',
                        [
                            { 
                                text: 'Reload', 
                                action: () => window.location.reload() 
                            }
                        ]
                    );
                    return;
                }
                
                // Try to fix with Coordinator if available
                tryFirebaseCoordinatorFix();
            });
        } else {
            // Production environment
            tryFirebaseCoordinatorFix();
        }
    }
    
    /**
     * Fix Firestore issues
     */
    function fixFirestore() {
        console.log(`Attempting to fix Firestore (attempt ${recoveryAttempts}/${config.maxRecoveryAttempts})`);
        
        // Try to use the Coordinator if available
        tryFirebaseCoordinatorFix();
    }
    
    /**
     * Try to fix issues using Firebase Coordinator
     */
    function tryFirebaseCoordinatorFix() {
        if (typeof FirebaseCoordinator === 'undefined' || 
            typeof FirebaseCoordinator.reinitialize !== 'function') {
            console.log('Firebase Coordinator not available for fix');
            return;
        }
        
        // Different strategies based on number of attempts
        switch (recoveryAttempts) {
            case 1:
                // First try: Enable long polling
                FirebaseCoordinator.reinitialize({
                    longPollingEnabled: true
                });
                break;
                
            case 2:
                // Second try: Try different emulator port
                FirebaseCoordinator.reinitialize({
                    longPollingEnabled: true,
                    emulatorPort: config.emulatorPort === 8000 ? 8080 : 8000
                });
                break;
                
            case 3:
                // Third try: Force cache
                FirebaseCoordinator.reinitialize({
                    longPollingEnabled: true,
                    experimentalForceFirestoreCache: true
                });
                break;
                
            default:
                // Last resort: Suggest reload
                showPersistentNotification(
                    'Connection Issues', 
                    'We\'re having trouble connecting to the database. Try reloading the app or working offline.',
                    [
                        { 
                            text: 'Reload', 
                            action: () => window.location.reload() 
                        },
                        { 
                            text: 'Work Offline', 
                            action: () => {
                                if (typeof App !== 'undefined' && typeof App.enableOfflineMode === 'function') {
                                    App.enableOfflineMode();
                                }
                            } 
                        }
                    ]
                );
                break;
        }
    }
    
    /**
     * Show a temporary notification
     * @param {string} message The notification message
     */
    function showTemporaryNotification(message) {
        // Check if notification container exists
        let container = document.getElementById('firebase-fix-notifications');
        
        if (!container) {
            // Create container
            container = document.createElement('div');
            container.id = 'firebase-fix-notifications';
            container.className = 'firebase-fix-notification-container';
            document.body.appendChild(container);
            
            // Add styles
            addNotificationStyles();
        }
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = 'firebase-fix-notification temporary';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-spinner"></span>
                <span class="notification-message">${message}</span>
            </div>
        `;
        
        // Add to container
        container.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.classList.add('notification-hiding');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                
                // Remove container if empty
                if (container.children.length === 0 && container.parentNode) {
                    container.parentNode.removeChild(container);
                }
            }, 300);
        }, 5000);
    }
    
    /**
     * Show a persistent notification
     * @param {string} title The notification title
     * @param {string} message The notification message
     * @param {Array} buttons Array of button objects with text and action
     */
    function showPersistentNotification(title, message, buttons = []) {
        // Check if notification container exists
        let container = document.getElementById('firebase-fix-notifications');
        
        if (!container) {
            // Create container
            container = document.createElement('div');
            container.id = 'firebase-fix-notifications';
            container.className = 'firebase-fix-notification-container';
            document.body.appendChild(container);
            
            // Add styles
            addNotificationStyles();
        }
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = 'firebase-fix-notification persistent';
        
        // Create HTML
        let buttonsHtml = '';
        if (buttons && buttons.length) {
            buttonsHtml = '<div class="notification-buttons">';
            buttons.forEach((button, index) => {
                buttonsHtml += `<button class="notification-button" data-index="${index}">${button.text}</button>`;
            });
            buttonsHtml += '</div>';
        }
        
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-header">
                    <h3 class="notification-title">${title}</h3>
                    <button class="notification-close">&times;</button>
                </div>
                <div class="notification-body">
                    <p class="notification-message">${message}</p>
                    ${buttonsHtml}
                </div>
            </div>
        `;
        
        // Add to container
        container.appendChild(notification);
        
        // Add event listeners
        const closeButton = notification.querySelector('.notification-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                notification.classList.add('notification-hiding');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                    
                    // Remove container if empty
                    if (container.children.length === 0 && container.parentNode) {
                        container.parentNode.removeChild(container);
                    }
                }, 300);
            });
        }
        
        // Add button event listeners
        const buttonElements = notification.querySelectorAll('.notification-button');
        buttonElements.forEach(buttonElement => {
            buttonElement.addEventListener('click', () => {
                const index = parseInt(buttonElement.getAttribute('data-index'), 10);
                if (buttons[index] && typeof buttons[index].action === 'function') {
                    buttons[index].action();
                }
                
                // Hide the notification
                notification.classList.add('notification-hiding');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                    
                    // Remove container if empty
                    if (container.children.length === 0 && container.parentNode) {
                        container.parentNode.removeChild(container);
                    }
                }, 300);
            });
        });
    }
    
    /**
     * Hide all error notifications
     */
    function hideErrorNotifications() {
        const container = document.getElementById('firebase-fix-notifications');
        if (container) {
            // Hide all notifications
            const notifications = container.querySelectorAll('.firebase-fix-notification');
            notifications.forEach(notification => {
                notification.classList.add('notification-hiding');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            });
            
            // Remove container if empty
            setTimeout(() => {
                if (container.children.length === 0 && container.parentNode) {
                    container.parentNode.removeChild(container);
                }
            }, 400);
        }
    }
    
    /**
     * Add CSS styles for notifications
     */
    function addNotificationStyles() {
        if (document.getElementById('firebase-fix-notification-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'firebase-fix-notification-styles';
        style.textContent = `
            .firebase-fix-notification-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 10px;
                z-index: 10000;
                pointer-events: none;
                max-width: 400px;
            }
            
            .firebase-fix-notification {
                background-color: white;
                border-radius: 5px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                overflow: hidden;
                min-width: 250px;
                max-width: 100%;
                animation: slide-in 0.3s forwards;
                opacity: 0;
                pointer-events: auto;
            }
            
            @keyframes slide-in {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            .notification-hiding {
                animation: slide-out 0.3s forwards;
            }
            
            @keyframes slide-out {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            
            .firebase-fix-notification.temporary {
                background-color: #f8f9fa;
                padding: 10px 15px;
                border-left: 4px solid #007bff;
            }
            
            .firebase-fix-notification.persistent {
                border: 1px solid #e9ecef;
            }
            
            .notification-content {
                width: 100%;
            }
            
            .notification-header {
                padding: 10px 15px;
                background-color: #f8f9fa;
                border-bottom: 1px solid #e9ecef;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .notification-title {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }
            
            .notification-close {
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                color: #6c757d;
            }
            
            .notification-body {
                padding: 15px;
            }
            
            .notification-message {
                margin: 0 0 10px 0;
            }
            
            .notification-buttons {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 10px;
            }
            
            .notification-button {
                padding: 5px 10px;
                border: none;
                border-radius: 3px;
                background-color: #007bff;
                color: white;
                cursor: pointer;
                font-size: 14px;
            }
            
            .notification-button:hover {
                background-color: #0069d9;
            }
            
            .temporary .notification-content {
                display: flex;
                align-items: center;
            }
            
            .notification-spinner {
                display: inline-block;
                width: 16px;
                height: 16px;
                margin-right: 10px;
                border: 2px solid #007bff;
                border-top-color: transparent;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Public API
    return {
        init,
        isFirebaseError,
        isNetworkAuthError,
        isFirestoreError,
        handleFirebaseError,
        showTemporaryNotification,
        showPersistentNotification,
        hideErrorNotifications,
        checkEmulators
    };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FirebaseFix;
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("Initializing Firebase Fix module on page load");
    if (typeof FirebaseFix !== 'undefined') {
        FirebaseFix.init();
    }
});

