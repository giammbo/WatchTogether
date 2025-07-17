// GraphQL Client Bundle for WatchTogether Chrome Extension
// Bundled version for client-side use without ES6 modules

(function() {
    'use strict';

    // Simple GraphQL client for Chrome extension
    class GraphQLManager {
        constructor(serverUrl = 'https://your-graphql-server.com/graphql') {
            this.serverUrl = serverUrl;
            this.wsUrl = serverUrl.replace('https', 'wss').replace('http', 'ws');
            this.client = null;
            this.subscriptions = new Map();
            this.roomId = null;
            this.sessionId = null;
            this.isConnected = false;
            this.wsConnection = null;
            this.subscriptionId = 0;
            
            // Event callbacks
            this.onPlayerEvent = null;
            this.onChatMessage = null;
            this.onUserJoined = null;
            this.onUserLeft = null;
            this.onRoomUpdated = null;
            this.onConnectionStateChange = null;
            
            console.log('[GraphQL] Manager initialized');
        }

        // Initialize GraphQL client
        async initialize() {
            try {
                console.log('[GraphQL] Initializing client...');
                
                // Test connection with a simple query
                const response = await fetch(this.serverUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: '{ rooms { id userCount } }'
                    })
                });
                
                if (response.ok) {
                    this.isConnected = true;
                    this.notifyConnectionStateChange('connected');
                    console.log('[GraphQL] Client initialized successfully');
                    return true;
                } else {
                    throw new Error('Failed to connect to GraphQL server');
                }
                
            } catch (error) {
                console.error('[GraphQL] Failed to initialize client:', error);
                this.isConnected = false;
                this.notifyConnectionStateChange('error');
                throw error;
            }
        }

        // Initialize WebSocket for subscriptions
        async initializeWebSocket() {
            try {
                console.log('[GraphQL] Initializing WebSocket...');
                
                this.wsConnection = new WebSocket(this.wsUrl, 'graphql-transport-ws');
                
                this.wsConnection.onopen = () => {
                    console.log('[GraphQL] WebSocket connected');
                    this.sendWebSocketMessage({
                        type: 'connection_init',
                        payload: {
                            sessionId: this.sessionId
                        }
                    });
                };
                
                this.wsConnection.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(message);
                };
                
                this.wsConnection.onclose = () => {
                    console.log('[GraphQL] WebSocket disconnected');
                    this.isConnected = false;
                    this.notifyConnectionStateChange('disconnected');
                };
                
                this.wsConnection.onerror = (error) => {
                    console.error('[GraphQL] WebSocket error:', error);
                    this.notifyConnectionStateChange('error');
                };
                
            } catch (error) {
                console.error('[GraphQL] Failed to initialize WebSocket:', error);
                throw error;
            }
        }

        // Send WebSocket message
        sendWebSocketMessage(message) {
            if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
                this.wsConnection.send(JSON.stringify(message));
            }
        }

        // Handle WebSocket message
        handleWebSocketMessage(message) {
            switch (message.type) {
                case 'connection_ack':
                    console.log('[GraphQL] WebSocket connection acknowledged');
                    this.setupSubscriptions();
                    break;
                    
                case 'next':
                    this.handleSubscriptionData(message.payload);
                    break;
                    
                case 'error':
                    console.error('[GraphQL] WebSocket error:', message.payload);
                    break;
                    
                case 'complete':
                    console.log('[GraphQL] Subscription completed:', message.id);
                    break;
            }
        }

        // Handle subscription data
        handleSubscriptionData(data) {
            if (data.data) {
                const subscriptionData = data.data;
                
                if (subscriptionData.userJoined && subscriptionData.userJoined.roomId === this.roomId) {
                    const user = subscriptionData.userJoined;
                    if (user.sessionId !== this.sessionId) {
                        console.log('[GraphQL] User joined:', user);
                        this.onUserJoined && this.onUserJoined(user);
                    }
                }
                
                if (subscriptionData.userLeft && subscriptionData.userLeft.roomId === this.roomId) {
                    const user = subscriptionData.userLeft;
                    if (user.sessionId !== this.sessionId) {
                        console.log('[GraphQL] User left:', user);
                        this.onUserLeft && this.onUserLeft(user);
                    }
                }
                
                if (subscriptionData.messageReceived && subscriptionData.messageReceived.roomId === this.roomId) {
                    const message = subscriptionData.messageReceived;
                    if (message.sessionId !== this.sessionId) {
                        console.log('[GraphQL] Message received:', message);
                        this.onChatMessage && this.onChatMessage(message);
                    }
                }
                
                if (subscriptionData.playerEventReceived && subscriptionData.playerEventReceived.roomId === this.roomId) {
                    const event = subscriptionData.playerEventReceived;
                    if (event.sessionId !== this.sessionId) {
                        console.log('[GraphQL] Player event received:', event);
                        this.onPlayerEvent && this.onPlayerEvent(event);
                    }
                }
                
                if (subscriptionData.roomUpdated && subscriptionData.roomUpdated.id === this.roomId) {
                    const room = subscriptionData.roomUpdated;
                    console.log('[GraphQL] Room updated:', room);
                    this.onRoomUpdated && this.onRoomUpdated(room);
                }
            }
        }

        // Join room
        async joinRoom(roomId, sessionId, nickname = null) {
            this.roomId = roomId;
            this.sessionId = sessionId;
            
            try {
                console.log(`[GraphQL] Joining room ${roomId} with session ${sessionId}`);
                
                const mutation = `
                    mutation JoinRoom($roomId: String!, $sessionId: String!, $nickname: String) {
                        joinRoom(roomId: $roomId, sessionId: $sessionId, nickname: $nickname) {
                            sessionId
                            roomId
                            nickname
                            lastSeen
                            isHost
                        }
                    }
                `;
                
                const response = await fetch(this.serverUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: mutation,
                        variables: { roomId, sessionId, nickname }
                    })
                });
                
                const result = await response.json();
                
                if (result.errors) {
                    throw new Error(result.errors[0].message);
                }
                
                console.log('[GraphQL] Successfully joined room:', result.data.joinRoom);
                
                // Initialize WebSocket for subscriptions
                await this.initializeWebSocket();
                
                // Start heartbeat
                this.startHeartbeat();
                
                return result.data.joinRoom;
                
            } catch (error) {
                console.error('[GraphQL] Failed to join room:', error);
                throw error;
            }
        }

        // Leave room
        async leaveRoom() {
            if (!this.sessionId) {
                return false;
            }
            
            try {
                console.log(`[GraphQL] Leaving room ${this.roomId}`);
                
                const mutation = `
                    mutation LeaveRoom($sessionId: String!) {
                        leaveRoom(sessionId: $sessionId)
                    }
                `;
                
                const response = await fetch(this.serverUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: mutation,
                        variables: { sessionId: this.sessionId }
                    })
                });
                
                const result = await response.json();
                
                // Clean up subscriptions
                this.cleanupSubscriptions();
                
                // Stop heartbeat
                this.stopHeartbeat();
                
                // Close WebSocket
                if (this.wsConnection) {
                    this.wsConnection.close();
                    this.wsConnection = null;
                }
                
                this.roomId = null;
                this.sessionId = null;
                
                console.log('[GraphQL] Successfully left room');
                return result.data.leaveRoom;
                
            } catch (error) {
                console.error('[GraphQL] Failed to leave room:', error);
                return false;
            }
        }

        // Send chat message
        async sendChatMessage(text, sender) {
            if (!this.roomId || !this.sessionId) {
                throw new Error('Not connected to any room');
            }
            
            try {
                const mutation = `
                    mutation SendMessage($roomId: String!, $sessionId: String!, $text: String!, $sender: String!) {
                        sendMessage(roomId: $roomId, sessionId: $sessionId, text: $text, sender: $sender) {
                            id
                            text
                            sender
                            sessionId
                            timestamp
                            roomId
                        }
                    }
                `;
                
                const response = await fetch(this.serverUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: mutation,
                        variables: {
                            roomId: this.roomId,
                            sessionId: this.sessionId,
                            text,
                            sender
                        }
                    })
                });
                
                const result = await response.json();
                
                if (result.errors) {
                    throw new Error(result.errors[0].message);
                }
                
                console.log('[GraphQL] Message sent:', result.data.sendMessage);
                return result.data.sendMessage;
                
            } catch (error) {
                console.error('[GraphQL] Failed to send message:', error);
                throw error;
            }
        }

        // Send player event
        async sendPlayerEvent(action, currentTime) {
            if (!this.roomId || !this.sessionId) {
                throw new Error('Not connected to any room');
            }
            
            try {
                const mutation = `
                    mutation SendPlayerEvent($roomId: String!, $sessionId: String!, $action: String!, $currentTime: Float!) {
                        sendPlayerEvent(roomId: $roomId, sessionId: $sessionId, action: $action, currentTime: $currentTime) {
                            id
                            action
                            currentTime
                            timestamp
                            sessionId
                            roomId
                        }
                    }
                `;
                
                const response = await fetch(this.serverUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: mutation,
                        variables: {
                            roomId: this.roomId,
                            sessionId: this.sessionId,
                            action,
                            currentTime
                        }
                    })
                });
                
                const result = await response.json();
                
                if (result.errors) {
                    throw new Error(result.errors[0].message);
                }
                
                console.log('[GraphQL] Player event sent:', result.data.sendPlayerEvent);
                return result.data.sendPlayerEvent;
                
            } catch (error) {
                console.error('[GraphQL] Failed to send player event:', error);
                throw error;
            }
        }

        // Update user nickname
        async updateNickname(nickname) {
            if (!this.sessionId) {
                throw new Error('Not connected');
            }
            
            try {
                const mutation = `
                    mutation UpdateUser($sessionId: String!, $nickname: String!) {
                        updateUser(sessionId: $sessionId, nickname: $nickname) {
                            sessionId
                            roomId
                            nickname
                            lastSeen
                            isHost
                        }
                    }
                `;
                
                const response = await fetch(this.serverUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: mutation,
                        variables: {
                            sessionId: this.sessionId,
                            nickname
                        }
                    })
                });
                
                const result = await response.json();
                
                if (result.errors) {
                    throw new Error(result.errors[0].message);
                }
                
                console.log('[GraphQL] User updated:', result.data.updateUser);
                return result.data.updateUser;
                
            } catch (error) {
                console.error('[GraphQL] Failed to update user:', error);
                throw error;
            }
        }

        // Get room information
        async getRoomInfo() {
            if (!this.roomId) {
                throw new Error('Not connected to any room');
            }
            
            try {
                const query = `
                    query GetRoom($roomId: String!) {
                        room(roomId: $roomId) {
                            id
                            userCount
                            users {
                                sessionId
                                roomId
                                nickname
                                lastSeen
                                isHost
                            }
                            messages {
                                id
                                text
                                sender
                                sessionId
                                timestamp
                                roomId
                            }
                            playerEvents {
                                id
                                action
                                currentTime
                                timestamp
                                sessionId
                                roomId
                            }
                        }
                    }
                `;
                
                const response = await fetch(this.serverUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query,
                        variables: { roomId: this.roomId }
                    })
                });
                
                const result = await response.json();
                
                if (result.errors) {
                    throw new Error(result.errors[0].message);
                }
                
                return result.data.room;
                
            } catch (error) {
                console.error('[GraphQL] Failed to get room info:', error);
                throw error;
            }
        }

        // Set up subscriptions
        setupSubscriptions() {
            if (!this.roomId) return;
            
            console.log('[GraphQL] Setting up subscriptions for room:', this.roomId);
            
            // Subscribe to user joined events
            this.subscribe('userJoined', `
                subscription UserJoined($roomId: String!) {
                    userJoined(roomId: $roomId) {
                        sessionId
                        roomId
                        nickname
                        lastSeen
                        isHost
                    }
                }
            `, { roomId: this.roomId });
            
            // Subscribe to user left events
            this.subscribe('userLeft', `
                subscription UserLeft($roomId: String!) {
                    userLeft(roomId: $roomId) {
                        sessionId
                        roomId
                        nickname
                        lastSeen
                        isHost
                    }
                }
            `, { roomId: this.roomId });
            
            // Subscribe to chat messages
            this.subscribe('messageReceived', `
                subscription MessageReceived($roomId: String!) {
                    messageReceived(roomId: $roomId) {
                        id
                        text
                        sender
                        sessionId
                        timestamp
                        roomId
                    }
                }
            `, { roomId: this.roomId });
            
            // Subscribe to player events
            this.subscribe('playerEventReceived', `
                subscription PlayerEventReceived($roomId: String!) {
                    playerEventReceived(roomId: $roomId) {
                        id
                        action
                        currentTime
                        timestamp
                        sessionId
                        roomId
                    }
                }
            `, { roomId: this.roomId });
            
            // Subscribe to room updates
            this.subscribe('roomUpdated', `
                subscription RoomUpdated($roomId: String!) {
                    roomUpdated(roomId: $roomId) {
                        id
                        userCount
                        users {
                            sessionId
                            roomId
                            nickname
                            lastSeen
                            isHost
                        }
                    }
                }
            `, { roomId: this.roomId });
        }

        // Subscribe to GraphQL subscription
        subscribe(name, query, variables) {
            if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
                console.warn('[GraphQL] WebSocket not connected, cannot subscribe');
                return;
            }
            
            const id = (++this.subscriptionId).toString();
            
            this.sendWebSocketMessage({
                id: id,
                type: 'subscribe',
                payload: {
                    query: query,
                    variables: variables
                }
            });
            
            this.subscriptions.set(name, id);
            console.log(`[GraphQL] Subscribed to ${name} with id ${id}`);
        }

        // Clean up subscriptions
        cleanupSubscriptions() {
            console.log('[GraphQL] Cleaning up subscriptions');
            
            this.subscriptions.forEach((id, name) => {
                this.sendWebSocketMessage({
                    id: id,
                    type: 'complete'
                });
                console.log(`[GraphQL] Unsubscribed from ${name}`);
            });
            
            this.subscriptions.clear();
        }

        // Start heartbeat
        startHeartbeat() {
            this.heartbeatInterval = setInterval(async () => {
                if (this.sessionId) {
                    try {
                        const mutation = `
                            mutation Heartbeat($sessionId: String!) {
                                heartbeat(sessionId: $sessionId)
                            }
                        `;
                        
                        await fetch(this.serverUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                query: mutation,
                                variables: { sessionId: this.sessionId }
                            })
                        });
                    } catch (error) {
                        console.error('[GraphQL] Heartbeat failed:', error);
                    }
                }
            }, 30000); // Every 30 seconds
        }

        // Stop heartbeat
        stopHeartbeat() {
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = null;
            }
        }

        // Set event callbacks
        setCallbacks(callbacks) {
            this.onPlayerEvent = callbacks.onPlayerEvent;
            this.onChatMessage = callbacks.onChatMessage;
            this.onUserJoined = callbacks.onUserJoined;
            this.onUserLeft = callbacks.onUserLeft;
            this.onRoomUpdated = callbacks.onRoomUpdated;
            this.onConnectionStateChange = callbacks.onConnectionStateChange;
        }

        // Notify connection state change
        notifyConnectionStateChange(state) {
            this.onConnectionStateChange && this.onConnectionStateChange(state);
        }

        // Get connection state
        getConnectionState() {
            return this.isConnected ? 'connected' : 'disconnected';
        }

        // Get current room ID
        getRoomId() {
            return this.roomId;
        }

        // Get current session ID
        getSessionId() {
            return this.sessionId;
        }

        // Check if connected
        isConnectedToRoom() {
            return this.isConnected && this.roomId && this.sessionId;
        }

        // Cleanup
        destroy() {
            console.log('[GraphQL] Destroying manager...');
            
            // Leave room if connected
            if (this.isConnectedToRoom()) {
                this.leaveRoom();
            }
            
            // Clean up subscriptions
            this.cleanupSubscriptions();
            
            // Stop heartbeat
            this.stopHeartbeat();
            
            // Close WebSocket
            if (this.wsConnection) {
                this.wsConnection.close();
                this.wsConnection = null;
            }
            
            this.isConnected = false;
            console.log('[GraphQL] Manager destroyed');
        }
    }

    // Export for use in Chrome extension
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = GraphQLManager;
    } else {
        window.GraphQLManager = GraphQLManager;
    }

})(); 