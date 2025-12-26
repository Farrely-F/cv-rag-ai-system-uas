/**
 * DocumentRegistry Contract ABI
 * Generated from cv-rag-contract/contracts/DocumentRegistry.sol
 */

export const DOCUMENT_REGISTRY_ABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "merkleRoot",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "string",
        name: "documentId",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "registeredBy",
        type: "address",
      },
    ],
    name: "RootAnchored",
    type: "event",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "_merkleRoot", type: "bytes32" },
      { internalType: "string", name: "_documentId", type: "string" },
    ],
    name: "anchorRoot",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getRootCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "_merkleRoot", type: "bytes32" }],
    name: "getRootDetails",
    outputs: [
      {
        components: [
          { internalType: "bytes32", name: "merkleRoot", type: "bytes32" },
          { internalType: "uint256", name: "timestamp", type: "uint256" },
          { internalType: "string", name: "documentId", type: "string" },
          { internalType: "address", name: "registeredBy", type: "address" },
        ],
        internalType: "struct DocumentRegistry.DocumentRoot",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "rootHistory",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    name: "roots",
    outputs: [
      { internalType: "bytes32", name: "merkleRoot", type: "bytes32" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
      { internalType: "string", name: "documentId", type: "string" },
      { internalType: "address", name: "registeredBy", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "_merkleRoot", type: "bytes32" }],
    name: "verifyRoot",
    outputs: [
      { internalType: "bool", name: "exists", type: "bool" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
      { internalType: "string", name: "documentId", type: "string" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
