/// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

import {IAddressBook} from "./IAddressBook.sol";
// import "../../../libraries/Loan.sol";
import {IVersion} from "../interfaces/IVersion.sol";

/**
 * @title IERC20PaymentStandard
 * @author RociFI Labs
 * @dev
 * Payment Standard is meant to be the bare minimum of payment logic required to interact with Bonds
 * and the rest of the ecosystem.
 * Payment contract should only have logic for starting loans (configure and issue),
 * making payments, collecting interest, and retrieving getting loan info.
 *
 * There should also only be **one** Payment contract. The key difference here for Payment Standard is that it is no
 * longer unique to each investor. And instead will share it’s logic with all of them.
 * Payment Standard also should be marked abstract enforcing that it is inherited by it’s child.
 * This means removing all the limits logic and moving it to a child contract like collateral or a specific RociPayment contract.
 */

interface IERC20PaymentStandard is IVersion {
    enum Status {
        UNISSUED,
        NEW,
        APPROVED,
        PAIDPART,
        CLOSED,
        PAIDLATE,
        DEFAULT,
        LATE
    }

    struct loan {
        Status status;
        address ERC20Address;
        address poolAddress;
        address borrower;
        uint256 nfcsID;
        uint256 maturityDate;
        uint128 issueDate;
        uint256 minPayment;
        uint256 interestRate;
        uint256 accrualPeriod;
        uint256 principal;
        uint256 totalPaymentsValue;
        uint256 awaitingCollection;
        uint256 awaitingInterest;
        uint256 paymentComplete;
        uint256 ltv;
        uint256 lt;
        uint16 score;
    }

    // NOTE 154 Bonds.sol
    // (uint256 interest, ) = pc.getLoanInfo(id);
    // this function is removed. Use loanLookup in Bonds

    // ---------------
    // State Variables
    // ---------------
    function MAXIMUM_BORROW_LIMIT() external returns (uint256);

    // note addresses are replaced with address book
    // enum is the index in the array returned by addressBook's function
    enum addresses_Payment {
        bondContract,
        NFCS
    }

    // Two mappings. One to get the loans for a user. And the other to get the the loans based off id

    // note these are removed as they're mappings and mess with the inheritance. If needed replace with getter functions
    function loanLookup(uint256 _id) external view returns (loan memory);

    // function loanIDs(address) external returns(uint[] memory);

    /**
     * @notice called when bonds are issued so as to make sure lender can only mint bonds once.
     * @param _id loan ID
     * @return the loan principal (so bonds knows how many NFTs to mint)
     * @return the borrowers address (so bonds can make sure borrower is calling this function)
     */
    function issueBonds(uint256 _id) external returns (uint256, address);

    /**
     * @notice gets the number of loans a person has
     * @param _who is who to look up
     * @return length
     */
    function getNumberOfLoans(address _who) external view returns (uint256);

    /**
     * @notice Called each time new NFTs are minted by staking
     * @param _am the amount of interest to add
     * @param _id is the id of the loan
     * @return true if added. Will not add interest if payment has been completed.
     *This prevents lenders from refusing to end a loan when it is rightfully over by forever
     *increasing the totalPaymentsValue through interest staking and never fully collecting payment.
     *This also means that if lenders do not realize interest gains soon enough they may not be able to collect them before
     *the borrower can complete the loan.
     */
    function addInterest(uint256 _am, uint256 _id) external returns (bool);

    /**
     * @param _id is the hash id of the loan. Same as bond ERC1155 ID as well
     * @return if delinquent or not. Meaning missed a payment
     */
    function missedPayment(uint256 _id) external view returns (bool);

    /**
     * @notice contract must be configured before bonds are issued. Pushes new loan to array for user
     * @param _erc20 is the ERC20 contract address that will be used for payments
     * @param _borrower is the borrower loan is being configured for. Keep in mind. ONLY this borrower can mint bonds to start the loan
     * @param _NFCSID is the user's NFCS NFT ID from Roci's Credit scoring system
     * @param _minPayment is the minimum payment that must be made before the payment period ends
     * @param _maturityDate payment must be made by this time or delinquent function will return true
     * @param _principal the origional loan value before interest
     * @param _interestRate the interest rate expressed as inverse. 2% = 1/5 = inverse of 5
     * @param _accrualPeriod the time it takes for interest to accrue in seconds
     * @return the id it just created
     */
    function configureNew(
        address _erc20,
        address _borrower,
        uint256 _minPayment,
        uint256 _NFCSID,
        uint256 _maturityDate,
        uint256 _principal,
        uint256 _interestRate,
        uint256 _accrualPeriod
    ) external returns (uint256);

    /**
     * @notice MUST approve this contract to spend your ERC1155s in bonds. Used to have this auto handled by the on received function.
     * However that was not a good idea as a hacker could create fake bonds.
     * @param _id is the id of the bond to send in
     * @param _amm is the amount to send
     * @param _receiver is the receiver of erc20 tokens
     */
    function withdrawl(
        uint256 _id,
        uint256 _amm,
        address _receiver
    ) external;

    /**
     * @notice function handles the payment of the loan. Does not have to be borrower
     *as payment comes in. The contract holds it until collection by bond owners. MUST APPROVE FIRST in ERC20 contract first
     * @param _id to pay off
     * @param _erc20Amount is amount in loan's ERC20 to pay
     */
    function payment(
        uint256 _id,
        uint256 _erc20Amount,
        string memory version
    ) external;

    /**
     * @notice helper function
     * @param _id of loan to check
     * @return return if the contract is payed off or not as bool
     */
    function isComplete(uint256 _id) external view returns (bool);

    /**
     * @notice Returns the ID for a loan given the borrower and index in the array
     * @param _borrower is borrower
     * @param _index is the index in the borrowers loan array
     * @return the loan ID
     */
    //
    function getId(address _borrower, uint256 _index) external view returns (uint256);

    /**
     * @dev function to get a user's total outstanding balance (By NFCS ID)
     * @param _nfcsId NFCS ID
     * @return total Oustanding balance
     */
    function getNFCSTotalOutstanding(uint256 _nfcsId) external view returns (uint256);

    /**
     * @dev function to get a user's total outstanding balance (By NFCS ID)
     * @param _nfcsId NFCS ID
     * @return total Oustanding balance
     */
    function getUserTotalOutstanding(uint256 _nfcsId) external view returns (uint256);

    /**
     * @dev function to get a system total outstanding balance
     * @return total Oustanding balance
     */
    function getTotalOutstanding() external view returns (uint256);
}
