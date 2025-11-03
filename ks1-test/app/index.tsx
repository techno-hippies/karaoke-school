// Buffer polyfill for Lit Protocol (must be first!)
import { Buffer } from 'buffer'
if (typeof window !== 'undefined') {
  window.Buffer = Buffer
}

// React Native global polyfills
import '~/shims/globals'

import { Image } from '@tamagui/image-next'
import { Text, YStack, Button as TButton } from 'tamagui'
import { Link } from 'one'
import { ToggleThemeButton } from '~/interface/ToggleThemeButton'
import oneBall from '~/app-icon.png'
import { useState, version, useEffect } from 'react'
import { Button } from 'react-native'

export function HomePage() {
  return (
    <YStack bg="$color1" minH="100%" gap="$4" px="$4" items="center" justify="center" flex={1}>
      <Text fontSize="$8" text="center">
        Hello, One
      </Text>

      <LitProtocolTest />

      <CompilerTest />

      <Image src={oneBall} width={128} height={128} />

      <YStack items="center" gap="$6">
        <Text fontSize="$5" lineHeight="$5" text="center" color="$color11">
          Edit <Text>app/index.tsx</Text> to change this screen and then come back to see your
          edits.
        </Text>
        <Text fontSize="$5" lineHeight="$5" text="center" color="$color11">
          Read{' '}
          <Link href="https://onestack.dev/docs/introduction">
            <Text color="$yellow10" $platform-web={{ fontSize: 'inherit' }}>
              the docs
            </Text>
          </Link>{' '}
          to discover what to do next.
        </Text>

        <Text fontSize="$5" lineHeight="$5" text="center" color="$color11">
          React version: {version}
        </Text>

        <ToggleThemeButton />
      </YStack>
    </YStack>
  )
}

function CompilerTest() {
  const [count, setCount] = useState(0)

  return (
    <>
      <Button title="Increment" onPress={() => setCount((c) => c + 1)} />
      <Text>Count: {count}</Text>
      <Child />
      <Child />
      <Child />
    </>
  )
}

function Child() {
  console.log('Child render')
  return <Text>Child</Text>
}

function LitProtocolTest() {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<string>('')
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const runTest = async () => {
    if (!isClient) return

    setTesting(true)
    setResult('Testing...')
    try {
      // Dynamic import to avoid SSR issues
      const { runPKPTestSuite } = await import('~/lib/lit-protocol-test')
      const testResult = await runPKPTestSuite()
      setResult(JSON.stringify(testResult, null, 2))
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTesting(false)
    }
  }

  const registerPKP = async () => {
    if (!isClient) return

    setTesting(true)
    setResult('Registering PKP with WebAuthn...\n\nYou will be prompted to create a passkey.')
    try {
      const { testWebAuthnRegistration } = await import('~/lib/lit-protocol-test')
      const regResult = await testWebAuthnRegistration()
      setResult(JSON.stringify(regResult, null, 2))
    } catch (err) {
      setResult(`Registration Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTesting(false)
    }
  }

  const authenticatePKP = async () => {
    if (!isClient) return

    setTesting(true)
    setResult('Authenticating with WebAuthn...\n\nYou will be prompted to use your passkey.')
    try {
      const { testWebAuthnAuthentication } = await import('~/lib/lit-protocol-test')
      const authResult = await testWebAuthnAuthentication()
      setResult(JSON.stringify(authResult, null, 2))
    } catch (err) {
      setResult(`Authentication Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTesting(false)
    }
  }

  if (!isClient) {
    return <Text>Loading test...</Text>
  }

  return (
    <YStack gap="$3" width="100%" maxWidth={600}>
      <TButton size="$4" theme="blue" onPress={runTest} disabled={testing}>
        {testing ? '🧪 Testing...' : '▶️  Test Lit Protocol Init'}
      </TButton>

      <YStack gap="$2">
        <Text fontSize="$3" fontWeight="bold" color="$color11">WebAuthn PKP Tests:</Text>
        <TButton size="$4" theme="green" onPress={registerPKP} disabled={testing}>
          {testing ? '🔐 Registering...' : '🆕 Register New PKP (Create Passkey)'}
        </TButton>
        <TButton size="$4" theme="orange" onPress={authenticatePKP} disabled={testing}>
          {testing ? '🔐 Authenticating...' : '🔑 Authenticate Existing PKP (Use Passkey)'}
        </TButton>
      </YStack>

      {result && (
        <YStack padding="$3" backgroundColor="$backgroundHover" borderRadius="$4">
          <Text fontSize="$2" fontFamily="$mono">{result}</Text>
        </YStack>
      )}
    </YStack>
  )
}
