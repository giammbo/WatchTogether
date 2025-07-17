// WatchTogether Content Script
// Integrates GraphQL for remote synchronization

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        SIDEBAR_WIDTH: 350,
        SIDEBAR_Z_INDEX: 9999,
        POLLING_INTERVAL: 1000,
        PLAYER_SYNC_INTERVAL: 500,
        CHAT_POLLING_INTERVAL: 1000
    };

    // Global state
    let currentRoomId = null;
    let currentSessionId = null;
    let sidebar = null;
    let sidebarIframe = null;
    let isSidebarOpen = false;
    let graphqlManager = null;
    let isGraphQLEnabled = false;
    let lastPlayerEvent = null;
    let isRemoteEvent = false;
    let chatMessages = [];
    let playerEvents = [];
    let users = [];
    let connectionStatus = 'disconnected';

    // Initialize GraphQL manager
    function initializeGraphQL() {
        try {
            console.log('[WatchTogether] Initializing GraphQL manager...');
            
            // Load GraphQL client from bundled file
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('graphql-client-bundle.js');
            script.onload = () => {
                if (window.GraphQLManager) {
                    // GraphQL manager will get server URL from extension storage
                    graphqlManager = new window.GraphQLManager();
                    
                    // Set up callbacks
                    graphqlManager.setCallbacks({
                        onPlayerEvent: handleRemotePlayerEvent,
                        onChatMessage: handleRemoteChatMessage,
                        onUserJoined: handleUserJoined,
                        onUserLeft: handleUserLeft,
                        onRoomUpdated: handleRoomUpdated,
                        onConnectionStateChange: handleConnectionStateChange
                    });
                    
                    console.log('[WatchTogether] GraphQL manager initialized');
                    isGraphQLEnabled = true;
                    
                    // Try to connect if we have a room ID
                    if (currentRoomId) {
                        connectToGraphQLRoom();
                    }
                } else {
                    console.error('[WatchTogether] GraphQLManager not found');
                    // Fall back to localStorage mode
                    console.log('[WatchTogether] Falling back to localStorage mode');
                }
            };
            script.onerror = () => {
                console.error('[WatchTogether] Failed to load GraphQL client');
            };
            document.head.appendChild(script);
            
        } catch (error) {
            console.error('[WatchTogether] Failed to initialize GraphQL:', error);
        }
    }

    // Connect to GraphQL room
    async function connectToGraphQLRoom() {
        if (!graphqlManager || !currentRoomId || !currentSessionId) {
            return;
        }
        
        try {
            console.log(`[WatchTogether] Connecting to GraphQL room: ${currentRoomId}`);
            
            // Initialize GraphQL client
            await graphqlManager.initialize();
            
            // Join room
            const user = await graphqlManager.joinRoom(currentRoomId, currentSessionId, 'User');
            
            console.log('[WatchTogether] Connected to GraphQL room:', user);
            
            // Update sidebar with connection status
            updateSidebarConnectionStatus('connected');
            
            // Get initial room info
            await updateRoomInfoFromGraphQL();
            
        } catch (error) {
            console.error('[WatchTogether] Failed to connect to GraphQL room:', error);
            updateSidebarConnectionStatus('error');
        }
    }

    // Handle remote player event
    function handleRemotePlayerEvent(event) {
        console.log('[WatchTogether] Remote player event received:', event);
        
        isRemoteEvent = true;
        
        // Apply player event
        const video = getNetflixVideo();
        if (video) {
            switch (event.action) {
                case 'play':
                    video.play();
                    break;
                case 'pause':
                    video.pause();
                    break;
                case 'seek':
                    video.currentTime = event.currentTime;
                    break;
            }
        }
        
        // Update sidebar
        updateSidebarPlayerEvent(event);
        
        // Reset flag after a short delay
        setTimeout(() => {
            isRemoteEvent = false;
        }, 100);
    }

    // Handle remote chat message
    function handleRemoteChatMessage(message) {
        console.log('[WatchTogether] Remote chat message received:', message);
        
        chatMessages.push({
            id: message.id,
            text: message.text,
            sender: message.sender,
            timestamp: new Date(message.timestamp),
            isLocal: false
        });
        
        // Update sidebar
        updateSidebarChat(message);
    }

    // Handle user joined
    function handleUserJoined(user) {
        console.log('[WatchTogether] User joined:', user);
        
        users.push(user);
        updateSidebarUsers();
    }

    // Handle user left
    function handleUserLeft(user) {
        console.log('[WatchTogether] User left:', user);
        
        users = users.filter(u => u.sessionId !== user.sessionId);
        updateSidebarUsers();
    }

    // Handle room updated
    function handleRoomUpdated(room) {
        console.log('[WatchTogether] Room updated:', room);
        
        users = room.users || [];
        updateSidebarUsers();
    }

    // Handle connection state change
    function handleConnectionStateChange(state) {
        console.log('[WatchTogether] Connection state changed:', state);
        
        connectionStatus = state;
        updateSidebarConnectionStatus(state);
    }

    // Update room info from GraphQL
    async function updateRoomInfoFromGraphQL() {
        if (!graphqlManager || !currentRoomId) {
            return;
        }
        
        try {
            const roomInfo = await graphqlManager.getRoomInfo();
            
            users = roomInfo.users || [];
            chatMessages = roomInfo.messages || [];
            playerEvents = roomInfo.playerEvents || [];
            
            updateSidebarUsers();
            updateSidebarChat();
            
        } catch (error) {
            console.error('[WatchTogether] Failed to get room info:', error);
        }
    }

    // Send player event via GraphQL
    async function sendPlayerEventViaGraphQL(action, currentTime) {
        if (!graphqlManager || !currentRoomId || isRemoteEvent) {
            return;
        }
        
        try {
            await graphqlManager.sendPlayerEvent(action, currentTime);
            console.log(`[WatchTogether] Player event sent via GraphQL: ${action}`);
        } catch (error) {
            console.error('[WatchTogether] Failed to send player event via GraphQL:', error);
        }
    }

    // Send chat message via GraphQL
    async function sendChatMessageViaGraphQL(text, sender) {
        if (!graphqlManager || !currentRoomId) {
            return;
        }
        
        try {
            const message = await graphqlManager.sendChatMessage(text, sender);
            console.log('[WatchTogether] Chat message sent via GraphQL:', message);
            
            // Add to local messages
            chatMessages.push({
                id: message.id,
                text: message.text,
                sender: message.sender,
                timestamp: new Date(message.timestamp),
                isLocal: true
            });
            
        } catch (error) {
            console.error('[WatchTogether] Failed to send chat message via GraphQL:', error);
        }
    }

    // Update sidebar connection status
    function updateSidebarConnectionStatus(status) {
        if (sidebarIframe && sidebarIframe.contentWindow) {
            sidebarIframe.contentWindow.postMessage({
                type: 'connectionStatus',
                status: status
            }, '*');
        }
    }

    // Update sidebar users
    function updateSidebarUsers() {
        if (sidebarIframe && sidebarIframe.contentWindow) {
            sidebarIframe.contentWindow.postMessage({
                type: 'usersUpdate',
                users: users
            }, '*');
        }
    }

    // Update sidebar chat
    function updateSidebarChat(message = null) {
        if (sidebarIframe && sidebarIframe.contentWindow) {
            sidebarIframe.contentWindow.postMessage({
                type: 'chatUpdate',
                messages: chatMessages,
                newMessage: message
            }, '*');
        }
    }

    // Update sidebar player event
    function updateSidebarPlayerEvent(event) {
        if (sidebarIframe && sidebarIframe.contentWindow) {
            sidebarIframe.contentWindow.postMessage({
                type: 'playerEvent',
                event: event
            }, '*');
        }
    }

    // Initialize the extension
    function initialize() {
        console.log('[WatchTogether] Content script starting...');
        
        // Generate session ID
        currentSessionId = 'session_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        
        // Extract room ID from URL
        extractRoomIdFromURL();
        
        // Initialize GraphQL
        initializeGraphQL();
        
        // Create sidebar
        createSidebar();
        
        // Set up player sync
        setupPlayerSync();
        
        // Set up message listener
        setupMessageListener();
        
        // Set up URL change listener
        setupURLChangeListener();
        
        console.log('[WatchTogether] Content script initialized');
        console.log(`[WatchTogether] Room ID: ${currentRoomId} Session ID: ${currentSessionId}`);
    }

    // Extract room ID from URL
    function extractRoomIdFromURL() {
        const hash = window.location.hash;
        const roomMatch = hash.match(/#room=([A-Z0-9]+)/);
        
        if (roomMatch) {
            currentRoomId = roomMatch[1];
            console.log(`[WatchTogether] Room ID extracted from URL: ${currentRoomId}`);
        } else {
            // Generate new room ID if none exists
            currentRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            console.log(`[WatchTogether] New room ID generated: ${currentRoomId}`);
        }
    }

    // Create sidebar
    function createSidebar() {
        // Remove existing sidebar if any
        const existingSidebar = document.getElementById('watchtogether-sidebar');
        if (existingSidebar) {
            existingSidebar.remove();
        }

        // Create sidebar container
        sidebar = document.createElement('div');
        sidebar.id = 'watchtogether-sidebar';
        sidebar.style.cssText = `
            position: fixed;
            top: 0;
            right: -${CONFIG.SIDEBAR_WIDTH}px;
            width: ${CONFIG.SIDEBAR_WIDTH}px;
            height: 100vh;
            background: #141414;
            border-left: 1px solid #333;
            z-index: ${CONFIG.SIDEBAR_Z_INDEX};
            transition: right 0.3s ease;
            font-family: 'Netflix Sans', Arial, sans-serif;
            color: white;
        `;

        // Create iframe for sidebar content
        sidebarIframe = document.createElement('iframe');
        sidebarIframe.src = chrome.runtime.getURL('sidebar.html');
        sidebarIframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            background: #141414;
        `;

        sidebar.appendChild(sidebarIframe);
        document.body.appendChild(sidebar);

        console.log('[WatchTogether] Sidebar elements created');
    }

    // Toggle sidebar
    function toggleSidebar() {
        if (!sidebar) return;

        isSidebarOpen = !isSidebarOpen;
        
        if (isSidebarOpen) {
            sidebar.style.right = '0px';
            console.log('[WatchTogether] Sidebar opened');
        } else {
            sidebar.style.right = `-${CONFIG.SIDEBAR_WIDTH}px`;
            console.log('[WatchTogether] Sidebar closed');
        }
    }

    // Get Netflix video element
    function getNetflixVideo() {
        return document.querySelector('video');
    }

    // Setup player synchronization
    function setupPlayerSync() {
        const video = getNetflixVideo();
        if (!video) {
            console.log('[WatchTogether] No video element found, retrying...');
            setTimeout(setupPlayerSync, 1000);
            return;
        }

        console.log('[WatchTogether] Setting up player sync for room:', currentRoomId);

        // Listen for player events
        video.addEventListener('play', () => {
            if (!isRemoteEvent) {
                const event = {
                    action: 'play',
                    currentTime: video.currentTime,
                    timestamp: new Date().toISOString()
                };
                
                // Send via GraphQL if available
                if (isGraphQLEnabled && graphqlManager) {
                    sendPlayerEventViaGraphQL('play', video.currentTime);
                } else {
                    // Fallback to localStorage
                    broadcastPlayerEvent(event);
                }
                
                console.log('[WatchTogether] Play event broadcasted');
            }
        });

        video.addEventListener('pause', () => {
            if (!isRemoteEvent) {
                const event = {
                    action: 'pause',
                    currentTime: video.currentTime,
                    timestamp: new Date().toISOString()
                };
                
                // Send via GraphQL if available
                if (isGraphQLEnabled && graphqlManager) {
                    sendPlayerEventViaGraphQL('pause', video.currentTime);
                } else {
                    // Fallback to localStorage
                    broadcastPlayerEvent(event);
                }
                
                console.log('[WatchTogether] Pause event broadcasted');
            }
        });

        video.addEventListener('seeked', () => {
            if (!isRemoteEvent) {
                const event = {
                    action: 'seek',
                    currentTime: video.currentTime,
                    timestamp: new Date().toISOString()
                };
                
                // Send via GraphQL if available
                if (isGraphQLEnabled && graphqlManager) {
                    sendPlayerEventViaGraphQL('seek', video.currentTime);
                } else {
                    // Fallback to localStorage
                    broadcastPlayerEvent(event);
                }
                
                console.log('[WatchTogether] Seek event broadcasted');
            }
        });

        // Poll for remote events (fallback for localStorage)
        if (!isGraphQLEnabled) {
            setInterval(() => {
                pollForPlayerEvents();
            }, CONFIG.PLAYER_SYNC_INTERVAL);
        }
    }

    // Broadcast player event (localStorage fallback)
    function broadcastPlayerEvent(event) {
        const eventData = {
            ...event,
            roomId: currentRoomId,
            sessionId: currentSessionId
        };
        
        localStorage.setItem(`watchtogether_player_${currentRoomId}`, JSON.stringify(eventData));
        sessionStorage.setItem(`watchtogether_player_${currentRoomId}`, JSON.stringify(eventData));
    }

    // Poll for player events (localStorage fallback)
    function pollForPlayerEvents() {
        const eventData = localStorage.getItem(`watchtogether_player_${currentRoomId}`);
        if (eventData) {
            const event = JSON.parse(eventData);
            
            if (event.sessionId !== currentSessionId && event.timestamp !== lastPlayerEvent?.timestamp) {
                lastPlayerEvent = event;
                handleRemotePlayerEvent(event);
            }
        }
    }

    // Setup message listener
    function setupMessageListener() {
        window.addEventListener('message', (event) => {
            if (event.source !== sidebarIframe?.contentWindow) return;

            const { type, data } = event.data;

            switch (type) {
                case 'sendChatMessage':
                    if (isGraphQLEnabled && graphqlManager) {
                        sendChatMessageViaGraphQL(data.text, data.sender);
                    } else {
                        // Fallback to localStorage
                        sendChatMessage(data.text, data.sender);
                    }
                    break;
                    
                case 'toggleSidebar':
                    toggleSidebar();
                    break;
                    
                case 'getRoomInfo':
                    const roomInfo = {
                        roomId: currentRoomId,
                        sessionId: currentSessionId,
                        users: users,
                        messages: chatMessages,
                        connectionStatus: connectionStatus
                    };
                    sidebarIframe.contentWindow.postMessage({
                        type: 'roomInfo',
                        data: roomInfo
                    }, '*');
                    break;
                    
                case 'createRoom':
                    createNewRoom();
                    break;
                    
                case 'joinRoom':
                    joinRoom(data.roomId);
                    break;
            }
        });
    }

    // Setup URL change listener
    function setupURLChangeListener() {
        let currentURL = window.location.href;
        
        setInterval(() => {
            if (window.location.href !== currentURL) {
                currentURL = window.location.href;
                console.log('[WatchTogether] URL changed, checking for room ID...');
                
                const oldRoomId = currentRoomId;
                extractRoomIdFromURL();
                
                if (currentRoomId !== oldRoomId) {
                    console.log(`[WatchTogether] Room ID changed from ${oldRoomId} to ${currentRoomId}`);
                    
                    // Leave old room if connected to GraphQL
                    if (isGraphQLEnabled && graphqlManager && oldRoomId) {
                        graphqlManager.leaveRoom();
                    }
                    
                    // Connect to new room
                    if (isGraphQLEnabled && graphqlManager && currentRoomId) {
                        connectToGraphQLRoom();
                    }
                    
                    // Reload sidebar
                    if (sidebarIframe) {
                        sidebarIframe.src = sidebarIframe.src;
                    }
                    
                    // Clear local data
                    chatMessages = [];
                    users = [];
                    playerEvents = [];
                }
            }
        }, 1000);
    }

    // Create new room
    function createNewRoom() {
        currentRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Update URL
        const url = new URL(window.location);
        url.hash = `room=${currentRoomId}`;
        window.history.replaceState({}, '', url);
        
        console.log(`[WatchTogether] New room created: ${currentRoomId}`);
        
        // Connect to GraphQL if available
        if (isGraphQLEnabled && graphqlManager) {
            connectToGraphQLRoom();
        }
        
        // Update sidebar
        if (sidebarIframe && sidebarIframe.contentWindow) {
            sidebarIframe.contentWindow.postMessage({
                type: 'roomCreated',
                roomId: currentRoomId
            }, '*');
        }
    }

    // Join room
    function joinRoom(roomId) {
        currentRoomId = roomId;
        
        // Update URL
        const url = new URL(window.location);
        url.hash = `room=${currentRoomId}`;
        window.history.replaceState({}, '', url);
        
        console.log(`[WatchTogether] Joined room: ${currentRoomId}`);
        
        // Connect to GraphQL if available
        if (isGraphQLEnabled && graphqlManager) {
            connectToGraphQLRoom();
        }
        
        // Update sidebar
        if (sidebarIframe && sidebarIframe.contentWindow) {
            sidebarIframe.contentWindow.postMessage({
                type: 'roomJoined',
                roomId: currentRoomId
            }, '*');
        }
    }

    // Send chat message (localStorage fallback)
    function sendChatMessage(text, sender) {
        const message = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
            text: text,
            sender: sender,
            timestamp: new Date().toISOString(),
            roomId: currentRoomId,
            sessionId: currentSessionId
        };
        
        // Store in localStorage
        const messages = JSON.parse(localStorage.getItem(`watchtogether_chat_${currentRoomId}`) || '[]');
        messages.push(message);
        
        // Keep only last 50 messages
        if (messages.length > 50) {
            messages.splice(0, messages.length - 50);
        }
        
        localStorage.setItem(`watchtogether_chat_${currentRoomId}`, JSON.stringify(messages));
        
        // Add to local array
        chatMessages.push({
            id: message.id,
            text: message.text,
            sender: message.sender,
            timestamp: new Date(message.timestamp),
            isLocal: true
        });
        
        console.log('[WatchTogether] Chat message sent:', message);
    }

    // Keyboard shortcut to toggle sidebar
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.shiftKey && event.key === 'W') {
            event.preventDefault();
            toggleSidebar();
        }
    });

    // Chrome extension message listener for popup communication
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('[WatchTogether] Received message from popup:', request);
        
        switch (request.action) {
            case 'GET_ROOM_INFO':
                sendResponse({
                    success: true,
                    roomId: currentRoomId,
                    status: connectionStatus,
                    userCount: users.length,
                    isGraphQLEnabled: isGraphQLEnabled
                });
                break;
                
            case 'CREATE_ROOM':
                const roomId = generateRoomId();
                createRoom(roomId);
                sendResponse({
                    success: true,
                    roomId: roomId
                });
                break;
                
            case 'UPDATE_GRAPHQL_CONFIG':
                if (request.serverUrl && graphqlManager) {
                    console.log('[WatchTogether] Updating GraphQL server URL:', request.serverUrl);
                    graphqlManager.serverUrl = request.serverUrl;
                    // Reconnect if we have a room
                    if (currentRoomId) {
                        connectToGraphQLRoom();
                    }
                }
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
        
        return true; // Keep message channel open for async response
    });

    // Generate room ID helper
    function generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Create room with specific ID
    function createRoom(roomId = null) {
        currentRoomId = roomId || generateRoomId();
        
        // Update URL
        const url = new URL(window.location);
        url.hash = `room=${currentRoomId}`;
        window.history.replaceState({}, '', url);
        
        console.log(`[WatchTogether] Room created: ${currentRoomId}`);
        
        // Connect to GraphQL if available
        if (isGraphQLEnabled && graphqlManager) {
            connectToGraphQLRoom();
        }
        
        // Update sidebar
        if (sidebarIframe && sidebarIframe.contentWindow) {
            sidebarIframe.contentWindow.postMessage({
                type: 'roomCreated',
                roomId: currentRoomId
            }, '*');
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (isGraphQLEnabled && graphqlManager) {
            graphqlManager.destroy();
        }
    });

})(); 