class FastQueue {
    constructor() {
        this.items = {};
        this.headIndex = 0;
        this.tailIndex = 0;
    }
    enqueue(item) {
        this.items[this.tailIndex] = item;
        this.tailIndex++;
    }
    dequeue() {
        if (this.isEmpty()) return null;
        const item = this.items[this.headIndex];
        delete this.items[this.headIndex];
        this.headIndex++;
        if (this.headIndex === this.tailIndex) {
            this.headIndex = 0;
            this.tailIndex = 0;
        }
        return item;
    }
    peekFront() {
        if (this.isEmpty()) return null;
        return this.items[this.headIndex];
    }
    peekBack() {
        if (this.isEmpty()) return null;
        return this.items[this.tailIndex - 1];
    }
    isEmpty() {
        return this.tailIndex === this.headIndex;
    }
    get size() {
        return this.tailIndex - this.headIndex;
    }
    *[Symbol.iterator]() {
        for (let i = this.headIndex; i < this.tailIndex; i++) {
            const item = this.items[i];
            if (item !== undefined) yield item;
        }
    }
    toArray() {
        return [...this];
    }
}
export { FastQueue };