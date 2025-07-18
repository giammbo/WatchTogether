// Content script for Netflix Watch Party
console.log('Netflix Watch Party content script loaded');

// GraphQL configuration - should match popup.js
const GRAPHQL_ENDPOINT = 'https://your-appsync-endpoint.appsync-api.us-east-1.amazonaws.com/graphql';
const GRAPHQL_API_KEY = 'YOUR_API_KEY_HERE';

// State management
let watchPartyState = {
    roomId: null,
    userId: null,
    isHost: false,
    connected: false,
    subscription: null,
    lastUpdateTime: 0,
    isSyncing: false,
    videoElement: null,
    reconnectAttempts: 0
};

// GraphQL helper
async function graphqlRequest(query, variables) {
    try {
        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': GRAPHQL_API_KEY
            },
            body: JSON.stringify({
                query,
                variables
            })
        });

        const data = await response.json();
        if (data.errors) {
            throw new Error(data.errors[0].message);
        }
        return data.data;
    } catch (error) {
        console.error('GraphQL request failed:', error);
        throw error;
    }
}

// GraphQL subscription implementation using Server-Sent Events (SSE)
function subscribeToPlaybackUpdates() {
    if (watchPartyState.subscription) {
        watchPartyState.subscription.close();
    }

    console.log('Subscribing to playback updates for room:', watchPartyState.roomId);

    // For AppSync, we'll use WebSocket subscription
    const subscriptionQuery = `
        subscription OnPlaybackUpdated($roomId: String!) {
            onPlaybackUpdated(roomId: $roomId) {
                roomId
                userId
                state
                currentTime
                timestamp
            }
        }
    `;

    // Since we can't use Apollo Client, we'll implement a polling mechanism
    // In a real implementation, you'd use AppSync's WebSocket endpoint
    startPlaybackPolling();
}

// Polling mechanism (fallback for WebSocket)
let pollingInterval = null;

function startPlaybackPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollingInterval = setInterval(async () => {
        if (!watchPartyState.connected || !watchPartyState.roomId) {
            stopPlaybackPolling();
            return;
        }

        try {
            // Query for latest playback state
            const query = `
                query GetRoomState($roomId: String!) {
                    getRoomState(roomId: $roomId) {
                        state
                        currentTime
                        lastUpdateUserId
                        timestamp
                    }
                }
            `;

            const data = await graphqlRequest(query, { roomId: watchPartyState.roomId });
            
            if (data.getRoomState && data.getRoomState.lastUpdateUserId !== watchPartyState.userId) {
                handleRemotePlaybackUpdate(data.getRoomState);
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 1000); // Poll every second
}

function stopPlaybackPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

// Find and monitor Netflix video element
function findVideoElement() {
    const video = document.querySelector('video');
    if (video && video !== watchPartyState.videoElement) {
        console.log('Netflix video element found');
        watchPartyState.videoElement = video;
        attachVideoListeners();
    }
    return video;
}

// Attach event listeners to video element
function attachVideoListeners() {
    if (!watchPartyState.videoElement) return;

    // Remove existing listeners
    ['play', 'pause', 'seeked'].forEach(event => {
        watchPartyState.videoElement.removeEventListener(event, handleVideoEvent);
    });

    // Add new listeners
    ['play', 'pause', 'seeked'].forEach(event => {
        watchPartyState.videoElement.addEventListener(event, handleVideoEvent);
    });

    console.log('Video event listeners attached');
}

// Handle video events
function handleVideoEvent(event) {
    if (!watchPartyState.connected || watchPartyState.isSyncing) return;

    const video = event.target;
    const currentTime = video.currentTime;
    const state = video.paused ? 'paused' : 'playing';

    console.log(`Video event: ${event.type}, state: ${state}, time: ${currentTime}`);

    // Throttle updates
    const now = Date.now();
    if (now - watchPartyState.lastUpdateTime < 500) return;
    watchPartyState.lastUpdateTime = now;

    // Send update to other users
    sendPlaybackUpdate(state, currentTime);
}

// Send playback update via GraphQL
async function sendPlaybackUpdate(state, currentTime) {
    if (!watchPartyState.roomId || !watchPartyState.userId) return;

    try {
        const mutation = `
            mutation UpdatePlayback($roomId: String!, $userId: String!, $state: String!, $currentTime: Float!, $timestamp: String!) {
                updatePlayback(roomId: $roomId, userId: $userId, state: $state, currentTime: $currentTime, timestamp: $timestamp) {
                    roomId
                    state
                    currentTime
                }
            }
        `;

        await graphqlRequest(mutation, {
            roomId: watchPartyState.roomId,
            userId: watchPartyState.userId,
            state: state,
            currentTime: currentTime,
            timestamp: new Date().toISOString()
        });

        console.log('Playback update sent:', { state, currentTime });
    } catch (error) {
        console.error('Failed to send playback update:', error);
    }
}

// Handle remote playback updates
function handleRemotePlaybackUpdate(update) {
    if (!watchPartyState.videoElement || watchPartyState.isSyncing) return;

    console.log('Received remote playback update:', update);

    watchPartyState.isSyncing = true;

    try {
        const video = watchPartyState.videoElement;
        const timeDiff = Math.abs(video.currentTime - update.currentTime);

        // Sync time if difference is significant
        if (timeDiff > 1) {
            video.currentTime = update.currentTime;
        }

        // Sync play/pause state
        if (update.state === 'playing' && video.paused) {
            video.play().catch(err => console.error('Play failed:', err));
        } else if (update.state === 'paused' && !video.paused) {
            video.pause();
        }
    } catch (error) {
        console.error('Error applying remote update:', error);
    } finally {
        setTimeout(() => {
            watchPartyState.isSyncing = false;
        }, 1000);
    }
}

// Check for room ID in URL
function checkForRoomInUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    
    // Check URL parameters
    if (urlParams.has('watchparty')) {
        return urlParams.get('watchparty');
    }
    
    // Check hash
    if (hash && hash.includes('room=')) {
        const match = hash.match(/room=([A-Z0-9]+)/i);
        if (match) return match[1];
    }
    
    return null;
}

// Initialize watch party
async function initializeWatchParty(roomId, userId, isHost) {
    console.log('Initializing watch party:', { roomId, userId, isHost });
    
    watchPartyState.roomId = roomId;
    watchPartyState.userId = userId;
    watchPartyState.isHost = isHost;
    watchPartyState.connected = true;
    
    // Find video element
    findVideoElement();
    
    // Start monitoring for video element changes
    const observer = new MutationObserver(() => {
        findVideoElement();
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Subscribe to updates
    subscribeToPlaybackUpdates();
    
    // Notify popup of connection status
    chrome.runtime.sendMessage({
        type: 'CONNECTION_STATUS',
        connected: true
    });
}

// Leave watch party
function leaveWatchParty() {
    console.log('Leaving watch party');
    
    // Stop polling
    stopPlaybackPolling();
    
    // Remove video listeners
    if (watchPartyState.videoElement) {
        ['play', 'pause', 'seeked'].forEach(event => {
            watchPartyState.videoElement.removeEventListener(event, handleVideoEvent);
        });
    }
    
    // Reset state
    watchPartyState = {
        roomId: null,
        userId: null,
        isHost: false,
        connected: false,
        subscription: null,
        lastUpdateTime: 0,
        isSyncing: false,
        videoElement: null,
        reconnectAttempts: 0
    };
    
    // Notify popup
    chrome.runtime.sendMessage({
        type: 'CONNECTION_STATUS',
        connected: false
    });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    
    switch (message.type) {
        case 'ROOM_CREATED':
        case 'ROOM_JOINED':
            initializeWatchParty(message.roomId, message.userId, message.isHost);
            sendResponse({ success: true });
            break;
            
        case 'ROOM_LEFT':
            leaveWatchParty();
            sendResponse({ success: true });
            break;
            
        case 'GET_STATUS':
            sendResponse({
                connected: watchPartyState.connected,
                roomId: watchPartyState.roomId,
                isHost: watchPartyState.isHost
            });
            break;
            
        default:
            sendResponse({ success: false, error: 'Unknown message type' });
    }
    
    return true; // Keep message channel open for async response
});

// Auto-join room if URL contains room ID
document.addEventListener('DOMContentLoaded', async () => {
    const roomId = checkForRoomInUrl();
    if (roomId) {
        console.log('Room ID found in URL:', roomId);
        // Wait for extension to be ready
        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: 'AUTO_JOIN_ROOM',
                roomId: roomId
            });
        }, 1000);
    }
});

// Inject a script to access Netflix's internal player API (if needed)
function injectScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
}

// Initialize
console.log('Netflix Watch Party initialized');
findVideoElement(); 