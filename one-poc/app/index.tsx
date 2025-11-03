import { View, Text, YStack, Button, H1, H2, Paragraph, Separator, XStack, ScrollView } from 'tamagui'
import { useState } from 'react'
import { runPKPTestSuite, type PKPTestResult } from '../lib/lit-protocol-test'

export default function HomePage() {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<PKPTestResult | null>(null)

  const runTests = async () => {
    setTesting(true)
    setResult(null)

    try {
      const testResult = await runPKPTestSuite()
      setResult(testResult)
    } catch (err) {
      console.error('Test suite crashed:', err)
      setResult({
        success: false,
        platform: process.env.VITE_ENVIRONMENT || 'unknown',
        tests: {
          litClientInit: false,
          pkpAuth: false,
          signing: false,
        },
        errors: [err instanceof Error ? err.message : String(err)],
        warnings: [],
        performanceMs: 0,
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <ScrollView>
      <YStack
        flex={1}
        justifyContent="flex-start"
        alignItems="center"
        padding="$6"
        backgroundColor="$background"
        gap="$4"
        minHeight="100vh"
      >
        <YStack gap="$2" alignItems="center" marginTop="$8">
          <H1>One.js + Lit Protocol PoC</H1>
          <Paragraph theme="alt1" textAlign="center" maxWidth={600}>
            Testing if Lit Protocol PKPs work with One.js + React Native
          </Paragraph>
          <Paragraph fontSize="$2" theme="alt2">
            Platform: {process.env.VITE_ENVIRONMENT || 'unknown'}
          </Paragraph>
        </YStack>

        <Separator marginVertical="$4" />

        {/* Test Controls */}
        <YStack gap="$3" width="100%" maxWidth={600}>
          <Button
            size="$5"
            theme="blue"
            onPress={runTests}
            disabled={testing}
          >
            {testing ? '🧪 Running Tests...' : '▶️  Run PKP Test Suite'}
          </Button>

          {testing && (
            <View
              padding="$4"
              backgroundColor="$blue4"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$blue7"
            >
              <Text fontSize="$3" fontWeight="600" color="$blue11">
                ⏳ Testing in progress...
              </Text>
              <Text fontSize="$2" theme="alt2" marginTop="$2">
                This may take 10-30 seconds depending on network
              </Text>
            </View>
          )}
        </YStack>

        {/* Test Results */}
        {result && (
          <YStack gap="$4" width="100%" maxWidth={600} marginTop="$4">
            {/* Overall Status */}
            <View
              padding="$4"
              backgroundColor={result.success ? '$green4' : '$red4'}
              borderRadius="$4"
              borderWidth={2}
              borderColor={result.success ? '$green7' : '$red7'}
            >
              <H2>
                {result.success ? '✅ All Tests Passed!' : '❌ Tests Failed'}
              </H2>
              <Text fontSize="$2" theme="alt2" marginTop="$2">
                Platform: {result.platform} | Time: {result.performanceMs}ms
              </Text>
            </View>

            {/* Individual Test Results */}
            <YStack gap="$2">
              <Text fontSize="$4" fontWeight="600">Test Results:</Text>

              <XStack gap="$2" alignItems="center">
                <Text fontSize="$6">
                  {result.tests.litClientInit ? '✅' : '❌'}
                </Text>
                <Text fontSize="$3">Lit Client Initialization</Text>
              </XStack>

              <XStack gap="$2" alignItems="center">
                <Text fontSize="$6">
                  {result.tests.pkpAuth ? '✅' : '❌'}
                </Text>
                <Text fontSize="$3">PKP Authentication</Text>
              </XStack>

              <XStack gap="$2" alignItems="center">
                <Text fontSize="$6">
                  {result.tests.signing ? '✅' : '❌'}
                </Text>
                <Text fontSize="$3">Transaction Signing</Text>
              </XStack>
            </YStack>

            {/* Errors */}
            {result.errors.length > 0 && (
              <YStack gap="$2">
                <Text fontSize="$4" fontWeight="600" color="$red10">
                  Errors ({result.errors.length}):
                </Text>
                {result.errors.map((error, idx) => (
                  <View
                    key={idx}
                    padding="$3"
                    backgroundColor="$red3"
                    borderRadius="$3"
                    borderWidth={1}
                    borderColor="$red6"
                  >
                    <Text fontSize="$2" color="$red11">
                      {error}
                    </Text>
                  </View>
                ))}
              </YStack>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <YStack gap="$2">
                <Text fontSize="$4" fontWeight="600" color="$orange10">
                  Warnings ({result.warnings.length}):
                </Text>
                {result.warnings.map((warning, idx) => (
                  <View
                    key={idx}
                    padding="$3"
                    backgroundColor="$orange3"
                    borderRadius="$3"
                    borderWidth={1}
                    borderColor="$orange6"
                  >
                    <Text fontSize="$2" color="$orange11">
                      ⚠️  {warning}
                    </Text>
                  </View>
                ))}
              </YStack>
            )}

            {/* Next Steps */}
            <View
              padding="$4"
              backgroundColor="$backgroundHover"
              borderRadius="$4"
            >
              <Text fontSize="$4" fontWeight="600" marginBottom="$2">
                📝 Next Steps:
              </Text>
              {result.success ? (
                <Text fontSize="$2" theme="alt1">
                  ✅ PKPs work in React Native!{'\n'}
                  → You can migrate app to One.js{'\n'}
                  → Estimated time: 4-5 weeks{'\n'}
                  → Use Tamagui for UI components
                </Text>
              ) : (
                <Text fontSize="$2" theme="alt1">
                  ❌ PKPs don't work in React Native{'\n'}
                  → Need fallback auth strategy:{'\n'}
                  {'  '}• WebView bridge for PKP auth{'\n'}
                  {'  '}• Biometric auth fallback{'\n'}
                  {'  '}• Or build separate native app{'\n'}
                  → Estimated time: 6-8 weeks
                </Text>
              )}
            </View>
          </YStack>
        )}

        {/* Info Card */}
        <View
          padding="$4"
          backgroundColor="$backgroundHover"
          borderRadius="$4"
          width="100%"
          maxWidth={600}
          marginTop="$4"
        >
          <Text fontSize="$3" fontWeight="600" marginBottom="$2">
            What This Tests:
          </Text>
          <Text fontSize="$2" theme="alt1">
            1. Can Lit Protocol client initialize in React Native?{'\n'}
            2. Can PKPs authenticate without browser WebAuthn?{'\n'}
            3. Can we sign transactions with PKPs?{'\n'}
            {'\n'}
            This is the critical blocker for deciding between:{'\n'}
            • One.js universal app (if PKPs work){'\n'}
            • Separate React Native app (if PKPs don't work)
          </Text>
        </View>
      </YStack>
    </ScrollView>
  )
}
