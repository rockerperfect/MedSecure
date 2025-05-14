/**
 * Main application module for MedSecure Enterprise
 * 
 * Coordinates all application components and provides enterprise features.
 */

const App = {
    // Application settings
    SETTINGS: {
        AUTO_SAVE_INTERVAL: 30000, // 30 seconds
        REFRESH_INTERVAL: 60000, // 1 minute
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
        ALLOWED_FILE_TYPES: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.txt'],
        MAX_RECORD_COUNT_WARNING: 1000,
        SESSION_REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes
        TOAST_DURATION: 5000 // 5 seconds
    },
    
    /**
     * Initialize the application
     * @param {Object} user - The logged in user (optional if using Firebase Auth)
     */
    init: function(user = null) {
        try {
            console.log('Initializing MedSecure Enterprise application');
            
            this.currentUser = user;
            this.unsavedChanges = false;
            this.pageLoaded = Date.now();
            this.notifications = [];
            
            // Initialize Firebase if available
            if (typeof FirebaseConfig !== 'undefined' && typeof FirebaseConfig.init === 'function') {
                FirebaseConfig.init().then(success => {
                    if (success) {
                        console.log('Firebase initialized successfully');
                        
                        // If user was not provided, try to get current Firebase user
                        if (!this.currentUser && typeof FirebaseAuth !== 'undefined') {
                            const firebaseUser = FirebaseAuth.getCurrentUser();
                            if (firebaseUser) {
                                this.initWithFirebaseUser(firebaseUser);
                            } else {
                                // No authenticated user, redirect to login
                                this.redirectToLogin();
                            }
                        } else {
                            // Continue with provided user
                            this.initializeApp();
                        }
                    } else {
                        console.error('Firebase initialization failed');
                        
                        // Initialize app in offline mode if Firebase fails
                        if (this.currentUser) {
                            this.initializeApp();
                        } else {
                            this.redirectToLogin();
                        }
                    }
                });
            } else {
                // Firebase not available, initialize with provided user
                if (this.currentUser) {
                    this.initializeApp();
                } else {
                    this.redirectToLogin();
                }
            }
        } catch (error) {
            console.error('Application initialization error:', error);
            this.handleError(error, 'app_init');
        }
    },
    
    /**
     * Initialize app with a Firebase user
     * @param {Object} firebaseUser - Firebase user object
     */
    initWithFirebaseUser: function(firebaseUser) {
        if (typeof FirebaseAuth !== 'undefined' && typeof FirebaseAuth.getCurrentUserProfile === 'function') {
            FirebaseAuth.getCurrentUserProfile().then(userProfile => {
                this.currentUser = userProfile;
                this.initializeApp();
            }).catch(error => {
                console.error('Error getting user profile:', error);
                this.redirectToLogin();
            });
        } else {
            // Fallback to basic Firebase user info
            this.currentUser = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || 'User',
                email: firebaseUser.email || '',
                role: 'patient' // Default role
            };
            this.initializeApp();
        }
    },
    
    /**
     * Complete application initialization after user is set
     */
    initializeApp: function() {
        if (!this.currentUser) {
            console.error('Cannot initialize app without user');
            this.redirectToLogin();
            return;
        }
        
        // Make sure app section is visible and login is hidden
        const appSection = document.getElementById('app-section');
        if (appSection) {
            appSection.classList.add('active');
        }
        
        const loginView = document.getElementById('login-view');
        if (loginView) {
            loginView.classList.remove('active');
            loginView.classList.add('hidden');
        }
        
        // Set up intervals for auto-save, refresh, etc.
        this.setupIntervals();
        
        // Initialize the Records module
        if (typeof Records !== 'undefined') {
            Records.init(this.currentUser);
        }
        
        // Load audit log
        this.loadAuditLog();
        
        // Setup browser history handling
        this.setupHistoryHandling();
        
        // Register event listeners
        this.bindEvents();
        
        // Check system health
        this.checkSystemHealth();
        
        // Load notifications from Firebase if available
        this.loadNotifications();
        
        // Update notifications badge
        this.updateNotificationBadge();
        
        // Set user role based on profile
        if (this.currentUser.role) {
            this.setUserRole(this.currentUser.role);
        } else {
            // Default to patient role
            this.setUserRole('patient');
        }
        
        // Initialize the Chatbot module
        if (typeof Chatbot !== 'undefined') {
            Chatbot.init();
        }
        
        // Navigate to dashboard by default
        this.navigateTo('dashboard');
        
        // Show welcome toast
        this.showToast('success', 'Welcome back!', `You've successfully logged in as ${this.currentUser.name}`);
        
        // Log application startup
        this.logActivity('APP_STARTUP', {
            userAgent: navigator.userAgent,
            screenSize: `${window.innerWidth}x${window.innerHeight}`
        });
    },
    
    /**
     * Redirect to login page
     */
    redirectToLogin: function() {
        console.log('App.redirectToLogin called - showing login view');
        
        // First hide the app section
        const appSection = document.getElementById('app-section');
        if (appSection) {
            appSection.classList.remove('active');
        }
        
        // Show login view
        const loginView = document.getElementById('login-view');
        if (loginView) {
            loginView.classList.add('active');
            loginView.classList.remove('hidden');
        } else {
            console.error('Login view not found');
        }
        
        // Reset form if needed
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.classList.add('active');
        }
        
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.classList.remove('active');
        }
    },
    
    /**
     * Log user in with Firebase authentication
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} - Login result
     */
    login: async function(email, password) {
        try {
            if (typeof FirebaseAuth === 'undefined') {
                throw new Error('Firebase Auth not available');
            }
            
            const result = await FirebaseAuth.loginUser(email, password);
            return result;
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('error', 'Login Failed', error.message);
            throw error;
        }
    },
    
    /**
     * Register a new user
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {Object} userData - Additional user data
     * @returns {Promise<Object>} - Registration result
     */
    register: async function(email, password, userData) {
        try {
            if (typeof FirebaseAuth === 'undefined') {
                throw new Error('Firebase Auth not available');
            }
            
            const result = await FirebaseAuth.registerUser(email, password, userData);
            return result;
        } catch (error) {
            console.error('Registration error:', error);
            this.showToast('error', 'Registration Failed', error.message);
            throw error;
        }
    },
    
    /**
     * Log the current user out
     * @returns {Promise<void>}
     */
    logout: async function() {
        try {
            console.log('App.logout initiated');
            
            // Log the logout action if possible
            try {
                this.logActivity('USER_LOGOUT');
            } catch (logError) {
                console.warn('Could not log logout activity:', logError);
            }
            
            // Try FirebaseAuth first if available
            if (typeof FirebaseAuth !== 'undefined') {
                try {
                    console.log('Using FirebaseAuth for logout');
                    await FirebaseAuth.logoutUser();
                    console.log('FirebaseAuth logout successful');
                } catch (firebaseError) {
                    console.error('FirebaseAuth logout error:', firebaseError);
                    // Continue with local logout even if Firebase fails
                }
            } else {
                console.log('FirebaseAuth not available, using local logout');
            }
            
            // Clear any local user data
            this.currentUser = null;
            
            // Redirect to login page
            this.redirectToLogin();
            console.log('Logout completed and redirected to login');
        } catch (error) {
            console.error('Logout error:', error);
            this.showToast('error', 'Logout Failed', error.message || 'An unknown error occurred during logout');
            throw error;
        }
    },
    
    /**
     * Handle user sign out (called by Firebase auth state change)
     */
    handleSignOut: function() {
        // Clear intervals
        if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        if (this.sessionRefreshInterval) clearInterval(this.sessionRefreshInterval);
        
        // Clear user data
        this.currentUser = null;
        
        // Redirect to login
        this.redirectToLogin();
    },
    
    /**
     * Set user data 
     * @param {Object} userData - User profile data
     */
    setUserData: function(userData) {
        if (!userData) return;
        
        this.currentUser = {
            ...this.currentUser,
            ...userData
        };
        
        // Update UI with user data
        const userNameDisplay = document.getElementById('user-name-display');
        if (userNameDisplay) {
            userNameDisplay.textContent = userData.name || userData.displayName || 'User';
        }
        
        // Update the user-name element (used in the header)
        const userName = document.getElementById('user-name');
        if (userName) {
            userName.textContent = userData.name || userData.displayName || 'User';
        }
        
        const userRoleDisplay = document.getElementById('user-role-display');
        if (userRoleDisplay && userData.role) {
            userRoleDisplay.textContent = userData.role.charAt(0).toUpperCase() + userData.role.slice(1);
        }
        
        // Update profile image if available
        if (userData.photoURL) {
            const profileImage = document.getElementById('profile-image');
            if (profileImage) {
                profileImage.src = userData.photoURL;
            }
        }
    },
    
    /**
     * Log an activity using Firebase
     * @param {string} action - The action performed
     * @param {Object} details - Additional details about the action
     */
    logActivity: function(action, details = {}) {
        if (!this.currentUser) return;
        
        // Use FirebaseDb if available
        if (typeof FirebaseDb !== 'undefined' && typeof FirebaseDb.logActivity === 'function') {
            FirebaseDb.logActivity(this.currentUser.id || this.currentUser.uid, action, details).catch(err => {
                console.error('Error logging to Firebase:', err);
            });
        }
        
        // Also log to local console
        console.log('Activity:', action, details);
    },
    
    /**
     * Set user role and update UI accordingly
     * @param {string} role - User role (admin, doctor, patient)
     */
    setUserRole: function(role) {
        if (!role || typeof role !== 'string') {
            console.error('Invalid role provided:', role);
            return;
        }
        
        const validRoles = ['admin', 'doctor', 'patient'];
        const normalizedRole = role.toLowerCase();
        
        if (!validRoles.includes(normalizedRole)) {
            console.error('Invalid role:', role);
            return;
        }
        
        // Set the role in the current user object
        if (this.currentUser) {
            this.currentUser.role = normalizedRole;
        }
        
        // Update the role in the UI
        const roleDisplay = document.getElementById('user-role-display');
        if (roleDisplay) {
            roleDisplay.textContent = normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);
        }
        
        // Apply role-based UI modifications
        this.applyRoleBasedUI(normalizedRole);
        
        console.log(`User role set to: ${normalizedRole}`);
        
        // Log the role change
        this.logActivity('ROLE_CHANGE', { 
            newRole: normalizedRole 
        });
    },

    /**
     * Apply role-based UI modifications
     * @param {string} role - User role
     */
    applyRoleBasedUI: function(role) {
        // Update dashboard for role
        this.updateDashboardForRole(role);
        
        // Update navigation for role
        this.updateNavigationForRole(role);
        
        // Update record management options
        const recordOptions = document.querySelectorAll('.record-option');
        recordOptions.forEach(option => {
            const allowedRoles = option.getAttribute('data-roles');
            
            if (allowedRoles) {
                const roles = allowedRoles.split(',');
                if (roles.includes(role) || roles.includes('all')) {
                    option.style.display = 'block';
                } else {
                    option.style.display = 'none';
                }
            }
        });
        
        // Apply admin-specific elements
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => {
            el.style.display = role === 'admin' ? 'block' : 'none';
        });
        
        // Apply doctor-specific elements
        const doctorElements = document.querySelectorAll('.doctor-only');
        doctorElements.forEach(el => {
            el.style.display = (role === 'doctor' || role === 'admin') ? 'block' : 'none';
        });
        
        // Apply patient-specific elements
        const patientElements = document.querySelectorAll('.patient-only');
        patientElements.forEach(el => {
            el.style.display = (role === 'patient' || role === 'admin') ? 'block' : 'none';
        });
    },
    
    /**
     * Update dashboard for specific role
     * @param {string} role - User role
     */
    updateDashboardForRole: function(role) {
        // Set dashboard title based on role
        const dashboardTitle = document.getElementById('dashboard-title');
        if (dashboardTitle) {
            switch (role) {
                case 'admin':
                    dashboardTitle.textContent = 'System Administration Dashboard';
                    dashboardTitle.innerHTML = '<i class="fas fa-user-shield"></i> ' + dashboardTitle.textContent;
                    break;
                case 'doctor':
                    dashboardTitle.textContent = 'Provider Dashboard';
                    dashboardTitle.innerHTML = '<i class="fas fa-user-md"></i> ' + dashboardTitle.textContent;
                    break;
                case 'patient':
                    dashboardTitle.textContent = 'Patient Dashboard';
                    dashboardTitle.innerHTML = '<i class="fas fa-user"></i> ' + dashboardTitle.textContent;
                    break;
                default:
                    dashboardTitle.textContent = 'Dashboard';
            }
        }
        
        // Update the role indicator styles
        const roleIndicator = document.getElementById('user-role-display');
        if (roleIndicator) {
            // Reset previous role classes
            roleIndicator.classList.remove('role-admin', 'role-doctor', 'role-patient');
            
            // Add role-specific class
            roleIndicator.classList.add('role-' + role);
            
            // Update text with capitalized first letter
            roleIndicator.textContent = role.charAt(0).toUpperCase() + role.slice(1);
        }
        
        // Show/hide role-specific dashboard sections
        const dashboardSections = document.querySelectorAll('.dashboard-section');
        dashboardSections.forEach(section => {
            const allowedRoles = section.getAttribute('data-roles');
            
            if (allowedRoles) {
                const roles = allowedRoles.split(',');
                if (roles.includes(role) || roles.includes('all')) {
                    section.classList.remove('hidden');
                } else {
                    section.classList.add('hidden');
                }
            }
        });
        
        // Update quick actions based on role
        this.updateQuickActionsForRole(role);
    },
    
    /**
     * Update quick actions based on user role
     * @param {string} role - User role
     */
    updateQuickActionsForRole: function(role) {
        const quickUpload = document.getElementById('quick-upload');
        const quickShare = document.getElementById('quick-share');
        const quickDownload = document.getElementById('quick-download');
        const quickProvider = document.getElementById('quick-provider');
        
        if (quickUpload) {
            if (role === 'patient' || role === 'admin') {
                quickUpload.style.display = 'inline-block';
                quickUpload.innerHTML = '<i class="fas fa-upload"></i> Upload My Record';
            } else if (role === 'doctor') {
                quickUpload.style.display = 'inline-block';
                quickUpload.innerHTML = '<i class="fas fa-upload"></i> Upload Patient Record';
            } else {
                quickUpload.style.display = 'none';
            }
        }
        
        if (quickShare) {
            if (role === 'patient' || role === 'admin') {
                quickShare.style.display = 'inline-block';
                quickShare.innerHTML = '<i class="fas fa-share-alt"></i> Share My Record';
            } else if (role === 'doctor') {
                quickShare.style.display = 'none';
            } else {
                quickShare.style.display = 'none';
            }
        }
        
        if (quickProvider) {
            if (role === 'patient' || role === 'admin') {
                quickProvider.style.display = 'inline-block';
                quickProvider.innerHTML = '<i class="fas fa-user-md"></i> Add Provider';
            } else if (role === 'doctor') {
                quickProvider.style.display = 'inline-block';
                quickProvider.innerHTML = '<i class="fas fa-users"></i> Manage Patients';
            } else {
                quickProvider.style.display = 'none';
            }
        }
    },
    
    /**
     * Update navigation based on role
     * @param {string} role - User role
     */
    updateNavigationForRole: function(role) {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const allowedRoles = item.getAttribute('data-roles');
            
            if (allowedRoles) {
                const roles = allowedRoles.split(',');
                if (roles.includes(role) || roles.includes('all')) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            }
        });
    },
    
    /**
     * Load notifications from Firebase
     */
    loadNotifications: function() {
        if (typeof FirebaseDb !== 'undefined' && typeof FirebaseDb.getUserNotifications === 'function' && this.currentUser) {
            FirebaseDb.getUserNotifications(this.currentUser.id || this.currentUser.uid)
                .then(notifications => {
                    this.notifications = notifications || [];
                    this.updateNotificationBadge();
                })
                .catch(error => {
                    console.error('Error loading notifications:', error);
                    // Fall back to sample notifications
                    this.createSampleNotifications();
                });
        } else {
            // Fall back to sample notifications if Firebase not available
            this.createSampleNotifications();
        }
    },
    
    /**
     * Set up application intervals
     */
    setupIntervals: function() {
        // Auto-save interval for any unsaved data
        this.autoSaveInterval = setInterval(() => {
            if (this.unsavedChanges) {
                this.saveChanges();
            }
        }, this.SETTINGS.AUTO_SAVE_INTERVAL);
        
        // Refresh interval for data updates
        this.refreshInterval = setInterval(() => {
            this.refreshData();
        }, this.SETTINGS.REFRESH_INTERVAL);
        
        // Session refresh interval
        this.sessionRefreshInterval = setInterval(() => {
            this.checkSessionRefresh();
        }, this.SETTINGS.SESSION_REFRESH_THRESHOLD);
    },
    
    /**
     * Check if the session needs to be refreshed
     */
    checkSessionRefresh: function() {
        const sessionData = DataStore.getSessionData();
        if (!sessionData) return;
        
        const now = Date.now();
        const timeLeft = sessionData.expiresAt - now;
        
        // If session expires in less than 5 minutes, refresh it
        if (timeLeft < this.SETTINGS.SESSION_REFRESH_THRESHOLD) {
            const newExpiry = now + (30 * 60 * 1000); // 30 more minutes
            DataStore.setSessionData({
                ...sessionData,
                expiresAt: newExpiry
            });
            
            console.log('Session refreshed');
        }
    },
    
    /**
     * Save any unsaved changes
     */
    saveChanges: function() {
        try {
            // This would handle any pending changes
            console.log('Auto-saving changes');
            this.unsavedChanges = false;
        } catch (error) {
            console.error('Error saving changes:', error);
        }
    },
    
    /**
     * Refresh data from storage
     */
    refreshData: function() {
        try {
            // Refresh UI components that need updating
            Records.loadUserRecords();
            Records.loadSharedRecords();
            Records.updateDashboardCounts();
            this.loadAuditLog();
        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    },
    
    /**
     * Setup browser history handling for clean navigation
     */
    setupHistoryHandling: function() {
        // Use history API to handle navigation without full page reloads
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.view) {
                this.navigateTo(event.state.view, true);
            }
        });
    },
    
    /**
     * Register event listeners for app functionality
     */
    bindEvents: function() {
        // Navigation links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.getAttribute('data-view');
                this.navigateTo(view);
            });
        });
        
        // Dashboard action buttons
        const quickUploadBtn = document.getElementById('quick-upload');
        if (quickUploadBtn) {
            quickUploadBtn.addEventListener('click', () => {
                // Navigate to records view and show upload modal after navigation completes
                this.navigateTo('records', false, () => {
                    if (typeof Records !== 'undefined' && Records.showUploadModal) {
                        Records.showUploadModal();
                    } else {
                        console.error('Records module not available or showUploadModal method not found');
                        this.showToast('error', 'Error', 'Could not open upload modal');
                    }
                });
            });
        }
        
        const quickShareBtn = document.getElementById('quick-share');
        if (quickShareBtn) {
            quickShareBtn.addEventListener('click', () => {
                this.navigateTo('share');
            });
        }
        
        const quickDownloadBtn = document.getElementById('quick-download');
        if (quickDownloadBtn) {
            quickDownloadBtn.addEventListener('click', () => {
                this.showToast('info', 'Download Initiated', 'Your records are being prepared for download.');
                setTimeout(() => {
                    this.showToast('success', 'Download Ready', 'Your records are ready for download.');
                }, 2000);
            });
        }
        
        const quickProviderBtn = document.getElementById('quick-provider');
        if (quickProviderBtn) {
            quickProviderBtn.addEventListener('click', () => {
                alert('Add Provider functionality would be implemented in a full version of the app.');
            });
        }
        
        // Notification handling
        const notificationsToggle = document.getElementById('notifications-toggle');
        if (notificationsToggle) {
            notificationsToggle.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent click from bubbling to document
                const menu = document.getElementById('notifications-menu');
                menu.classList.toggle('active');
                
                // If opening menu, update notifications as read if needed
                if (menu.classList.contains('active')) {
                    this.renderNotifications();
                }
            });
        }
        
        // Close notifications when clicking outside
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('notifications-menu');
            const toggle = document.getElementById('notifications-toggle');
            
            if (menu && menu.classList.contains('active') && 
                !menu.contains(e.target) && 
                !toggle.contains(e.target)) {
                menu.classList.remove('active');
            }
        });
        
        // Prevent clicks inside notifications menu from closing the menu
        const notificationsMenu = document.getElementById('notifications-menu');
        if (notificationsMenu) {
            notificationsMenu.addEventListener('click', (e) => {
                // Stop propagation for all clicks inside the menu to prevent them from reaching the document handler
                e.stopPropagation();
            });
        }
        
        const markAllReadBtn = document.getElementById('mark-all-read');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent close of the notifications menu
                this.markAllNotificationsRead();
            });
        }
        
        // Settings form submissions
        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateProfile();
            });
        }
        
        const securityForm = document.getElementById('security-form');
        if (securityForm) {
            securityForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateSecurity();
            });
        }
        
        const notificationForm = document.getElementById('notification-form');
        if (notificationForm) {
            notificationForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateNotificationPreferences();
            });
        }
        
        // Data management buttons
        const exportDataBtn = document.getElementById('export-data');
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', () => {
                this.exportData();
            });
        }
        
        const importDataBtn = document.getElementById('import-data');
        if (importDataBtn) {
            importDataBtn.addEventListener('click', () => {
                this.promptForImport();
            });
        }
        
        const deleteAccountBtn = document.getElementById('delete-account');
        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                    this.deleteAccount();
                }
            });
        }
        
        // Search functionality
        const recordSearch = document.getElementById('record-search');
        if (recordSearch) {
            recordSearch.addEventListener('input', () => {
                this.searchRecords(recordSearch.value);
            });
        }
        
        const recordTypeFilter = document.getElementById('record-type-filter');
        if (recordTypeFilter) {
            recordTypeFilter.addEventListener('change', () => {
                this.filterRecords(recordTypeFilter.value);
            });
        }
        
        // Audit log export
        const exportAuditBtn = document.getElementById('export-audit');
        if (exportAuditBtn) {
            exportAuditBtn.addEventListener('click', () => {
                this.exportAuditLog();
            });
        }
        
        // Dashboard links
        const viewAuditBtn = document.querySelector('[data-action="view-audit"]');
        if (viewAuditBtn) {
            viewAuditBtn.addEventListener('click', () => {
                this.navigateTo('audit');
            });
        }
    },
    
    /**
     * Navigate to a specific view
     * @param {string} view - View name to navigate to
     * @param {boolean} skipHistory - Whether to skip adding to browser history
     * @param {Function} callback - Optional callback to execute after navigation
     */
    navigateTo: function(view, skipHistory = false, callback = null) {
        // Handle special case for login view
        if (view === 'login') {
            this.redirectToLogin();
            return;
        }
        
        // Ensure app section is visible
        const appSection = document.getElementById('app-section');
        if (appSection) {
            appSection.classList.add('active');
        }
        
        // Hide login view if visible
        const loginView = document.getElementById('login-view');
        if (loginView) {
            loginView.classList.remove('active');
            loginView.classList.add('hidden');
        }
        
        // Hide all views within the app section
        const views = document.querySelectorAll('#app-section .view');
        views.forEach(v => v.classList.remove('active'));
        
        // Show selected view
        const targetView = document.getElementById(`${view}-view`);
        if (targetView) {
            targetView.classList.add('active');
            
            // Update navigation highlight
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach(link => {
                if (link.getAttribute('data-view') === view) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
            
            // Log navigation
            this.logActivity('NAVIGATION', {
                view: view
            });
            
            // Update browser history if not skipHistory
            if (!skipHistory) {
                const historyState = { view: view };
                window.history.pushState(historyState, '', `#${view}`);
            }
            
            // Execute callback if provided
            if (typeof callback === 'function') {
                callback();
            }
        } else {
            console.error('View not found:', view);
        }
    },
    
    /**
     * Load and display audit log
     */
    loadAuditLog: function() {
        try {
            if (!this.currentUser) return;
            
            const auditLogEntries = document.getElementById('audit-log-entries');
            if (!auditLogEntries) return;
            
            const dateRangeFilter = document.getElementById('audit-date-range').value;
            const typeFilter = document.getElementById('audit-type').value;
            
            // Create filters based on selections
            const filters = {
                userId: this.currentUser.id
            };
            
            // Apply date filter
            const now = new Date();
            if (dateRangeFilter === 'today') {
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                filters.dateFrom = today;
            } else if (dateRangeFilter === 'week') {
                const weekAgo = new Date(now);
                weekAgo.setDate(now.getDate() - 7);
                filters.dateFrom = weekAgo;
            } else if (dateRangeFilter === 'month') {
                const monthAgo = new Date(now);
                monthAgo.setMonth(now.getMonth() - 1);
                filters.dateFrom = monthAgo;
            }
            
            // Apply action type filter
            if (typeFilter !== 'all') {
                filters.action = typeFilter.toUpperCase();
            }
            
            // Get filtered audit log
            const auditLog = DataStore.getAuditLog(filters);
            
            if (auditLog.length === 0) {
                auditLogEntries.innerHTML = '<tr><td colspan="5" class="empty-state">No audit log entries found.</td></tr>';
                return;
            }
            
            // Create HTML for audit log entries
            const logHTML = auditLog.map(entry => {
                const date = new Date(entry.timestamp).toLocaleString();
                
                // Format activity name for display
                let activity = entry.action.replace(/_/g, ' ').toLowerCase();
                activity = activity.charAt(0).toUpperCase() + activity.slice(1);
                
                // Determine status class for color coding
                let statusClass = '';
                if (entry.status === 'SUCCESS') statusClass = 'status-success';
                else if (entry.status === 'FAILURE') statusClass = 'status-failure';
                else if (entry.status === 'ATTEMPT') statusClass = 'status-attempt';
                
                return `
                    <tr>
                        <td>${date}</td>
                        <td>${activity}</td>
                        <td>${this.currentUser.name}</td>
                        <td>${entry.ipAddress}</td>
                        <td class="${statusClass}">${entry.status}</td>
                    </tr>
                `;
            }).join('');
            
            auditLogEntries.innerHTML = logHTML;
        } catch (error) {
            console.error('Error loading audit log:', error);
            this.handleError(error, 'load_audit_log');
        }
    },
    
    /**
     * Load user settings
     */
    loadUserSettings: function() {
        // Fill profile form
        const profileName = document.getElementById('profile-name');
        const profileEmail = document.getElementById('profile-email');
        const profileRole = document.getElementById('profile-role');
        
        if (profileName && profileEmail && profileRole) {
            profileName.value = this.currentUser.name;
            profileEmail.value = this.currentUser.email;
            profileRole.value = this.getFormattedRole(this.currentUser.role);
        }
    },
    
    /**
     * Get formatted role name
     * @param {string} role - Role code
     * @returns {string} Formatted role name
     */
    getFormattedRole: function(role) {
        const roles = {
            'patient': 'Patient',
            'doctor': 'Healthcare Provider',
            'admin': 'Administrator'
        };
        
        return roles[role] || 'Unknown Role';
    },
    
    /**
     * Update user profile
     */
    updateProfile: function() {
        const profileName = document.getElementById('profile-name').value.trim();
        
        if (!profileName) {
            this.showToast('error', 'Update Failed', 'Name cannot be empty.');
            return;
        }
        
        // In a real app, this would send data to a server
        this.currentUser.name = profileName;
        
        // Update user name in the header
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
            userNameElement.textContent = profileName;
        }
        
        this.showToast('success', 'Profile Updated', 'Your profile has been updated successfully.');
    },
    
    /**
     * Update security settings
     */
    updateSecurity: function() {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-new-password').value;
        
        if (!currentPassword) {
            this.showToast('error', 'Update Failed', 'Current password is required.');
            return;
        }
        
        if (newPassword && newPassword !== confirmPassword) {
            this.showToast('error', 'Update Failed', 'New passwords do not match.');
            return;
        }
        
        // In a real app, this would verify the current password and update
        
        // Reset form
        document.getElementById('security-form').reset();
        
        this.showToast('success', 'Security Updated', 'Your security settings have been updated.');
        
        // Add notification
        this.addNotification({
            id: 'notification_' + Date.now(),
            title: 'Security Settings Changed',
            message: 'Your security settings were updated just now.',
            icon: 'shield-alt',
            time: new Date(),
            read: false
        });
    },
    
    /**
     * Update notification preferences
     */
    updateNotificationPreferences: function() {
        // In a real app, this would save preferences to user settings
        this.showToast('success', 'Preferences Updated', 'Your notification preferences have been saved.');
    },
    
    /**
     * Export application data to a file
     */
    exportData: function() {
        // In a real app, this would prepare and download user data
        this.showToast('info', 'Export Started', 'Your data is being prepared for export.');
        
        setTimeout(() => {
            this.showToast('success', 'Export Complete', 'Your data has been exported successfully.');
        }, 2000);
    },
    
    /**
     * Export audit log
     */
    exportAuditLog: function() {
        // In a real app, this would prepare and download audit log
        this.showToast('info', 'Export Started', 'Your audit log is being prepared for export.');
        
        setTimeout(() => {
            this.showToast('success', 'Export Complete', 'Your audit log has been exported successfully.');
        }, 2000);
    },
    
    /**
     * Filter records by type
     * @param {string} type - Record type to filter by
     */
    filterRecords: function(type) {
        const records = document.querySelectorAll('.record-card');
        
        records.forEach(record => {
            if (type === 'all' || record.querySelector('.record-type').classList.contains(type)) {
                record.style.display = 'flex';
            } else {
                record.style.display = 'none';
            }
        });
    },
    
    /**
     * Search records by title or content
     * @param {string} query - Search query
     */
    searchRecords: function(query) {
        const records = document.querySelectorAll('.record-card');
        const lowerQuery = query.toLowerCase();
        
        records.forEach(record => {
            const title = record.querySelector('.record-title').textContent.toLowerCase();
            const notes = record.querySelector('.record-notes').textContent.toLowerCase();
            
            if (title.includes(lowerQuery) || notes.includes(lowerQuery)) {
                record.style.display = 'flex';
            } else {
                record.style.display = 'none';
            }
        });
    },
    
    /**
     * Create sample notifications
     */
    createSampleNotifications: function() {
        this.notifications = [
            {
                id: 'notification_1',
                title: 'Welcome to MedSecure',
                message: 'Thank you for using our secure medical records platform.',
                icon: 'shield-alt',
                time: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
                read: false
            },
            {
                id: 'notification_2',
                title: 'Security Tip',
                message: 'Remember to enable two-factor authentication for extra security.',
                icon: 'lock',
                time: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
                read: false
            },
            {
                id: 'notification_3',
                title: 'New Feature Available',
                message: 'You can now share records with multiple providers at once.',
                icon: 'bell',
                time: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
                read: true
            }
        ];
        
        this.renderNotifications();
    },
    
    /**
     * Add a new notification
     * @param {Object} notification - Notification object
     */
    addNotification: function(notification) {
        this.notifications.unshift(notification);
        this.renderNotifications();
        this.updateNotificationBadge();
        
        // Show toast for new notification
        this.showToast('info', notification.title, notification.message);
    },
    
    /**
     * Render notifications in the dropdown
     */
    renderNotifications: function() {
        const notificationsList = document.getElementById('notifications-list');
        
        if (!notificationsList) return;
        
        if (this.notifications.length === 0) {
            notificationsList.innerHTML = '<li class="empty-notification">No notifications</li>';
            return;
        }
        
        let notificationsHTML = '';
        
        this.notifications.forEach(notification => {
            const timeAgo = this.getTimeAgo(notification.time);
            const readClass = notification.read ? '' : 'notification-unread';
            
            notificationsHTML += `
                <li class="notification-item ${readClass}" data-id="${notification.id}">
                    <div class="notification-icon">
                        <i class="fas fa-${notification.icon}"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">${notification.title}</div>
                        <div class="notification-message">${notification.message}</div>
                        <div class="notification-time">${timeAgo}</div>
                    </div>
                </li>
            `;
        });
        
        notificationsList.innerHTML = notificationsHTML;
        
        // Add click event to mark as read
        notificationsList.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent closing the menu
                const id = item.getAttribute('data-id');
                this.markNotificationRead(id);
                
                // Remove unread styling immediately for better UX
                item.classList.remove('notification-unread');
            });
        });
        
        // Update notification count badge
        this.updateNotificationBadge();
    },
    
    /**
     * Mark a notification as read
     * @param {string} id - Notification ID
     */
    markNotificationRead: function(id) {
        const notification = this.notifications.find(n => n.id === id);
        
        if (notification) {
            notification.read = true;
            this.renderNotifications();
            this.updateNotificationBadge();
        }
    },
    
    /**
     * Mark all notifications as read
     */
    markAllNotificationsRead: function() {
        this.notifications.forEach(notification => {
            notification.read = true;
        });
        
        this.renderNotifications();
        this.updateNotificationBadge();
        this.showToast('success', 'Notifications Cleared', 'All notifications marked as read.');
    },
    
    /**
     * Update notification badge count
     */
    updateNotificationBadge: function() {
        const badgeElement = document.getElementById('notification-count');
        if (!badgeElement) return;
        
        // Count unread notifications
        const unreadCount = this.notifications.filter(notification => !notification.read).length;
        
        // Update badge text
        badgeElement.textContent = unreadCount;
        
        // Show/hide badge based on count
        if (unreadCount > 0) {
            badgeElement.style.display = 'flex';
        } else {
            badgeElement.style.display = 'none';
        }
        
        // Update bell icon color to indicate unread notifications
        const bellIcon = document.querySelector('.notifications-btn i');
        if (bellIcon) {
            if (unreadCount > 0) {
                bellIcon.style.color = 'var(--primary-color)';
            } else {
                bellIcon.style.color = '';
            }
        }
    },
    
    /**
     * Get human-readable time ago
     * @param {Date} date - Date to format
     * @returns {string} Human-readable time ago
     */
    getTimeAgo: function(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        
        if (diffSec < 60) {
            return 'Just now';
        } else if (diffMin < 60) {
            return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
        } else if (diffHour < 24) {
            return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
        } else if (diffDay < 30) {
            return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString();
        }
    },
    
    /**
     * Show a toast notification
     * @param {string} type - Toast type (success, error, info, warning)
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     */
    showToast: function(type, title, message) {
        const toastContainer = document.getElementById('toast-container');
        
        if (!toastContainer) return;
        
        const icons = {
            success: 'check-circle',
            error: 'times-circle',
            info: 'info-circle',
            warning: 'exclamation-triangle'
        };
        
        const toastId = 'toast_' + Date.now();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.id = toastId;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas fa-${icons[type]}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        toastContainer.appendChild(toast);
        
        // Add close button functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            this.removeToast(toastId);
        });
        
        // Auto-remove after duration
        setTimeout(() => {
            this.removeToast(toastId);
        }, this.SETTINGS.TOAST_DURATION);
    },
    
    /**
     * Remove a toast notification
     * @param {string} id - Toast ID
     */
    removeToast: function(id) {
        const toast = document.getElementById(id);
        
        if (toast) {
            toast.classList.add('removing');
            
            // Remove after animation completes
            setTimeout(() => {
                toast.remove();
            }, 300);
        }
    },
    
    /**
     * Check system health
     */
    checkSystemHealth: function() {
        try {
            const health = {
                storageAvailable: this._checkStorageSpace(),
                browserCompatibility: this._checkBrowserCompatibility(),
                recordCount: DataStore.getRecords().length,
                userCount: DataStore.getUsers().length
            };
            
            // Check for storage warnings
            if (!health.storageAvailable) {
                console.warn('Low storage space available. Performance may be affected.');
                
                // Show warning if appropriate for role
                if (this.currentUser.role === 'admin') {
                    setTimeout(() => {
                        alert('Warning: Your browser is running low on storage space. Please consider clearing some data or exporting and clearing old records.');
                    }, 1000);
                }
            }
            
            // Check for high record count
            if (health.recordCount > this.SETTINGS.MAX_RECORD_COUNT_WARNING && this.currentUser.role === 'admin') {
                setTimeout(() => {
                    alert(`Warning: The system has ${health.recordCount} records, which may affect performance. Consider archiving older records.`);
                }, 1500);
            }
            
            return health;
        } catch (error) {
            console.error('Error checking system health:', error);
            return null;
        }
    },
    
    /**
     * Check for pending tasks
     */
    checkPendingTasks: function() {
        // In a real app, this would check for pending uploads, imports, etc.
    },
    
    /**
     * Check available storage space
     * @returns {boolean} Whether sufficient storage is available
     */
    _checkStorageSpace: function() {
        try {
            // Check if navigator.storage API is available
            if (navigator.storage && navigator.storage.estimate) {
                navigator.storage.estimate().then(estimate => {
                    const usedPercentage = (estimate.usage / estimate.quota) * 100;
                    if (usedPercentage > 80) {
                        console.warn(`Storage usage: ${usedPercentage.toFixed(2)}% of quota`);
                        return false;
                    }
                });
            }
            
            // Fallback for browsers without Storage API
            let testSize = 0;
            const testKey = 'storage_test';
            const testData = 'A'.repeat(1024 * 1024); // 1MB of data
            
            try {
                for (let i = 0; i < 5; i++) { // Try to store 5MB
                    localStorage.setItem(`${testKey}_${i}`, testData);
                    testSize += testData.length;
                }
                
                // Clean up
                for (let i = 0; i < 5; i++) {
                    localStorage.removeItem(`${testKey}_${i}`);
                }
                
                return true;
            } catch (e) {
                // Clean up any test data we managed to set
                for (let i = 0; i < 5; i++) {
                    try { localStorage.removeItem(`${testKey}_${i}`); } catch {}
                }
                
                return false;
            }
        } catch (error) {
            console.error('Error checking storage space:', error);
            return false;
        }
    },
    
    /**
     * Check browser compatibility
     * @returns {Object} Compatibility status
     */
    _checkBrowserCompatibility: function() {
        return {
            encryption: Encryption.isSupported(),
            storage: typeof Storage !== 'undefined',
            serviceWorker: 'serviceWorker' in navigator,
            indexedDB: 'indexedDB' in window
        };
    },
    
    /**
     * Handle application errors
     * @param {Error} error - The error object
     * @param {string} context - Error context
     */
    handleError: function(error, context) {
        try {
            // Log to console
            console.error(`Error in ${context}:`, error);
            
            // Log to audit log if we have a user
            if (this.currentUser) {
                this.logActivity('ERROR', {
                    context,
                    message: error.message,
                    stack: error.stack,
                    timestamp: new Date().toISOString()
                });
            }
            
            // If this is a critical error, show a message
            if (['app_init', 'navigation', 'storage_failure'].includes(context)) {
                alert(`An error occurred: ${error.message}\n\nPlease refresh the page and try again.`);
            }
        } catch (logError) {
            // Last resort - if we can't even log the error
            console.error('Failed to log error:', logError);
        }
    },
    
    /**
     * Check if browser supports required features
     * @returns {boolean} Whether the browser is supported
     */
    isSupported: function() {
        return (
            typeof Storage !== 'undefined' && // localStorage support
            Encryption.isSupported() && // Encryption support
            window.JSON && // JSON support
            window.Promise // Promise support
        );
    },
    
    /**
     * Initialize role-specific content
     * @param {string} role - User role
     */
    initRoleSpecificContent: function(role) {
        console.log(`Initializing content for role: ${role}`);
        
        // Hide all role-specific elements first
        document.querySelectorAll('.role-specific').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show elements specific to the user's role
        document.querySelectorAll(`.role-${role}`).forEach(el => {
            el.style.display = '';
        });
        
        // Update dashboard based on role
        const dashboardTitle = document.getElementById('dashboard-title');
        const dashboardSummary = document.getElementById('dashboard-summary');
        
        switch(role) {
            case 'doctor':
                if (dashboardTitle) dashboardTitle.textContent = 'Doctor Dashboard';
                this.createDoctorView();
                break;
            
            case 'patient':
                if (dashboardTitle) dashboardTitle.textContent = 'Patient Dashboard';
                this.createPatientView();
                break;
            
            case 'admin':
                if (dashboardTitle) dashboardTitle.textContent = 'Admin Dashboard';
                this.createAdminView();
                break;
            
            default:
                if (dashboardTitle) dashboardTitle.textContent = 'Dashboard';
                break;
        }
        
        // Update navigation menu based on role
        this.updateNavMenu(role);
    },
    
    /**
     * Create doctor-specific view
     */
    createDoctorView: function() {
        const content = document.getElementById('dashboard-content');
        if (!content) return;
        
        // Add doctor-specific widgets
        const patientListWidget = document.createElement('div');
        patientListWidget.className = 'dashboard-widget';
        patientListWidget.innerHTML = `
            <h3>My Patients</h3>
            <div class="patient-list">
                <p>You have 15 patients under your care</p>
                <button class="btn btn-sm btn-primary" id="view-patients-btn">View Patient List</button>
            </div>
        `;
        
        const appointmentsWidget = document.createElement('div');
        appointmentsWidget.className = 'dashboard-widget';
        appointmentsWidget.innerHTML = `
            <h3>Upcoming Appointments</h3>
            <div class="appointment-list">
                <p>You have 3 appointments scheduled today</p>
                <button class="btn btn-sm btn-primary" id="view-appointments-btn">View Schedule</button>
            </div>
        `;
        
        content.appendChild(patientListWidget);
        content.appendChild(appointmentsWidget);
        
        // Attach event listeners
        document.getElementById('view-patients-btn')?.addEventListener('click', () => {
            this.showToast('info', 'Patient List', 'This feature will be available soon');
        });
        
        document.getElementById('view-appointments-btn')?.addEventListener('click', () => {
            this.showToast('info', 'Appointments', 'This feature will be available soon');
        });
    },
    
    /**
     * Create patient-specific view
     */
    createPatientView: function() {
        const content = document.getElementById('dashboard-content');
        if (!content) return;
        
        // Add patient-specific widgets
        const doctorsWidget = document.createElement('div');
        doctorsWidget.className = 'dashboard-widget';
        doctorsWidget.innerHTML = `
            <h3>My Doctors</h3>
            <div class="doctors-list">
                <p>You have 3 healthcare providers</p>
                <button class="btn btn-sm btn-primary" id="view-doctors-btn">View Providers</button>
            </div>
        `;
        
        const medicationsWidget = document.createElement('div');
        medicationsWidget.className = 'dashboard-widget';
        medicationsWidget.innerHTML = `
            <h3>My Medications</h3>
            <div class="medications-list">
                <p>You have 2 active prescriptions</p>
                <button class="btn btn-sm btn-primary" id="view-medications-btn">View Medications</button>
            </div>
        `;
        
        content.appendChild(doctorsWidget);
        content.appendChild(medicationsWidget);
        
        // Attach event listeners
        document.getElementById('view-doctors-btn')?.addEventListener('click', () => {
            this.showToast('info', 'Healthcare Providers', 'This feature will be available soon');
        });
        
        document.getElementById('view-medications-btn')?.addEventListener('click', () => {
            this.showToast('info', 'Medications', 'This feature will be available soon');
        });
    },
    
    /**
     * Create admin-specific view
     */
    createAdminView: function() {
        const content = document.getElementById('dashboard-content');
        if (!content) return;
        
        // Add admin-specific widgets
        const usersWidget = document.createElement('div');
        usersWidget.className = 'dashboard-widget';
        usersWidget.innerHTML = `
            <h3>User Management</h3>
            <div class="users-stats">
                <p>Total Users: 145</p>
                <p>New this month: 12</p>
                <button class="btn btn-sm btn-primary" id="manage-users-btn">Manage Users</button>
            </div>
        `;
        
        const systemWidget = document.createElement('div');
        systemWidget.className = 'dashboard-widget';
        systemWidget.innerHTML = `
            <h3>System Health</h3>
            <div class="system-stats">
                <p>System Status: <span class="status-good">Good</span></p>
                <p>Last Backup: Yesterday at 11:00 PM</p>
                <button class="btn btn-sm btn-primary" id="system-settings-btn">System Settings</button>
            </div>
        `;
        
        content.appendChild(usersWidget);
        content.appendChild(systemWidget);
        
        // Attach event listeners
        document.getElementById('manage-users-btn')?.addEventListener('click', () => {
            this.showToast('info', 'User Management', 'This feature will be available soon');
        });
        
        document.getElementById('system-settings-btn')?.addEventListener('click', () => {
            this.showToast('info', 'System Settings', 'This feature will be available soon');
        });
    },
    
    /**
     * Update navigation menu based on user role
     * @param {string} role - User role
     */
    updateNavMenu: function(role) {
        // Add role-specific menu items
        const navMenu = document.querySelector('.nav-menu');
        if (!navMenu) return;
        
        // Clear existing custom menu items
        const customItems = document.querySelectorAll('.nav-item-custom');
        customItems.forEach(item => item.remove());
        
        // Add role-specific menu items
        switch(role) {
            case 'doctor':
                this.addNavMenuItem('Patients', 'fas fa-user-injured', 'patients', true);
                this.addNavMenuItem('Appointments', 'fas fa-calendar-alt', 'appointments', true);
                break;
        
            case 'patient':
                this.addNavMenuItem('My Doctors', 'fas fa-user-md', 'doctors', true);
                this.addNavMenuItem('Medications', 'fas fa-pills', 'medications', true);
                break;
            
            case 'admin':
                this.addNavMenuItem('User Management', 'fas fa-users-cog', 'users', true);
                this.addNavMenuItem('System Settings', 'fas fa-cogs', 'settings', true);
                this.addNavMenuItem('Backup & Restore', 'fas fa-database', 'backup', true);
                break;
        }
    },
    
    /**
     * Add a new item to the navigation menu
     * @param {string} text - Menu item text
     * @param {string} icon - Icon class
     * @param {string} target - Target section
     * @param {boolean} isCustom - Whether this is a custom menu item
     */
    addNavMenuItem: function(text, icon, target, isCustom = false) {
        const navMenu = document.querySelector('.nav-menu');
        if (!navMenu) return;
        
        const menuItem = document.createElement('li');
        menuItem.className = `nav-item ${isCustom ? 'nav-item-custom' : ''}`;
        menuItem.innerHTML = `<a href="#" data-target="${target}"><i class="${icon}"></i>${text}</a>`;
        
        menuItem.querySelector('a').addEventListener('click', (e) => {
            e.preventDefault();
            this.showToast('info', text, 'This feature will be available soon');
        });
        
        navMenu.appendChild(menuItem);
    },
    
    /**
     * Delete account
     */
    deleteAccount: function() {
        // Implementation of account deletion
    },
    
    /**
     * Prompt for data import
     */
    promptForImport: function() {
        // Implementation of data import prompt
    },
    
    /**
     * Download a medical record file
     * @param {string} recordId - Record ID to download
     * @param {string} fileName - Name for downloaded file
     */
    downloadRecord: function(recordId, fileName) {
        // Log the download
        console.log('Downloading record:', recordId);
        
        // Create a sample medical record file (in a real app, this would be fetched from the server)
        const record = {
            recordId: recordId,
            patientName: "Jane Doe",
            dateOfBirth: "1985-07-15",
            medicalRecordNumber: "MRN-" + recordId,
            dateCreated: new Date().toISOString(),
            provider: "MedClinic General Hospital",
            observations: [
                { date: "2023-05-10", description: "Annual physical examination", results: "Normal findings" },
                { date: "2023-03-22", description: "Blood pressure check", results: "120/80, within normal range" }
            ],
            medications: [
                { name: "Ibuprofen 400mg", dosage: "PRN for pain, not to exceed 3 tablets daily" }
            ],
            notes: "Patient is in good health. No significant concerns at this time."
        };
        
        // Convert to human-readable format
        const content = JSON.stringify(record, null, 2);
        
        // Create the file Blob
        const blob = new Blob([content], { type: 'application/json' });
        
        // Create download link and trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || `medical_record_${recordId}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        // Show success message
        this.showToast(`Record #${recordId} successfully downloaded`, 'success');
        
        // Add audit log entry
        this.addAuditLogEntry({
            timestamp: new Date(),
            action: 'download',
            recordId: recordId,
            recipient: 'self'
        });
    },
    
    /**
     * Share a medical record with another user
     * @param {string} recordId - Record ID to share
     * @param {string} recipient - Email or username of recipient
     * @param {string} permission - Level of access granted
     */
    shareRecord: function(recordId, recipient, permission) {
        // Log the share request
        console.log(`Sharing record ${recordId} with ${recipient}, permission: ${permission}`);
        
        // In a real app, this would make an API call to share the record
        
        // Show the sharing modal
        const modal = document.getElementById('shareSuccessModal') || this.createShareSuccessModal();
        
        // Update modal content
        const modalContent = modal.querySelector('.modal-content');
        modalContent.innerHTML = `
            <div class="modal-header">
                <h5>Record Shared Successfully</h5>
                <span class="close">&times;</span>
            </div>
            <div class="modal-body">
                <p><strong>Record #${recordId}</strong> has been shared with <strong>${recipient}</strong></p>
                <p>Permission level: ${permission}</p>
                <div class="alert alert-success">
                    <i class="fas fa-check-circle"></i> Share link created and delivered successfully.
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary close-modal">OK</button>
            </div>
        `;
        
        // Show the modal
        modal.style.display = 'block';
        
        // Add event listeners to close the modal
        modal.querySelectorAll('.close, .close-modal').forEach(el => {
            el.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        });
        
        // Add audit log entry
        this.addAuditLogEntry({
            timestamp: new Date(),
            action: 'share',
            recordId: recordId,
            recipient: recipient,
            permission: permission
        });
        
        // Show success message
        this.showToast(`Record shared with ${recipient}`, 'success');
    },
    
    /**
     * Create share success modal if it doesn't exist
     * @returns {HTMLElement} - The modal element
     */
    createShareSuccessModal: function() {
        const modal = document.createElement('div');
        modal.id = 'shareSuccessModal';
        modal.className = 'modal';
        modal.innerHTML = '<div class="modal-content"></div>';
        
        // Add modal styles if not already in CSS
        const style = document.createElement('style');
        style.textContent = `
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
            }
            .modal-content {
                background-color: #fff;
                margin: 10% auto;
                padding: 0;
                border-radius: 5px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                width: 50%;
                max-width: 500px;
                animation: modalFadeIn 0.3s;
            }
            .modal-header {
                padding: 15px;
                border-bottom: 1px solid #e9ecef;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .modal-body {
                padding: 15px;
            }
            .modal-footer {
                padding: 15px;
                border-top: 1px solid #e9ecef;
                text-align: right;
            }
            .close {
                color: #aaa;
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
            }
            .close:hover {
                color: #555;
            }
            @keyframes modalFadeIn {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(modal);
        
        return modal;
    },
    
    /**
     * Bind share button events
     */
    bindShareEvents: function() {
        // Find all share buttons
        document.querySelectorAll('.share-record-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const recordId = btn.getAttribute('data-record-id') || 'unknown';
                this.showSharingModal(recordId);
            });
        });
    },
    
    /**
     * Add audit log entry
     * @param {Object} entry - Audit log entry object
     */
    addAuditLogEntry: function(entry) {
        // In a real app, this would be sent to the server
        console.log('Adding audit log entry:', entry);
        
        // For demo, add to the audit log table if it exists
        const logTable = document.querySelector('.audit-log-table tbody');
        if (logTable) {
            const row = document.createElement('tr');
            
            // Format timestamp
            const timestamp = new Date(entry.timestamp);
            const formattedDate = timestamp.toLocaleDateString();
            const formattedTime = timestamp.toLocaleTimeString();
            
            // Create row content
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${formattedTime}</td>
                <td>${entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}</td>
                <td>Record #${entry.recordId}</td>
                <td>${entry.recipient || 'N/A'}</td>
            `;
            
            // Add to beginning of table
            if (logTable.firstChild) {
                logTable.insertBefore(row, logTable.firstChild);
            } else {
                logTable.appendChild(row);
            }
        }
    },
    
    /**
     * Create role selector for demo purposes
     */
    createRoleSelector: function() {
        const header = document.querySelector('header');
        if (!header) return;
        
        const roleSelector = document.createElement('div');
        roleSelector.className = 'role-selector';
        roleSelector.innerHTML = `
            <label>Demo Role:</label>
            <select id="role-select">
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
                <option value="admin">Admin</option>
            </select>
        `;
        
        header.appendChild(roleSelector);
        
        // Add change event
        document.getElementById('role-select').addEventListener('change', (e) => {
            this.setUserRole(e.target.value);
        });
    },
    
    /**
     * Setup event listeners for the application
     */
    setupEventListeners: function() {
        // Role switcher for demo purposes
        document.querySelectorAll('.role-switch-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const role = e.target.dataset.role;
                if (role) {
                    this.setUserRole(role);
                }
            });
        });
        
        // Other event listeners...
    }
}; 