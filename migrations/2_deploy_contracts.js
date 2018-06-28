var BlockchainLuckyNumber = artifacts.require("BlockchainLuckyNumber");

module.exports = function(deployer) {
  //deployer.deploy(BlockchainLuckyNumber);
  // ropsten
  deployer.deploy(BlockchainLuckyNumber, { from: "0xd35f7089fd6cd4969e038891cadefd4b103f19fc"});
};
