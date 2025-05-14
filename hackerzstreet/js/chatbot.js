/**
 * MedSecure Chatbot Module
 * 
 * Implements a chatbot using Google's Gemini API to provide medical assistance.
 */

const Chatbot = {
    // Configuration
    API_KEY: 'AIzaSyCwX_qYKGowfsJAwL0limCiddvvzhakztw',
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    USE_TEST_MODE: false, // Set to true for testing without API calls
    
    // Chat history
    conversations: [],
    
    // Fallback responses when API is unavailable
    fallbackResponses: [
        "I'm here to help you manage your medical records and answer basic health questions.",
        "You can use MedSecure to securely store, share, and access your medical records.",
        "For medical emergencies, please contact your healthcare provider or emergency services.",
        "The Dashboard shows you an overview of your records and recent activity.",
        "You can upload medical records by clicking on 'Upload Record' in the Records section.",
        "MedSecure is HIPAA-compliant, ensuring your medical data remains private and secure.",
        "You can share specific records with healthcare providers through the Share section.",
        "Please note that I'm not a replacement for professional medical advice."
    ],
    
    /**
     * Initialize the chatbot
     */
    init: function() {
        this.bindEvents();
        console.log('Chatbot initialized');
        
        // Fix caret visibility across app
        // Hide caret on all elements first
        document.querySelectorAll('*').forEach(el => {
            el.style.caretColor = 'transparent';
        });
        
        // Then enable it only on text inputs
        const textInputs = document.querySelectorAll('input[type="text"], input[type="password"], input[type="email"], textarea, #chat-input');
        textInputs.forEach(input => {
            input.style.caretColor = 'var(--primary-color)';
            input.style.cursor = 'text';
        });
        
        // Specifically target checkbox containers
        document.querySelectorAll('.checkbox-container, #two-factor-auth-container').forEach(el => {
            el.style.caretColor = 'transparent';
        });
        
        // Self-test to console
        this.testConnection();
    },
    
    /**
     * Bind event listeners
     */
    bindEvents: function() {
        const sendButton = document.getElementById('send-message');
        const chatInput = document.getElementById('chat-input');
        const chatMessages = document.getElementById('chat-messages');
        
        if (sendButton && chatInput) {
            // Set input cursor properties programmatically
            chatInput.style.caretColor = 'var(--primary-color)';
            chatInput.style.cursor = 'text';
            
            // Focus handler for text area to force caret on
            chatInput.addEventListener('focus', () => {
                chatInput.style.caretColor = 'var(--primary-color)';
            });
            
            // Send message on button click
            sendButton.addEventListener('click', () => {
                this.sendMessage();
                // Return focus to input after sending
                setTimeout(() => chatInput.focus(), 0);
            });
            
            // Send message on Enter key (but allow Shift+Enter for new line)
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            
            // Prevent focus on message area which can cause caret issues
            if (chatMessages) {
                chatMessages.addEventListener('mousedown', (e) => {
                    // Allow selection but prevent focus
                    if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
                        e.preventDefault();
                        // If selection is intended, allow it
                        if (window.getSelection().toString() === '') {
                            // Focus back to input unless user is selecting text
                            chatInput.focus();
                        }
                    }
                });
            }
            
            // Set initial focus to input when chat tab is activated
            document.querySelector('.nav-link[data-view="chatbot"]')?.addEventListener('click', () => {
                setTimeout(() => chatInput.focus(), 100);
            });
        }
    },
    
    /**
     * Send user message to the chatbot
     */
    sendMessage: function() {
        const chatInput = document.getElementById('chat-input');
        if (!chatInput) return;
        
        const message = chatInput.value.trim();
        if (!message) {
            // Focus on empty input but don't send
            chatInput.focus();
            return;
        }
        
        // Add user message to chat
        this.addMessageToChat('user', message);
        
        // Clear input and maintain focus
        chatInput.value = '';
        chatInput.focus();
        
        // Check if the message is related to medical topics
        if (!this.isMedicalRelated(message)) {
            // If not medical-related, respond with a message explaining the limitation
            setTimeout(() => {
                this.removeThinkingIndicator();
                const response = "I'm sorry, but I can only respond to medical-related questions or questions about using the MedSecure platform. Please ask a question related to healthcare, medical records, or platform usage.";
                this.addMessageToChat('assistant', response);
            }, 500);
            
            // Show thinking indicator
            this.showThinkingIndicator();
            return;
        }
        
        // Add message to conversation history - with proper formatting for Gemini 2.0 API
        this.conversations.push({
            role: 'user',
            parts: [{ text: message }]
        });
        
        console.log("User message:", message);
        console.log("Current conversation history:", this.conversations);
        
        // Show thinking indicator
        this.showThinkingIndicator();
        
        // Get response from Gemini API
        this.getGeminiResponse(message);
    },
    
    /**
     * Check if a message is related to medical topics
     * @param {string} message - User message
     * @returns {boolean} Whether the message is medical-related
     */
    isMedicalRelated: function(message) {
        const lowercaseMessage = message.toLowerCase();
        
        // Platform-related keywords (already handled by the platform detection)
        const platformKeywords = ['upload', 'share', 'record', 'dashboard', 'login', 'file', 'document', 'button', 'click', 'not working', 'broken', 'help me', 'how do I', 'how to'];
        
        // Medical-related keywords
        const medicalKeywords = [
            'health', 'medical', 'doctor', 'patient', 'hospital', 'clinic', 'symptom', 'diagnosis', 'treatment',
            'medication', 'drug', 'prescription', 'disease', 'condition', 'pain', 'therapy', 'vaccine', 'vaccination',
            'allergy', 'allergic', 'blood', 'pressure', 'heart', 'cardiac', 'lung', 'respiratory', 'brain', 'neural',
            'cancer', 'diabetes', 'asthma', 'arthritis', 'depression', 'anxiety', 'virus', 'bacterial', 'infection',
            'surgery', 'emergency', 'specialist', 'healthcare', 'nurse', 'physician', 'appointment', 'checkup',
            'screening', 'test', 'covid', 'fever', 'cough', 'headache', 'migraine', 'injury', 'wound', 'fracture',
            'broken', 'diet', 'nutrition', 'vitamin', 'supplement', 'exercise', 'wellness', 'fitness', 'mental health',
            'pregnancy', 'pediatric', 'geriatric', 'elderly', 'chronic', 'acute', 'insurance', 'medicaid', 'medicare'
        ];
        
        // Check if the message contains platform-related keywords
        const isPlatformQuestion = platformKeywords.some(keyword => lowercaseMessage.includes(keyword));
        if (isPlatformQuestion) {
            return true;
        }
        
        // Check if the message contains medical keywords
        const isMedicalQuestion = medicalKeywords.some(keyword => lowercaseMessage.includes(keyword));
        return isMedicalQuestion;
    },
    
    /**
     * Get response from Gemini API
     * @param {string} message - User message
     */
    getGeminiResponse: function(message) {
        // Keep focus in chat input
        const chatInput = document.getElementById('chat-input');
        if (chatInput) chatInput.focus();
        
        // If in test mode, use fallback responses instead of API
        if (this.USE_TEST_MODE) {
            console.log("Running in test mode - using fallback responses");
            setTimeout(() => {
                this.removeThinkingIndicator();
                const response = this.getFallbackResponse(message);
                this.addMessageToChat('assistant', response);
                
                // Add to conversation history
                this.conversations.push({
                    role: 'model',
                    parts: [{ text: response }]
                });
            }, 1000);
            return;
        }
        
        // Check if the message is about the platform functionality
        const platformKeywords = ['upload', 'share', 'record', 'dashboard', 'login', 'file', 'document', 'button', 'click', 'not working', 'broken', 'help me', 'how do I', 'how to'];
        const isPlatformQuestion = platformKeywords.some(keyword => message.toLowerCase().includes(keyword));
        
        if (isPlatformQuestion) {
            // Handle platform-related questions directly
            this.handlePlatformQuestion(message);
            return;
        }
        
        // Check if the message is related to medical topics
        if (!this.isMedicalRelated(message)) {
            // If not medical-related, respond with a message explaining limitations
            this.removeThinkingIndicator();
            const response = "I'm specifically designed to answer medical questions and help with the MedSecure platform. Please ask me about medical topics, health concerns, or how to use the platform's features.";
            this.addMessageToChat('assistant', response);
            
            // Add to conversation history
            this.conversations.push({
                role: 'model',
                parts: [{ text: response }]
            });
            return;
        }
        
        // Continue with normal API call for medical questions
        let contents = [];
        
        // Add system context to help guide the response
        contents.push({
            role: 'user',
            parts: [{ text: 'You are a helpful, accurate, and concise medical assistant for the MedSecure platform. Focus only on medical information and platform usage. Always clarify you are not a doctor and cannot provide diagnosis. Keep responses under 150 words unless detailed medical explanation is necessary.' }]
        });
        
        contents.push({
            role: 'model',
            parts: [{ text: 'I understand my role as a medical assistant for MedSecure. I will provide helpful, accurate, and concise information about medical topics and platform usage. I will clarify I\'m not a doctor and cannot provide diagnosis. I\'ll keep responses focused and concise.' }]
        });
        
        // Add conversation history
        this.conversations.forEach(msg => {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: msg.parts
            });
        });
        
        console.log("Sending API request with contents:", contents);
        
        const requestBody = {
            contents: contents,
            generationConfig: {
                temperature: 0.2,
                topK: 32,
                topP: 0.95,
                maxOutputTokens: 800,
            }
        };
        
        // Make request to Gemini API with proper URL construction
        const apiUrl = `${this.API_URL}?key=${this.API_KEY}`;
        console.log("API URL (without key):", this.API_URL);
        
        fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        })
        .then(response => {
            console.log("API Response Status:", response.status);
            
            if (!response.ok) {
                return response.text().then(text => {
                    try {
                        // Try to parse the error response as JSON
                        const errorData = JSON.parse(text);
                        console.error("API Error Response:", errorData);
                        throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.error?.message || 'Unknown error'}`);
                    } catch (e) {
                        // If parsing fails, use the raw text
                        console.error("API Error Raw Response:", text);
                        throw new Error(`HTTP error! Status: ${response.status}, Raw response: ${text.substring(0, 100)}...`);
                    }
                });
            }
            return response.json();
        })
        .then(data => {
            console.log("Gemini 2.0 API Response:", data); // Debug log
            
            // Remove thinking indicator
            this.removeThinkingIndicator();
            
            // Error handling for malformed responses
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
                console.error("Unexpected API response format:", data);
                throw new Error("The API response doesn't contain the expected data structure");
            }
            
            // Get the response text
            const responseText = data.candidates[0].content.parts[0].text;
            
            // Add response to chat
            this.addMessageToChat('assistant', responseText);
            
            // Add to conversation history
            this.conversations.push({
                role: 'model',
                parts: [{ text: responseText }]
            });
        })
        .catch(error => {
            console.error('Error calling Gemini 2.0 API:', error);
            
            // Remove thinking indicator
            this.removeThinkingIndicator();
            
            // Provide more specific error message
            let errorMessage = '';
            
            if (error.message && error.message.includes('429')) {
                errorMessage = "I'm currently experiencing high demand. Please try again in a few moments.";
            } else if (error.message && error.message.includes('403')) {
                errorMessage = "There seems to be an authentication issue with my service. The team has been notified.";
            } else if (error.message && error.message.includes('404')) {
                errorMessage = "The AI service endpoint couldn't be found. This could be a temporary issue or a configuration problem.";
            } else if (error.message && error.message.includes("doesn't contain the expected data structure")) {
                errorMessage = "I received an unexpected response format. This has been logged for investigation.";
            } else if (isPlatformQuestion) {
                // Use fallback response for platform questions when API is down
                errorMessage = this.getFallbackResponse(message);
            } else {
                errorMessage = "I'm having trouble connecting to my knowledge base right now. Please try again later, or ask me about using the MedSecure platform.";
            }
            
            // Log full error details to console
            console.log('API Error details:', error);
            
            // Add error message to chat
            this.addMessageToChat('assistant', errorMessage);
        });
    },
    
    /**
     * Handle platform-specific questions without using the AI API
     * @param {string} message - User message
     */
    handlePlatformQuestion: function(message) {
        let response = "";
        
        // Check for specific categories of questions and provide helpful responses
        if (message.toLowerCase().includes('upload')) {
            response = "To upload medical records, go to the Records section and click the 'Upload Record' button. You can upload PDF, JPG, PNG, or DOCX files. Make sure to fill in all the required fields in the form. If you're having trouble with the upload button, try refreshing the page or using a different browser.";
        } 
        else if (message.toLowerCase().includes('share')) {
            response = "To share records with a healthcare provider, go to the Share section, select the records you want to share, enter the recipient's email address, choose access level, and set an expiration date. This creates a secure link they can use to access your records.";
        }
        else if (message.toLowerCase().includes('not working') || message.toLowerCase().includes('broken')) {
            response = "I'm sorry to hear something isn't working correctly. Here are some troubleshooting steps:\n\n1. Refresh the page\n2. Clear your browser cache\n3. Try using a different browser\n4. Check your internet connection\n\nIf the issue persists, please contact support with details about what's not working.";
        }
        else if (message.toLowerCase().includes('button') || message.toLowerCase().includes('click')) {
            response = "If a button isn't responding to clicks, try the following:\n\n1. Refresh the page\n2. Make sure you're clicking directly on the button text or icon\n3. Check if JavaScript is enabled in your browser\n4. Try using a different browser\n\nMost interactive elements should highlight when you hover over them.";
        }
        else {
            // General platform information for other requests
            response = "MedSecure helps you manage your medical records securely. You can upload records in the Records section, share them with healthcare providers in the Share section, and view access logs in the Audit section. If you're having technical difficulties, try refreshing the page or using a different browser. Would you like more specific help with a particular feature?";
        }
        
        setTimeout(() => {
            this.removeThinkingIndicator();
            this.addMessageToChat('assistant', response);
            
            // Add to conversation history
            this.conversations.push({
                role: 'model',
                parts: [{ text: response }]
            });
        }, 1000);
    },
    
    /**
     * Get a fallback response when API is unavailable
     * @param {string} query - User's message
     * @returns {string} Fallback response
     */
    getFallbackResponse: function(query) {
        // Check for common queries and provide specific responses
        query = query.toLowerCase();
        
        if (query.includes('upload') || query.includes('add record')) {
            return "To upload a medical record, go to the Records tab and click the 'Upload New Record' button. You can upload PDFs, images, and other document formats.";
        }
        
        if (query.includes('share') || query.includes('send')) {
            return "You can share your medical records securely with healthcare providers. Navigate to the Share tab, select the records you want to share, and provide the recipient's email address.";
        }
        
        if (query.includes('password') || query.includes('security')) {
            return "You can update your password and security settings in the Settings tab. We recommend using a strong, unique password and enabling two-factor authentication for additional security.";
        }
        
        if (query.includes('help') || query.includes('how to')) {
            return "MedSecure allows you to securely manage your medical records. You can upload, view, and share records with healthcare providers. For specific guidance, please ask about the feature you need help with.";
        }
        
        // If no specific match, return a random fallback response
        const randomIndex = Math.floor(Math.random() * this.fallbackResponses.length);
        return this.fallbackResponses[randomIndex];
    },
    
    /**
     * Add message to chat UI
     * @param {string} role - 'user' or 'assistant'
     * @param {string} text - Message text
     */
    addMessageToChat: function(role, text) {
        const chatMessages = document.getElementById('chat-messages');
        const chatInput = document.getElementById('chat-input');
        
        if (!chatMessages) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${role}`;
        
        const currentTime = new Date();
        const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const formattedText = this.formatMessageText(text);
        
        if (role === 'user') {
            // User messages display immediately
            messageElement.innerHTML = `
                <div class="message-content">
                    <p>${formattedText}</p>
                    <div class="message-time">${formattedTime}</div>
                </div>
            `;
            
            chatMessages.appendChild(messageElement);
            
            // Scroll to bottom
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            // Assistant messages animate with improved typewriter effect
            messageElement.innerHTML = `
                <div class="message-content">
                    <p></p>
                    <div class="message-time">${formattedTime}</div>
                </div>
            `;
            
            chatMessages.appendChild(messageElement);
            
            // Get the paragraph where we'll add the text
            const messageParagraph = messageElement.querySelector('p');
            
            // Check if the text contains HTML tags
            const containsHTML = /<[a-z][\s\S]*>/i.test(formattedText);
            
            if (containsHTML) {
                // For HTML content, we need to render it in chunks to maintain HTML structure
                const parser = new DOMParser();
                const doc = parser.parseFromString(formattedText, 'text/html');
                const nodes = Array.from(doc.body.childNodes);
                
                let nodeIndex = 0;
                let charIndex = 0;
                let currentNodeText = '';
                let renderedNodes = [];
                
                // Create a temporary document fragment to hold nodes
                const tempContainer = document.createDocumentFragment();
                
                // Determine typing speed based on total content length
                const totalLength = formattedText.length;
                // Base speed with dynamic adjustment for longer texts
                const baseSpeed = 25; // milliseconds per batch
                const typingSpeed = Math.max(10, Math.min(25, baseSpeed - (totalLength / 500)));
                
                const renderNextChunk = () => {
                    if (nodeIndex >= nodes.length) {
                        return; // All nodes processed
                    }
                    
                    const currentNode = nodes[nodeIndex];
                    
                    // Handle text nodes
                    if (currentNode.nodeType === 3) { // Text node
                        if (charIndex === 0) {
                            currentNodeText = currentNode.textContent;
                        }
                        
                        // Process characters in batches for smoother appearance
                        const batchSize = Math.ceil(currentNodeText.length / 20); // Process ~5% of text at once
                        const endIndex = Math.min(charIndex + batchSize, currentNodeText.length);
                        
                        // Add the next batch of text
                        const newTextNode = document.createTextNode(
                            currentNodeText.substring(0, endIndex)
                        );
                        
                        // Replace the previous text node if it exists
                        if (renderedNodes[nodeIndex]) {
                            renderedNodes[nodeIndex].parentNode.replaceChild(newTextNode, renderedNodes[nodeIndex]);
                        } else {
                            tempContainer.appendChild(newTextNode);
                        }
                        
                        renderedNodes[nodeIndex] = newTextNode;
                        
                        charIndex = endIndex;
                        
                        // Move to next node if this one is complete
                        if (charIndex >= currentNodeText.length) {
                            nodeIndex++;
                            charIndex = 0;
                        }
                    } 
                    // Handle element nodes (like <br>, <strong>, etc.)
                    else if (currentNode.nodeType === 1) { // Element node
                        // Clone the node and all its children
                        const clonedNode = currentNode.cloneNode(true);
                        tempContainer.appendChild(clonedNode);
                        renderedNodes[nodeIndex] = clonedNode;
                        nodeIndex++;
                    }
                    
                    // Update the paragraph with all content so far
                    messageParagraph.innerHTML = '';
                    messageParagraph.appendChild(tempContainer.cloneNode(true));
                    
                    // Scroll as text appears
                    chatMessages.scrollTo({
                        top: chatMessages.scrollHeight,
                        behavior: 'smooth'
                    });
                    
                    // Continue rendering
                    setTimeout(renderNextChunk, typingSpeed);
                };
                
                // Start the rendering process
                renderNextChunk();
            } else {
                // For plain text, use an optimized character-by-character approach
                const totalLength = formattedText.length;
                
                // Use dynamic typing speed - faster for longer messages
                // Base speed is 25ms per character, but gets faster for longer text
                const baseDelay = 25; // milliseconds
                const typingSpeed = Math.max(8, Math.min(25, baseDelay - (totalLength / 300)));
                
                let i = 0;
                const chunkSize = Math.max(1, Math.ceil(totalLength / 100)); // Process in small chunks
                
                const typeNextChunk = () => {
                    if (i < formattedText.length) {
                        // Calculate how many characters to add in this chunk
                        const endIndex = Math.min(i + chunkSize, formattedText.length);
                        
                        // Add the next chunk of characters
                        messageParagraph.innerHTML += formattedText.substring(i, endIndex);
                        i = endIndex;
                        
                        // Scroll as text appears
                        chatMessages.scrollTo({
                            top: chatMessages.scrollHeight,
                            behavior: 'smooth'
                        });
                        
                        // Schedule the next chunk
                        setTimeout(typeNextChunk, typingSpeed);
                    }
                };
                
                // Start typing
                typeNextChunk();
            }
        }
        
        // Keep focus in chat input
        if (chatInput) setTimeout(() => chatInput.focus(), 100);
    },
    
    /**
     * Format message text with basic markdown
     * @param {string} text - Message text
     * @returns {string} Formatted text
     */
    formatMessageText: function(text) {
        // Replace newlines with <br>
        text = text.replace(/\n/g, '<br>');
        
        // Format bold text: **text** or __text__
        text = text.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
        
        // Format italic text: *text* or _text_
        text = text.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');
        
        // Format code: `code`
        text = text.replace(/`(.*?)`/g, '<code>$1</code>');
        
        // Format lists
        const lines = text.split('<br>');
        let inList = false;
        let listType = '';
        
        for (let i = 0; i < lines.length; i++) {
            // Unordered list items
            if (lines[i].trim().match(/^[*\-•]\s+(.+)$/)) {
                if (!inList || listType !== 'ul') {
                    lines[i] = inList ? '</ul><ul><li>' + lines[i].replace(/^[*\-•]\s+/, '') + '</li>' : '<ul><li>' + lines[i].replace(/^[*\-•]\s+/, '') + '</li>';
                    inList = true;
                    listType = 'ul';
                } else {
                    lines[i] = '<li>' + lines[i].replace(/^[*\-•]\s+/, '') + '</li>';
                }
            }
            // Ordered list items
            else if (lines[i].trim().match(/^\d+\.\s+(.+)$/)) {
                if (!inList || listType !== 'ol') {
                    lines[i] = inList ? '</ol><ol><li>' + lines[i].replace(/^\d+\.\s+/, '') + '</li>' : '<ol><li>' + lines[i].replace(/^\d+\.\s+/, '') + '</li>';
                    inList = true;
                    listType = 'ol';
                } else {
                    lines[i] = '<li>' + lines[i].replace(/^\d+\.\s+/, '') + '</li>';
                }
            }
            // End list if line is not a list item
            else if (inList && lines[i].trim() !== '') {
                lines[i] = listType === 'ul' ? '</ul>' + lines[i] : '</ol>' + lines[i];
                inList = false;
            }
        }
        
        // Close any open list
        if (inList) {
            lines.push(listType === 'ul' ? '</ul>' : '</ol>');
        }
        
        return lines.join('<br>');
    },
    
    /**
     * Show thinking indicator
     */
    showThinkingIndicator: function() {
        const chatMessages = document.getElementById('chat-messages');
        const chatInput = document.getElementById('chat-input');
        
        if (!chatMessages) return;
        
        const thinkingElement = document.createElement('div');
        thinkingElement.className = 'message assistant';
        thinkingElement.id = 'thinking-indicator';
        
        thinkingElement.innerHTML = `
            <div class="message-content message-thinking">
                <div class="thinking-dot"></div>
                <div class="thinking-dot"></div>
                <div class="thinking-dot"></div>
            </div>
        `;
        
        chatMessages.appendChild(thinkingElement);
        
        // Scroll to bottom smoothly
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
        
        // Keep focus in chat input
        if (chatInput) setTimeout(() => chatInput.focus(), 50);
    },
    
    /**
     * Remove thinking indicator
     */
    removeThinkingIndicator: function() {
        const thinkingIndicator = document.getElementById('thinking-indicator');
        
        if (thinkingIndicator) {
            thinkingIndicator.remove();
        }
    },
    
    /**
     * Run a simple connectivity test to the API
     * This is only used for debugging
     */
    testConnection: function() {
        console.log("Running test connection to API");
        const testMessage = "Hello, this is a test message";
        
        // Simple fetch test to verify connectivity
        fetch(`${this.API_URL}?key=${this.API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: testMessage }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 100
                }
            })
        })
        .then(response => {
            console.log("Test API Response Status:", response.status);
            if (response.ok) {
                console.log("Test API connectivity successful!");
                return response.json();
            } else {
                console.error("Test failed - API connectivity issue");
                return response.text().then(text => {
                    console.error("Error details:", text);
                });
            }
        })
        .then(data => {
            console.log("Test API Response:", data);
        })
        .catch(error => {
            console.error("Test failed - API request error:", error);
        });
    }
};