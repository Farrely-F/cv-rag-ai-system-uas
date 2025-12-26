// Hardhat Ignition module for deploying DocumentRegistry contract
// Learn more at https://v2.hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DocumentRegistryModule = buildModule("DocumentRegistryModule", (m) => {
  const documentRegistry = m.contract("DocumentRegistry");

  return { documentRegistry };
});

export default DocumentRegistryModule;
