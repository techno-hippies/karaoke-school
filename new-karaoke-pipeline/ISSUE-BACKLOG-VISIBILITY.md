# Issue: audio_tasks Backlog No Longer Visible

**Severity**: 🔴 HIGH (Operational)
**Status**: DOCUMENTED - Requires Architectural Decision
**Date**: 2025-01-11

---

## Problem

Refactored tasks only call `ensureAudioTask()` at the moment processing starts. No pending rows exist in `audio_tasks` before a worker picks up a track.

**Files Affected**:
- `src/lib/base-task.ts:241-244` - ensureAudioTask called in runWithLifecycle
- All refactored tasks - no pre-insertion of audio_tasks rows

---

## Impact

### Zero Queue Visibility
```sql
-- Returns 0 even with 50 tracks waiting
SELECT COUNT(*) FROM audio_tasks
WHERE task_type = 'align' AND status = 'pending';
```

### Broken Monitoring
- `getPendingTasks()` always returns 0 (`src/db/audio-tasks.ts:131-160`)
- `audio_progress` view undercounts work (`schema/02-tasks.sql:140-184`)
- `task_summary` view shows no backlog
- Ops dashboards report "all done" when work is queued

### Lost Operational Capabilities
- Can't monitor backlog depth
- Can't reset stuck tasks (no rows to UPDATE)
- Can't see what's queued for processing
- Can't estimate completion time

---

## Original Behavior

**Old tasks** pre-populated `audio_tasks`:

```typescript
// Old align-lyrics.ts line 205
const tasks = await getPendingAudioTasks('align', limit);

// getPendingAudioTasks expected pending rows to exist
```

Rows were likely inserted:
1. At stage transitions (trigger/function)
2. By background scheduler job
3. During ingestion/enrichment

---

## Current Behavior

**New tasks** select directly from `tracks`:

```typescript
// base-task.ts line 180-183
const tracks = trackId
  ? await this.selectTracks(1, trackId)
  : await this.selectTracks(limit);

// Only creates audio_tasks row when processing starts
await ensureAudioTask(track.spotify_track_id, this.taskType);
```

**Consequence**: `audio_tasks` table is always sparse - only contains running/completed/failed tasks, never pending ones.

---

## Solution Options

### Option 1: Pre-populate audio_tasks (Recommended)

**Approach**: Insert pending rows when tracks reach prerequisite stage

**Implementation**:
```sql
-- Trigger on stage update
CREATE OR REPLACE FUNCTION populate_audio_tasks()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage = 'aligned' AND OLD.stage != 'aligned' THEN
    INSERT INTO audio_tasks (spotify_track_id, task_type, status, max_attempts)
    VALUES (NEW.spotify_track_id, 'translate', 'pending', 3)
    ON CONFLICT (spotify_track_id, task_type) DO NOTHING;
  END IF;
  -- Repeat for other stages...
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tracks_stage_update_tasks
AFTER UPDATE OF stage ON tracks
FOR EACH ROW EXECUTE FUNCTION populate_audio_tasks();
```

**Pros**:
- Restores queue visibility
- Monitoring queries work as-is
- Ops can reset/manage tasks
- No code changes to BaseTask

**Cons**:
- Requires database migration
- More complex schema

---

### Option 2: Adapt Monitoring (Not Recommended)

**Approach**: Change monitoring queries to read from `tracks` instead of `audio_tasks`

**Implementation**:
```typescript
// New getPendingTasks
export async function getPendingTracksByStage(
  taskType: string,
  stage: TrackStage
): Promise<Track[]> {
  return query(`
    SELECT t.*
    FROM tracks t
    WHERE t.stage = $1
      ${buildAudioTasksFilter(taskType)}
  `, [stage]);
}
```

**Pros**:
- No schema changes
- Matches new architecture

**Cons**:
- Need to rewrite all monitoring
- Views/dashboards broken
- Ops lose task management (no rows to UPDATE)
- Can't track attempts/retries without processing

---

### Option 3: Hybrid (Best of Both)

**Approach**: Insert pending rows on first `selectTracks()` call

**Implementation**:
```typescript
// base-task.ts
async selectTracksWithEnsure(limit: number, trackId?: string): Promise<TInput[]> {
  const tracks = await this.selectTracks(limit, trackId);

  // Ensure pending audio_tasks rows exist
  for (const track of tracks) {
    await ensureAudioTask(track.spotify_track_id, this.taskType);
  }

  return tracks;
}
```

**Pros**:
- Restores queue visibility
- No schema changes
- Minimal code changes

**Cons**:
- Slight performance overhead
- Rows created even if not processed (limit < queue size)

---

## Recommendation

**Option 1 (Database Trigger)** is recommended because:
1. Proper queue semantics (pending rows exist before processing)
2. Zero performance overhead
3. Enables operational management
4. Restores monitoring capabilities

**Implementation Steps**:
1. Create migration: `schema/migrations/009-populate-audio-tasks-trigger.sql`
2. Test with existing tracks (backfill pending rows)
3. Deploy trigger
4. Verify monitoring dashboards
5. Document new behavior

---

## Testing

### Before Fix
```sql
-- 50 tracks at 'audio_ready' stage
SELECT COUNT(*) FROM tracks WHERE stage = 'audio_ready';
-- Result: 50

-- But audio_tasks shows 0 pending
SELECT COUNT(*) FROM audio_tasks WHERE task_type = 'align' AND status = 'pending';
-- Result: 0
```

### After Fix
```sql
-- Same 50 tracks
SELECT COUNT(*) FROM tracks WHERE stage = 'audio_ready';
-- Result: 50

-- audio_tasks now shows 50 pending
SELECT COUNT(*) FROM audio_tasks WHERE task_type = 'align' AND status = 'pending';
-- Result: 50
```

---

## Timeline

- **Discovered**: 2025-01-11
- **Documented**: 2025-01-11
- **Target Fix**: Before production deployment
- **Blocking**: Yes - cannot deploy refactored tasks without queue visibility

---

## Related

- Original issue report in audit findings
- CRITICAL-FIXES.md (other refactoring issues)
- getPendingTasks() function (`src/db/audio-tasks.ts`)
- audio_progress view (`schema/02-tasks.sql`)
