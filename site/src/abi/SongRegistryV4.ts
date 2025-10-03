export const SongRegistryV4ABI = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "addSong",
    "inputs": [
      {
        "name": "id",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "title",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "artist",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "duration",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "audioUri",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "metadataUri",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "coverUri",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "thumbnailUri",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "musicVideoUri",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "clipIds",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "languages",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getAllSongs",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct SongRegistryV4.Song[]",
        "components": [
          {
            "name": "id",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "title",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "artist",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "duration",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "audioUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "metadataUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "coverUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "thumbnailUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "musicVideoUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "clipIds",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "languages",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "enabled",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "addedAt",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEnabledSongCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEnabledSongs",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct SongRegistryV4.Song[]",
        "components": [
          {
            "name": "id",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "title",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "artist",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "duration",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "audioUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "metadataUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "coverUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "thumbnailUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "musicVideoUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "clipIds",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "languages",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "enabled",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "addedAt",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSong",
    "inputs": [
      {
        "name": "id",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct SongRegistryV4.Song",
        "components": [
          {
            "name": "id",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "title",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "artist",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "duration",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "audioUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "metadataUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "coverUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "thumbnailUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "musicVideoUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "clipIds",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "languages",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "enabled",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "addedAt",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSongByIndex",
    "inputs": [
      {
        "name": "index",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct SongRegistryV4.Song",
        "components": [
          {
            "name": "id",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "title",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "artist",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "duration",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "audioUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "metadataUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "coverUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "thumbnailUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "musicVideoUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "clipIds",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "languages",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "enabled",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "addedAt",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSongCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSongsBatch",
    "inputs": [
      {
        "name": "startIndex",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "endIndex",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct SongRegistryV4.Song[]",
        "components": [
          {
            "name": "id",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "title",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "artist",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "duration",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "audioUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "metadataUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "coverUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "thumbnailUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "musicVideoUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "clipIds",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "languages",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "enabled",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "addedAt",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSongsByArtist",
    "inputs": [
      {
        "name": "artistQuery",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct SongRegistryV4.Song[]",
        "components": [
          {
            "name": "id",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "title",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "artist",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "duration",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "audioUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "metadataUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "coverUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "thumbnailUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "musicVideoUri",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "clipIds",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "languages",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "enabled",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "addedAt",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
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
    "name": "removeSong",
    "inputs": [
      {
        "name": "id",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "songExists",
    "inputs": [
      {
        "name": "id",
        "type": "string",
        "internalType": "string"
      }
    ],
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
    "name": "toggleSong",
    "inputs": [
      {
        "name": "id",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "enabled",
        "type": "bool",
        "internalType": "bool"
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
    "name": "updateSong",
    "inputs": [
      {
        "name": "id",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "title",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "artist",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "duration",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "audioUri",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "metadataUri",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "coverUri",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "thumbnailUri",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "musicVideoUri",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "clipIds",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "languages",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "enabled",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SongAdded",
    "inputs": [
      {
        "name": "id",
        "type": "string",
        "indexed": true,
        "internalType": "string"
      },
      {
        "name": "title",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "artist",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "languages",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "addedAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SongRemoved",
    "inputs": [
      {
        "name": "id",
        "type": "string",
        "indexed": true,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SongUpdated",
    "inputs": [
      {
        "name": "id",
        "type": "string",
        "indexed": true,
        "internalType": "string"
      },
      {
        "name": "title",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "artist",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "languages",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "enabled",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  }
] as const;
