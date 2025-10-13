# Unlock Flow State Machine - Test Results

## Test Coverage

✅ **All 17 tests passing**

### Test Categories

#### 1. State Transitions (2 tests)
- ✅ Machine starts in idle state
- ✅ Transitions to checkingRequirements on START

#### 2. Credit Checking Guards (5 tests)
- ✅ Free song skips credit check
- ✅ Paid song with credits skips credit dialog
- ✅ Paid song without credits shows credit dialog
- ✅ Credit dialog can transition after credits acquired
- ✅ Credit dialog can be cancelled

#### 3. Match and Segment (3 tests)
- ✅ Successful match transitions to waitingForTx and then processing
- ✅ Failed match transitions to matchFailed
- ✅ matchFailed can retry

#### 4. Parallel Processing (2 tests)
- ✅ Successful parallel processing completes
- ✅ Audio failure can be retried independently

#### 5. Language Configuration (3 tests)
- ✅ Uses default language if not specified
- ✅ Uses provided target language
- ✅ Language can be changed during flow

#### 6. Error Recovery (2 tests)
- ✅ Transaction failure can be retried
- ✅ Can cancel from error states

## Running Tests

```bash
# Run unlock machine tests
bun run test:unit

# Watch mode (auto-rerun on changes)
bun run test:unit:watch

# Run all unit tests (including other components)
bun run test:unit:all
```

## Test Implementation

Location: `src/machines/__tests__/unlockMachine.test.ts`

The tests use:
- **vitest** - Fast unit test framework
- **XState's createActor** - Create state machine instances
- **XState's waitFor** - Wait for specific states
- **Mock actors** - Test without real Lit Protocol calls

### Mock Strategy

Each test creates a simplified version of the machine with mock actors that can:
- Return success/failure based on test configuration
- Complete instantly (no real 60s waits)
- Simulate errors for testing error recovery

## What's Tested

### ✅ Business Logic
- Credit checking (free vs paid songs)
- Guard conditions (isFree, hasCredits)
- State transitions for happy path
- Error handling and recovery

### ✅ Parallel Processing
- All 3 processes run concurrently
- Independent error recovery per process
- Completion when all succeed

### ✅ User Experience
- Language detection and changes
- Credit dialog flow
- Retry mechanisms
- Cancel operations

## What's NOT Tested (Yet)

These would require integration tests:
- Actual Lit Protocol interactions
- Real blockchain transactions
- Webhook callbacks
- Progress updates from Modal/Demucs

## Next Steps

1. **Integration Tests**: Test with real Lit Protocol actions (in Storybook or dev environment)
2. **E2E Tests**: Full unlock flow from song page to completion
3. **Performance Tests**: Verify timeouts and progress tracking

## Test Results History

- **2025-10-13**: Initial test suite created - 17/17 passing ✅
