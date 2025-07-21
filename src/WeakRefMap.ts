// Map that allows it's items to be garbage collected
export class WeakRefMap<K, T extends WeakKey> implements Map<K, T> {
  private map: Map<K, WeakRef<T>>;

  constructor() {
    this.map = new Map();
  }

  // clear all garbage collected items
  private _cleanup() {
    this.forEach(() => {});
  }

  clear(): void {
    this.map.clear();
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  forEach(callbackfn: (value: T, key: K, map: WeakRefMap<K, T>) => void, thisArg?: any): void {
    this.map.forEach((ref, key) => {
      const value = ref.deref();
      if (value === undefined) {
        this.map.delete(key);
        return;
      }

      callbackfn.call(thisArg, value, key, this);
    });
  }

  get(key: K): T | undefined {
    const ref = this.map.get(key);
    if (!ref)
      return undefined;

    const value = ref.deref();
    if (value === undefined)
      this.map.delete(key);

    return value;
  }

  has(key: K): boolean {
    return typeof this.get(key) !== "undefined";
  }

  set(key: K, value: T): this {
    this.map.set(key, new WeakRef(value));
    return this;
  }

  get size(): number {
    this._cleanup();
    return this.map.size;
  }

  entries(): MapIterator<[K, T]> {
    this._cleanup();
    //TODO what if GC collects some items here?
    return this.map.entries()
      .map(([k,r]) => [k,r.deref()!]);
  }

  keys(): MapIterator<K> {
    this._cleanup();
    //TODO what if GC collects some items here?
    return this.map.keys();
  }

  values(): MapIterator<T> {
    this._cleanup();
    //TODO what if GC collects some items here?
    return this.map.values()
      .map((r) => r.deref()!);
  }

  [Symbol.iterator](): MapIterator<[K, T]> {
    return this.entries();
  }

  get [Symbol.toStringTag]() {
    return "WeakRefMap";
  }
}
