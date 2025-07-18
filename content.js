// Content script for Netflix Watch Party
// This script runs in the context of Netflix pages

let videoElement = null;
let isInWatchParty = false;
let currentRoom = null;
let currentUser = null;
let isLocalChange = false;
let lastPlaybackTime = 0;
let syncInterval = null;

// Initialize content script
(function() {
    'use strict';
    
    console.log('Netflix Watch Party: Content script loaded');
    
    // Wait for Netflix to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeWatchParty);
    } else {
        initializeWatchParty();
    }
    
    // Also listen for Netflix's dynamic content loading
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        checkForVideoElement(node);
                    }
                });
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();

function initializeWatchParty() {
    // Check if we're already in a watch party
    checkForExistingSession();
    
    // Look for video element
    findVideoElement();
    
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener(handleMessage);
    
    // Check URL for room ID (for joining via URL)
    checkUrlForRoomId();
}

function checkForExistingSession() {
    chrome.storage.local.get(['session'], (result) => {
        if (result.session && result.session.roomId) {
            currentRoom = result.session.roomId;
            currentUser = result.session.username;
            isInWatchParty = true;
            console.log('Netflix Watch Party: Resumed session for room:', currentRoom);
        }
    });
}

function findVideoElement() {
    // Netflix uses different video selectors depending on the page
    const videoSelectors = [
        'video',
        '.VideoPlayer video',
        '[data-uia="video-player"] video',
        '.watch-video video'
    ];
    
    for (const selector of videoSelectors) {
        const video = document.querySelector(selector);
        if (video) {
            setupVideoElement(video);
            return;
        }
    }
    
    // If no video found, try again after a delay
    setTimeout(findVideoElement, 1000);
}

function checkForVideoElement(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
        const video = node.querySelector('video');
        if (video && !videoElement) {
            setupVideoElement(video);
        }
    }
}

function setupVideoElement(video) {
    if (videoElement === video) return;
    
    videoElement = video;
    console.log('Netflix Watch Party: Video element found and configured');
    
    // Set up event listeners
    setupVideoEventListeners(video);
    
    // If we're in a watch party, start syncing
    if (isInWatchParty) {
        startPlaybackSync();
    }
}

function setupVideoEventListeners(video) {
    // Remove existing listeners to avoid duplicates
    video.removeEventListener('play', handlePlay);
    video.removeEventListener('pause', handlePause);
    video.removeEventListener('seeked', handleSeek);
    video.removeEventListener('timeupdate', handleTimeUpdate);
    
    // Add new listeners
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeek);
    video.addEventListener('timeupdate', handleTimeUpdate);
    
    // Override Netflix's play/pause methods to catch programmatic calls
    const originalPlay = video.play;
    const originalPause = video.pause;
    
    video.play = function() {
        isLocalChange = true;
        const result = originalPlay.apply(this, arguments);
        setTimeout(() => { isLocalChange = false; }, 100);
        return result;
    };
    
    video.pause = function() {
        isLocalChange = true;
        const result = originalPause.apply(this, arguments);
        setTimeout(() => { isLocalChange = false; }, 100);
        return result;
    };
}

function handlePlay(event) {
    if (!isInWatchParty || isLocalChange) return;
    
    console.log('Netflix Watch Party: Local play detected');
    isLocalChange = true;
    
    // Send playback update to popup
    chrome.runtime.sendMessage({
        action: 'playbackChange',
        data: {
            isPlaying: true,
            currentTime: videoElement.currentTime
        }
    });
    
    setTimeout(() => { isLocalChange = false; }, 100);
}

function handlePause(event) {
    if (!isInWatchParty || isLocalChange) return;
    
    console.log('Netflix Watch Party: Local pause detected');
    isLocalChange = true;
    
    // Send playback update to popup
    chrome.runtime.sendMessage({
        action: 'playbackChange',
        data: {
            isPlaying: false,
            currentTime: videoElement.currentTime
        }
    });
    
    setTimeout(() => { isLocalChange = false; }, 100);
}

function handleSeek(event) {
    if (!isInWatchParty || isLocalChange) return;
    
    console.log('Netflix Watch Party: Local seek detected');
    isLocalChange = true;
    
    // Send playback update to popup
    chrome.runtime.sendMessage({
        action: 'playbackChange',
        data: {
            isPlaying: !videoElement.paused,
            currentTime: videoElement.currentTime
        }
    });
    
    setTimeout(() => { isLocalChange = false; }, 100);
}

function handleTimeUpdate(event) {
    if (!isInWatchParty) return;
    
    // Update last known playback time
    lastPlaybackTime = videoElement.currentTime;
}

function startPlaybackSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    
    // Sync every 5 seconds
    syncInterval = setInterval(() => {
        if (videoElement && isInWatchParty && !isLocalChange) {
            chrome.runtime.sendMessage({
                action: 'playbackChange',
                data: {
                    isPlaying: !videoElement.paused,
                    currentTime: videoElement.currentTime
                }
            });
        }
    }, 5000);
}

function stopPlaybackSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}

function handleMessage(message, sender, sendResponse) {
    console.log('Netflix Watch Party: Received message:', message);
    
    switch (message.action) {
        case 'joined':
            handleJoinedRoom(message.data);
            break;
        case 'playbackUpdate':
            handleRemotePlaybackUpdate(message.data);
            break;
        case 'left':
            handleLeftRoom();
            break;
    }
}

function handleJoinedRoom(data) {
    currentRoom = data.roomId;
    currentUser = data.username;
    isInWatchParty = true;
    
    console.log('Netflix Watch Party: Joined room:', currentRoom);
    
    // Start syncing if video is available
    if (videoElement) {
        startPlaybackSync();
    }
    
    // Show notification
    showNotification('Joined Watch Party!', 'You are now synced with other viewers.');
}

function handleRemotePlaybackUpdate(playbackData) {
    if (!videoElement || isLocalChange || !isInWatchParty) return;
    
    console.log('Netflix Watch Party: Remote playback update:', playbackData);
    
    isLocalChange = true;
    
    try {
        // Apply remote playback state
        if (playbackData.isPlaying !== !videoElement.paused) {
            if (playbackData.isPlaying) {
                videoElement.play();
            } else {
                videoElement.pause();
            }
        }
        
        // Sync time if difference is significant (>2 seconds)
        const timeDiff = Math.abs(videoElement.currentTime - playbackData.currentTime);
        if (timeDiff > 2) {
            videoElement.currentTime = playbackData.currentTime;
        }
        
    } catch (error) {
        console.error('Netflix Watch Party: Error applying remote playback update:', error);
    }
    
    setTimeout(() => { isLocalChange = false; }, 100);
}

function handleLeftRoom() {
    isInWatchParty = false;
    currentRoom = null;
    currentUser = null;
    
    console.log('Netflix Watch Party: Left room');
    
    stopPlaybackSync();
    
    // Show notification
    showNotification('Left Watch Party', 'You are no longer synced with other viewers.');
}

function checkUrlForRoomId() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('id');
    
    if (roomId) {
        console.log('Netflix Watch Party: Room ID found in URL:', roomId);
        
        // Auto-join the room
        chrome.runtime.sendMessage({
            action: 'autoJoin',
            data: { roomId }
        });
        
        // Clean up URL
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('id');
        window.history.replaceState({}, '', newUrl.toString());
    }
}

function showNotification(title, message) {
    // Create a simple notification overlay
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #e50914;
        color: white;
        padding: 12px 16px;
        border-radius: 4px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        z-index: 9999;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    notification.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
        <div style="font-size: 12px; opacity: 0.9;">${message}</div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Utility function to get current video info
function getCurrentVideoInfo() {
    if (!videoElement) return null;
    
    return {
        currentTime: videoElement.currentTime,
        duration: videoElement.duration,
        isPlaying: !videoElement.paused,
        playbackRate: videoElement.playbackRate
    };
}

// Expose functions for debugging
window.netflixWatchParty = {
    getCurrentVideoInfo,
    isInWatchParty: () => isInWatchParty,
    currentRoom: () => currentRoom,
    currentUser: () => currentUser
}; 