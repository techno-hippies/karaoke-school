// IMPORTANT: Import polyfills FIRST, before any other imports
import './shims/globals';

// Add global error handler
if (!__DEV__) {
  const defaultErrorHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('Global error:', error);
    defaultErrorHandler(error, isFatal);
  });
}

import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { runPKPTestSuite } from './lit-protocol-test';

export default function App() {
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    try {
      console.log('Starting Lit test...');
      const result = await runPKPTestSuite();
      setTestResult(result);
    } catch (error) {
      console.error('Lit test error:', error);
      setTestResult({
        success: false,
        errors: [error.message || String(error)],
        warnings: [],
        tests: {
          litClientInit: false,
          authManagerInit: false,
          webAuthnAvailable: false,
        },
        performanceMs: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-run test on mount
  useEffect(() => {
    runTest();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lit Protocol PKP Test</Text>
      <Text style={styles.subtitle}>Expo + React Native</Text>

      <Button title="Run Test" onPress={runTest} disabled={loading} />

      {loading && <ActivityIndicator size="large" style={styles.loader} />}

      {testResult && (
        <ScrollView style={styles.resultContainer}>
          <Text style={styles.resultHeader}>
            Overall: {testResult.success ? '✅ PASS' : '❌ FAIL'}
          </Text>
          <Text>Platform: {testResult.platform || 'unknown'}</Text>
          <Text>Time: {testResult.performanceMs}ms</Text>

          <Text style={styles.sectionHeader}>Tests:</Text>
          <Text>  Lit Client Init: {testResult.tests.litClientInit ? '✅' : '❌'}</Text>
          <Text>  Auth Manager Init: {testResult.tests.authManagerInit ? '✅' : '❌'}</Text>
          <Text>  WebAuthn Available: {testResult.tests.webAuthnAvailable ? '✅' : '⚠️'}</Text>

          {testResult.errors && testResult.errors.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Errors ({testResult.errors.length}):</Text>
              {testResult.errors.map((err, i) => (
                <Text key={i} style={styles.errorText}>  - {err}</Text>
              ))}
            </>
          )}

          {testResult.warnings && testResult.warnings.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Warnings ({testResult.warnings.length}):</Text>
              {testResult.warnings.map((warn, i) => (
                <Text key={i} style={styles.warningText}>  - {warn}</Text>
              ))}
            </>
          )}

          {testResult.clientMethods && testResult.clientMethods.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Client Methods:</Text>
              <Text>  {testResult.clientMethods.join(', ')}</Text>
            </>
          )}
        </ScrollView>
      )}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  loader: {
    marginTop: 20,
  },
  resultContainer: {
    marginTop: 20,
    width: '100%',
  },
  resultHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  errorText: {
    color: 'red',
  },
  warningText: {
    color: 'orange',
  },
});
