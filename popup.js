// Popup script for WatchTogether extension

class PopupManager {
  constructor() {
    this.elements = {};
    this.currentTab = null;
    this.roomId = null;
    
    this.initializeElements();
    this.setupEventListeners();
    this.initialize();
  }

  // Initialize DOM element references
  initializeElements() {
    this.elements = {
      statusIndicator: document.getElementById('statusIndicator'),
      statusText: document.getElementById('statusText'),
      connectedUsers: document.getElementById('connectedUsers'),
      pageType: document.getElementById('pageType'),
      roomId: document.getElementById('roomId'),
      shareableUrl: document.getElementById('shareableUrl'),
      copyButton: document.getElementById('copyButton'),
      newRoomButton: document.getElementById('newRoomButton'),
      errorMessage: document.getElementById('errorMessage'),
      successMessage: document.getElementById('successMessage')
    };
  }

  // Set up event listeners
  setupEventListeners() {
    this.elements.copyButton.addEventListener('click', this.handleCopyLink.bind(this));
    this.elements.newRoomButton.addEventListener('click', this.handleNewRoom.bind(this));
  }

  // Initialize popup
  async initialize() {
    try {
      // Get current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tabs[0];
      
      if (!this.currentTab) {
        this.showError('Impossibile ottenere informazioni sulla tab corrente');
        return;
      }

      // Check if we're on Netflix
      if (!this.isNetflixPage(this.currentTab.url)) {
        this.updatePageType('Non Netflix');
        this.showError('WatchTogether funziona solo su Netflix');
        return;
      }

      // Get room ID from content script
      await this.getRoomInfo();
      
      // Update status
      this.updateStatus();
      
      // Set up periodic updates
      this.startPeriodicUpdates();
      
    } catch (error) {
      console.error('Error initializing popup:', error);
      this.showError('Errore durante l\'inizializzazione');
    }
  }

  // Check if URL is Netflix
  isNetflixPage(url) {
    return url && url.includes('netflix.com');
  }

  // Get room information from content script
  async getRoomInfo() {
    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'GET_ROOM_ID'
      });
      
      if (response && response.roomId) {
        this.roomId = response.roomId;
        this.elements.roomId.textContent = this.roomId;
      } else {
        this.elements.roomId.textContent = 'Nessuna stanza';
      }
      
      // Get shareable URL
      const urlResponse = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'GET_SHAREABLE_URL'
      });
      
      if (urlResponse && urlResponse.url) {
        this.elements.shareableUrl.textContent = urlResponse.url;
      } else {
        this.elements.shareableUrl.textContent = this.currentTab.url || 'URL non disponibile';
      }
      
    } catch (error) {
      console.error('Error getting room info:', error);
      this.elements.roomId.textContent = 'Content script non attivo';
      this.elements.shareableUrl.textContent = 'URL non disponibile';
      this.showError('Content script non trovato. Ricarica la pagina Netflix.');
    }
  }

  // Update connection status
  async updateStatus() {
    try {
      // Check if content script is available
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'GET_STATUS'
      });
      
      if (response) {
        this.updateConnectionStatus(response.status);
        this.elements.connectedUsers.textContent = response.connectedUsers || '0';
        this.updatePageType(response.pageType || 'Sconosciuta');
      } else {
        this.updateConnectionStatus('disconnected');
        this.elements.connectedUsers.textContent = '0';
        this.updatePageType('Non inizializzato');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      this.updateConnectionStatus('disconnected');
      this.elements.connectedUsers.textContent = '0';
      this.updatePageType('Content script non attivo');
    }
  }

  // Update connection status indicator
  updateConnectionStatus(status) {
    const indicator = this.elements.statusIndicator;
    const text = this.elements.statusText;
    
    // Remove all status classes
    indicator.classList.remove('connected', 'connecting', 'ready');
    
    switch (status) {
      case 'connected':
        indicator.classList.add('connected');
        text.textContent = 'Connesso';
        break;
      case 'connecting':
        indicator.classList.add('connecting');
        text.textContent = 'Connessione...';
        break;
      case 'ready':
        indicator.classList.add('ready');
        text.textContent = 'Pronto';
        break;
      case 'error':
        text.textContent = 'Errore';
        break;
      default:
        text.textContent = 'Disconnesso';
    }
  }

  // Update page type
  updatePageType(type) {
    this.elements.pageType.textContent = type;
  }

  // Handle copy link button
  async handleCopyLink() {
    try {
      if (!this.currentTab) {
        this.showError('Impossibile copiare il link');
        return;
      }

      // Get shareable URL from content script
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'GET_SHAREABLE_URL'
      });
      
      if (response && response.url) {
        await navigator.clipboard.writeText(response.url);
        this.showSuccess('Link copiato negli appunti!');
        console.log('Copied shareable URL:', response.url);
      } else {
        // Fallback to current tab URL if content script doesn't respond
        await navigator.clipboard.writeText(this.currentTab.url);
        this.showSuccess('Link copiato negli appunti! (fallback)');
        console.log('Copied fallback URL:', this.currentTab.url);
      }
      
    } catch (error) {
      console.error('Error copying link:', error);
      this.showError('Errore nel copiare il link');
    }
  }

  // Handle new room button
  async handleNewRoom() {
    try {
      // Generate new room ID
      const newRoomId = this.generateRoomId();
      
      // Send to content script
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'SET_ROOM_ID',
        roomId: newRoomId
      });
      
      if (response && response.success) {
        this.roomId = newRoomId;
        this.elements.roomId.textContent = this.roomId;
        this.showSuccess('Nuova stanza creata!');
        
        // Update shareable URL
        const urlResponse = await chrome.tabs.sendMessage(this.currentTab.id, {
          action: 'GET_SHAREABLE_URL'
        });
        
        if (urlResponse && urlResponse.url) {
          this.elements.shareableUrl.textContent = urlResponse.url;
        }
        
        // Update status to reflect the new room
        setTimeout(() => {
          this.updateStatus();
        }, 500);
        
      } else {
        this.showError('Errore nella creazione della nuova stanza');
      }
      
    } catch (error) {
      console.error('Error creating new room:', error);
      this.showError('Errore nella creazione della nuova stanza');
    }
  }

  // Generate a new room ID
  generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Show error message
  showError(message) {
    this.elements.errorMessage.textContent = message;
    this.elements.errorMessage.classList.remove('hidden');
    this.elements.successMessage.classList.add('hidden');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.elements.errorMessage.classList.add('hidden');
    }, 5000);
  }

  // Show success message
  showSuccess(message) {
    this.elements.successMessage.textContent = message;
    this.elements.successMessage.classList.remove('hidden');
    this.elements.errorMessage.classList.add('hidden');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.elements.successMessage.classList.add('hidden');
    }, 3000);
  }

  // Start periodic status updates
  startPeriodicUpdates() {
    // Update status every 2 seconds
    setInterval(() => {
      this.updateStatus();
    }, 2000);
  }

  // Cleanup
  destroy() {
    // Clear any intervals if needed
    console.log('Popup manager destroyed');
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.popupManager = new PopupManager();
});

// Cleanup on popup close
window.addEventListener('beforeunload', () => {
  if (window.popupManager) {
    window.popupManager.destroy();
  }
}); 