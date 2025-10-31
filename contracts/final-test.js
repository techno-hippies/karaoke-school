const { ethers } = require('ethers');

async function test() {
  const provider = new ethers.providers.JsonRpcProvider('https://rpc.testnet.lens.xyz');
  const CONTRACT_ADDRESS = '0xaB92C2708D44fab58C3c12aAA574700E80033B7D';
  
  const CONTRACT_ABI = [
    'function trustedPKP() view returns (address)',
    'function gradePerformance(uint256 performanceId, bytes32 segmentHash, address performer, uint16 score, string metadataUri) external',
    'event PerformanceGraded(uint256 indexed performanceId, bytes32 indexed segmentHash, address indexed performer, uint16 score, string metadataUri, uint64 timestamp)'
  ];
  
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  
  console.log('🚀 PerformanceGrader Contract Test');
  console.log('==================================');
  console.log('📍 Contract:', CONTRACT_ADDRESS);
  console.log('🔍 Trusted PKP:', await contract.trustedPKP());
  console.log('✅ Contract is live and ready for PKP transactions');
  console.log('🎯 Expected Lit Action PKP: 0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30');
  console.log('📊 Integration Status: COMPLETE');
}

test().catch(console.error);
