# Exercise Components Architecture

## Overview

Exercise components follow a **Container/Presentation** pattern to separate business logic from UI, making components testable and Storybook-friendly.

## Architecture Layers

```
┌─────────────────────────────────────────────┐
│ StudySession (Session Manager)              │
│ - Manages FSRS card progression             │
│ - Session statistics                        │
│ - Auto-advance between exercises            │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│ SayItBack (Business Logic Container)        │
│ - Wagmi hooks (useAccount, useWalletClient) │
│ - Lit Protocol service                      │
│ - Voice recording hook                      │
│ - Error handling                            │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│ SayItBackExercise (Presentation)            │
│ - Pure UI component                         │
│ - No external dependencies                  │
│ - Storybook-friendly ✅                     │
│ - Props: text, score, callbacks             │
└─────────────────────────────────────────────┘
```

## Component Types

### 1. Presentation Components

**Location:** `*Exercise.tsx` (e.g., `SayItBackExercise.tsx`, `MultipleChoiceExercise.tsx`)

**Characteristics:**
- ✅ Pure UI components
- ✅ Props-based (no hooks to external services)
- ✅ Storybook stories work without providers
- ✅ Easy to test
- ❌ No Wagmi hooks
- ❌ No Lit Protocol calls
- ❌ No direct database access

**Example:**
```tsx
export function SayItBackExercise({
  expectedText,
  transcript,
  score,
  isRecording,
  onStartRecording,
  onStopRecording,
}: SayItBackExerciseProps) {
  return <div>{/* Pure UI */}</div>
}
```

### 2. Container Components

**Location:** Same name without "Exercise" suffix (e.g., `SayItBack.tsx`)

**Characteristics:**
- ✅ Handles business logic
- ✅ Wagmi hooks allowed
- ✅ Service calls allowed
- ✅ Wraps presentation component
- ⚠️ Requires providers (not Storybook-friendly)

**Example:**
```tsx
export function SayItBack({ expectedText, onComplete }: SayItBackProps) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { isRecording, audioBlob, startRecording, stopRecording } = useVoiceRecorder()

  // Business logic here...

  return (
    <SayItBackExercise
      expectedText={expectedText}
      transcript={transcript}
      score={score}
      isRecording={isRecording}
      onStartRecording={handleStart}
      onStopRecording={handleStop}
    />
  )
}
```

### 3. Session Managers

**Location:** `StudySession.tsx`

**Characteristics:**
- ✅ Manages exercise flow
- ✅ FSRS scheduling
- ✅ Session statistics
- ✅ Progress tracking
- ✅ Uses container components

## Creating New Exercise Types

To add a new exercise type (e.g., "FillInTheBlank"):

### Step 1: Create Presentation Component

`FillInTheBlankExercise.tsx`:
```tsx
export interface FillInTheBlankExerciseProps {
  question: string
  answer?: string
  isCorrect?: boolean
  onSubmit?: (answer: string) => void
}

export function FillInTheBlankExercise({
  question,
  answer,
  isCorrect,
  onSubmit
}: FillInTheBlankExerciseProps) {
  // Pure UI only
  return <div>{/* ... */}</div>
}
```

### Step 2: Create Container (if needed)

`FillInTheBlank.tsx`:
```tsx
export function FillInTheBlank({
  questionId,
  onComplete
}: FillInTheBlankProps) {
  const [answer, setAnswer] = useState('')
  // Any business logic, API calls, etc.

  return (
    <FillInTheBlankExercise
      question={questionText}
      answer={answer}
      onSubmit={handleSubmit}
    />
  )
}
```

### Step 3: Add to StudySession

Update `StudySession.tsx` to handle the new exercise type.

## Storybook Guidelines

### ✅ Do This: Story for Presentation Component

```tsx
// FillInTheBlankExercise.stories.tsx
export const Default: Story = {
  args: {
    question: "What is 2 + 2?",
    onSubmit: (answer) => console.log(answer)
  }
}
```

### ❌ Don't Do This: Story for Container with Wagmi

```tsx
// FillInTheBlank.stories.tsx (DON'T - needs WagmiProvider)
export const Default: Story = {
  args: {
    questionId: "123" // Won't work - needs providers
  }
}
```

## Shared UI Components

### VoiceControls

Full-width button for voice recording:
- **Idle**: Blue "Record" button
- **Recording**: Red "Stop Recording" button (pulsing)
- **Processing**: Disabled "Processing..." button with spinner

### NavigationControls

Full-width "Next" button with optional flag/report:
- **Default**: Blue "Next" button
- **With Report**: Next button + flag icon button

### AnimatedFooter

Sliding footer container:
- Fixed at bottom
- Slides up when `show={true}`
- Wraps VoiceControls or NavigationControls

### ExerciseHeader

Fixed header with progress bar:
- Close button (X)
- Progress bar showing completion

## File Organization

```
src/components/exercises/
├── README.md (this file)
├── StudySession.tsx (session manager)
├── StudyStats.tsx (statistics display)
│
├── SayItBack.tsx (container)
├── SayItBackExercise.tsx (presentation)
├── SayItBackExercise.stories.tsx (Storybook)
│
├── MultipleChoiceExercise.tsx (presentation + container)
│
├── VoiceControls.tsx (shared)
├── VoiceControls.stories.tsx
├── NavigationControls.tsx (shared)
├── NavigationControls.stories.tsx
├── AnimatedFooter.tsx (shared)
├── AnimatedFooter.stories.tsx
│
└── layouts/
    ├── ExerciseHeader.tsx
    └── ExerciseHeader.stories.tsx
```

## Best Practices

1. **Always separate presentation from logic** for complex components with external dependencies
2. **Keep presentation components pure** - no hooks to Wagmi, databases, or services
3. **Write Storybook stories for presentation components** only
4. **Use containers to wrap presentation** with business logic
5. **Session managers orchestrate containers**, not presentation components
6. **Shared UI components** should be presentation-only (VoiceControls, NavigationControls, etc.)
