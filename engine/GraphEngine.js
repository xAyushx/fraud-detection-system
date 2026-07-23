import { FastQueue } from './FastQueue.js';

class GraphEngine {
    constructor({ ttlMs = 30000, maxSearchDepth = 50 } = {}) {
        this.adjList = new Map();
        this.edgeTimestamps = new Map();
        this.edgeInsertionOrder = new FastQueue();

        this.TTL_MS = ttlMs;
        this.MAX_SEARCH_DEPTH = maxSearchDepth;
    }
    processTransaction(from, to, timestamp) {
        if (!to) return false;

        this.cleanupStaleEdges(timestamp);

        const wouldCreateCycle = this.canReach(to, from, this.MAX_SEARCH_DEPTH);

        if (wouldCreateCycle) {
            return true;
        }

        if (!this.adjList.has(from)) {
            this.adjList.set(from, new Set());
        }
        this.adjList.get(from).add(to);

        const edgeKey = `${from}->${to}`;
        this.edgeTimestamps.set(edgeKey, timestamp);
        this.edgeInsertionOrder.enqueue({ edgeKey, timestamp });

        return false;
    }

    canReach(startNode, target, maxDepth) {
        if (startNode === target) return true;

        const visited = new Set([startNode]);
        const stack = [[startNode, 0]];

        while (stack.length > 0) {
            const [node, depth] = stack.pop();

            if (depth >= maxDepth) continue;

            const neighbors = this.adjList.get(node);
            if (!neighbors) continue;

            for (const neighbor of neighbors) {
                if (neighbor === target) return true;
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    stack.push([neighbor, depth + 1]);
                }
            }
        }

        return false;
    }
    cleanupStaleEdges(currentTimestamp) {
        const cutoff = currentTimestamp - this.TTL_MS;

        while (this.edgeInsertionOrder.size > 0) {
            const oldest = this.edgeInsertionOrder.peekFront();

            if (oldest.timestamp >= cutoff) break;

            this.edgeInsertionOrder.dequeue();

            const currentTsForKey = this.edgeTimestamps.get(oldest.edgeKey);
            if (currentTsForKey !== oldest.timestamp) continue;

            const [from, to] = oldest.edgeKey.split('->');
            if (this.adjList.has(from)) {
                this.adjList.get(from).delete(to);
                if (this.adjList.get(from).size === 0) {
                    this.adjList.delete(from);
                }
            }
            this.edgeTimestamps.delete(oldest.edgeKey);
        }
    }
}

export { GraphEngine };