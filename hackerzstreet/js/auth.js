/**
 * Authentication module for MedSecure
 * 
 * Handles user registration, login, and session management using Firebase Auth.
 */

const Auth = {
    currentUser: null,
    
    // Firebase auth instance
    auth: null,
    
    /**
     * Initialize the authentication system
     */
    init: function() {
        console.log('Auth module initializing');
        
        // Initialize Firebase Auth
        if (typeof firebase !== 'undefined') {
            try {
                this.auth = firebase.auth();
                console.log('Firebase Auth initialized');
                
                // Set up auth state listener
                this.auth.onAuthStateChanged(user => {
                    if (user) {
                        console.log('User is signed in:', user.email);
                        // Get user data from Firestore
                        DataStore.db.collection('users').doc(user.uid).get()
                            .then(doc => {
                                if (doc.exists) {
                                    const userData = {
                                        id: user.uid,
                                        email: user.email,
                                        name: doc.data().name,
                                        role: doc.data().role || 'patient',
                                        profileComplete: doc.data().profileComplete || false
                                    };
                                    
                                    this.currentUser = userData;
                                    App.setCurrentUser(userData);
                                    
                                    // Redirect to dashboard if on login page
                                    if (window.location.pathname.includes('login.html')) {
                                        App.redirectToLogin();
                                    } else {
                                        // Update UI for authenticated user
                                        this.updateAuthUI(true);
                                    }
                                } else {
                                    // User record doesn't exist in Firestore yet
                                    const newUser = {
                                        id: user.uid,
                                        email: user.email,
                                        name: user.displayName || user.email.split('@')[0],
                                        role: 'patient',
                                        createdAt: new Date().toISOString(),
                                        profileComplete: false
                                    };
                                    
                                    // Save new user to Firestore
                                    DataStore.db.collection('users').doc(user.uid).set(newUser)
                                        .then(() => {
                                            this.currentUser = newUser;
                                            App.setCurrentUser(newUser);
                                            this.updateAuthUI(true);
                                        })
                                        .catch(error => {
                                            console.error('Error creating user document:', error);
                                        });
                                }
                            })
                            .catch(error => {
                                console.error('Error getting user document:', error);
                            });
                    } else {
                        console.log('User is signed out');
                        this.currentUser = null;
                        App.setCurrentUser(null);
                        this.updateAuthUI(false);
                        
                        // Use App's redirectToLogin instead of direct navigation
                        if (typeof App !== 'undefined' && typeof App.redirectToLogin === 'function') {
                            App.redirectToLogin();
                        } else {
                            console.error('App.redirectToLogin is not available');
                            // Only redirect if not already on login page
                            if (!window.location.pathname.includes('login.html')) {
                                window.location.href = 'login.html';
                            }
                        }
                    }
                });
            } catch (error) {
                console.error('Firebase Auth initialization error:', error);
                this.setupLocalAuth();
            }
        } else {
            console.warn('Firebase is not available, using local authentication');
            this.setupLocalAuth();
        }
        
        // Set up login form handler
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }
        
        // Set up registration form handler
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', this.handleRegistration.bind(this));
        }
        
        // Set up logout button handler
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }
        
        // Set up alternate logout button handler (with hyphen in ID)
        const logoutBtnAlt = document.getElementById('logout-btn');
        if (logoutBtnAlt) {
            logoutBtnAlt.addEventListener('click', this.handleLogout.bind(this));
        }
    },
    
    /**
     * Set up local authentication as fallback
     */
    setupLocalAuth: function() {
        // Check for existing session
        const savedUser = localStorage.getItem('medsecure_current_user');
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                App.setCurrentUser(this.currentUser);
                this.updateAuthUI(true);
            } catch (error) {
                console.error('Error parsing saved user:', error);
                localStorage.removeItem('medsecure_current_user');
            }
        }
    },
    
    /**
     * Update UI elements based on authentication state
     * @param {boolean} isAuthenticated - Whether user is authenticated
     */
    updateAuthUI: function(isAuthenticated) {
        // Update header user info
        const userNameElement = document.getElementById('userName');
        const userRoleElement = document.getElementById('userRole');
        const authSection = document.getElementById('authSection');
        const loggedInSection = document.getElementById('loggedInSection');
        
        if (isAuthenticated && this.currentUser) {
            // Show logged in elements
            if (userNameElement) {
                userNameElement.textContent = this.currentUser.name;
            }
            
            if (userRoleElement) {
                userRoleElement.textContent = this.currentUser.role.charAt(0).toUpperCase() + this.currentUser.role.slice(1);
            }
            
            if (authSection) {
                authSection.classList.add('d-none');
            }
            
            if (loggedInSection) {
                loggedInSection.classList.remove('d-none');
            }
            
            // Update role-specific UI
            App.applyRoleBasedUI();
        } else {
            // Show logged out elements
            if (authSection) {
                authSection.classList.remove('d-none');
            }
            
            if (loggedInSection) {
                loggedInSection.classList.add('d-none');
            }
        }
    },
    
    /**
     * Handle login form submission
     * @param {Event} event - Form submit event
     */
    handleLogin: async function(event) {
        event.preventDefault();
        
        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');
        const messageElement = document.getElementById('loginMessage');
        
        if (!emailInput || !passwordInput) return;
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) {
            this.showAuthMessage(messageElement, 'error', 'Please enter both email and password');
            return;
        }
        
        try {
            if (this.auth) {
                // Use Firebase Authentication
                await this.auth.signInWithEmailAndPassword(email, password);
                // Auth state listener will handle the rest
            } else {
                // Use local authentication
                const users = await DataStore.getUsers();
                const user = users.find(u => u.email === email);
                
                if (!user) {
                    this.showAuthMessage(messageElement, 'error', 'User not found');
                    return;
                }
                
                // In a real app, we would never store passwords like this
                // This is only for demo purposes without a backend
                if (user.password === password) {
                    // Login successful
                    this.currentUser = user;
                    localStorage.setItem('medsecure_current_user', JSON.stringify(user));
                    App.setCurrentUser(user);
                    this.updateAuthUI(true);
                    
                    // Redirect to dashboard
                    App.redirectToLogin();
                } else {
                    this.showAuthMessage(messageElement, 'error', 'Incorrect password');
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showAuthMessage(messageElement, 'error', error.message || 'Login failed');
        }
    },
    
    /**
     * Handle registration form submission
     * @param {Event} event - Form submit event
     */
    handleRegistration: async function(event) {
        event.preventDefault();
        
        const nameInput = document.getElementById('registerName');
        const emailInput = document.getElementById('registerEmail');
        const passwordInput = document.getElementById('registerPassword');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const messageElement = document.getElementById('registerMessage');
        
        if (!nameInput || !emailInput || !passwordInput || !confirmPasswordInput) return;
        
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Validate inputs
        if (!name || !email || !password) {
            this.showAuthMessage(messageElement, 'error', 'Please fill in all fields');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showAuthMessage(messageElement, 'error', 'Passwords do not match');
            return;
        }
        
        try {
            if (this.auth) {
                // Use Firebase Authentication
                const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Update display name
                await user.updateProfile({ displayName: name });
                
                // User document will be created by the auth state change listener
                this.showAuthMessage(messageElement, 'success', 'Registration successful! Redirecting...');
                
                // Redirect will happen automatically through auth state listener
            } else {
                // Use local user storage
                const users = await DataStore.getUsers();
                
                // Check if email already exists
                if (users.some(user => user.email === email)) {
                    this.showAuthMessage(messageElement, 'error', 'Email already in use');
                    return;
                }
                
                // Create new user
                const newUser = {
                    id: 'user_' + Date.now(),
                    name: name,
                    email: email,
                    // In a real app, we would never store passwords like this
                    password: password,
                    role: 'patient',
                    createdAt: new Date().toISOString()
                };
                
                // Save new user
                await DataStore.addUser(newUser);
                
                // Auto-login
                this.currentUser = newUser;
                localStorage.setItem('medsecure_current_user', JSON.stringify(newUser));
                App.setCurrentUser(newUser);
                
                this.showAuthMessage(messageElement, 'success', 'Registration successful! Redirecting...');
                
                // Redirect to dashboard
                App.redirectToLogin();
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showAuthMessage(messageElement, 'error', error.message || 'Registration failed');
        }
    },
    
    /**
     * Handle user logout
     */
    handleLogout: async function() {
        try {
            console.log('Logout initiated');
            
            // Attempt to use FirebaseAuth first if available
            if (typeof FirebaseAuth !== 'undefined') {
                try {
                    console.log('Using FirebaseAuth for logout');
                    await FirebaseAuth.logoutUser();
                    console.log('FirebaseAuth logout successful');
                    // The auth state listener should handle the rest
                    return;
                } catch (firebaseError) {
                    console.error('FirebaseAuth logout error:', firebaseError);
                    // Continue with fallback logout if FirebaseAuth fails
                }
            }
            
            // Fallback to using direct Firebase auth if available
            if (this.auth) {
                console.log('Using direct Firebase auth for logout');
                await this.auth.signOut();
                console.log('Direct Firebase auth logout successful');
                // Auth state listener will handle the rest
                return;
            } 
            
            console.log('Using local logout fallback');
            // Fallback to local logout if no Firebase auth available
            this.currentUser = null;
            localStorage.removeItem('medsecure_current_user');
            
            if (typeof App !== 'undefined') {
                App.setCurrentUser(null);
            }
            
            this.updateAuthUI(false);
            
            // Redirect to login page
            if (typeof App !== 'undefined' && typeof App.redirectToLogin === 'function') {
                App.redirectToLogin();
            } else {
                console.error('App.redirectToLogin is not available');
                // Fallback to showing login view directly
                const appSection = document.getElementById('app-section');
                if (appSection) {
                    appSection.classList.remove('active');
                }
                
                const loginView = document.getElementById('login-view');
                if (loginView) {
                    loginView.classList.add('active');
                }
            }
        } catch (error) {
            console.error('Logout error:', error);
            if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
                App.showToast('error', 'Logout Error', error.message || 'Failed to log out');
            }
        }
    },
    
    /**
     * Display authentication message
     * @param {HTMLElement} element - Element to show message in
     * @param {string} type - Message type ('success' or 'error')
     * @param {string} message - Message text
     */
    showAuthMessage: function(element, type, message) {
        if (!element) return;
        
        element.textContent = message;
        element.className = 'alert';
        
        if (type === 'error') {
            element.classList.add('alert-danger');
        } else if (type === 'success') {
            element.classList.add('alert-success');
        }
        
        element.classList.remove('d-none');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            element.classList.add('d-none');
        }, 5000);
    },
    
    /**
     * Check if user is authenticated
     * @returns {boolean} Authentication status
     */
    isAuthenticated: function() {
        return !!this.currentUser;
    },
    
    /**
     * Get current user
     * @returns {Object|null} Current user or null if not authenticated
     */
    getCurrentUser: function() {
        return this.currentUser;
    },
    
    /**
     * Send password reset email
     * @param {string} email - User email address
     * @returns {Promise<boolean>} Success status
     */
    sendPasswordResetEmail: async function(email) {
        if (!email) return false;
        
        try {
            if (this.auth) {
                // Use Firebase Authentication
                await this.auth.sendPasswordResetEmail(email);
                return true;
            } else {
                // Local auth doesn't support password reset
                console.warn('Password reset not available in local mode');
                return false;
            }
        } catch (error) {
            console.error('Password reset error:', error);
            return false;
        }
    },
    
    /**
     * Update user profile
     * @param {Object} userData - User data to update
     * @returns {Promise<boolean>} Success status
     */
    updateUserProfile: async function(userData) {
        if (!this.currentUser || !userData) return false;
        
        try {
            if (this.auth) {
                // First update auth profile if name changed
                if (userData.name && userData.name !== this.currentUser.name) {
                    await this.auth.currentUser.updateProfile({
                        displayName: userData.name
                    });
                }
                
                // Then update user document in Firestore
                await DataStore.db.collection('users').doc(this.currentUser.id).update({
                    name: userData.name || this.currentUser.name,
                    role: userData.role || this.currentUser.role,
                    profileComplete: true,
                    updatedAt: new Date().toISOString()
                });
                
                // Update local user object
                this.currentUser = {
                    ...this.currentUser,
                    name: userData.name || this.currentUser.name,
                    role: userData.role || this.currentUser.role,
                    profileComplete: true
                };
                
                App.setCurrentUser(this.currentUser);
                this.updateAuthUI(true);
                
                return true;
            } else {
                // Update local user
                this.currentUser = {
                    ...this.currentUser,
                    ...userData,
                    updatedAt: new Date().toISOString()
                };
                
                localStorage.setItem('medsecure_current_user', JSON.stringify(this.currentUser));
                App.setCurrentUser(this.currentUser);
                this.updateAuthUI(true);
                
                // Update in data store
                const users = await DataStore.getUsers();
                const userIndex = users.findIndex(u => u.id === this.currentUser.id);
                
                if (userIndex >= 0) {
                    users[userIndex] = {
                        ...users[userIndex],
                        ...userData,
                        updatedAt: new Date().toISOString()
                    };
                    
                    localStorage.setItem('medsecure_users', JSON.stringify(users));
                }
                
                return true;
            }
        } catch (error) {
            console.error('Profile update error:', error);
            return false;
        }
    }
}; 