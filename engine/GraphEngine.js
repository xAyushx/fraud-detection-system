class GraphEngine {
    constructor() {
      //Map<accountId, Set<recipientId>>
        this.adjList = new Map();
        
        // Track when transfers happen to clear them out later: Map<"from->to", timestamp>
        this.edgeTimestamps = new Map();
        
     
        this.TTL_MS = 30000;
    }

    processTransaction(from, to, timestamp) {
        if (!to) return false;

        this.cleanupStaleEdges(timestamp);

      
        if (!this.adjList.has(from)) {
            this.adjList.set(from, new Set());
        }
        this.adjList.get(from).add(to);
    
        this.edgeTimestamps.set(`${from}->${to}`, timestamp);

        return this.hasCycle(from);
    }

    hasCycle(startNode) {
        const visited = new Set();
        const recStack = new Set(); 
        return this.dfs(startNode, visited, recStack);
    }

    dfs(node, visited, recStack) {
        if (recStack.has(node)) return true;
        if (visited.has(node)) return false;

        visited.add(node);
        recStack.add(node);

        const neighbors = this.adjList.get(node);
        if (neighbors) {
            for (const neighbor of neighbors) {
                if (this.dfs(neighbor, visited, recStack)) {
                    return true;
                }
            }
        }

        recStack.delete(node); 
        return false;
    }

    cleanupStaleEdges(currentTimestamp) {
        const cutoff = currentTimestamp - this.TTL_MS;

        for (const [edgeKey, timestamp] of this.edgeTimestamps.entries()) {
            if (timestamp < cutoff) {
                const [from, to] = edgeKey.split('->');
                
                if (this.adjList.has(from)) {
                    this.adjList.get(from).delete(to);
                    if (this.adjList.get(from).size === 0) {
                        this.adjList.delete(from);
                    }
                }
                this.edgeTimestamps.delete(edgeKey);
            }
        }
    }
}
export { GraphEngine };