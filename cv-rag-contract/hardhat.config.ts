import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
      chainId: 84532,
    },
  },
  // Etherscan V2 API configuration
  // Use a single Etherscan API key for all chains
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  // Enable Sourcify verification as alternative
  sourcify: {
    enabled: true,
  },
};

export default config;
