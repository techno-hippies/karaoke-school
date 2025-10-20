export const fsrsTrackerV1Abi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_trustedPKP",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "MAX_LINE_COUNT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "cards",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "due",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "stability",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "difficulty",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "elapsedDays",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "scheduledDays",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "reps",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "lapses",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "state",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "lastReview",
        "type": "uint40",
        "internalType": "uint40"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getCard",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "songId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "segmentId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "lineIndex",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "card",
        "type": "tuple",
        "internalType": "struct FSRSTrackerV1.Card",
        "components": [
          {
            "name": "due",
            "type": "uint40",
            "internalType": "uint40"
          },
          {
            "name": "stability",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "difficulty",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "elapsedDays",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "scheduledDays",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "reps",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "lapses",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "state",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "lastReview",
            "type": "uint40",
            "internalType": "uint40"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getDueCards",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "songId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "segmentId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "lineCount",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "dueLines",
        "type": "uint8[]",
        "internalType": "uint8[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getDueReviewSegments",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "songId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "segmentIds",
        "type": "string[]",
        "internalType": "string[]"
      },
      {
        "name": "lineCounts",
        "type": "uint8[]",
        "internalType": "uint8[]"
      }
    ],
    "outputs": [
      {
        "name": "reviewSegmentIndices",
        "type": "uint8[]",
        "internalType": "uint8[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getDueSongSegments",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "songId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "segmentIds",
        "type": "string[]",
        "internalType": "string[]"
      },
      {
        "name": "lineCounts",
        "type": "uint8[]",
        "internalType": "uint8[]"
      }
    ],
    "outputs": [
      {
        "name": "dueSegmentIndices",
        "type": "uint8[]",
        "internalType": "uint8[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSongCompletionRate",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "songId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "segmentIds",
        "type": "string[]",
        "internalType": "string[]"
      },
      {
        "name": "lineCounts",
        "type": "uint8[]",
        "internalType": "uint8[]"
      }
    ],
    "outputs": [
      {
        "name": "studiedLines",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "totalLines",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "completionRate",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSongStats",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "songId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "segmentIds",
        "type": "string[]",
        "internalType": "string[]"
      },
      {
        "name": "lineCounts",
        "type": "uint8[]",
        "internalType": "uint8[]"
      }
    ],
    "outputs": [
      {
        "name": "totalNew",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "totalLearning",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "totalDue",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "segmentsWithDue",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "segmentsCompleted",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getStudyStats",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "songId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "segmentId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "lineCount",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "newCount",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "learningCount",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "dueCount",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isSongMastered",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "songId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "segmentIds",
        "type": "string[]",
        "internalType": "string[]"
      },
      {
        "name": "lineCounts",
        "type": "uint8[]",
        "internalType": "uint8[]"
      }
    ],
    "outputs": [
      {
        "name": "fullyStudied",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "segmentsCompleted",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "totalSegments",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "paused",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setPaused",
    "inputs": [
      {
        "name": "_paused",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setTrustedPKP",
    "inputs": [
      {
        "name": "newPKP",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "trustedPKP",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "updateCard",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "songId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "segmentId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "lineIndex",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "rating",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "score",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "newCard",
        "type": "tuple",
        "internalType": "struct FSRSTrackerV1.Card",
        "components": [
          {
            "name": "due",
            "type": "uint40",
            "internalType": "uint40"
          },
          {
            "name": "stability",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "difficulty",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "elapsedDays",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "scheduledDays",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "reps",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "lapses",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "state",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "lastReview",
            "type": "uint40",
            "internalType": "uint40"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateCardsBatch",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "songId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "segmentId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "lineIndices",
        "type": "uint8[]",
        "internalType": "uint8[]"
      },
      {
        "name": "ratings",
        "type": "uint8[]",
        "internalType": "uint8[]"
      },
      {
        "name": "scores",
        "type": "uint8[]",
        "internalType": "uint8[]"
      },
      {
        "name": "newCards",
        "type": "tuple[]",
        "internalType": "struct FSRSTrackerV1.Card[]",
        "components": [
          {
            "name": "due",
            "type": "uint40",
            "internalType": "uint40"
          },
          {
            "name": "stability",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "difficulty",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "elapsedDays",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "scheduledDays",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "reps",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "lapses",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "state",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "lastReview",
            "type": "uint40",
            "internalType": "uint40"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "CardReviewed",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "songId",
        "type": "string",
        "indexed": true,
        "internalType": "string"
      },
      {
        "name": "segmentId",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "lineIndex",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "rating",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "score",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "nextDue",
        "type": "uint40",
        "indexed": false,
        "internalType": "uint40"
      },
      {
        "name": "newState",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "timestamp",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PausedUpdated",
    "inputs": [
      {
        "name": "paused",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TrustedPKPUpdated",
    "inputs": [
      {
        "name": "oldPKP",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newPKP",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "BatchLimitExceeded",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ContractPaused",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidAddress",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidLineCount",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidRating",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidScore",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidSegmentId",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidSongId",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotOwner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotTrustedPKP",
    "inputs": []
  }
] as const;
