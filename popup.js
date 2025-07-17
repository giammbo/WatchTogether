// Popup script for WatchTogether extension

class PopupManager {
  constructor() {
    this.elements = {};
    this.currentTab = null;
    this.roomId = null;
    this.graphqlServerUrl = null;
    
    this.initializeElements();
    this.setupEventListeners();
    this.initialize();
  }

  // Initialize DOM element references
  initializeElements() {
    this.elements = {
      // Status elements
      statusIndicator: document.getElementById('statusIndicator'),
      statusText: document.getElementById('statusText'),
      connectedUsers: document.getElementById('connectedUsers'),
      pageType: document.getElementById('pageType'),
      
      // Room elements
      roomId: document.getElementById('roomId'),
      roomDisplay: document.getElementById('roomDisplay'),
      shareableUrl: document.getElementById('shareableUrl'),
      copyButton: document.getElementById('copyButton'),
      newRoomButton: document.getElementById('newRoomButton'),
      
      // Configuration elements
      graphqlServerUrl: document.getElementById('graphqlServerUrl'),
      saveConfigButton: document.getElementById('saveConfigButton'),
      testConnectionButton: document.getElementById('testConnectionButton'),
      configStatusIndicator: document.getElementById('configStatusIndicator'),
      configStatusText: document.getElementById('configStatusText'),
      
      // Message elements
      errorMessage: document.getElementById('errorMessage'),
      successMessage: document.getElementById('successMessage'),
      warningMessage: document.getElementById('warningMessage')
    };
  }

  // Set up event listeners
  setupEventListeners() {
    this.elements.copyButton.addEventListener('click', this.handleCopyLink.bind(this));
    this.elements.newRoomButton.addEventListener('click', this.handleNewRoom.bind(this));
    this.elements.saveConfigButton.addEventListener('click', this.handleSaveConfig.bind(this));
    this.elements.testConnectionButton.addEventListener('click', this.handleTestConnection.bind(this));
    
    // Auto-save on input change (with debounce)
    let saveTimeout;
    this.elements.graphqlServerUrl.addEventListener('input', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        this.handleSaveConfig();
      }, 1000);
    });
  }

  // Initialize popup
  async initialize() {
    try {
      // Load configuration first
      await this.loadConfiguration();
      
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
        this.showWarning('WatchTogether funziona solo su Netflix. Vai su netflix.com per utilizzare l\'estensione.');
        return;
      }

      this.updatePageType('Netflix');

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

  // Load configuration from storage
  async loadConfiguration() {
    try {
      const result = await chrome.storage.sync.get(['graphqlServerUrl']);
      this.graphqlServerUrl = result.graphqlServerUrl || 'http://localhost:4000/graphql';
      this.elements.graphqlServerUrl.value = this.graphqlServerUrl;
      
      // Update configuration status
      this.updateConfigurationStatus();
    } catch (error) {
      console.error('Error loading configuration:', error);
      this.showError('Errore nel caricamento della configurazione');
    }
  }

  // Save configuration to storage
  async handleSaveConfig() {
    try {
      const url = this.elements.graphqlServerUrl.value.trim();
      
      if (!url) {
        this.showError('Inserisci un URL valido');
        return;
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        this.showError('URL non valido. Usa formato: http://localhost:4000/graphql');
        return;
      }

      await chrome.storage.sync.set({ graphqlServerUrl: url });
      this.graphqlServerUrl = url;
      
      this.showSuccess('Configurazione salvata');
      this.updateConfigurationStatus();
      
      // Notify content script about configuration change
      if (this.currentTab && this.isNetflixPage(this.currentTab.url)) {
        try {
          await chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'UPDATE_GRAPHQL_CONFIG',
            serverUrl: url
          });
        } catch (error) {
          console.log('Content script not ready:', error);
        }
      }
      
    } catch (error) {
      console.error('Error saving configuration:', error);
      this.showError('Errore nel salvataggio della configurazione');
    }
  }

  // Test GraphQL connection
  async handleTestConnection() {
    try {
      const url = this.elements.graphqlServerUrl.value.trim();
      
      if (!url) {
        this.showError('Inserisci un URL valido prima di testare');
        return;
      }

      // Update UI to show testing
      this.elements.testConnectionButton.textContent = 'Testing...';
      this.elements.testConnectionButton.disabled = true;
      this.updateConfigStatus('warning', 'Testando connessione...');

      // Test connection with a simple query
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: '{ __schema { queryType { name } } }'
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data && result.data.__schema) {
          this.showSuccess('Connessione al server GraphQL riuscita!');
          this.updateConfigStatus('online', 'Server raggiungibile');
        } else if (result.errors) {
          this.showWarning('Server raggiungibile ma schema GraphQL non valido');
          this.updateConfigStatus('warning', 'Schema non valido');
        } else {
          this.showError('Risposta del server non valida');
          this.updateConfigStatus('offline', 'Risposta non valida');
        }
      } else {
        this.showError(`Errore di connessione: ${response.status} ${response.statusText}`);
        this.updateConfigStatus('offline', 'Connessione fallita');
      }

    } catch (error) {
      console.error('Connection test failed:', error);
      this.showError(`Errore di connessione: ${error.message}`);
      this.updateConfigStatus('offline', 'Errore di connessione');
    } finally {
      // Reset button
      this.elements.testConnectionButton.textContent = 'Test';
      this.elements.testConnectionButton.disabled = false;
    }
  }

  // Update configuration status indicator
  updateConfigurationStatus() {
    if (this.graphqlServerUrl) {
      this.updateConfigStatus('warning', 'Configurato (non testato)');
    } else {
      this.updateConfigStatus('offline', 'Non configurato');
    }
  }

  // Update configuration status
  updateConfigStatus(status, text) {
    this.elements.configStatusIndicator.className = `status-indicator ${status}`;
    this.elements.configStatusText.textContent = text;
  }

  // Check if URL is Netflix
  isNetflixPage(url) {
    return url && url.includes('netflix.com');
  }

  // Get room information from content script
  async getRoomInfo() {
    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'GET_ROOM_INFO'
      });

      if (response && response.success) {
        this.roomId = response.roomId;
        this.updateRoomDisplay();
        this.updateConnectionStatus(response.status, response.userCount || 0);
      } else {
        this.updateConnectionStatus('disconnected', 0);
      }
    } catch (error) {
      console.log('Content script not available:', error);
      this.showWarning('Contenuto script non disponibile. Aggiorna la pagina Netflix.');
      this.updateConnectionStatus('error', 0);
    }
  }

  // Update page type display
  updatePageType(type) {
    this.elements.pageType.textContent = type;
  }

  // Update connection status
  updateConnectionStatus(status, userCount) {
    const statusMap = {
      'connected': { text: 'Connesso', class: 'online' },
      'connecting': { text: 'Connessione...', class: 'warning' },
      'disconnected': { text: 'Disconnesso', class: 'offline' },
      'error': { text: 'Errore', class: 'offline' }
    };

    const statusInfo = statusMap[status] || statusMap['disconnected'];
    
    this.elements.statusIndicator.className = `status-indicator ${statusInfo.class}`;
    this.elements.statusText.textContent = statusInfo.text;
    this.elements.connectedUsers.textContent = userCount.toString();
  }

  // Update room display
  updateRoomDisplay() {
    if (this.roomId) {
      this.elements.roomId.textContent = this.roomId;
      this.elements.shareableUrl.textContent = `${window.location.origin}/netflix.com#room=${this.roomId}`;
      this.elements.roomDisplay.classList.remove('hidden');
      this.elements.copyButton.classList.remove('hidden');
    } else {
      this.elements.roomDisplay.classList.add('hidden');
      this.elements.copyButton.classList.add('hidden');
    }
  }

  // Update status
  updateStatus() {
    // This will be called periodically to refresh status
    this.getRoomInfo();
  }

  // Start periodic updates
  startPeriodicUpdates() {
    setInterval(() => {
      this.updateStatus();
    }, 5000); // Update every 5 seconds
  }

  // Handle copy link
  async handleCopyLink() {
    try {
      if (!this.roomId) {
        this.showError('Nessuna stanza attiva');
        return;
      }

      const shareUrl = `https://www.netflix.com#room=${this.roomId}`;
      await navigator.clipboard.writeText(shareUrl);
      
      this.showSuccess('Link copiato negli appunti!');
      
      // Visual feedback
      const originalText = this.elements.copyButton.textContent;
      this.elements.copyButton.textContent = '✓ Copiato!';
      setTimeout(() => {
        this.elements.copyButton.textContent = originalText;
      }, 2000);
      
    } catch (error) {
      console.error('Failed to copy link:', error);
      this.showError('Errore nella copia del link');
    }
  }

  // Handle new room creation
  async handleNewRoom() {
    try {
      if (!this.currentTab || !this.isNetflixPage(this.currentTab.url)) {
        this.showError('Vai su Netflix per creare una stanza');
        return;
      }

      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'CREATE_ROOM'
      });

      if (response && response.success) {
        this.roomId = response.roomId;
        this.updateRoomDisplay();
        this.showSuccess(`Nuova stanza creata: ${response.roomId}`);
      } else {
        this.showError('Errore nella creazione della stanza');
      }
      
    } catch (error) {
      console.error('Failed to create room:', error);
      this.showError('Errore nella creazione della stanza');
    }
  }

  // Show error message
  showError(message) {
    this.hideAllMessages();
    this.elements.errorMessage.textContent = message;
    this.elements.errorMessage.classList.remove('hidden');
    setTimeout(() => {
      this.elements.errorMessage.classList.add('hidden');
    }, 5000);
  }

  // Show success message
  showSuccess(message) {
    this.hideAllMessages();
    this.elements.successMessage.textContent = message;
    this.elements.successMessage.classList.remove('hidden');
    setTimeout(() => {
      this.elements.successMessage.classList.add('hidden');
    }, 3000);
  }

  // Show warning message
  showWarning(message) {
    this.hideAllMessages();
    this.elements.warningMessage.textContent = message;
    this.elements.warningMessage.classList.remove('hidden');
    setTimeout(() => {
      this.elements.warningMessage.classList.add('hidden');
    }, 5000);
  }

  // Hide all messages
  hideAllMessages() {
    this.elements.errorMessage.classList.add('hidden');
    this.elements.successMessage.classList.add('hidden');
    this.elements.warningMessage.classList.add('hidden');
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
}); 