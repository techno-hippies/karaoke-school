import { Image } from '@tamagui/image-next'
import { Text, YStack, Button as TButton } from 'tamagui'
import { Link } from 'one'
import { ToggleThemeButton } from '~/interface/ToggleThemeButton'
import oneBall from '~/app-icon.png'
import { useState, version } from 'react'
import { Button } from 'react-native'
import { runPKPTestSuite } from '~/lib/lit-protocol-test'

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

  const runTest = async () => {
    setTesting(true)
    setResult('Testing...')
    try {
      const testResult = await runPKPTestSuite()
      setResult(JSON.stringify(testResult, null, 2))
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <YStack gap="$3" width="100%" maxWidth={600}>
      <TButton size="$4" theme="blue" onPress={runTest} disabled={testing}>
        {testing ? '🧪 Testing Lit Protocol...' : '▶️  Test Lit Protocol PKPs'}
      </TButton>
      {result && (
        <YStack padding="$3" backgroundColor="$backgroundHover" borderRadius="$4">
          <Text fontSize="$2" fontFamily="$mono">{result}</Text>
        </YStack>
      )}
    </YStack>
  )
}
