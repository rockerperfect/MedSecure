/**
 * Data Storage module for MedSecure
 * 
 * Handles data persistence using Firebase Firestore with localStorage fallback.
 */

const DataStore = {
    // Storage keys for localStorage (fallback)
    KEYS: {
        USERS: 'medSecure_users',
        CURRENT_USER: 'medSecure_currentUser',
        RECORDS: 'medSecure_records',
        AUDIT_LOG: 'medSecure_auditLog'
    },
    
    currentUser: null,
    offlineMode: false,
    connectionError: null,
    
    // Local copy of data for caching
    data: {
        users: [],
        records: [],
        providers: [],
        auditLog: []
    },
    
    // Firebase configuration
    firebaseConfig: {
        apiKey: "AIzaSyAQvOOXCD8z5kQwZHJsGPbCSDPbLY7JPAE",
        authDomain: "medsecure-app.firebaseapp.com",
        projectId: "medsecure-app",
        storageBucket: "medsecure-app.appspot.com",
        messagingSenderId: "623712474479",
        appId: "1:623712474479:web:2a1e92eab5e5d3a8f1b4c8"
    },
    
    // Firestore references
    db: null,
    
    /**
     * Initialize the data store
     */
    init: function() {
        console.log('DataStore initialized');
        
        // Load data from local storage first for immediate use
        this.loadFromLocalStorage();
        
        // Check if Firebase Coordinator is available for centralized initialization
        if (typeof FirebaseCoordinator !== 'undefined') {
            // Use the Firebase Coordinator's app instance if already initialized
            if (FirebaseCoordinator.isInitialized()) {
                console.log('Using Firebase app from FirebaseCoordinator');
                this.db = firebase.firestore();
                
                // Check if offline mode is already set by the coordinator
                if (FirebaseCoordinator.isOfflineMode()) {
                    console.log('Firebase Coordinator is in offline mode; DataStore will use local storage');
                    this.offlineMode = true;
                } else {
                    // Sync with Firestore in the background
                    this.syncWithFirestore();
                }
            } else {
                // Let the coordinator initialize Firebase
                console.log('Firebase not yet initialized, using FirebaseCoordinator');
                FirebaseCoordinator.init().then(success => {
                    if (success) {
                        this.db = firebase.firestore();
                        if (!FirebaseCoordinator.isOfflineMode()) {
                            this.syncWithFirestore();
                        } else {
                            this.offlineMode = true;
                        }
                    } else {
                        console.warn('Firebase Coordinator failed to initialize. DataStore using local storage only.');
                        this.offlineMode = true;
                    }
                });
            }
        } else {
            // Fall back to direct Firebase initialization if coordinator isn't available
            console.warn('Firebase Coordinator not available. Using direct Firebase initialization.');
            this.initializeFirebaseDirectly();
        }
    },
    
    /**
     * Initialize Firebase directly (legacy method)
     * Used only if FirebaseCoordinator is not available
     */
    initializeFirebaseDirectly: function() {
        // Initialize Firebase if available
        if (typeof firebase !== 'undefined') {
            try {
                // Initialize Firebase only if not already initialized
                if (firebase.apps.length === 0) {
                    console.log('Initializing Firebase directly from DataStore');
                    firebase.initializeApp(this.firebaseConfig);
                } else {
                    console.log('Using existing Firebase app');
                }
                
                // Initialize Firestore
                this.db = firebase.firestore();
                console.log('Firebase initialized successfully from DataStore');
                
                // Configure Firestore for offline use
                this.db.settings({
                    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
                    ignoreUndefinedProperties: true
                });
                
                // Enable offline persistence
                this.db.enablePersistence({ synchronizeTabs: true })
                    .then(() => {
                        console.log('Firestore persistence enabled from DataStore');
                    })
                    .catch(err => {
                        console.warn('Firestore persistence error:', err);
                    });
                
                // Test connection to Firestore
                this.testFirestoreConnection().then(connected => {
                    if (connected) {
                        console.log('Successfully connected to Firestore');
                        
                        // Sync with Firestore in the background
                        this.syncWithFirestore();
                        
                        // Set up connection monitoring
                        this.monitorFirestoreConnection();
                    } else {
                        this.handleConnectionError('Could not connect to cloud database');
                    }
                });
            } catch (error) {
                console.error('Firebase initialization error:', error);
                this.handleConnectionError('Could not connect to cloud database');
            }
        } else {
            console.warn('Firebase is not available, using local storage only');
            this.handleConnectionError('Firebase SDK not available');
        }
    },
    
    /**
     * Test connection to Firestore
     * @returns {Promise<boolean>} Whether the connection was successful
     */
    testFirestoreConnection: async function() {
        if (!this.db) return false;
        
        try {
            // Try to fetch a small amount of data as a connection test
            const testQuery = await this.db.collection('_connection_test')
                .limit(1)
                .get();
            
            return true;
        } catch (error) {
            console.error('Firestore connection test failed:', error);
            return false;
        }
    },
    
    /**
     * Monitor Firestore connection status
     */
    monitorFirestoreConnection: function() {
        if (!this.db) return;
        
        // Set up connection state change listener
        this.db.enableNetwork().catch(err => {
            console.error('Error enabling network access:', err);
            this.handleConnectionError('Network error: ' + err.message);
        });
        
        // Set up a periodic connection test
        setInterval(() => {
            this.testFirestoreConnection().then(connected => {
                if (!connected && !this.offlineMode) {
                    this.handleConnectionError('Lost connection to cloud database');
                } else if (connected && this.offlineMode) {
                    this.handleConnectionRestored();
                }
            });
        }, 60000); // Check every minute
    },
    
    /**
     * Handle database connection errors
     * @param {string} errorMessage - Error message
     */
    handleConnectionError: function(errorMessage) {
        console.warn('Database connection error:', errorMessage);
        
        // Set offline mode
        this.offlineMode = true;
        this.connectionError = errorMessage;
        
        // Enable persistence if possible
        if (this.db) {
            this.db.enablePersistence({synchronizeTabs: true})
                .then(() => console.log('Offline persistence enabled'))
                .catch(err => console.error('Error enabling offline persistence:', err));
        }
        
        // Add offline indicator to UI
        this.showOfflineIndicator();
        
        // Show notification to user
        if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast('error', 'Connection Error', errorMessage + '. Using offline mode with local storage.');
        } else {
            alert('Connection Error: ' + errorMessage + '. Using offline mode with local storage.');
        }
    },
    
    /**
     * Handle connection restored
     */
    handleConnectionRestored: function() {
        console.log('Database connection restored');
        
        // Clear offline mode
        this.offlineMode = false;
        this.connectionError = null;
        
        // Remove offline indicator
        this.hideOfflineIndicator();
        
        // Sync data with server
        this.syncWithFirestore();
        
        // Show notification to user
        if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast('success', 'Connection Restored', 'Connected to cloud database. Your data will be synchronized.');
        }
    },
    
    /**
     * Show offline indicator in UI
     */
    showOfflineIndicator: function() {
        if (document.getElementById('offline-indicator')) return;
        
        const header = document.querySelector('header');
        if (header) {
            const indicator = document.createElement('div');
            indicator.id = 'offline-indicator';
            indicator.innerHTML = '<i class="fas fa-cloud-slash"></i> Offline Mode: Using Local Storage';
            indicator.style.backgroundColor = '#f8d7da';
            indicator.style.color = '#721c24';
            indicator.style.padding = '0.5rem 1rem';
            indicator.style.textAlign = 'center';
            indicator.style.fontWeight = 'bold';
            indicator.style.fontSize = '0.9rem';
            indicator.style.width = '100%';
            header.after(indicator);
        }
    },
    
    /**
     * Hide offline indicator in UI
     */
    hideOfflineIndicator: function() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.remove();
        }
    },
    
    /**
     * Sync local data with Firestore
     */
    syncWithFirestore: async function() {
        if (!this.db) return;
        
        try {
            // Get current user
            const user = App.getCurrentUser();
            if (!user) return;
            
            // Fetch user's records
            const recordsSnapshot = await this.db.collection('records')
                .where('userId', '==', user.id)
                .get();
            
            const records = [];
            recordsSnapshot.forEach(doc => {
                records.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Merge with local data (prioritize newer records)
            if (records.length > 0) {
                this.data.records = this.mergeRecords(this.data.records, records);
                this.saveToLocalStorage();
                
                // Update UI
                if (typeof Records !== 'undefined') {
                    Records.loadUserRecords();
                    Records.updateDashboardCounts();
                }
            }
            
            // Fetch audit logs
            const auditLogSnapshot = await this.db.collection('auditLog')
                .where('userId', '==', user.id)
                .orderBy('timestamp', 'desc')
                .limit(100)
                .get();
            
            const auditLog = [];
            auditLogSnapshot.forEach(doc => {
                auditLog.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Update audit log
            if (auditLog.length > 0) {
                this.data.auditLog = auditLog;
                this.saveToLocalStorage();
                
                // Update UI if audit module exists
                if (typeof AuditLogger !== 'undefined' && typeof AuditLogger.refreshAuditLog === 'function') {
                    AuditLogger.refreshAuditLog();
                }
            }
        } catch (error) {
            console.error('Error syncing with Firestore:', error);
        }
    },
    
    /**
     * Merge local and remote records, preferring newer versions
     * @param {Array} localRecords - Local records
     * @param {Array} remoteRecords - Remote records from Firestore
     * @returns {Array} Merged records
     */
    mergeRecords: function(localRecords, remoteRecords) {
        const recordMap = {};
        
        // Index local records by id
        localRecords.forEach(record => {
            recordMap[record.id] = record;
        });
        
        // Merge or add remote records
        remoteRecords.forEach(remoteRecord => {
            const localRecord = recordMap[remoteRecord.id];
            
            // If record doesn't exist locally or remote is newer, use remote
            if (!localRecord || new Date(remoteRecord.updatedAt) > new Date(localRecord.updatedAt)) {
                recordMap[remoteRecord.id] = remoteRecord;
            }
        });
        
        // Convert map back to array
        return Object.values(recordMap);
    },
    
    /**
     * Load data from local storage
     */
    loadFromLocalStorage: function() {
        try {
            // Load users
            const users = localStorage.getItem(this.KEYS.USERS);
            if (users) {
                this.data.users = JSON.parse(users);
            }
            
            // Load records
            const records = localStorage.getItem(this.KEYS.RECORDS);
            if (records) {
                this.data.records = JSON.parse(records);
            }
            
            // Load providers
            const providers = localStorage.getItem('medsecure_providers');
            if (providers) {
                this.data.providers = JSON.parse(providers);
            }
            
            // Load audit log
            const auditLog = localStorage.getItem(this.KEYS.AUDIT_LOG);
            if (auditLog) {
                this.data.auditLog = JSON.parse(auditLog);
            }
        } catch (error) {
            console.error('Error loading from local storage:', error);
        }
    },
    
    /**
     * Save data to local storage
     */
    saveToLocalStorage: function() {
        try {
            localStorage.setItem(this.KEYS.USERS, JSON.stringify(this.data.users));
            localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(this.data.records));
            localStorage.setItem('medsecure_providers', JSON.stringify(this.data.providers));
            localStorage.setItem(this.KEYS.AUDIT_LOG, JSON.stringify(this.data.auditLog));
        } catch (error) {
            console.error('Error saving to local storage:', error);
            App.showToast('error', 'Storage Error', 'Failed to save data locally.');
        }
    },
    
    /**
     * Get all users
     * @returns {Promise<Array>} Promise resolving to array of user objects
     */
    getUsers: async function() {
        if (this.db) {
            try {
                const snapshot = await this.db.collection('users').get();
                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } catch (error) {
                console.error('Error getting users from Firestore:', error);
                return [];
            }
        } else {
            // Fallback to localStorage
            try {
                const usersJSON = localStorage.getItem(this.KEYS.USERS);
                return JSON.parse(usersJSON) || [];
            } catch (error) {
                console.error('Error getting users from localStorage:', error);
                return [];
            }
        }
    },
    
    /**
     * Get current user
     * @returns {Object|null} Current user object or null
     */
    getCurrentUser: function() {
        if (this.currentUser) {
            return this.currentUser;
        }
        
        if (this.db) {
            const user = FirebaseService.auth.currentUser;
            if (user) {
                // Basic user info from Firebase Auth
                return {
                    id: user.uid,
                    email: user.email,
                    name: user.displayName || user.email.split('@')[0],
                    role: 'patient' // Default role, will be updated from Firestore
                };
            }
            return null;
        } else {
            // Fallback to localStorage
            try {
                const userId = localStorage.getItem(this.KEYS.CURRENT_USER);
                if (!userId) return null;
                
                const users = JSON.parse(localStorage.getItem(this.KEYS.USERS)) || [];
                return users.find(user => user.id === userId) || null;
            } catch (error) {
                console.error('Error getting current user from localStorage:', error);
                return null;
            }
        }
    },
    
    /**
     * Set current user
     * @param {string} userId - ID of user to set as current
     */
    setCurrentUser: function(userId) {
        this.currentUser = { id: userId };
        localStorage.setItem(this.KEYS.CURRENT_USER, userId);
    },
    
    /**
     * Clear current user (logout)
     */
    clearCurrentUser: function() {
        this.currentUser = null;
        localStorage.removeItem(this.KEYS.CURRENT_USER);
    },
    
    /**
     * Add a new user
     * @param {Object} user - User object to add
     * @returns {Promise<boolean>} Promise resolving to success status
     */
    addUser: async function(user) {
        if (this.db) {
            try {
                // Check if user already exists in Firestore
                const userDoc = await this.db.collection('users')
                    .doc(user.id)
                    .get();
                
                if (userDoc.exists) {
                    console.warn('User already exists in Firestore:', user.id);
                    return false;
                }
                
                // Add user to Firestore
                await this.db.collection('users').doc(user.id).set({
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                return true;
            } catch (error) {
                console.error('Error adding user to Firestore:', error);
                return false;
            }
        } else {
            // Fallback to localStorage
            try {
                // Check if email already exists
                const users = JSON.parse(localStorage.getItem(this.KEYS.USERS)) || [];
                if (users.some(u => u.email === user.email)) {
                    return false;
                }
                
                // Add user
                users.push(user);
                localStorage.setItem(this.KEYS.USERS, JSON.stringify(users));
                
                return true;
            } catch (error) {
                console.error('Error adding user to localStorage:', error);
                return false;
            }
        }
    },
    
    /**
     * Get all records
     * @param {string} userId - Optional user ID to filter records
     * @param {string} role - User role for collection access
     * @returns {Array} Array of record objects (for backward compatibility)
     */
    getRecords: function(userId, role = 'patient') {
        console.log('DataStore.getRecords called, userId:', userId);
        
        try {
            // First try to get records from localStorage for immediate display
            const recordsJSON = localStorage.getItem(this.KEYS.RECORDS);
            const localRecords = recordsJSON ? JSON.parse(recordsJSON) : [];
            
            // Apply user filter if provided
            const filteredRecords = userId
                ? localRecords.filter(record => record.userId === userId)
                : localRecords;
            
            console.log(`Found ${filteredRecords.length} records in localStorage`);
            
            // If we're offline or don't have a database connection, return what we have locally
            if (this.offlineMode || !this.db) {
                return filteredRecords;
            }
            
            // Attempt to sync with Firestore in the background
            this.syncWithFirestore().catch(error => {
                console.error('Background sync error:', error);
            });
            
            // Return the local records immediately for faster UI response
            return filteredRecords;
        } catch (error) {
            console.error('Error in getRecords:', error);
            return []; // Always return an array, even on error
        }
    },
    
    /**
     * Save a record, preventing duplicates
     * @param {Object} record - Record object to save
     * @param {string} role - User role for collection access
     * @returns {Promise<boolean>} Promise resolving to success status
     */
    saveRecord: async function(record, role = 'patient') {
        if (this.db) {
            try {
                // Get the appropriate collection name
                let recordsCollection = 'records';
                
                // Safely check if FirebaseService exists and has the method
                if (typeof FirebaseService !== 'undefined' && 
                    typeof FirebaseService.getRoleBasedCollection === 'function') {
                    recordsCollection = FirebaseService.getRoleBasedCollection('records', role);
                } else {
                    // Default collection name based on role
                    recordsCollection = role === 'provider' ? 'provider_records' : 'records';
                    console.log('Using fallback collection name:', recordsCollection);
                }
                
                // Check for potential duplicates
                const snapshot = await this.db.collection(recordsCollection)
                    .where('userId', '==', record.userId)
                    .where('title', '==', record.title)
                    .where('type', '==', record.type)
                    .where('date', '==', record.date)
                    .get();
                
                if (!snapshot.empty) {
                    console.warn('Duplicate record detected, not saving:', record);
                    return false;
                }
                
                // Add createdAt if not present
                if (!record.createdAt) {
                    record.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                }
                
                // Save record to Firestore
                await this.db.collection(recordsCollection).doc(record.id).set(record);
                
                // If record has a file, save it to Firebase Storage
                if (record.fileUrl && record.fileId) {
                    // We'll handle file upload in the Records module
                    console.log('Record has file, should be handled by Records module', record.fileId);
                }
                
                return true;
            } catch (error) {
                console.error('Error saving record to Firestore:', error);
                return false;
            }
        } else {
            // Fallback to localStorage
            try {
                const records = JSON.parse(localStorage.getItem(this.KEYS.RECORDS)) || [];
                
                // Check for duplicate
                const isDuplicate = records.some(r =>
                    r.userId === record.userId &&
                    r.title === record.title &&
                    r.type === record.type &&
                    r.date === record.date &&
                    Math.abs(new Date(r.createdAt) - new Date(record.createdAt)) < 5000 // within 5 seconds
                );
                
                if (isDuplicate) {
                    console.warn('Duplicate record detected, not saving:', record);
                    return false;
                }
                
                // Add the record
                records.push(record);
                localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(records));
                return true;
            } catch (error) {
                console.error('Error saving record to localStorage:', error);
                return false;
            }
        }
    },
    
    /**
     * Delete a record
     * @param {string} recordId - ID of record to delete
     * @param {string} role - User role for collection access
     * @returns {Promise<boolean>} Promise resolving to success status
     */
    deleteRecord: async function(recordId, role = 'patient') {
        if (this.db) {
            try {
                // Get the appropriate collection name
                let recordsCollection = 'records';
                
                // Safely check if FirebaseService exists and has the method
                if (typeof FirebaseService !== 'undefined' && 
                    typeof FirebaseService.getRoleBasedCollection === 'function') {
                    recordsCollection = FirebaseService.getRoleBasedCollection('records', role);
                } else {
                    // Default collection name based on role
                    recordsCollection = role === 'provider' ? 'provider_records' : 'records';
                    console.log('Using fallback collection name:', recordsCollection);
                }
                
                // Get the record to check if it has associated files
                const recordDoc = await this.db.collection(recordsCollection).doc(recordId).get();
                
                if (!recordDoc.exists) {
                    console.warn('Record not found for deletion:', recordId);
                    return false;
                }
                
                const record = recordDoc.data();
                
                // Delete the record
                await this.db.collection(recordsCollection).doc(recordId).delete();
                
                // If record has a file, delete it from Firebase Storage
                if (record.fileId) {
                    try {
                        // Safely handle the storage reference
                        let storageRef;
                        
                        if (typeof FirebaseService !== 'undefined' && 
                            typeof FirebaseService.getRoleBasedStorageRef === 'function') {
                            storageRef = FirebaseService.getRoleBasedStorageRef(record.userId, role, record.fileId);
                        } else if (firebase && firebase.storage) {
                            // Fallback to direct Firebase storage
                            const storageBasePath = role === 'provider' ? 'provider_files' : 'patient_files';
                            storageRef = firebase.storage().ref(`${storageBasePath}/${record.userId}/${record.fileId}`);
                        } else {
                            console.warn('Firebase Storage not available, cannot delete file');
                            // Continue with record deletion even if file deletion fails
                            return true;
                        }
                        
                        await storageRef.delete();
                        console.log('Associated file deleted:', record.fileId);
                    } catch (storageError) {
                        console.warn('Error deleting file from storage:', storageError);
                        // Continue with record deletion even if file deletion fails
                    }
                }
                
                return true;
            } catch (error) {
                console.error('Error deleting record from Firestore:', error);
                return false;
            }
        } else {
            // Fallback to localStorage
            try {
                let records = JSON.parse(localStorage.getItem(this.KEYS.RECORDS)) || [];
                const initialLength = records.length;
                
                // Filter out the record to delete
                records = records.filter(record => record.id !== recordId);
                
                if (records.length === initialLength) {
                    // Record wasn't found
                    return false;
                }
                
                localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(records));
                return true;
            } catch (error) {
                console.error('Error deleting record from localStorage:', error);
                return false;
            }
        }
    },
    
    /**
     * Add audit log entry
     * @param {Object} entry - Audit log entry
     * @returns {Promise<boolean>} Promise resolving to success status
     */
    addAuditLog: async function(entry) {
        if (this.db) {
            try {
                // Add timestamp if not present
                if (!entry.timestamp) {
                    entry.timestamp = firebase.firestore.FieldValue.serverTimestamp();
                }
                
                // Save to Firestore
                await this.db.collection('auditLog').doc(entry.id).set(entry);
                return true;
            } catch (error) {
                console.error('Error adding audit log to Firestore:', error);
                return false;
            }
        } else {
            // Fallback to localStorage
            try {
                const auditLog = JSON.parse(localStorage.getItem(this.KEYS.AUDIT_LOG)) || [];
                auditLog.push(entry);
                localStorage.setItem(this.KEYS.AUDIT_LOG, JSON.stringify(auditLog));
                return true;
            } catch (error) {
                console.error('Error adding audit log to localStorage:', error);
                return false;
            }
        }
    },
    
    /**
     * Get audit log entries
     * @param {string} userId - Optional user ID to filter entries
     * @returns {Promise<Array>} Promise resolving to array of audit log entries
     */
    getAuditLog: async function(userId) {
        if (this.db) {
            try {
                let query = this.db.collection('auditLog');
                
                // Filter by user ID if provided
                if (userId) {
                    query = query.where('userId', '==', userId);
                }
                
                // Order by timestamp (most recent first)
                query = query.orderBy('timestamp', 'desc');
                
                const snapshot = await query.get();
                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    // Convert Firestore timestamps to ISO strings for consistency
                    timestamp: doc.data().timestamp ? doc.data().timestamp.toDate().toISOString() : new Date().toISOString()
                }));
            } catch (error) {
                console.error('Error getting audit log from Firestore:', error);
                return [];
            }
        } else {
            // Fallback to localStorage
            try {
                const auditLogJSON = localStorage.getItem(this.KEYS.AUDIT_LOG);
                const auditLog = JSON.parse(auditLogJSON) || [];
                
                // Filter by user ID if provided
                const filtered = userId ? auditLog.filter(entry => entry.userId === userId) : auditLog;
                
                // Sort by timestamp (most recent first)
                return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            } catch (error) {
                console.error('Error getting audit log from localStorage:', error);
                return [];
            }
        }
    },
    
    /**
     * Share a record with another user
     * @param {string} recordId - ID of record to share
     * @param {string} recipientId - ID of recipient
     * @returns {Promise<boolean>} Success status
     */
    shareRecord: async function(recordId, recipientId) {
        if (!recordId || !recipientId) return false;
        
        try {
            // Get the record
            const record = await this.getRecord(recordId);
            if (!record) return false;
            
            const sender = App.getCurrentUser();
            if (!sender) return false;
            
            // Create a share record
            const shareId = 'share_' + Date.now();
            const shareRecord = {
                id: shareId,
                recordId: recordId,
                senderId: sender.id,
                senderName: sender.name,
                recipientId: recipientId,
                timestamp: new Date().toISOString(),
                status: 'SHARED'
            };
            
            // Save to Firestore if available
            if (this.db) {
                try {
                    await this.db.collection('shares').doc(shareId).set(shareRecord);
                } catch (error) {
                    console.error('Error saving share to Firestore:', error);
                    App.showToast('warning', 'Share Warning', 'Shared record locally but cloud synchronization failed.');
                }
            }
            
            // Create audit entries
            await this.addAuditLog({
                id: 'audit_' + Date.now(),
                userId: sender.id,
                eventType: 'SHARE',
                timestamp: new Date().toISOString(),
                status: 'SUCCESS',
                data: {
                    recordId: recordId,
                    recordType: record.type,
                    recipientId: recipientId
                }
            });
            
            return true;
        } catch (error) {
            console.error('Error sharing record:', error);
            return false;
        }
    },
    
    /**
     * Export user data
     * @returns {Object} User data export
     */
    exportData: function() {
        const user = App.getCurrentUser();
        if (!user) return null;
        
        const userRecords = this.data.records.filter(record => record.userId === user.id);
        const userAuditLog = this.data.auditLog.filter(entry => entry.userId === user.id);
        
        return {
            user: user,
            records: userRecords,
            auditLog: userAuditLog,
            exportDate: new Date().toISOString()
        };
    },
    
    /**
     * Import user data
     * @param {Object} data - Data to import
     * @returns {boolean} Success status
     */
    importData: async function(data) {
        if (!data || !data.user || !data.records) return false;
        
        try {
            const currentUser = App.getCurrentUser();
            if (!currentUser) return false;
            
            // Import records
            if (Array.isArray(data.records)) {
                for (const record of data.records) {
                    // Update user ID to current user
                    record.userId = currentUser.id;
                    // Mark as imported
                    record.imported = true;
                    record.importDate = new Date().toISOString();
                    // Save record
                    await this.saveRecord(record);
                }
            }
            
            // Create audit log entry for import
            await this.addAuditLog({
                id: 'audit_' + Date.now(),
                userId: currentUser.id,
                eventType: 'IMPORT',
                timestamp: new Date().toISOString(),
                status: 'SUCCESS',
                data: {
                    recordCount: data.records.length,
                    importDate: new Date().toISOString()
                }
            });
            
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }
}; 