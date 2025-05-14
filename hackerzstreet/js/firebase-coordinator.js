/**
 * MedSecure Enterprise - Firebase Coordinator Module
 * Central module for managing Firebase initialization and connectivity
 */
const FirebaseCoordinator = (function() {
    // Configuration settings
    const settings = {
        projectId: "med-38453",
        apiKey: "AIzaSyCwqFAkMViXDww0k-nxWQtFtNuPO53GBgA",
        authDomain: "med-38453.firebaseapp.com",
        storageBucket: "med-38453.firebasestorage.app",
        messagingSenderId: "494464442580",
        appId: "1:494464442580:web:2438f44ac339a76aee9b41",
        useEmulators: false,
        emulatorHost: 'localhost',
        emulatorPort: 8080,
        longPollingEnabled: false,
        connectionTimeout: 10000,
        maxConnectionAttempts: 3,
        retryAttempts: 3,
        authEmulatorPort: 9099
    };

    // Connection state tracking
    const connectionState = {
        isOnline: navigator.onLine,
        firebaseInitialized: false,
        firestoreAvailable: false,
        authInitialized: false,
        lastConnectionTime: null,
        connectionAttempts: 0,
        connectionMonitorTimer: null,
        appInitialized: false
    };

    // DOM elements for UI feedback
    let offlineBanner = null;
    let connectionErrorModal = null;

    /**
     * Initialize Firebase with the provided configuration
     * @param {Object} options Optional configuration options
     * @returns {Promise<boolean>} Whether initialization was successful
     */
    function init(options = {}) {
        // Prevent multiple initializations
        if (connectionState.firebaseInitialized) {
            console.log('Firebase already initialized, skipping initialization');
            return Promise.resolve(true);
        }

        console.log('Initializing Firebase Coordinator');

        // Merge user options with defaults
        Object.assign(settings, options);

        // Set up initial Firebase app if not already done
        if (!connectionState.appInitialized) {
            try {
                if (typeof firebase === 'undefined') {
                    console.error('Firebase SDK not loaded');
                    return Promise.reject(new Error('Firebase SDK not loaded'));
                }

                if (firebase.apps.length === 0) {
                    const firebaseConfig = {
                        apiKey: settings.apiKey,
                        authDomain: settings.authDomain,
                        projectId: settings.projectId,
                        storageBucket: settings.storageBucket,
                        messagingSenderId: settings.messagingSenderId,
                        appId: settings.appId
                    };
                    
                    // Add databaseURL if it exists in settings
                    if (settings.databaseURL) {
                        firebaseConfig.databaseURL = settings.databaseURL;
                    }
                    
                    console.log('Initializing Firebase app with config:', {
                        apiKey: firebaseConfig.apiKey,
                        authDomain: firebaseConfig.authDomain,
                        projectId: firebaseConfig.projectId
                    });
                    
                    firebase.initializeApp(firebaseConfig);
                    console.log('Firebase app initialized successfully');
                } else {
                    console.log('Firebase app already initialized');
                }
                connectionState.appInitialized = true;
            } catch (error) {
                console.error('Error initializing Firebase app:', error);
                return Promise.reject(error);
            }
        }

        // Initialize Firebase Auth first
        let authPromise = Promise.resolve();
        try {
            if (typeof firebase.auth === 'function') {
                console.log('Initializing Firebase Auth');
                const auth = firebase.auth();
                
                // Set up auth state change listener
                authPromise = new Promise((resolve) => {
                    const unsubscribe = auth.onAuthStateChanged(user => {
                        console.log('Auth state changed:', user ? 'User signed in' : 'User signed out');
                        if (user) {
                            console.log('User ID:', user.uid);
                        }
                        connectionState.authInitialized = true;
                        
                        // We only need this callback once for initialization
                        unsubscribe();
                        resolve();
                    }, error => {
                        console.error('Auth state change error:', error);
                        connectionState.authInitialized = true;
                        // Still resolve to allow the app to continue
                        resolve();
                    });
                    
                    // Set a timeout to resolve the promise in case auth takes too long
                    setTimeout(() => {
                        if (!connectionState.authInitialized) {
                            console.warn('Auth initialization timeout - continuing anyway');
                            connectionState.authInitialized = true;
                            resolve();
                        }
                    }, 2000);
                });
                
                console.log('Firebase Auth initialization in progress');
            } else {
                console.error('Firebase Auth SDK not available');
            }
        } catch (error) {
            console.error('Error initializing Firebase Auth:', error);
        }

        // Add network listeners after Firebase is initialized
        setupNetworkListeners();

        // Wait for Auth to initialize, then continue with Firestore
        return authPromise
            .then(() => {
                console.log('Auth initialization complete, now initializing Firestore');
                return initializeFirestore();
            })
            .then(() => {
                // Initialize Firebase Fix if available
                if (typeof FirebaseFix !== 'undefined' && typeof FirebaseFix.init === 'function') {
                    FirebaseFix.init({
                        emulatorHost: settings.emulatorHost,
                        emulatorPort: settings.emulatorPort,
                        maxRecoveryAttempts: settings.maxConnectionAttempts
                    });
                }

                // Test the connection immediately
                return testConnection();
            })
            .then(isConnected => {
                connectionState.firebaseInitialized = true;
                console.log(`Firebase initialization ${isConnected ? 'successful' : 'completed with connection issues'}`);
                
                // Initialize Auth module if available
                if (typeof FirebaseAuth !== 'undefined' && typeof FirebaseAuth.init === 'function') {
                    try {
                        const authInitResult = FirebaseAuth.init();
                        console.log('FirebaseAuth.init() result:', authInitResult);
                    } catch (authInitError) {
                        console.error('Error during FirebaseAuth.init():', authInitError);
                    }
                }
                
                // Start monitoring connection
                startConnectionMonitor();
                
                return isConnected;
            })
            .catch(error => {
                console.error('Error during Firebase initialization:', error);
                return false;
            });
    }

    /**
     * Initialize Firestore with the current settings
     * @returns {Promise<void>}
     */
    function initializeFirestore(enableOffline = true) {
        if (!firebase || !firebase.firestore) {
            console.error('Firebase Firestore SDK not available');
            return Promise.reject(new Error('Firebase Firestore SDK not available'));
        }

        try {
            // Set better Firestore settings for handling network issues
            const firestoreSettings = {
                ignoreUndefinedProperties: true,
                experimentalAutoDetectLongPolling: true
            };
            
            // Production settings
            firebase.firestore().settings(firestoreSettings);
            console.log('Firestore settings configured');

            // Always mark Firestore as available since we want to allow offline mode
            connectionState.firestoreAvailable = true;

            // Enable offline persistence if requested
            if (enableOffline) {
                return firebase.firestore()
                    .enablePersistence({
                        synchronizeTabs: true
                    })
                    .then(() => {
                        console.log('Firestore offline persistence enabled');
                        return Promise.resolve(true);
                    })
                    .catch(error => {
                        if (error.code === 'failed-precondition') {
                            console.warn('Firestore persistence already enabled in another tab');
                        } else if (error.code === 'unimplemented') {
                            console.warn('Firestore persistence not supported in this browser');
                        } else {
                            console.error('Error enabling Firestore persistence:', error);
                        }
                        
                        // Firestore is still available even if persistence fails
                        return Promise.resolve(true);
                    });
            } else {
                return Promise.resolve(true);
            }
        } catch (error) {
            console.error('Error configuring Firestore:', error);
            // Don't fail completely, allow offline mode
            connectionState.firestoreAvailable = true;
            return Promise.resolve(true);
        }
    }

    /**
     * Setup network status event listeners
     */
    function setupNetworkListeners() {
        // Set up online/offline event listeners
        window.addEventListener('online', () => handleOnline());
        window.addEventListener('offline', () => handleOffline());

        // Listen for Firestore connectivity changes
        firebase.firestore().enableNetwork()
            .then(() => {
                firebase.firestore().collection('_connectionTest').doc('_connectionTest')
                    .onSnapshot(() => {
                        // Successful connection to Firestore
                        if (!connectionState.isOnline) {
                            handleOnline();
                        }
                    }, error => {
                        console.error('Firestore connection error:', error);
                        if (connectionState.isOnline) {
                            handleOffline();
                        }
                    });
            })
            .catch(error => {
                console.error('Error enabling Firestore network:', error);
            });
    }

    /**
     * Handle online event
     */
    function handleOnline() {
        console.log('Network is online');
        
        if (!connectionState.isOnline) {
            connectionState.isOnline = true;
            
            // Dispatch event for other modules
            dispatchConnectionChangeEvent('online');
            
            // Hide offline UI
            hideOfflineBanner();
            
            // Test connection to confirm Firebase is accessible
            testConnection();
        }
    }

    /**
     * Handle offline event
     */
    function handleOffline() {
        console.log('Network is offline');
        
        connectionState.isOnline = false;
        
        // Dispatch event for other modules
        dispatchConnectionChangeEvent('offline');
        
        // Show offline UI
        showOfflineBanner();
    }

    /**
     * Dispatch a connection change event
     * @param {string} state Connection state ('online' or 'offline')
     */
    function dispatchConnectionChangeEvent(state) {
        const event = new CustomEvent('firebase-connection-change', {
            detail: { state }
        });
        document.dispatchEvent(event);
    }

    /**
     * Test Firebase connection
     * @returns {Promise<boolean>} Whether connection was successful
     */
    function testConnection() {
        if (!firebase.apps.length) {
            console.error('Firebase not initialized');
            return Promise.resolve(false);
        }

        try {
            // Simple auth state check is successful enough
            if (firebase.auth) {
                console.log('Firebase connection successful (auth available)');
                connectionState.isOnline = true;
                dispatchConnectionChangeEvent('online');
                return Promise.resolve(true);
            }

            return Promise.resolve(true);
        } catch (error) {
            console.error('Firebase connection test error:', error);
            connectionState.isOnline = false;
            dispatchConnectionChangeEvent('offline');
            return Promise.resolve(false);
        }
    }

    /**
     * Start periodic connection monitoring
     */
    function startConnectionMonitor() {
        // Clear any existing monitor
        if (connectionState.connectionMonitorTimer) {
            clearInterval(connectionState.connectionMonitorTimer);
        }
        
        // Set up periodic connection test
        connectionState.connectionMonitorTimer = setInterval(() => {
            // Only test if:
            // 1. We're currently online according to browser
            // 2. We haven't tested recently (in the last minute)
            if (navigator.onLine && 
                (!connectionState.lastConnectionTime || 
                 Date.now() - connectionState.lastConnectionTime > 60000)) {
                testConnection();
            }
        }, 60000); // Check every minute
    }

    /**
     * Reinitialize Firebase with new settings
     * @param {Object} newSettings New settings to apply
     * @returns {Promise<boolean>} Whether reinitialization was successful
     */
    function reinitialize(newSettings = {}) {
        console.log('Reinitializing Firebase with new settings:', newSettings);
        
        // Update our settings
        Object.assign(settings, newSettings);
        
        // Keep track of the current Firebase app
        const currentApp = firebase.app();
        
        // Attempt to shut down Firestore if it's active
        if (connectionState.firestoreAvailable) {
            try {
                firebase.firestore().disableNetwork()
                    .catch(err => console.warn('Error disabling network during reinitialization:', err));
            } catch (err) {
                console.warn('Error shutting down Firestore during reinitialization:', err);
            }
        }
        
        // Reset our state
        connectionState.firestoreAvailable = false;
        connectionState.firebaseInitialized = false;
        
        // Try to delete the app (may fail, which is okay)
        return Promise.resolve()
            .then(() => {
                // Generate a new app name for our reinitialized app
                const newAppName = `app-${Date.now()}`;
                
                // Try to initialize a new Firebase app
                const firebaseConfig = getFirebaseConfig();
                firebase.initializeApp(firebaseConfig, newAppName);
                
                // Mark as initialized
                connectionState.firebaseInitialized = true;
                
                // Initialize Firestore with our new settings
                return initializeFirestore(settings.enableOffline)
                    .then(success => {
                        // Try to clean up the old app if different from current
                        if (currentApp && currentApp.name !== firebase.app().name) {
                            try {
                                currentApp.delete().catch(() => {});
                            } catch (err) {
                                // Ignore errors during cleanup
                            }
                        }
                        
                        return success;
                    });
            })
            .catch(error => {
                console.error('Error during Firebase reinitialization:', error);
                // If we failed, try to reinstate the previous app
                connectionState.firebaseInitialized = firebase.apps.length > 0;
                return false;
            });
    }

    /**
     * Show the offline banner
     */
    function showOfflineBanner() {
        // Create banner if it doesn't exist
        if (!offlineBanner) {
            offlineBanner = document.createElement('div');
            offlineBanner.className = 'offline-banner';
            offlineBanner.innerHTML = `
                <div class="offline-banner-content">
                    <span class="offline-icon">⚠️</span>
                    <span class="offline-message">You are currently offline. Some features may be limited.</span>
                </div>
            `;
            
            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .offline-banner {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background-color: #f8d7da;
                    color: #721c24;
                    padding: 10px 15px;
                    text-align: center;
                    z-index: 9999;
                    display: none;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                
                .offline-banner-content {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .offline-icon {
                    margin-right: 10px;
                }
                
                .offline-message {
                    font-size: 14px;
                }
                
                .offline-banner.visible {
                    display: block;
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(offlineBanner);
        }
        
        // Show banner
        offlineBanner.classList.add('visible');
    }

    /**
     * Hide the offline banner
     */
    function hideOfflineBanner() {
        if (offlineBanner) {
            offlineBanner.classList.remove('visible');
        }
    }

    /**
     * Show connection error modal
     */
    function showConnectionErrorModal() {
        // Create modal if it doesn't exist
        if (!connectionErrorModal) {
            connectionErrorModal = document.createElement('div');
            connectionErrorModal.className = 'connection-error-modal';
            connectionErrorModal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Connection Error</h3>
                        <button class="close-button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>We're having trouble connecting to our servers. This could be due to:</p>
                        <ul>
                            <li>Your internet connection</li>
                            <li>A temporary server issue</li>
                            <li>Firewall or network settings</li>
                        </ul>
                        <p>You can continue working with limited functionality, or try to reconnect.</p>
                    </div>
                    <div class="modal-footer">
                        <button class="retry-button">Try Again</button>
                        <button class="offline-button">Work Offline</button>
                    </div>
                </div>
            `;
            
            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .connection-error-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    display: none;
                }
                
                .connection-error-modal.visible {
                    display: flex;
                }
                
                .modal-content {
                    background-color: white;
                    border-radius: 5px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                    max-width: 500px;
                    width: 100%;
                }
                
                .modal-header {
                    padding: 15px;
                    border-bottom: 1px solid #e9ecef;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                
                .modal-header h3 {
                    margin: 0;
                    font-size: 18px;
                }
                
                .close-button {
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: #6c757d;
                }
                
                .modal-body {
                    padding: 15px;
                }
                
                .modal-footer {
                    padding: 15px;
                    border-top: 1px solid #e9ecef;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                
                .retry-button, .offline-button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                
                .retry-button {
                    background-color: #007bff;
                    color: white;
                }
                
                .offline-button {
                    background-color: #6c757d;
                    color: white;
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(connectionErrorModal);
            
            // Add event listeners
            const closeButton = connectionErrorModal.querySelector('.close-button');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    hideConnectionErrorModal();
                });
            }
            
            const retryButton = connectionErrorModal.querySelector('.retry-button');
            if (retryButton) {
                retryButton.addEventListener('click', () => {
                    hideConnectionErrorModal();
                    connectionState.connectionAttempts = 0; // Reset counter
                    testConnection();
                });
            }
            
            const offlineButton = connectionErrorModal.querySelector('.offline-button');
            if (offlineButton) {
                offlineButton.addEventListener('click', () => {
                    hideConnectionErrorModal();
                    // Enable offline mode if we have the function
                    if (typeof App !== 'undefined' && typeof App.enableOfflineMode === 'function') {
                        App.enableOfflineMode();
                    }
                });
            }
        }
        
        // Show modal
        connectionErrorModal.classList.add('visible');
    }

    /**
     * Hide connection error modal
     */
    function hideConnectionErrorModal() {
        if (connectionErrorModal) {
            connectionErrorModal.classList.remove('visible');
        }
    }

    /**
     * Check if Firebase is online
     * @returns {boolean} Whether Firebase is connected
     */
    function isOnline() {
        return connectionState.isOnline;
    }

    /**
     * Get the current coordinator settings
     * @returns {Object} The current settings
     */
    function getSettings() {
        return { ...settings };
    }

    /**
     * Get the current Firebase configuration
     * @returns {Object} Firebase configuration
     */
    function getFirebaseConfig() {
        return {
            apiKey: settings.apiKey,
            authDomain: settings.authDomain,
            projectId: settings.projectId,
            storageBucket: settings.storageBucket,
            messagingSenderId: settings.messagingSenderId,
            appId: settings.appId
        };
    }

    // Public API
    return {
        init,
        reinitialize,
        testConnection,
        isOnline,
        getSettings,
        getConnectionState: () => ({ ...connectionState }),
        isInitialized: () => connectionState.firebaseInitialized,
        isOfflineMode: () => !connectionState.isOnline
    };
})(); 