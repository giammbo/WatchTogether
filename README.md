# Netflix Watch Party Chrome Extension

A Chrome Extension that allows multiple users to watch Netflix together in sync via a "Watch Party" mode. This extension provides real-time synchronization of playback state between participants without requiring a separate backend server.

## 🌟 Features

- **Real-time Sync**: Synchronize play, pause, and seek actions between all participants
- **Easy Sharing**: Generate shareable URLs for friends to join your watch party
- **Auto-join**: Automatically join watch parties via URL parameters
- **Session Persistence**: Remember your watch party session across browser restarts
- **Minimal UI**: Clean, Netflix-themed popup interface
- **No Backend Required**: All logic runs client-side with GraphQL integration

## 🏗️ Architecture

- **Client-side Only**: No backend server required
- **GraphQL Integration**: Uses AWS AppSync for room management and state synchronization
- **Chrome Extension**: Manifest V3 compliant
- **Content Script Injection**: Hooks into Netflix's video player
- **Real-time Updates**: Polling-based synchronization (can be upgraded to WebSocket)

## 📦 Files Structure

```
netflix-shared-chat/
├── manifest.json          # Chrome Extension manifest
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic and GraphQL operations
├── content.js            # Content script for Netflix integration
├── background.js         # Background service worker
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

## 🚀 Installation

### Prerequisites

1. **Chrome Browser**: Version 88 or higher
2. **AWS AppSync**: Configured GraphQL endpoint with the following schema:

```graphql
type Room {
  id: ID!
  users: [String!]!
  playbackState: PlaybackState
}

type PlaybackState {
  isPlaying: Boolean!
  currentTime: Float!
  updatedAt: AWSDateTime!
}

type Mutation {
  createRoom(id: ID!, username: String!): Room!
  joinRoom(id: ID!, username: String!): Room!
  updatePlayback(id: ID!, state: PlaybackStateInput!): PlaybackState!
}

input PlaybackStateInput {
  isPlaying: Boolean!
  currentTime: Float!
}

type Subscription {
  onPlaybackUpdated(id: ID!): PlaybackState!
    @aws_subscribe(mutations: ["updatePlayback"])
}

type Query {
  getRoom(id: ID!): Room
}
```

### Setup Steps

1. **Configure GraphQL Endpoint**:
   - Open `popup.js`
   - Replace `APPSYNC_ENDPOINT` with your AWS AppSync GraphQL endpoint
   - Replace `APPSYNC_API_KEY` with your API key

2. **Load Extension in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the extension directory

3. **Grant Permissions**:
   - The extension will request permissions for Netflix and storage
   - Click "Allow" when prompted

## 🎬 Usage Guide

### Creating a Watch Party

1. **Navigate to Netflix**: Go to any Netflix movie or TV show
2. **Start Playback**: Begin playing the content
3. **Open Extension**: Click the extension icon in your Chrome toolbar
4. **Create Party**: Click "Create Watch Party"
5. **Share URL**: Copy the generated URL and share it with friends

### Joining a Watch Party

1. **Receive URL**: Get the watch party URL from a friend
2. **Navigate to Netflix**: Go to the same Netflix title
3. **Join via Extension**:
   - Option A: Paste the URL in your browser (auto-join)
   - Option B: Open extension popup and click "Join Watch Party"
4. **Enter Room ID**: Input the room ID from the URL
5. **Start Watching**: Your playback will sync with the host

### Synchronization Features

- **Play/Pause Sync**: When any participant plays or pauses, all others follow
- **Time Sync**: Seeking in one player syncs to all participants
- **Auto-recovery**: Reconnects automatically if connection is lost
- **Session Persistence**: Remembers your room across browser restarts

## 🔧 Configuration

### GraphQL Endpoint Setup

Update the following constants in `popup.js`:

```javascript
const APPSYNC_ENDPOINT = 'https://your-appsync-endpoint.amazonaws.com/graphql';
const APPSYNC_API_KEY = 'your-api-key';
```

### Customization Options

- **Sync Interval**: Modify the polling interval in `popup.js` (default: 1 second)
- **Time Threshold**: Adjust sync sensitivity in `content.js` (default: 2 seconds)
- **UI Styling**: Customize colors and layout in `popup.html`

## 🛠️ Development

### Local Development

1. **Clone Repository**: Download the extension files
2. **Modify Code**: Make your changes to the JavaScript files
3. **Reload Extension**: Go to `chrome://extensions/` and click "Reload"
4. **Test**: Navigate to Netflix and test the functionality

### Debugging

- **Console Logs**: Check browser console for detailed logs
- **Extension Logs**: View logs in `chrome://extensions/` → "Details" → "Inspect views"
- **Content Script**: Use `window.netflixWatchParty` in Netflix console for debugging

### Testing

The extension includes several debugging utilities:

```javascript
// In Netflix console
window.netflixWatchParty.getCurrentVideoInfo()  // Get current video state
window.netflixWatchParty.isInWatchParty()       // Check if in watch party
window.netflixWatchParty.currentRoom()          // Get current room ID
window.netflixWatchParty.currentUser()          // Get current username
```

## 🔒 Security Considerations

- **API Keys**: Store API keys securely and rotate regularly
- **CORS**: Ensure AppSync is configured to allow requests from Chrome extensions
- **Data Privacy**: No personal data is stored beyond session information
- **Permissions**: Extension only requests necessary permissions

## 🐛 Troubleshooting

### Common Issues

1. **Extension Not Loading**:
   - Check manifest.json syntax
   - Ensure all files are present
   - Verify Chrome version compatibility

2. **GraphQL Errors**:
   - Verify endpoint URL and API key
   - Check CORS configuration
   - Ensure schema matches requirements

3. **Video Not Syncing**:
   - Check if video element is detected
   - Verify content script is injected
   - Check console for error messages

4. **Connection Issues**:
   - Verify internet connection
   - Check AppSync endpoint availability
   - Review browser console for network errors

### Error Messages

- **"Failed to create watch party"**: Check GraphQL endpoint and API key
- **"Video element not found"**: Ensure you're on a Netflix video page
- **"Connection lost"**: Check network connectivity and AppSync status

## 📝 API Reference

### GraphQL Operations

#### Create Room
```graphql
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
```

#### Join Room
```graphql
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
```

#### Update Playback
```graphql
mutation UpdatePlayback($id: ID!, $state: PlaybackStateInput!) {
  updatePlayback(id: $id, state: { isPlaying: $state.isPlaying, currentTime: $state.currentTime }) {
    isPlaying
    currentTime
    updatedAt
  }
}
```

### Chrome Extension APIs

- **chrome.storage.local**: Session persistence
- **chrome.tabs**: Tab management and messaging
- **chrome.runtime**: Extension lifecycle and messaging
- **chrome.scripting**: Content script injection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Netflix for providing the video platform
- AWS AppSync for real-time GraphQL capabilities
- Chrome Extension API for the development framework

## 📞 Support

For issues and questions:
- Check the troubleshooting section
- Review console logs for error details
- Ensure all prerequisites are met
- Verify GraphQL endpoint configuration

---

**Note**: This extension is for educational and personal use. Please respect Netflix's terms of service and use responsibly. 