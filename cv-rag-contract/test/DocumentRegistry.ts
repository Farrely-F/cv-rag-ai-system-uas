import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress, keccak256, toHex } from "viem";

describe("DocumentRegistry", function () {
  // Fixture to deploy the DocumentRegistry contract
  async function deployDocumentRegistryFixture() {
    const [owner, otherAccount] = await hre.viem.getWalletClients();

    const documentRegistry = await hre.viem.deployContract("DocumentRegistry");
    const publicClient = await hre.viem.getPublicClient();

    return {
      documentRegistry,
      owner,
      otherAccount,
      publicClient,
    };
  }

  // Helper to generate a test Merkle root
  function generateMerkleRoot(seed: string): `0x${string}` {
    return keccak256(toHex(seed));
  }

  describe("Deployment", function () {
    it("Should deploy with zero roots", async function () {
      const { documentRegistry } = await loadFixture(
        deployDocumentRegistryFixture
      );

      expect(await documentRegistry.read.getRootCount()).to.equal(0n);
    });
  });

  describe("anchorRoot", function () {
    it("Should successfully anchor a new Merkle root", async function () {
      const { documentRegistry } = await loadFixture(
        deployDocumentRegistryFixture
      );

      const merkleRoot = generateMerkleRoot("test-document-1");
      const documentId = "doc-uuid-12345";

      await documentRegistry.write.anchorRoot([merkleRoot, documentId]);

      const count = await documentRegistry.read.getRootCount();
      expect(count).to.equal(1n);
    });

    it("Should store correct document information", async function () {
      const { documentRegistry, owner } = await loadFixture(
        deployDocumentRegistryFixture
      );

      const merkleRoot = generateMerkleRoot("test-document-2");
      const documentId = "doc-uuid-67890";

      await documentRegistry.write.anchorRoot([merkleRoot, documentId]);

      const rootDetails = await documentRegistry.read.getRootDetails([
        merkleRoot,
      ]);

      expect(rootDetails.merkleRoot).to.equal(merkleRoot);
      expect(rootDetails.documentId).to.equal(documentId);
      expect(rootDetails.registeredBy).to.equal(
        getAddress(owner.account.address)
      );
      expect(rootDetails.timestamp > 0n).to.be.true;
    });

    it("Should reject duplicate Merkle roots", async function () {
      const { documentRegistry } = await loadFixture(
        deployDocumentRegistryFixture
      );

      const merkleRoot = generateMerkleRoot("duplicate-test");
      const documentId = "doc-duplicate";

      await documentRegistry.write.anchorRoot([merkleRoot, documentId]);

      await expect(
        documentRegistry.write.anchorRoot([merkleRoot, "different-doc"])
      ).to.be.rejectedWith("Root already exists");
    });

    it("Should emit RootAnchored event", async function () {
      const { documentRegistry, publicClient, owner } = await loadFixture(
        deployDocumentRegistryFixture
      );

      const merkleRoot = generateMerkleRoot("event-test");
      const documentId = "doc-event-test";

      const hash = await documentRegistry.write.anchorRoot([
        merkleRoot,
        documentId,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const events = await documentRegistry.getEvents.RootAnchored();
      expect(events).to.have.lengthOf(1);
      expect(events[0].args.merkleRoot).to.equal(merkleRoot);
      expect(events[0].args.documentId).to.equal(documentId);
      expect(events[0].args.registeredBy).to.equal(
        getAddress(owner.account.address)
      );
    });

    it("Should maintain root history order", async function () {
      const { documentRegistry } = await loadFixture(
        deployDocumentRegistryFixture
      );

      const root1 = generateMerkleRoot("history-1");
      const root2 = generateMerkleRoot("history-2");
      const root3 = generateMerkleRoot("history-3");

      await documentRegistry.write.anchorRoot([root1, "doc-1"]);
      await documentRegistry.write.anchorRoot([root2, "doc-2"]);
      await documentRegistry.write.anchorRoot([root3, "doc-3"]);

      expect(await documentRegistry.read.rootHistory([0n])).to.equal(root1);
      expect(await documentRegistry.read.rootHistory([1n])).to.equal(root2);
      expect(await documentRegistry.read.rootHistory([2n])).to.equal(root3);
      expect(await documentRegistry.read.getRootCount()).to.equal(3n);
    });
  });

  describe("verifyRoot", function () {
    it("Should return exists=true for anchored root", async function () {
      const { documentRegistry } = await loadFixture(
        deployDocumentRegistryFixture
      );

      const merkleRoot = generateMerkleRoot("verify-test");
      const documentId = "doc-verify";

      await documentRegistry.write.anchorRoot([merkleRoot, documentId]);

      const [exists, timestamp, returnedDocId] =
        await documentRegistry.read.verifyRoot([merkleRoot]);

      expect(exists).to.be.true;
      expect(timestamp > 0n).to.be.true;
      expect(returnedDocId).to.equal(documentId);
    });

    it("Should return exists=false for non-existent root", async function () {
      const { documentRegistry } = await loadFixture(
        deployDocumentRegistryFixture
      );

      const nonExistentRoot = generateMerkleRoot("non-existent");

      const [exists, timestamp, documentId] =
        await documentRegistry.read.verifyRoot([nonExistentRoot]);

      expect(exists).to.be.false;
      expect(timestamp).to.equal(0n);
      expect(documentId).to.equal("");
    });
  });

  describe("getRootCount", function () {
    it("Should accurately track root count", async function () {
      const { documentRegistry } = await loadFixture(
        deployDocumentRegistryFixture
      );

      expect(await documentRegistry.read.getRootCount()).to.equal(0n);

      await documentRegistry.write.anchorRoot([
        generateMerkleRoot("count-1"),
        "doc-1",
      ]);
      expect(await documentRegistry.read.getRootCount()).to.equal(1n);

      await documentRegistry.write.anchorRoot([
        generateMerkleRoot("count-2"),
        "doc-2",
      ]);
      expect(await documentRegistry.read.getRootCount()).to.equal(2n);

      await documentRegistry.write.anchorRoot([
        generateMerkleRoot("count-3"),
        "doc-3",
      ]);
      expect(await documentRegistry.read.getRootCount()).to.equal(3n);
    });
  });
});
