# Exercise Components Architecture

## Overview

Exercise components follow a **pure presentation pattern** for Storybook-friendly development and maximum reusability. Each exercise TYPE is a first-class component that can be composed into study sessions.

## Architecture Principles

### 1. Exercise Types as Lego Blocks

Each exercise type is an **independent, pure presentation component**:

- **`MultipleChoiceExercise`** - Trivia questions with multiple options
- **`SayItBackExercise`** - Pronunciation/speaking practice

These are **NOT wrapped in a generic container** - each type is its own specialized component.

### 2. Pure Presentation Components

**Characteristics:**
- ✅ Props-based interface (no external hooks)
- ✅ Storybook-friendly (works without providers)
- ✅ Controlled/uncontrolled mode support
- ✅ Easy to test
- ❌ No Wagmi hooks
- ❌ No Lit Protocol calls
- ❌ No direct database access

**Example:**
```tsx
export function MultipleChoiceExercise({
  question,
  options,
  onAnswer,
  hasAnswered,
  selectedAnswerId
}: MultipleChoiceExerciseProps) {
  // Pure UI only
  return <div>{/* ... */}</div>
}
```

### 3. Controlled vs Uncontrolled Mode

Components support **both modes**:

**Uncontrolled** (for simple use cases):
```tsx
<MultipleChoiceExercise
  question="What is 2+2?"
  options={options}
  onAnswer={(id, correct) => console.log(id, correct)}
/>
```

**Controlled** (for complex state management):
```tsx
<MultipleChoiceExercise
  question="What is 2+2?"
  options={options}
  hasAnswered={true}
  selectedAnswerId="2"
  onAnswer={handleAnswer}
/>
```

### 4. Session Managers Orchestrate

Higher-level components like `StudySession` (from old codebase):
- Load cards from database/FSRS
- Determine which exercise TYPE to render
- Manage progression between exercises
- Handle scoring and statistics
- Update FSRS scheduling

## Component Catalog

### Exercise Types

#### MultipleChoiceExercise
Pure presentation component for trivia questions.

**Props:**
- `question: string` - The trivia question
- `options: MultipleChoiceOption[]` - Array of answer options
- `onAnswer?: (id, isCorrect) => void` - Callback on selection
- `hasAnswered?: boolean` - Controlled mode
- `selectedAnswerId?: string` - Controlled mode
- `explanation?: string` - Shown after answering
- `isProcessing?: boolean` - Processing state

**Stories:**
- NotAnswered
- Answered
- WithExplanation
- TwoOptions
- Processing

#### SayItBackExercise
Pure presentation component for pronunciation/speaking practice.

**Props:**
- `expectedText: string` - The text the user should say
- `transcript?: string` - The user's transcribed speech
- `score?: number | null` - Score 0-100
- `attempts?: number` - Number of attempts
- `isRecording?: boolean` - Recording in progress
- `isProcessing?: boolean` - Transcription processing
- `canRecord?: boolean` - Whether recording is available
- `statusMessage?: string` - Status message to display
- `onStartRecording?: () => void` - Start recording callback
- `onStopRecording?: () => void` - Stop recording callback

**Stories:**
- NotStarted
- Recording
- Processing
- NotReady
- CorrectAnswer
- PartiallyCorrect
- Incorrect

### Shared UI Components (from old codebase)

These are referenced from the existing site architecture:

- **`ExerciseHeader`** - Fixed header with progress bar and close button
- **`NavigationControls`** - Next button with optional report flag
- **`VoiceControls`** - Record/Stop button for voice exercises
- **`AnimatedFooter`** - Sliding footer container

## Creating New Exercise Types

To add a new exercise type (e.g., "MatchingPairs"):

### Step 1: Create Pure Presentation Component

```tsx
// MatchingPairsExercise.tsx
export interface MatchingPairsExerciseProps {
  pairs: Array<{ id: string; left: string; right: string }>
  onMatch?: (leftId: string, rightId: string) => void
  matches?: Record<string, string> // Controlled mode
}

export function MatchingPairsExercise({
  pairs,
  onMatch,
  matches = {}
}: MatchingPairsExerciseProps) {
  // Pure UI only - no external hooks
  return <div>{/* ... */}</div>
}
```

### Step 2: Create Storybook Stories

```tsx
// MatchingPairsExercise.stories.tsx
export const NotStarted: Story = {
  args: {
    pairs: [
      { id: '1', left: 'hello', right: '你好' },
      { id: '2', left: 'goodbye', right: '再见' }
    ]
  }
}

export const PartiallyMatched: Story = {
  args: {
    pairs: [...],
    matches: { '1': 'left-1-right-2' }
  }
}

export const AllMatched: Story = {
  args: {
    pairs: [...],
    matches: { /* all matched */ }
  }
}
```

### Step 3: Integrate into Session Manager

If you need to use it in a study session, update the session manager to handle the new exercise type:

```tsx
// In StudySession.tsx (from old codebase)
{currentCard.exercise_type === 'matching' && (
  <MatchingPairsExercise
    pairs={currentCard.pairs}
    onMatch={handleMatch}
    matches={matches}
  />
)}
```

## Storybook Best Practices

### ✅ Do This: Story for Each State

```tsx
export const NotAnswered: Story = { args: { ... } }
export const Correct: Story = { args: { hasAnswered: true, ... } }
export const Incorrect: Story = { args: { hasAnswered: true, ... } }
export const WithHint: Story = { args: { hint: '...', ... } }
export const Processing: Story = { args: { isProcessing: true, ... } }
```

### ✅ Do This: Use Decorators for Layout

```tsx
decorators: [
  (Story) => (
    <div className="w-full max-w-2xl p-6">
      <Story />
    </div>
  )
]
```

### ❌ Don't Do This: External Dependencies

```tsx
// DON'T - requires providers
export function MyExercise() {
  const { address } = useAccount() // ❌ Wagmi hook
  const [data] = useTinybase() // ❌ Database hook
  return <div>{/* ... */}</div>
}
```

## File Organization

```
src/components/exercises/
├── README.md (this file)
│
├── MultipleChoiceExercise.tsx (presentation)
├── SayItBackExercise.tsx (presentation)
│
└── src/stories/exercises/
    ├── MultipleChoiceExercise.stories.tsx
    └── SayItBackExercise.stories.tsx
```

## Design Principles

1. **Each exercise TYPE is a first-class component** - not a variant of a generic wrapper
2. **Pure presentation** - no external dependencies, Storybook-friendly
3. **Controlled/uncontrolled modes** - flexible state management
4. **Comprehensive stories** - document all states and edge cases
5. **Composable** - can be used in any layout or session manager
6. **Type-safe** - full TypeScript support with exported interfaces

## Integration with Existing Codebase

This architecture **complements** the existing `site/src/components/exercises/` structure:

- **Old codebase** has container components (SayItBack.tsx) with business logic
- **New codebase** has pure presentation components for Storybook
- Both can coexist - use pure components for stories, wrap with containers for production

The key insight: **Exercise TYPES are Lego blocks, not generic wrappers**.
