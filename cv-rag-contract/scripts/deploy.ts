import hre from "hardhat";

async function main() {
  console.log("🚀 Deploying DocumentRegistry to", hre.network.name);

  // Deploy the contract
  const documentRegistry = await hre.viem.deployContract("DocumentRegistry");

  console.log("✅ DocumentRegistry deployed to:", documentRegistry.address);
  console.log("");
  console.log("📋 Next steps:");
  console.log(`   1. Copy this address to your .env file:`);
  console.log(
    `      NEXT_PUBLIC_REGISTRY_ADDRESS="${documentRegistry.address}"`
  );
  console.log("");
  console.log(`   2. Verify on Basescan (if on Base Sepolia):`);
  console.log(
    `      npx hardhat verify --network baseSepolia ${documentRegistry.address}`
  );
  console.log("");

  // Wait for testnet propagation before verifying
  if (hre.network.name !== "hardhat") {
    console.log("⏳ Waiting for contract propagation...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  // Verify the initial state (non-critical)
  try {
    const rootCount = await documentRegistry.read.getRootCount();
    console.log(`🔍 Initial root count: ${rootCount}`);
  } catch {
    console.log("⚠️  Skipped verification (verify manually on Basescan)");
  }

  return documentRegistry.address;
}

main()
  .then((address) => {
    console.log("\n🎉 Deployment successful!");
    console.log(`   Contract: ${address}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
