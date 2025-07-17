// WatchTogether Sidebar
// Updated for GraphQL integration

(function() {
    'use strict';

    // State
    let currentRoomId = null;
    let currentSessionId = null;
    let users = [];
    let messages = [];
    let connectionStatus = 'disconnected';
    let isConnected = false;

    // DOM elements
    let chatContainer = null;
    let messageInput = null;
    let sendButton = null;
    let usersList = null;
    let connectionStatusElement = null;
    let roomInfoElement = null;

    // Initialize sidebar
    function initialize() {
        console.log('[WatchTogether Sidebar] Initializing...');
        
        // Get DOM elements
        chatContainer = document.getElementById('chat-messages');
        messageInput = document.getElementById('message-input');
        sendButton = document.getElementById('send-button');
        usersList = document.getElementById('users-list');
        connectionStatusElement = document.getElementById('connection-status');
        roomInfoElement = document.getElementById('room-info');
        
        // Set up event listeners
        setupEventListeners();
        
        // Set up message listener for parent communication
        setupMessageListener();
        
        // Request initial room info
        requestRoomInfo();
        
        console.log('[WatchTogether Sidebar] Initialized');
    }

    // Set up event listeners
    function setupEventListeners() {
        // Send message on Enter key
        messageInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });

        // Send message on button click
        sendButton.addEventListener('click', sendMessage);

        // Toggle sidebar on close button
        document.getElementById('close-button').addEventListener('click', () => {
            window.parent.postMessage({ type: 'toggleSidebar' }, '*');
        });

        // Create new room
        document.getElementById('create-room-button').addEventListener('click', () => {
            window.parent.postMessage({ type: 'createRoom' }, '*');
        });

        // Join room form
        document.getElementById('join-room-form').addEventListener('submit', (event) => {
            event.preventDefault();
            const roomId = document.getElementById('join-room-input').value.trim().toUpperCase();
            if (roomId) {
                window.parent.postMessage({ 
                    type: 'joinRoom', 
                    data: { roomId: roomId } 
                }, '*');
                document.getElementById('join-room-input').value = '';
            }
        });

        // Copy room URL
        document.getElementById('copy-url-button').addEventListener('click', copyRoomURL);
    }

    // Set up message listener
    function setupMessageListener() {
        window.addEventListener('message', (event) => {
            if (event.source !== window.parent) return;

            const { type, data } = event.data;

            switch (type) {
                case 'roomInfo':
                    handleRoomInfo(data);
                    break;
                    
                case 'roomCreated':
                    handleRoomCreated(data.roomId);
                    break;
                    
                case 'roomJoined':
                    handleRoomJoined(data.roomId);
                    break;
                    
                case 'connectionStatus':
                    handleConnectionStatus(data.status);
                    break;
                    
                case 'usersUpdate':
                    handleUsersUpdate(data.users);
                    break;
                    
                case 'chatUpdate':
                    handleChatUpdate(data.messages, data.newMessage);
                    break;
                    
                case 'playerEvent':
                    handlePlayerEvent(data.event);
                    break;
            }
        });
    }

    // Handle room info
    function handleRoomInfo(data) {
        currentRoomId = data.roomId;
        currentSessionId = data.sessionId;
        users = data.users || [];
        messages = data.messages || [];
        connectionStatus = data.connectionStatus || 'disconnected';
        
        updateUI();
        console.log('[WatchTogether Sidebar] Room info received:', data);
    }

    // Handle room created
    function handleRoomCreated(roomId) {
        currentRoomId = roomId;
        users = [];
        messages = [];
        connectionStatus = 'connecting';
        
        updateUI();
        showNotification(`Nuova stanza creata: ${roomId}`, 'success');
        console.log('[WatchTogether Sidebar] Room created:', roomId);
    }

    // Handle room joined
    function handleRoomJoined(roomId) {
        currentRoomId = roomId;
        users = [];
        messages = [];
        connectionStatus = 'connecting';
        
        updateUI();
        showNotification(`Entrato nella stanza: ${roomId}`, 'success');
        console.log('[WatchTogether Sidebar] Room joined:', roomId);
    }

    // Handle connection status
    function handleConnectionStatus(status) {
        connectionStatus = status;
        updateConnectionStatusUI();
        console.log('[WatchTogether Sidebar] Connection status:', status);
    }

    // Handle users update
    function handleUsersUpdate(newUsers) {
        users = newUsers || [];
        updateUsersList();
        console.log('[WatchTogether Sidebar] Users updated:', users);
    }

    // Handle chat update
    function handleChatUpdate(newMessages, newMessage = null) {
        messages = newMessages || [];
        updateChatDisplay();
        
        if (newMessage) {
            showMessageNotification(newMessage);
        }
        
        console.log('[WatchTogether Sidebar] Chat updated:', messages.length, 'messages');
    }

    // Handle player event
    function handlePlayerEvent(event) {
        showPlayerEventNotification(event);
        console.log('[WatchTogether Sidebar] Player event:', event);
    }

    // Send message
    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;

        const sender = 'Tu'; // Could be made configurable
        
        // Send to parent
        window.parent.postMessage({
            type: 'sendChatMessage',
            data: { text, sender }
        }, '*');

        // Clear input
        messageInput.value = '';
        
        console.log('[WatchTogether Sidebar] Message sent:', text);
    }

    // Request room info
    function requestRoomInfo() {
        window.parent.postMessage({ type: 'getRoomInfo' }, '*');
    }

    // Copy room URL
    function copyRoomURL() {
        if (!currentRoomId) {
            showNotification('Nessuna stanza attiva', 'error');
            return;
        }

        const url = new URL(window.location.href);
        url.hash = `room=${currentRoomId}`;
        
        navigator.clipboard.writeText(url.toString()).then(() => {
            showNotification('URL stanza copiato negli appunti!', 'success');
        }).catch(() => {
            showNotification('Errore nel copiare URL', 'error');
        });
    }

    // Update UI
    function updateUI() {
        updateRoomInfo();
        updateConnectionStatusUI();
        updateUsersList();
        updateChatDisplay();
    }

    // Update room info
    function updateRoomInfo() {
        if (roomInfoElement) {
            if (currentRoomId) {
                roomInfoElement.innerHTML = `
                    <div class="room-id">Stanza: ${currentRoomId}</div>
                    <div class="session-id">Tu: ${currentSessionId ? currentSessionId.substring(0, 8) + '...' : 'Sconosciuto'}</div>
                `;
            } else {
                roomInfoElement.innerHTML = '<div class="no-room">Nessuna stanza attiva</div>';
            }
        }
    }

    // Update connection status UI
    function updateConnectionStatusUI() {
        if (connectionStatusElement) {
            let statusText = '';
            let statusClass = '';
            
            switch (connectionStatus) {
                case 'connected':
                    statusText = '🟢 Connesso';
                    statusClass = 'connected';
                    isConnected = true;
                    break;
                case 'connecting':
                    statusText = '🟡 Connessione...';
                    statusClass = 'connecting';
                    isConnected = false;
                    break;
                case 'disconnected':
                    statusText = '🔴 Disconnesso';
                    statusClass = 'disconnected';
                    isConnected = false;
                    break;
                case 'error':
                    statusText = '🔴 Errore';
                    statusClass = 'error';
                    isConnected = false;
                    break;
                default:
                    statusText = '⚪ Sconosciuto';
                    statusClass = 'unknown';
                    isConnected = false;
            }
            
            connectionStatusElement.textContent = statusText;
            connectionStatusElement.className = `status ${statusClass}`;
        }
    }

    // Update users list
    function updateUsersList() {
        if (!usersList) return;

        if (users.length === 0) {
            usersList.innerHTML = '<div class="no-users">Nessun utente connesso</div>';
            return;
        }

        usersList.innerHTML = users.map(user => {
            const isCurrentUser = user.sessionId === currentSessionId;
            const userClass = user.isHost ? 'user-item host' : 'user-item';
            const currentUserText = isCurrentUser ? ' (Tu)' : '';
            const hostText = user.isHost ? ' 👑' : '';
            const lastSeen = new Date(user.lastSeen).toLocaleTimeString('it-IT');
            
            return `
                <div class="${userClass}">
                    <span class="user-name">${user.nickname}${currentUserText}${hostText}</span>
                    <span class="user-time">${lastSeen}</span>
                </div>
            `;
        }).join('');
    }

    // Update chat display
    function updateChatDisplay() {
        if (!chatContainer) return;

        if (messages.length === 0) {
            chatContainer.innerHTML = '<div class="no-messages">Nessun messaggio. Inizia a chattare!</div>';
            return;
        }

        chatContainer.innerHTML = messages.map(message => {
            const time = new Date(message.timestamp).toLocaleTimeString('it-IT');
            const messageClass = message.isLocal ? 'message local' : 'message remote';
            const sender = message.isLocal ? 'Tu' : message.sender;
            
            return `
                <div class="${messageClass}">
                    <div class="message-header">
                        <span class="message-sender">${sender}</span>
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-text">${escapeHtml(message.text)}</div>
                </div>
            `;
        }).join('');

        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Show notification
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    // Show message notification
    function showMessageNotification(message) {
        if (message.isLocal) return; // Don't show notifications for own messages
        
        showNotification(`Nuovo messaggio da ${message.sender}: ${message.text.substring(0, 50)}${message.text.length > 50 ? '...' : ''}`, 'info');
    }

    // Show player event notification
    function showPlayerEventNotification(event) {
        let actionText = '';
        switch (event.action) {
            case 'play':
                actionText = '▶️ Riproduzione';
                break;
            case 'pause':
                actionText = '⏸️ Pausa';
                break;
            case 'seek':
                actionText = '⏩ Avanzamento';
                break;
            default:
                actionText = `🎬 ${event.action}`;
        }
        
        showNotification(`${actionText} da ${event.sender || 'altro utente'}`, 'info');
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})(); 