# Screen Sharing Implementation

## Overview

This document describes the screen sharing implementation for the Med Connect video consultation system using WebRTC and Socket.io.

## Features

✅ **Full Screen Sharing Support**
- Share entire screen, specific window, or browser tab
- Automatic track replacement (switches from camera to screen)
- Seamless switching back to camera when stopped
- Browser-native stop sharing button support

✅ **Audio Sharing**
- Share system audio along with screen (browser support varies)
- Echo cancellation and noise suppression
- High-quality audio sampling (44.1kHz)

✅ **UI Indicators**
- Visual indicator when screen sharing is active
- Different layouts for screen share vs camera view
- Picture-in-picture for camera when screen sharing
- Status badges on local video

✅ **Peer Notifications**
- Real-time signaling when screen sharing starts/stops
- Automatic stream handling on remote peer
- Proper cleanup on disconnection

## Architecture

### Frontend (VideoCallService.ts)

```typescript
// Key Methods:
- startScreenShare(): Promise<MediaStream>
  - Requests screen capture permission
  - Replaces video track in peer connection
  - Notifies remote peer via signaling

- stopScreenShare(): Promise<void>
  - Stops screen stream
  - Switches back to camera
  - Notifies remote peer

- renegotiateConnection(): Promise<void>
  - Creates new SDP offer with updated tracks
  - Sends to peer for renegotiation
```

### Backend (webrtcSignalingService.js)

```javascript
// Socket Events:
- 'screen-share-started': Broadcast to room when user starts sharing
- 'screen-share-stopped': Broadcast to room when user stops sharing
```

### UI Components

**VideoControls.svelte**
- Screen share toggle button
- Visual state indication (blue when active)
- Disabled state handling

**VideoCallInterface.svelte**
- Main screen share display area
- PIP layout for camera during screen share
- Status indicators and badges

## Usage

### Starting Screen Share

```typescript
const videoCallService = new VideoCallService();

try {
  const screenStream = await videoCallService.startScreenShare();
  console.log('Screen sharing started:', screenStream);
} catch (error) {
  console.error('Failed to start screen share:', error);
}
```

### Stopping Screen Share

```typescript
await videoCallService.stopScreenShare();
```

### Checking Screen Share Status

```typescript
const isSharing = videoCallService.isCurrentlyScreenSharing();
const screenStream = videoCallService.getScreenStream();
```

## Browser Support

| Browser | Screen Share | Audio Share | Notes |
|---------|-------------|-------------|-------|
| Chrome 72+ | ✅ | ✅ | Full support |
| Firefox 66+ | ✅ | ⚠️ | Audio requires flag |
| Safari 13+ | ✅ | ❌ | No audio support |
| Edge 79+ | ✅ | ✅ | Full support |

## User Experience

### Starting Screen Share
1. User clicks "Share Screen" button
2. Browser shows screen picker dialog
3. User selects screen/window/tab to share
4. Video switches from camera to screen
5. Remote peer sees screen in main view
6. Camera moves to PIP (both sides)

### Stopping Screen Share
1. User clicks "Stop Sharing" button OR browser's stop button
2. Video switches back to camera
3. Remote peer notified
4. Layout returns to normal

### Remote Peer Experience
1. Receives notification of screen share
2. Screen appears in main view automatically
3. Remote camera moves to PIP
4. Blue indicator shows "Screen Sharing Active"
5. Returns to normal when sharing stops

## Error Handling

### Permission Denied
```typescript
catch (error) {
  if (error.name === 'NotAllowedError') {
    // User denied screen sharing permission
  }
}
```

### No Screen Available
```typescript
catch (error) {
  if (error.name === 'NotFoundError') {
    // No screen/window available to share
  }
}
```

### Connection Issues
- Automatic cleanup on peer disconnection
- Graceful fallback to camera
- Error notifications to user

## Technical Details

### Track Replacement
Instead of adding a new track, we replace the existing video track:
```typescript
await this.videoSender.replaceTrack(screenTrack);
```

This approach:
- Maintains existing peer connection
- Avoids renegotiation complexity
- Provides seamless switching
- Better browser compatibility

### Stream Identification
Screen streams are identified by:
- Modified stream ID: `screen-${originalId}`
- Track label checking
- Stream metadata

### Renegotiation
When tracks change, we renegotiate:
1. Create new SDP offer
2. Set local description
3. Send to peer via signaling
4. Peer accepts and updates

## Security Considerations

✅ **User Consent Required**
- Browser always prompts for permission
- User can stop sharing anytime
- No silent screen capture

✅ **Secure Signaling**
- WebSocket connection with authentication
- Room-based isolation
- Firestore access control

✅ **Privacy Protection**
- No server-side recording (unless explicitly enabled)
- Peer-to-peer streaming
- User controls what's shared

## Performance

### Bandwidth Usage
- Screen share: ~1-3 Mbps (depends on content)
- Higher for video content, lower for static screens
- Adaptive bitrate based on connection

### CPU Usage
- Encoding: Moderate (hardware accelerated when available)
- Decoding: Low to moderate
- Minimal impact on call quality

### Optimization Tips
1. Share specific window instead of entire screen
2. Close unnecessary applications
3. Reduce screen resolution if needed
4. Disable animations during sharing

## Testing

### Manual Testing Checklist
- [ ] Start screen share successfully
- [ ] Stop screen share successfully
- [ ] Browser stop button works
- [ ] Remote peer sees screen
- [ ] Audio sharing works (if supported)
- [ ] Switching back to camera works
- [ ] PIP layout correct
- [ ] Indicators show correctly
- [ ] Works with multiple participants
- [ ] Handles disconnection gracefully

### Browser Testing
Test on:
- Chrome/Edge (Windows, Mac, Linux)
- Firefox (Windows, Mac, Linux)
- Safari (Mac only)

## Future Enhancements

🔮 **Potential Improvements**
- Screen annotation tools
- Pointer highlighting
- Recording with consent
- Screenshot capture
- Multiple screen sharing
- Screen share quality controls
- Bandwidth optimization

## Troubleshooting

### Screen Share Not Starting
1. Check browser permissions
2. Verify HTTPS connection (required)
3. Check console for errors
4. Try different screen/window

### Remote Peer Not Seeing Screen
1. Check signaling connection
2. Verify peer connection state
3. Check firewall/NAT settings
4. Review browser console

### Poor Quality
1. Check network bandwidth
2. Reduce screen resolution
3. Close bandwidth-heavy apps
4. Try audio-only mode

## References

- [MDN: Screen Capture API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API)
- [WebRTC Track Replacement](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/replaceTrack)
- [getDisplayMedia Spec](https://w3c.github.io/mediacapture-screen-share/)
