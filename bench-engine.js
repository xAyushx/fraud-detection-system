import { FastQueue } from './engine/FastQueue.js';
import { SlidingWindowEngine } from './engine/SlidingWindowEngine.js';
import { GraphEngine } from './engine/GraphEngine.js';

const CITIES = ['Karnal','Mumbai','Delhi','Gangtok','Pune','Bangalore','London','Singapore','Chandigarh','Bangkok'];
const ACCOUNTS = Array.from({ length: 23 }, (_, i) => `account${String(i+1).padStart(3,'0')}`);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const windowDetector = new SlidingWindowEngine();
const graphDetector = new GraphEngine();
const histories = new Map();

function runOne(i) {
  const accountId = pick(ACCOUNTS);
  const tx = {
    txId: 'b' + i,
    accountId,
    amount: Math.random() * 3000,
    city: pick(CITIES),
    timestamp: Date.now(),
    toAccountId: Math.random() < 0.15 ? pick(ACCOUNTS) : undefined
  };

  if (!histories.has(accountId)) histories.set(accountId, new FastQueue());
  const q = histories.get(accountId);

  const t0 = process.hrtime.bigint();
  windowDetector.analyze(tx, q);
  if (tx.toAccountId) graphDetector.processTransaction(tx.accountId, tx.toAccountId, tx.timestamp);
  const t1 = process.hrtime.bigint();

  return Number(t1 - t0) / 1e6; // ms
}

const N = 50000;
const WARMUP = 2000;

for (let i = 0; i < WARMUP; i++) runOne(i); // let JIT warm up before measuring

const times = [];
for (let i = 0; i < N; i++) times.push(runOne(i));

times.sort((a, b) => a - b);
const pct = p => times[Math.floor(times.length * p)];
const mean = times.reduce((a, b) => a + b, 0) / times.length;

console.log(`n=${N}`);
console.log(`mean:  ${mean.toFixed(4)} ms`);
console.log(`p50:   ${pct(0.50).toFixed(4)} ms`);
console.log(`p95:   ${pct(0.95).toFixed(4)} ms`);
console.log(`p99:   ${pct(0.99).toFixed(4)} ms`);
console.log(`max:   ${times[times.length-1].toFixed(4)} ms`);