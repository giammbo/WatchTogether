// GraphQL Client Bundle for WatchTogether Chrome Extension
// Bundled version for client-side use without ES6 modules

(function() {
    'use strict';

    // Configuration helper
    function getGraphQLConfig() {
        // Try to get from extension storage first
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.sync.get(['graphqlServerUrl'], (result) => {
                    const serverUrl = result.graphqlServerUrl || 'http://localhost:4000/graphql';
                    resolve(serverUrl);
                });
            } else {
                // Fallback for testing
                resolve('http://localhost:4000/graphql');
            }
        });
    }

    // Simple WebSocket wrapper for subscriptions
    class WebSocketManager {
        constructor(wsUrl) {
            this.wsUrl = wsUrl;
            this.ws = null;
            this.subscriptions = new Map();
            this.isConnected = false;
            this.reconnectAttempts = 0;
            this.maxReconnectAttempts = 5;
            this.reconnectDelay = 1000;
        }

        async connect() {
            return new Promise((resolve, reject) => {
                try {
                    this.ws = new WebSocket(this.wsUrl);
                    
                    this.ws.onopen = () => {
                        console.log('[GraphQL WS] Connected');
                        this.isConnected = true;
                        this.reconnectAttempts = 0;
                        resolve();
                    };
                    
                    this.ws.onmessage = (event) => {
                        try {
                            const message = JSON.parse(event.data);
                            this.handleMessage(message);
                        } catch (error) {
                            console.error('[GraphQL WS] Failed to parse message:', error);
                        }
                    };
                    
                    this.ws.onclose = () => {
                        console.log('[GraphQL WS] Disconnected');
                        this.isConnected = false;
                        this.attemptReconnect();
                    };
                    
                    this.ws.onerror = (error) => {
                        console.error('[GraphQL WS] Error:', error);
                        reject(error);
                    };
                    
                    // Connection timeout
                    setTimeout(() => {
                        if (!this.isConnected) {
                            reject(new Error('WebSocket connection timeout'));
                        }
                    }, 10000);
                    
                } catch (error) {
                    reject(error);
                }
            });
        }

        attemptReconnect() {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                console.log(`[GraphQL WS] Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                
                setTimeout(() => {
                    this.connect().catch(error => {
                        console.error('[GraphQL WS] Reconnection failed:', error);
                    });
                }, this.reconnectDelay * this.reconnectAttempts);
            } else {
                console.error('[GraphQL WS] Max reconnection attempts reached');
            }
        }

        handleMessage(message) {
            if (message.type === 'data' && message.payload) {
                const { subscription, data } = message.payload;
                const handler = this.subscriptions.get(subscription);
                if (handler) {
                    handler(data);
                }
            }
        }

        subscribe(query, variables, handler) {
            const subscriptionId = 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            this.subscriptions.set(subscriptionId, handler);
            
            if (this.isConnected) {
                this.ws.send(JSON.stringify({
                    type: 'subscription',
                    payload: {
                        query: query,
                        variables: variables,
                        subscriptionId: subscriptionId
                    }
                }));
            }
            
            return subscriptionId;
        }

        unsubscribe(subscriptionId) {
            this.subscriptions.delete(subscriptionId);
            if (this.isConnected) {
                this.ws.send(JSON.stringify({
                    type: 'unsubscribe',
                    payload: { subscriptionId: subscriptionId }
                }));
            }
        }

        disconnect() {
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
            this.subscriptions.clear();
            this.isConnected = false;
        }
    }

    // Simple GraphQL client for Chrome extension
    class GraphQLManager {
        constructor(serverUrl = null) {
            this.serverUrl = serverUrl;
            this.wsUrl = null;
            this.wsManager = null;
            this.roomId = null;
            this.sessionId = null;
            this.isConnected = false;
            this.activeSubscriptions = new Map();
            
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
                
                // Get server URL if not provided
                if (!this.serverUrl) {
                    this.serverUrl = await getGraphQLConfig();
                }
                
                // Setup WebSocket URL
                this.wsUrl = this.serverUrl.replace('http://', 'ws://').replace('https://', 'wss://').replace('/graphql', '/graphql-ws');
                
                // Test HTTP connection first
                const response = await this.query('{ rooms { id userCount } }');
                
                if (response && !response.errors) {
                    console.log('[GraphQL] HTTP connection successful');
                    
                    // Try to establish WebSocket connection for subscriptions
                    try {
                        this.wsManager = new WebSocketManager(this.wsUrl);
                        await this.wsManager.connect();
                        console.log('[GraphQL] WebSocket connection successful');
                    } catch (wsError) {
                        console.warn('[GraphQL] WebSocket connection failed, continuing with HTTP only:', wsError);
                    }
                    
                    this.isConnected = true;
                    this.notifyConnectionStateChange('connected');
                    console.log('[GraphQL] Client initialized successfully');
                    return true;
                } else {
                    throw new Error('GraphQL server not responding correctly');
                }
                
            } catch (error) {
                console.error('[GraphQL] Failed to initialize:', error);
                this.isConnected = false;
                this.notifyConnectionStateChange('error');
                throw error;
            }
        }

        // Execute GraphQL query/mutation
        async query(query, variables = {}) {
            try {
                if (!this.serverUrl) {
                    throw new Error('Server URL not configured');
                }
                
                const response = await fetch(this.serverUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: query,
                        variables: variables
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (result.errors) {
                    console.error('[GraphQL] Query errors:', result.errors);
                    return { errors: result.errors };
                }
                
                return result;
                
            } catch (error) {
                console.error('[GraphQL] Query failed:', error);
                return { errors: [{ message: error.message }] };
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

        // Join room
        async joinRoom(roomId, sessionId, userName) {
            try {
                this.roomId = roomId;
                this.sessionId = sessionId;
                
                const mutation = `
                    mutation JoinRoom($roomId: String!, $sessionId: String!, $userName: String!) {
                        joinRoom(roomId: $roomId, sessionId: $sessionId, userName: $userName) {
                            id
                            sessionId
                            userName
                            joinedAt
                        }
                    }
                `;
                
                const result = await this.query(mutation, {
                    roomId: roomId,
                    sessionId: sessionId,
                    userName: userName
                });
                
                if (result.errors) {
                    throw new Error(result.errors[0].message);
                }
                
                // Set up subscriptions
                this.setupSubscriptions();
                
                return result.data.joinRoom;
                
            } catch (error) {
                console.error('[GraphQL] Failed to join room:', error);
                throw error;
            }
        }

        // Set up real-time subscriptions
        setupSubscriptions() {
            if (!this.wsManager || !this.wsManager.isConnected || !this.roomId) {
                console.warn('[GraphQL] Cannot setup subscriptions - WebSocket not available');
                return;
            }
            
            // Subscribe to chat messages
            const chatSubscription = `
                subscription ChatMessages($roomId: String!) {
                    chatMessageAdded(roomId: $roomId) {
                        id
                        text
                        sender
                        timestamp
                    }
                }
            `;
            
            this.wsManager.subscribe(chatSubscription, { roomId: this.roomId }, (data) => {
                if (data.chatMessageAdded && this.onChatMessage) {
                    this.onChatMessage(data.chatMessageAdded);
                }
            });
            
            // Subscribe to player events
            const playerSubscription = `
                subscription PlayerEvents($roomId: String!) {
                    playerEventAdded(roomId: $roomId) {
                        id
                        event
                        data
                        sessionId
                        timestamp
                    }
                }
            `;
            
            this.wsManager.subscribe(playerSubscription, { roomId: this.roomId }, (data) => {
                if (data.playerEventAdded && this.onPlayerEvent) {
                    this.onPlayerEvent(data.playerEventAdded);
                }
            });
            
            // Subscribe to room updates
            const roomSubscription = `
                subscription RoomUpdates($roomId: String!) {
                    roomUpdated(roomId: $roomId) {
                        id
                        userCount
                        users {
                            id
                            sessionId
                            userName
                            joinedAt
                        }
                    }
                }
            `;
            
            this.wsManager.subscribe(roomSubscription, { roomId: this.roomId }, (data) => {
                if (data.roomUpdated && this.onRoomUpdated) {
                    this.onRoomUpdated(data.roomUpdated);
                }
            });
        }

        // Send chat message
        async sendChatMessage(text) {
            try {
                const mutation = `
                    mutation SendMessage($roomId: String!, $sessionId: String!, $text: String!) {
                        sendMessage(roomId: $roomId, sessionId: $sessionId, text: $text) {
                            id
                            text
                            sender
                            timestamp
                        }
                    }
                `;
                
                const result = await this.query(mutation, {
                    roomId: this.roomId,
                    sessionId: this.sessionId,
                    text: text
                });
                
                if (result.errors) {
                    throw new Error(result.errors[0].message);
                }
                
                return result.data.sendMessage;
                
            } catch (error) {
                console.error('[GraphQL] Failed to send message:', error);
                throw error;
            }
        }

        // Send player event
        async sendPlayerEvent(event, data) {
            try {
                const mutation = `
                    mutation SendPlayerEvent($roomId: String!, $sessionId: String!, $event: String!, $data: String!) {
                        sendPlayerEvent(roomId: $roomId, sessionId: $sessionId, event: $event, data: $data) {
                            id
                            event
                            data
                            sessionId
                            timestamp
                        }
                    }
                `;
                
                const result = await this.query(mutation, {
                    roomId: this.roomId,
                    sessionId: this.sessionId,
                    event: event,
                    data: JSON.stringify(data)
                });
                
                if (result.errors) {
                    throw new Error(result.errors[0].message);
                }
                
                return result.data.sendPlayerEvent;
                
            } catch (error) {
                console.error('[GraphQL] Failed to send player event:', error);
                throw error;
            }
        }

        // Leave room
        async leaveRoom() {
            try {
                if (!this.roomId || !this.sessionId) {
                    return;
                }
                
                const mutation = `
                    mutation LeaveRoom($roomId: String!, $sessionId: String!) {
                        leaveRoom(roomId: $roomId, sessionId: $sessionId)
                    }
                `;
                
                await this.query(mutation, {
                    roomId: this.roomId,
                    sessionId: this.sessionId
                });
                
                // Clean up subscriptions
                if (this.wsManager) {
                    this.wsManager.disconnect();
                }
                
                this.roomId = null;
                this.sessionId = null;
                
            } catch (error) {
                console.error('[GraphQL] Failed to leave room:', error);
            }
        }

        // Get room info
        async getRoomInfo(roomId) {
            try {
                const query = `
                    query GetRoom($roomId: String!) {
                        room(id: $roomId) {
                            id
                            userCount
                            users {
                                id
                                sessionId
                                userName
                                joinedAt
                            }
                        }
                    }
                `;
                
                const result = await this.query(query, { roomId: roomId });
                
                if (result.errors) {
                    throw new Error(result.errors[0].message);
                }
                
                return result.data.room;
                
            } catch (error) {
                console.error('[GraphQL] Failed to get room info:', error);
                throw error;
            }
        }

        // Notify connection state change
        notifyConnectionStateChange(state) {
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(state);
            }
        }

        // Check if connected
        isConnectionActive() {
            return this.isConnected;
        }

        // Destroy client
        destroy() {
            if (this.wsManager) {
                this.wsManager.disconnect();
            }
            this.isConnected = false;
            this.roomId = null;
            this.sessionId = null;
        }
    }

    // Export to global scope for Chrome extension use
    window.GraphQLManager = GraphQLManager;
    
    // Also create a helper for configuration
    window.configureGraphQL = async function(serverUrl) {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            await chrome.storage.sync.set({ graphqlServerUrl: serverUrl });
            console.log('[GraphQL] Server URL configured:', serverUrl);
        }
    };
    
    console.log('[GraphQL] Client bundle loaded');

})(); 