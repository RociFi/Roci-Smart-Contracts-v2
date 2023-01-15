[![License: GPL v3](https://img.shields.io/badge/License-MIT-blue.svg)]([https://www.gnu.org/licenses/mit](https://opensource.org/licenses/MIT))

# RociFI protocol (v2)

[RociFi](https://v2.roci.fi/app/) is DeFi’s on-chain credit score, under-collateralized and capital-efficient lending protocol on Polygon. 

[RociFi](https://v2.roci.fi/app/) allows borrowers to take fixed-term fixed-rate stablecoin loans with reduced collateral as low as 75%  while giving lenders the possibility to earn interest from depositing their assets into lending pools. 

At the core of the protocol is [Non-Fungible Credit Score (NFCS)](https://blog.roci.fi/nfcs-non-fungible-credit-score-credit-reputation-and-trust-token-3473c9eda458). This is ERC-721 token that prospective borrower mints to see if they are eligible or not for an under collateralised loan. Eligibility is represented in the NFCS score which ranges from 1 (extremely trustworthy) to 10 (not trustworthy) and it is these scores that dictate what loan terms a borrower may take from a pool.

NFCS operates as DeFi’s credit, reputation, and trust credential. To date, [35000 users have minted their NFCS on Polygon](https://polygonscan.com/token/0x839a06a50A087fe3b842DF1877Ef83A443E37FbE). Among protocols that use NFCS to vet online reputation of their users are [Cyberconnect](https://blog.roci.fi/rocifi-partners-with-cyberconnect-ef0debef15af) and [RelationLabs](https://blog.roci.fi/rocifi-and-relation-building-credit-and-trust-in-web3-34315714dcee). 

Docs: <https://www.notion.so/RociFi-Documentation-da586043665a4accac00b647e402a09e>\
FAQ: <https://www.notion.so/rocifi/FAQ-bf0262c75d654b87b030ae276b9ce7ad>\
Guides: <https://www.notion.so/rocifi/Guides-81b5f4c764b94c4bb1f00e2f52c89347>

Discord: <https://discord.com/invite/dq7cDETKxd>\
Twitter: <https://twitter.com/rocifi> \
Medium: <https://blog.roci.fi/>\
Telegram: <https://t.me/RociFi>\
Linkedin: <https://www.linkedin.com/company/rocifi/>

## Development installation

First, clone the project repository:

```shell
git clone https://github.com/RociFi/Roci-Smart-Contracts-v2.git
cd Roci-Smart-Contracts-v2
```

Pre-install NodeJS of [compatible version](/.nvmrc). If there is a need to run different NodeJS versions, consider using [NVM](https://github.com/nvm-sh/nvm) or similar tool, that is available for your platform.

```shell
nvm install
nvm use
node --version
npm --version
```

Perform local installation:

```shell
npm install
```

Then you should be able to run tests:

```shell
# run common tests
npm test
```

Consider reading [HardHat documentation](https://hardhat.org/docs) to explore development framework.

### IDE and tooling configuration

We highly recommend using [Visual Studio Code](https://code.visualstudio.com/) IDE for development alongside with following extensions:

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [Version Lens](https://marketplace.visualstudio.com/items?itemName=pflannery.vscode-versionlens)
- [Solidity + Hardhat](https://marketplace.visualstudio.com/items?itemName=NomicFoundation.hardhat-solidity)
  - [solidity](https://marketplace.visualstudio.com/items?itemName=JuanBlanco.solidity) as an alternative
