/**
 * Records module for MedSecure
 * 
 * Handles medical record creation, viewing, and sharing.
 */

const Records = {
    /**
     * Initialize the records module
     * @param {Object} user - The current user
     */
    init: function(user) {
        console.log('Records module initialized');
        this.currentUser = user;
        this.records = [];
        this.sharedRecords = [];
        
        // Sample prescription images as fallback
        this.prescriptionImages = {
            'file_1': 'https://via.placeholder.com/800x1000/e2f3f5/333333?text=Annual+Physical+Results',
            'file_2': 'https://via.placeholder.com/800x1000/f8f3d4/333333?text=Blood+Test+Results',
            'file_3': 'https://via.placeholder.com/800x1000/ffcfdf/333333?text=COVID-19+Vaccination+Record',
        };
        
        // Try to load prescription images from localStorage
        try {
            const savedImages = localStorage.getItem('prescription_images');
            if (savedImages) {
                const parsedImages = JSON.parse(savedImages);
                if (parsedImages && typeof parsedImages === 'object') {
                    // Merge with the default images (prioritizing saved ones)
                    this.prescriptionImages = { ...this.prescriptionImages, ...parsedImages };
                    console.log('Loaded prescription images from localStorage');
                }
            }
        } catch (e) {
            console.error('Error loading prescription images from localStorage:', e);
        }
        
        // Load records
        this.loadUserRecords();
        this.loadSharedRecords();
        
        // Update dashboard counts
        this.updateDashboardCounts();
        
        // Bind events
        this.bindEvents();
        
        // Initialize sharing view when it's selected
        document.addEventListener('click', (e) => {
            const navLink = e.target.closest('.nav-link');
            if (navLink && navLink.getAttribute('data-view') === 'share') {
                // Load sharable records when the share view is activated
                setTimeout(() => this.loadSharableRecords(), 100);
            }
        });
        
        // Also load sharable records on init if we're already on the share view
        if (document.getElementById('share-view').classList.contains('active')) {
            this.loadSharableRecords();
        }
    },
    
    /**
     * Bind event listeners for record functionality
     */
    bindEvents: function() {
        console.log('Binding records events');
        
        // Upload record button
        const uploadRecordBtns = document.querySelectorAll('#upload-record-btn, #upload-record-empty-btn, #quick-upload-records-btn, #quick-upload');
        uploadRecordBtns.forEach(btn => {
            if (btn) {
                // Remove any existing click listeners to prevent duplicates
                btn.removeEventListener('click', this.showUploadModal.bind(this));
                // Add click listener with explicit binding to this
                btn.addEventListener('click', () => {
                    console.log('Upload button clicked');
                    this.showUploadModal();
                });
            }
        });
        
        // Dashboard quick actions
        const quickUploadBtn = document.getElementById('quick-upload');
        if (quickUploadBtn) {
            quickUploadBtn.addEventListener('click', () => {
                console.log('Quick upload button clicked');
                this.showUploadModal();
            });
        }
        
        // Close modal buttons
        const closeButtons = document.querySelectorAll('.modal .close');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                    modal.classList.remove('active');
                }
            });
        });
        
        // Close modal on outside click
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                    modal.classList.remove('active');
                }
            });
        });
        
        // Upload form submission
        const uploadForm = document.getElementById('upload-form');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRecordUpload();
            });
        }
        
        // Add file input preview functionality
        const fileInput = document.getElementById('record-file');
        if (fileInput) {
            this.setupFilePreview(fileInput);
        }
        
        // Share form submission
        const shareForm = document.getElementById('share-form');
        if (shareForm) {
            shareForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRecordShare();
            });
        }
        
        // Dashboard shortcuts
        const viewRecordsBtn = document.querySelector('[data-action="view-records"]');
        if (viewRecordsBtn) {
            viewRecordsBtn.addEventListener('click', () => {
                App.navigateTo('records');
            });
        }
        
        const viewSharedBtn = document.querySelector('[data-action="view-shared"]');
        if (viewSharedBtn) {
            viewSharedBtn.addEventListener('click', () => {
                App.navigateTo('share');
            });
        }
        
        // Add prescription modal close functionality
        document.addEventListener('click', (e) => {
            const modal = document.querySelector('.prescription-modal');
            if (modal && (e.target === modal || e.target.classList.contains('close-prescription-modal'))) {
                modal.classList.remove('active');
            }
        });
    },
    
    /**
     * Show the upload modal
     */
    showUploadModal: function() {
        console.log('Showing upload modal');
        
        const uploadModal = document.getElementById('upload-modal');
        if (uploadModal) {
            // Properly show the modal with a display style
            uploadModal.style.display = 'block';
            uploadModal.classList.add('active');
            
            // Make sure form is reset
            const uploadForm = document.getElementById('upload-form');
            if (uploadForm) {
                uploadForm.reset();
            }
            
            // Clear any previous file preview
            const previewContainer = document.querySelector('.file-preview');
            if (previewContainer) {
                previewContainer.style.display = 'none';
                const previewContainerInner = previewContainer.querySelector('.preview-container');
                if (previewContainerInner) {
                    previewContainerInner.innerHTML = '';
                }
            }
            
            // Focus on the first input field
            setTimeout(() => {
                const titleInput = document.getElementById('record-title');
                if (titleInput) {
                    titleInput.focus();
                }
            }, 100);
        } else {
            console.error('Upload modal not found in the DOM');
        }
    },
    
    /**
     * Handle record upload form submission
     */
    handleRecordUpload: function() {
        const titleInput = document.getElementById('record-title');
        const typeInput = document.getElementById('record-type');
        const dateInput = document.getElementById('record-date');
        const fileInput = document.getElementById('record-file');
        const notesInput = document.getElementById('record-notes');
        
        const title = titleInput.value.trim();
        const type = typeInput.value;
        const date = dateInput.value;
        const notes = notesInput.value.trim();
        
        // Validate inputs
        if (!title || !date) {
            App.showToast('error', 'Missing Information', 'Please fill in all required fields');
            return;
        }
        
        // Disable the submit button to prevent double submission
        const submitBtn = document.querySelector('#upload-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Uploading...';
        }
        
        // Validate user is logged in
        if (!this.currentUser) {
            console.error('No user is logged in when attempting to upload record');
            App.showToast('error', 'Authentication Error', 'You must be logged in to upload records');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Upload Record';
            }
            return;
        }
        
        // Generate record ID and file ID
        const fileId = 'file_' + Date.now();
        const recordId = 'record_' + Date.now();
        const userId = this.currentUser.id;
        
        // Validate userId exists
        if (!userId) {
            console.error('User ID is missing from currentUser object', this.currentUser);
            App.showToast('error', 'Authentication Error', 'User information is incomplete, please log in again');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Upload Record';
            }
            return;
        }
        
        const userRole = this.currentUser.role || 'patient';
        
        // Create record object with important metadata
        const record = {
            id: recordId,
            userId: userId,
            title: title,
            type: type,
            date: date,
            notes: notes,
            fileId: fileId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString() // Add this for version control
        };
        
        console.log('Created record object:', record);
        
        // Get file data if available
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            
            // Check file size
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                App.showToast('error', 'File Too Large', 'The maximum file size is 10MB.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Upload Record';
                }
                return;
            }
            
            // Check file type
            const fileType = file.type.toLowerCase();
            const fileName = file.name.toLowerCase();
            const isImage = fileType.startsWith('image/');
            const isPDF = fileType === 'application/pdf' || fileName.endsWith('.pdf');
            const isDoc = fileType.includes('word') || fileName.endsWith('.doc') || fileName.endsWith('.docx');
            
            if (!isImage && !isPDF && !isDoc) {
                App.showToast('error', 'Invalid File Type', 'Please upload an image, PDF, or document file.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Upload Record';
                }
                return;
            }
            
            // Add file metadata to record
            record.fileMetadata = {
                name: file.name,
                type: file.type,
                size: file.size,
                isImage: isImage,
                isPDF: isPDF,
                isDoc: isDoc,
                lastModified: file.lastModified
            };
            
            // Always use FileReader for local storage
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const fileUrl = e.target.result;
                    
                    // Ensure we have a valid file URL
                    if (!fileUrl || typeof fileUrl !== 'string') {
                        throw new Error('Invalid file data received');
                    }
                    
                    console.log(`File read successfully. Size: ${Math.round(fileUrl.length / 1024)}KB, Type: ${file.type}`);
                    
                    // Initialize prescriptionImages if needed
                    if (!this.prescriptionImages) {
                        this.prescriptionImages = {};
                    }
                    
                    // Store the image URL in our local storage
                    this.prescriptionImages[fileId] = fileUrl;
                    record.fileUrl = fileUrl; // For compatibility
                    
                    // Also store the MIME type explicitly to help with displaying
                    if (file.type) {
                        if (!record.fileMetadata) {
                            record.fileMetadata = {};
                        }
                        record.fileMetadata.type = file.type;
                        record.fileMetadata.isImage = file.type.startsWith('image/');
                        record.fileMetadata.isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                    }
                    
                    // Save prescriptionImages to localStorage for later retrieval
                    try {
                        localStorage.setItem('prescription_images', JSON.stringify(this.prescriptionImages));
                        console.log(`Image info saved to localStorage for fileId: ${fileId}`);
                    } catch (storageError) {
                        console.error('LocalStorage error when saving image:', storageError);
                        
                        // If localStorage is full, let's try to clear old images
                        if (storageError.name === 'QuotaExceededError') {
                            this.cleanupOldImages();
                            // Try again after cleanup
                            localStorage.setItem('prescription_images', JSON.stringify(this.prescriptionImages));
                        }
                    }
                    
                    // Process the record
                    this.finishRecordUpload(record);
                } catch (error) {
                    console.error('Error processing file:', error);
                    App.showToast('error', 'Upload Failed', 'There was an error processing your file.');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Upload Record';
                    }
                }
            };
            
            reader.onerror = () => {
                App.showToast('error', 'File Error', 'Failed to read the selected file.');
                console.error('FileReader error:', reader.error);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Upload Record';
                }
            };
            
            // Start reading the file
            try {
                console.log('Reading file as data URL...');
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('Error reading file:', error);
                App.showToast('error', 'Upload Failed', 'There was an error reading your file.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Upload Record';
                }
            }
        } else {
            // No file, create a placeholder
            App.showToast('info', 'No File Attached', 'Creating a record without a file attachment.');
            
            // Generate placeholder image URL
            const fileUrl = `https://via.placeholder.com/800x1000/${this.getRandomColor()}/333333?text=${encodeURIComponent(title)}`;
            
            // Add file metadata to record
            record.fileMetadata = {
                name: 'placeholder.png',
                type: 'image/png',
                size: 0,
                isImage: true,
                isPlaceholder: true
            };
            record.fileUrl = fileUrl;
            
            // Store the placeholder in our local image lookup
            if (!this.prescriptionImages) {
                this.prescriptionImages = {};
            }
            this.prescriptionImages[fileId] = fileUrl;
            
            // Save prescriptionImages to localStorage
            localStorage.setItem('prescription_images', JSON.stringify(this.prescriptionImages));
            
            // Process the record
            this.finishRecordUpload(record);
        }
    },
    
    /**
     * Clean up old images from localStorage when approaching quota
     */
    cleanupOldImages: function() {
        try {
            if (!this.prescriptionImages) return;
            
            // Get all keys and timestamps
            const keys = Object.keys(this.prescriptionImages);
            if (keys.length <= 5) return; // Keep at least 5 recent images
            
            // Sort keys by timestamp (assuming fileId contains timestamp)
            const sortedKeys = keys.sort((a, b) => {
                const timestampA = parseInt(a.split('_')[1] || '0');
                const timestampB = parseInt(b.split('_')[1] || '0');
                return timestampB - timestampA; // Newest first
            });
            
            // Keep only the 5 most recent entries
            const keysToKeep = sortedKeys.slice(0, 5);
            const newPrescriptionImages = {};
            
            // Copy only the keys we want to keep
            keysToKeep.forEach(key => {
                newPrescriptionImages[key] = this.prescriptionImages[key];
            });
            
            // Replace the old object
            this.prescriptionImages = newPrescriptionImages;
            console.log(`Cleaned up prescription images. Kept ${keysToKeep.length} of ${keys.length}`);
        } catch (error) {
            console.error('Error cleaning up old images:', error);
        }
    },
    
    /**
     * Generate a random hex color
     * @returns {string} - Random hex color without the # prefix
     */
    getRandomColor: function() {
        // Define pastel-friendly colors for medical records
        const colors = [
            'e6f7ff', // light blue
            'e6ffe6', // light green
            'fff2e6', // light orange
            'f7e6ff', // light purple
            'ffe6e6', // light red
            'e6fffa', // light teal
            'fffae6'  // light yellow
        ];
        
        return colors[Math.floor(Math.random() * colors.length)];
    },
    
    /**
     * Finish record upload with file URL
     * @param {Object} record - Record object with all data
     * @param {string} userRole - Optional user role for collection access
     */
    finishRecordUpload: async function(record, userRole) {
        try {
            const role = userRole || (this.currentUser && this.currentUser.role) || 'patient';
            
            // Initialize prescriptionImages if it doesn't exist
            if (!this.prescriptionImages) {
                this.prescriptionImages = {};
            }
            
            // Store the image URL in our local lookup for displaying
            if (record.fileUrl) {
                console.log(`Storing file URL for fileId: ${record.fileId}`);
                this.prescriptionImages[record.fileId] = record.fileUrl;
                
                // For local storage, also save the prescriptionImages object 
                // so we can retrieve file URLs later
                try {
                    localStorage.setItem('prescription_images', JSON.stringify(this.prescriptionImages));
                    console.log('Saved prescription images to localStorage');
                } catch (storageError) {
                    console.error('Error saving to localStorage:', storageError);
                }
            } else {
                console.warn('No fileUrl in record:', record);
            }
            
            // Save record using DataStore method
            console.log('Saving record:', record);
            let saved = await DataStore.saveRecord(record, role);
            
            // If using local storage and record wasn't saved correctly, try again with a direct approach
            if (!saved) {
                console.log('First save attempt failed, trying direct localStorage approach');
                try {
                    // Get existing records from localStorage
                    const records = JSON.parse(localStorage.getItem(DataStore.KEYS.RECORDS)) || [];
                    
                    // Check for duplicates
                    const isDuplicate = records.some(r => 
                        r.userId === record.userId && 
                        r.title === record.title && 
                        r.type === record.type && 
                        r.date === record.date
                    );
                    
                    if (!isDuplicate) {
                        // Add new record
                        records.push(record);
                        localStorage.setItem(DataStore.KEYS.RECORDS, JSON.stringify(records));
                        saved = true;
                        console.log('Record saved successfully via direct localStorage access');
                    } else {
                        console.warn('Duplicate record detected, not saving');
                    }
                } catch (localStorageError) {
                    console.error('Direct localStorage save failed:', localStorageError);
                }
            }
            
            // If saved successfully, log the event
            if (saved) {
                // Log upload event
                const auditEntry = {
                    id: 'audit_' + Date.now(),
                    userId: record.userId,
                    eventType: 'UPLOAD',
                    timestamp: new Date().toISOString(),
                    status: 'SUCCESS',
                    data: {
                        recordId: record.id,
                        recordType: record.type,
                        fileType: record.fileMetadata ? record.fileMetadata.type : 'unknown'
                    }
                };
                
                // Add audit log entry
                await DataStore.addAuditLog(auditEntry);
                
                // Close modal first before refreshing the view
                const modal = document.getElementById('upload-modal');
                if (modal) {
                    modal.style.display = 'none';
                    modal.classList.remove('active');
                }
                
                // Make sure the DataStore has the latest data
                DataStore.loadFromLocalStorage();
                
                // Force a refresh of user records - pass true to indicate this is coming from a new upload
                console.log('Refreshing records display after successful upload');
                this.loadUserRecords(true);
                
                // Update dashboard counts
                this.updateDashboardCounts();
                
                // Show success message
                App.showToast('success', 'Record Uploaded', 'Your medical record has been successfully uploaded.');
                
                // Ensure we're in the records view - this is safer than navigating
                // because it won't create a new history entry if we're already there
                const recordsView = document.getElementById('records-view');
                if (recordsView && 
                    !recordsView.classList.contains('active')) {
                    App.navigateTo('records');
                }
            } else {
                // Show error for duplicate
                App.showToast('warning', 'Duplicate Record', 'This appears to be a duplicate record.');
            }
            
            // Reset form regardless of success
            const uploadForm = document.getElementById('upload-form');
            if (uploadForm) {
                uploadForm.reset();
                
                // Re-enable submit button
                const submitBtn = uploadForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Upload Record';
                }
            }
            
            // Reset file preview
            const previewContainer = document.querySelector('.file-preview');
            if (previewContainer) {
                previewContainer.style.display = 'none';
                const previewElement = previewContainer.querySelector('.preview-container');
                if (previewElement) {
                    previewElement.innerHTML = '';
                }
            }
        } catch (error) {
            console.error('Error in finishRecordUpload:', error);
            App.showToast('error', 'Upload Failed', 'There was an error saving your record.');
            
            // Re-enable submit button
            const submitBtn = document.querySelector('#upload-form button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Upload Record';
            }
        }
    },
    
    /**
     * View a record
     * @param {string} recordId - ID of the record to view
     */
    viewRecord: async function(recordId) {
        try {
            if (!recordId) {
                console.error('No record ID provided');
                return;
            }
            
            console.log(`Viewing record with ID: ${recordId}`);
            
            // Get records from DataStore
            const records = await DataStore.getRecords();
            const record = records.find(r => r.id === recordId);
            
            if (!record) {
                console.error(`Record not found with ID: ${recordId}`);
                App.showToast('error', 'Record Not Found', 'The requested record was not found.');
                return;
            }
            
            // Set current record
            this.currentRecord = record;
            console.log('Found record:', record);
            
            // Get modal elements
            const modal = document.getElementById('record-modal');
            if (!modal) {
                console.error('Record modal not found in the DOM');
                App.showToast('error', 'View Error', 'Could not open the record viewer.');
                return;
            }
            
            const titleEl = modal.querySelector('.record-title');
            const dateEl = modal.querySelector('.record-date');
            const typeEl = modal.querySelector('.record-type');
            const notesEl = modal.querySelector('.record-notes');
            const imageContainer = modal.querySelector('.record-image-container');
            
            if (!titleEl || !dateEl || !typeEl || !notesEl || !imageContainer) {
                console.error('One or more required modal elements not found');
                App.showToast('error', 'View Error', 'Could not display record details.');
                return;
            }
            
            // Set record details
            titleEl.textContent = record.title || 'Untitled Record';
            dateEl.textContent = this.formatDate(record.date);
            typeEl.textContent = record.type || 'Other';
            notesEl.textContent = record.notes || 'No notes provided.';
            
            // Load image
            imageContainer.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i></div>';
            
            // Use Firebase URL directly, or local URL from prescriptionImages
            let fileUrl = null;
            
            // First try to get URL directly from the record
            if (record.fileUrl && typeof record.fileUrl === 'string') {
                fileUrl = record.fileUrl;
                console.log('Using fileUrl from record object');
            } 
            // Next try our in-memory cache
            else if (record.fileId && this.prescriptionImages && this.prescriptionImages[record.fileId]) {
                fileUrl = this.prescriptionImages[record.fileId];
                console.log('Using fileUrl from prescriptionImages cache');
            }
            // Finally try localStorage
            else if (record.fileId) {
                try {
                    const storedImages = localStorage.getItem('prescription_images');
                    if (storedImages) {
                        const parsedImages = JSON.parse(storedImages);
                        if (parsedImages && parsedImages[record.fileId]) {
                            fileUrl = parsedImages[record.fileId];
                            console.log('Using fileUrl from localStorage');
                            
                            // Update our in-memory cache
                            if (!this.prescriptionImages) {
                                this.prescriptionImages = {};
                            }
                            this.prescriptionImages[record.fileId] = fileUrl;
                        }
                    }
                } catch (e) {
                    console.warn('Error getting file URL from localStorage:', e);
                }
            }
            
            console.log('File URL found:', fileUrl ? 'Yes' : 'No');
            
            if (fileUrl) {
                // If we have the file metadata, check if it's an image
                const isImage = record.fileMetadata && record.fileMetadata.isImage;
                const isPDF = record.fileMetadata && 
                             (record.fileMetadata.type === 'application/pdf' || 
                              record.fileMetadata.name && record.fileMetadata.name.toLowerCase().endsWith('.pdf'));
                
                // Create appropriate element based on file type
                if (isImage || fileUrl.startsWith('data:image/') || fileUrl.includes('placeholder.com')) {
                    imageContainer.innerHTML = `<img src="${fileUrl}" alt="${record.title}" class="record-image" onerror="this.src='https://via.placeholder.com/800x1000/e2f3f5/333333?text=Image+Error'">`;
                } else if (isPDF || fileUrl.startsWith('data:application/pdf')) {
                    // For PDFs, provide a frame or link
                    if (fileUrl.startsWith('data:')) {
                        // Base64 encoded PDF - use an embed/iframe
                        imageContainer.innerHTML = `
                            <div class="pdf-container">
                                <embed src="${fileUrl}" type="application/pdf" width="100%" height="500px" />
                            </div>
                        `;
                    } else {
                        // URL based PDF - provide a link and iframe when possible
                        imageContainer.innerHTML = `
                            <div class="pdf-container">
                                <a href="${fileUrl}" target="_blank" class="pdf-link">
                                    <i class="fas fa-file-pdf"></i> Open PDF
                                </a>
                                <iframe src="${fileUrl}" frameborder="0" width="100%" height="500px"></iframe>
                            </div>
                        `;
                    }
                } else {
                    // For other document types, provide a download link
                    const fileName = record.fileMetadata ? record.fileMetadata.name : 'document';
                    imageContainer.innerHTML = `
                        <div class="document-container">
                            <a href="${fileUrl}" target="_blank" download="${fileName}" class="document-link">
                                <i class="fas fa-file-alt"></i>
                                <span>Download ${fileName}</span>
                            </a>
                            <div class="document-preview">
                                <i class="fas fa-file-alt document-icon"></i>
                                <p class="document-name">${fileName}</p>
                            </div>
                        </div>
                    `;
                }
            } else {
                imageContainer.innerHTML = '<div class="error-message">Image not available</div>';
            }
            
            // Set up the download button
            const downloadBtn = modal.querySelector('#download-record');
            if (downloadBtn) {
                // Remove existing listeners to prevent duplicates
                const newDownloadBtn = downloadBtn.cloneNode(true);
                downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
                
                newDownloadBtn.addEventListener('click', () => {
                    if (fileUrl) {
                        const a = document.createElement('a');
                        a.href = fileUrl;
                        a.download = record.fileMetadata && record.fileMetadata.name ? 
                            record.fileMetadata.name : `${record.title.replace(/\s+/g, '_')}.${fileUrl.startsWith('data:image/') ? 'png' : 'pdf'}`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    } else {
                        App.showToast('error', 'Download Failed', 'File not available for download.');
                    }
                });
            }
            
            // Set up the share button
            const shareBtn = modal.querySelector('#share-record-btn');
            if (shareBtn) {
                // Remove existing listeners to prevent duplicates
                const newShareBtn = shareBtn.cloneNode(true);
                shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);
                
                newShareBtn.addEventListener('click', () => {
                    // Close the modal first
                    modal.style.display = 'none';
                    // Prepare the record for sharing
                    this.prepareRecordForSharing(recordId);
                });
            }
            
            // Setup close button
            const closeBtn = modal.querySelector('.close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }
            
            // Close on click outside
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
            
            // Show modal
            modal.style.display = 'block';
            
            // Log view event
            if (typeof DataStore !== 'undefined' && this.currentUser && this.currentUser.id) {
                const auditEntry = {
                    id: 'audit_' + Date.now(),
                    userId: this.currentUser.id,
                    eventType: 'VIEW',
                    timestamp: new Date().toISOString(),
                    status: 'SUCCESS',
                    data: {
                        recordId: record.id,
                        recordType: record.type
                    }
                };
                
                // Add audit log entry
                try {
                    await DataStore.addAuditLog(auditEntry);
                    console.log('View event logged');
                } catch (logError) {
                    console.warn('Could not log view event:', logError);
                }
            }
        } catch (error) {
            console.error('Error viewing record:', error);
            App.showToast('error', 'View Error', 'There was an error displaying the record.');
        }
    },
    
    /**
     * Load records shared with the current user
     */
    loadSharedRecords: function() {
        // For demo purposes, we'll just simulate this
        const sharedCount = document.getElementById('shared-count');
        if (sharedCount) {
            sharedCount.textContent = '2';
        }
    },
    
    /**
     * Update dashboard counts
     */
    updateDashboardCounts: function() {
        console.log('Updating dashboard counts');
        
        try {
            // Get all records
            const allRecords = DataStore.getRecords() || [];
            
            // Filter records for current user
            const userRecords = allRecords.filter(record => record.userId === this.currentUser.id);
            
            // Update record count display
            const recordsCount = document.getElementById('records-count');
            if (recordsCount) {
                recordsCount.textContent = userRecords.length.toString();
            }
        } catch (error) {
            console.error('Error updating dashboard counts:', error);
        }
    },
    
    /**
     * Create a record card element
     * @param {Object} record - Record data
     * @returns {HTMLElement} - The created record card
     */
    createRecordCard: function(record) {
        console.log('Creating record card for:', record.id, record.title);
        
        // Create card element
        const card = document.createElement('div');
        card.className = 'record-card';
        
        // Set both data-record-id and data-id attributes for compatibility
        card.dataset.recordId = record.id;
        card.dataset.id = record.id; // Add this for backwards compatibility
        
        // Format date for display
        let displayDate;
        try {
            const dateObj = new Date(record.date);
            displayDate = dateObj.toLocaleDateString();
        } catch (e) {
            displayDate = record.date || 'Unknown date';
        }
        
        // Determine file URL
        let fileUrl = '';
        
        // First try to get the file URL directly from the record
        if (record.fileUrl && typeof record.fileUrl === 'string') {
            console.log(`Using fileUrl directly from record: ${record.id}`);
            fileUrl = record.fileUrl;
        } 
        // Then check our in-memory prescriptionImages cache
        else if (record.fileId && this.prescriptionImages) {
            fileUrl = this.prescriptionImages[record.fileId];
            if (fileUrl) {
                console.log(`Found image in memory cache for: ${record.fileId}`);
            }
        }
        
        // If no URL yet, try to load from localStorage
        if (!fileUrl && record.fileId) {
            try {
                console.log(`Looking for file in localStorage for: ${record.fileId}`);
                const storedImages = localStorage.getItem('prescription_images');
                if (storedImages) {
                    const parsedImages = JSON.parse(storedImages);
                    if (parsedImages && parsedImages[record.fileId]) {
                        fileUrl = parsedImages[record.fileId];
                        console.log(`Found image in localStorage for: ${record.fileId}`);
                        
                        // Update our memory cache
                        if (!this.prescriptionImages) this.prescriptionImages = {};
                        this.prescriptionImages[record.fileId] = fileUrl;
                    }
                }
            } catch (e) {
                console.warn('Error getting file URL from localStorage:', e);
            }
        }
        
        // If still no URL, use placeholder
        if (!fileUrl) {
            console.log(`Using placeholder image for: ${record.id}`);
            fileUrl = `https://via.placeholder.com/800x1000/${this.getRandomColor()}/333333?text=${encodeURIComponent(record.title)}`;
        }
        
        // Log the final URL for debugging
        console.log(`Final fileUrl for ${record.id}: ${fileUrl.substring(0, 50)}...`);
        
        // Determine if it's an image type
        const isImage = (record.fileMetadata && record.fileMetadata.isImage) || 
                        (fileUrl && (fileUrl.startsWith('data:image/') || 
                                    fileUrl.includes('placeholder.com')));
        
        // Determine if it's a PDF
        const isPDF = (record.fileMetadata && record.fileMetadata.isPDF) || 
                     (fileUrl && fileUrl.startsWith('data:application/pdf'));
        
        // Create card content
        let imageHTML = '';
        
        if (fileUrl) {
            if (isImage) {
                imageHTML = `<div class="record-image"><img src="${fileUrl}" alt="${record.title}" onerror="this.src='https://via.placeholder.com/800x1000/e2f3f5/333333?text=Image+Error'" /></div>`;
            } else if (isPDF) {
                imageHTML = `
                    <div class="record-file pdf-file">
                        <i class="fas fa-file-pdf"></i>
                        <span>PDF Document</span>
                    </div>
                `;
            } else {
                imageHTML = `
                    <div class="record-file document-file">
                        <i class="fas fa-file-alt"></i>
                        <span>Document</span>
                    </div>
                `;
            }
        } else {
            imageHTML = `
                <div class="record-file no-file">
                    <i class="fas fa-file-medical-alt"></i>
                    <span>No file attached</span>
                </div>
            `;
        }
        
        // Generate HTML content for the card
        card.innerHTML = `
            ${imageHTML}
            <div class="record-info">
                <h3 class="record-title">${record.title}</h3>
                <div class="record-details">
                    <span class="record-type">${record.type}</span>
                    <span class="record-date">${displayDate}</span>
                </div>
                ${record.notes ? `<p class="record-notes">${record.notes}</p>` : ''}
            </div>
            <div class="record-actions">
                <button class="btn icon-btn view-record" title="View record">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn icon-btn share-record" title="Share record">
                    <i class="fas fa-share-alt"></i>
                </button>
                <button class="btn icon-btn delete-record" title="Delete record">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        // Add event listeners to buttons
        const viewBtn = card.querySelector('.view-record');
        if (viewBtn) {
            viewBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.viewRecord(record.id);
            });
        }
        
        const shareBtn = card.querySelector('.share-record');
        if (shareBtn) {
            shareBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.shareRecord(record.id);
            });
        }
        
        const deleteBtn = card.querySelector('.delete-record');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.confirmDeleteRecord(record.id);
            });
        }
        
        // Add click event to the whole card for viewing
        card.addEventListener('click', (event) => {
            // Only trigger if the click wasn't on a button
            if (!event.target.closest('.btn')) {
                this.viewRecord(record.id);
            }
        });
        
        return card;
    },
    
    /**
     * Get CSS class for record type
     * @param {string} type - Record type
     * @returns {string} CSS class corresponding to the record type
     */
    getRecordTypeClass: function(type) {
        return type || 'other';
    },
    
    /**
     * Get display name for record type
     * @param {string} type - Record type
     * @returns {string} Formatted name for display
     */
    getRecordTypeName: function(type) {
        const types = {
            'lab': 'Lab Results',
            'prescription': 'Prescription',
            'imaging': 'Imaging',
            'clinical': 'Clinical Notes',
            'other': 'Other'
        };
        return types[type] || 'Other';
    },
    
    /**
     * Get type label for display
     * @param {string} type - Record type
     * @returns {string} Formatted type label
     */
    getTypeLabel: function(type) {
        return this.getRecordTypeName(type);
    },
    
    /**
     * Attach event listeners to record cards
     */
    attachRecordCardEvents: function() {
        const recordCards = document.querySelectorAll('.record-card');
        
        recordCards.forEach(card => {
            const recordId = card.getAttribute('data-id');
            
            const viewBtn = card.querySelector('.view-record');
            viewBtn.addEventListener('click', () => {
                this.viewRecord(recordId);
            });
            
            const shareBtn = card.querySelector('.share-record');
            shareBtn.addEventListener('click', () => {
                this.prepareRecordForSharing(recordId);
            });
        });
    },
    
    /**
     * Setup file upload preview
     * @param {HTMLElement} fileInput - File input element
     */
    setupFilePreview: function(fileInput) {
        const previewContainer = document.querySelector('.file-preview');
        const previewElement = document.querySelector('.preview-container');
        const uploadContainer = document.querySelector('.file-upload-container');
        
        if (!previewContainer || !previewElement) {
            console.error('File preview containers not found');
            return;
        }
        
        // Handle file change event
        fileInput.addEventListener('change', function(e) {
            try {
                // Get the selected file
                const file = this.files[0];
                
                if (!file) {
                    previewContainer.style.display = 'none';
                    previewElement.innerHTML = '';
                    return;
                }
                
                // Display the file preview
                const fileSize = (file.size / 1024).toFixed(2) + ' KB';
                const fileType = file.type || 'Unknown type';
                let fileIcon = '';
                let preview = '';
                
                // Show file info
                const fileInfo = document.createElement('div');
                fileInfo.className = 'file-info';
                fileInfo.innerHTML = `
                    <p><strong>Name:</strong> ${file.name}</p>
                    <p><strong>Type:</strong> ${fileType}</p>
                    <p><strong>Size:</strong> ${fileSize}</p>
                `;
                
                // Different preview based on file type
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    
                    reader.onload = function(e) {
                        try {
                            const img = document.createElement('img');
                            img.src = e.target.result;
                            img.className = 'preview-image';
                            
                            // Clear previous content and add new preview
                            previewElement.innerHTML = '';
                            previewElement.appendChild(fileInfo);
                            previewElement.appendChild(img);
                            
                            // Show the preview container
                            previewContainer.style.display = 'block';
                        } catch (error) {
                            console.error('Error displaying image preview:', error);
                        }
                    };
                    
                    reader.onerror = function() {
                        console.error('Failed to read image file');
                        App.showToast('error', 'Preview Failed', 'Could not preview the selected image.');
                    };
                    
                    reader.readAsDataURL(file);
                } else {
                    // For non-image files, show an icon
                    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                        fileIcon = '<div class="file-icon"><i class="fas fa-file-pdf fa-3x"></i></div>';
                    } else if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
                        fileIcon = '<div class="file-icon"><i class="fas fa-file-word fa-3x"></i></div>';
                    } else {
                        fileIcon = '<div class="file-icon"><i class="fas fa-file fa-3x"></i></div>';
                    }
                    
                    // Set preview content
                    previewElement.innerHTML = '';
                    previewElement.appendChild(fileInfo);
                    previewElement.innerHTML += fileIcon;
                    
                    // Show the preview container
                    previewContainer.style.display = 'block';
                }
            } catch (error) {
                console.error('Error in file preview:', error);
                App.showToast('error', 'Preview Error', 'There was an error generating the file preview.');
            }
        });
        
        // Add drag and drop support for file upload
        if (uploadContainer) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                uploadContainer.addEventListener(eventName, preventDefaults, false);
            });
            
            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            ['dragenter', 'dragover'].forEach(eventName => {
                uploadContainer.addEventListener(eventName, () => {
                    uploadContainer.classList.add('highlight');
                }, false);
            });
            
            ['dragleave', 'drop'].forEach(eventName => {
                uploadContainer.addEventListener(eventName, () => {
                    uploadContainer.classList.remove('highlight');
                }, false);
            });
            
            uploadContainer.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                
                if (files.length) {
                    fileInput.files = files;
                    // Trigger change event
                    const event = new Event('change');
                    fileInput.dispatchEvent(event);
                }
            }, false);
        }
    },
    
    /**
     * Load records that can be shared and display them in the sharing view
     */
    loadSharableRecords: function() {
        try {
            const recordsList = document.getElementById('sharable-records');
            if (!recordsList) {
                console.error('Sharable records container not found');
                return;
            }
            
            // Get user records from storage
            const userRecords = DataStore.getRecords() || [];
            
            // Filter records that belong to the current user
            const currentUserRecords = userRecords.filter(record => record.userId === this.currentUser.id);
            
            if (currentUserRecords.length === 0) {
                recordsList.innerHTML = '<p class="empty-state">No records available to share. Upload a record first.</p>';
                return;
            }
            
            // Build records HTML
            let recordsHTML = '';
            
            // Sort records by date (newest first)
            currentUserRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Create record cards
            currentUserRecords.forEach(record => {
                const dateFormatted = new Date(record.date).toLocaleDateString();
                const recordTypeClass = this.getRecordTypeClass(record.type);
                const recordTypeName = this.getRecordTypeName(record.type);
                
                recordsHTML += `
                    <div class="record-card sharable-record" data-id="${record.id}">
                        <div class="record-icon">
                            <i class="fas fa-file-medical"></i>
                        </div>
                        <div class="record-details">
                            <h3 class="record-title">${record.title}</h3>
                            <div class="record-meta">
                                <span class="record-date">${dateFormatted}</span>
                                <span class="record-type ${recordTypeClass}">${recordTypeName}</span>
                            </div>
                            <p class="record-notes">${record.notes || 'No additional notes'}</p>
                        </div>
                        <div class="record-select">
                            <div class="selection-indicator">
                                <i class="fas fa-check-circle"></i>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            // Update the records list
            recordsList.innerHTML = recordsHTML;
            
            // Add click event to make records selectable
            const recordCards = recordsList.querySelectorAll('.record-card');
            
            recordCards.forEach(card => {
                card.addEventListener('click', () => {
                    card.classList.toggle('selected-for-sharing');
                });
            });
            
            // Add search functionality
            const searchInput = document.getElementById('share-search');
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    const query = searchInput.value.toLowerCase();
                    
                    recordCards.forEach(card => {
                        const title = card.querySelector('.record-title').textContent.toLowerCase();
                        const notes = card.querySelector('.record-notes').textContent.toLowerCase();
                        const type = card.querySelector('.record-type').textContent.toLowerCase();
                        
                        if (title.includes(query) || notes.includes(query) || type.includes(query)) {
                            card.style.display = 'flex';
                        } else {
                            card.style.display = 'none';
                        }
                    });
                });
            }
        } catch (error) {
            console.error('Error loading sharable records:', error);
            App.showToast('error', 'Load Error', 'Could not load records for sharing.');
        }
    },
    
    /**
     * Load and display user records
     * @param {boolean} refresh - Whether to force a refresh of records from storage
     */
    loadUserRecords: async function(refresh = false) {
        console.log('Loading user records, refresh:', refresh);
        
        try {
            // Find the records container
            let recordsContainer = document.getElementById('user-records-container');
            const recordsList = document.getElementById('user-records');
            
            // If the specific container doesn't exist but the records list does,
            // use the records list as our container instead
            if (!recordsContainer && recordsList) {
                console.log('Using user-records element as container');
                recordsContainer = recordsList;
            }
            
            // If we still don't have a container, create one inside the records list
            if (!recordsContainer && document.getElementById('records-view')) {
                console.log('Creating user-records-container element');
                const recordsView = document.getElementById('records-view');
                const existingRecordsList = recordsView.querySelector('.records-list');
                
                if (existingRecordsList) {
                    recordsContainer = existingRecordsList;
                } else {
                    // Create a new container if needed
                    recordsContainer = document.createElement('div');
                    recordsContainer.id = 'user-records-container';
                    recordsContainer.className = 'records-list';
                    const recordsViewContent = recordsView.querySelector('.view-controls');
                    if (recordsViewContent) {
                        recordsViewContent.after(recordsContainer);
                    } else {
                        recordsView.appendChild(recordsContainer);
                    }
                }
            }
            
            if (!recordsContainer) {
                console.error('Records container not found and could not be created');
                return;
            }
            
            // Clear container
            recordsContainer.innerHTML = '';
            
            // Show loading
            recordsContainer.innerHTML = '<div class="loading-message">Loading records...</div>';
            
            // Make sure we have a currentUser
            if (!this.currentUser || !this.currentUser.id) {
                console.error('No current user available for loading records');
                recordsContainer.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>User information not available. Please log in again.</p>
                    </div>
                `;
                return;
            }
            
            console.log('Getting records for user ID:', this.currentUser.id);
            
            // Force a refresh from DataStore if requested
            if (refresh && typeof DataStore.loadFromLocalStorage === 'function') {
                console.log('Forcing refresh of records from storage');
                DataStore.loadFromLocalStorage();
            }
            
            // Get records from DataStore
            let records = DataStore.getRecords(this.currentUser.id);
            
            // Ensure records are returned as an array
            if (!Array.isArray(records)) {
                console.error('DataStore.getRecords did not return an array:', records);
                records = [];
            }
            
            console.log(`Found ${records.length} records for current user`);
            
            if (records.length === 0) {
                recordsContainer.innerHTML = `
                    <div class="no-records-message">
                        <i class="fas fa-file-medical"></i>
                        <p>You haven't uploaded any medical records yet.</p>
                        <button type="button" class="btn primary-btn" id="add-first-record">
                            <i class="fas fa-plus"></i> Add Your First Record
                        </button>
                    </div>
                `;
                
                // Add event listener for the "Add First Record" button
                const addFirstRecordBtn = document.getElementById('add-first-record');
                if (addFirstRecordBtn) {
                    addFirstRecordBtn.addEventListener('click', () => {
                        this.showUploadModal();
                    });
                }
                
                // Show empty state action
                const emptyStateAction = document.getElementById('empty-records-action');
                if (emptyStateAction) {
                    emptyStateAction.style.display = 'block';
                }
                
                return;
            }
            
            // Hide empty state action if we have records
            const emptyStateAction = document.getElementById('empty-records-action');
            if (emptyStateAction) {
                emptyStateAction.style.display = 'none';
            }
            
            // Clear container (removing loading message)
            recordsContainer.innerHTML = '';
            
            // Sort records by date (newest first)
            records.sort((a, b) => {
                const dateA = new Date(a.createdAt || a.date);
                const dateB = new Date(b.createdAt || b.date);
                return dateB - dateA;
            });
            
            // Create records
            records.forEach(record => {
                const cardEl = this.createRecordCard(record);
                recordsContainer.appendChild(cardEl);
            });
            
            console.log(`Displayed ${records.length} records`);
        } catch (error) {
            console.error('Error loading records:', error);
            const recordsContainer = document.getElementById('user-records') || 
                                    document.getElementById('user-records-container');
            if (recordsContainer) {
                recordsContainer.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error loading records: ${error.message || 'Unknown error'}</p>
                        <button class="btn secondary-btn" id="retry-load-records">Retry</button>
                    </div>
                `;
                
                // Add retry button functionality
                const retryBtn = document.getElementById('retry-load-records');
                if (retryBtn) {
                    retryBtn.addEventListener('click', () => {
                        this.loadUserRecords(true);
                    });
                }
            }
        }
    },
    
    /**
     * Format date for display
     * @param {string} date - Date string to format
     * @returns {string} Formatted date string
     */
    formatDate: function(date) {
        const formattedDate = new Date(date).toLocaleDateString();
        return formattedDate;
    },
    
    /**
     * Prepare a record for sharing
     * @param {string} recordId - ID of the record to share
     */
    prepareRecordForSharing: function(recordId) {
        try {
            // Get record from storage
            const allRecords = DataStore.getRecords() || [];
            const record = allRecords.find(r => r.id === recordId);
            
            if (!record) {
                App.showToast('error', 'Sharing Failed', 'Record not found.');
                return;
            }
            
            // Navigate to share view
            App.navigateTo('share');
            
            // Pre-select the record in the sharing form
            this.preSelectRecordForSharing(record);
            
            // Show toast to inform user
            App.showToast('info', 'Ready to Share', `${record.title} is ready to be shared.`);
        } catch (error) {
            console.error('Error preparing record for sharing:', error);
            App.showToast('error', 'Sharing Error', 'Could not prepare record for sharing.');
        }
    },
    
    /**
     * Pre-select a record in the sharing form
     * @param {Object} record - The record to pre-select
     */
    preSelectRecordForSharing: function(record) {
        try {
            // This would be implemented in a real app
            // For this demo, we'll highlight the record in the sharable records list
            const recordItems = document.querySelectorAll('#sharable-records .record-card');
            
            if (recordItems.length === 0) {
                // Load records if none are displayed
                this.loadUserRecords();
                this.loadSharableRecords();
                
                // Try again after a short delay to allow DOM to update
                setTimeout(() => {
                    this.preSelectRecordForSharing(record);
                }, 500);
                return;
            }
            
            let recordFound = false;
            
            recordItems.forEach(item => {
                if (item.getAttribute('data-id') === record.id) {
                    item.classList.add('selected-for-sharing');
                    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    recordFound = true;
                    
                    // Also pre-fill recipient field if it exists
                    const recipientInput = document.getElementById('recipient-email');
                    if (recipientInput && !recipientInput.value) {
                        // Set default recipient if field is empty
                        recipientInput.value = 'doctor@example.com';
                    }
                } else {
                    item.classList.remove('selected-for-sharing');
                }
            });
            
            if (!recordFound) {
                console.warn('Record not found in sharing list:', record.id);
                App.showToast('warning', 'Record Not Found', 'The selected record was not found in the sharing list.');
            }
            
            // Scroll to share form after selecting the record
            const shareForm = document.querySelector('.share-form');
            if (shareForm) {
                setTimeout(() => {
                    shareForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 500);
            }
        } catch (error) {
            console.error('Error pre-selecting record for sharing:', error);
        }
    },
    
    /**
     * Handle record sharing form submission
     */
    handleRecordShare: function() {
        try {
            const recipientInput = document.getElementById('recipient-email');
            const recipientName = document.getElementById('recipient-name');
            const accessLevel = document.getElementById('access-level');
            const expirationDate = document.getElementById('expiration-date');
            const shareNotes = document.getElementById('share-notes');
            
            if (!recipientInput || !accessLevel || !expirationDate) {
                console.error('Share form elements not found');
                App.showToast('error', 'Form Error', 'The sharing form is incomplete.');
                return;
            }
            
            const recipient = recipientInput.value.trim();
            const recipientDisplayName = recipientName && recipientName.value.trim() ? 
                recipientName.value.trim() : recipient;
            
            // Validate inputs
            if (!recipient) {
                App.showToast('error', 'Validation Error', 'Please provide a recipient email.');
                recipientInput.focus();
                return;
            }
            
            // Check for valid email format
            if (!this.isValidEmail(recipient)) {
                App.showToast('error', 'Invalid Email', 'Please enter a valid email address.');
                recipientInput.focus();
                return;
            }
            
            // Check for future expiration date
            const selectedDate = new Date(expirationDate.value);
            const today = new Date();
            if (selectedDate <= today) {
                App.showToast('error', 'Invalid Date', 'The expiration date must be in the future.');
                expirationDate.focus();
                return;
            }
            
            // Check if any records are selected
            const selectedRecords = document.querySelectorAll('#sharable-records .record-card.selected-for-sharing');
            if (selectedRecords.length === 0) {
                App.showToast('warning', 'No Records Selected', 'Please select at least one record to share.');
                return;
            }
            
            // In a real app, this would create sharing permissions
            // For this demo, we'll update the UI to show the newly shared records in the history
            
            // Show sharing in progress
            App.showToast('info', 'Sharing in Progress', 'Creating secure sharing links...');
            
            // Get selected record IDs
            const recordIds = Array.from(selectedRecords).map(card => card.getAttribute('data-id'));
            
            // Get information for selected records
            const allRecords = DataStore.getRecords() || [];
            const sharedRecords = recordIds.map(id => {
                return allRecords.find(r => r.id === id);
            }).filter(r => r); // Filter out any undefined records
            
            // Show number of records found
            if (sharedRecords.length < recordIds.length) {
                console.warn(`Only ${sharedRecords.length} of ${recordIds.length} selected records were found`);
            }
            
            // Log share event for each record
            recordIds.forEach(recordId => {
                AuditLogger.logSystemEvent(this.currentUser.id, 'SHARE', {
                    recordId: recordId,
                    recipient: recipient,
                    accessLevel: accessLevel.value,
                    expirationDate: expirationDate.value
                });
            });
            
            // Update UI to show the newly shared records in the history
            this.updateSharedHistory(recordIds, recipient, expirationDate.value, accessLevel.value);
            
            // Reset form with a delay to give user time to see the changes
            setTimeout(() => {
                recipientInput.value = '';
                if (recipientName) recipientName.value = '';
                if (shareNotes) shareNotes.value = '';
                
                // Set expiration date to 7 days from now by default
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                expirationDate.value = nextWeek.toISOString().split('T')[0];
                
                // Clear selection
                selectedRecords.forEach(card => {
                    card.classList.remove('selected-for-sharing');
                });
                
                // Show success message with number of records
                const recordText = recordIds.length === 1 ? 'record' : 'records';
                App.showToast('success', 'Records Shared', `${recordIds.length} ${recordText} shared with ${recipientDisplayName}.`);
            }, 1500);
        } catch (error) {
            console.error('Error sharing records:', error);
            App.showToast('error', 'Sharing Failed', 'There was an error sharing the records.');
        }
    },
    
    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} Whether the email is valid
     */
    isValidEmail: function(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    },
    
    /**
     * Update the shared history table with new entries
     * @param {Array} recordIds - Array of shared record IDs
     * @param {string} recipient - Email of the recipient
     * @param {string} expirationDate - When the sharing expires
     * @param {string} accessLevel - The access level granted
     */
    updateSharedHistory: function(recordIds, recipient, expirationDate, accessLevel) {
        try {
            const sharedHistoryTable = document.querySelector('.shared-history-table tbody');
            if (!sharedHistoryTable) {
                console.error('Shared history table not found');
                return;
            }
            
            // Get all records to get details
            const allRecords = DataStore.getRecords() || [];
            
            // Format date for display
            const formattedDate = new Date(expirationDate).toLocaleDateString();
            const accessLevelText = accessLevel === 'view' ? 'View Only' : 'View & Download';
            
            // Add rows for each shared record
            recordIds.forEach(recordId => {
                const record = allRecords.find(r => r.id === recordId);
                if (!record) {
                    console.warn(`Record not found for ID: ${recordId}`);
                    return; // Skip this record
                }
                
                // Create a new row for the shared record
                const row = document.createElement('tr');
                row.className = 'history-item';
                
                // Generate a unique sharing ID (demo purposes)
                const sharingId = 'share_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
                
                // Set the row HTML
                row.innerHTML = `
                    <td>${record.title}</td>
                    <td>${recipient}</td>
                    <td>${formattedDate}</td>
                    <td>${accessLevelText}</td>
                    <td class="status-active">Active</td>
                    <td>
                        <button class="btn btn-sm secondary-btn copy-link-btn" data-link="${sharingId}">
                            <i class="fas fa-link"></i> Copy Link
                        </button>
                        <button class="btn btn-sm danger-btn revoke-btn">
                            <i class="fas fa-ban"></i> Revoke
                        </button>
                    </td>
                `;
                
                // Add the row to the table
                if (sharedHistoryTable.querySelector('.empty-state')) {
                    // Remove empty state if it exists
                    sharedHistoryTable.innerHTML = '';
                }
                
                // Add row at the beginning
                if (sharedHistoryTable.firstChild) {
                    sharedHistoryTable.insertBefore(row, sharedHistoryTable.firstChild);
                } else {
                    sharedHistoryTable.appendChild(row);
                }
                
                // Add event listeners for the new buttons
                const copyLinkBtn = row.querySelector('.copy-link-btn');
                const revokeBtn = row.querySelector('.revoke-btn');
                
                if (copyLinkBtn) {
                    copyLinkBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.copyShareLink(sharingId);
                    });
                }
                
                if (revokeBtn) {
                    revokeBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.revokeSharing(recordId, recipient);
                        row.querySelector('.status-active').className = 'status-revoked';
                        row.querySelector('.status-revoked').textContent = 'Revoked';
                        revokeBtn.disabled = true;
                        copyLinkBtn.disabled = true;
                        copyLinkBtn.classList.add('disabled');
                        App.showToast('info', 'Access Revoked', `Revoked access for ${recipient}.`);
                    });
                }
            });
        } catch (error) {
            console.error('Error updating shared history:', error);
            App.showToast('error', 'Update Failed', 'Could not update the sharing history.');
        }
    },
    
    /**
     * Copy share link to clipboard
     * @param {string} sharingId - The unique sharing ID
     */
    copyShareLink: function(sharingId) {
        const shareLink = `https://medsecure.example.com/share/${sharingId}`;
        
        try {
            // Create a temporary textarea element to copy from
            const textarea = document.createElement('textarea');
            textarea.value = shareLink;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            
            App.showToast('success', 'Link Copied', 'Sharing link copied to clipboard.');
        } catch (error) {
            console.error('Failed to copy link:', error);
            App.showToast('error', 'Copy Failed', 'Could not copy the sharing link. Link: ' + shareLink);
        }
    },
    
    /**
     * Revoke sharing for a record
     * @param {string} recordId - ID of the record
     * @param {string} recipient - Email of the recipient
     */
    revokeSharing: function(recordId, recipient) {
        // In a real app, this would update permissions in the database
        // For this demo, we just log the event
        AuditLogger.logSystemEvent(this.currentUser.id, 'REVOKE_SHARE', {
            recordId: recordId,
            recipient: recipient
        });
    },
    
    /**
     * Confirm record deletion with a confirmation dialog
     * @param {string} recordId - ID of the record to delete
     */
    confirmDeleteRecord: function(recordId) {
        try {
            console.log(`Confirming deletion of record: ${recordId}`);
            
            // Create and show a confirmation dialog
            const confirmed = confirm('Are you sure you want to delete this record? This action cannot be undone.');
            
            if (confirmed) {
                this.deleteRecord(recordId);
            }
        } catch (error) {
            console.error('Error in confirmDeleteRecord:', error);
            App.showToast('error', 'Delete Error', 'Could not process your delete request.');
        }
    },
    
    /**
     * Delete a record
     * @param {string} recordId - ID of the record to delete
     */
    deleteRecord: async function(recordId) {
        try {
            console.log(`Deleting record: ${recordId}`);
            
            // Show a loading toast
            App.showToast('info', 'Deleting Record', 'Please wait...');
            
            // First, get the record to access its fileId
            const records = DataStore.getRecords();
            const recordToDelete = records.find(r => r.id === recordId);
            
            if (!recordToDelete) {
                console.error(`Record ${recordId} not found for deletion`);
                App.showToast('error', 'Delete Failed', 'Record not found.');
                return;
            }
            
            // Save the fileId before deleting the record
            const fileId = recordToDelete.fileId;
            
            // Get the user role for proper deletion
            const userRole = this.currentUser && this.currentUser.role || 'patient';
            
            // Attempt to delete using DataStore
            const deleted = await DataStore.deleteRecord(recordId, userRole);
            
            if (deleted) {
                console.log(`Record ${recordId} deleted successfully`);
                
                // If the record had a fileId, remove it from prescriptionImages
                if (fileId) {
                    // Remove from in-memory cache
                    if (this.prescriptionImages && this.prescriptionImages[fileId]) {
                        console.log(`Removing file ${fileId} from prescriptionImages cache`);
                        delete this.prescriptionImages[fileId];
                        
                        // Update localStorage
                        try {
                            localStorage.setItem('prescription_images', JSON.stringify(this.prescriptionImages));
                            console.log(`Updated prescription_images in localStorage after deletion of ${fileId}`);
                        } catch (storageError) {
                            console.error('Error updating localStorage after file deletion:', storageError);
                        }
                    }
                }
                
                // Log audit event
                if (this.currentUser && this.currentUser.id) {
                    const auditEntry = {
                        id: 'audit_' + Date.now(),
                        userId: this.currentUser.id,
                        eventType: 'DELETE',
                        timestamp: new Date().toISOString(),
                        status: 'SUCCESS',
                        data: {
                            recordId: recordId
                        }
                    };
                    
                    // Add audit log entry
                    await DataStore.addAuditLog(auditEntry);
                }
                
                // Refresh the records view
                this.loadUserRecords(true);
                
                // Show success message
                App.showToast('success', 'Record Deleted', 'The record has been successfully deleted.');
                
                // Update dashboard counts
                this.updateDashboardCounts();
            } else {
                console.error(`Failed to delete record ${recordId}`);
                App.showToast('error', 'Delete Failed', 'Could not delete the record. Please try again.');
            }
        } catch (error) {
            console.error('Error deleting record:', error);
            App.showToast('error', 'Delete Error', 'There was an error deleting the record.');
        }
    }
}; 