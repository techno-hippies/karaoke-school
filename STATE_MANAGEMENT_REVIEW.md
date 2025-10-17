# Video Player State Management Review

## Current State Management Issues

### 1. **Inconsistent Player Patterns**

#### VideoPlayer (non-HLS) - CONTROLLED
- Parent controls `isPlaying` state
- VideoPlayer syncs `video.play()/pause()` with prop changes via useEffect
- Play button calls `onTogglePlay()` callback → parent updates state → player responds
- ✅ Proper controlled component pattern

#### HLSPlayer (encrypted) - UNCONTROLLED
- Parent passes `autoPlay` prop (only affects initial mount)
- HLSPlayer manages its own `isPlaying` state via video events
- Play button directly controls video element (bypasses parent)
- ❌ Parent's state becomes decorative after mount

**Problem:** Desktop VideoDetail and parent components expect controlled behavior but HLSPlayer is uncontrolled!

---

### 2. **State Desynchronization**

#### Desktop VideoDetail (lines 66-114):
```tsx
const [isPlaying, setIsPlaying] = useState(false)
const [isMuted, setIsMuted] = useState(true)

useEffect(() => {
  setIsPlaying(true)   // Try autoplay
  setIsMuted(false)    // Try unmute (will fail for autoplay)
}, [])
```

**With VideoPlayer:** ✅ Works - player respects parent state changes
**With HLSPlayer:** ❌ Breaks - HLSPlayer ignores parent state after mount

#### Desktop Play Button Overlay (line 259):
```tsx
{!isPlaying && <PlayButton />}  // Based on parent's state
```

**With HLSPlayer:** Shows based on parent state, but HLSPlayer has its own play button based on its own state!
- Result: **Two play buttons** can appear (HLSPlayer's is clickable, parent's is decorative)

---

### 3. **Loop Not Working**

#### VideoPlayer:
```tsx
<video loop playsInline />  // ✅ Hardcoded loop
```

#### HLSPlayer:
```tsx
<video loop={loop} />  // ❌ Defaults to false, no parent passes it
```

**Result:** HLS videos don't loop, show play button when ended

---

### 4. **Autoplay & Mute Flow Issues**

#### VideoPost (mobile):
```tsx
const [isPlaying, setIsPlaying] = useState(true)  // Attempt autoplay
const [isMuted, setIsMuted] = useState(true)     // Muted for autoplay
```

**Chrome:** Autoplay blocked → `onPlayFailed()` → `setIsPlaying(false)` → shows play button ✅
**Firefox:** Autoplay works → video plays muted ✅

**Issue:** User must click mute button to hear audio (expected behavior)

#### VideoDetail Desktop:
```tsx
useEffect(() => {
  setIsPlaying(true)
  setIsMuted(false)  // ❌ Tries to unmute on autoplay
}, [])

const togglePlayPause = () => {
  if (isPlaying && isMuted) {
    setIsMuted(false)  // First click unmutes
    return
  }
  // Second click pauses
  setIsPlaying(!isPlaying)
}
```

**With VideoPlayer:** ✅ Works - "click to unmute" pattern
**With HLSPlayer:** ❌ Breaks - toggle doesn't control HLSPlayer's state

---

## Root Causes

1. **HLSPlayer was designed as uncontrolled** (I added play button without syncing with parent)
2. **VideoPost and VideoDetail expect controlled behavior** (they manage state and pass it down)
3. **No loop prop passed to HLSPlayer** (defaults to false)
4. **Duplicate UI layers** (both parent and HLSPlayer show play buttons)

---

## Proposed Solution

### Make HLSPlayer Controlled (like VideoPlayer)

#### Changes to HLSPlayer:

1. **Accept `isPlaying` prop and sync with it:**
```tsx
// Watch for isPlaying prop changes
useEffect(() => {
  if (!videoRef.current) return

  if (isPlaying) {
    if (videoRef.current.paused) {
      videoRef.current.play().catch(onPlayFailed)
    }
  } else {
    if (!videoRef.current.paused) {
      videoRef.current.pause()
    }
  }
}, [isPlaying, onPlayFailed])
```

2. **Remove internal play button when controls=false:**
```tsx
// Only show play button if controls=true (not used in our app)
{!isPlaying && !isLoading && controls && <PlayButton />}
```

3. **Add onPlayingChange callback:**
```tsx
interface HLSPlayerProps {
  isPlaying?: boolean  // NEW: controlled state
  onPlayingChange?: (playing: boolean) => void  // NEW: notify parent
  onPlayFailed?: () => void
}

// In video event handlers:
const handlePlay = () => {
  onPlayingChange?.(true)
}
const handlePause = () => {
  onPlayingChange?.(false)
}
```

4. **Enable loop by default:**
```tsx
export function HLSPlayer({
  loop = true,  // Changed from false
  ...
})
```

#### Changes to Parents:

1. **VideoPost:** Pass `isPlaying` and `onPlayingChange` to HLSPlayer
2. **VideoDetail Desktop:** Remove duplicate play button overlay when using HLSPlayer (or always - let players handle it)
3. **Both:** Pass `loop={true}` to players

---

## Expected Behavior After Fixes

### Mobile (VideoPost):
1. Navigate to video → autoplay muted ✅
2. If autoplay blocked → show play button ✅
3. Click play → video plays muted ✅
4. Click mute toggle → unmute ✅
5. Video ends → loops seamlessly ✅

### Desktop (VideoDetail):
1. Navigate to video → autoplay muted (unmute attempt fails) ✅
2. First click → unmutes (if muted) ✅
3. Second click → pauses ✅
4. Video ends → loops seamlessly ✅

### Both Players Work Consistently:
- Same controlled component pattern ✅
- Parent maintains source of truth ✅
- Players sync with parent state ✅
- No duplicate UI elements ✅

---

## Implementation Plan

### Step 1: Fix HLSPlayer (make controlled)
- [ ] Add `isPlaying` prop (optional for backwards compat)
- [ ] Add `onPlayingChange` callback
- [ ] Add useEffect to sync with `isPlaying` prop
- [ ] Remove play button when `controls=false`
- [ ] Change `loop` default to `true`
- [ ] Update video event handlers to call `onPlayingChange`

### Step 2: Update VideoPost
- [ ] Pass `isPlaying={isPlaying}` to HLSPlayer
- [ ] Pass `onPlayingChange={(p) => setIsPlaying(p)}` to HLSPlayer
- [ ] Pass `loop={true}` to both players
- [ ] Remove play button overlay (let players handle it)

### Step 3: Update VideoDetail Desktop
- [ ] Pass `isPlaying={isPlaying}` to HLSPlayer
- [ ] Pass `onPlayingChange={(p) => setIsPlaying(p)}` to HLSPlayer
- [ ] Remove desktop play button overlay (line 259-265)
- [ ] Pass `loop={true}` to both players

### Step 4: Testing
- [ ] Test mobile autoplay (Chrome restrictive, Firefox permissive)
- [ ] Test desktop click-to-unmute flow
- [ ] Test loop behavior (both players)
- [ ] Test state sync when navigating between videos
- [ ] Test play/pause/mute controls work correctly

---

## Detailed Player Comparison

### VideoPlayer (non-HLS) ✅ CONTROLLED
```tsx
// Props sync
useEffect(() => {
  video.muted = isMuted  // ✅ Syncs mute state
}, [isMuted])

useEffect(() => {
  if (isPlaying) video.play()
  else video.pause()  // ✅ Syncs play state
}, [isPlaying])

// User interaction
const handlePlayPause = () => {
  if (paused) {
    video.play().then(() => onTogglePlay())  // ✅ Notifies parent
  } else {
    onTogglePlay()  // ✅ Notifies parent
  }
}
```

**Features:**
- ✅ `loop` hardcoded to true
- ✅ Syncs `isMuted` prop continuously
- ✅ Syncs `isPlaying` prop continuously
- ✅ Video click toggles play/pause
- ✅ Play button shows when `!isPlaying`
- ✅ Calls parent's `onTogglePlay()` for state changes

---

### HLSPlayer (encrypted) ❌ UNCONTROLLED
```tsx
// Props (only at mount)
const [isPlaying, setIsPlaying] = useState(false)  // ❌ Own state
const [isMuted, setIsMuted] = useState(true)       // ❌ Ignores prop

// User interaction
const handlePlayPause = () => {
  if (paused) video.play()   // ❌ Bypasses parent
  else video.pause()         // ❌ Bypasses parent
}

// Only tries autoplay once
const handleCanPlay = () => {
  if (autoPlay && !attempted) {
    video.play().catch(onPlayFailed)  // ❌ autoPlay prop, not isPlaying
  }
}
```

**Issues:**
- ❌ `loop = false` default (not passed by parents)
- ❌ Ignores `isMuted` prop after mount
- ❌ Ignores `isPlaying` prop after mount
- ❌ Uses `autoPlay` instead of `isPlaying`
- ✅ Video click toggles play/pause
- ✅ Play button shows when `!isPlaying` (own state)
- ❌ Never calls parent callbacks

---

## User Requirements (Confirmed)

1. ✅ **Audio plays by default when video plays** (unless user explicitly mutes)
   - Autoplay: Must be muted (browser requirement)
   - Manual play: Should be unmuted

2. ✅ **Click video to toggle play/pause** (both players have this)

3. ✅ **Both players should work the same way** (need to fix HLSPlayer)

---

## Current UX Issues

### VideoPost (Mobile) - CORRECT ✅
```tsx
const [isPlaying, setIsPlaying] = useState(true)  // Try autoplay
const [isMuted, setIsMuted] = useState(true)       // Muted for autoplay

// When user clicks play button
if (newPlayingState && isMuted) {
  setIsMuted(false)  // ✅ Auto-unmute on manual play
}
```
**Flow:** Autoplay muted → if fails, user clicks → plays unmuted ✅

### VideoDetail Desktop - INCORRECT ❌
```tsx
useEffect(() => {
  setIsPlaying(true)   // Try autoplay
  setIsMuted(false)    // ❌ Try unmuted autoplay (will fail)
}, [])

// "Click to unmute" pattern
if (isPlaying && isMuted) {
  setIsMuted(false)  // ❌ First click unmutes
  return             // ❌ Second click pauses
}
```
**Flow:** Autoplay fails → Click 1 unmutes → Click 2 pauses → Click 3 plays ❌

**Problem:** Desktop requires 2 clicks to play with audio, mobile only needs 1!

---

## Unified Solution

### Fix 1: Make HLSPlayer Controlled (Like VideoPlayer)

```tsx
export function HLSPlayer({
  isPlaying = false,      // NEW: controlled
  isMuted = true,         // Already exists but ignored
  loop = true,            // NEW: default true
  onTogglePlay,           // NEW: notify parent
  onPlayFailed,
  ...
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Sync isPlaying prop (like VideoPlayer)
  useEffect(() => {
    if (!videoRef.current) return

    if (isPlaying) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(e => {
          if (e.name === 'NotAllowedError' && onPlayFailed) {
            onPlayFailed()
          }
        })
      }
    } else {
      if (!videoRef.current.paused) {
        videoRef.current.pause()
      }
    }
  }, [isPlaying, onPlayFailed])

  // Sync isMuted prop (like VideoPlayer)
  useEffect(() => {
    if (!videoRef.current) return
    videoRef.current.muted = isMuted
  }, [isMuted])

  // User clicks video/button
  const handlePlayPause = () => {
    if (!videoRef.current) return

    if (videoRef.current.paused) {
      videoRef.current.play()
        .then(() => onTogglePlay?.())  // Notify parent
        .catch(e => {
          if (e.name === 'NotAllowedError' && onPlayFailed) {
            onPlayFailed()
          }
        })
    } else {
      onTogglePlay?.()  // Notify parent
    }
  }

  // Remove internal state, remove play button when controlled
  // Parent will handle play button overlay
}
```

### Fix 2: Unify Parent Logic (VideoPost & VideoDetail)

```tsx
// Both desktop & mobile
const [isPlaying, setIsPlaying] = useState(true)   // Try autoplay
const [isMuted, setIsMuted] = useState(true)       // Muted for autoplay

const togglePlayPause = () => {
  const newPlayingState = !isPlaying
  setIsPlaying(newPlayingState)

  // Auto-unmute when starting to play manually
  if (newPlayingState && isMuted) {
    setIsMuted(false)  // ✅ Audio plays on manual play
  }
}

// Remove desktop's "click to unmute" pattern
```

### Fix 3: Pass Loop to Both Players

```tsx
<HLSPlayer loop={true} ... />
<VideoPlayer loop={true} ... />  // Already hardcoded, make prop
```

---

## Implementation Order

1. **HLSPlayer**: Add `isPlaying`/`isMuted` prop sync, `onTogglePlay` callback, `loop` prop
2. **VideoPlayer**: Accept `loop` prop (currently hardcoded)
3. **VideoPost**: Pass `loop={true}`, `onTogglePlay` to both players
4. **VideoDetail**: Remove "click to unmute" logic, use VideoPost pattern
5. **Remove duplicate play buttons**: Only player should show play button
