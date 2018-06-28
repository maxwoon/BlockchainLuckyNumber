pragma solidity ^0.4.17;

/*
Blockchain Lucky Number - decentralized lottery with transparent charity donation

Demo of an imperfect but transparent lottery / raffle running on blockchain with auto-donation to specified charity, and optional player initiated partial donation of t$

Run your own transparent charity drive on blockchain with your own copy / derivative of this smart contract.

Open to collaboration to improve this until the day corporate / state / national / global lotteries, raffles and sweepstakes run on blockchains with full transparency.

Max Woon
https://linkedin.com/in/maxwoon
https://twitter.com/max_woon
*/

contract BlockchainLuckyNumber {

    // contract owner
    address public owner;

    // allow testing with charity address pointing to contract address before starting
    // call start(...) to set charity address and other parameters
    // once it is started, charity address and other parameters cannot be changed
    bool public isStarted;

    // whether to store data of every play in addition to events
    bool public isLogging;

    // charity to receive donation
    address public charity;

    // auto-donate a percentage of the amount of every play to charity
    uint public donationPercentage;

    // accumulated donation available for claim
    uint public donationPool;

    // current lucky number, randomly generated on every play
    uint public currentLuckyNumber;

    // range of lucky numbers: 1 to maxLuckyNumber
    uint public maxLuckyNumber;

    // lucky number history: playIndex => lucky number picked
    mapping(uint => uint) public luckyNumberHistory;

    // minimum amount to play
    uint public minAmountToPlay;

    // play index, incremented on every play
    uint public playIndex;

    // round index, incremented every time a player wins
    uint public roundIndex;

    // claim index, incremented every time a player claims the winning
    uint public claimIndex;

    // donation index, incremented every time a player donates a percentage of winning
    uint public donationIndex;

    // jackpot amount of current round
    uint public jackpot;

    // jackpot history: roundIndex => jackpot amount
    mapping(uint => uint) public jackpotHistory;

    // winning lucky numbers: roundIndex => winning numbers
    mapping(uint => uint) public winningLuckyNumbers;

    // winners: roundIndex => winner's address
    mapping(uint => address) public winners;

    // accumulated win amount claimable by players: winner's address => win amount
    mapping(address => uint) public winnings;

    // players who played a lucky number in the round: roundIndex => (luckyNumber => player)
    mapping(uint => mapping(uint => address)) public playersInCurrentRound;

    // lucky numbers played by players in the round: player => (roundIndex => luckyNumber)
    mapping(address => mapping(uint => uint)) public luckyNumbersInCurrentRound;

    // private random hash
    uint private randomHash;


    struct Info {
      uint roundInxex;
      uint jackpot;
      uint maxLuckyNumber;
      uint currentLuckyNumber;
      uint donationPercentage;
      address charity;
    }


    struct PlayData {
        uint roundIndex;
        uint luckyNumber;
        address player;
    }
    mapping(uint => PlayData) playHistory;


    struct WinData {
        uint roundIndex;
        uint luckyNumber;
        uint jackpot;
        address winner;
    }
    mapping(uint => WinData) winHistory;


    struct ClaimData {
        uint claimIndex;
        uint amount;
        address winner;
    }
    mapping(uint => ClaimData) claimHistory;


    struct DonationData {
        uint donationIndex;
        address player;
        uint amount;
    }
    mapping(uint => DonationData) donationHistory;


    event LuckyNumberEvent(uint roundIndex, uint playIndex, uint luckyNumber);
    event PlayEvent(uint roundIndex, uint playIndex, uint luckyNumber, address player);
    event WinnerEvent(uint roundIndex, address winner, uint amount);
    event ClaimEvent(uint claimIndex, uint amount, address player);
    event DonationEvent(uint donationIndex, uint amount, address player);


    // initialize blockchain lucky number with test parameters
    function BlockchainLuckyNumber() public {
        owner = msg.sender;
        isStarted = false;
        roundIndex = 1;
        playIndex = 1;
        jackpot = 0;
        maxLuckyNumber = 10;
        minAmountToPlay = 1000000000000;
        donationPercentage = 10;
        charity = address(this);
        isLogging = false;
    }


    // after test, call start set the game with real parameters:
    // maxLuckyNumber: a player will pick a lucky number from 1 to maxLuckyNumber
    // minAmountToPlay: mimimum wei to play
    // donationPercentage: percentage of wei played to donate to charity
    // charity: address of the charity which can claim the accumulated donation at any time
    // parameters cannot be changed after the game has started
    function start(uint _maxLuckyNumber, uint _minAmountToPlay, uint _donationPercentage, address _charity, bool _isLogging) public {
      require(address(this) == msg.sender);
      require(isStarted == false);
      maxLuckyNumber = _maxLuckyNumber;
      minAmountToPlay = _minAmountToPlay;
      donationPercentage = _donationPercentage;
      charity = _charity;
      isLogging = _isLogging;
      isStarted = true;
    }


    function getInfo() view public returns (uint, uint, uint, uint, uint, uint, uint, uint, address) {
      uint winning = winnings[msg.sender];
      return (roundIndex, playIndex, jackpot, maxLuckyNumber, currentLuckyNumber, winning, minAmountToPlay, donationPercentage, charity);
    }


    function isLuckyNumberPlayed(uint _luckyNumber) view public returns (bool) {
        return (playersInCurrentRound[roundIndex][_luckyNumber] > 0);
    }


    // play lucky number
    function play(uint _luckyNumber, uint _randomHash) payable public returns (bool) {
        // meet minimum amount to play
        require(msg.value >= minAmountToPlay);

        // lucky number not played in the current round
        require(playersInCurrentRound[roundIndex][_luckyNumber] == 0x0);

        // auto-donate percentage of play amount
        uint donation = uint(msg.value * donationPercentage / 100);
        donationPool += donation;
        jackpot += msg.value - donation;

        // register play data
        playersInCurrentRound[roundIndex][_luckyNumber] = msg.sender;
        luckyNumbersInCurrentRound[msg.sender][roundIndex] = _luckyNumber;

        if (isLogging) {
          PlayData storage playData = playHistory[playIndex];
          playData.roundIndex = roundIndex;
          playData.luckyNumber = _luckyNumber;
          playData.player = msg.sender;
        }

        randomHash += _randomHash;

        emit PlayEvent(roundIndex, playIndex, _luckyNumber, msg.sender);

        spinLuckyWheel();

        return true;
    }


    function spinLuckyWheel() private {
        pickLuckyNumber();
        processWin();
    }


    function pickLuckyNumber() private {
        // pick lucky number
        currentLuckyNumber = rand(maxLuckyNumber);

        // register lucky number picked
        luckyNumberHistory[playIndex] = currentLuckyNumber;

        // emit lucky number event
        emit LuckyNumberEvent(roundIndex, playIndex, currentLuckyNumber);
    }


    function rand(uint max) constant private returns (uint) {
        return (uint(block.blockhash(block.number - 1)) - randomHash) % max + 1;
    }


    function processWin() private {
        if (playersInCurrentRound[roundIndex][currentLuckyNumber] == 0x0) {
            // rollover jackpot to next play
            playIndex++;
            return;
        }

        winners[roundIndex] = playersInCurrentRound[roundIndex][currentLuckyNumber];
        // transfer jackpot to winner
        address winner = winners[roundIndex];
        uint winning = 0 + jackpot;
        winnings[winner] = winning;

        if (isLogging) {
          WinData storage winData = winHistory[roundIndex];
          winData.roundIndex = roundIndex;
          winData.luckyNumber = currentLuckyNumber;
          winData.jackpot = jackpot;
          winData.winner = winners[roundIndex];
        }

        // reset for new round
        jackpot = 0;
        roundIndex++;
        playIndex = 1;

        // emit winner event
        emit WinnerEvent(roundIndex - 1, winners[roundIndex - 1], winning);
    }


    function claimWinning() public returns (bool) {
        uint amount = winnings[msg.sender];

        if (amount > 0) {
            // player claims winning
            winnings[msg.sender] = 0;
            if (!msg.sender.send(amount)) {
                // reset amount if failed to send
                winnings[msg.sender] = amount;
                return false;
            }

            // register player initiated claim
            if (isLogging) {
              ClaimData storage claimData = claimHistory[claimIndex];
              claimData.claimIndex = claimIndex;
              claimData.amount = amount;
              claimData.winner = msg.sender;
            }
            claimIndex++;

            // emit claim event
            emit ClaimEvent(claimIndex, amount, msg.sender);

            return true;
        }

        return false;
    }


    function getWinning() view public returns (uint) {
      return winnings[msg.sender];
    }


    function donateWinning(uint percentageToDonate) public returns (bool) {
        uint winning = winnings[msg.sender];

        if (winning > 0) {
            // player donates a percentage of winning to charity
            uint donation = uint(winning * percentageToDonate / 100);
            uint amount = donation - winning;
            winnings[msg.sender] = winning - donation;
            donationPool += donation;

            // register player initiated donation
            if (isLogging) {
              DonationData storage donationData = donationHistory[donationIndex];
              donationData.donationIndex = donationIndex;
              donationData.amount = amount;
              donationData.player = msg.sender;
            }

            // emit donation event
            emit DonationEvent(donationIndex, amount, msg.sender);

            return true;
        }

        return false;
    }


    // fallback to prevent lost ether
    function() public payable {
    }


    // option for contract owner to terminate the contract
    // and receive remaining ether on the contract
    function kill() public {
      if (msg.sender == owner) {
        selfdestruct(owner);
      }
    }
}
