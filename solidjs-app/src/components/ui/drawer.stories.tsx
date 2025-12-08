import type { Meta, StoryObj } from 'storybook-solidjs'
import { createSignal } from 'solid-js'
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from './drawer'
import { Button } from './button'
import { Input } from './input'

const meta: Meta = {
  title: 'UI/Drawer',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger as={Button}>Open Drawer</DrawerTrigger>
      <DrawerContent footer={<Button class="w-full">Confirm</Button>}>
        <DrawerHeader>
          <DrawerTitle class="text-2xl">Drawer Title</DrawerTitle>
          <DrawerDescription>
            This is a bottom drawer that slides up from the bottom of the screen.
            Drag down to dismiss.
          </DrawerDescription>
        </DrawerHeader>
        <div class="py-6">
          <p class="text-muted-foreground">
            Drawer content goes here. This component is ideal for mobile interfaces
            where you need a modal that doesn't get obscured by the keyboard.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  ),
}

export const WithBackButton: Story = {
  render: () => {
    const [step, setStep] = createSignal(1)

    const footer = () => step() === 1
      ? <Button class="w-full" onClick={() => setStep(2)}>Next</Button>
      : <Button class="w-full" onClick={() => setStep(1)}>Done</Button>

    return (
      <Drawer>
        <DrawerTrigger as={Button}>Multi-Step Drawer</DrawerTrigger>
        <DrawerContent
          onBack={step() > 1 ? () => setStep(step() - 1) : undefined}
          footer={footer()}
        >
          <DrawerHeader>
            <DrawerTitle class="text-2xl">Step {step()} of 2</DrawerTitle>
          </DrawerHeader>
          <div class="py-6">
            {step() === 1 ? (
              <p class="text-muted-foreground">
                This is the first step. Click Next to see the back button appear.
              </p>
            ) : (
              <p class="text-muted-foreground">
                Now you can see the back button in the top-left corner.
              </p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    )
  },
}

export const WithInput: Story = {
  name: 'With Input (Keyboard Safe)',
  render: () => {
    const [username, setUsername] = createSignal('')

    return (
      <Drawer>
        <DrawerTrigger as={Button}>Username Input</DrawerTrigger>
        <DrawerContent
          footer={
            <Button class="w-full h-14 text-lg" disabled={username().length < 6}>
              Continue
            </Button>
          }
        >
          <DrawerHeader>
            <DrawerTitle class="text-2xl">Choose Username</DrawerTitle>
            <DrawerDescription>
              Enter a username for your account. This drawer stays visible when the
              mobile keyboard opens.
            </DrawerDescription>
          </DrawerHeader>
          <div class="py-6 space-y-4">
            <Input
              placeholder="Enter username (min 6 chars)"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              class="h-14 text-lg"
              autocapitalize="off"
              autocomplete="username"
            />
            {username().length >= 6 && (
              <p class="text-sm text-green-500">Valid username length</p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    )
  },
}

export const NoHandle: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger as={Button}>No Handle</DrawerTrigger>
      <DrawerContent showHandle={false}>
        <DrawerHeader>
          <DrawerTitle class="text-2xl">No Drag Handle</DrawerTitle>
          <DrawerDescription>
            This drawer has no visible handle, but can still be dragged to dismiss.
          </DrawerDescription>
        </DrawerHeader>
        <div class="py-6">
          <p class="text-muted-foreground">
            Use showHandle=false when you want a cleaner look.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  ),
}

export const TallContent: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger as={Button}>Tall Content</DrawerTrigger>
      <DrawerContent
        footer={<Button class="w-full">Done (Sticky)</Button>}
      >
        <DrawerHeader>
          <DrawerTitle class="text-2xl">Scrollable Content</DrawerTitle>
          <DrawerDescription>
            The button stays sticky at the bottom while content scrolls.
          </DrawerDescription>
        </DrawerHeader>
        <div class="py-6 space-y-4">
          {Array.from({ length: 20 }, (_, i) => (
            <div class="p-4 bg-secondary rounded-lg">
              <p class="font-medium">Item {i + 1}</p>
              <p class="text-sm text-muted-foreground">
                This is some content that demonstrates scrolling within the drawer.
              </p>
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  ),
}

export const SnapPoints: Story = {
  render: () => (
    <Drawer snapPoints={[0.4, 1]}>
      <DrawerTrigger as={Button}>With Snap Points</DrawerTrigger>
      <DrawerContent footer={<Button class="w-full">Action</Button>}>
        <DrawerHeader>
          <DrawerTitle class="text-2xl">Snap Points</DrawerTitle>
          <DrawerDescription>
            This drawer has two snap points: 40% and 100% height.
            Drag to snap between them.
          </DrawerDescription>
        </DrawerHeader>
        <div class="py-6">
          <p class="text-muted-foreground">
            Snap points are useful for drawers that can show a preview state
            before fully expanding.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  ),
}

export const AuthExample: Story = {
  name: 'Auth Dialog Example',
  render: () => {
    const [username, setUsername] = createSignal('')
    const [step, setStep] = createSignal<'method' | 'username'>('method')

    // Footer only shows for username step
    const footer = () => step() === 'username' ? (
      <Button
        class="w-full h-14 text-lg"
        disabled={username().length < 6}
      >
        Create Account
      </Button>
    ) : undefined

    return (
      <Drawer>
        <DrawerTrigger as={Button} variant="gradient">Sign In</DrawerTrigger>
        <DrawerContent
          onBack={step() === 'username' ? () => setStep('method') : undefined}
          footer={footer()}
        >
          <DrawerHeader>
            <DrawerTitle class="text-3xl">
              {step() === 'method' ? 'Sign In' : 'Choose Username'}
            </DrawerTitle>
          </DrawerHeader>

          {step() === 'method' ? (
            <div class="py-6 space-y-4">
              <Button
                variant="outline"
                class="w-full h-14 justify-start px-5 text-lg font-medium gap-4"
                onClick={() => setStep('username')}
              >
                <span class="text-2xl">*</span>
                <span>Passkey (Recommended)</span>
              </Button>
              <Button
                variant="outline"
                class="w-full h-14 justify-start px-5 text-lg font-medium gap-4"
              >
                <span class="text-2xl">G</span>
                <span>Continue with Google</span>
              </Button>
              <Button
                variant="outline"
                class="w-full h-14 justify-start px-5 text-lg font-medium gap-4"
              >
                <span class="text-2xl">D</span>
                <span>Continue with Discord</span>
              </Button>
            </div>
          ) : (
            <div class="py-6 space-y-4">
              <Input
                placeholder="Enter username (min 6 chars)"
                value={username()}
                onInput={(e) => setUsername(e.currentTarget.value.toLowerCase())}
                class="h-14 text-lg"
                autocapitalize="off"
                autocomplete="username"
                autofocus
              />
              {username().length >= 6 && (
                <p class="text-sm text-green-500">Valid username</p>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    )
  },
}
