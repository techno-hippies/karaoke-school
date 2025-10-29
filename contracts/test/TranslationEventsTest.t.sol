// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/events/TranslationEvents.sol";

contract TranslationEventsTest is Test {
    TranslationEvents public translationEvents;
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public validator = address(0x3);
    
    bytes32 constant SEGMENT_HASH_1 = keccak256("segment-translation-1");
    bytes32 constant SEGMENT_HASH_2 = keccak256("segment-translation-2");
    string constant LANGUAGE_ES = "es";
    string constant LANGUAGE_ZH = "zh";
    string constant LANGUAGE_JA = "ja";
    string constant LANGUAGE_KO = "ko";
    
    event TranslationAdded(
        bytes32 indexed segmentHash,
        string indexed languageCode,
        string translationUri,
        string translationSource,
        uint16 confidenceScore,
        bool validated,
        address indexed addedBy,
        uint64 timestamp
    );
    
    event TranslationUpdated(
        bytes32 indexed segmentHash,
        string indexed languageCode,
        string translationUri,
        bool validated,
        address indexed updatedBy,
        uint64 timestamp
    );
    
    event TranslationToggled(
        bytes32 indexed segmentHash,
        string indexed languageCode,
        bool enabled,
        uint64 timestamp
    );
    
    function setUp() public {
        translationEvents = new TranslationEvents();
    }
    
    // ============ emitTranslationAdded Tests ============
    
    function testEmitTranslationAddedSuccess() public {
        string memory translationUri = "grove://translation-es-123";
        string memory translationSource = "gemini-flash-2.5";
        uint16 confidenceScore = 8500;
        bool validated = false;
        
        vm.prank(user1);
        vm.expectEmit();
        emit TranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            translationUri,
            translationSource,
            confidenceScore,
            validated,
            user1,
            uint64(block.timestamp)
        );
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            translationUri,
            translationSource,
            confidenceScore,
            validated
        );
    }
    
    function testEmitTranslationAddedWithZeroConfidence() public {
        string memory translationUri = "grove://translation-zero-confidence";
        string memory translationSource = "gemini-flash-2.5";
        uint16 confidenceScore = 0;
        bool validated = false;
        
        vm.prank(user1);
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            translationUri,
            translationSource,
            confidenceScore,
            validated
        );
    }
    
    function testEmitTranslationAddedWithMaxConfidence() public {
        string memory translationUri = "grove://translation-max-confidence";
        string memory translationSource = "gemini-flash-2.5";
        uint16 confidenceScore = 10000;
        bool validated = true;
        
        vm.prank(user1);
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            translationUri,
            translationSource,
            confidenceScore,
            validated
        );
    }
    
    function testEmitTranslationAddedValidated() public {
        string memory translationUri = "grove://translation-validated";
        string memory translationSource = "gemini-flash-2.5";
        uint16 confidenceScore = 7500;
        bool validated = true;
        
        vm.prank(validator);
        vm.expectEmit();
        emit TranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            translationUri,
            translationSource,
            confidenceScore,
            validated,
            validator,
            uint64(block.timestamp)
        );
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            translationUri,
            translationSource,
            confidenceScore,
            validated
        );
    }
    
    function testEmitTranslationAddedOpenAccess() public {
        string memory translationUri = "grove://translation-open";
        string memory translationSource = "gpt-4";
        uint16 confidenceScore = 6000;
        bool validated = false;
        
        address randomUser = address(0x999);
        vm.prank(randomUser);
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            translationUri,
            translationSource,
            confidenceScore,
            validated
        );
    }
    
    function testEmitTranslationAddedDifferentUsers() public {
        string memory uri1 = "grove://translation-user1";
        string memory uri2 = "grove://translation-user2";
        string memory source1 = "gemini-flash-2.5";
        string memory source2 = "gpt-4";
        uint16 score1 = 8000;
        uint16 score2 = 7500;
        
        vm.startPrank(user1);
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            uri1,
            source1,
            score1,
            false
        );
        vm.stopPrank();
        
        vm.startPrank(user2);
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ZH,
            uri2,
            source2,
            score2,
            false
        );
        vm.stopPrank();
    }
    
    // ============ emitTranslationUpdated Tests ============
    
    function testEmitTranslationUpdatedSuccess() public {
        string memory newTranslationUri = "grove://translation-updated-es";
        bool newValidated = true;
        
        vm.prank(validator);
        vm.expectEmit();
        emit TranslationUpdated(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            newTranslationUri,
            newValidated,
            validator,
            uint64(block.timestamp)
        );
        translationEvents.emitTranslationUpdated(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            newTranslationUri,
            newValidated
        );
    }
    
    function testEmitTranslationUpdatedSetValidated() public {
        string memory translationUri = "grove://translation-validate-this";
        bool validated = true;
        
        vm.prank(validator);
        translationEvents.emitTranslationUpdated(
            SEGMENT_HASH_1,
            LANGUAGE_ZH,
            translationUri,
            validated
        );
    }
    
    function testEmitTranslationUpdatedSetUnvalidated() public {
        string memory translationUri = "grove://translation-unvalidate-this";
        bool validated = false;
        
        vm.prank(user1);
        translationEvents.emitTranslationUpdated(
            SEGMENT_HASH_1,
            LANGUAGE_JA,
            translationUri,
            validated
        );
    }
    
    function testEmitTranslationUpdatedByDifferentUser() public {
        string memory translationUri = "grove://translation-updated-by-other";
        bool validated = false;
        
        vm.prank(user2);
        vm.expectEmit();
        emit TranslationUpdated(
            SEGMENT_HASH_1,
            LANGUAGE_KO,
            translationUri,
            validated,
            user2,
            uint64(block.timestamp)
        );
        translationEvents.emitTranslationUpdated(
            SEGMENT_HASH_1,
            LANGUAGE_KO,
            translationUri,
            validated
        );
    }
    
    function testEmitTranslationUpdatedOpenAccess() public {
        string memory translationUri = "grove://translation-open-update";
        bool validated = true;
        
        address randomUser = address(0x888);
        vm.prank(randomUser);
        translationEvents.emitTranslationUpdated(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            translationUri,
            validated
        );
    }
    
    // ============ emitTranslationToggled Tests ============
    
    function testEmitTranslationToggledEnabled() public {
        vm.prank(user1);
        vm.expectEmit(true, true, false, false);
        emit TranslationToggled(SEGMENT_HASH_1, LANGUAGE_ES, true, uint64(block.timestamp));
        translationEvents.emitTranslationToggled(SEGMENT_HASH_1, LANGUAGE_ES, true);
    }
    
    function testEmitTranslationToggledDisabled() public {
        vm.prank(user1);
        vm.expectEmit(true, true, false, false);
        emit TranslationToggled(SEGMENT_HASH_1, LANGUAGE_ES, false, uint64(block.timestamp));
        translationEvents.emitTranslationToggled(SEGMENT_HASH_1, LANGUAGE_ES, false);
    }
    
    function testEmitTranslationToggledByDifferentUser() public {
        vm.prank(user2);
        vm.expectEmit(true, true, false, false);
        emit TranslationToggled(SEGMENT_HASH_2, LANGUAGE_ZH, true, uint64(block.timestamp));
        translationEvents.emitTranslationToggled(SEGMENT_HASH_2, LANGUAGE_ZH, true);
    }
    
    function testEmitTranslationToggledOpenAccess() public {
        address randomUser = address(0x777);
        vm.prank(randomUser);
        translationEvents.emitTranslationToggled(SEGMENT_HASH_1, LANGUAGE_JA, false);
    }
    
    function testMultipleTranslationToggles() public {
        vm.startPrank(user1);
        translationEvents.emitTranslationToggled(SEGMENT_HASH_1, LANGUAGE_ES, true);
        translationEvents.emitTranslationToggled(SEGMENT_HASH_1, LANGUAGE_ES, false);
        translationEvents.emitTranslationToggled(SEGMENT_HASH_1, LANGUAGE_ES, true);
        vm.stopPrank();
    }
    
    // ============ Event Structure Tests ============
    
    function testTranslationAddedEventStructure() public {
        string memory translationUri = "grove://structured-translation";
        string memory translationSource = "gemini-flash-2.5";
        uint16 confidenceScore = 9250;
        bool validated = true;
        address expectedAdder = user2;
        uint64 expectedTimestamp = uint64(block.timestamp);
        
        vm.prank(expectedAdder);
        vm.expectEmit();
        emit TranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ZH,
            translationUri,
            translationSource,
            confidenceScore,
            validated,
            expectedAdder,
            expectedTimestamp
        );
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ZH,
            translationUri,
            translationSource,
            confidenceScore,
            validated
        );
    }
    
    function testTranslationUpdatedEventStructure() public {
        string memory translationUri = "grove://structured-update";
        bool validated = false;
        address expectedUpdater = validator;
        uint64 expectedTimestamp = uint64(block.timestamp);
        
        vm.prank(expectedUpdater);
        vm.expectEmit();
        emit TranslationUpdated(
            SEGMENT_HASH_1,
            LANGUAGE_KO,
            translationUri,
            validated,
            expectedUpdater,
            expectedTimestamp
        );
        translationEvents.emitTranslationUpdated(
            SEGMENT_HASH_1,
            LANGUAGE_KO,
            translationUri,
            validated
        );
    }
    
    function testTranslationToggledEventStructure() public {
        bool enabled = true;
        uint64 expectedTimestamp = uint64(block.timestamp);
        
        vm.prank(user1);
        vm.expectEmit(true, true, false, false);
        emit TranslationToggled(SEGMENT_HASH_1, LANGUAGE_JA, enabled, expectedTimestamp);
        translationEvents.emitTranslationToggled(SEGMENT_HASH_1, LANGUAGE_JA, enabled);
    }
    
    // ============ Integration Tests ============
    
    function testFullTranslationLifecycle() public {
        string memory uri1 = "grove://translation-initial";
        string memory uri2 = "grove://translation-updated";
        string memory source = "gemini-flash-2.5";
        
        // Add translation
        vm.prank(user1);
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            uri1,
            source,
            7000,
            false
        );
        
        // Update translation (set validated)
        vm.prank(validator);
        translationEvents.emitTranslationUpdated(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            uri2,
            true
        );
        
        // Toggle translation
        vm.prank(user1);
        translationEvents.emitTranslationToggled(SEGMENT_HASH_1, LANGUAGE_ES, false);
    }
    
    function testMultipleLanguagesForSameSegment() public {
        string memory source = "gemini-flash-2.5";
        
        vm.startPrank(user1);
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            "grove://es-translation",
            source,
            8500,
            false
        );
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ZH,
            "grove://zh-translation",
            source,
            7800,
            false
        );
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_JA,
            "grove://ja-translation",
            source,
            8200,
            false
        );
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_KO,
            "grove://ko-translation",
            source,
            7900,
            false
        );
        vm.stopPrank();
        
        // Validate some translations
        vm.prank(validator);
        translationEvents.emitTranslationUpdated(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            "grove://es-translation-validated",
            true
        );
        
        vm.prank(validator);
        translationEvents.emitTranslationUpdated(
            SEGMENT_HASH_1,
            LANGUAGE_ZH,
            "grove://zh-translation-validated",
            true
        );
    }
    
    function testMultipleSegments() public {
        bytes32 hash1 = keccak256("multi-translation-1");
        bytes32 hash2 = keccak256("multi-translation-2");
        
        vm.startPrank(user1);
        translationEvents.emitTranslationAdded(
            hash1,
            LANGUAGE_ES,
            "grove://hash1-es",
            "gemini-flash-2.5",
            8000,
            false
        );
        translationEvents.emitTranslationUpdated(
            hash1,
            LANGUAGE_ES,
            "grove://hash1-es-updated",
            true
        );
        translationEvents.emitTranslationToggled(hash1, LANGUAGE_ES, true);
        vm.stopPrank();
        
        vm.startPrank(user2);
        translationEvents.emitTranslationAdded(
            hash2,
            LANGUAGE_ZH,
            "grove://hash2-zh",
            "gpt-4",
            7500,
            false
        );
        translationEvents.emitTranslationToggled(hash2, LANGUAGE_ZH, false);
        vm.stopPrank();
    }
    
    // ============ Edge Case Tests ============
    
    function testEdgeCaseConfidenceScores() public {
        uint16 minScore = 0;
        uint16 maxScore = 10000;
        
        vm.prank(user1);
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            "grove://min-score",
            "model",
            minScore,
            false
        );
        
        vm.prank(user1);
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ZH,
            "grove://max-score",
            "model",
            maxScore,
            true
        );
    }
    
    function testVariousLanguageCodes() public {
        string memory uri = "grove://test-translation";
        string memory source = "gemini-flash-2.5";
        
        string[] memory languages = new string[](5);
        languages[0] = "es";
        languages[1] = "zh";
        languages[2] = "ja";
        languages[3] = "ko";
        languages[4] = "fr";
        
        for (uint i = 0; i < languages.length; i++) {
            vm.prank(user1);
            translationEvents.emitTranslationAdded(
                SEGMENT_HASH_1,
                languages[i],
                string(abi.encodePacked(uri, vm.toString(i))),
                source,
                7000,
                false
            );
        }
    }
    
    function testVariousTranslationSources() public {
        string memory uri = "grove://test-source";
        bytes32 segmentHash = keccak256("source-test");
        
        string[] memory sources = new string[](4);
        sources[0] = "gemini-flash-2.5";
        sources[1] = "gpt-4";
        sources[2] = "claude-3";
        sources[3] = "custom-model-v1";
        
        for (uint i = 0; i < sources.length; i++) {
            vm.prank(user1);
            translationEvents.emitTranslationAdded(
                segmentHash,
                LANGUAGE_ES,
                string(abi.encodePacked(uri, vm.toString(i))),
                sources[i],
                7000,
                false
            );
        }
    }
    
    function testVariousMetadataUris() public {
        string memory uri1 = "grove://short";
        string memory uri2 = "grove://very-long-uri-that-should-still-work-without-issues-and-be-handled-properly-by-the-system";
        string memory uri3 = "grove://with-dashes-and_underscores.and.numbers123";
        
        vm.startPrank(user1);
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            uri1,
            "gemini-flash-2.5",
            7000,
            false
        );
        translationEvents.emitTranslationUpdated(
            SEGMENT_HASH_1,
            LANGUAGE_ES,
            uri2,
            true
        );
        translationEvents.emitTranslationToggled(SEGMENT_HASH_1, LANGUAGE_ES, true);
        vm.stopPrank();
        
        vm.startPrank(user2);
        translationEvents.emitTranslationAdded(
            SEGMENT_HASH_2,
            LANGUAGE_ZH,
            uri3,
            "gpt-4",
            7500,
            false
        );
        vm.stopPrank();
    }
}
