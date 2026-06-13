// scripts/generator.js

const ACCOUNTS = Array.from({ length: 23 }, (_, i) => `account${String(i+1).padStart(3, '0')}`);

const CITY_DATA = {
    Karnal:      { lat: 29.6857, lon: 76.9905 },
    Mumbai:      { lat: 19.0760, lon: 72.8777 },
    Delhi:       { lat: 28.6139, lon: 77.2090 },
    Gangtok:     { lat: 27.3389, lon: 88.6065 },
    Pune:        { lat: 18.5204, lon: 73.8567 },
    Bangalore:   { lat: 12.9716, lon: 77.5946 },
    London:      { lat: 51.5072, lon: -0.1276 },
    Singapore:   { lat: 1.3521, lon: 103.8198 },
    Chandigarh:  { lat: 30.7333, lon: 76.7794 },
    Bangkok:     { lat: 13.7563, lon: 100.5018 }
};

const MERCHANTS = ['Apple','Samsung','Oyo','Amazon', 'Zomato', 'Uber', 'Flipkart', 'Starbucks', 'BookMyShow'];

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomAmt = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(3));
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const generateTransId = () => `trans_id_${Date.now().toString(23)}${Math.random().toString(23).slice(2, 8)}`;

async function sendTrans(trans) {
    try {
        await fetch('http://localhost:3000/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trans)
        });
        process.stdout.write('.');
    } catch (error) {
        console.log('\n[ERROR] Server not running. Waiting for Step 2 Backend...');
        process.exit(1);
    }
}

async function injectVelocityBurst() {
    const victim = pickRandom(ACCOUNTS);
    const fixedcity = pickRandom(Object.keys(CITY_DATA)); 
    console.log(`\n INJECTING: Velocity Burst on ${victim}`);
    for (let i = 0; i < 9; i++) {
        await sendTrans({ 
            txId: generateTransId(),
            accountId: victim,
            amount: randomAmt(500, 2000),
            city: fixedcity,
            timestamp: Date.now()
        });
        await sleep(50);
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const toRad = (deg) => deg * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function getImpossibleCityPair(minDistance = 4000) {
    const cities = Object.keys(CITY_DATA);
    while (true) {
        const cityA = pickRandom(cities); 
        const cityB = pickRandom(cities);
        if (cityA === cityB) continue;

        const locA = CITY_DATA[cityA];
        const locB = CITY_DATA[cityB];
        const distance = calculateDistance(locA.lat, locA.lon, locB.lat, locB.lon);

        if (distance >= minDistance) {
            return { cityA, cityB, distance: Math.round(distance) };
        }
    }
}

async function injectImpossibleTravel() {
    const victim = pickRandom(ACCOUNTS);
    const { cityA, cityB, distance } = getImpossibleCityPair();

    console.log(`\n  INJECTING: Impossible Travel on ${victim} (${cityA} → ${cityB}, ${distance} KM)`);

    await sendTrans({ 
        txId: generateTransId(),
        accountId: victim,
        amount: randomAmt(1000, 5000),
        city: cityA,
        timestamp: Date.now()
    });

    await sleep(500);

    await sendTrans({
        txId: generateTransId(),
        accountId: victim,
        amount: randomAmt(500, 1500),
        city: cityB,
        timestamp: Date.now()
    });
}

function pickDistinctAccounts(arr, count) {
    if (arr.length < count) throw new Error("Not enough accounts in the pool");
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

async function injectLaunderingCycle() {
    // 1. Dynamically pick a random cycle length 
    const cycleLength = Math.floor(Math.random() * 19) + 3; 
    
    const chain = pickDistinctAccounts(ACCOUNTS, cycleLength);
    const cities = Object.keys(CITY_DATA);

    console.log(`\nINJECTING: Money Laundering Cycle across ${cycleLength} nodes!`);
    console.log(`   Path: ${chain.join(' → ')} → ${chain[0]}`);

    const baseAmount = randomAmt(15000, 30000);

    for (let i = 0; i < chain.length; i++) {
        const fromAcc = chain[i];
        
        const toAcc = (i === chain.length - 1) ? chain[0] : chain[i + 1];
      
        const currentAmount = parseFloat((baseAmount - (i * randomAmt(100, 300))).toFixed(3));
        
        await sendTrans({
            txId: generateTransId(),
            accountId: fromAcc,
            toAccountId: toAcc,
            amount: currentAmount,
            city: pickRandom(cities),
            timestamp: Date.now()
        });

        await sleep(100); 
    }
}

async function main() {
    console.log("Starting Txns gen:");
    let ctr = 0;
    
    setInterval(async () => {
        ctr++;
        if (ctr % 30 === 10) {
            await injectVelocityBurst();
        } 
        else if (ctr % 60 === 25) {
            await injectImpossibleTravel();
            
        }
        else if (ctr % 40 === 10) {  
            await injectLaunderingCycle();
        }
         else {
            const city = pickRandom(Object.keys(CITY_DATA));
            await sendTrans({
                txId: generateTransId(),
                accountId: pickRandom(ACCOUNTS),
                amount: randomAmt(10, 3000),
                city: city,
                merchant: pickRandom(MERCHANTS),
                timestamp: Date.now()
            });
        }
    }, 200);
}

main();