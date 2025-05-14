/**
 * Simplified Encryption utility for MedSecure Enterprise
 * 
 * This is a simplified version for demo purposes.
 */

const Encryption = {
    /**
     * Generate a random encryption key
     * @returns {string} A string representing a key
     */
    generateKey: function() {
        return 'key_' + Math.random().toString(36).substring(2, 15);
    },
    
    /**
     * Simplified hash function for passwords
     * @param {string} str - String to hash
     * @returns {Promise<string>} Simulated hash
     */
    hash: function(str) {
        // This is a simplified hash for demo purposes only
        // In a real application, use a proper crypto library
        return Promise.resolve(str + '_hashed');
    },
    
    /**
     * Encrypt data with a key (simplified)
     * @param {string|Object} data - Data to encrypt
     * @param {string} key - Encryption key
     * @returns {string} Encrypted data
     */
    encrypt: function(data, key) {
        // In a real app, this would use proper encryption
        const dataStr = typeof data === 'object' ? JSON.stringify(data) : data;
        return 'encrypted_' + dataStr;
    },
    
    /**
     * Decrypt data with a key (simplified)
     * @param {string} encryptedData - The encrypted data
     * @param {string} key - Decryption key
     * @returns {string} Decrypted data
     */
    decrypt: function(encryptedData, key) {
        // In a real app, this would use proper decryption
        if (typeof encryptedData === 'string' && encryptedData.startsWith('encrypted_')) {
            const dataStr = encryptedData.substring(10);
            try {
                return JSON.parse(dataStr);
            } catch {
                return dataStr;
            }
        }
        return encryptedData;
    },
    
    /**
     * Sign data (simplified)
     * @param {string} data - Data to sign
     * @param {string} key - Signing key
     * @returns {string} Signature
     */
    sign: function(data, key) {
        return 'signature_' + data.substring(0, 10);
    },
    
    /**
     * Check if encryption is supported in this browser
     * @returns {boolean} Whether encryption is supported
     */
    isSupported: function() {
        return true;
    }
}; 