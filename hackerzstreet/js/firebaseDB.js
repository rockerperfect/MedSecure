/**
 * MedSecure Firebase Database Module
 * Handles Firestore database operations for medical records, user profiles, and audit logs
 */

const FirebaseDB = (function() {
    // Reference to Firestore
    let db = null;
    
    // Collection names
    const COLLECTIONS = {
        USERS: 'users',
        RECORDS: 'medicalRecords',
        AUDIT_LOGS: 'auditLogs',
        SHARED_RECORDS: 'sharedRecords',
        PROVIDERS: 'providers'
    };

    /**
     * Initialize Firestore instance
     * @returns {boolean} - Success status
     */
    function init() {
        try {
            // First, check if we should use the Firebase Coordinator
            if (typeof FirebaseCoordinator !== 'undefined') {
                console.log('FirebaseDB: Using Firebase Coordinator');
                
                // Check if Firebase is already initialized by the coordinator
                if (FirebaseCoordinator.isInitialized()) {
                    console.log('FirebaseDB: Firebase already initialized by coordinator');
                    db = firebase.firestore();
                    
                    // Check if the coordinator already detected offline mode
                    if (FirebaseCoordinator.isOfflineMode()) {
                        console.log('FirebaseDB: Coordinator indicates offline mode');
                        // No need to test connection or configure persistence, already done
                    }
                    
                    return true;
                } else {
                    // Let the coordinator initialize Firebase
                    console.log('FirebaseDB: Firebase not yet initialized, using coordinator');
                    return FirebaseCoordinator.init().then(success => {
                        if (success) {
                            db = firebase.firestore();
                return true;
            } else {
                            console.warn('FirebaseDB: Coordinator failed to initialize Firebase');
                            return false;
                        }
                    });
                }
            }
            
            // Fall back to legacy initialization if coordinator isn't available
            console.log('FirebaseDB: Firebase Coordinator not available, using legacy initialization');
            
            // Check if firebase is available
            if (typeof firebase === 'undefined') {
                console.error('Firebase SDK not available');
                handleConnectionError('Firebase SDK not available');
                return false;
            }
            
            // Check if Firestore is available
            if (typeof firebase.firestore !== 'function') {
                console.error('Firestore SDK not available');
                handleConnectionError('Firestore SDK not available');
            return false;
        }
            
            // Use existing Firebase app if already initialized
            if (firebase.apps.length > 0) {
                console.log('FirebaseDB: Using existing Firebase app');
                db = firebase.firestore();
            } else {
                console.error('FirebaseDB: No Firebase app initialized. This should happen via FirebaseConfig.');
                return false;
            }
            
            // Configure Firestore for better offline support (only if not done already)
            db.settings({
                cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
                ignoreUndefinedProperties: true
            });
            
            // Check connection status only if not using coordinator
            testConnection().then(isConnected => {
                if (!isConnected) {
                    handleConnectionError('Could not connect to cloud database');
                } else {
                    console.log('Successfully connected to Firestore from FirebaseDB');
                }
            });
            
            console.log('Firestore initialized successfully in FirebaseDB');
            return true;
        } catch (error) {
            console.error('Error initializing Firestore in FirebaseDB:', error);
            handleConnectionError('Error initializing database: ' + error.message);
            return false;
        }
    }
    
    /**
     * Test connection to Firestore
     * @returns {Promise<boolean>} - Whether connected to Firestore
     */
    async function testConnection() {
        try {
            // Try a simple query to test connection
            const testQuery = await db.collection('_connection_test').limit(1).get();
            return true;
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }
    
    /**
     * Set up connection status monitoring
     */
    function monitorConnectionStatus() {
        if (!db) return;
        
        // Use Firebase RTDB for connection state if available
        if (typeof firebase.database === 'function') {
            const connectedRef = firebase.database().ref('.info/connected');
            connectedRef.on('value', (snap) => {
                if (snap.val() === true) {
                    console.log('Connected to Firebase');
                    connectionRestored();
                } else {
                    console.log('Disconnected from Firebase');
                    // Don't immediately show error - might be temporary
                }
            });
        } else {
            // Fallback: check connection periodically
            setInterval(async () => {
                const isConnected = await testConnection();
                if (!isConnected) {
                    handleConnectionError('Lost connection to cloud database');
                }
            }, 60000); // Check every minute
        }
    }
    
    /**
     * Handle database connection errors
     * @param {string} errorMessage - Error message to display
     */
    function handleConnectionError(errorMessage) {
        console.warn('DB Connection error:', errorMessage);
        
        // Notify the user if App is available
        if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast('error', 'Database Connection Error', errorMessage + '. Using offline mode.');
        }
        
        // Also notify DataStore if available
        if (typeof DataStore !== 'undefined' && typeof DataStore.handleConnectionError === 'function') {
            DataStore.handleConnectionError(errorMessage);
        }
    }
    
    /**
     * Handle restored database connection
     */
    function connectionRestored() {
        console.log('Database connection restored');
        
        // Notify the user if App is available
        if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast('success', 'Connection Restored', 'Connected to cloud database.');
        }
        
        // Also notify DataStore if available
        if (typeof DataStore !== 'undefined' && typeof DataStore.handleConnectionRestored === 'function') {
            DataStore.handleConnectionRestored();
        }
    }

    /**
     * Get a user profile by user ID
     * @param {string} userId - The user ID
     * @returns {Promise<Object|null>} - The user profile or null if not found
     */
    async function getUserProfile(userId) {
        try {
            const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
            if (userDoc.exists) {
                return { id: userDoc.id, ...userDoc.data() };
            }
            return null;
        } catch (error) {
            console.error('Error getting user profile:', error);
            throw error;
        }
    }

    /**
     * Create or update a user profile
     * @param {string} userId - The user ID
     * @param {Object} profileData - The user profile data
     * @returns {Promise<void>}
     */
    async function saveUserProfile(userId, profileData) {
        try {
            await db.collection(COLLECTIONS.USERS).doc(userId).set(profileData, { merge: true });
            console.log('User profile saved successfully');
        } catch (error) {
            console.error('Error saving user profile:', error);
            throw error;
        }
    }

    /**
     * Get medical records for a user
     * @param {string} userId - The user ID
     * @returns {Promise<Array>} - Array of medical records
     */
    async function getUserRecords(userId) {
        try {
            const recordsSnapshot = await db.collection(COLLECTIONS.RECORDS)
                .where('userId', '==', userId)
                .orderBy('uploadDate', 'desc')
                .get();
            
            return recordsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting user records:', error);
            throw error;
        }
    }

    /**
     * Get shared records for a user
     * @param {string} userId - The user ID
     * @returns {Promise<Array>} - Array of shared records
     */
    async function getSharedRecords(userId) {
        try {
            const sharedSnapshot = await db.collection(COLLECTIONS.SHARED_RECORDS)
                .where('sharedWithId', '==', userId)
                .get();
            
            // Get full record details for each shared record
            const records = [];
            for (const doc of sharedSnapshot.docs) {
                const sharedData = doc.data();
                const recordDoc = await db.collection(COLLECTIONS.RECORDS).doc(sharedData.recordId).get();
                
                if (recordDoc.exists) {
                    records.push({
                        id: recordDoc.id,
                        sharedById: sharedData.sharedById,
                        sharedDate: sharedData.sharedDate,
                        ...recordDoc.data()
                    });
                }
            }
            
            return records;
        } catch (error) {
            console.error('Error getting shared records:', error);
            throw error;
        }
    }

    /**
     * Save a medical record
     * @param {Object} recordData - The medical record data
     * @returns {Promise<string>} - The ID of the saved record
     */
    async function saveRecord(recordData) {
        try {
            // Add timestamp if not provided
            if (!recordData.uploadDate) {
                recordData.uploadDate = firebase.firestore.FieldValue.serverTimestamp();
            }
            
            let recordRef;
            if (recordData.id) {
                // Update existing record
                recordRef = db.collection(COLLECTIONS.RECORDS).doc(recordData.id);
                const { id, ...dataWithoutId } = recordData;
                await recordRef.update(dataWithoutId);
            } else {
                // Create new record
                recordRef = await db.collection(COLLECTIONS.RECORDS).add(recordData);
            }
            
            console.log('Record saved successfully');
            return recordRef.id;
        } catch (error) {
            console.error('Error saving record:', error);
            throw error;
        }
    }

    /**
     * Delete a medical record
     * @param {string} recordId - The record ID to delete
     * @returns {Promise<void>}
     */
    async function deleteRecord(recordId) {
        try {
            // Delete the record
            await db.collection(COLLECTIONS.RECORDS).doc(recordId).delete();
            
            // Delete any shares of this record
            const sharesSnapshot = await db.collection(COLLECTIONS.SHARED_RECORDS)
                .where('recordId', '==', recordId)
                .get();
            
            const batch = db.batch();
            sharesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            
            console.log('Record and associated shares deleted successfully');
        } catch (error) {
            console.error('Error deleting record:', error);
            throw error;
        }
    }

    /**
     * Share a record with another user
     * @param {string} recordId - The record ID to share
     * @param {string} sharedById - The ID of the user sharing the record
     * @param {string} sharedWithId - The ID of the user to share with
     * @returns {Promise<string>} - The ID of the share document
     */
    async function shareRecord(recordId, sharedById, sharedWithId) {
        try {
            // Check if already shared
            const existingShare = await db.collection(COLLECTIONS.SHARED_RECORDS)
                .where('recordId', '==', recordId)
                .where('sharedWithId', '==', sharedWithId)
                .limit(1)
                .get();
            
            if (!existingShare.empty) {
                console.log('Record already shared with this user');
                return existingShare.docs[0].id;
            }
            
            // Create new share
            const shareData = {
                recordId,
                sharedById,
                sharedWithId,
                sharedDate: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const shareRef = await db.collection(COLLECTIONS.SHARED_RECORDS).add(shareData);
            
            // Log the sharing action
            await logActivity(sharedById, 'share_record', {
                recordId,
                sharedWithId
            });
            
            console.log('Record shared successfully');
            return shareRef.id;
        } catch (error) {
            console.error('Error sharing record:', error);
            throw error;
        }
    }

    /**
     * Revoke sharing of a record with a user
     * @param {string} recordId - The record ID
     * @param {string} sharedWithId - The ID of the user to revoke sharing from
     * @returns {Promise<void>}
     */
    async function revokeRecordShare(recordId, sharedWithId) {
        try {
            const shareSnapshot = await db.collection(COLLECTIONS.SHARED_RECORDS)
                .where('recordId', '==', recordId)
                .where('sharedWithId', '==', sharedWithId)
                .get();
            
            if (shareSnapshot.empty) {
                console.log('No share found to revoke');
            return;
        }
        
            // Delete the share
            await shareSnapshot.docs[0].ref.delete();
            
            console.log('Record share revoked successfully');
        } catch (error) {
            console.error('Error revoking record share:', error);
            throw error;
        }
    }

    /**
     * Get trusted providers for a user
     * @param {string} userId - The user ID
     * @returns {Promise<Array>} - Array of trusted providers
     */
    async function getTrustedProviders(userId) {
        try {
            const providersSnapshot = await db.collection(COLLECTIONS.PROVIDERS)
                .where('patientId', '==', userId)
                .get();
            
            return providersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting trusted providers:', error);
            throw error;
        }
    }

    /**
     * Add a trusted provider for a patient
     * @param {string} patientId - The patient user ID
     * @param {string} providerId - The provider user ID
     * @param {string} providerName - The provider name
     * @returns {Promise<string>} - The ID of the provider document
     */
    async function addTrustedProvider(patientId, providerId, providerName) {
        try {
            const providerData = {
                patientId,
                providerId,
                providerName,
                addedDate: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const providerRef = await db.collection(COLLECTIONS.PROVIDERS).add(providerData);
            
            console.log('Trusted provider added successfully');
            return providerRef.id;
        } catch (error) {
            console.error('Error adding trusted provider:', error);
            throw error;
        }
    }

    /**
     * Remove a trusted provider
     * @param {string} providerId - The provider document ID
     * @returns {Promise<void>}
     */
    async function removeTrustedProvider(providerId) {
        try {
            await db.collection(COLLECTIONS.PROVIDERS).doc(providerId).delete();
            console.log('Trusted provider removed successfully');
        } catch (error) {
            console.error('Error removing trusted provider:', error);
            throw error;
        }
    }

    /**
     * Log an activity for audit purposes
     * @param {string} userId - The user who performed the action
     * @param {string} action - The action performed
     * @param {Object} details - Additional details about the action
     * @returns {Promise<string>} - The ID of the log entry
     */
    async function logActivity(userId, action, details = {}) {
        try {
            const logData = {
                userId,
                action,
                details,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userAgent: navigator.userAgent
            };
            
            const logRef = await db.collection(COLLECTIONS.AUDIT_LOGS).add(logData);
            return logRef.id;
        } catch (error) {
            console.error('Error logging activity:', error);
            // Don't throw - logging should not interrupt normal operation
            return null;
        }
    }

    /**
     * Get audit logs for a user
     * @param {string} userId - The user ID
     * @param {number} limit - Maximum number of logs to return
     * @returns {Promise<Array>} - Array of audit logs
     */
    async function getAuditLogs(userId, limit = 100) {
        try {
            const logsSnapshot = await db.collection(COLLECTIONS.AUDIT_LOGS)
                .where('userId', '==', userId)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            return logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting audit logs:', error);
            throw error;
        }
    }

    // Public API
    return {
        init,
        getUserProfile,
        saveUserProfile,
        getUserRecords,
        getSharedRecords,
        saveRecord,
        deleteRecord,
        shareRecord,
        revokeRecordShare,
        getTrustedProviders,
        addTrustedProvider,
        removeTrustedProvider,
        logActivity,
        getAuditLogs,
        testConnection,
        handleConnectionError,
        connectionRestored,
        COLLECTIONS
    };
})(); 