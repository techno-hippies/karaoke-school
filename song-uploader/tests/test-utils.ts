/**
 * Test Utilities
 * Helper functions for robust testing
 */

import { config } from '../src/config.js'

/**
 * Test result type
 */
export interface TestResult {
  passed: boolean
  name: string
  duration: number
  error?: string
  details?: Record<string, any>
}

/**
 * Run a test with timing and error handling
 */
export async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<TestResult> {
  console.log(`\n${'▶'.repeat(60)}`)
  console.log(`TEST: ${name}`)
  console.log('▶'.repeat(60))

  const startTime = Date.now()

  try {
    await testFn()
    const duration = Date.now() - startTime

    console.log(`\n✅ PASSED (${duration}ms)`)
    console.log('═'.repeat(60) + '\n')

    return {
      passed: true,
      name,
      duration,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    console.error(`\n❌ FAILED (${duration}ms)`)
    console.error(`Error: ${errorMessage}`)
    if (error instanceof Error && error.stack) {
      console.error(`Stack: ${error.stack}`)
    }
    console.log('═'.repeat(60) + '\n')

    return {
      passed: false,
      name,
      duration,
      error: errorMessage,
    }
  }
}

/**
 * Assert a condition is true
 */
export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`   ✓ ${message}`)
}

/**
 * Assert two values are equal
 */
export function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`)
  }
  console.log(`   ✓ ${label}: ${actual} === ${expected}`)
}

/**
 * Assert value is greater than threshold
 */
export function assertGreaterThan(
  actual: number,
  threshold: number,
  label: string
): void {
  if (actual <= threshold) {
    throw new Error(`${label}: expected > ${threshold}, got ${actual}`)
  }
  console.log(`   ✓ ${label}: ${actual} > ${threshold}`)
}

/**
 * Assert array is not empty
 */
export function assertNotEmpty<T>(array: T[], label: string): void {
  if (array.length === 0) {
    throw new Error(`${label}: array is empty`)
  }
  console.log(`   ✓ ${label}: array has ${array.length} items`)
}

/**
 * Assert value exists (not null/undefined)
 */
export function assertExists<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`${label}: value is null or undefined`)
  }
  console.log(`   ✓ ${label}: exists`)
  return value
}

/**
 * Assert string starts with prefix
 */
export function assertStartsWith(
  str: string,
  prefix: string,
  label: string
): void {
  if (!str.startsWith(prefix)) {
    throw new Error(`${label}: "${str}" does not start with "${prefix}"`)
  }
  console.log(`   ✓ ${label}: starts with "${prefix}"`)
}

/**
 * Print test summary
 */
export function printTestSummary(results: TestResult[]): void {
  console.log('\n' + '═'.repeat(60))
  console.log('TEST SUMMARY')
  console.log('═'.repeat(60))

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  console.log(`Total: ${total}`)
  console.log(`✅ Passed: ${passed}`)
  if (failed > 0) console.log(`❌ Failed: ${failed}`)

  if (failed > 0) {
    console.log('\nFailed tests:')
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  ❌ ${r.name}`)
        if (r.error) console.log(`     ${r.error}`)
      })
  }

  console.log('═'.repeat(60) + '\n')
}

/**
 * Create a test file from string content
 */
export function createTestFile(
  content: string,
  filename: string,
  mimeType: string
): File {
  const blob = new Blob([content], { type: mimeType })
  return new File([blob], filename, { type: mimeType })
}

/**
 * Get test song directory
 */
export function getTestSongDir(): string {
  return `${config.upload.songsDir}/heat-of-the-night-scarlett-x`
}

/**
 * Check if test song exists
 */
export async function checkTestSongExists(): Promise<boolean> {
  const testSongDir = getTestSongDir()
  try {
    const metadataFile = Bun.file(`${testSongDir}/metadata.json`)
    const audioFile = Bun.file(`${testSongDir}/audio.mp3`)
    const lyricsFile = Bun.file(`${testSongDir}/lyrics.txt`)

    return (
      (await metadataFile.exists()) &&
      (await audioFile.exists()) &&
      (await lyricsFile.exists())
    )
  } catch {
    return false
  }
}
