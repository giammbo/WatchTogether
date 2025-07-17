# WatchTogether - Chrome Extension

Estensione Chrome per guardare Netflix sincronizzato con amici in tempo reale, con chat integrata.

## 🚀 Caratteristiche

- **Sincronizzazione video**: Play, pause, seek sincronizzati tra tutti gli utenti
- **Chat in tempo reale**: Comunicazione istantanea durante la visione
- **Completamente client-side**: Nessun server di backend richiesto per l'estensione
- **GraphQL esterno**: Supporto per server GraphQL personalizzati
- **Fallback offline**: Funziona in modalità locale se GraphQL non è disponibile
- **UI moderna**: Interfaccia elegante e responsive

## 📋 Requisiti

- Chrome/Chromium browser
- Connessione internet per sincronizzazione remota
- Server GraphQL esterno (opzionale)

## 🛠️ Installazione

### 1. Scaricare l'estensione

```bash
git clone https://github.com/yourusername/netflix-shared-chat.git
cd netflix-shared-chat
```

### 2. Configurare le dipendenze (solo per sviluppo)

```bash
npm install
```

### 3. Caricare l'estensione in Chrome

1. Apri Chrome e vai a `chrome://extensions/`
2. Abilita "Modalità sviluppatore" (Developer mode)
3. Clicca "Carica estensione non compressa" (Load unpacked)
4. Seleziona la cartella del progetto
5. L'estensione apparirà nella barra degli strumenti

## ⚙️ Configurazione Server GraphQL

### Configurazione tramite Popup

1. Clicca sull'icona dell'estensione nella barra degli strumenti
2. Nella sezione "Configurazione Server", inserisci l'URL del tuo server GraphQL
3. Formato: `http://localhost:4000/graphql` o `https://your-server.com/graphql`
4. Clicca "Salva" e poi "Test" per verificare la connessione

### Server GraphQL Richiesto

Il server GraphQL deve implementare questo schema:

```graphql
type Query {
  rooms: [Room!]!
  room(id: String!): Room
}

type Mutation {
  joinRoom(roomId: String!, sessionId: String!, userName: String!): User!
  leaveRoom(roomId: String!, sessionId: String!): Boolean!
  sendMessage(roomId: String!, sessionId: String!, text: String!): Message!
  sendPlayerEvent(roomId: String!, sessionId: String!, event: String!, data: String!): PlayerEvent!
}

type Subscription {
  chatMessageAdded(roomId: String!): Message!
  playerEventAdded(roomId: String!): PlayerEvent!
  roomUpdated(roomId: String!): Room!
}

type Room {
  id: String!
  userCount: Int!
  users: [User!]!
}

type User {
  id: String!
  sessionId: String!
  userName: String!
  joinedAt: String!
}

type Message {
  id: String!
  text: String!
  sender: String!
  timestamp: String!
}

type PlayerEvent {
  id: String!
  event: String!
  data: String!
  sessionId: String!
  timestamp: String!
}
```

### Server di Esempio

Puoi utilizzare il server GraphQL incluso per testing:

```bash
node graphql-server.js
```

Il server sarà disponibile su `http://localhost:4000/graphql`

## 🎬 Come Utilizzare

### 1. Aprire Netflix

Vai su [Netflix](https://netflix.com) e scegli un video da guardare.

### 2. Aprire l'estensione

- Clicca sull'icona WatchTogether nella barra degli strumenti
- Oppure usa la scorciatoia `Ctrl+Shift+W` per aprire/chiudere la sidebar

### 3. Creare o Unirsi a una Stanza

**Creare una nuova stanza:**
1. Clicca "Crea Nuova Stanza" nel popup
2. Condividi l'ID stanza o il link con i tuoi amici

**Unirsi a una stanza:**
1. I tuoi amici possono inserire l'ID stanza nella sidebar
2. Oppure utilizzare il link diretto: `https://netflix.com#room=ABCDE`

### 4. Guardare Insieme

- Tutti i controlli video (play, pause, seek) sono sincronizzati automaticamente
- Usa la chat per comunicare durante la visione
- Gli utenti connessi sono visibili nella sidebar

## 🔧 Modalità Funzionamento

### Con Server GraphQL (Raccomandato)

- Sincronizzazione in tempo reale tra dispositivi diversi
- Chat globale tra tutti gli utenti
- Funziona tra città/paesi diversi
- Gestione avanzata degli utenti

### Modalità Fallback (LocalStorage)

- Funziona solo su stesso browser/dispositivo
- Sincronizzazione locale tra tab
- Chat salvata localmente
- Backup automatico quando GraphQL non è disponibile

## 📁 Struttura del Progetto

```
netflix-shared-chat/
├── manifest.json              # Configurazione estensione Chrome
├── content.js                 # Script principale dell'estensione
├── background.js              # Service worker dell'estensione
├── popup.html/js              # Popup di configurazione
├── sidebar.html/css/js        # Interfaccia chat laterale
├── graphql-client-bundle.js   # Client GraphQL bundled
├── graphql-server.js          # Server GraphQL di esempio
├── test-graphql.html          # Pagina di test GraphQL
└── icons/                     # Icone dell'estensione
```

## 🔍 Debugging

### 1. Console Browser

Apri gli strumenti di sviluppo di Chrome (`F12`) e controlla i log:

```javascript
// Log dell'estensione iniziano con:
[WatchTogether] ...
[GraphQL] ...
```

### 2. Pagina di Test

Apri `test-graphql.html` nel browser per testare direttamente il client GraphQL.

### 3. Stato dell'Estensione

Il popup mostra sempre lo stato corrente:
- **Configurazione Server**: URL e stato connessione GraphQL
- **Stato Connessione**: Online/Offline/Errore
- **Utenti Connessi**: Numero di partecipanti
- **ID Stanza**: Stanza corrente

## ⚠️ Risoluzione Problemi

### Estensione non carica

1. Verifica che la "Modalità sviluppatore" sia abilitata in `chrome://extensions/`
2. Ricarica l'estensione cliccando sul pulsante di refresh
3. Controlla la console per errori

### GraphQL non si connette

1. Verifica che l'URL del server sia corretto
2. Assicurati che il server sia in esecuzione
3. Controlla i CORS sul server GraphQL
4. Usa il pulsante "Test" nel popup per diagnosticare

### Video non sincronizzati

1. Verifica che tutti gli utenti siano connessi alla stessa stanza
2. Controlla che il server GraphQL funzioni correttamente
3. In caso di problemi, l'estensione userà automaticamente il fallback localStorage

### Chat non funziona

1. Verifica la connessione WebSocket al server GraphQL
2. Controlla che le subscription siano supportate dal server
3. In modalità fallback, la chat funziona solo localmente

## 🔐 Privacy e Sicurezza

- **Nessun dato personale**: L'estensione non raccoglie informazioni personali
- **Solo Netflix**: Funziona esclusivamente su netflix.com
- **Dati temporanei**: Chat e sessioni sono temporanee
- **Server opzionale**: Funziona anche senza server esterno

## 🚀 Sviluppo Avanzato

### Personalizzare il Client GraphQL

Il file `graphql-client-bundle.js` può essere modificato per:
- Aggiungere nuove query/mutation
- Personalizzare la gestione errori
- Implementare retry logic
- Aggiungere autenticazione

### Estendere le Funzionalità

Puoi modificare:
- `content.js`: Logica principale e sincronizzazione
- `sidebar.js`: Interfaccia chat e utenti
- `popup.js`: Configurazione e stato
- `background.js`: Service worker e notifiche

## 📄 Licenza

MIT License - vedi [LICENSE](LICENSE) per dettagli.

## 🤝 Contribuire

1. Fork del progetto
2. Crea un branch per la feature (`git checkout -b feature/nuova-feature`)
3. Commit delle modifiche (`git commit -am 'Aggiungi nuova feature'`)
4. Push del branch (`git push origin feature/nuova-feature`)
5. Apri una Pull Request

## 📞 Supporto

- **Issues**: Apri un issue su GitHub per bug o richieste di feature
- **Discussions**: Usa le discussioni per domande generali
- **Wiki**: Consulta la wiki per documentazione avanzata

---

**Nota**: Questa estensione è completamente client-side e non richiede installazione di server per funzionare. Il server GraphQL è opzionale e può essere ospitato ovunque tu preferisca. 