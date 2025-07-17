# WatchTogether - Chrome Extension

Un'estensione Chrome per guardare Netflix in sincronia con amici, con chat in tempo reale e sincronizzazione del player tramite GraphQL.

## 🚀 Caratteristiche

- **Sincronizzazione Player**: Play, pause e seek sincronizzati tra tutti i partecipanti
- **Chat in Tempo Reale**: Chat integrata per commentare durante la visione
- **Senza Login**: Nessuna registrazione richiesta, funziona immediatamente
- **GraphQL Backend**: Server GraphQL moderno con subscriptions per comunicazione real-time
- **Cross-Browser**: Funziona tra diverse finestre e modalità incognito
- **URL Sharing**: Condividi facilmente l'URL della stanza con amici

## 📦 Installazione

### 1. Installazione Estensione

1. Scarica o clona questo repository
2. Apri Chrome e vai su `chrome://extensions/`
3. Abilita la "Modalità sviluppatore" (toggle in alto a destra)
4. Clicca "Carica estensione non pacchettizzata"
5. Seleziona la cartella dell'estensione
6. L'estensione "WatchTogether" apparirà nella barra degli strumenti

### 2. Server GraphQL (Opzionale)

Per la sincronizzazione remota, avvia il server GraphQL:

```bash
# Installa dipendenze
npm install

# Avvia il server GraphQL
npm start

# Oppure in modalità sviluppo
npm run dev
```

Il server GraphQL sarà disponibile su `http://localhost:4000/graphql`

## 🎯 Utilizzo

### Creazione Stanza

1. Vai su Netflix e apri un film o serie TV
2. Clicca sull'icona WatchTogether nella barra degli strumenti
3. Clicca "Crea Stanza" per generare un nuovo room ID
4. L'URL verrà aggiornato con il room ID (es: `#room=ABC123`)
5. Condividi l'URL con i tuoi amici

### Partecipazione

1. Apri l'URL condiviso su Netflix
2. L'estensione si connetterà automaticamente alla stanza
3. La sidebar apparirà con la chat e le informazioni della stanza
4. Inizia a guardare! Le azioni del player saranno sincronizzate

### Controlli

- **Play/Pause**: Sincronizzato automaticamente
- **Seek**: Sincronizzato automaticamente
- **Chat**: Scrivi messaggi nella sidebar
- **Stato Connessione**: Visualizzato nella sidebar

## 🧪 Testing

### Test GraphQL

Apri `test-graphql.html` nel browser per testare la connessione GraphQL:

```bash
# Avvia il server GraphQL
npm start

# Apri test-graphql.html nel browser
open test-graphql.html
```

## 🔧 Sviluppo

### Struttura Progetto

```
netflix-shared-chat/
├── manifest.json              # Configurazione estensione
├── content.js                 # Script principale (iniettato in Netflix)
├── sidebar.js                 # Gestione sidebar
├── sidebar.html               # Interfaccia sidebar
├── sidebar.css                # Stili sidebar
├── popup.js                   # Script del popup
├── popup.html                 # Interfaccia del popup
├── background.js              # Service worker
├── graphql-client-bundle.js   # Client GraphQL bundle
├── graphql-server.js          # Server GraphQL
├── package.json               # Dipendenze Node.js
├── test-graphql.html          # Pagina di test GraphQL
└── icons/                     # Icone dell'estensione
```

### Tecnologie

- **Frontend**: JavaScript vanilla, Chrome Extension APIs
- **Backend**: Node.js, Express, Apollo Server
- **Real-time**: GraphQL Subscriptions
- **Storage**: localStorage/sessionStorage per sincronizzazione locale

### GraphQL Schema

```graphql
type User {
  sessionId: String!
  roomId: String!
  nickname: String
  lastSeen: String!
  isHost: Boolean!
}

type Message {
  id: String!
  text: String!
  sender: String!
  sessionId: String!
  timestamp: String!
  roomId: String!
}

type PlayerEvent {
  id: String!
  action: String!
  currentTime: Float!
  timestamp: String!
  sessionId: String!
  roomId: String!
}

type Room {
  id: String!
  users: [User!]!
  messages: [Message!]!
  playerEvents: [PlayerEvent!]!
  userCount: Int!
}
```

### Mutations Principali

- `joinRoom(roomId, sessionId, nickname)`: Entra in una stanza
- `leaveRoom(sessionId)`: Esce da una stanza
- `sendMessage(roomId, sessionId, text, sender)`: Invia messaggio chat
- `sendPlayerEvent(roomId, sessionId, action, currentTime)`: Invia evento player

### Subscriptions

- `userJoined(roomId)`: Nuovo utente connesso
- `userLeft(roomId)`: Utente disconnesso
- `messageReceived(roomId)`: Nuovo messaggio chat
- `playerEventReceived(roomId)`: Nuovo evento player
- `roomUpdated(roomId)`: Aggiornamento stanza

## 🚀 Deployment

### Server GraphQL

Per il deployment in produzione:

1. **Hosting**: Deploy su servizi come Heroku, Railway, o VPS
2. **Database**: Sostituisci storage in-memory con Redis o database
3. **SSL**: Configura HTTPS per WebSocket sicuri
4. **Environment**: Imposta variabili d'ambiente

```bash
# Esempio deployment Heroku
heroku create watchtogether-graphql
git push heroku main
```

### Estensione

1. Aggiorna l'URL del server GraphQL in `content.js`
2. Crea un file ZIP dell'estensione
3. Pubblica su Chrome Web Store

## 🔍 Troubleshooting

### Problemi Comuni

**Estensione non si carica**
- Verifica che il manifest.json sia valido
- Controlla la console per errori JavaScript
- Assicurati che l'estensione sia abilitata

**Sincronizzazione non funziona**
- Verifica che il server GraphQL sia in esecuzione
- Controlla la connessione di rete
- Verifica che l'URL contenga il room ID corretto

**Chat non funziona**
- Verifica le subscriptions GraphQL
- Controlla la console per errori di connessione
- Assicurati che il server supporti WebSocket

**Player non si sincronizza**
- Verifica che Netflix sia completamente caricato
- Controlla che gli eventi player vengano intercettati
- Verifica la connessione GraphQL

### Debug

1. Apri gli strumenti di sviluppo (F12)
2. Vai alla scheda "Console"
3. Cerca messaggi con prefisso `[WatchTogether]` o `[GraphQL]`
4. Usa `test-graphql.html` per testare la connessione

## 📋 Roadmap

### Prossime Funzionalità

- [ ] **Persistenza Messaggi**: Salvataggio chat su database
- [ ] **Ruoli Utente**: Host con controlli avanzati
- [ ] **Emoji Chat**: Supporto emoji nei messaggi
- [ ] **Notifiche**: Notifiche push per nuovi messaggi
- [ ] **Storia Chat**: Caricamento messaggi precedenti
- [ ] **File Sharing**: Condivisione file nella chat
- [ ] **Voice Chat**: Chat vocale integrata
- [ ] **Screen Sharing**: Condivisione schermo
- [ ] **Mobile App**: App mobile complementare

### Miglioramenti Tecnici

- [ ] **Database**: Migrazione da storage in-memory a PostgreSQL
- [ ] **Caching**: Implementazione Redis per performance
- [ ] **Scalabilità**: Load balancing per multiple istanze
- [ ] **Sicurezza**: Autenticazione e autorizzazione
- [ ] **Monitoring**: Logging e metriche avanzate
- [ ] **Testing**: Test automatizzati completi

## 🤝 Contribuire

1. Fork il repository
2. Crea un branch per la tua feature (`git checkout -b feature/AmazingFeature`)
3. Commit le modifiche (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

## 📄 Licenza

Questo progetto è sotto licenza MIT. Vedi il file `LICENSE` per dettagli.

## 🙏 Ringraziamenti

- Netflix per l'API player
- Apollo GraphQL per il framework
- Chrome Extension APIs
- Community open source

---

**Nota**: Questa estensione è per uso educativo e personale. Rispetta i termini di servizio di Netflix. 