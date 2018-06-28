var HDWalletProvider = require("truffle-hdwallet-provider");
// TODO: set Infura API key
var infura_apikey = "";
// TODO: set Metamask wallet seed
var mnemonic = "";

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // for more about customizing your Truffle configuration!
  networks: {
    // local ganache
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*" // Match any network id
    },
    // local geth
    localhost: {
      host: "localhost",
      port: 8546,
      network_id: "*"
    },
    // local geth ropsten
    /*
    ropsten: {
      host: "localhost",
      port: 8545,
      network_id: "3"
    },
    */
    // infura public node for ropstein
    ropsten: {
      provider: new HDWalletProvider(mnemonic, "https://ropsten.infura.io/" + infura_apikey),
      network_id: 3,
      gas: 2257178,
      from: "0xd35f7089fd6cd4969e038891cadefd4b103f19fc"
    }
  },
  solc: { optimizer: { enabled: true, runs: 200 } }
};
