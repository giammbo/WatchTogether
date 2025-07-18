// Background service worker for Netflix Watch Party
// Handles extension lifecycle and message routing

// Extension installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Netflix Watch Party: Extension installed');
    
    if (details.reason === 'install') {
        // First time installation
        console.log('Netflix Watch Party: First time installation');
    } else if (details.reason === 'update') {
        // Extension updated
        console.log('Netflix Watch Party: Extension updated');
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
    // This will only trigger if popup is not defined in manifest
    // Since we have a popup, this won't be called
    console.log('Netflix Watch Party: Extension icon clicked');
});

// Message handling between popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Netflix Watch Party: Background received message:', message);
    
    switch (message.action) {
        case 'playbackChange':
            // Forward playback changes from content script to popup
            handlePlaybackChange(message.data);
            break;
        case 'autoJoin':
            // Handle auto-join from URL
            handleAutoJoin(message.data);
            break;
        case 'getTabInfo':
            // Return current tab information
            sendResponse({ tabId: sender.tab?.id, url: sender.tab?.url });
            break;
    }
    
    // Return true to indicate async response
    return true;
});

// Handle playback changes from content script
async function handlePlaybackChange(playbackData) {
    try {
        // Forward to popup if it's open
        const popup = await getPopupTab();
        if (popup) {
            chrome.tabs.sendMessage(popup.id, {
                action: 'playbackChange',
                data: playbackData
            });
        }
    } catch (error) {
        console.error('Netflix Watch Party: Error handling playback change:', error);
    }
}

// Handle auto-join from URL
async function handleAutoJoin(data) {
    try {
        // Forward to popup if it's open
        const popup = await getPopupTab();
        if (popup) {
            chrome.tabs.sendMessage(popup.id, {
                action: 'autoJoin',
                data: data
            });
        }
    } catch (error) {
        console.error('Netflix Watch Party: Error handling auto-join:', error);
    }
}

// Get popup tab if it exists
async function getPopupTab() {
    try {
        const tabs = await chrome.tabs.query({
            url: chrome.runtime.getURL('popup.html')
        });
        return tabs[0] || null;
    } catch (error) {
        console.error('Netflix Watch Party: Error getting popup tab:', error);
        return null;
    }
}

// Tab update handling
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('netflix.com')) {
        console.log('Netflix Watch Party: Netflix tab loaded');
        
        // Check if there's a room ID in the URL
        const url = new URL(tab.url);
        const roomId = url.searchParams.get('id');
        
        if (roomId) {
            console.log('Netflix Watch Party: Room ID found in URL:', roomId);
            
            // Inject content script if not already injected
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            }).catch(error => {
                console.error('Netflix Watch Party: Error injecting content script:', error);
            });
        }
    }
});

// Tab removal handling
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.log('Netflix Watch Party: Tab removed:', tabId);
    
    // Clean up any resources associated with this tab
    // This could include stopping subscriptions, clearing intervals, etc.
});

// Extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Netflix Watch Party: Extension started');
});

// Handle extension shutdown
chrome.runtime.onSuspend.addListener(() => {
    console.log('Netflix Watch Party: Extension suspended');
    
    // Clean up any resources
    // This is where you'd close WebSocket connections, clear intervals, etc.
});

// Utility function to check if a tab is on Netflix
function isNetflixTab(tab) {
    return tab.url && tab.url.includes('netflix.com');
}

// Utility function to get all Netflix tabs
async function getNetflixTabs() {
    try {
        const tabs = await chrome.tabs.query({
            url: '*://*.netflix.com/*'
        });
        return tabs;
    } catch (error) {
        console.error('Netflix Watch Party: Error getting Netflix tabs:', error);
        return [];
    }
}

// Broadcast message to all Netflix tabs
async function broadcastToNetflixTabs(message) {
    try {
        const netflixTabs = await getNetflixTabs();
        
        for (const tab of netflixTabs) {
            try {
                await chrome.tabs.sendMessage(tab.id, message);
            } catch (error) {
                console.error(`Netflix Watch Party: Error sending message to tab ${tab.id}:`, error);
            }
        }
    } catch (error) {
        console.error('Netflix Watch Party: Error broadcasting to Netflix tabs:', error);
    }
}

// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.session) {
        console.log('Netflix Watch Party: Session storage changed:', changes.session);
        
        // Broadcast session changes to all Netflix tabs
        const newValue = changes.session.newValue;
        const oldValue = changes.session.oldValue;
        
        if (newValue && newValue.roomId && (!oldValue || oldValue.roomId !== newValue.roomId)) {
            // User joined a new room
            broadcastToNetflixTabs({
                action: 'sessionChanged',
                data: { type: 'joined', roomId: newValue.roomId, username: newValue.username }
            });
        } else if (oldValue && oldValue.roomId && (!newValue || !newValue.roomId)) {
            // User left the room
            broadcastToNetflixTabs({
                action: 'sessionChanged',
                data: { type: 'left' }
            });
        }
    }
});

// Handle alarms (for periodic tasks)
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanupSessions') {
        console.log('Netflix Watch Party: Running session cleanup');
        cleanupExpiredSessions();
    }
});

// Create periodic cleanup alarm
chrome.alarms.create('cleanupSessions', { periodInMinutes: 60 });

// Clean up expired sessions
async function cleanupExpiredSessions() {
    try {
        const sessions = await chrome.storage.local.get(['session']);
        
        if (sessions.session && sessions.session.lastActivity) {
            const lastActivity = new Date(sessions.session.lastActivity);
            const now = new Date();
            const hoursSinceActivity = (now - lastActivity) / (1000 * 60 * 60);
            
            // Remove session if inactive for more than 24 hours
            if (hoursSinceActivity > 24) {
                await chrome.storage.local.remove(['session']);
                console.log('Netflix Watch Party: Cleaned up expired session');
            }
        }
    } catch (error) {
        console.error('Netflix Watch Party: Error cleaning up sessions:', error);
    }
}

// Export utility functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isNetflixTab,
        getNetflixTabs,
        broadcastToNetflixTabs,
        cleanupExpiredSessions
    };
} 