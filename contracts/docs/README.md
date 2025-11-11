+# Smart Contracts Documentation
+
+Event-only Solidity contracts powering the karaoke-school exercise flow.
+
+## 🚀 Quick Start
+
+```bash
+cd contracts
+forge build
+forge test
+```
+
+## 📁 Contract Structure
+
+```
+contracts/src/events/
+├── ExerciseEvents.sol    # FSRS exercise registration + grading (active)
+├── SongEvents.sol        # Song metadata events
+├── SegmentEvents.sol     # Karaoke segment events
+├── TranslationEvents.sol # Multi-language translation events
+└── AccountEvents.sol     # User account management
+
+contracts/archived/performance-grader/
+└── ...                   # Legacy PerformanceGrader sources, tests, scripts
+```
+
+## 🎯 ExerciseEvents.sol
+
+- **Purpose**: Unified registry for Say-It-Back audio, translation multiple choice, and trivia multiple choice exercises.
+- **Network**: Lens Testnet (chain ID 37111)
+- **Address**: `0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832`
+- **Trusted PKP**: `0x7d8003DFAc78C1775EDD518772162A7766Bd4AC7`
+
+### Core Events
+```solidity
+event TranslationQuestionRegistered(
+    bytes32 indexed questionId,
+    bytes32 indexed lineId,
+    bytes32 indexed segmentHash,
+    string spotifyTrackId,
+    uint16 lineIndex,
+    string languageCode,
+    string metadataUri,
+    uint16 distractorPoolSize,
+    address registeredBy,
+    uint64 timestamp
+);
+
+event TriviaQuestionRegistered(
+    bytes32 indexed questionId,
+    string indexed spotifyTrackId,
+    string languageCode,
+    string metadataUri,
+    uint16 distractorPoolSize,
+    address indexed registeredBy,
+    uint64 timestamp
+);
+
+event SayItBackAttemptGraded(
+    uint256 indexed attemptId,
+    bytes32 indexed lineId,
+    bytes32 indexed segmentHash,
+    uint16 lineIndex,
+    address learner,
+    uint16 score,
+    uint8 rating,
+    string metadataUri,
+    uint64 timestamp
+);
+
+event MultipleChoiceAttemptGraded(
+    uint256 indexed attemptId,
+    bytes32 indexed questionId,
+    address indexed learner,
+    uint16 score,
+    uint8 rating,
+    string metadataUri,
+    uint64 timestamp
+);
+```
+
+### Grading Functions
+```solidity
+function gradeSayItBackAttempt(
+    uint256 attemptId,
+    bytes32 lineId,
+    bytes32 segmentHash,
+    uint16 lineIndex,
+    address learner,
+    uint16 score,
+    uint8 rating,
+    string calldata metadataUri
+) external onlyTrustedPKP whenNotPaused;
+
+function gradeMultipleChoiceAttempt(
+    uint256 attemptId,
+    bytes32 questionId,
+    address learner,
+    uint16 score,
+    uint8 rating,
+    string calldata metadataUri
+) external onlyTrustedPKP whenNotPaused;
+```
+
+## 🔗 Deployed Contracts (Lens Testnet)
+
+```typescript
+const CONTRACTS = {
+  ExerciseEvents: "0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832",
+  SegmentEvents: "0x9958Bd32bf16b5CCa0580DEB6FD29921D0466274",
+  SongEvents: "0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6",
+  TranslationEvents: "0x5A49E23A5C3a034906eE0274c266A08805770C70",
+  AccountEvents: "0x3709f41cdc9E7852140bc23A21adCe600434d4E8",
+};
+```
+
+> Need the old `PerformanceGrader` flow? Find the source, tests, and scripts in
+> `contracts/archived/performance-grader/`.
+
+## 🏗️ Event Architecture
+
+- Event-only storage — all metadata lives in Grove/IPFS
+- PKP-gated grading — Lit Actions hold the trusted key
+- Subgraph-friendly — entities like `ExerciseCard` / `ExerciseAttempt` derive from these events
+
+```
+Pipeline → Grove Upload → ExerciseEvents → Subgraph → App
+```
+
+## 🚀 Deployment
+
+```bash
+forge script script/DeployEvents.s.sol:DeployEvents \
+  --rpc-url https://rpc.testnet.lens.xyz \
+  --broadcast \
+  --zksync
+
+forge verify-contract $EXERCISE_EVENTS_ADDRESS ExerciseEvents \
+  --chain lens-testnet \
+  --constructor-args $(cast abi-encode "constructor(address)" $TRUSTED_PKP_ADDRESS)
+```
+
+## 🧪 Testing Snippet
+
+```solidity
+contract ExerciseEventsTest is Test {
+    ExerciseEvents exercise;
+
+    function setUp() public {
+        exercise = new ExerciseEvents(address(this));
+    }
+
+    function testSayItBackGrading() public {
+        vm.expectEmit(true, true, true, true);
+        emit ExerciseEvents.SayItBackAttemptGraded(
+            1,
+            bytes32(uint256(1)),
+            bytes32(uint256(2)),
+            0,
+            address(this),
+            9000,
+            3,
+            "grove://metadata",
+            uint64(block.timestamp)
+        );
+
+        exercise.gradeSayItBackAttempt(
+            1,
+            bytes32(uint256(1)),
+            bytes32(uint256(2)),
+            0,
+            address(this),
+            9000,
+            3,
+            "grove://metadata"
+        );
+    }
+}
+```
+
+## 🔧 Configuration
+
+```toml
+[rpc_endpoints]
+lens-testnet = "https://rpc.testnet.lens.xyz"
+
+[etherscan]
+lens-testnet = { key = "${BLOCK_EXPLORER_API_KEY}" }
+```
+
+## 🔗 Integration Points
+
+- **Subgraph**: indexes exercise cards (`ExerciseCard`) and attempts (`ExerciseAttempt`).
+- **Lit Action**: `exercise-grader-v1` submits grading transactions to `ExerciseEvents`.
+- **Frontend**: reads exercise data via subgraph, calls Lit Action for grading.
+
+```typescript
+await client.writeContract({
+  address: CONTRACTS.ExerciseEvents,
+  abi: EXERCISE_EVENTS_ABI,
+  functionName: 'gradeMultipleChoiceAttempt',
+  args: [attemptId, questionId, learner, score, rating, metadataUri],
+});
+```
+
+## 📚 Additional Docs
+
+- **[Archived PerformanceGrader](../archived/performance-grader/README.md)**
+- **[Service Integration Guide](../../AGENTS.md)**
+- **[Project Overview](../../README.md)**
