App = {
  web3Provider: null,
  contracts: {},
  maxLuckyNumber: 10,
  minAmountToPlay: 1,

  init: function() {
    return App.initWeb3();
  },

  initWeb3: function() {
    // Initialize web3 and set the provider to the testRPC.
    if (typeof web3 !== 'undefined') {
      App.web3Provider = web3.currentProvider;
      web3 = new Web3(web3.currentProvider);
    }
    else {
      // set the provider you want from Web3.providers
      // local Ganache
      App.web3Provider = new Web3.providers.HttpProvider('http://127.0.0.1:7545');
      // infura.io
      //App.web3Provider = new Web3.providers.HttpProvider('https://ropsten.infura.io/')
      web3 = new Web3(App.web3Provider);
    }

    return App.initContract();
  },

  initContract: function() {
    $.getJSON('BlockchainLuckyNumber.json', function(data) {
      // Get the necessary contract artifact file and instantiate it with truffle-contract.
      var Artifact = data;
      App.contracts.BlockchainLuckyNumber = TruffleContract(Artifact);
      // Set the provider for our contract.
      App.contracts.BlockchainLuckyNumber.setProvider(App.web3Provider);
      // Use our contract to retieve and mark the adopted pets.

      App.initAccount();

      App.addEventListeners();

      return App.render();
    });
    return App.bindEvents();
  },


  initAccount: function() {
    web3.eth.getCoinbase(function(err, account) {
      if (err === null) {
        App.account = account;
        $('#myAccount').text(account);
        $('claim').hide();
      }
    });
  },


  bindEvents: function() {
    $(document).on('click', '#claimButton', App.claimWinning);
  },


  addEventListeners: function() {
    // PlayEvent
    App.contracts.BlockchainLuckyNumber.deployed().then(function(instance) {
      instance.PlayEvent({}, {
        fromBlock: 0,
        toBlock: 'latest'
      }).watch(function(error, event) {
        if (error != null) {
          console.log(error);
          return;
        }
        console.log("PlayEvent", event);
        var roundIndex = event.args["roundIndex"].c[0];
        var playIndex = event.args["playIndex"].c[0];
        var luckyNumber = event.args["luckyNumber"].c[0];
        var player = event.args["player"];
        App.stream(
          (player == App.account ? 'You' : 'Someone') + ' played '
          + ' lucky number ' + luckyNumber
          + ' in round #' + roundIndex
          + ' play #' + playIndex
          + ' with account: ' + player + '\n\n'
        );
      });
    });

    // LuckyNumberEvent
    App.contracts.BlockchainLuckyNumber.deployed().then(function(instance) {
      instance.LuckyNumberEvent({}, {
        fromBlock: 0,
        toBlock: 'latest'
      }).watch(function(error, event) {
        console.log("LuckyNumberEvent", event);
        if (error != null) {
          console.log(error);
          return;
        }
        var roundIndex = event.args["roundIndex"].c[0];
        var playIndex = event.args["playIndex"].c[0];
        var currentLuckyNumber = event.args["luckyNumber"].c[0];
        App.stream(
          'round #' + roundIndex
          + ' play #' + playIndex
          + ' lucky number: ' + currentLuckyNumber + '\n\n'
        );
      });
    });

    // WinnerEvent
    App.contracts.BlockchainLuckyNumber.deployed().then(function(instance) {
      instance.WinnerEvent({}, {
        fromBlock: 0,
        toBlock: 'latest'
      }).watch(function(error, event) {
        if (error != null) {
          console.log(error);
          return;
        }
        console.log("WinnerEvent", event);
        var roundIndex = event.args["roundIndex"].c[0];
        var winner = event.args["winner"];
        var amount = event.args["amount"].c[0];
        App.stream(
          (winner == App.account ? "*** YOU WON ***\n" : "*** JACKPOT ***\n")
          + 'round #' + roundIndex
          + ' jackpot: ' + web3.fromWei(amount, 'ether')
          + ' ETH claimable by ' + winner + '\n\n'
        );
        // TODO: skip showing on replay
        if (winner == App.account) {
          $('#winning').text(web3.fromWei(amount, 'ether'));
          $('#claim').show();
        }
      });
    });


    App.contracts.BlockchainLuckyNumber.deployed().then(function(instance) {
      instance.ClaimEvent({}, {
        fromBlock: 0,
        toBlock: 'latest'
      }).watch(function(error, event) {
        if (error != null) {
          console.log(error);
          return;
        }
        console.log("ClaimEvent", event);
        var claimIndex = event.args["claimIndex"].c[0];
        var player = event.args["player"];
        var amount = event.args["amount"].c[0];
        App.stream(
          (player == App.account ? 'You' : 'A winner') + ' claimed '
          + web3.fromWei(amount, 'ether')
          + ' to account ' + player
          + ' in claim #: ' + claimIndex + '\n\n'
        );
        if (player == App.account) {
          $('#winning').text(0);
          $('#claim').hide();
        }
      });
    });
  },


  play: function(luckyNumber) {
    event.preventDefault();
    console.log('playing ' + luckyNumber);
    App.contracts.BlockchainLuckyNumber.deployed().then(function(instance) {
      return instance.isLuckyNumberPlayed(luckyNumber);
    }).then(function(result) {
      console.log(result);
      if (result) {
        App.stream('Lucky number ' + luckyNumber + ' already played in this round.\n\n');
        return;
      }

      web3.eth.getCoinbase(function(error, account) {
        if (error != null) {
          console.log(error);
          return;
        }
        App.account = account;
        $('#myAccount').text(account);
        console.log('my account: ' + account);
        App.contracts.BlockchainLuckyNumber.deployed().then(function(instance) {
          return instance.play(luckyNumber, App.getRandomUint(31), {
            from: App.account,
            gas: 3000000,
            value: web3.toWei(App.minAmountToPlay, 'wei')
          });
        }).then(function(result) {
          console.log(result);
          return App.render();
        }).catch(function(err) {
          console.log(err.message);
        });
      });

    }).catch(function(err) {
      console.log(err.message);
    });
  },


  claimWinning: function(event) {
    event.preventDefault();
    App.contracts.BlockchainLuckyNumber.deployed().then(function(instance) {
      return instance.claimWinning({
        from: App.account,
        gas: 3000000
      });
    }).then(function(result) {
      console.log('claimWinning');
      console.log(result);
      return App.render();
    }).catch(function(err) {
      console.log(err.message);
    });
  },


  render: function() {
    App.renderButtons(maxLuckyNumber);
    App.getInfo();
  },


  getInfo: function() {
    console.log("getInfo");
    App.contracts.BlockchainLuckyNumber.deployed().then(function(instance) {
      return instance.getInfo();
    }).then(function(result) {
      // (roundIndex, jackpot, maxLuckyNumber, currentLuckyNumber, winning, minAmountToPlay, donationPercentage, charity)
      console.log(result);
      $('#roundIndex').text(result[0].c[0]);
      $('#playIndex').text(result[1].c[0]);
      $('#jackpot').text(web3.fromWei(result[2].c[0], 'ether'));
      var _maxLuckyNumber = result[3].c[0];
      if (maxLuckyNumber != _maxLuckyNumber) {
        maxLuckyNumber = _maxLuckyNumber;
        App.renderButtons(maxLuckyNumber);
      }
      $('#maxLuckyNumber').text(_maxLuckyNumber);
      $('#currentLuckyNumber').text(result[4].c[0]);
      var winning = web3.fromWei(result[5].c[0], 'ether');
      // TODO: fix smart contract always returning zero for winning
      /*
      if (winning > 0) {
        $('#winning').text(winning);
        $('#claim').show();
      }
      else {
        $('#claim').hide();
      }
      */
      App.minAmountToPlay = result[6].c[0];
      $('#playForEther').text(web3.fromWei(App.minAmountToPlay, 'ether'));
      $('#donationPercentage').text(result[7].c[0]);
      $('#charity').text(result[8]);
    }).catch(function(err) {
      console.log(err.message);
    });
  },


  getRandomHexString: function(length) {
    var hexString = "0x";
    while (hexString.length < length) {
      hexString += Math.random().toString(16).substring(2);
    }
    return hexString.substring(0,length);
  },


  getRandomUint: function(length) {
    return web3.toBigNumber(App.getRandomHexString(length));
  },


  stream: function(message) {
    $('#stream').text(message + $('#stream').val());
  },

  renderButtons: function(length) {
    var html = '';
    for (i = 1; i <= length; i++) {
      html += '<button class="btn btn-primary" type="button" onClick="App.play(' + i + ')" style="padding: 5px">' + i + '</button> &nbsp; ';
    }
    $('#luckyNumberButtons').html(html);
  }

};

$(function() {
  $(window).load(function() {
    App.init();
  });
});
