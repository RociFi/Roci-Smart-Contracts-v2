[![License: GPL v3](https://img.shields.io/badge/License-MIT-blue.svg)]([https://www.gnu.org/licenses/mit](https://opensource.org/licenses/MIT))

# RociFI protocol (v2)

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
