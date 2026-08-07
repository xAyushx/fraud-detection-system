import autocannon from 'autocannon';

const result = await autocannon({
  url: 'http://localhost:3000/transaction',
  connections: 10,
  duration: 15,
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    txId: 'a1',
    accountId: 'acc1',
    amount: 100,
    city: 'Delhi',
    timestamp: 1700000000000
  })
});

console.log(autocannon.printResult(result));
console.log('2xx:', result['2xx'], '| non-2xx:', result.non2xx, '| errors:', result.errors);