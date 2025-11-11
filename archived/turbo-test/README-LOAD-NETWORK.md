# Load Network Testnet Uploader

A Node.js uploader for the Load Network testnet (Chain ID: 9496). This uploader enables blockchain data storage on Load Network using EVM-compatible transactions.

## 🎯 **Load Network Configuration**

- **Network:** Load Network Alphanet
- **Chain ID:** 9496
- **RPC:** https://alphanet.load.network
- **Explorer:** https://explorer.load.network
- **Faucet:** https://load.network/faucet
- **Currency:** tLOAD (testnet tokens)

## 📁 **Core Files**

- **`load-network-uploader.js`** - Main uploader for Load Network
- **`load-network-wallet.json`** - EVM wallet for Load Network
- **`check-balance.js`** - Check wallet balance and test transactions
- **`test-funded-tx.js`** - Test script for funded wallets
- **`sample-text.txt`** - Sample data for testing

## 🚀 **Quick Start**

### 1. **Install Dependencies**
```bash
npm install ethers
```

### 2. **Fund Your Wallet**
1. Go to: https://load.network/faucet
2. Enter your wallet address: `0xB61f170309e24AbA228FA41054d804a9FfFd015D`
3. Request tLOAD tokens
4. Wait 2-5 minutes for processing

### 3. **Check Balance**
```bash
node check-balance.js
```

### 4. **Test Upload**
```bash
node load-network-uploader.js --file=sample-text.txt --type=evm
```

## 💼 **Usage Examples**

### **Basic Upload to Load Network**
```bash
node load-network-uploader.js --file=data.json --type=evm
```

### **Check Wallet Balance and Test Transaction**
```bash
node check-balance.js
```

### **Test with Funded Wallet**
```bash
node test-funded-tx.js
```

## 🔧 **API Reference**

### **LoadNetworkUploader Class**

#### **Initialize**
```javascript
import { LoadNetworkUploader } from './load-network-uploader.js';
const uploader = new LoadNetworkUploader();
```

#### **Key Methods**
- `initEvmWallet(walletPath)` - Initialize EVM wallet for Load Network
- `uploadToLoadNetwork(data, options)` - Upload data to Load Network blockchain
- `testLoadNetworkConnection()` - Test Load Network connectivity

#### **Upload Data**
```javascript
const data = {
  type: "your-data-type",
  timestamp: new Date().toISOString(),
  content: "Your data here"
};

const result = await uploader.uploadToLoadNetwork(data, {
  walletPath: './load-network-wallet.json'
});

console.log('TX Hash:', result.hash);
console.log('Explorer:', result.explorer);
```

## 📊 **Transaction Details**

When you upload data to Load Network:
1. **Data is stored in transaction input** (calldata)
2. **Gas fees paid in tLOAD tokens**
3. **Transaction confirmed on Load Network explorer**
4. **Data permanently recorded on blockchain**

### **Example Transaction**
- **Data Size:** 562 bytes
- **Gas Used:** ~524,199 gas
- **Cost:** ~0.0005 tLOAD
- **Confirmation:** ~15-30 seconds

## 🔍 **Monitoring & Verification**

### **Check Transaction on Explorer**
- **URL:** https://explorer.load.network/tx/{transaction-hash}
- **Wallet:** https://explorer.load.network/address/{wallet-address}

### **Balance Tracking**
```javascript
const balance = await uploader.provider.getBalance(wallet.address);
const balanceTLOAD = Number(balance) / 1e18;
```

## ⚡ **Features**

- **EVM Compatible** - Standard Ethereum transaction format
- **Gas Estimation** - Accurate gas limit calculation
- **Error Handling** - Clear error messages and troubleshooting
- **Balance Management** - Built-in balance checking
- **Testnet Ready** - Configured for Load Network testnet

## 🐛 **Troubleshooting**

### **"Insufficient funds" Error**
- **Cause:** Wallet has 0 tLOAD
- **Solution:** Fund wallet at https://load.network/faucet
- **Amount Needed:** ~0.001 tLOAD per transaction

### **"Intrinsic gas too low" Error**
- **Cause:** Incorrect gas limit calculation
- **Solution:** Use provider estimate (automatic in this uploader)

### **"RPC connection failed" Error**
- **Cause:** Network connectivity issues
- **Solution:** Check https://alphanet.load.network status

## 📈 **Current Status**

✅ **Load Network Integration - FULLY OPERATIONAL**

- EVM wallet creation and management
- Load Network RPC connectivity
- Gas estimation and transaction processing
- Balance checking and management
- Transaction confirmation and explorer integration
- Testnet faucet integration

## 🔗 **Useful Links**

- **Load Network Explorer:** https://explorer.load.network
- **Testnet Faucet:** https://load.network/faucet
- **RPC Endpoint:** https://alphanet.load.network
- **Chain ID:** 9496

---

**Ready for production use on Load Network testnet!** 🚀
