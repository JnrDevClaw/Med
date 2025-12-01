# Screen Sharing Implementation Guide

## Overview

This document describes the complete screen sharing implementation for the Med Connect video consultation system using WebRTC and Socket.io.

## Architecture

### Dual Peer Connection Model

The implementation uses **two separate RTCPeerConnection instances**:

1. **Main Peer Connection**: Handles camera video and audio
2. **Screen Share Peer Connection**: Handles screen sharing video only

This separation provides:
- Independent quality control for each stream
- Ability to share screen without affecting camera stream
- Better bandwidth management
- Cleaner state management

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Doctor's Browser                         │
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Camera     │────────▶│ Main Peer    │                 │
│  │   Stream     │         │ Connection   │                 │
│  └──────────────┘         └──────┬───────┘                 │
│                                   │                          │
│  ┌──────────────┐         ┌──────▼───────┐                 │
│  │   Screen     │────────▶│ Screen Share │                 │
│  │   Stream     │         │ Peer Conn.   │                 │
│  └──────────────┘         └──────┬───────┘                 │
│                                   │                          │
└───────────────────────────────────┼──────────────────────────┘
                                    │
                                    │ Socket.io Signaling
                                    │
                    ┌───────────────▼───────────────┐
                    │   Backend Signaling Server    │
                    │   (WebRTC + Socket.io)        │
                    └───────────────┬───────────────┘
                                    │
                                    │
┌───────────────────────────────────┼──────────────────────────┐
│                     Patient's Browser                         │
│                                   │                          │
│  ┌──────────────┐         ┌──────▼───────┐                 │
│  │   Remote     │◀────────│ Main Peer    │                 │
│  │   Camera     │         │ Connection   │                 │
│  └──────────────┘         └──────────────┘                 │
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Remote     │◀────────│ Screen Share │                 │
│  │   Screen     │         │ Peer Conn.   │                 │
│  └──────────────┘         └──────────────┘                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Backend (Node.js/Fastify + Socket.io)

#### Signaling Events

The backend handles the following screen sharing events:

1. **start-screen-share**: Notifies when a user starts sharing
2. **stop-screen-share**: Notifies when a user stops sharing
3. **screen-share-offer**: WebRTC offer for screen share connection
4. **screen-share-answer**: WebRTC answer for screen share connection
5. **screen-share-ice-candidate**: ICE candidates for screen share connection

#### Room State Management

```javascript
// Participant tracking includes screen sharing status
{
  userId: 'doctor123',
  userRole: 'doctor',
  socketId: 'abc123',
  joinedAt: Date,
  isScreenSharing: true  // ← Tracks screen sharing state
}
```

### Frontend (SvelteKit + TypeScript)

#### VideoCallService Methods

**Starting Screen Share:**
```typescript
async startScreenShare(): Promise<MediaStream>
```
- Requests screen capture via `navigator.mediaDevices.getDisplayMedia()`
- Creates separate peer connection for screen sharing
- Handles user stopping share via browser UI
- Notifies remote peer via signaling

**Stopping Screen Share:**
```typescript
stopScreenShare(): void
```
- Stops all screen share tracks
- Closes screen share peer connection
- Notifies remote peer

**Event Callbacks:**
```typescript
onRemoteScreenShare: (stream: MediaStream) => void
onScreenShareStopped: () => void
```

#### UI Components

**VideoCallInterface.svelte**
- Displays remote screen share in main view
- Shows remote camera in PIP when screen sharing
- Shows local camera in PIP (always)
- Displays "Screen Sharing Active" indicator

**VideoControls.svelte**
- "Share Screen" / "Stop Sharing" button
- Visual feedback for active screen sharing

## User Experience

### Starting Screen Share

1. User clicks "Share Screen" button
2. Browser shows screen picker dialog
3. User selects window/screen/tab to share
4. Screen appears in main view for remote participant
5. Remote camera moves to PIP position
6. "Screen Sharing Active" indicator appears

### Stopping Screen Share

User can stop sharing in three ways:

1. **Click "Stop Sharing" button** in video controls
2. **Click "Stop Sharing" in browser UI** (Chrome/Firefox toolbar)
3. **End the call** (automatically stops all streams)

All methods properly clean up resources and notify the remote peer.

### Remote Participant View

When receiving screen share:
- Screen share appears in main video area
- Sharer's camera moves to small PIP
- "Screen Sharing Active" indicator shows
- Can still see their own camera in PIP

## Browser Compatibility

### getDisplayMedia() Support

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome | 72+ | Full support |
| Firefox | 66+ | Full support |
| Safari | 13+ | Full support |
| Edge | 79+ | Full support (Chromium) |

### Features

- **Cursor capture**: Always included
- **Audio capture**: Optional (currently disabled)
- **Tab audio**: Supported in Chrome/Edge
- **System audio**: Supported in Chrome/Edge (Windows/Mac)

## Configuration

### Display Media Constraints

```typescript
{
  video: {
    cursor: 'always',        // Always show cursor
    displaySurface: 'monitor' // Prefer full screen
  },
  audio: false               // No audio (can be enabled)
}
```

### WebRTC Configuration

Uses same ICE servers as main connection:
- Google STUN servers (free)
- Optional TURN servers for firewall traversal

## Error Handling

### Common Errors

1. **Permission Denied**
   - User cancels screen picker
   - Browser blocks screen capture
   - **Handling**: Show error message, don't crash

2. **NotAllowedError**
   - User denied permission
   - **Handling**: Inform user, suggest retry

3. **NotFoundError**
   - No screens available (rare)
   - **Handling**: Show error message

4. **Connection Failed**
   - Network issues during screen share setup
   - **Handling**: Retry or fallback to camera only

### Automatic Cleanup

The implementation automatically handles:
- User stops sharing via browser UI
- Connection drops during screen share
- Call ends while screen sharing
- Browser tab closes

## Performance Considerations

### Bandwidth Usage

Screen sharing typically uses:
- **1-3 Mbps** for static content (documents)
- **3-5 Mbps** for dynamic content (videos, animations)
- **5-10 Mbps** for high-motion content (games, videos)

### Quality Optimization

The browser automatically adjusts:
- Frame rate based on content changes
- Resolution based on available bandwidth
- Encoding quality based on network conditions

### Best Practices

1. **Recommend closing unnecessary apps** before sharing
2. **Share specific window** instead of entire screen when possible
3. **Monitor connection quality** and suggest stopping if poor
4. **Limit to 1 screen share** per consultation

## Security Considerations

### Privacy Protection

1. **User Consent Required**
   - Browser always shows picker
   - User explicitly selects what to share
   - Can stop anytime via browser UI

2. **No Background Capture**
   - Screen capture only works in active tab
   - Stops when tab is hidden (browser dependent)

3. **Indicator Always Visible**
   - Browser shows recording indicator
   - Cannot be hidden or spoofed

### Medical Context

For healthcare consultations:
- **Doctors can share**: Medical records, test results, diagrams
- **Patients can share**: Symptoms, home environment, medication labels
- **Both should avoid**: Sharing sensitive info from other patients

## Testing

### Manual Testing Checklist

- [ ] Start screen share successfully
- [ ] Stop screen share via button
- [ ] Stop screen share via browser UI
- [ ] Remote peer sees screen share
- [ ] Remote peer sees camera in PIP
- [ ] Screen share stops when call ends
- [ ] Error handling for denied permission
- [ ] Multiple start/stop cycles work
- [ ] Works with camera off
- [ ] Works with audio muted

### Browser Testing

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Network Testing

Test with:
- [ ] Good connection (>5 Mbps)
- [ ] Medium connection (1-5 Mbps)
- [ ] Poor connection (<1 Mbps)
- [ ] Connection drops during share

## Troubleshooting

### Screen Share Not Starting

**Symptoms**: Button click does nothing or shows error

**Possible Causes**:
1. Browser doesn't support getDisplayMedia
2. User denied permission
3. No peer connection established yet

**Solutions**:
1. Check browser compatibility
2. Ask user to grant permission
3. Wait for call to connect first

### Remote Peer Not Seeing Screen

**Symptoms**: Local user sees "Sharing Screen" but remote doesn't

**Possible Causes**:
1. Signaling failed
2. ICE candidates not exchanged
3. Firewall blocking connection

**Solutions**:
1. Check Socket.io connection
2. Verify STUN/TURN servers
3. Check browser console for errors

### Poor Screen Share Quality

**Symptoms**: Laggy, pixelated, or frozen screen

**Possible Causes**:
1. Insufficient bandwidth
2. High CPU usage
3. Network congestion

**Solutions**:
1. Reduce screen resolution
2. Close unnecessary applications
3. Switch to audio-only temporarily
4. Share specific window instead of full screen

## Future Enhancements

### Potential Improvements

1. **Screen Share with Audio**
   - Enable system audio capture
   - Useful for sharing videos

2. **Annotation Tools**
   - Draw on shared screen
   - Highlight areas of interest

3. **Recording**
   - Record screen share sessions
   - Save for medical records

4. **Multiple Participants**
   - Support group consultations
   - Multiple screen shares

5. **Quality Controls**
   - Manual resolution selection
   - Frame rate adjustment
   - Bandwidth limiting

## Code Examples

### Starting Screen Share

```typescript
// In VideoCallInterface.svelte
async function handleToggleScreenShare() {
  try {
    if (isScreenSharing) {
      await videoCallService.stopScreenShare();
      isScreenSharing = false;
    } else {
      await videoCallService.startScreenShare();
      isScreenSharing = true;
    }
  } catch (err) {
    console.error('Screen share error:', err);
    error = err.message;
  }
}
```

### Receiving Screen Share

```typescript
// Set up callback
videoCallService.onRemoteScreenShare = (stream) => {
  remoteScreenStream = stream;
  if (screenShareVideoElement) {
    screenShareVideoElement.srcObject = stream;
  }
};

// Handle stop
videoCallService.onScreenShareStopped = () => {
  remoteScreenStream = null;
  // UI automatically updates via Svelte reactivity
};
```

## Conclusion

This screen sharing implementation provides:
- ✅ Reliable peer-to-peer screen sharing
- ✅ Separate connection for better quality control
- ✅ Automatic cleanup and error handling
- ✅ Good user experience with clear indicators
- ✅ Browser-native security and privacy
- ✅ No additional costs (uses free STUN servers)

The implementation is production-ready for 1-on-1 medical consultations and can be extended for additional features as needed.
