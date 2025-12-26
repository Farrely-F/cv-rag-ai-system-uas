// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DocumentRegistry
 * @dev Registry for anchoring document Merkle roots on-chain for CV-RAG system.
 * Enables cryptographic verification of budget document integrity.
 */
contract DocumentRegistry {
    /// @notice Struct storing document root information
    struct DocumentRoot {
        bytes32 merkleRoot;
        uint256 timestamp;
        string documentId;
        address registeredBy;
    }

    /// @notice Mapping from Merkle root to document information
    mapping(bytes32 => DocumentRoot) public roots;

    /// @notice Ordered history of all anchored roots
    bytes32[] public rootHistory;

    /// @notice Emitted when a new Merkle root is anchored
    event RootAnchored(
        bytes32 indexed merkleRoot,
        string documentId,
        uint256 timestamp,
        address indexed registeredBy
    );

    /**
     * @notice Anchor a new document Merkle root on-chain
     * @param _merkleRoot The Merkle root hash of the document chunks
     * @param _documentId Unique identifier for the document
     */
    function anchorRoot(
        bytes32 _merkleRoot,
        string memory _documentId
    ) external {
        require(roots[_merkleRoot].timestamp == 0, "Root already exists");

        roots[_merkleRoot] = DocumentRoot({
            merkleRoot: _merkleRoot,
            timestamp: block.timestamp,
            documentId: _documentId,
            registeredBy: msg.sender
        });

        rootHistory.push(_merkleRoot);

        emit RootAnchored(_merkleRoot, _documentId, block.timestamp, msg.sender);
    }

    /**
     * @notice Verify if a Merkle root exists on-chain
     * @param _merkleRoot The Merkle root to verify
     * @return exists Whether the root exists
     * @return timestamp When the root was anchored (0 if not exists)
     * @return documentId The associated document ID (empty if not exists)
     */
    function verifyRoot(bytes32 _merkleRoot) external view returns (
        bool exists,
        uint256 timestamp,
        string memory documentId
    ) {
        DocumentRoot memory root = roots[_merkleRoot];
        exists = root.timestamp != 0;
        timestamp = root.timestamp;
        documentId = root.documentId;
    }

    /**
     * @notice Get the total count of anchored roots
     * @return The number of roots in the registry
     */
    function getRootCount() external view returns (uint256) {
        return rootHistory.length;
    }

    /**
     * @notice Get root details by Merkle root hash
     * @param _merkleRoot The Merkle root to look up
     * @return The DocumentRoot struct containing all details
     */
    function getRootDetails(bytes32 _merkleRoot) external view returns (DocumentRoot memory) {
        return roots[_merkleRoot];
    }
}
