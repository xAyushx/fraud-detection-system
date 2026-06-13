// engine/FastQueue.js

class FastQueue {
    constructor() {
        this.items = {};
        this.headIndex = 0;
        this.tailIndex = 0;
    }

    // Add a new transaction payload to the back of the queue (O(1))
    enqueue(item) {
        this.items[this.tailIndex] = item;
        this.tailIndex++;
    }

    // Remove and return the oldest transaction from the front of the queue (O(1))
    dequeue() {
        if (this.isEmpty()) return null;
        const item = this.items[this.headIndex];
        delete this.items[this.headIndex];
        this.headIndex++;
        return item;
    }

    // Look at the oldest item in the window without removing it (O(1))
    peekFront() {
        if (this.isEmpty()) return null;
        return this.items[this.headIndex];
    }

    // Look at the most recent item added to the queue (O(1))
    peekBack() {
        if (this.isEmpty()) return null;
        return this.items[this.tailIndex - 1];
    }

    // Helper to check if the queue window is empty
    isEmpty() {
        return this.tailIndex === this.headIndex;
    }

    // Get the exact number of active elements inside the window
    get size() {
        return this.tailIndex - this.headIndex;
    }
}
export { FastQueue };