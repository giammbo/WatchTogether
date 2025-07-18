// Inject script for Netflix Watch Party
// This runs in the page context and can access Netflix's internal APIs if needed

(function() {
    'use strict';
    
    console.log('Netflix Watch Party inject script loaded');
    
    // Helper to send messages to content script
    function sendToContentScript(type, data) {
        window.postMessage({
            source: 'netflix-watch-party-inject',
            type: type,
            data: data
        }, '*');
    }
    
    // Try to find Netflix's internal player API
    function findNetflixPlayer() {
        // Netflix stores player instances in various places
        const possiblePaths = [
            'netflix.appContext.state.playerApp.getAPI().videoPlayer',
            'netflix.cadmium.UiEvents.videoPlayer',
            'netflix.appContext.getPlayerApp().getAPI().videoPlayer'
        ];
        
        for (const path of possiblePaths) {
            try {
                const player = path.split('.').reduce((obj, key) => obj?.[key], window);
                if (player) {
                    console.log('Found Netflix player at:', path);
                    return player;
                }
            } catch (e) {
                // Continue searching
            }
        }
        
        return null;
    }
    
    // Monitor for player state changes
    let netflixPlayer = null;
    let lastState = null;
    
    function monitorPlayer() {
        if (!netflixPlayer) {
            netflixPlayer = findNetflixPlayer();
            if (!netflixPlayer) {
                // Retry after a delay
                setTimeout(monitorPlayer, 1000);
                return;
            }
        }
        
        try {
            // Get current player state
            const currentState = {
                paused: netflixPlayer.isPaused(),
                currentTime: netflixPlayer.getCurrentTime() / 1000, // Convert from ms to seconds
                duration: netflixPlayer.getDuration() / 1000,
                volume: netflixPlayer.getVolume()
            };
            
            // Check for state changes
            if (JSON.stringify(currentState) !== JSON.stringify(lastState)) {
                lastState = currentState;
                sendToContentScript('PLAYER_STATE_CHANGED', currentState);
            }
        } catch (e) {
            console.error('Error monitoring player:', e);
            netflixPlayer = null; // Reset and try to find again
        }
        
        // Continue monitoring
        setTimeout(monitorPlayer, 500);
    }
    
    // Listen for commands from content script
    window.addEventListener('message', (event) => {
        if (event.source !== window || event.data.source !== 'netflix-watch-party-content') {
            return;
        }
        
        const { type, data } = event.data;
        
        switch (type) {
            case 'SEEK_TO':
                if (netflixPlayer) {
                    try {
                        netflixPlayer.seek(data.time * 1000); // Convert to ms
                        console.log('Seeked to:', data.time);
                    } catch (e) {
                        console.error('Seek failed:', e);
                    }
                }
                break;
                
            case 'SET_PLAYBACK_RATE':
                if (netflixPlayer) {
                    try {
                        netflixPlayer.setPlaybackRate(data.rate);
                        console.log('Set playback rate to:', data.rate);
                    } catch (e) {
                        console.error('Set playback rate failed:', e);
                    }
                }
                break;
                
            case 'GET_PLAYER_STATE':
                if (netflixPlayer) {
                    try {
                        const state = {
                            paused: netflixPlayer.isPaused(),
                            currentTime: netflixPlayer.getCurrentTime() / 1000,
                            duration: netflixPlayer.getDuration() / 1000,
                            volume: netflixPlayer.getVolume(),
                            playbackRate: netflixPlayer.getPlaybackRate()
                        };
                        sendToContentScript('PLAYER_STATE', state);
                    } catch (e) {
                        console.error('Get player state failed:', e);
                    }
                }
                break;
        }
    });
    
    // Start monitoring
    monitorPlayer();
    
    // Also try to intercept Netflix's internal events
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        // Call original
        originalAddEventListener.call(this, type, listener, options);
        
        // If this is a video element, also notify our content script
        if (this.tagName === 'VIDEO' && ['play', 'pause', 'seeked', 'timeupdate'].includes(type)) {
            originalAddEventListener.call(this, type, function(event) {
                sendToContentScript('VIDEO_EVENT', {
                    type: event.type,
                    currentTime: this.currentTime,
                    paused: this.paused,
                    duration: this.duration
                });
            }, options);
        }
    };
    
    console.log('Netflix Watch Party inject script initialized');
})();