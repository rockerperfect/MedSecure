/**
 * MedSecure Firebase Storage Module
 * Handles file upload and download operations for medical records
 */

const FirebaseStorage = (function() {
    // Firebase storage instance
    let storage = null;
    
    // Storage reference
    let storageRef = null;
    
    // Constants
    const RECORDS_FOLDER = 'medical_records';
    const PROFILE_IMAGES_FOLDER = 'profile_images';
    
    // File size limits
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    
    /**
     * Initialize Firebase Storage
     * @returns {boolean} - Success status
     */
    function init() {
        try {
            // Check if firebase is available
            if (typeof firebase === 'undefined') {
                console.error('Firebase SDK not available');
                return false;
            }
            
            // Check if Firebase Storage is available
            if (typeof firebase.storage !== 'function') {
                console.error('Firebase Storage SDK not available');
                return false;
            }
            
            storage = firebase.storage();
            storageRef = storage.ref();
            
            console.log('Firebase Storage initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing Firebase Storage:', error);
            return false;
        }
    }
    
    /**
     * Generate a unique file path for a record
     * @param {string} userId - User ID
     * @param {string} fileName - Original file name
     * @returns {string} - Unique file path
     * @private
     */
    function _generateRecordPath(userId, fileName) {
        const timestamp = Date.now();
        const fileExtension = fileName.split('.').pop();
        return `${RECORDS_FOLDER}/${userId}/${timestamp}_${_sanitizeFileName(fileName)}`;
    }
    
    /**
     * Generate a profile image path
     * @param {string} userId - User ID
     * @returns {string} - Profile image path
     * @private
     */
    function _generateProfileImagePath(userId) {
        return `${PROFILE_IMAGES_FOLDER}/${userId}/profile.jpg`;
    }
    
    /**
     * Sanitize a file name to be safe for storage
     * @param {string} fileName - Original file name
     * @returns {string} - Sanitized file name
     * @private
     */
    function _sanitizeFileName(fileName) {
        // Remove potentially unsafe characters
        return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    }
    
    /**
     * Upload a medical record file
     * @param {string} userId - User ID
     * @param {File} file - File object to upload
     * @param {Object} metadata - File metadata
     * @param {Function} progressCallback - Progress callback(progress)
     * @returns {Promise<Object>} - Upload result with download URL and file path
     */
    async function uploadMedicalRecord(userId, file, metadata = {}, progressCallback = null) {
        if (!storage || !userId || !file) {
            throw new Error('Missing required parameters or Firebase Storage not initialized');
        }
        
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`File is too large. Maximum allowed size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
        }
        
        // Generate a unique file path
        const filePath = _generateRecordPath(userId, file.name);
        const fileRef = storageRef.child(filePath);
        
        // Add additional metadata
        const fullMetadata = {
            contentType: file.type,
            customMetadata: {
                ...metadata,
                originalName: file.name,
                userId: userId,
                timestamp: Date.now().toString()
            }
        };
        
        try {
            // Start the upload
            const uploadTask = fileRef.put(file, fullMetadata);
            
            // Set up progress monitoring
            if (progressCallback && typeof progressCallback === 'function') {
                uploadTask.on('state_changed', snapshot => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    progressCallback(progress);
                });
            }
            
            // Wait for upload to complete
            await uploadTask;
            
            // Get the download URL
            const downloadURL = await fileRef.getDownloadURL();
            
            // Log the upload if FirebaseDb is available
            if (FirebaseDb) {
                await FirebaseDb.logActivity(userId, 'record_upload', {
                    fileName: file.name,
                    fileSize: file.size,
                    filePath
                });
            }
            
            return {
                url: downloadURL,
                path: filePath,
                name: file.name,
                size: file.size,
                type: file.type,
                metadata: fullMetadata.customMetadata
            };
        } catch (error) {
            console.error('Error uploading medical record:', error);
            throw error;
        }
    }
    
    /**
     * Get a download URL for a medical record
     * @param {string} filePath - Path to the file in storage
     * @returns {Promise<string>} - Download URL
     */
    async function getMedicalRecordUrl(filePath) {
        if (!storage || !filePath) {
            throw new Error('Missing file path or Firebase Storage not initialized');
        }
        
        try {
            const fileRef = storageRef.child(filePath);
            return await fileRef.getDownloadURL();
        } catch (error) {
            console.error('Error getting medical record URL:', error);
            throw error;
        }
    }
    
    /**
     * Delete a medical record file
     * @param {string} userId - User ID
     * @param {string} filePath - Path to the file in storage
     * @returns {Promise<void>}
     */
    async function deleteMedicalRecord(userId, filePath) {
        if (!storage || !userId || !filePath) {
            throw new Error('Missing required parameters or Firebase Storage not initialized');
        }
        
        try {
            const fileRef = storageRef.child(filePath);
            await fileRef.delete();
            
            // Log the deletion if FirebaseDb is available
            if (FirebaseDb) {
                await FirebaseDb.logActivity(userId, 'record_deletion', {
                    filePath
                });
            }
        } catch (error) {
            console.error('Error deleting medical record:', error);
            throw error;
        }
    }
    
    /**
     * Upload a profile image
     * @param {string} userId - User ID
     * @param {File|Blob} imageFile - Image file or blob
     * @param {Function} progressCallback - Progress callback(progress)
     * @returns {Promise<string>} - Download URL
     */
    async function uploadProfileImage(userId, imageFile, progressCallback = null) {
        if (!storage || !userId || !imageFile) {
            throw new Error('Missing required parameters or Firebase Storage not initialized');
        }
        
        // Check file type
        if (!imageFile.type.startsWith('image/')) {
            throw new Error('File must be an image');
        }
        
        // Check file size (limit to 5MB for profile images)
        if (imageFile.size > 5 * 1024 * 1024) {
            throw new Error('Profile image too large. Maximum size is 5MB');
        }
        
        // Generate profile image path
        const filePath = _generateProfileImagePath(userId);
        const fileRef = storageRef.child(filePath);
        
        try {
            // Start the upload
            const uploadTask = fileRef.put(imageFile, {
                contentType: imageFile.type
            });
            
            // Set up progress monitoring
            if (progressCallback && typeof progressCallback === 'function') {
                uploadTask.on('state_changed', snapshot => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    progressCallback(progress);
                });
            }
            
            // Wait for upload to complete
            await uploadTask;
            
            // Get the download URL
            const downloadURL = await fileRef.getDownloadURL();
            
            return downloadURL;
        } catch (error) {
            console.error('Error uploading profile image:', error);
            throw error;
        }
    }
    
    /**
     * Get a user's profile image URL
     * @param {string} userId - User ID
     * @returns {Promise<string>} - Profile image URL or null if not found
     */
    async function getProfileImageUrl(userId) {
        if (!storage || !userId) {
            throw new Error('Missing user ID or Firebase Storage not initialized');
        }
        
        try {
            const filePath = _generateProfileImagePath(userId);
            const fileRef = storageRef.child(filePath);
            return await fileRef.getDownloadURL();
        } catch (error) {
            // Return null if the file doesn't exist (likely no profile image uploaded)
            if (error.code === 'storage/object-not-found') {
                return null;
            }
            
            console.error('Error getting profile image URL:', error);
            throw error;
        }
    }
    
    // Public API
    return {
        init,
        uploadMedicalRecord,
        getMedicalRecordUrl,
        deleteMedicalRecord,
        uploadProfileImage,
        getProfileImageUrl
    };
})(); 