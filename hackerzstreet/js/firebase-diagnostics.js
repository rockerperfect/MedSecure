/**
 * Firebase Diagnostics Module
 * Helps diagnose and fix connection issues with Firebase
 */

const FirebaseDiagnostics = (function() {
    let connectionStatus = {
        firebase: false,
        firestore: false,
        auth: false,
        storage: false
    };
    
    /**
     * Check Firebase connection status
     */
    function checkConnection() {
        try {
            console.log('Running Firebase connection diagnostics...');
            
            // Check if Firebase is loaded
            if (typeof firebase === 'undefined') {
                console.error('Firebase SDK not loaded!');
                showError('Firebase SDK not loaded. Check script loading order and network connection.');
                return;
            }
            
            connectionStatus.firebase = true;
            
            // Check if Firebase is initialized
            if (firebase.apps.length === 0) {
                console.error('Firebase not initialized!');
                showError('Firebase not initialized. This could indicate a configuration issue.');
                return;
            }
            
            // Check Firestore
            if (typeof firebase.firestore === 'function') {
                const db = firebase.firestore();
                db.collection('_connection_test').limit(1).get()
                    .then(() => {
                        console.log('✅ Firestore connection successful');
                        connectionStatus.firestore = true;
                        updateConnectionUI();
                    })
                    .catch(error => {
                        console.error('❌ Firestore connection failed:', error);
                        connectionStatus.firestore = false;
                        showError('Could not connect to Firestore: ' + error.message);
                        updateConnectionUI();
                    });
            } else {
                console.error('Firestore not available');
                connectionStatus.firestore = false;
            }
            
            // Check Auth
            if (typeof firebase.auth === 'function') {
                connectionStatus.auth = true;
            } else {
                console.error('Firebase Auth not available');
                connectionStatus.auth = false;
            }
            
            // Check Storage
            if (typeof firebase.storage === 'function') {
                connectionStatus.storage = true;
            } else {
                console.error('Firebase Storage not available');
                connectionStatus.storage = false;
            }
            
            updateConnectionUI();
        } catch (error) {
            console.error('Error checking Firebase connection:', error);
            showError('Error checking Firebase connection: ' + error.message);
        }
    }
    
    /**
     * Show error message in UI
     * @param {string} message - Error message to display
     */
    function showError(message) {
        // Create or update error element
        let errorEl = document.getElementById('firebase-error');
        
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.id = 'firebase-error';
            errorEl.style.position = 'fixed';
            errorEl.style.top = '10px';
            errorEl.style.left = '50%';
            errorEl.style.transform = 'translateX(-50%)';
            errorEl.style.backgroundColor = '#f8d7da';
            errorEl.style.color = '#721c24';
            errorEl.style.padding = '10px 20px';
            errorEl.style.borderRadius = '5px';
            errorEl.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
            errorEl.style.zIndex = '9999';
            errorEl.style.fontSize = '14px';
            errorEl.style.maxWidth = '90%';
            
            // Add close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '&times;';
            closeBtn.style.marginLeft = '10px';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = '#721c24';
            closeBtn.style.fontSize = '20px';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.float = 'right';
            closeBtn.onclick = function() {
                document.body.removeChild(errorEl);
            };
            
            errorEl.appendChild(closeBtn);
            
            // Add diagnostic button
            const diagBtn = document.createElement('button');
            diagBtn.textContent = 'Show Solutions';
            diagBtn.style.marginLeft = '10px';
            diagBtn.style.padding = '3px 8px';
            diagBtn.style.background = '#721c24';
            diagBtn.style.color = 'white';
            diagBtn.style.border = 'none';
            diagBtn.style.borderRadius = '3px';
            diagBtn.style.fontSize = '12px';
            diagBtn.style.cursor = 'pointer';
            diagBtn.onclick = showSolutions;
            
            errorEl.appendChild(diagBtn);
            
            const messageEl = document.createElement('div');
            messageEl.style.clear = 'both';
            messageEl.style.paddingTop = '5px';
            messageEl.textContent = message;
            errorEl.appendChild(messageEl);
            
            document.body.appendChild(errorEl);
        } else {
            // Update existing error message
            const messageEl = errorEl.querySelector('div');
            if (messageEl) {
                messageEl.textContent = message;
            }
        }
    }
    
    /**
     * Update connection status UI
     */
    function updateConnectionUI() {
        let statusEl = document.getElementById('firebase-status');
        
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'firebase-status';
            statusEl.style.position = 'fixed';
            statusEl.style.bottom = '10px';
            statusEl.style.right = '10px';
            statusEl.style.backgroundColor = '#f8f9fa';
            statusEl.style.padding = '10px';
            statusEl.style.borderRadius = '5px';
            statusEl.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
            statusEl.style.fontSize = '12px';
            statusEl.style.zIndex = '9999';
            
            document.body.appendChild(statusEl);
        }
        
        // Create status HTML
        statusEl.innerHTML = `
            <div style="margin-bottom: 5px; font-weight: bold;">Firebase Status:</div>
            <div>Core: ${connectionStatus.firebase ? '✅' : '❌'}</div>
            <div>Firestore: ${connectionStatus.firestore ? '✅' : '❌'}</div>
            <div>Auth: ${connectionStatus.auth ? '✅' : '❌'}</div>
            <div>Storage: ${connectionStatus.storage ? '✅' : '❌'}</div>
            <button id="firebase-fix-btn" style="margin-top: 5px; padding: 3px 8px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; width: 100%;">Fix Issues</button>
        `;
        
        // Add click handler for fix button
        document.getElementById('firebase-fix-btn').onclick = showSolutions;
    }
    
    /**
     * Show solutions for Firebase connection issues
     */
    function showSolutions() {
        // Create solutions dialog
        let solutionsEl = document.getElementById('firebase-solutions');
        
        if (!solutionsEl) {
            solutionsEl = document.createElement('div');
            solutionsEl.id = 'firebase-solutions';
            solutionsEl.style.position = 'fixed';
            solutionsEl.style.top = '50%';
            solutionsEl.style.left = '50%';
            solutionsEl.style.transform = 'translate(-50%, -50%)';
            solutionsEl.style.backgroundColor = 'white';
            solutionsEl.style.padding = '20px';
            solutionsEl.style.borderRadius = '5px';
            solutionsEl.style.boxShadow = '0 2px 20px rgba(0,0,0,0.2)';
            solutionsEl.style.maxWidth = '500px';
            solutionsEl.style.width = '90%';
            solutionsEl.style.maxHeight = '80vh';
            solutionsEl.style.overflowY = 'auto';
            solutionsEl.style.zIndex = '10000';
            
            // Add header
            const header = document.createElement('h2');
            header.textContent = 'Firebase Connection Solutions';
            header.style.margin = '0 0 15px 0';
            header.style.borderBottom = '1px solid #eee';
            header.style.paddingBottom = '10px';
            solutionsEl.appendChild(header);
            
            // Add solutions content
            solutionsEl.innerHTML += `
                <h3>Common Issues & Solutions:</h3>
                
                <h4>1. Running locally without a server</h4>
                <p>Firebase requires a proper web server when running locally. You can't use file:// URLs.</p>
                <p><strong>Solution:</strong> Use a local web server. You're currently using Python's server on port 8000, which is good.</p>
                
                <h4>2. Multiple Firebase initializations</h4>
                <p>Multiple modules trying to initialize Firebase can cause conflicts.</p>
                <p><strong>Solution:</strong> The Firebase Coordinator should handle this. If issues persist, check your console for initialization errors.</p>
                
                <h4>3. CORS issues</h4>
                <p>Cross-Origin Resource Sharing restrictions can block Firebase connections.</p>
                <p><strong>Solution:</strong> 
                    <ul>
                        <li>Make sure you're using http:// not file://</li>
                        <li>For local development, consider using Firebase emulators</li>
                    </ul>
                </p>
                
                <h4>4. Firebase configuration errors</h4>
                <p>Incorrect API keys or project IDs can cause connection failures.</p>
                <p><strong>Solution:</strong> Double-check your Firebase configuration.</p>
                
                <h4>5. Network or Firewall issues</h4>
                <p>Firewalls or network policies might block Firebase connections.</p>
                <p><strong>Solution:</strong> Check if you can access the following domains:
                    <ul>
                        <li>firestore.googleapis.com</li>
                        <li>identitytoolkit.googleapis.com</li>
                        <li>storage.googleapis.com</li>
                    </ul>
                </p>
                
                <h4>6. Firebase Emulator</h4>
                <p>When working locally, you can use Firebase emulators for offline development.</p>
                <p><strong>Solution:</strong> Start Firebase emulators with: <code>firebase emulators:start</code></p>
                
                <h4>7. Try in Incognito/Private Window</h4>
                <p>Browser extensions or cached data can sometimes interfere with Firebase.</p>
                <p><strong>Solution:</strong> Test in an incognito/private window to eliminate browser extension interference.</p>
                
                <h4>8. Fallback to Offline Mode</h4>
                <p>If online connectivity can't be established, the app will automatically use offline mode with local storage.</p>
                <p><strong>Solution:</strong> If online features aren't critical, you can continue using the app in offline mode.</p>
            `;
            
            // Add close button
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close';
            closeBtn.style.padding = '8px 15px';
            closeBtn.style.backgroundColor = '#6c757d';
            closeBtn.style.color = 'white';
            closeBtn.style.border = 'none';
            closeBtn.style.borderRadius = '3px';
            closeBtn.style.marginTop = '20px';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.float = 'right';
            closeBtn.onclick = function() {
                document.body.removeChild(solutionsEl);
            };
            solutionsEl.appendChild(closeBtn);
            
            // Add retry button
            const retryBtn = document.createElement('button');
            retryBtn.textContent = 'Retry Connection';
            retryBtn.style.padding = '8px 15px';
            retryBtn.style.backgroundColor = '#28a745';
            retryBtn.style.color = 'white';
            retryBtn.style.border = 'none';
            retryBtn.style.borderRadius = '3px';
            retryBtn.style.marginTop = '20px';
            retryBtn.style.marginRight = '10px';
            retryBtn.style.cursor = 'pointer';
            retryBtn.onclick = function() {
                // Retry Firebase initialization
                if (typeof FirebaseCoordinator !== 'undefined') {
                    FirebaseCoordinator.init().then(() => {
                        checkConnection();
                    });
                } else if (typeof FirebaseConfig !== 'undefined') {
                    FirebaseConfig.init().then(() => {
                        checkConnection();
                    });
                }
            };
            solutionsEl.appendChild(retryBtn);
            
            document.body.appendChild(solutionsEl);
        } else {
            // If already visible, just update content if needed
            solutionsEl.style.display = 'block';
        }
    }
    
    /**
     * Initialize the diagnostics module
     */
    function init() {
        // Wait for DOM to be ready to check connection
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(checkConnection, 1000);
            });
        } else {
            setTimeout(checkConnection, 1000);
        }
    }
    
    // Return public API
    return {
        init,
        checkConnection,
        showSolutions
    };
})();

// Auto-initialize
FirebaseDiagnostics.init(); 