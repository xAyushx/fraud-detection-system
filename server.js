import express from "express";
import { FastQueue } from "./engine/FastQueue.js";
import { SlidingWindowEngine } from "./engine/SlidingWindowEngine.js";
import { GraphEngine } from "./engine/GraphEngine.js";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const dashboardClients = [];

app.get("/stream", (req, res) => {
    res.setHeader("Content-Type",  "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection",    "keep-alive");
    res.flushHeaders();

    for (const alert of alertLog.slice(0, 20).reverse()) {
        res.write("data: " + JSON.stringify({ type: "HISTORY", ...alert }) + "\n\n");
    }

    dashboardClients.push(res);
    req.on("close", () => {
        const i = dashboardClients.indexOf(res);
        if (i !== -1) dashboardClients.splice(i, 1);
    });
});

function broadcast(payload) {
    const msg = "data: " + JSON.stringify(payload) + "\n\n";
    for (let i = dashboardClients.length - 1; i >= 0; i--) {
        try { dashboardClients[i].write(msg); }
        catch { dashboardClients.splice(i, 1); }
    }
}

const inMemoryDb    = new Map();
const alertLog      = [];
const engineStats   = {
    startTime:     Date.now(),
    totalReceived: 0,
    totalFlagged:  0,
    totalBlocked:  0,
    totalReview:   0,
    ruleHits: {
        HIGH_VELOCITY:      0,
        IMPOSSIBLE_TRAVEL:  0,
        LAUNDERING_CYCLE:   0
    }
};

const windowDetector = new SlidingWindowEngine();
const graphDetector  = new GraphEngine();

app.post("/transaction", (req, res) => {
    const tx = req.body;

    if (!tx.accountId || tx.amount == null || !tx.timestamp) {
        return res.status(400).json({ error: "accountId, amount, timestamp are required" });
    }

    engineStats.totalReceived++;

    let totalScore    = 0;
    const violations  = [];

    if (!inMemoryDb.has(tx.accountId)) {
        inMemoryDb.set(tx.accountId, new FastQueue());
    }
    const historyQueue = inMemoryDb.get(tx.accountId);
    const windowFlags  = windowDetector.analyze(tx, historyQueue);

    for (const flag of windowFlags) {
        violations.push(flag);
        if (flag.includes("HIGH_VELOCITY"))     { totalScore += 50; engineStats.ruleHits.HIGH_VELOCITY++; }
        if (flag.includes("IMPOSSIBLE_TRAVEL")) { totalScore += 60; engineStats.ruleHits.IMPOSSIBLE_TRAVEL++; }
    }

    if (tx.toAccountId) {
        const hasCycle = graphDetector.processTransaction(tx.accountId, tx.toAccountId, tx.timestamp);
        if (hasCycle) {
            violations.push("LAUNDERING_CYCLE (" + tx.accountId + " -> ... -> " + tx.accountId + ")");
            totalScore += 100;
            engineStats.ruleHits.LAUNDERING_CYCLE++;
        }
    }

    let verdict = "ALLOW";
    if      (totalScore >= 100) verdict = "BLOCK";
    else if (totalScore >= 50)  verdict = "REVIEW";

    if (verdict !== "ALLOW") {
        engineStats.totalFlagged++;
        if (verdict === "BLOCK")  engineStats.totalBlocked++;
        if (verdict === "REVIEW") engineStats.totalReview++;

        const alert = {
            type:       "ALERT",
            txId:       tx.txId || "tx_" + Date.now(),
            accountId:  tx.accountId,
            amount:     tx.amount,
            city:       tx.city        || "Unknown",
            toAccountId:tx.toAccountId || null,
            verdict,
            score:      totalScore,
            flags:      violations,
            timestamp:  tx.timestamp,
            detectedAt: Date.now()
        };

        alertLog.unshift(alert);
        if (alertLog.length > 200) alertLog.pop();

        broadcast(alert);

        if (verdict === "BLOCK") {
            console.log("BLOCK | score:" + totalScore + " | " + tx.accountId + " | [" + violations.join(", ") + "]");
        } else {
            console.log("REVIEW | score:" + totalScore + " | " + tx.accountId + " | [" + violations.join(", ") + "]");
        }
    }

    res.status(200).json({ verdict, score: totalScore, flags: violations });
});

app.get("/alerts", (req, res) => {
    const limit   = Math.min(parseInt(req.query.limit) || 50, 200);
    const verdict = req.query.verdict?.toUpperCase();
    let data      = alertLog.slice(0, limit);
    if (verdict) data = data.filter(a => a.verdict === verdict);
    res.json({ count: data.length, alerts: data });
});

app.get("/stats", (req, res) => {
    const upSec = Math.floor((Date.now() - engineStats.startTime) / 1000);
    res.json({
        ...engineStats,
        uptime:   Math.floor(upSec / 60) + "m " + (upSec % 60) + "s",
        flagRate: engineStats.totalReceived
            ? ((engineStats.totalFlagged / engineStats.totalReceived) * 100).toFixed(1) + "%"
            : "0%",
        connectedClients: dashboardClients.length,
        trackedAccounts:  inMemoryDb.size
    });
});

app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Fraud Engine running on port " + PORT);
});