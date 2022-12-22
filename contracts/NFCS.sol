// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

import {Version} from "./lib/Version.sol";
import {NFCS_VERSION} from "./lib/ContractVersions.sol";
import {Errors} from "./lib/Errors.sol";

// REMOVE when v1 will be no longer maintained
import {IAddressBook} from "./nfcs-compatibility/IAddressBook.sol";
import {ScoreDBInterface} from "./nfcs-compatibility/ScoreDBInterface.sol";
import {IERC20PaymentStandard} from "./nfcs-compatibility/IERC20PaymentStandard.sol";
import {NFCSInterface} from "./nfcs-compatibility/NFCSInterface.sol";
import {ROLE_PAYMENT_CONTRACT, ROLE_ORACLE, ROLE_ADMIN} from "./nfcs-compatibility/Globals.sol";

/**
 * @title An ERC721 token contract leveraging Openzeppelin for contract base and upgradeability (UUPS).
 * @author RociFi Labs
 * @notice You can use this contract for minting ERC721 tokens with an address bundle mapped against the tokenIds.
 */

contract NFCS is
    Initializable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    PausableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    NFCSInterface,
    Version
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _addressBook) public initializer {
        __ERC721_init("NFCS", "NFCS");
        __Pausable_init();
        __Ownable_init();
        __ERC721Enumerable_init();
        __UUPSUpgradeable_init();
        addressBook = IAddressBook(_addressBook);
    }

    /**
     * @notice sets the address of the new logic contract
     * @ This function MUST be included in each iteration of this contract, otherwise upgradeability will be lost!
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner whenPaused {}

    using CountersUpgradeable for CountersUpgradeable.Counter;
    using ECDSAUpgradeable for bytes32;

    // An incrementing id for each token
    CountersUpgradeable.Counter private _tokenIdCounter;

    // Mapping from tokenId to address array (bundle)
    mapping(uint256 => address[]) private _tokenBundle;
    // DEPRECATED
    mapping(uint256 => bool) private _bundleNonce;
    // DEPRECATED
    mapping(address => bool) private _mintedNonce;
    // DEPRECATED
    mapping(address => bool) private _addressNonce;

    // Event emitted when a new token is minted
    event TokenMinted(
        uint256 timestamp,
        address indexed _recipient,
        uint256 indexed _tokenId,
        address[] _addressBundle
    );

    event BundleUpdate(
        uint256 timestamp,
        address indexed executor,
        uint256 indexed tokenId,
        address[] bundle
    );

    event Migration(uint256 timestamp, uint256 indexed tokenId, address indexed executor);

    // V1 address managing contract
    IAddressBook public addressBook;

    // mapping that connects all addresses of bundle (including primary)
    // to primary address for which NFCS token was minted
    mapping(address => address) private secondaryToPrimary;

    //base URI for NFT Token
    string baseUri;

    //Selective pausable storage
    mapping(string => bytes4) internal funcNameSelector;
    mapping(bytes4 => string) public selectorFuncName;

    mapping(bytes4 => bool) public funcSelectorPaused;

    bytes32 private constant _DOMAIN_TYPE_HASH =
        keccak256("EIP712Domain(string name,string version)");

    string private constant _PRIMARY_TYPE = "PrimaryAddressSignature(address[] bundle)";
    string private constant _SECONDARY_TYPE = "SecondaryAddressSignature(address primary)";

    /**
     * @dev Checks that token id is minted
     * @param tokenId id of the NFCS Token
     */
    modifier exists(uint256 tokenId) {
        require(_exists(tokenId), Errors.NFCS_NONEXISTENT_TOKEN);
        _;
    }

    /**
     * @dev Checks that function caller has role
     * @param _role role to check
     */
    modifier onlyRole(uint256 _role) {
        require(msg.sender == lookup(_role), addressBook.roleLookupErrorMessage(_role));
        _;
    }

    /**
     * @dev Checks that all or particular methods are not paused
     */
    modifier ifNotPaused() {
        _requireNotPaused();
        require(
            funcSelectorPaused[msg.sig] == false,
            string(bytes.concat(bytes(selectorFuncName[msg.sig]), bytes(" function is on pause.")))
        );
        _;
    }

    /**
     * @notice Pauses the whole contract; used as emergency response
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice unpauses the contract; resumes functionality.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Set paused/unpaused state for method by name
     * @notice Work independently from pause()/unpause()
     * @param name of function to pause
     * @param paused state
     */
    function setFuncPaused(string memory name, bool paused) external onlyOwner {
        require(funcNameSelector[name] != bytes4(0), "Unknown function.");
        funcSelectorPaused[funcNameSelector[name]] = paused;
    }

    /**
     * @dev Add function to selective pausable
     * @notice Work independently from pause()/unpause()
     * @param name of function to pause
     * @param selector function selector
     */
    function _addPausableFunc(string memory name, bytes4 selector) internal {
        funcNameSelector[name] = selector;
        selectorFuncName[selector] = name;
    }

    /**
     * @dev Configuration method to set pausable functions
     */
    function addPausables() external onlyOwner {
        _addPausableFunc("mintToken", this.mintToken.selector);
        _addPausableFunc("addAddressToBundle", this.addAddressToBundle.selector);
    }

    function _domainTypedHash() internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    _DOMAIN_TYPE_HASH,
                    keccak256(bytes("NFCS")),
                    keccak256(bytes(NFCS_VERSION))
                )
            );
    }

    function _primaryTypedHash(address[] memory _bundle) internal pure returns (bytes32) {
        bytes32 bundleHash = keccak256(
            abi.encode(keccak256(bytes(_PRIMARY_TYPE)), keccak256(abi.encodePacked(_bundle)))
        );

        return keccak256(abi.encodePacked("\x19\x01", _domainTypedHash(), bundleHash));
    }

    function _secondaryTypedHash(address _primary) internal pure returns (bytes32) {
        bytes32 primaryHash = keccak256(abi.encode(keccak256(bytes(_SECONDARY_TYPE)), _primary));

        return keccak256(abi.encodePacked("\x19\x01", _domainTypedHash(), primaryHash));
    }

    /**
     * @dev Verification of addresses bundle
     * @param bundle array of addresses; first address is a primary address
     * @param signatures signatures of bundle;
     * @notice first signature is from primary address that confirms bundle addresses
     * @notice other signatures are from bundle addresses that confirms primary address
     * @param tokenId if of the NFCS token
     */
    function verifyAdd(
        address[] memory bundle,
        bytes[] memory signatures,
        uint256 tokenId
    ) internal {
        address primaryAddress = bundle[0];

        require(
            _primaryTypedHash(bundle).recover(signatures[0]) == primaryAddress,
            Errors.NFCS_WALLET_VERIFICATION_FAILED
        );

        for (uint256 i = 1; i < bundle.length; i++) {
            require(secondaryToPrimary[bundle[i]] == address(0), Errors.NFCS_ADDRESS_BUNDLED);

            require(
                _secondaryTypedHash(primaryAddress).recover(signatures[i]) == bundle[i],
                Errors.NFCS_WALLET_VERIFICATION_FAILED
            );

            secondaryToPrimary[bundle[i]] = primaryAddress;

            _tokenBundle[tokenId].push(bundle[i]);
        }
    }

    /**
     * @dev mints a new token and stores an address bundle against the tokenId.
     * @param bundle array of addresses; first address is a primary address
     * @param signatures signatures of bundle;
     * @notice first signature is from primary address that confirms bundle addresses
     * @notice other signatures are from bundle addresses that confirms primary address
     * @param version version of NFCS contract
     */
    function mintToken(
        address[] memory bundle,
        bytes[] memory signatures,
        string memory version
    ) public override ifNotPaused checkVersion(version) {
        require(bundle.length > 0 && bundle.length == signatures.length, Errors.ARGUMENTS_LENGTH);

        address primaryAddress = bundle[0];

        require(secondaryToPrimary[primaryAddress] == address(0), Errors.NFCS_TOKEN_MINTED);

        secondaryToPrimary[primaryAddress] = primaryAddress;

        uint256 tokenId = _tokenIdCounter.current();

        _tokenBundle[tokenId].push(primaryAddress);

        verifyAdd(bundle, signatures, tokenId);

        _tokenIdCounter.increment();

        _safeMint(primaryAddress, tokenId);

        emit TokenMinted(block.timestamp, primaryAddress, tokenId, bundle);
    }

    /**
     * @dev Returns primary address for secondary address of bundle.
     * @param user secondary address in bundle
     * @return address primary address of bundle
     */
    function getPrimaryAddress(address user) external view returns (address) {
        return secondaryToPrimary[user];
    }

    /**
     * @dev Add new address to existing bundle.
     * @param bundle array of new addresses; first address is a primary address
     * @param signatures signatures of bundle;
     * @notice first signature is from primary address that confirms bundle addresses
     * @notice other signatures are from bundle addresses which confirm primary address
     * @param version version of NFCS contract
     */
    function addAddressToBundle(
        address[] memory bundle,
        bytes[] memory signatures,
        string memory version
    ) external ifNotPaused checkVersion(version) {
        require(bundle.length > 1 && bundle.length == signatures.length, Errors.ARGUMENTS_LENGTH);

        address primaryAddress = bundle[0];

        uint256 tokenId = tokenOfOwnerByIndex(primaryAddress, 0);

        verifyAdd(bundle, signatures, tokenId);

        emit BundleUpdate(block.timestamp, primaryAddress, tokenId, bundle);
    }

    /**
     * @dev returns the bundle stored against a given tokenId
     * @param tokenId NFCS token id
     * @return address bundle addresses array
     */
    function getBundle(uint256 tokenId)
        external
        view
        override
        exists(tokenId)
        returns (address[] memory)
    {
        require(_exists(tokenId), Errors.NFCS_TOKEN_HAS_NOT_BUNDLE);
        return _tokenBundle[tokenId];
    }

    /**
     * @dev returns the token owned by tokenOwner, if any.
     * @param tokenOwner address of NFCS token owner
     * @return id of NFCS token
     */
    function getToken(address tokenOwner) external view override returns (uint256) {
        return tokenOfOwnerByIndex(tokenOwner, 0);
    }

    /**
  * @notice Modified this function to only check for ownership and not approved owner
    since approval functionality has been disabled. Keeping the same name for compatibility.
  */
    function _isApprovedOrOwner(address spender, uint256 tokenId)
        internal
        view
        override
        exists(tokenId)
        returns (bool)
    {
        address owner = ERC721Upgradeable.ownerOf(tokenId);
        return (spender == owner);
    }

    /**
     * @dev Returns current version of NFCS contract
     * @return version current version of NFCS
     */
    function currentVersion() public pure virtual override returns (string memory) {
        return NFCS_VERSION;
    }

    /**
     * @dev base URI setter
     * @param uri URI string
     */
    function setBaseURI(string memory uri) external onlyRole(ROLE_ADMIN) {
        baseUri = uri;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseUri;
    }

    /**
     * @notice unused hook for compatibility with OZ base contracts
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    /**
     * @notice returns true if a given interface is supported
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
   * @notice Removing some ERC721 functionality not yet needed.-----------------
     @dev the functions below are all impotent and all revert when called.
   */

    function approve(address, uint256) public virtual override(ERC721Upgradeable) {
        revert("ModifiedApprove: cannot approve other addresses");
    }

    function getApproved(uint256)
        public
        view
        virtual
        override(ERC721Upgradeable)
        returns (address)
    {
        revert("ModifiedGetApproved: cannot get approved address");
    }

    function setApprovalForAll(address, bool) public virtual override(ERC721Upgradeable) {
        revert("ModifiedSetApprovedForAll: cannot set approved address for all owned tokens");
    }

    function isApprovedForAll(address, address)
        public
        view
        virtual
        override(ERC721Upgradeable)
        returns (bool)
    {
        revert("ModifiedIsApprovedForAll: cannot check approval");
    }

    function transferFrom(
        address,
        address,
        uint256
    ) public virtual override(ERC721Upgradeable) {
        revert("ModifiedTransferFrom: transferFrom not supported");
    }

    function safeTransferFrom(
        address,
        address,
        uint256
    ) public virtual override(ERC721Upgradeable) {
        revert("ModifiedSafeTransferFrom: safeTransferFrom not supported");
    }

    function safeTransferFrom(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual override(ERC721Upgradeable) {
        revert("ModifiedSafeTransferFrom: safeTransferFrom not supported");
    }

    /**
     * @dev V1: functions for global and daily limits
     */
    function getLimits()
        external
        view
        override
        returns (
            uint128 dailyLimit,
            uint128 globalLimit,
            uint128 userDailyLimit,
            uint128 userGlobalLimit
        )
    {
        dailyLimit = addressBook.dailyLimit();
        globalLimit = addressBook.globalLimit();
        userDailyLimit = addressBook.userDailyLimit();
        userGlobalLimit = addressBook.userGlobalLimit();
    }

    function getNFCSLimits(uint256 _nfcsId)
        external
        view
        override
        returns (uint128 dailyLimit, uint128 globalLimit)
    {
        uint16 score = ScoreDBInterface(lookup(ROLE_ORACLE)).getScore(_nfcsId).creditScore;
        uint128 globalNFCSLimit = addressBook.globalNFCSLimit(_nfcsId);
        return
            globalNFCSLimit == 0 ? (0, addressBook.scoreGlobalLimit(score)) : (0, globalNFCSLimit);
    }

    function lookup(uint256 _role) internal view returns (address contractAddress) {
        contractAddress = addressBook.addressList(_role);

        require(contractAddress != address(0), addressBook.roleLookupErrorMessage(_role));
    }

    function getTotalOutstanding(uint256 _nfcsId)
        external
        view
        override
        returns (
            uint256 globalOutstanding,
            uint256 userOutstanding,
            uint256 nfcsOutstanding
        )
    {
        IERC20PaymentStandard investor = IERC20PaymentStandard(
            addressBook.addressList(ROLE_PAYMENT_CONTRACT)
        );

        userOutstanding += investor.getUserTotalOutstanding(_nfcsId);
        globalOutstanding += investor.getTotalOutstanding();
        nfcsOutstanding += investor.getNFCSTotalOutstanding(_nfcsId);
    }
}
