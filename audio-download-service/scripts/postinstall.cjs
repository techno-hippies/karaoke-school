#!/usr/bin/env node
/**
 * Bun compatibility patch for slsk-client
 * 
 * Patches node_modules/slsk-client/lib/server.js to fix Bun's callback behavior.
 * Bun: net.createConnection callback receives (socket) on success
 * Node.js: net.createConnection callback receives () on success
 */

const fs = require('fs');
const path = require('path');

const SERVER_FILE = path.join(__dirname, '../node_modules/slsk-client/lib/server.js');

if (!fs.existsSync(SERVER_FILE)) {
  console.log('❌ slsk-client not installed, skipping patch');
  process.exit(0);
}

const CONTENT = fs.readFileSync(SERVER_FILE, 'utf8');

// Check if already patched
if (CONTENT.includes('BUN_COMPATIBILITY_PATCH')) {
  console.log('✅ Patch already applied');
  process.exit(0);
}

// Handle different versions of slsk-client
// Pattern 1: this.conn = net.createConnection(serverAddress, cb)
const directPattern = /(this\.conn = net\.createConnection\(serverAddress, cb\))/;

// Pattern 2: this.conn = net.createConnection(serverAddress, (socketOrErr) => {
const callbackPattern = /(this\.conn = net\.createConnection\(serverAddress, \()(\w+)(\) => \{)/;

let patchedContent = '';

if (directPattern.test(CONTENT)) {
  // Replace direct callback passing with wrapper function
  patchedContent = CONTENT.replace(
    directPattern,
    'this.conn = net.createConnection(serverAddress, (socketOrErr) => { // BUN_COMPATIBILITY_PATCH\n' +
    '      // Handle Bun\'s different callback signature\n' +
    '      if (socketOrErr && socketOrErr.constructor && socketOrErr.constructor.name === \'Socket\') {\n' +
    '        // Bun passes socket as first arg on success - call callback with no args\n' +
    '        cb();\n' +
    '        return;\n' +
    '      }\n' +
    '      // Original callback for both actual errors and Node.js success\n' +
    '      cb(socketOrErr);\n' +
    '    })'
  );
} else if (callbackPattern.test(CONTENT)) {
  // Replace inline callback with Bun-compatible version
  patchedContent = CONTENT.replace(
    callbackPattern,
    '$1$2) => { // BUN_COMPATIBILITY_PATCH\n' +
    '      // Handle Bun\'s different callback signature\n' +
    '      if ($2 && $2.constructor && $2.constructor.name === \'Socket\') {\n' +
    '        // Bun passes socket as first arg on success - call callback with no args\n' +
    '        cb();\n' +
    '        return;\n' +
    '      }'
  );
}

if (!patchedContent) {
  console.log('❌ Could not find net.createConnection pattern to patch');
  console.log('   Available patterns:');
  console.log('   - Direct: this.conn = net.createConnection(serverAddress, cb)');
  console.log('   - Callback: this.conn = net.createConnection(serverAddress, (socketOrErr) => {');
  process.exit(1);
}

try {
  fs.writeFileSync(SERVER_FILE, patchedContent);
  console.log('✅ Successfully patched slsk-client for Bun compatibility');
} catch (err) {
  console.error('❌ Failed to patch slsk-client:', err.message);
  process.exit(1);
}
