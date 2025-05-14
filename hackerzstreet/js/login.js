/**
 * MedSecure Login Module
 * Handles login, registration, and authentication UI
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Login module initializing...');
    
    // Check if all required objects are available
    console.log('FirebaseConfig available:', typeof FirebaseConfig !== 'undefined');
    console.log('FirebaseAuth available:', typeof FirebaseAuth !== 'undefined');
    console.log('DataStore available:', typeof DataStore !== 'undefined');
    console.log('Firebase available:', typeof firebase !== 'undefined');
    
    try {
        // Register listeners first (so they're available regardless of Firebase status)
        setupListeners();
        
        // Check if Firebase is available first
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK not available');
            showError('login-error', 'Firebase services not available. The application will function in offline mode.');
            return;
        }
        
        // Initialize Firebase if available
        if (typeof FirebaseCoordinator !== 'undefined') {
            console.log('Attempting to initialize Firebase via Coordinator...');
            FirebaseCoordinator.init().then(success => {
                console.log('Firebase initialization result:', success);
                if (!success) {
                    console.warn('Firebase initialization returned false');
                    showError('login-error', 'Failed to connect to Firebase. The application will function in offline mode.');
                } else {
                    console.log('Firebase initialized successfully');
                    hideError('login-error');
                    
                    // Initialize FirebaseAuth if available
                    if (typeof FirebaseAuth !== 'undefined' && typeof FirebaseAuth.init === 'function') {
                        const authInitialized = FirebaseAuth.init();
                        console.log('FirebaseAuth initialization result:', authInitialized);
                        if (!authInitialized) {
                            console.warn('FirebaseAuth initialization failed');
                        }
                    }
                    
                    // Check if there's already a logged in user after a short delay
                    setTimeout(() => {
                        if (typeof FirebaseAuth !== 'undefined') {
                            const currentUser = FirebaseAuth.getCurrentUser();
                            console.log('Current user check:', currentUser ? 'User found' : 'No user found');
                            if (currentUser) {
                                // User already logged in, redirect to main application
                                redirectToApp();
                            }
                        } else {
                            console.warn('FirebaseAuth not available for user check');
                        }
                    }, 1000); 
                }
            }).catch(error => {
                console.error('Error initializing Firebase:', error);
                showError('login-error', 'Failed to connect to the server. The application will function in offline mode.');
            });
        } else if (typeof FirebaseConfig !== 'undefined') {
            console.log('Attempting to initialize Firebase via Config...');
            FirebaseConfig.init().then(success => {
                console.log('Firebase initialization result:', success);
                if (!success) {
                    console.warn('Firebase initialization returned false');
                    showError('login-error', 'Failed to connect to Firebase. The application will function in offline mode.');
                } else {
                    console.log('Firebase initialized successfully');
                    hideError('login-error');
                    
                    // Initialize FirebaseAuth if available
                    if (typeof FirebaseAuth !== 'undefined' && typeof FirebaseAuth.init === 'function') {
                        const authInitialized = FirebaseAuth.init();
                        console.log('FirebaseAuth initialization result:', authInitialized);
                        if (!authInitialized) {
                            console.warn('FirebaseAuth initialization failed');
                        }
                    }
                    
                    // Check if there's already a logged in user after a short delay
                    setTimeout(() => {
                        if (typeof FirebaseAuth !== 'undefined') {
                            const currentUser = FirebaseAuth.getCurrentUser();
                            console.log('Current user check:', currentUser ? 'User found' : 'No user found');
                            if (currentUser) {
                                // User already logged in, redirect to main application
                                redirectToApp();
                            }
                        } else {
                            console.warn('FirebaseAuth not available for user check');
                        }
                    }, 1000); 
                }
            }).catch(error => {
                console.error('Error initializing Firebase:', error);
                showError('login-error', 'Failed to connect to the server. The application will function in offline mode.');
            });
        } else {
            console.warn('FirebaseConfig not available, falling back to local auth');
            showError('login-error', 'Firebase not configured. Using offline mode.');
        }
    } catch (e) {
        console.error('Error in login initialization:', e);
        showError('login-error', 'An error occurred during startup. Using offline mode.');
    }
});

/**
 * Set up event listeners for the login page
 */
function setupListeners() {
    // Tab switching
    setupTabSwitching();
    
    // Login form submission
    const loginForm = document.getElementById('login');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Registration form submission
    const registerForm = document.getElementById('register');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegistration);
    }
    
    // Password strength meter
    const passwordInput = document.getElementById('reg-password');
    if (passwordInput) {
        passwordInput.addEventListener('input', updatePasswordStrength);
    }
    
    // Password confirmation validation
    const confirmPasswordInput = document.getElementById('reg-confirm-password');
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', validatePasswordMatch);
    }
    
    // Forgot password link
    const forgotPasswordLink = document.getElementById('forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', handleForgotPassword);
    }
}

/**
 * Handle login form submission
 * @param {Event} event - Form submission event
 */
async function handleLogin(event) {
    event.preventDefault();
    
    // Clear any previous errors
    hideError('login-error');
    
    // Get form values
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    // Validate inputs
    if (!email || !password) {
        showError('login-error', 'Please enter both email and password');
        return;
    }
    
    // Show loading state
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Logging in...';
    
    try {
        if (typeof App !== 'undefined' && typeof App.login === 'function') {
            // Use the App module to handle login
            await App.login(email, password);
            redirectToApp();
        } else if (typeof FirebaseAuth !== 'undefined') {
            // Use Firebase Auth directly
            await FirebaseAuth.loginUser(email, password);
            redirectToApp();
        } else {
            throw new Error('Authentication service not available');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('login-error', error.message || 'Login failed. Please check your credentials and try again.');
    } finally {
        // Reset button state
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
}

/**
 * Handle registration form submission
 * @param {Event} event - Form submission event
 */
async function handleRegistration(event) {
    event.preventDefault();
    
    // Clear any previous errors
    hideError('register-error');
    
    // Get form values
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const role = document.getElementById('reg-role').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    const mfaEnabled = document.getElementById('reg-mfa-enabled').checked;
    const termsConsent = document.getElementById('terms-consent').checked;
    const hipaaConsent = document.getElementById('hipaa-consent').checked;
    
    // Validate inputs
    if (!name || !email || !password || !confirmPassword) {
        showError('register-error', 'Please fill in all required fields');
        return;
    }
    
    if (password !== confirmPassword) {
        showError('register-error', 'Passwords do not match');
        return;
    }
    
    if (!termsConsent || !hipaaConsent) {
        showError('register-error', 'You must agree to the terms and HIPAA regulations');
        return;
    }
    
    // Check password strength
    const passwordStrength = getPasswordStrength(password);
    if (passwordStrength < 2) {
        showError('register-error', 'Please use a stronger password');
        return;
    }
    
    // Show loading state
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Creating account...';
    
    try {
        const userData = {
            name,
            role,
            mfaEnabled,
            createdAt: new Date().toISOString()
        };
        
        if (typeof App !== 'undefined' && typeof App.register === 'function') {
            // Use the App module to handle registration
            await App.register(email, password, userData);
            redirectToApp();
        } else if (typeof FirebaseAuth !== 'undefined') {
            // Use Firebase Auth directly
            await FirebaseAuth.registerUser(email, password, userData);
            redirectToApp();
        } else {
            throw new Error('Authentication service not available');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showError('register-error', error.message || 'Registration failed. Please try again.');
    } finally {
        // Reset button state
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
}

/**
 * Handle forgot password request
 * @param {Event} event - Click event
 */
async function handleForgotPassword(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    
    if (!email) {
        showError('login-error', 'Please enter your email address');
        return;
    }
    
    try {
        if (typeof FirebaseAuth !== 'undefined') {
            await FirebaseAuth.sendPasswordReset(email);
            showError('login-error', 'Password reset email sent. Please check your inbox.', 'success');
        } else {
            throw new Error('Password reset service not available');
        }
    } catch (error) {
        console.error('Password reset error:', error);
        showError('login-error', error.message || 'Failed to send password reset email. Please try again.');
    }
}

/**
 * Set up tab switching between login and registration
 */
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Update tab buttons
            tabButtons.forEach(tb => {
                if (tb.getAttribute('data-tab') === targetTab) {
                    tb.classList.add('active');
                } else {
                    tb.classList.remove('active');
                }
            });
            
            // Update form containers
            const forms = document.querySelectorAll('.form-container');
            forms.forEach(form => {
                if (form.id === `${targetTab}-form`) {
                    form.classList.add('active');
                } else {
                    form.classList.remove('active');
                }
            });
            
            // Clear any visible errors when switching tabs
            hideError('login-error');
            hideError('register-error');
        });
    });
}

/**
 * Update password strength meter
 */
function updatePasswordStrength() {
    const password = document.getElementById('reg-password').value;
    const meter = document.getElementById('password-strength-meter');
    const strengthText = document.getElementById('password-strength-text');
    
    const strength = getPasswordStrength(password);
    
    // Update meter
    if (meter) {
        meter.value = strength;
    }
    
    // Update text description
    if (strengthText) {
        let text = 'Password strength: ';
        
        if (password.length === 0) {
            text += 'No password entered';
        } else if (strength === 0) {
            text += 'Very weak';
        } else if (strength === 1) {
            text += 'Weak';
        } else if (strength === 2) {
            text += 'Moderate';
        } else if (strength === 3) {
            text += 'Strong';
        } else {
            text += 'Very strong';
        }
        
        strengthText.textContent = text;
        
        // Update color
        const colors = ['#dc3545', '#dc3545', '#ffc107', '#28a745', '#28a745'];
        strengthText.style.color = colors[strength];
    }
}

/**
 * Calculate password strength
 * @param {string} password - Password to evaluate
 * @returns {number} - Strength score from 0-4
 */
function getPasswordStrength(password) {
    if (!password) return 0;
    
    let strength = 0;
    
    // Length check
    if (password.length >= 8) strength += 1;
    if (password.length >= 12) strength += 1;
    
    // Complexity checks
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 1;
    
    return Math.min(4, strength);
}

/**
 * Validate that passwords match
 */
function validatePasswordMatch() {
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    const confirmInput = document.getElementById('reg-confirm-password');
    
    if (confirmPassword && password !== confirmPassword) {
        confirmInput.setCustomValidity('Passwords do not match');
    } else {
        confirmInput.setCustomValidity('');
    }
}

/**
 * Show an error message
 * @param {string} elementId - ID of the error message element
 * @param {string} message - Error message to display
 * @param {string} type - Message type (error or success)
 */
function showError(elementId, message, type = 'error') {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
        errorElement.classList.remove('error-message', 'success-message');
        errorElement.classList.add(type === 'error' ? 'error-message' : 'success-message');
    }
}

/**
 * Hide an error message
 * @param {string} elementId - ID of the error message element
 */
function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.classList.add('hidden');
    }
}

/**
 * Redirect to the main application
 */
function redirectToApp() {
    // Remove the login-view class and show the main application view
    const loginView = document.getElementById('login-view');
    if (loginView) {
        loginView.classList.add('hidden');
    }
    
    // If we have an App.init function, use it to initialize the application
    if (typeof App !== 'undefined' && typeof App.init === 'function') {
        // App.init will handle showing the appropriate view
        App.init();
    } else {
        // Fallback to showing the dashboard view
        const dashboardView = document.getElementById('dashboard-view');
        if (dashboardView) {
            dashboardView.classList.remove('hidden');
        }
    }
} 