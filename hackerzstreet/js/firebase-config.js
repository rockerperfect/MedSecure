/**
 * Firebase Configuration for MedSecure
 * 
 * Sets up Firebase for authentication, Firestore database, and Storage
 */

// Initialize Firebase with configuration
const firebaseConfig = {
    apiKey: "AIzaSyCwqFAkMViXDww0k-nxWQtFtNuPO53GBgA",
    authDomain: "medsecure-app.firebaseapp.com",
    projectId: "medsecure-app",
    storageBucket: "medsecure-app.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:1234567890abcdef"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Create Firebase services objects for global use
const FirebaseService = {
    auth: firebase.auth(),
    db: firebase.firestore(),
    storage: firebase.storage(),
    
    /**
     * Initialize Firebase service
     */
    init: function() {
        console.log('Firebase initialized');
        
        // Enable offline persistence for Firestore
        this.db.enablePersistence()
            .then(() => {
                console.log('Firestore offline persistence enabled');
            })
            .catch((err) => {
                if (err.code == 'failed-precondition') {
                    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
                } else if (err.code == 'unimplemented') {
                    console.warn('The current browser does not support offline persistence');
                }
            });
            
        // Set up auth state change listener
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('User is signed in:', user.uid);
            } else {
                console.log('User is signed out');
            }
        });
    },
    
    /**
     * Get user role from Firestore
     * @param {string} uid - User ID
     * @returns {Promise<string>} - Promise resolving to user role
     */
    getUserRole: async function(uid) {
        try {
            const userDoc = await this.db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                return userDoc.data().role || 'patient';
            }
            return 'patient'; // Default role
        } catch (error) {
            console.error('Error getting user role:', error);
            return 'patient'; // Default role
        }
    },
    
    /**
     * Create collections path based on user role
     * @param {string} collection - Collection name
     * @param {string} role - User role
     * @returns {string} - Collection path with role prefix
     */
    getRoleBasedCollection: function(collection, role) {
        return `${role}_${collection}`;
    },
    
    /**
     * Get storage reference based on user role
     * @param {string} uid - User ID
     * @param {string} role - User role
     * @param {string} path - Storage path
     * @returns {Object} - Firebase storage reference
     */
    getRoleBasedStorageRef: function(uid, role, path = '') {
        return this.storage.ref(`${role}/${uid}/${path}`);
    }
};

// Initialize Firebase service
FirebaseService.init(); 