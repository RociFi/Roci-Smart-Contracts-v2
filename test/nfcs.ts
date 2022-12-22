import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { constants } from "ethers";
import { ethers, upgrades } from "hardhat";
import { Errors, proxyOpts, VERSIONS } from "../scripts/constants";
import { getBundleWithSignatures } from "../scripts/common";
import { MockNFCS } from "../typechain-types";

describe("NFCS unit test", async () => {
  let MockNFCS: MockNFCS;
  let admin: SignerWithAddress,
    user1: SignerWithAddress,
    user2: SignerWithAddress,
    user3: SignerWithAddress;

  before(async () => {
    [admin, user1, user2, user3] = await ethers.getSigners();
    const MockNFCSFactory = await ethers.getContractFactory("MockNFCS");
    MockNFCS = (await upgrades
      .deployProxy(MockNFCSFactory, [ethers.constants.AddressZero], proxyOpts)
      .then((f) => f.deployed())) as MockNFCS;
  });

  it("Get current version of NFCS contract", async () => {
    expect(await MockNFCS.currentVersion()).to.equal(VERSIONS.NFCS_VERSION);
  });

  it("Should NOT get NFCS token by owner", async () => {
    await expect(MockNFCS.getToken(user1.address)).to.be.revertedWith(
      "ERC721Enumerable: owner index out of bounds",
    );
  });

  it("NFCS token has not bundle", async () => {
    await expect(MockNFCS.getBundle(0)).to.be.revertedWith(
      Errors.NFCS_NONEXISTENT_TOKEN,
    );
  });

  it("Should NOT get primary address of non-existing bundle", async () => {
    expect(await MockNFCS.getPrimaryAddress(user1.address)).to.equal(
      constants.AddressZero,
    );
  });

  it("Pause NFCS contract", async () => {
    await MockNFCS.pause();
    expect(await MockNFCS.paused()).to.equal(true);
  });

  it("Should NOT mint NFCS because paused", async () => {
    const { bundle, signatures } = await getBundleWithSignatures(
      [user1, user2],
      MockNFCS,
    );

    await expect(
      MockNFCS.connect(user1).mintToken(
        bundle,
        signatures,
        VERSIONS.NFCS_VERSION,
      ),
    ).to.be.revertedWith(Errors.PAUSED);
  });

  it("Should NOT add address to bundle NFCS because paused", async () => {
    const { bundle, signatures } = await getBundleWithSignatures(
      [user1, user3],
      MockNFCS,
    );

    await expect(
      MockNFCS.connect(user1).addAddressToBundle(
        bundle,
        signatures,
        VERSIONS.NFCS_VERSION,
      ),
    ).to.be.revertedWith(Errors.PAUSED);
  });

  it("Unpause NFCS contract", async () => {
    await MockNFCS.unpause();
    expect(await MockNFCS.paused()).to.equal(false);
  });

  it("Should mint NFCS token", async () => {
    const { bundle, signatures } = await getBundleWithSignatures(
      [user1, user2],
      MockNFCS,
    );

    await expect(
      MockNFCS.connect(user1).mintToken(
        bundle,
        signatures,
        VERSIONS.NFCS_VERSION,
      ),
    ).to.emit(MockNFCS, "TokenMinted");

    const tokenId = await MockNFCS.getToken(user1.address);

    expect(await MockNFCS.ownerOf(tokenId)).to.equal(bundle[0]);
    expect(await MockNFCS.balanceOf(bundle[0])).to.equal(1);
    expect(await MockNFCS.balanceOf(bundle[1])).to.equal(0);

    await expect(
      MockNFCS.connect(user1).mintToken(
        bundle,
        signatures,
        VERSIONS.NFCS_VERSION,
      ),
    ).revertedWith(Errors.NFCS_TOKEN_MINTED);
  });

  it("Should get primary address of existing bundle", async () => {
    expect(await MockNFCS.getPrimaryAddress(user2.address)).to.equal(
      user1.address,
    );
  });

  it("NFCS token has corresponding bundle", async () => {
    const tokenId = await MockNFCS.getToken(user1.address);
    const bundle = await MockNFCS.getBundle(tokenId);

    expect(bundle).to.have.all.members([user1.address, user2.address]);
    expect(bundle).to.have.lengthOf(2);
    expect(bundle).to.be.an.instanceof(Array);
  });

  it("Should get NFCS token by owner", async () => {
    const tokenId = await MockNFCS.getToken(user1.address);
    expect(await MockNFCS.getToken(user1.address)).to.equal(tokenId);
  });

  it("Should add address to NFCS bundle", async () => {
    const { bundle, signatures } = await getBundleWithSignatures(
      [user1, user3],
      MockNFCS,
    );
    await expect(
      MockNFCS.connect(user1).addAddressToBundle(
        bundle,
        signatures,
        VERSIONS.NFCS_VERSION,
      ),
    ).to.emit(MockNFCS, "BundleUpdate");
  });

  it("NFCS token has corresponding updated bundle", async () => {
    const tokenId = await MockNFCS.getToken(user1.address);
    const bundle = await MockNFCS.getBundle(tokenId);
    expect(bundle).to.have.all.members([
      user1.address,
      user2.address,
      user3.address,
    ]);
    expect(bundle).to.have.lengthOf(3);
    expect(bundle).to.be.an.instanceof(Array);
  });

  it("Should get primary address", async () => {
    expect(await MockNFCS.getPrimaryAddress(user2.address)).to.equal(
      user1.address,
    );
  });

  it("Should get primary address for primary address", async () => {
    expect(await MockNFCS.getPrimaryAddress(user1.address)).to.equal(
      user1.address,
    );
  });

  it("Should NOT addPausables from non-owner address", async () => {
    await expect(MockNFCS.connect(user1).addPausables()).to.be.revertedWith(
      "Ownable: caller is not the owner",
    );
  });

  it("Should NOT setFuncPaused from non-owner address", async () => {
    await expect(
      MockNFCS.connect(user1).setFuncPaused("mintToken", true),
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Should NOT setFuncPaused because unknown function", async () => {
    await expect(
      MockNFCS.connect(admin).setFuncPaused("", true),
    ).to.be.revertedWith("Unknown function.");
  });

  it("Should addPausables", async () => {
    await MockNFCS.connect(admin).addPausables();
    const mintTokenSelector = await MockNFCS.connect(admin).getSelector(
      "mintToken(address[],bytes[],string)",
    );
    const addAddressToBundleSelector = await MockNFCS.connect(
      admin,
    ).getSelector("addAddressToBundle(address[],bytes[],string)");
    expect(await MockNFCS.selectorFuncName(mintTokenSelector)).to.equal(
      "mintToken",
    );
    expect(
      await MockNFCS.selectorFuncName(addAddressToBundleSelector),
    ).to.equal("addAddressToBundle");
  });

  it("Should setFuncPaused", async () => {
    const mintTokenSelector = await MockNFCS.connect(admin).getSelector(
      "mintToken(address[],bytes[],string)",
    );
    await MockNFCS.connect(admin).setFuncPaused("mintToken", true);
    expect(await MockNFCS.funcSelectorPaused(mintTokenSelector)).to.equal(true);
  });

  it("Should NOT check isApprovedOrOwner because tokenId is not exist", async () => {
    await expect(
      MockNFCS.isApprovedOrOwner(user1.address, 777),
    ).to.be.revertedWith(Errors.NFCS_NONEXISTENT_TOKEN);
  });

  it("Should check isApprovedOrOwner when spender address equals owner address", async () => {
    const tokenId = await MockNFCS.getToken(user1.address);
    expect(await MockNFCS.isApprovedOrOwner(user1.address, tokenId)).to.equal(
      true,
    );
  });

  it("Should check isApprovedOrOwner when spender address is not equal owner address", async () => {
    const tokenId = await MockNFCS.getToken(user1.address);
    expect(await MockNFCS.isApprovedOrOwner(admin.address, tokenId)).to.equal(
      false,
    );
  });

  it("Should NOT approve because it's blocked", async () => {
    await expect(
      MockNFCS.connect(admin).approve(admin.address, 1),
    ).to.be.revertedWith("ModifiedApprove: cannot approve other addresses");
  });

  it("Should NOT getApproved because it's blocked", async () => {
    await expect(MockNFCS.connect(admin).getApproved(1)).to.be.revertedWith(
      "ModifiedGetApproved: cannot get approved address",
    );
  });

  it("Should NOT setApprovalForAll because it's blocked", async () => {
    await expect(
      MockNFCS.connect(admin).setApprovalForAll(admin.address, true),
    ).to.be.revertedWith(
      "ModifiedSetApprovedForAll: cannot set approved address for all owned tokens",
    );
  });

  it("Should NOT isApprovedForAll because it's blocked", async () => {
    await expect(
      MockNFCS.connect(admin).isApprovedForAll(admin.address, user1.address),
    ).to.be.revertedWith("ModifiedIsApprovedForAll: cannot check approval");
  });

  it("Should NOT transferFrom because it's blocked", async () => {
    await expect(
      MockNFCS.connect(admin).transferFrom(admin.address, user1.address, 1),
    ).to.be.revertedWith("ModifiedTransferFrom: transferFrom not supported");
  });
});
