/**
 * Simplified AuditLogger for MedSecure
 * 
 * Handles event logging and activity tracking.
 */

const AuditLogger = {
    /**
     * Log a generic event
     * @param {Object} eventData - Event data to log
     */
    logEvent: function(eventData) {
        try {
            // Get existing audit log
            const auditLog = DataStore.getAuditLog() || [];
            
            // Create log entry
            const entry = {
                id: 'audit_' + Date.now(),
                timestamp: new Date().toISOString(),
                ipAddress: this.getClientIP(),
                ...eventData
            };
            
            // Add to log
            auditLog.unshift(entry);
            
            // Limit log size
            if (auditLog.length > 1000) {
                auditLog.length = 1000;
            }
            
            // Save to storage
            localStorage.setItem(DataStore.KEYS.AUDIT_LOG, JSON.stringify(auditLog));
            
            console.log('Logged event:', entry.eventType);
        } catch (error) {
            console.error('Error logging event:', error);
        }
    },
    
    /**
     * Log a system event
     * @param {string} userId - User ID
     * @param {string} eventType - Type of event
     * @param {Object} eventData - Additional event data
     */
    logSystemEvent: function(userId, eventType, eventData = {}) {
        this.logEvent({
            eventType: eventType,
            userId: userId,
            eventData: eventData
        });
    },
    
    /**
     * Log navigation activity
     * @param {string} userId - User ID 
     * @param {string} view - View being navigated to
     */
    logNavigation: function(userId, view) {
        this.logEvent({
            eventType: 'NAVIGATION',
            userId: userId,
            eventData: {
                view: view,
                timestamp: new Date().toISOString()
            }
        });
    },
    
    /**
     * Get client IP address (simulated for demo)
     * @returns {string} IP address
     */
    getClientIP: function() {
        // For this demo, we'll use a simulated IP
        return '192.168.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255);
    }
}; 