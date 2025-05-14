/**
 * Firebase Firestore Module
 * Handles database operations for medical records and user data
 */
const FirebaseFirestore = {
    db: null,
    isInitialized: false,
    
    /**
     * Initialize Firebase Firestore
     */
    init: function() {
        try {
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                this.db = firebase.firestore();
                this.isInitialized = true;
                console.log('Firebase Firestore initialized successfully');
                return true;
            } else {
                console.warn('Firebase Firestore not available');
                return false;
            }
        } catch (error) {
            console.error('Firebase Firestore initialization error:', error);
            return false;
        }
    },
    
    /**
     * Save a medical record to Firestore
     * @param {Object} record - The medical record object
     * @param {Function} successCallback - Callback for successful save
     * @param {Function} errorCallback - Callback for save errors
     */
    saveRecord: function(record, successCallback, errorCallback) {
        if (!this.isInitialized) {
            errorCallback('Firebase Firestore not initialized');
            return;
        }
        
        if (!record.id) {
            errorCallback('Record ID is required');
            return;
        }
        
        // Add timestamps
        record.updated = firebase.firestore.FieldValue.serverTimestamp();
        if (!record.created) {
            record.created = firebase.firestore.FieldValue.serverTimestamp();
        }
        
        // Save to Firestore
        this.db.collection('records').doc(record.id).set(record, { merge: true })
            .then(() => {
                if (typeof successCallback === 'function') {
                    successCallback(record);
                }
            })
            .catch((error) => {
                console.error('Error saving record:', error);
                if (typeof errorCallback === 'function') {
                    errorCallback(error);
                }
            });
    },
    
    /**
     * Get a medical record by ID
     * @param {string} recordId - The record ID
     * @param {Function} successCallback - Callback for successful retrieval
     * @param {Function} errorCallback - Callback for retrieval errors
     */
    getRecord: function(recordId, successCallback, errorCallback) {
        if (!this.isInitialized) {
            errorCallback('Firebase Firestore not initialized');
            return;
        }
        
        this.db.collection('records').doc(recordId).get()
            .then((doc) => {
                if (doc.exists) {
                    const record = doc.data();
                    if (typeof successCallback === 'function') {
                        successCallback(record);
                    }
                } else {
                    if (typeof errorCallback === 'function') {
                        errorCallback('Record not found');
                    }
                }
            })
            .catch((error) => {
                console.error('Error getting record:', error);
                if (typeof errorCallback === 'function') {
                    errorCallback(error);
                }
            });
    },
    
    /**
     * Get all records for a user
     * @param {string} userId - The user ID
     * @param {Function} successCallback - Callback for successful retrieval
     * @param {Function} errorCallback - Callback for retrieval errors
     */
    getUserRecords: function(userId, successCallback, errorCallback) {
        if (!this.isInitialized) {
            errorCallback('Firebase Firestore not initialized');
            return;
        }
        
        this.db.collection('records')
            .where('userId', '==', userId)
            .orderBy('created', 'desc')
            .get()
            .then((querySnapshot) => {
                const records = [];
                querySnapshot.forEach((doc) => {
                    records.push(doc.data());
                });
                
                if (typeof successCallback === 'function') {
                    successCallback(records);
                }
            })
            .catch((error) => {
                console.error('Error getting user records:', error);
                if (typeof errorCallback === 'function') {
                    errorCallback(error);
                }
            });
    },
    
    /**
     * Delete a medical record
     * @param {string} recordId - The record ID
     * @param {Function} successCallback - Callback for successful deletion
     * @param {Function} errorCallback - Callback for deletion errors
     */
    deleteRecord: function(recordId, successCallback, errorCallback) {
        if (!this.isInitialized) {
            errorCallback('Firebase Firestore not initialized');
            return;
        }
        
        this.db.collection('records').doc(recordId).delete()
            .then(() => {
                if (typeof successCallback === 'function') {
                    successCallback();
                }
            })
            .catch((error) => {
                console.error('Error deleting record:', error);
                if (typeof errorCallback === 'function') {
                    errorCallback(error);
                }
            });
    },
    
    /**
     * Share a record with another user
     * @param {string} recordId - The record ID
     * @param {string} targetUserId - The user ID to share with
     * @param {Object} permissions - Permission settings for the shared record
     * @param {Function} successCallback - Callback for successful sharing
     * @param {Function} errorCallback - Callback for sharing errors
     */
    shareRecord: function(recordId, targetUserId, permissions, successCallback, errorCallback) {
        if (!this.isInitialized) {
            errorCallback('Firebase Firestore not initialized');
            return;
        }
        
        const shareId = `${recordId}_${targetUserId}`;
        const shareData = {
            id: shareId,
            recordId: recordId,
            targetUserId: targetUserId,
            permissions: permissions || { view: true, download: false, modify: false },
            created: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active'
        };
        
        this.db.collection('shared_records').doc(shareId).set(shareData)
            .then(() => {
                // Add log entry for the sharing action
                this.addAuditLog({
                    action: 'share_record',
                    recordId: recordId,
                    targetUserId: targetUserId,
                    permissions: permissions
                });
                
                if (typeof successCallback === 'function') {
                    successCallback(shareData);
                }
            })
            .catch((error) => {
                console.error('Error sharing record:', error);
                if (typeof errorCallback === 'function') {
                    errorCallback(error);
                }
            });
    },
    
    /**
     * Get records shared with a user
     * @param {string} userId - The user ID
     * @param {Function} successCallback - Callback for successful retrieval
     * @param {Function} errorCallback - Callback for retrieval errors
     */
    getSharedWithUserRecords: function(userId, successCallback, errorCallback) {
        if (!this.isInitialized) {
            errorCallback('Firebase Firestore not initialized');
            return;
        }
        
        this.db.collection('shared_records')
            .where('targetUserId', '==', userId)
            .where('status', '==', 'active')
            .get()
            .then((querySnapshot) => {
                const sharedRecords = [];
                const recordIds = [];
                
                querySnapshot.forEach((doc) => {
                    const shareData = doc.data();
                    sharedRecords.push(shareData);
                    recordIds.push(shareData.recordId);
                });
                
                if (recordIds.length === 0) {
                    if (typeof successCallback === 'function') {
                        successCallback([]);
                    }
                    return;
                }
                
                // Get actual record data for the shared records
                this.getRecordsByIds(recordIds, (records) => {
                    // Merge share data with record data
                    const mergedRecords = records.map((record) => {
                        const shareData = sharedRecords.find(share => share.recordId === record.id);
                        return {
                            ...record,
                            sharedBy: record.userId,
                            permissions: shareData.permissions,
                            sharedOn: shareData.created
                        };
                    });
                    
                    if (typeof successCallback === 'function') {
                        successCallback(mergedRecords);
                    }
                }, errorCallback);
            })
            .catch((error) => {
                console.error('Error getting shared records:', error);
                if (typeof errorCallback === 'function') {
                    errorCallback(error);
                }
            });
    },
    
    /**
     * Get multiple records by their IDs
     * @param {Array} recordIds - Array of record IDs
     * @param {Function} successCallback - Callback for successful retrieval
     * @param {Function} errorCallback - Callback for retrieval errors
     */
    getRecordsByIds: function(recordIds, successCallback, errorCallback) {
        if (!this.isInitialized) {
            errorCallback('Firebase Firestore not initialized');
            return;
        }
        
        if (!recordIds || recordIds.length === 0) {
            if (typeof successCallback === 'function') {
                successCallback([]);
            }
            return;
        }
        
        // Firestore has a limit of 10 IDs in 'in' query, so we need to batch
        const promises = [];
        const batchSize = 10;
        
        for (let i = 0; i < recordIds.length; i += batchSize) {
            const batch = recordIds.slice(i, i + batchSize);
            const promise = this.db.collection('records')
                .where(firebase.firestore.FieldPath.documentId(), 'in', batch)
                .get();
            promises.push(promise);
        }
        
        Promise.all(promises)
            .then((results) => {
                const records = [];
                results.forEach((querySnapshot) => {
                    querySnapshot.forEach((doc) => {
                        records.push(doc.data());
                    });
                });
                
                if (typeof successCallback === 'function') {
                    successCallback(records);
                }
            })
            .catch((error) => {
                console.error('Error getting records by IDs:', error);
                if (typeof errorCallback === 'function') {
                    errorCallback(error);
                }
            });
    },
    
    /**
     * Add an audit log entry
     * @param {Object} logData - Log data including action, recordId, etc.
     * @param {Function} callback - Optional callback after logging
     */
    addAuditLog: function(logData, callback) {
        if (!this.isInitialized) {
            console.warn('Firebase Firestore not initialized, cannot log');
            if (typeof callback === 'function') {
                callback('Firebase Firestore not initialized');
            }
            return;
        }
        
        // Add user info and timestamp
        const userId = FirebaseAuth && FirebaseAuth.currentUser ? FirebaseAuth.currentUser.uid : null;
        
        const fullLogData = {
            ...logData,
            userId: userId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            id: this.generateId()
        };
        
        this.db.collection('audit_logs').doc(fullLogData.id).set(fullLogData)
            .then(() => {
                if (typeof callback === 'function') {
                    callback(null, fullLogData);
                }
            })
            .catch((error) => {
                console.error('Error adding audit log:', error);
                if (typeof callback === 'function') {
                    callback(error);
                }
            });
    },
    
    /**
     * Get audit logs for a user
     * @param {string} userId - The user ID
     * @param {number} limit - Maximum number of logs to retrieve
     * @param {Function} successCallback - Callback for successful retrieval
     * @param {Function} errorCallback - Callback for retrieval errors
     */
    getUserAuditLogs: function(userId, limit, successCallback, errorCallback) {
        if (!this.isInitialized) {
            errorCallback('Firebase Firestore not initialized');
            return;
        }
        
        let query = this.db.collection('audit_logs')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc');
            
        if (limit) {
            query = query.limit(limit);
        }
        
        query.get()
            .then((querySnapshot) => {
                const logs = [];
                querySnapshot.forEach((doc) => {
                    logs.push(doc.data());
                });
                
                if (typeof successCallback === 'function') {
                    successCallback(logs);
                }
            })
            .catch((error) => {
                console.error('Error getting audit logs:', error);
                if (typeof errorCallback === 'function') {
                    errorCallback(error);
                }
            });
    },
    
    /**
     * Generate a unique ID
     * @returns {string} Unique ID
     */
    generateId: function() {
        return this.db ? this.db.collection('_').doc().id : `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },
    
    /**
     * Search records by text query
     * @param {string} userId - The user ID
     * @param {string} query - Search query text
     * @param {Function} successCallback - Callback for successful search
     * @param {Function} errorCallback - Callback for search errors
     */
    searchRecords: function(userId, query, successCallback, errorCallback) {
        if (!this.isInitialized) {
            errorCallback('Firebase Firestore not initialized');
            return;
        }
        
        // Since Firestore doesn't support full-text search natively,
        // we'll do a simple search on title and description
        this.getUserRecords(userId, (records) => {
            if (!query || query.trim() === '') {
                if (typeof successCallback === 'function') {
                    successCallback(records);
                }
                return;
            }
            
            // Simple client-side search implementation
            const normalizedQuery = query.toLowerCase().trim();
            const results = records.filter(record => {
                const title = (record.title || '').toLowerCase();
                const description = (record.description || '').toLowerCase();
                const type = (record.type || '').toLowerCase();
                
                return title.includes(normalizedQuery) || 
                       description.includes(normalizedQuery) ||
                       type.includes(normalizedQuery);
            });
            
            if (typeof successCallback === 'function') {
                successCallback(results);
            }
        }, errorCallback);
    }
}; 