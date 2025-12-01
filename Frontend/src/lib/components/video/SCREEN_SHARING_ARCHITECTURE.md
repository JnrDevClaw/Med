# Screen Sharing Architecture

## Quick Reference

### Component Hierarchy

```
VideoCallInterface.svelte (Main Container)
├── VideoControls.svelte (Control Buttons)
│   └── Screen Share Button
├── ConnectionQualityIndicator.svelte
├── ParticipantList.svelte
└── Video Elements
    ├── Local Camera (PIP - always visible)
    ├── Remote Camera (Main or PIP)
    └── Remote Screen Share (Main when active)
```

### Service Layer

```
videoCallService.ts
├── Main Peer Connection (camera + audio)
├── Screen Share Peer Connection (screen only)
├── Socket.io Connection (signaling)
└── Event Handlers
    ├── onRemoteStream
    ├── onRemoteScreenShare
    └── onScreenShareStopped
```

### Backend Signaling

```
webrtcSignalingService.js
├── Socket.io Server
├── Room Management
└── Screen Share Events
    ├── start-screen-share
    ├── stop-screen-share
    ├── screen-share-offer
    ├── screen-share-answer
    └── screen-share-ice-candidate
```

## Key Implementation Points

### 1. Dual Peer Connections

**Why?**
- Independent quality control
- Separate bandwidth allocation
- Cleaner state management
- Better error isolation

**How?**
```typescript
private peerConnection: RTCPeerConnection | null = null;
private screenSharePeerConnection: RTCPeerConnection | null = null;
```

### 2. Display Media API

```typescript
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: {
    cursor: 'always',
    displaySurface: 'monitor'
  },
  audio: false
});
```

### 3. Automatic Cleanup

```typescript
// Browser UI stop detection
screenShareStream.getVideoTracks()[0].onended = () => {
  this.stopScreenShare();
};
```

### 4. UI Layout Logic

```svelte
{#if remoteScreenStream}
  <!-- Screen share in main view -->
  <video class="main" bind:this={screenShareVideoElement} />
  
  <!-- Remote camera in PIP -->
  <video class="pip" bind:this={remoteVideoElement} />
{:else}
  <!-- Remote camera in main view -->
  <video class="main" bind:this={remoteVideoElement} />
{/if}

<!-- Local camera always in PIP -->
<video class="pip" bind:this={localVideoElement} />
```

## State Management

### Local State
- `isScreenSharing`: Boolean - Am I sharing?
- `screenShareStream`: MediaStream | null - My screen stream
- `remoteScreenShareStream`: MediaStream | null - Their screen stream

### Remote State (via signaling)
- Participant.isScreenSharing: Boolean - Is peer sharing?

## Event Flow

### Starting Screen Share

```
User clicks button
    ↓
getDisplayMedia() → User selects screen
    ↓
Create screen share peer connection
    ↓
Add screen tracks to connection
    ↓
Emit 'start-screen-share' event
    ↓
Create and send offer
    ↓
Receive answer
    ↓
Exchange ICE candidates
    ↓
Screen share active
```

### Stopping Screen Share

```
User clicks stop (or browser UI)
    ↓
Stop all screen tracks
    ↓
Close screen share peer connection
    ↓
Emit 'stop-screen-share' event
    ↓
Remote peer receives event
    ↓
Remote peer cleans up
    ↓
Screen share stopped
```

## Error Handling Strategy

### Permission Errors
```typescript
try {
  await startScreenShare();
} catch (err) {
  if (err.name === 'NotAllowedError') {
    // User denied permission
    showError('Screen sharing permission denied');
  }
}
```

### Connection Errors
```typescript
screenSharePeerConnection.onconnectionstatechange = () => {
  if (state === 'failed') {
    // Connection failed, clean up
    stopScreenShare();
    showError('Screen sharing connection failed');
  }
};
```

### Automatic Recovery
- Track stops → Auto cleanup
- Connection fails → Auto cleanup
- Call ends → Auto cleanup all

## Performance Optimization

### Bandwidth Management
- Screen share uses separate connection
- Browser auto-adjusts quality
- Can monitor via getStats()

### CPU Usage
- Browser handles encoding
- Hardware acceleration when available
- Frame rate adapts to content

### Memory Management
- Streams cleaned up on stop
- Peer connections closed properly
- No memory leaks

## Security Features

### Browser-Level
- User must explicitly select screen
- Recording indicator always visible
- Can stop anytime via browser UI
- No background capture

### Application-Level
- Only authenticated users can join
- Consultation-based rooms
- Signaling server validates access
- No recording without consent

## Testing Checklist

### Functional
- [x] Start screen share
- [x] Stop screen share
- [x] Remote peer receives stream
- [x] UI updates correctly
- [x] Multiple start/stop cycles
- [x] Works with camera off
- [x] Works with audio muted

### Error Handling
- [x] Permission denied
- [x] No screens available
- [x] Connection failure
- [x] Network interruption
- [x] Browser UI stop

### Cross-Browser
- [x] Chrome
- [x] Firefox
- [x] Safari
- [x] Edge

## Debugging Tips

### Check Socket.io Connection
```javascript
console.log('Socket connected:', videoCallService.socket?.connected);
```

### Monitor Peer Connection State
```javascript
console.log('Main PC:', peerConnection?.connectionState);
console.log('Screen PC:', screenSharePeerConnection?.connectionState);
```

### Verify Streams
```javascript
console.log('Local stream tracks:', localStream?.getTracks());
console.log('Screen stream tracks:', screenShareStream?.getTracks());
console.log('Remote screen tracks:', remoteScreenShareStream?.getTracks());
```

### Check ICE Candidates
```javascript
peerConnection.onicecandidate = (event) => {
  console.log('ICE candidate:', event.candidate);
};
```

## Common Issues & Solutions

### Issue: Screen share button does nothing
**Solution**: Check browser compatibility and console errors

### Issue: Remote peer doesn't see screen
**Solution**: Verify signaling events are being sent/received

### Issue: Poor quality
**Solution**: Check bandwidth, reduce resolution, close apps

### Issue: Screen share stops unexpectedly
**Solution**: Check for browser tab switching, network issues

## File Structure

```
Frontend/
├── src/
│   ├── services/
│   │   └── videoCallService.ts          ← Core logic
│   └── lib/
│       └── components/
│           └── video/
│               ├── VideoCallInterface.svelte  ← Main UI
│               ├── VideoControls.svelte       ← Controls
│               └── SCREEN_SHARING_ARCHITECTURE.md ← This file

backend/
└── src/
    ├── services/
    │   └── webrtcSignalingService.js    ← Signaling
    └── plugins/
        └── webrtc.js                     ← Plugin setup
```

## API Reference

### VideoCallService Methods

```typescript
// Start sharing your screen
async startScreenShare(): Promise<MediaStream>

// Stop sharing your screen
stopScreenShare(): void

// Check if you're sharing
getIsScreenSharing(): boolean

// Get your screen share stream
getScreenShareStream(): MediaStream | null

// Get remote screen share stream
getRemoteScreenShareStream(): MediaStream | null
```

### Event Callbacks

```typescript
// Remote peer started sharing
onRemoteScreenShare: (stream: MediaStream) => void

// Remote peer stopped sharing
onScreenShareStopped: () => void
```

### Socket.io Events

```typescript
// Emit
socket.emit('start-screen-share', {})
socket.emit('stop-screen-share', {})
socket.emit('screen-share-offer', { offer, target })
socket.emit('screen-share-answer', { answer, target })
socket.emit('screen-share-ice-candidate', { candidate, target })

// Listen
socket.on('peer-screen-share-started', (data) => {})
socket.on('peer-screen-share-stopped', (data) => {})
socket.on('screen-share-offer', (data) => {})
socket.on('screen-share-answer', (data) => {})
socket.on('screen-share-ice-candidate', (data) => {})
```

## Summary

The screen sharing implementation is:
- **Accurate**: Uses proper WebRTC patterns
- **Reliable**: Handles errors and edge cases
- **Performant**: Separate connections for optimal quality
- **Secure**: Browser-native security features
- **User-friendly**: Clear UI and automatic cleanup
- **Production-ready**: Tested and documented

No additional packages needed - everything uses native browser APIs and existing dependencies (Socket.io, WebRTC).
