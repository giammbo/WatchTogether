# Installation Guide - Netflix Watch Party Extension

## Quick Setup (5 minutes)

### Step 1: Configure GraphQL Endpoint

1. **Open `config.js`** in your text editor
2. **Replace the placeholder values**:
   ```javascript
   APPSYNC_ENDPOINT: 'https://your-actual-endpoint.amazonaws.com/graphql',
   APPSYNC_API_KEY: 'your-actual-api-key',
   ```

### Step 2: Load Extension in Chrome

1. **Open Chrome** and go to `chrome://extensions/`
2. **Enable Developer Mode** (toggle in top right corner)
3. **Click "Load unpacked"**
4. **Select the extension folder** (the folder containing `manifest.json`)
5. **Verify installation** - you should see the extension icon in your toolbar

### Step 3: Test the Extension

1. **Go to Netflix** and start playing any video
2. **Click the extension icon** in your Chrome toolbar
3. **Click "Create Watch Party"**
4. **Copy the generated URL** and share with friends

## Detailed Setup

### Prerequisites

- **Chrome Browser** (version 88+)
- **AWS AppSync** configured with the required GraphQL schema
- **API Key** for your AppSync endpoint

### AWS AppSync Setup

If you don't have AppSync configured yet:

1. **Create AppSync API**:
   - Go to AWS Console → AppSync
   - Click "Create API"
   - Choose "Start from scratch"
   - Name your API (e.g., "NetflixWatchParty")

2. **Add Schema**:
   - Go to Schema tab
   - Add the GraphQL schema from the README

3. **Create API Key**:
   - Go to Settings tab
   - Create a new API key
   - Copy the key for use in `config.js`

4. **Configure CORS**:
   - In Settings, add CORS origin: `chrome-extension://*`

### Troubleshooting Installation

#### Extension Won't Load
- Check that all files are present in the folder
- Verify `manifest.json` syntax is correct
- Ensure Chrome version is 88 or higher

#### GraphQL Errors
- Verify endpoint URL is correct
- Check API key is valid
- Ensure CORS is configured for Chrome extensions
- Test endpoint with a GraphQL client

#### Video Not Syncing
- Make sure you're on a Netflix video page
- Check browser console for errors
- Verify content script is injected (look for "Netflix Watch Party: Content script loaded" in console)

## Configuration Options

### Sync Settings
```javascript
SYNC_INTERVAL: 1000,    // How often to check for updates (ms)
TIME_THRESHOLD: 2,      // Minimum time difference to sync (seconds)
```

### Debug Mode
```javascript
DEBUG_MODE: true,       // Enable verbose logging
LOG_LEVEL: 'debug',     // Log level: 'debug', 'info', 'warn', 'error'
```

## Security Notes

- **API Keys**: Store securely and rotate regularly
- **CORS**: Only allow necessary origins
- **Permissions**: Extension only requests Netflix and storage access
- **Data**: No personal data is stored beyond session info

## Support

If you encounter issues:
1. Check the troubleshooting section in README.md
2. Review browser console for error messages
3. Verify all configuration values are correct
4. Test with a simple GraphQL query first

---

**Need Help?** Check the main README.md for detailed documentation and troubleshooting guides. 