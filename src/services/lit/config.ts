/**
 * Lit Protocol Encrypted Keys Configuration
 * These keys are encrypted by Lit Protocol and can only be decrypted by the specific Lit Action
 */

export interface EncryptedKey {
  ciphertext: string
  dataToEncryptHash: string
  accessControlConditions: Array<{
    contractAddress: string
    standardContractType: string
    chain: string
    method: string
    parameters: string[]
    returnValueTest: {
      comparator: string
      value: string
    }
  }>
  encryptedAt: string
  litActionFile: string
  cid: string
}

// Voxstral API Key (required for STT) - v8 encrypted for new CID
export const voxstralKeyData: EncryptedKey = {
  "ciphertext": "s8B59h0C4a/5eFTLhhpRZd7uZwBF2HDCjM7DiT15ajv6uObjlpjTJcNZcHoH+W1BtRivhYl99sXlRqkG6TDqvhH6qhelbr4ISNNFv871nbwhupqHQ/wycmyKtRrjcCc4VOOCGvIzf/aiqc6P5IfcDm41Ag==",
  "dataToEncryptHash": "413c7ea7e4ed9b04ed13ee60cfcdd544fa6fe30996569d7f526c91414d775079",
  "accessControlConditions": [
    {
      "conditionType": "evmBasic",
      "contractAddress": "",
      "standardContractType": "",
      "chain": "ethereum",
      "method": "",
      "parameters": [
        ":currentActionIpfsId"
      ],
      "returnValueTest": {
        "comparator": "=",
        "value": "QmdN4nKcuYYQtNwDhMQA8v1QaiT9WzxMj8wuR6e6MdDgoM"
      }
    }
  ],
  "encryptedAt": "2025-09-30T16:38:19.131Z",
  "litActionFile": "stt/free.js",
  "cid": "QmdN4nKcuYYQtNwDhMQA8v1QaiT9WzxMj8wuR6e6MdDgoM"
}

// Tinybird Database Endpoint URL (optional for analytics)
export const dbUrlKeyData: EncryptedKey = {
  "ciphertext": "id4L+YlZh5N8nW8A9+OCZKRcCZbWWOIqwrlK7E1cfEtHerBpIFB8d4DDR67NqzNvpu+0RCFshKW9P0pqE0X2CuyTbjvN+9wWlyun414ANcU8Imcrd58H/5P8keNADFMFYtmOxJE6hFIv/sRI8HHGT19Ic8sZIn/Js0lMjBdoen+EkQrbqJiL1ToJRgsNAg==",
  "dataToEncryptHash": "4b3be4de9d4bb3a5b35eaac08f8239dea438e807cc7371c9e7c55568c3cbc54f",
  "accessControlConditions": [
    {
      "contractAddress": "",
      "standardContractType": "",
      "chain": "ethereum",
      "method": "",
      "parameters": [
        ":currentActionIpfsId"
      ],
      "returnValueTest": {
        "comparator": "=",
        "value": "QmV5zj59N3z7dgqGDHkftL9FjTKa9qxTm3APYbsoq132DW"
      }
    }
  ],
  "encryptedAt": "2025-08-09T13:31:15.867Z",
  "litActionFile": "stt/free.js",
  "cid": "QmV5zj59N3z7dgqGDHkftL9FjTKa9qxTm3APYbsoq132DW"
}

// Tinybird Auth Token (optional for analytics)
export const dbTokenKeyData: EncryptedKey = {
  "ciphertext": "lU5uriSwjxZ+1GED0oJAUAPZ99us/Wybw+QgQsDpNXX8BFj5wdRt5x4vMibRWLsPXOqd21xptAVd1ovI8oNToQB0Aw0rWkQj7Bj6SXWIXbXIATwf6S7N/ELYCKTn5dkUu2tw+mYJtkIuzjgnBNec89FNZtLVnPHX+wdXfF/D+clZADfW4bE4KQpuZhGsP8wpLN78oVLUvKiILH3U1hQFGMmM5QXKjlXmHNuvQ5kD7mNHfPdce+9rCKaFj2f8m8AFOcTOajhxFlYsyajyqTr+EbEkDW0Wfcrkvtpek7m3IjOZF9pxUrvmxWcknKLdD2+hVcdn0pu1yh1eB9LeIr6q1Z9S1pWwOfWtokfCco1TpJa2l3zS/gfa40lGAg==",
  "dataToEncryptHash": "95b37f62e9d20d0e2791336f4da3a2a2f175fd7e71b8c3dbe3140401e532da9b",
  "accessControlConditions": [
    {
      "contractAddress": "",
      "standardContractType": "",
      "chain": "ethereum",
      "method": "",
      "parameters": [
        ":currentActionIpfsId"
      ],
      "returnValueTest": {
        "comparator": "=",
        "value": "QmV5zj59N3z7dgqGDHkftL9FjTKa9qxTm3APYbsoq132DW"
      }
    }
  ],
  "encryptedAt": "2025-08-09T13:31:15.154Z",
  "litActionFile": "stt/free.js",
  "cid": "QmV5zj59N3z7dgqGDHkftL9FjTKa9qxTm3APYbsoq132DW"
}