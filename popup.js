// GraphQL endpoint configuration
const APPSYNC_ENDPOINT = window.NETFLIX_WATCH_PARTY_CONFIG?.APPSYNC_ENDPOINT || 'https://your-appsync-endpoint.amazonaws.com/graphql';
const APPSYNC_API_KEY = window.NETFLIX_WATCH_PARTY_CONFIG?.APPSYNC_API_KEY || 'your-api-key';

// State management
let currentRoom = null;
let currentUser = null;
let subscription = null;

// DOM elements
const mainActions = document.getElementById('main-actions');
const joinForm = document.getElementById('join-form');
const roomInfo = document.getElementById('room-info');
const status = document.getElementById('status');
const loading = document.getElementById('loading');
const roomUrl = document.getElementById('room-url');
const participantCount = document.getElementById('participant-count');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    await initializePopup();
    setupEventListeners();
    addTestButton(); // Add test button for debugging
});

async function initializePopup() {
    // Check if we're already in a room
    const session = await getSession();
    if (session.roomId && session.username) {
        currentRoom = session.roomId;
        currentUser = session.username;
        showRoomInfo();
        await joinRoom(session.roomId, session.username);
    }
}

function setupEventListeners() {
    // Main action buttons
    document.getElementById('create-party').addEventListener('click', createWatchParty);
    document.getElementById('join-party').addEventListener('click', showJoinForm);
    
    // Join form
    document.getElementById('join-room-btn').addEventListener('click', handleJoinRoom);
    document.getElementById('back-btn').addEventListener('click', showMainActions);
    
    // Room info
    document.getElementById('copy-url').addEventListener('click', copyRoomUrl);
}

async function createWatchParty() {
    try {
        showLoading('Creating watch party...');
        
        // Generate random username and room ID
        const username = generateUsername();
        const roomId = generateRoomId();
        
        // Create room via GraphQL
        const result = await createRoom(roomId, username);
        
        if (result.success) {
            currentRoom = roomId;
            currentUser = username;
            
            // Save session
            await saveSession({ roomId, username });
            
            // Show room info
            showRoomInfo();
            
            // Start subscription
            await startSubscription(roomId);
            
            showStatus('Watch party created successfully!', 'success');
        } else {
            // Fallback: create room locally if GraphQL fails
            console.warn('GraphQL createRoom failed, using local fallback:', result.error);
            
            // Create room locally for testing
            currentRoom = roomId;
            currentUser = username;
            
            // Save session
            await saveSession({ roomId, username });
            
            // Show room info
            showRoomInfo();
            
            showStatus('Watch party created (local mode - GraphQL resolver needs fixing)', 'success');
        }
    } catch (error) {
        showStatus('Error creating watch party: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function showJoinForm() {
    mainActions.classList.add('hidden');
    joinForm.classList.remove('hidden');
    roomInfo.classList.remove('show');
}

function showMainActions() {
    mainActions.classList.remove('hidden');
    joinForm.classList.add('hidden');
    roomInfo.classList.remove('show');
}

async function handleJoinRoom() {
    const roomId = document.getElementById('room-id-input').value.trim();
    
    if (!roomId) {
        showStatus('Please enter a room ID', 'error');
        return;
    }
    
    try {
        showLoading('Joining watch party...');
        
        const username = generateUsername();
        const result = await joinRoom(roomId, username);
        
        if (result.success) {
            currentRoom = roomId;
            currentUser = username;
            
            // Save session
            await saveSession({ roomId, username });
            
            // Start subscription
            await startSubscription(roomId);
            
            showStatus('Successfully joined watch party!', 'success');
            
            // Notify content script
            await notifyContentScript('joined', { roomId, username });
        } else {
            showStatus('Failed to join watch party: ' + result.error, 'error');
        }
    } catch (error) {
        showStatus('Error joining watch party: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function showRoomInfo() {
    mainActions.classList.add('hidden');
    joinForm.classList.add('hidden');
    roomInfo.classList.add('show');
    
    const shareUrl = `https://watchparty.fake/join?id=${currentRoom}`;
    roomUrl.textContent = shareUrl;
}

async function copyRoomUrl() {
    const shareUrl = `https://watchparty.fake/join?id=${currentRoom}`;
    
    try {
        await navigator.clipboard.writeText(shareUrl);
        showStatus('Room URL copied to clipboard!', 'success');
    } catch (error) {
        showStatus('Failed to copy URL', 'error');
    }
}

// GraphQL Operations
async function createRoom(roomId, username) {
    const mutation = `
        mutation CreateRoom($id: ID!, $username: String!) {
            createRoom(id: $id, username: $username) {
                id
                users
                playbackState {
                    isPlaying
                    currentTime
                    updatedAt
                }
            }
        }
    `;
    
    return await executeGraphQL(mutation, { id: roomId, username });
}

async function joinRoom(roomId, username) {
    const mutation = `
        mutation JoinRoom($id: ID!, $username: String!) {
            joinRoom(id: $id, username: $username) {
                id
                users
                playbackState {
                    isPlaying
                    currentTime
                    updatedAt
                }
            }
        }
    `;
    
    return await executeGraphQL(mutation, { id: roomId, username });
}

async function updatePlayback(roomId, isPlaying, currentTime) {
    const mutation = `
        mutation UpdatePlayback($id: ID!, $state: PlaybackStateInput!) {
            updatePlayback(id: $id, state: { isPlaying: $state.isPlaying, currentTime: $state.currentTime }) {
                isPlaying
                currentTime
                updatedAt
            }
        }
    `;
    
    return await executeGraphQL(mutation, { 
        id: roomId, 
        state: { isPlaying, currentTime } 
    });
}

async function startSubscription(roomId) {
    const subscriptionQuery = `
        subscription OnPlaybackUpdated($id: ID!) {
            onPlaybackUpdated(id: $id) {
                isPlaying
                currentTime
                updatedAt
            }
        }
    `;
    
    try {
        // For WebSocket subscriptions, we'll use a polling approach for simplicity
        // In a real implementation, you'd use WebSocket connections
        setInterval(async () => {
            await pollPlaybackUpdates(roomId);
        }, 1000);
        
        showStatus('Connected to watch party', 'success');
    } catch (error) {
        showStatus('Failed to connect to watch party updates', 'error');
    }
}

async function pollPlaybackUpdates(roomId) {
    const query = `
        query GetRoom($id: ID!) {
            getRoom(id: $id) {
                id
                users
                playbackState {
                    isPlaying
                    currentTime
                    updatedAt
                }
            }
        }
    `;
    
    try {
        const result = await executeGraphQL(query, { id: roomId });
        if (result.success && result.data && result.data.getRoom) {
            const room = result.data.getRoom;
            if (room && room.playbackState) {
                // Notify content script of remote playback change
                await notifyContentScript('playbackUpdate', room.playbackState);
            }
        }
    } catch (error) {
        console.error('Error polling playback updates:', error);
    }
}

async function executeGraphQL(query, variables = {}) {
    try {
        console.log('GraphQL Request:', { query, variables });
        
        const response = await fetch(APPSYNC_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': APPSYNC_API_KEY,
            },
            body: JSON.stringify({
                query,
                variables
            })
        });
        
        const data = await response.json();
        console.log('GraphQL Response:', data);
        
        if (data.errors) {
            console.error('GraphQL Errors:', data.errors);
            return {
                success: false,
                error: data.errors[0].message,
                details: data.errors
            };
        }
        
        return {
            success: true,
            data: data.data
        };
    } catch (error) {
        console.error('GraphQL Request Failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Utility functions
function generateUsername() {
    const adjectives = ['Happy', 'Sleepy', 'Grumpy', 'Dopey', 'Bashful', 'Sneezy', 'Doc'];
    const numbers = Math.floor(Math.random() * 9999) + 1000;
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    return `${adjective}${numbers}`;
}

function generateRoomId() {
    // Generate a simple alphanumeric ID that should work with most GraphQL ID types
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    
    setTimeout(() => {
        status.className = 'status';
    }, 5000);
}

function showLoading(message) {
    loading.textContent = message;
    loading.classList.remove('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}

// Storage functions
async function saveSession(session) {
    await chrome.storage.local.set({ session });
}

async function getSession() {
    const result = await chrome.storage.local.get(['session']);
    return result.session || {};
}

// Communication with content script
async function notifyContentScript(action, data) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url.includes('netflix.com')) {
            await chrome.tabs.sendMessage(tab.id, {
                action,
                data
            });
        }
    } catch (error) {
        console.error('Error notifying content script:', error);
    }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'playbackChange') {
        handlePlaybackChange(message.data);
    }
});

// Test GraphQL connection function
async function testGraphQLConnection() {
    console.log('Testing GraphQL connection...');
    
    // Test with a simple introspection query
    const testQuery = `
        query TestConnection {
            __schema {
                types {
                    name
                }
            }
        }
    `;
    
    try {
        const result = await executeGraphQL(testQuery);
        console.log('GraphQL Connection Test Result:', result);
        return result;
    } catch (error) {
        console.error('GraphQL Connection Test Failed:', error);
        return { success: false, error: error.message };
    }
}

// Add test button to popup for debugging
function addTestButton() {
    const testButton = document.createElement('button');
    testButton.textContent = 'Test Connection';
    testButton.className = 'button btn-secondary';
    testButton.style.marginTop = '10px';
    testButton.onclick = async () => {
        showLoading('Testing connection...');
        const result = await testGraphQLConnection();
        hideLoading();
        if (result.success) {
            showStatus('GraphQL connection successful!', 'success');
        } else {
            showStatus('GraphQL connection failed: ' + result.error, 'error');
        }
    };
    
    // Add test create room button
    const testCreateButton = document.createElement('button');
    testCreateButton.textContent = 'Test Create Room';
    testCreateButton.className = 'button btn-secondary';
    testCreateButton.style.marginTop = '5px';
    testCreateButton.onclick = async () => {
        showLoading('Testing create room...');
        const testRoomId = 'TEST' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const testUsername = 'TestUser' + Math.floor(Math.random() * 1000);
        const result = await createRoom(testRoomId, testUsername);
        hideLoading();
        if (result.success) {
            showStatus('Create room test successful!', 'success');
            console.log('Test room created:', result.data);
        } else {
            showStatus('Create room test failed: ' + result.error, 'error');
            if (result.details) {
                console.error('Detailed error:', result.details);
            }
        }
    };
    
    // Add to main actions
    const mainActions = document.getElementById('main-actions');
    mainActions.appendChild(testButton);
    mainActions.appendChild(testCreateButton);
}

async function handlePlaybackChange(playbackData) {
    if (currentRoom) {
        try {
            await updatePlayback(currentRoom, playbackData.isPlaying, playbackData.currentTime);
        } catch (error) {
            console.error('Error updating playback:', error);
        }
    }
} 