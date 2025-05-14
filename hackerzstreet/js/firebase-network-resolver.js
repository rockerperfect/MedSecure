/**
 * MedSecure Enterprise - Firebase Network Resolver Module
 * Coordinates solutions for network authentication issues with Firebase
 */
const FirebaseNetworkResolver = (function() {
    // Configuration
    const config = {
        maxAttempts: 3,
        retryInterval: 2000, // 2 seconds
        emulatorHost: 'localhost',
        emulatorPorts: {
            firestore: [8080, 8000, 9099], // Try different ports in order
            auth: 9099
        },
        sslSettings: {
            attemptSSLFix: true,
            forceLongPolling: true
        },
        resolveTimeout: 15000 // 15 seconds timeout for resolution attempts
    };
    
    // Internal state
    const state = {
        initialized: false,
        currentAttempt: 0,
        lastErrorTimestamp: 0,
        resolutionInProgress: false,
        errorLog: [],
        resolutionStrategies: []
    };
    
    /**
     * Initialize the Firebase Network Resolver
     * @param {Object} options Configuration options
     */
    function init(options = {}) {
        if (state.initialized) {
            console.log('FirebaseNetworkResolver already initialized');
            return;
        }
        
        // Merge options with default config
        Object.assign(config, options);
        
        console.log('Initializing Firebase Network Resolver with config:', config);
        
        // Set up event listener for connection change events
        document.addEventListener('firebase-connection-change', handleConnectionChange);
        
        // Set up resolution strategies in order of preference
        setupResolutionStrategies();
        
        state.initialized = true;
    }
    
    /**
     * Set up error event listeners
     */
    function setupErrorListeners() {
        // Listen to unhandled errors
        window.addEventListener('error', (event) => {
            const error = event.error || new Error(event.message);
            if (isNetworkAuthError(error)) {
                console.log('Network auth error detected via window error event');
                resolveNetworkAuthError(error);
            }
        });
        
        // Listen to unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            const error = event.reason;
            if (isNetworkAuthError(error)) {
                console.log('Network auth error detected via unhandled rejection');
                resolveNetworkAuthError(error);
            }
        });
    }
    
    /**
     * Handle connection state changes
     * @param {CustomEvent} event Connection change event
     */
    function handleConnectionChange(event) {
        const connectionState = event.detail.state; // 'online' or 'offline'
        
        if (connectionState === 'online') {
            // We're back online, reset the current attempt counter
            state.currentAttempt = 0;
            console.log('Connection back online, reset resolution state');
        }
    }
    
    /**
     * Set up resolution strategies in order of preference
     */
    function setupResolutionStrategies() {
        state.resolutionStrategies = [
            // Strategy 1: Enable long polling (least invasive)
            {
                name: 'enableLongPolling',
                handler: enableLongPolling,
                description: 'Enabling long polling for better network compatibility'
            },
            
            // Strategy 2: Try different emulator ports (for local development)
            {
                name: 'tryDifferentEmulatorPort',
                handler: tryDifferentEmulatorPort,
                description: 'Trying a different emulator port'
            },
            
            // Strategy 3: Apply SSL fixes (for SSL handshake issues)
            {
                name: 'applySSLFix',
                handler: applySSLFix,
                description: 'Applying SSL connection fixes'
            },
            
            // Strategy 4: Force offline access (when nothing else works)
            {
                name: 'forceOfflineAccess',
                handler: enableOfflineMode,
                description: 'Forcing offline mode to ensure local data access'
            },
            
            // Strategy 5: Full reset of Firebase services (most invasive)
            {
                name: 'fullReset',
                handler: resetFirebaseServices,
                description: 'Performing a full reset of Firebase services'
            }
        ];
    }
    
    /**
     * Get current strategy based on attempt number
     * @returns {Object} The strategy to use
     */
    function getCurrentStrategy() {
        const attemptIndex = Math.min(state.currentAttempt, state.resolutionStrategies.length - 1);
        return state.resolutionStrategies[attemptIndex];
    }
    
    /**
     * Check if an error is a network authentication error
     * @param {Error} error The error to check
     * @returns {boolean} Whether it's a network auth error
     */
    function isNetworkAuthError(error) {
        if (!error) return false;
        
        // Common network authentication error codes
        const networkAuthCodes = [
            'auth/network-request-failed',
            'firestore/unavailable',
            'firestore/failed-precondition',
            'storage/cannot-slice-blob',
            'auth/internal-error'
        ];
        
        // Check error code
        if (error.code && networkAuthCodes.includes(error.code)) {
            return true;
        }
        
        // Check error message patterns
        if (error.message && typeof error.message === 'string') {
            const networkErrorPatterns = [
                'network error',
                'network request failed',
                'unable to establish connection',
                'failed to fetch',
                'cannot connect to host',
                'connection refused',
                'network authentication',
                'ssl handshake',
                'certificate verify',
                'ECONNREFUSED',
                'cors request failed'
            ];
            
            return networkErrorPatterns.some(pattern => 
                error.message.toLowerCase().includes(pattern.toLowerCase())
            );
        }
        
        return false;
    }
    
    /**
     * Log an error and its resolution attempts
     * @param {Error} error The error that occurred
     * @param {string} resolutionMethod The resolution method being tried
     * @param {boolean} success Whether the resolution was successful
     */
    function logError(error, resolutionMethod, success = false) {
        // Keep log size reasonable
        if (state.errorLog.length > 50) {
            state.errorLog.shift(); // Remove oldest entry
        }
        
        // Add new entry
        state.errorLog.push({
            timestamp: new Date().toISOString(),
            error: {
                code: error.code || 'unknown',
                message: error.message,
                stack: error.stack
            },
            resolutionMethod,
            attemptNumber: state.currentAttempt,
            success
        });
        
        // Log to console
        console.log(`Firebase resolution [${resolutionMethod}] ${success ? 'succeeded' : 'attempted'}`);
    }
    
    /**
     * Resolve a network authentication error
     * @param {Error} error The error to resolve
     * @returns {Promise<boolean>} Whether the error was resolved
     */
    function resolveNetworkAuthError(error) {
        // Don't handle the same error multiple times in rapid succession
        const now = Date.now();
        if (now - state.lastErrorTimestamp < 3000) {
            console.log('Ignoring rapid repeated error resolution');
            return Promise.resolve(false);
        }
        
        // Don't attempt resolution if already in progress
        if (state.resolutionInProgress) {
            console.log('Resolution already in progress, queueing this attempt');
            return new Promise(resolve => {
                // Check every 500ms if the current resolution is done
                const checkInterval = setInterval(() => {
                    if (!state.resolutionInProgress) {
                        clearInterval(checkInterval);
                        // Try again after the current resolution is done
                        resolveNetworkAuthError(error).then(resolve);
                    }
                }, 500);
                
                // Time out after 10 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve(false);
                }, 10000);
            });
        }
        
        // Update state
        state.lastErrorTimestamp = now;
        state.resolutionInProgress = true;
        
        // Don't exceed maximum attempts
        if (state.currentAttempt >= config.maxAttempts) {
            console.log(`Exceeded maximum resolution attempts (${config.maxAttempts})`);
            // Reset for next time
            state.currentAttempt = 0;
            state.resolutionInProgress = false;
            
            // Report to user
            if (typeof FirebaseFix !== 'undefined' && 
                typeof FirebaseFix.showPersistentNotification === 'function') {
                FirebaseFix.showPersistentNotification(
                    'Connection Issues',
                    'We\'ve tried several approaches to fix connection issues without success. You may need to reload the app or work offline.',
                    [
                        { text: 'Reload', action: () => window.location.reload() },
                        { text: 'Work Offline', action: () => enableOfflineMode() }
                    ]
                );
            }
            
            return Promise.resolve(false);
        }
        
        // Get the strategy for this attempt
        const strategy = getCurrentStrategy();
        console.log(`Attempting to resolve network auth error with strategy: ${strategy.name} (attempt ${state.currentAttempt + 1}/${config.maxAttempts})`);
        
        // Display temporary notification
        if (typeof FirebaseFix !== 'undefined' && 
            typeof FirebaseFix.showTemporaryNotification === 'function') {
            FirebaseFix.showTemporaryNotification(
                `Fixing connection: ${strategy.description}`
            );
        }
        
        // Log this attempt
        logError(error, strategy.name);
        
        // Create a timeout promise
        const timeoutPromise = new Promise(resolve => {
            setTimeout(() => {
                console.log(`Resolution strategy ${strategy.name} timed out`);
                resolve({ success: false, reason: 'timeout' });
            }, config.resolveTimeout);
        });
        
        // Apply the resolution strategy with timeout
        return Promise.race([
            // The actual resolution strategy
            strategy.handler(error).then(success => {
                return { success, reason: success ? 'resolved' : 'strategy_failed' };
            }),
            // Timeout after resolveTimeout ms
            timeoutPromise
        ])
        .then(result => {
            const { success, reason } = result;
            
            // Log the result
            logError(error, `${strategy.name} (${reason})`, success);
            
            if (success) {
                console.log(`Successfully resolved network auth error with ${strategy.name}`);
                // Reset for next time
                state.currentAttempt = 0;
            } else {
                // Increment attempt counter for next try
                state.currentAttempt++;
                console.log(`Resolution attempt with ${strategy.name} failed, next attempt: ${state.currentAttempt}`);
                
                // If we have more attempts, try the next strategy after a delay
                if (state.currentAttempt < config.maxAttempts) {
                    return new Promise(resolve => {
                        setTimeout(() => {
                            state.resolutionInProgress = false;
                            resolveNetworkAuthError(error).then(resolve);
                        }, config.retryInterval);
                    });
                }
            }
            
            // Mark resolution as complete
            state.resolutionInProgress = false;
            return success;
        })
        .catch(err => {
            console.error('Error during network auth resolution:', err);
            state.resolutionInProgress = false;
            return false;
        });
    }
    
    /**
     * Strategy 1: Enable long polling for Firestore
     * @returns {Promise<boolean>} Whether the strategy was successful
     */
    function enableLongPolling() {
        console.log('Applying long polling fix for Firestore');
        
        return new Promise(resolve => {
            if (typeof FirebaseCoordinator === 'undefined' || 
                typeof FirebaseCoordinator.reinitialize !== 'function') {
                console.warn('FirebaseCoordinator not available, cannot apply long polling fix');
                resolve(false);
                return;
            }
            
            FirebaseCoordinator.reinitialize({
                longPollingEnabled: true,
                experimentalAutoDetectLongPolling: true,
                ignoreUndefinedProperties: true
            })
            .then(success => {
                // Test connection after applying fix
                if (success && typeof FirebaseCoordinator.testConnection === 'function') {
                    return FirebaseCoordinator.testConnection();
                }
                return success;
            })
            .then(success => {
                resolve(success);
            })
            .catch(() => {
                resolve(false);
            });
        });
    }
    
    /**
     * Strategy 2: Try different emulator ports
     * @returns {Promise<boolean>} Whether the strategy was successful
     */
    function tryDifferentEmulatorPort() {
        // Only applicable in development environments
        if (window.location.hostname !== 'localhost' && 
            window.location.hostname !== '127.0.0.1') {
            console.log('Not in development environment, skipping emulator port strategy');
            return Promise.resolve(false);
        }
        
        console.log('Trying different emulator ports');
        
        return new Promise(resolve => {
            if (typeof FirebaseCoordinator === 'undefined' || 
                typeof FirebaseCoordinator.reinitialize !== 'function' ||
                typeof FirebaseCoordinator.getSettings !== 'function') {
                console.warn('FirebaseCoordinator not available, cannot try different ports');
                resolve(false);
                return;
            }
            
            // Get current settings and determine which port to try next
            const currentSettings = FirebaseCoordinator.getSettings();
            const currentPort = currentSettings.emulatorPort;
            
            // Find the index of the current port in our list
            const portIndex = config.emulatorPorts.firestore.indexOf(currentPort);
            
            // If not found or at the end of the list, use the first port
            let nextPortIndex = (portIndex === -1 || portIndex === config.emulatorPorts.firestore.length - 1) 
                ? 0 : portIndex + 1;
                
            // Make sure we don't try the same port
            if (config.emulatorPorts.firestore[nextPortIndex] === currentPort && config.emulatorPorts.firestore.length > 1) {
                nextPortIndex = (nextPortIndex + 1) % config.emulatorPorts.firestore.length;
            }
            
            const nextPort = config.emulatorPorts.firestore[nextPortIndex];
            console.log(`Trying emulator port ${nextPort} (was using ${currentPort})`);
            
            FirebaseCoordinator.reinitialize({
                emulatorPort: nextPort,
                useEmulators: true
            })
            .then(success => {
                // Test connection after applying fix
                if (success && typeof FirebaseCoordinator.testConnection === 'function') {
                    return FirebaseCoordinator.testConnection();
                }
                return success;
            })
            .then(success => {
                resolve(success);
            })
            .catch(() => {
                resolve(false);
            });
        });
    }
    
    /**
     * Strategy 3: Apply SSL fixes
     * @returns {Promise<boolean>} Whether the strategy was successful
     */
    function applySSLFix() {
        console.log('Applying SSL connection fixes');
        
        return new Promise(resolve => {
            if (typeof FirebaseCoordinator === 'undefined' || 
                typeof FirebaseCoordinator.reinitialize !== 'function') {
                console.warn('FirebaseCoordinator not available, cannot apply SSL fix');
                resolve(false);
                return;
            }
            
            FirebaseCoordinator.reinitialize({
                experimentalAutoDetectLongPolling: true,
                // Add SSL-specific settings here when needed
                ignoreUndefinedProperties: true
            })
            .then(success => {
                // Test connection after applying fix
                if (success && typeof FirebaseCoordinator.testConnection === 'function') {
                    return FirebaseCoordinator.testConnection();
                }
                return success;
            })
            .then(success => {
                resolve(success);
            })
            .catch(() => {
                resolve(false);
            });
        });
    }
    
    /**
     * Strategy 4: Enable offline mode
     * @returns {Promise<boolean>} Whether the strategy was successful
     */
    function enableOfflineMode() {
        console.log('Enabling offline mode for the application');
        
        return new Promise(resolve => {
            // Try App first if available
            if (typeof App !== 'undefined' && typeof App.enableOfflineMode === 'function') {
                App.enableOfflineMode();
                resolve(true);
                return;
            }
            
            // Otherwise try to use FirebaseCoordinator
            if (typeof FirebaseCoordinator === 'undefined' || 
                typeof FirebaseCoordinator.reinitialize !== 'function') {
                console.warn('Neither App nor FirebaseCoordinator available, cannot enable offline mode');
                resolve(false);
                return;
            }
            
            FirebaseCoordinator.reinitialize({
                enableOffline: true,
                experimentalForceFirestoreCache: true
            })
            .then(success => resolve(success))
            .catch(() => resolve(false));
        });
    }
    
    /**
     * Strategy 5: Reset Firebase services completely
     * @returns {Promise<boolean>} Whether the strategy was successful
     */
    function resetFirebaseServices() {
        console.log('Performing full reset of Firebase services');
        
        return new Promise(resolve => {
            if (typeof FirebaseCoordinator === 'undefined' || 
                typeof FirebaseCoordinator.reinitialize !== 'function') {
                console.warn('FirebaseCoordinator not available, cannot reset Firebase services');
                resolve(false);
                return;
            }
            
            // Generate a new app name to ensure clean slate
            const newAppName = `medsecure-reset-${Date.now()}`;
            
            // First disable network if possible
            if (firebase && firebase.firestore) {
                try {
                    firebase.firestore().disableNetwork()
                        .catch(err => console.warn('Error disabling network during reset:', err));
                } catch (err) {
                    console.warn('Error shutting down Firestore during reset:', err);
                }
            }
            
            // Try to delete all current apps
            if (firebase && firebase.apps && firebase.apps.length > 0) {
                Promise.all(
                    firebase.apps.map(app => {
                        try {
                            return app.delete().catch(() => {});
                        } catch (e) {
                            return Promise.resolve();
                        }
                    })
                )
                .then(() => {
                    // Reinitialize with fresh settings
                    return FirebaseCoordinator.reinitialize({
                        longPollingEnabled: true,
                        experimentalForceFirestoreCache: false, // Start clean
                        enableOffline: true
                    });
                })
                .then(success => {
                    // Test connection after reset
                    if (success && typeof FirebaseCoordinator.testConnection === 'function') {
                        return FirebaseCoordinator.testConnection();
                    }
                    return success;
                })
                .then(success => {
                    resolve(success);
                })
                .catch(() => {
                    // Last resort: Suggest a page reload
                    if (typeof FirebaseFix !== 'undefined' && 
                        typeof FirebaseFix.showPersistentNotification === 'function') {
                        FirebaseFix.showPersistentNotification(
                            'Connection Issues',
                            'We\'ve tried to reset the connection but were unsuccessful. Reloading the page might help.',
                            [{ text: 'Reload', action: () => window.location.reload() }]
                        );
                    }
                    resolve(false);
                });
        });
    }
    
    /**
     * Reset and retry with fresh configuration
     * @returns {Promise<boolean>} Whether the operation was successful
     */
    function resetAndRetry() {
        state.currentAttempt = 0;
        state.resolutionInProgress = false;
        
        if (typeof FirebaseCoordinator !== 'undefined' && 
            typeof FirebaseCoordinator.testConnection === 'function') {
            return FirebaseCoordinator.testConnection();
        }
        
        return Promise.resolve(false);
    }
    
    // Public API
    return {
        init,
        resolveNetworkAuthError,
        isNetworkAuthError,
        resetAndRetry,
        enableOfflineMode,
        getErrorLog: () => [...state.errorLog]
    };
})();

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("Initializing Firebase Network Resolver on page load");
    if (typeof FirebaseNetworkResolver !== 'undefined') {
        FirebaseNetworkResolver.init();
    }
}); 