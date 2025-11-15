let ethersLib = globalThis.ethers;
if (!ethersLib) {
  ethersLib = require("ethers");
}
const ethers = ethersLib;

const KARAOKE_EVENTS_ADDRESS = "0x51aA6987130AA7E4654218859E075D8e790f4409";
const LENS_TESTNET_CHAIN_ID = 37111;
const LENS_TESTNET_RPC = "https://rpc.testnet.lens.xyz";
const PKP_PUBLIC_KEY =
  "0x049cab6a18225dd566f3a4d6816b2c080fc885b21d3b9021fd80491573bf15141177eca2685a9a5eb0082957bd6581dcd71a43039914e07f4a45146f8246d01b77";

const go = async () => {
  const start = Date.now();
  try {
    const {
      performanceId = Date.now().toString(),
      clipHash = "0x82fe906dd5a2cfe55f58c51dc2ba4f9054bc17b6dde8c38e5567490fdf10c070",
      spotifyTrackId = "0VjIjW4GlUZAMYd2vXMi3b",
      performer = "0x1111111111111111111111111111111111111111",
      grade = "Great",
      similarityScore = 8500,
      lineCount = 14,
      metadataUri = "https://api.grove.storage/5f8076473beb33fdafd46ffc9b96ab24933ad712a695c2fb53d3e5f80c517324",
    } = jsParams || {};

    const clipHashBytes32 = ethers.utils.hexZeroPad(clipHash, 32);

    const txStart = Date.now();
    const txHash = await submitKaraokeTx({
      performanceId,
      clipHash: clipHashBytes32,
      spotifyTrackId,
      performer,
      performanceType: "CLIP",
      similarityScore,
      lineCount,
      grade,
      metadataUri,
    });
    console.log(
      "[karaoke-tx-smoke] submitKaraokeTx completed in",
      Date.now() - txStart,
      "ms"
    );

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        txHash,
        executionTime: Date.now() - start,
      }),
    });
  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
        executionTime: Date.now() - start,
      }),
    });
  }
};

async function submitKaraokeTx({
  performanceId,
  clipHash,
  spotifyTrackId,
  performer,
  performanceType,
  similarityScore,
  lineCount,
  grade,
  metadataUri,
}) {
  const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC);
  const contract = new ethers.utils.Interface([
    "function gradeKaraokePerformance((string performanceId,bytes32 clipHash,string spotifyTrackId,address performer,string performanceType,uint16 similarityScore,uint16 lineCount,string grade,string metadataUri) performance)",
  ]);

  const txData = contract.encodeFunctionData("gradeKaraokePerformance", [
    {
      performanceId: performanceId.toString(),
      clipHash,
      spotifyTrackId,
      performer,
      performanceType,
      similarityScore,
      lineCount,
      grade,
      metadataUri,
    },
  ]);

  return submitZkSyncTransaction(txData, provider, KARAOKE_EVENTS_ADDRESS);
}

async function submitZkSyncTransaction(txData, provider, contractAddress) {
  const pkpAddress = ethers.utils.computeAddress(PKP_PUBLIC_KEY);

  await provider.call({
    from: pkpAddress,
    to: contractAddress,
    data: txData,
    gasLimit: ethers.utils.hexlify(2000000),
    value: "0x0",
  });

  const nonce = await provider.getTransactionCount(pkpAddress);
  const feeData = await provider.getFeeData();
  const gasPrice =
    feeData.gasPrice ||
    feeData.maxFeePerGas ||
    ethers.BigNumber.from("3705143562");
  const maxPriorityFeePerGas =
    feeData.maxPriorityFeePerGas || ethers.BigNumber.from(0);
  const gasLimit = 500000;
  const gasPerPubdataByteLimit = ethers.BigNumber.from(800);

  const domainSeparator = buildDomainSeparator();
  const structHash = buildStructHash({
    txType: 113,
    from: pkpAddress,
    to: contractAddress,
    gasLimit,
    gasPerPubdataByteLimit,
    maxFeePerGas: gasPrice,
    maxPriorityFeePerGas,
    nonce,
    data: txData,
  });

  const eip712Hash = ethers.utils.keccak256(
    ethers.utils.concat([
      ethers.utils.toUtf8Bytes("\x19\x01"),
      domainSeparator,
      structHash,
    ])
  );

  const signingStart = Date.now();
  const signature = await Lit.Actions.signAndCombineEcdsa({
    toSign: ethers.utils.arrayify(eip712Hash),
    publicKey: PKP_PUBLIC_KEY,
    sigName: "karaokeTxSmoke",
  });
  console.log(
    "[karaoke-tx-smoke] signAndCombineEcdsa took",
    Date.now() - signingStart,
    "ms"
  );

  const parsedSignature = JSON.parse(signature);
  const rHex = parsedSignature.r.startsWith("0x")
    ? parsedSignature.r
    : `0x${parsedSignature.r}`;
  const sHex = parsedSignature.s.startsWith("0x")
    ? parsedSignature.s
    : `0x${parsedSignature.s}`;
  let v = parsedSignature.v < 27 ? parsedSignature.v + 27 : parsedSignature.v;

  const yParity = v - 27;

  const signedFields = [
    toBeArray(nonce),
    toBeArray(maxPriorityFeePerGas),
    toBeArray(gasPrice),
    toBeArray(gasLimit),
    contractAddress,
    toBeArray(0),
    txData || "0x",
    toBeArray(yParity),
    ethers.utils.arrayify(ethers.utils.zeroPad(rHex, 32)),
    ethers.utils.arrayify(ethers.utils.zeroPad(sHex, 32)),
    toBeArray(LENS_TESTNET_CHAIN_ID),
    pkpAddress,
    toBeArray(gasPerPubdataByteLimit),
    [],
    "0x",
    [],
  ];

  const signedRlp = ethers.utils.RLP.encode(signedFields);
  const serialized = "0x71" + signedRlp.slice(2);

  const runOnceStart = Date.now();
  const response = await Lit.Actions.runOnce(
    { waitForResponse: true, name: "karaokeTxSender" },
    async () => {
      try {
        return await provider.send("eth_sendRawTransaction", [serialized]);
      } catch (error) {
        return `TX_ERROR:${error.message}`;
      }
    }
  );
  console.log(
    "[karaoke-tx-smoke] runOnce/eth_sendRawTransaction took",
    Date.now() - runOnceStart,
    "ms"
  );

  if (response && response.startsWith("TX_ERROR:")) {
    throw new Error(response.substring("TX_ERROR:".length));
  }

  return response;
}

function buildDomainSeparator() {
  const domainTypeHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(
      "EIP712Domain(string name,string version,uint256 chainId)"
    )
  );
  const nameHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("zkSync"));
  const versionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("2"));

  return ethers.utils.keccak256(
    ethers.utils.concat([
      domainTypeHash,
      nameHash,
      versionHash,
      ethers.utils.zeroPad(ethers.utils.hexlify(LENS_TESTNET_CHAIN_ID), 32),
    ])
  );
}

function buildStructHash({
  txType,
  from,
  to,
  gasLimit,
  gasPerPubdataByteLimit,
  maxFeePerGas,
  maxPriorityFeePerGas,
  nonce,
  data,
}) {
  const txTypeHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(
      "Transaction(uint256 txType,uint256 from,uint256 to,uint256 gasLimit,uint256 gasPerPubdataByteLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint256 paymaster,uint256 nonce,uint256 value,bytes data,bytes32[] factoryDeps,bytes paymasterInput)"
    )
  );

  return ethers.utils.keccak256(
    ethers.utils.concat([
      txTypeHash,
      ethers.utils.zeroPad(ethers.utils.hexlify(txType), 32),
      ethers.utils.zeroPad(from, 32),
      ethers.utils.zeroPad(to, 32),
      ethers.utils.zeroPad(ethers.utils.hexlify(gasLimit), 32),
      ethers.utils.zeroPad(ethers.utils.hexlify(gasPerPubdataByteLimit), 32),
      ethers.utils.zeroPad(ethers.utils.hexlify(maxFeePerGas), 32),
      ethers.utils.zeroPad(ethers.utils.hexlify(maxPriorityFeePerGas), 32),
      ethers.utils.zeroPad("0x00", 32),
      ethers.utils.zeroPad(ethers.utils.hexlify(nonce), 32),
      ethers.utils.zeroPad("0x00", 32),
      ethers.utils.keccak256(data || "0x"),
      ethers.utils.keccak256("0x"),
      ethers.utils.keccak256("0x"),
    ])
  );
}

function toBeArray(value) {
  if (!value || value === "0" || value === 0) {
    return new Uint8Array([]);
  }
  const hex = ethers.utils.hexlify(value);
  return ethers.utils.arrayify(ethers.utils.stripZeros(hex));
}


go().catch((error) => {
  Lit.Actions.setResponse({
    response: JSON.stringify({ success: false, error: error.message }),
  });
});
