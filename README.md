# Netflix Watch Party Chrome Extension

A client-side only Chrome extension that enables synchronized Netflix viewing between multiple users through GraphQL (AWS AppSync).

## Features

- 🎬 Create or join watch parties with a simple click
- 🔄 Real-time synchronization of play/pause and seek events
- 👥 Multiple users can watch the same content simultaneously
- 🔗 Share watch party links with friends
- 🚀 No backend required (uses AWS AppSync GraphQL)
- 💻 Desktop Chrome only

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The Netflix Watch Party icon should appear in your Chrome toolbar

## Configuration

Before using the extension, you need to configure the GraphQL endpoint:

1. Open `popup.js` and `content.js`
2. Replace the following values:
   ```javascript
   const GRAPHQL_ENDPOINT = 'https://your-appsync-endpoint.appsync-api.us-east-1.amazonaws.com/graphql';
   const GRAPHQL_API_KEY = 'YOUR_API_KEY_HERE';
   ```

## Usage

### Creating a Watch Party

1. Navigate to Netflix and start playing any movie or TV show
2. Click the Netflix Watch Party extension icon
3. Click "Create Watch Party"
4. A shareable URL will be generated (e.g., `https://watchparty.fake/join?id=ABCD1234`)
5. Copy and share this URL with friends

### Joining a Watch Party

1. Receive a watch party URL from the host
2. Navigate to the same Netflix title
3. Click the extension icon
4. Click "Join Watch Party"
5. Paste the URL and click "Join"
6. Playback will automatically sync with other participants

## GraphQL Schema

The extension expects the following GraphQL operations to be available on your AppSync endpoint:

### Mutations

```graphql
mutation CreateRoom($roomId: String!, $hostId: String!, $hostName: String!) {
    createRoom(roomId: $roomId, hostId: $hostId, hostName: $hostName) {
        roomId
        hostId
        createdAt
    }
}

mutation JoinRoom($roomId: String!, $userId: String!, $userName: String!) {
    joinRoom(roomId: $roomId, userId: $userId, userName: $userName) {
        roomId
        users {
            userId
            userName
        }
    }
}

mutation UpdatePlayback($roomId: String!, $userId: String!, $state: String!, $currentTime: Float!, $timestamp: String!) {
    updatePlayback(roomId: $roomId, userId: $userId, state: $state, currentTime: $currentTime, timestamp: $timestamp) {
        roomId
        state
        currentTime
    }
}

mutation LeaveRoom($roomId: String!, $userId: String!) {
    leaveRoom(roomId: $roomId, userId: $userId) {
        success
    }
}
```

### Queries

```graphql
query GetRoomState($roomId: String!) {
    getRoomState(roomId: $roomId) {
        state
        currentTime
        lastUpdateUserId
        timestamp
    }
}
```

### Subscriptions

```graphql
subscription OnPlaybackUpdated($roomId: String!) {
    onPlaybackUpdated(roomId: $roomId) {
        roomId
        userId
        state
        currentTime
        timestamp
    }
}
```

## Technical Details

### Architecture

- **Manifest V3**: Uses the latest Chrome extension manifest format
- **Content Script**: Injects into Netflix pages to control video playback
- **Popup**: Provides UI for creating/joining rooms
- **GraphQL**: Uses AWS AppSync for real-time synchronization
- **Storage**: Uses Chrome storage API for persisting user state

### File Structure

```
netflix-watch-party/
├── manifest.json       # Extension manifest
├── popup.html         # Popup UI
├── popup.js          # Popup logic and GraphQL calls
├── content.js        # Netflix page integration
├── inject.js         # Optional injected script for deeper integration
├── icons/            # Extension icons
└── README.md         # This file
```

### Synchronization Logic

1. When a user performs an action (play/pause/seek), the content script detects it
2. The action is sent to AppSync via GraphQL mutation
3. Other clients poll for updates (or use subscriptions if WebSocket is available)
4. Remote updates are applied to the local video element
5. A flag prevents feedback loops during synchronization

## Limitations

- Works only on desktop Chrome (no mobile support)
- Requires all participants to have access to the same Netflix content
- Polling is used as a fallback if WebSocket subscriptions aren't available
- Users must manually navigate to the same title before joining

## Troubleshooting

### Extension not working on Netflix

- Make sure you're on a video page (not browsing)
- Refresh the Netflix page after installing the extension
- Check that the extension has permissions for netflix.com

### Synchronization issues

- Ensure all participants are on the same Netflix title
- Check that your AppSync endpoint is correctly configured
- Verify CORS is enabled on your AppSync API
- Look for errors in the browser console (F12)

### Connection errors

- Verify your GraphQL endpoint URL and API key
- Check network connectivity
- Ensure AppSync is configured to accept requests from Chrome extensions

## Development

### Testing Locally

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh button on the extension card
4. Test your changes on Netflix

### Debugging

- Use Chrome DevTools to debug popup: Right-click the extension icon > Inspect popup
- Use Chrome DevTools on Netflix page to debug content script: F12
- Check background console: chrome://extensions/ > Details > Inspect views

## License

This extension is provided as-is for educational purposes. Make sure you comply with Netflix's terms of service when using this extension. 