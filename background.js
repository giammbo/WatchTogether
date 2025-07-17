// WatchTogether Background Service Worker
// Handles extension lifecycle and communication

chrome.runtime.onInstalled.addListener(() => {
    console.log('[WatchTogether] Extension installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[WatchTogether] Background received message:', request);
    
    switch (request.type) {
        case 'getTabInfo':
            // Get current tab info for popup
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    sendResponse({
                        url: tabs[0].url,
                        title: tabs[0].title
                    });
                } else {
                    sendResponse({ error: 'No active tab found' });
                }
            });
            return true; // Keep message channel open for async response
            
        case 'updateIcon':
            // Update extension icon based on connection status
            const iconPath = request.connected ? 'icons/icon48-active.png' : 'icons/icon48.png';
            chrome.action.setIcon({ path: iconPath });
            break;
            
        case 'showNotification':
            // Show desktop notification
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'WatchTogether',
                message: request.message
            });
            break;
    }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('netflix.com')) {
        console.log('[WatchTogether] Netflix tab updated:', tab.url);
        
        // Inject content script if needed
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        }).catch(error => {
            console.log('[WatchTogether] Content script already injected or error:', error);
        });
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    if (tab.url && tab.url.includes('netflix.com')) {
        // Send message to content script to toggle sidebar
        chrome.tabs.sendMessage(tab.id, { type: 'toggleSidebar' }).catch(error => {
            console.log('[WatchTogether] Error sending message to tab:', error);
        });
    } else {
        // Show notification if not on Netflix
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'WatchTogether',
            message: 'Apri Netflix per usare WatchTogether'
        });
    }
});

// Handle context menu
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'watchtogether-menu',
        title: 'WatchTogether',
        contexts: ['page']
    });
    
    chrome.contextMenus.create({
        id: 'create-room',
        parentId: 'watchtogether-menu',
        title: 'Crea Nuova Stanza',
        contexts: ['page']
    });
    
    chrome.contextMenus.create({
        id: 'join-room',
        parentId: 'watchtogether-menu',
        title: 'Entra in Stanza',
        contexts: ['page']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (tab.url && tab.url.includes('netflix.com')) {
        switch (info.menuItemId) {
            case 'create-room':
                chrome.tabs.sendMessage(tab.id, { type: 'createRoom' });
                break;
            case 'join-room':
                // Could show a prompt to enter room ID
                chrome.tabs.sendMessage(tab.id, { type: 'showJoinDialog' });
                break;
        }
    }
});

// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    console.log('[WatchTogether] Storage changed:', changes, namespace);
});

// Handle alarms (for periodic tasks)
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('[WatchTogether] Alarm triggered:', alarm.name);
});

// Handle runtime errors
chrome.runtime.onSuspend.addListener(() => {
    console.log('[WatchTogether] Extension suspended');
});

// Handle startup
chrome.runtime.onStartup.addListener(() => {
    console.log('[WatchTogether] Extension started');
});

// Handle uninstall
chrome.runtime.setUninstallURL('https://github.com/yourusername/watchtogether'); 