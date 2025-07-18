// GraphQL endpoint configuration
const GRAPHQL_ENDPOINT = 'https://your-appsync-endpoint.appsync-api.us-east-1.amazonaws.com/graphql';
const GRAPHQL_API_KEY = 'YOUR_API_KEY_HERE'; // Replace with actual API key

// GraphQL queries and mutations
const GRAPHQL_OPERATIONS = {
    createRoom: `
        mutation CreateRoom($roomId: String!, $hostId: String!, $hostName: String!) {
            createRoom(roomId: $roomId, hostId: $hostId, hostName: $hostName) {
                roomId
                hostId
                createdAt
            }
        }
    `,
    joinRoom: `
        mutation JoinRoom($roomId: String!, $userId: String!, $userName: String!) {
            joinRoom(roomId: $roomId, userId: $userId, userName: $userName) {
                roomId
                users {
                    userId
                    userName
                }
            }
        }
    `,
    leaveRoom: `
        mutation LeaveRoom($roomId: String!, $userId: String!) {
            leaveRoom(roomId: $roomId, userId: $userId) {
                success
            }
        }
    `,
    updatePlayback: `
        mutation UpdatePlayback($roomId: String!, $userId: String!, $state: String!, $currentTime: Float!, $timestamp: String!) {
            updatePlayback(roomId: $roomId, userId: $userId, state: $state, currentTime: $currentTime, timestamp: $timestamp) {
                roomId
                state
                currentTime
            }
        }
    `
};

// Utility functions
function generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
}

function generateUsername() {
    return 'Guest' + Math.floor(Math.random() * 9000 + 1000);
}

function generateRoomId() {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
}

function generateShareUrl(roomId) {
    return `https://watchparty.fake/join?id=${roomId}`;
}

// GraphQL request helper
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

// State management
let currentState = {
    userId: null,
    username: null,
    roomId: null,
    isHost: false,
    connected: false
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    // Load saved state
    const savedState = await chrome.storage.local.get(['userId', 'username', 'roomId', 'isHost']);
    
    if (!savedState.userId) {
        currentState.userId = generateUserId();
        currentState.username = generateUsername();
        await chrome.storage.local.set({
            userId: currentState.userId,
            username: currentState.username
        });
    } else {
        currentState.userId = savedState.userId;
        currentState.username = savedState.username;
        currentState.roomId = savedState.roomId;
        currentState.isHost = savedState.isHost || false;
    }

    // Update UI
    document.getElementById('username').textContent = `Username: ${currentState.username}`;
    
    if (currentState.roomId) {
        showRoomInfo();
        updateConnectionStatus();
    }

    // Check if we're on Netflix
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url || !tab.url.includes('netflix.com')) {
        document.getElementById('status').textContent = 'Please navigate to Netflix first';
        document.getElementById('status').className = 'status error';
        document.getElementById('createBtn').disabled = true;
        document.getElementById('joinBtn').disabled = true;
    }

    // Set up event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Create room button
    document.getElementById('createBtn').addEventListener('click', createRoom);
    
    // Join room button
    document.getElementById('joinBtn').addEventListener('click', () => {
        document.getElementById('mainButtons').style.display = 'none';
        document.getElementById('joinForm').style.display = 'block';
    });
    
    // Join form handlers
    document.getElementById('joinSubmitBtn').addEventListener('click', joinRoom);
    document.getElementById('joinCancelBtn').addEventListener('click', () => {
        document.getElementById('mainButtons').style.display = 'flex';
        document.getElementById('joinForm').style.display = 'none';
        document.getElementById('roomUrlInput').value = '';
    });
    
    // Copy button
    document.getElementById('copyBtn').addEventListener('click', () => {
        const url = generateShareUrl(currentState.roomId);
        navigator.clipboard.writeText(url);
        document.getElementById('copyBtn').textContent = 'Copied!';
        setTimeout(() => {
            document.getElementById('copyBtn').textContent = 'Copy';
        }, 2000);
    });
    
    // Leave button
    document.getElementById('leaveBtn').addEventListener('click', leaveRoom);
    
    // Handle enter key in join input
    document.getElementById('roomUrlInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinRoom();
        }
    });
}

async function createRoom() {
    try {
        const roomId = generateRoomId();
        
        // Create room via GraphQL
        await graphqlRequest(GRAPHQL_OPERATIONS.createRoom, {
            roomId,
            hostId: currentState.userId,
            hostName: currentState.username
        });
        
        // Update state
        currentState.roomId = roomId;
        currentState.isHost = true;
        currentState.connected = true;
        
        // Save state
        await chrome.storage.local.set({
            roomId,
            isHost: true
        });
        
        // Notify content script
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.sendMessage(tab.id, {
            type: 'ROOM_CREATED',
            roomId,
            userId: currentState.userId,
            isHost: true
        });
        
        // Update UI
        showRoomInfo();
        updateConnectionStatus();
        
    } catch (error) {
        console.error('Failed to create room:', error);
        document.getElementById('status').textContent = 'Failed to create room';
        document.getElementById('status').className = 'status error';
    }
}

async function joinRoom() {
    try {
        const urlInput = document.getElementById('roomUrlInput').value.trim();
        if (!urlInput) return;
        
        // Extract room ID from URL
        const urlMatch = urlInput.match(/id=([A-Z0-9]+)/i);
        if (!urlMatch) {
            throw new Error('Invalid watch party URL');
        }
        
        const roomId = urlMatch[1].toUpperCase();
        
        // Join room via GraphQL
        await graphqlRequest(GRAPHQL_OPERATIONS.joinRoom, {
            roomId,
            userId: currentState.userId,
            userName: currentState.username
        });
        
        // Update state
        currentState.roomId = roomId;
        currentState.isHost = false;
        currentState.connected = true;
        
        // Save state
        await chrome.storage.local.set({
            roomId,
            isHost: false
        });
        
        // Notify content script
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.sendMessage(tab.id, {
            type: 'ROOM_JOINED',
            roomId,
            userId: currentState.userId,
            isHost: false
        });
        
        // Update UI
        document.getElementById('joinForm').style.display = 'none';
        showRoomInfo();
        updateConnectionStatus();
        
    } catch (error) {
        console.error('Failed to join room:', error);
        document.getElementById('status').textContent = 'Failed to join room';
        document.getElementById('status').className = 'status error';
    }
}

async function leaveRoom() {
    try {
        if (currentState.roomId) {
            // Leave room via GraphQL
            await graphqlRequest(GRAPHQL_OPERATIONS.leaveRoom, {
                roomId: currentState.roomId,
                userId: currentState.userId
            });
            
            // Notify content script
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.sendMessage(tab.id, {
                type: 'ROOM_LEFT'
            });
        }
        
        // Clear state
        currentState.roomId = null;
        currentState.isHost = false;
        currentState.connected = false;
        
        // Clear saved state
        await chrome.storage.local.remove(['roomId', 'isHost']);
        
        // Reset UI
        document.getElementById('roomInfo').style.display = 'none';
        document.getElementById('mainButtons').style.display = 'flex';
        document.getElementById('roomUrlInput').value = '';
        
    } catch (error) {
        console.error('Failed to leave room:', error);
    }
}

function showRoomInfo() {
    document.getElementById('mainButtons').style.display = 'none';
    document.getElementById('joinForm').style.display = 'none';
    document.getElementById('roomInfo').style.display = 'block';
    
    const shareUrl = generateShareUrl(currentState.roomId);
    document.getElementById('roomUrl').textContent = shareUrl;
}

function updateConnectionStatus() {
    const statusEl = document.getElementById('status');
    if (currentState.connected) {
        statusEl.textContent = currentState.isHost ? 'Hosting watch party' : 'Connected to watch party';
        statusEl.className = 'status connected';
    } else {
        statusEl.textContent = 'Connecting...';
        statusEl.className = 'status';
    }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CONNECTION_STATUS') {
        currentState.connected = message.connected;
        updateConnectionStatus();
    }
}); 