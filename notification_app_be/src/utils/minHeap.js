/**
 * Min-Heap Implementation for Top-K Priority Notifications
 * 
 * Space Complexity: O(K) where K is the max capacity (e.g., 10)
 * Time Complexity: O(log K) for insertions
 */
class MinHeap {
  constructor(capacity) {
    this.capacity = capacity;
    this.heap = [];
  }

  // Helper to get parent and children indices
  getLeftChildIndex(parentIndex) { return 2 * parentIndex + 1; }
  getRightChildIndex(parentIndex) { return 2 * parentIndex + 2; }
  getParentIndex(childIndex) { return Math.floor((childIndex - 1) / 2); }

  hasLeftChild(index) { return this.getLeftChildIndex(index) < this.heap.length; }
  hasRightChild(index) { return this.getRightChildIndex(index) < this.heap.length; }
  hasParent(index) { return this.getParentIndex(index) >= 0; }

  leftChild(index) { return this.heap[this.getLeftChildIndex(index)]; }
  rightChild(index) { return this.heap[this.getRightChildIndex(index)]; }
  parent(index) { return this.heap[this.getParentIndex(index)]; }

  swap(indexOne, indexTwo) {
    const temp = this.heap[indexOne];
    this.heap[indexOne] = this.heap[indexTwo];
    this.heap[indexTwo] = temp;
  }

  peek() {
    if (this.heap.length === 0) return null;
    return this.heap[0];
  }

  /**
   * Adds a new item to the heap. If the heap is full, it compares
   * with the root (minimum element). If the new item has a higher
   * score, it replaces the root and re-balances.
   * 
   * @param {Object} item { score: Number, ...data }
   */
  push(item) {
    if (this.heap.length < this.capacity) {
      this.heap.push(item);
      this.heapifyUp();
    } else if (item.score > this.peek().score) {
      // New item has higher priority than the lowest item in the Top-K list
      this.heap[0] = item;
      this.heapifyDown();
    }
  }

  heapifyUp() {
    let index = this.heap.length - 1;
    while (this.hasParent(index) && this.parent(index).score > this.heap[index].score) {
      this.swap(this.getParentIndex(index), index);
      index = this.getParentIndex(index);
    }
  }

  heapifyDown() {
    let index = 0;
    while (this.hasLeftChild(index)) {
      let smallerChildIndex = this.getLeftChildIndex(index);
      
      if (this.hasRightChild(index) && this.rightChild(index).score < this.leftChild(index).score) {
        smallerChildIndex = this.getRightChildIndex(index);
      }

      if (this.heap[index].score < this.heap[smallerChildIndex].score) {
        break;
      } else {
        this.swap(index, smallerChildIndex);
      }
      index = smallerChildIndex;
    }
  }

  // Returns sorted descending priority
  getSortedArray() {
    return [...this.heap].sort((a, b) => b.score - a.score);
  }
}

module.exports = MinHeap;
