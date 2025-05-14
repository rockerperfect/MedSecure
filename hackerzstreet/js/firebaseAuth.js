/**
 * MedSecure Firebase Authentication Module
 * Handles user authentication, registration, and session management
 */

const FirebaseAuth = (function() {
    // Firebase auth instance
    let auth = null;
    
    // Current user
    let currentUser = null;
    
    // Auth state change listeners
    const authListeners = [];
    
    // Track initialization state
    let isInitialized = false;
    let initializationAttempted = false;
    let initializationPromise = null;
    
    /**
     * Initialize Firebase Auth
     * @returns {boolean} - Success status
     */
    function init() {
        // If already initialized successfully, return true
        if (isInitialized && auth) {
            console.log('Firebase Auth already initialized successfully');
            return true;
        }
        
        // If initialization is in progress, show that
        if (initializationAttempted) {
            console.log('Firebase Auth initialization already attempted, state:', isInitialized);
            return isInitialized;
        }
        
        initializationAttempted = true;
        console.log('Initializing Firebase Auth...');
        
        try {
            // Check if firebase is available
            if (typeof firebase === 'undefined') {
                console.error('Firebase SDK not available');
                return false;
            }
            
            // Check if firebase.auth is available
            if (typeof firebase.auth !== 'function') {
                console.error('Firebase Auth SDK not available');
                return false;
            }
            
            // Check if Firebase has been initialized (apps should exist)
            if (firebase.apps.length === 0) {
                console.error('Firebase not initialized yet - waiting for Firebase initialization');
                
                // Schedule a retry after a delay
                initializationPromise = new Promise(resolve => {
                    const checkInterval = setInterval(() => {
                        if (firebase.apps.length > 0) {
                            clearInterval(checkInterval);
                            console.log('Firebase apps detected, continuing auth initialization');
                            const result = initializeAuth();
                            resolve(result);
                        }
                    }, 100);
                    
                    // Set timeout to avoid infinite waiting
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        console.error('Timeout waiting for Firebase initialization');
                        resolve(false);
                    }, 5000);
                });
                
                return false;
            }
            
            return initializeAuth();
        } catch (error) {
            console.error('Error initializing Firebase Auth:', error);
            return false;
        }
    }
    
    /**
     * Initialize the auth object
     * @returns {boolean} Whether initialization was successful
     */
    function initializeAuth() {
        try {
            // Get the auth instance
            auth = firebase.auth();
            
            if (!auth) {
                console.error('Failed to get Firebase Auth instance');
                return false;
            }
            
            // Set up auth state change listener
            auth.onAuthStateChanged(user => {
                console.log('Auth state changed:', user ? 'User signed in' : 'User signed out');
                currentUser = user;
                // Notify all listeners
                notifyAuthListeners(user);
            }, error => {
                console.error('Auth state change error:', error);
            });
            
            console.log('Firebase Auth initialized successfully');
            isInitialized = true;
            return true;
        } catch (authError) {
            console.error('Error initializing Firebase Auth:', authError);
            return false;
        }
    }
    
    /**
     * Ensure auth is initialized and ready
     * @returns {Promise<boolean>} - Whether auth is ready to use
     */
    async function ensureAuth() {
        // If auth is already available, return true immediately
        if (auth) return true;
        
        // If initialization is in progress via promise, wait for it
        if (initializationPromise) {
            const result = await initializationPromise;
            return result;
        }
        
        // Try to initialize if we haven't yet
        if (!initializationAttempted) {
            return init();
        }
        
        // Last resort - try to get auth directly
        try {
            if (typeof firebase !== 'undefined' && typeof firebase.auth === 'function' && firebase.apps.length > 0) {
                auth = firebase.auth();
                if (auth) {
                    console.log('Auth obtained through last resort method');
                    return true;
                }
            }
        } catch (e) {
            console.error('Failed last resort auth initialization:', e);
        }
        
        console.error('Firebase Auth not initialized and cannot be initialized');
        return false;
    }
    
    /**
     * Register a new user with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {Object} userData - Additional user data (name, role, etc.)
     * @returns {Promise<Object>} - User data and credentials
     */
    async function registerUser(email, password, userData = {}) {
        console.log('Attempting to register user with email:', email);
        
        try {
            // Make sure auth is initialized
            const authReady = await ensureAuth();
            if (!authReady) {
                console.error('Firebase Auth not initialized');
                throw new Error('Authentication service not available. Please refresh the page and try again.');
            }
            
            // Double check auth is available before proceeding
            if (!auth || typeof auth.createUserWithEmailAndPassword !== 'function') {
                console.error('Auth object is invalid or createUserWithEmailAndPassword is not a function');
                throw new Error('Authentication service is not properly initialized. Please refresh the page and try again.');
            }
            
            // Create the user account
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            
            console.log('User registered successfully:', userCredential.user.uid);
            
            // Add user metadata to Firestore
            if (typeof FirebaseDB !== 'undefined' && userCredential.user) {
                try {
                    await FirebaseDB.addUser(userCredential.user.uid, {
                        ...userData,
                        email: email,
                        created: new Date().toISOString()
                    });
                    
                    // Log the registration
                    await FirebaseDB.logActivity(userCredential.user.uid, 'user_registration', {
                        email: email
                    });
                } catch (dbError) {
                    console.error('Error storing user data:', dbError);
                    // Non-fatal error
                }
            }
            
            return userCredential;
        } catch (error) {
            console.error('Error registering user:', error);
            throw error;
        }
    }
    
    /**
     * Log in a user with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} - User data and credentials
     */
    async function loginUser(email, password) {
        console.log('Attempting to login user with email:', email);
        
        try {
            // Check if Firebase SDK is available
            if (typeof firebase === 'undefined') {
                console.error('Firebase SDK not available');
                throw new Error('Firebase authentication service is not available. Please refresh the page and try again.');
            }
            
            // Try to initialize Firebase Auth if needed
            const authReady = await ensureAuth();
            if (!authReady) {
                console.error('Failed to initialize Firebase Auth');
                throw new Error('Authentication service is not available. Please refresh the page and try again.');
            }
            
            // Double check auth.signInWithEmailAndPassword is available
            if (!auth || typeof auth.signInWithEmailAndPassword !== 'function') {
                console.error('auth.signInWithEmailAndPassword is not a function');
                console.debug('Auth object:', auth);
                
                // One more attempt to get the auth object
                auth = firebase.auth();
                
                if (!auth || typeof auth.signInWithEmailAndPassword !== 'function') {
                    throw new Error('Authentication service is not properly initialized. Please refresh the page and try again.');
                }
            }
            
            // Attempt to log in
            console.log('Calling auth.signInWithEmailAndPassword with:', email);
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            
            console.log('User logged in successfully:', userCredential.user.uid);
            
            // Log the login
            if (typeof FirebaseDB !== 'undefined' && userCredential.user) {
                await FirebaseDB.logActivity(userCredential.user.uid, 'user_login', {
                    email: email
                });
            }
            
            return userCredential;
        } catch (error) {
            console.error('Error logging in:', error);
            
            // Enhanced error handling
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                throw new Error('Invalid email or password. Please try again.');
            } else if (error.code === 'auth/too-many-requests') {
                throw new Error('Too many failed login attempts. Please try again later or reset your password.');
            } else if (error.code === 'auth/network-request-failed') {
                throw new Error('Network error. Please check your internet connection and try again.');
            } else {
                throw error;
            }
        }
    }
    
    /**
     * Log out the current user
     * @returns {Promise<void>}
     */
    async function logoutUser() {
        try {
            // First check if Firebase is available
            if (typeof firebase === 'undefined') {
                console.error('Firebase SDK not available');
                throw new Error('Authentication service not available. Please refresh the page and try again.');
            }
            
            // Check if auth is initialized before proceeding
            const authReady = await ensureAuth();
            if (!authReady) {
                console.error('Firebase Auth not initialized');
                throw new Error('Authentication service not available. Please refresh the page and try again.');
            }
            
            // Log the logout if possible, but don't let it block the logout if it fails
            if (typeof FirebaseDB !== 'undefined' && currentUser) {
                try {
                    await FirebaseDB.logActivity(currentUser.uid, 'user_logout');
                } catch (dbError) {
                    console.error('Error logging logout:', dbError);
                    // Continue with logout even if logging fails
                }
            }
            
            // Only attempt signOut if auth is available
            if (auth) {
                await auth.signOut();
                console.log('User logged out successfully');
                
                // Clear any cached user data
                currentUser = null;
                
                // Notify any listeners
                notifyAuthStateListeners(null);
            } else {
                console.error('Auth object not available for logout');
                throw new Error('Authentication service not initialized properly');
            }
        } catch (error) {
            console.error('Error logging out:', error);
            throw error;
        }
    }
    
    /**
     * Send a password reset email
     * @param {string} email - User email
     * @returns {Promise<void>}
     */
    async function sendPasswordReset(email) {
        try {
            const authReady = await ensureAuth();
            if (!authReady) {
                throw new Error('Authentication service not available. Please refresh the page and try again.');
            }
            
            await auth.sendPasswordResetEmail(email);
            console.log('Password reset email sent to:', email);
        } catch (error) {
            console.error('Error sending password reset:', error);
            throw error;
        }
    }
    
    /**
     * Get the current authenticated user
     * @returns {Object|null} - Current user or null if not authenticated
     */
    function getCurrentUser() {
        if (auth) {
            return auth.currentUser || currentUser;
        }
        return currentUser;
    }
    
    /**
     * Get the current user's complete profile including Firestore data
     * @returns {Promise<Object|null>} - User profile or null if not authenticated
     */
    async function getCurrentUserProfile() {
        if (!currentUser) {
            return null;
        }
        
        try {
            // Get additional user data from Firestore
            if (FirebaseDB) {
                const userData = await FirebaseDB.getUserProfile(currentUser.uid);
                
                if (userData) {
                    return {
                        uid: currentUser.uid,
                        email: currentUser.email,
                        displayName: currentUser.displayName,
                        ...userData
                    };
                }
            }
            
            // Return basic user info if Firestore data not available
            return {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName
            };
        } catch (error) {
            console.error('Error getting user profile:', error);
            return {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName
            };
        }
    }
    
    /**
     * Update user profile
     * @param {Object} profileData - New profile data
     * @returns {Promise<void>}
     */
    async function updateUserProfile(profileData) {
        if (!currentUser) {
            throw new Error('No authenticated user');
        }
        
        try {
            const updates = {};
            
            // Update display name in Auth
            if (profileData.name) {
                await currentUser.updateProfile({
                    displayName: profileData.name
                });
            }
            
            // Update email if provided
            if (profileData.email && profileData.email !== currentUser.email) {
                await currentUser.updateEmail(profileData.email);
            }
            
            // Update additional data in Firestore
            if (FirebaseDB) {
                await FirebaseDB.saveUserProfile(currentUser.uid, profileData);
                
                // Log the profile update
                await FirebaseDB.logActivity(currentUser.uid, 'profile_update');
            }
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    }
    
    /**
     * Update user password
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @returns {Promise<void>}
     */
    async function updatePassword(currentPassword, newPassword) {
        if (!currentUser) {
            throw new Error('No authenticated user');
        }
        
        try {
            // Re-authenticate user before password change
            const credential = firebase.auth.EmailAuthProvider.credential(
                currentUser.email, 
                currentPassword
            );
            
            await currentUser.reauthenticateWithCredential(credential);
            
            // Change password
            await currentUser.updatePassword(newPassword);
            
            // Log the password change
            if (FirebaseDB) {
                await FirebaseDB.logActivity(currentUser.uid, 'password_change');
            }
        } catch (error) {
            console.error('Error updating password:', error);
            throw error;
        }
    }
    
    /**
     * Delete user account
     * @param {string} password - Current password for verification
     * @returns {Promise<void>}
     */
    async function deleteUserAccount(password) {
        if (!currentUser) {
            throw new Error('No authenticated user');
        }
        
        try {
            // Re-authenticate user before account deletion
            const credential = firebase.auth.EmailAuthProvider.credential(
                currentUser.email, 
                password
            );
            
            await currentUser.reauthenticateWithCredential(credential);
            
            const userId = currentUser.uid;
            
            // Log the account deletion
            if (FirebaseDB) {
                await FirebaseDB.logActivity(userId, 'account_deletion');
            }
            
            // Delete user account
            await currentUser.delete();
            
            // Note: Firestore data cleanup should be handled by Cloud Functions
        } catch (error) {
            console.error('Error deleting user account:', error);
            throw error;
        }
    }
    
    /**
     * Notify all registered auth listeners of a change in auth state
     * @param {Object} user - The current user or null if signed out
     */
    function notifyAuthListeners(user) {
        authListeners.forEach(listener => {
            try {
                listener(user);
            } catch (error) {
                console.error('Error in auth state listener:', error);
            }
        });
    }
    
    /**
     * Add a listener for auth state changes
     * @param {Function} listener - Function to be called on auth state changes
     */
    function addAuthStateListener(listener) {
        if (typeof listener !== 'function') {
            console.error('Auth state listener must be a function');
            return;
        }
        
        // Add to listeners array
        authListeners.push(listener);
        
        // Immediately notify with current state
        if (auth) {
            listener(currentUser);
        }
    }
    
    /**
     * Remove a previously registered auth state listener
     * @param {Function} listener - Function to remove
     */
    function removeAuthStateListener(listener) {
        const index = authListeners.indexOf(listener);
        if (index !== -1) {
            authListeners.splice(index, 1);
        }
    }
    
    /**
     * Check if a user is currently signed in
     * @returns {boolean} - Whether a user is signed in
     */
    function isUserSignedIn() {
        return !!getCurrentUser();
    }
    
    // Public API
    return {
        init: init,
        registerUser: registerUser,
        loginUser: loginUser,
        logoutUser: logoutUser,
        sendPasswordReset: sendPasswordReset,
        getCurrentUser: getCurrentUser,
        getCurrentUserProfile: getCurrentUserProfile,
        updateUserProfile: updateUserProfile,
        updatePassword: updatePassword,
        deleteUserAccount: deleteUserAccount,
        isUserSignedIn: isUserSignedIn,
        addAuthStateListener: addAuthStateListener,
        removeAuthStateListener: removeAuthStateListener
    };
})(); 