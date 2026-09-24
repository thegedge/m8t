import { scalarCompare, TypeOrders } from "./scalarCompare.js";

/**
 * Check if two values are equal.
 *
 * **Scalars**
 *
 * Scalar values are compared using the `<` operator. Scalars include:
 *
 *   1. `string`
 *   2. `number`
 *   3. `bigint`
 *   4. `symbol`
 *   5. `boolean`
 *   6. `null`
 *   7. `undefined`
 *   8. `object` that implements the `Symbol.toPrimitive` method
 *
 * **Objects**
 *
 * If we have two objects, `A` and `B`, then `A < B` if either:
 *
 *   1. `A` has fewer keys than `B`; or
 *   2. `A` has the same number of keys as `B`, but the first key with a different value compares less
 *      than the corresponding value in B, when the keys are compared in alphabetical order.
 *
 * If `A` and `B` have the exact same keys and all values compare equal, then `A = B`. Otherwise, `A > B`.
 *
 * **Arrays**
 *
 * If we have two arrays, `A` and `B`, then `A < B` if either:
 *
 *   1. `A` has fewer elements than `B`; or
 *   2. `A` has the same number of elements as `B`, but the first element with a different value compares less
 *      than the corresponding element in `B`.
 *
 * If `A` and `B` have the exact same elements and all elements compare equal, then `A = B`. Otherwise, `A > B`.
 *
 * **Different Types**
 *
 * When two different types are compared, the ordering is `scalar < array < object < function`.
 *
 * @returns a negative number if `a < b`, a positive number if `a > b`, and 0 if `a = b`.
 */
export const deepCompare = (a: unknown, b: unknown): number => {
  return deepCompareWithCycleDetection(a, b);
};

type SomeKey = string | symbol;
type SomeObject = Record<SomeKey, unknown>;

const deepCompareWithCycleDetection = (
  a: unknown,
  b: unknown,
  visited = new WeakSet<any>(),
): number => {
  if (a === b) {
    return 0;
  }

  const typeA = valueType(a);
  const typeB = valueType(b);
  if (typeA !== typeB) {
    return TypeOrders[typeA] - TypeOrders[typeB];
  }

  switch (typeA) {
    case "array":
      return arrayCompare(a as unknown[], b as unknown[], visited);
    case "object":
      return objectCompare(a as SomeObject, b as SomeObject, visited);
    default:
      return scalarCompare(a, b);
  }
};

const arrayCompare = (a: unknown[], b: unknown[], visited: WeakSet<any>) => {
  const lengthA = a.length;
  const lengthB = b.length;
  if (lengthA !== lengthB) {
    return lengthA - lengthB;
  }

  if (visited.has(a)) {
    return -1;
  }
  visited.add(a);

  try {
    for (let index = 0; index < lengthA; index++) {
      const comparison = deepCompareWithCycleDetection(a[index], b[index], visited);
      if (comparison !== 0) {
        return comparison;
      }
    }
  } finally {
    visited.delete(a);
  }

  return 0;
};

const valueType = (v: unknown): keyof typeof TypeOrders => {
  const t = typeof v;
  switch (t) {
    case "object":
      if (v === null) {
        return "null";
      }

      return Array.isArray(v) ? "array" : "object";
    default:
      return t;
  }
};

const objectCompare = (a: SomeObject, b: SomeObject, visited: WeakSet<any>) => {
  if (visited.has(a)) {
    return -1;
  }
  visited.add(a);

  try {
    const keysA = Reflect.ownKeys(a);
    const keysB = Reflect.ownKeys(b);
    const lengthA = keysA.length;
    const lengthB = keysB.length;
    if (lengthA !== lengthB) {
      return lengthA - lengthB;
    }

    const sortedKeysA = keysA.sort(keyCompare);
    const sortedKeysB = keysB.sort(keyCompare);

    for (let index = 0; index < sortedKeysA.length; ++index) {
      const keyA = sortedKeysA[index];
      const keyB = sortedKeysB[index];
      const keyCmp = keyCompare(keyA, keyB);
      if (keyCmp !== 0) {
        return keyCmp;
      }

      const comparison = deepCompareWithCycleDetection(a[keyA], b[keyB], visited);
      if (comparison !== 0) {
        return comparison;
      }
    }
  } finally {
    visited.delete(a);
  }

  return 0;
};

const keyCompare = (a: SomeKey, b: SomeKey) => a.toString().localeCompare(b.toString());
