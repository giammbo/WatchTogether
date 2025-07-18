// Configuration file for Netflix Watch Party Extension
// Update these values with your AWS AppSync configuration

const CONFIG = {
    // AWS AppSync GraphQL endpoint
    APPSYNC_ENDPOINT: 'https://x4aik7il3zawpfdtuvcqklg7ji.appsync-api.eu-west-1.amazonaws.com/graphql',
    
    // AWS AppSync API key
    APPSYNC_API_KEY: 'da2-eitmqimlczczjekbh5l5nm2ayq',
    
    // Sync settings
    SYNC_INTERVAL: 1000, // milliseconds - how often to poll for updates
    TIME_THRESHOLD: 2,   // seconds - minimum time difference to trigger sync
    
    // UI settings
    NOTIFICATION_DURATION: 3000, // milliseconds - how long notifications show
    
    // Debug settings
    DEBUG_MODE: false, // Set to true to enable verbose logging
    LOG_LEVEL: 'info'  // 'debug', 'info', 'warn', 'error'
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

// Make available globally for popup.js
if (typeof window !== 'undefined') {
    window.NETFLIX_WATCH_PARTY_CONFIG = CONFIG;
} 