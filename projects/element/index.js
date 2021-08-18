const sdk = require('../../sdk');
const abi = require('./abi.json');
const _ = require('underscore')
const bn = require('bignumber.js')

const trancheFactory = '0x62F161BF3692E4015BefB05A03a94A40f520d1c0';
const wpFactory = '0x8E9aa87E45e92bad84D5F8DD1bff34Fb92637dE9';
const ccpFactory = '0xb7561f547F3207eDb42A6AfA42170Cd47ADD17BD';
const balVault = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'


const wps = [
    '0xD5D7bc115B32ad1449C6D0083E43C87be95F2809',
    '0xDe620bb8BE43ee54d7aa73f8E99A7409Fe511084',
    '0x67F8FCb9D3c463da05DE1392EfDbB2A87F8599Ea',
    '0xF94A7Df264A2ec8bCEef2cFE54d7cA3f6C6DFC7a',
    '0xE54B3F5c444a801e61BECDCa93e74CdC1C4C1F90',
    '0x2D6e3515C8b47192Ca3913770fa741d3C4Dac354',
    '0xd16847480D6bc218048CD31Ad98b63CC34e5c2bF'
]

async function tvl(timestamp, block) {
    let balances = {};

    // tranche tvl

    let tranches = [];

  let trancheLogs = (await sdk.api.util
    .getLogs({
      keys: [],
      toBlock: block,
      target: trancheFactory,
      fromBlock: 12685768,
      topic: 'TrancheCreated(address,address,uint256)',
    })).output;

    for (let log of trancheLogs) {
        if (block < log.blockNumber) continue;
        let tranche = `0x${log.topics[1].substr(-40)}`
        tranches.push(tranche.toLowerCase());
        let underlying = (await sdk.api.abi.call({
            block,
            target: tranche,
            abi: abi['underlying']
        })).output;
        let valueSupplied = (await sdk.api.abi.call({
            block,
            target: tranche,
            abi: abi['valueSupplied']
        })).output;
        balances[underlying.toLowerCase()] = balances[underlying.toLowerCase()] ? new bn(balances[underlying.toLowerCase()]).plus(valueSupplied) : valueSupplied
    }

    // wp tvl

    for (let wp of wps) {
        try {
            let poolId = (await sdk.api.abi.call({
                block,
                target: wp,
                abi: abi['getPoolId'],
            })).output;
    
            let poolTokens = (await sdk.api.abi.call({
                block,
                target: balVault,
                abi: abi['getPoolTokens'],
                params: poolId
            })).output;
            
            for (let i = 0; i < poolTokens.tokens.length; i++) {
                let token = poolTokens.tokens[i];
                let tranche;
                try {
                    tranche = (await sdk.api.abi.call({
                        block,
                        target: token,
                        abi: abi['tranche']
                    })).output;
                } catch (e) {
                }
                if (tranche && tranches.indexOf(tranche.toLowerCase()) >= 0) {
                    continue;
                }
                
                balances[token.toLowerCase()] = balances[token.toLowerCase()] ? new bn(balances[token.toLowerCase()]).plus(poolTokens.balances[i]) : poolTokens.balances[i];
            }
        } catch (e) {
            console.log(e)
        }
    }


    // // // cc tvl

    let ccLogs = (await sdk.api.util
        .getLogs({
          keys: [],
          toBlock: block,
          target: ccpFactory,
          fromBlock: 12686198,
          topic: 'PoolCreated(address)',
        })).output;
        
    for (let log of ccLogs) {
        if (block < log.blockNumber) continue;
        let cc = `0x${log.topics[1].substr(-40)}`;
        let poolId = (await sdk.api.abi.call({
            block,
            target: cc,
            abi: abi['getPoolId'],
        })).output;

        let poolTokens = (await sdk.api.abi.call({
            block,
            target: balVault,
            abi: abi['getPoolTokens'],
            params: poolId
        })).output;

        for (let i = 0; i < poolTokens.tokens.length; i++) {
            let token = poolTokens.tokens[i];
            if (tranches.indexOf(token.toLowerCase()) >= 0) {
                continue;
            }
            
            balances[token.toLowerCase()] = balances[token.toLowerCase()] ? new bn(balances[token.toLowerCase()]).plus(poolTokens.balances[i]) : poolTokens.balances[i];
        }
    }

    if (_.isEmpty(balances)) {
        balances = {
          '0x0000000000000000000000000000000000000000': 0,
        };
      }

    return (await sdk.api.util.toSymbols(balances)).output;
}



module.exports = {
  name: 'Element Finance',               // project name
  token: null,
  category: 'Lending',          // Lending
  start: 1624388593,            // 
  tvl,                           // tvl adapter
  contributesTo: ['Curve, yearn']
}
