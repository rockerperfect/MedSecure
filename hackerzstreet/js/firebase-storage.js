/**
 * MedSecure Firebase Storage Module
 * Handle file uploads and downloads
 */

// Create a redirecting module that uses the existing firebaseStorage.js implementation
(function() {
    // Wait for the real module to be loaded
    const checkInterval = setInterval(() => {
        if (typeof FirebaseStorage !== 'undefined') {
            // Create a global alias to redirect to the correctly named module
            window.FirebaseStorage = FirebaseStorage;
            clearInterval(checkInterval);
            console.log('Firebase Storage module redirect initialized');
        }
    }, 100);
    
    // Timeout after 10 seconds
    setTimeout(() => {
        clearInterval(checkInterval);
        console.error('Timeout waiting for FirebaseStorage module');
    }, 10000);
})(); 