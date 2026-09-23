import { describe, expect, test } from "vitest";

import {
  Datum,
  symProcessedBy,
  symProcessingTimeNs,
  type DatumShape,
} from "../../src/pipeline/Datum.js";

const makeData = () => ({
  basePath: "/",
  filename: "a.txt",
  title: "a",
});

describe("Datum", () => {
  describe("constructor", () => {
    test("shallow copies the data so later mutation of the argument does not leak in", () => {
      const data = makeData();
      const datum = new Datum(data);

      data.title = "changed";

      expect(datum.get("title")).toBe("a");
    });

    test("shallow copies the lineage so later mutation of the argument does not leak in", () => {
      const priorState = makeData();
      const lineage = [priorState];
      const datum = new Datum(makeData(), lineage);

      lineage.push(makeData());

      expect(datum.lineage).toHaveLength(1);
    });

    test("defaults to an empty lineage", () => {
      const datum = new Datum(makeData());

      expect(datum.lineage).toEqual([]);
    });
  });

  describe("nullUnlessChanged", () => {
    test("returns the function's result when the datum changes during the call", async () => {
      const datum = new Datum(makeData());

      const result = await datum.nullUnlessChanged(async () => {
        datum.with({ title: "changed" });
        return "result";
      });

      expect(result).toBe("result");
    });

    test("returns null when the function returns this datum unchanged", async () => {
      const datum = new Datum(makeData());

      const result = await datum.nullUnlessChanged(async () => datum);

      expect(result).toBeNull();
    });

    test("returns the function's result when it returns a different value, even if unchanged", async () => {
      const datum = new Datum(makeData());

      const result = await datum.nullUnlessChanged(async () => "unrelated result");

      expect(result).toBe("unrelated result");
    });
  });

  describe("branch", () => {
    test("returns a new datum with the merged data", () => {
      const datum = new Datum(makeData());

      const branched = datum.branch({ title: "branched" });

      expect(branched.get("title")).toBe("branched");
      expect(branched.get("filename")).toBe("a.txt");
    });

    test("does not modify the original datum", () => {
      const datum = new Datum(makeData());

      datum.branch({ title: "branched" });

      expect(datum.get("title")).toBe("a");
    });

    test("appends the parent's data to the child's lineage", () => {
      const datum = new Datum(makeData());

      const branched = datum.branch({ title: "branched" });

      expect(branched.lineage).toEqual([makeData()]);
    });

    test("deep-merges nested objects", () => {
      const datum = new Datum<DatumShape>({ ...makeData(), nested: { a: 1, b: 2 } });

      const branched = datum.branch({ nested: { b: 3, c: 4 } });

      expect(branched.get("nested")).toEqual({ a: 1, b: 3, c: 4 });
    });

    test("concatenates arrays", () => {
      const datum = new Datum<DatumShape>({ ...makeData(), tags: ["a", "b"] });

      const branched = datum.branch({ tags: ["c"] });

      expect(branched.get("tags")).toEqual(["a", "b", "c"]);
    });
  });

  describe("with", () => {
    test("merges the given data into the datum and returns itself", () => {
      const datum = new Datum(makeData());

      const result = datum.with({ title: "updated" });

      expect(result).toBe(datum);
      expect(datum.get("title")).toBe("updated");
    });

    test("pushes the previous data onto the lineage", () => {
      const datum = new Datum(makeData());

      datum.with({ title: "updated" });

      expect(datum.lineage).toEqual([makeData()]);
    });

    test("deep-merges nested objects", () => {
      const datum = new Datum<DatumShape>({ ...makeData(), nested: { a: 1, b: 2 } });

      datum.with({ nested: { b: 3, c: 4 } });

      expect(datum.get("nested")).toEqual({ a: 1, b: 3, c: 4 });
    });

    test("concatenates arrays", () => {
      const datum = new Datum<DatumShape>({ ...makeData(), tags: ["a", "b"] });

      datum.with({ tags: ["c"] });

      expect(datum.get("tags")).toEqual(["a", "b", "c"]);
    });

    test("supports symbol keys", () => {
      const datum = new Datum<DatumShape>(makeData());

      datum.with({ [symProcessedBy]: "processorA" });

      expect(datum.get(symProcessedBy)).toBe("processorA");
    });

    test("marks the datum as changed for nullUnlessChanged", async () => {
      const datum = new Datum(makeData());

      const result = await datum.nullUnlessChanged(async () => {
        datum.with({ title: "changed" });
        return datum;
      });

      expect(result).toBe(datum);
    });
  });

  describe("set", () => {
    test("replaces the datum's data and returns itself", () => {
      const datum = new Datum<DatumShape>(makeData());

      const result = datum.set({ basePath: "/other", filename: "b.txt" });

      expect(result).toBe(datum);
      expect(datum.get("filename")).toBe("b.txt");
    });

    test("drops keys that were not present in the new data", () => {
      const datum = new Datum<DatumShape>(makeData());

      datum.set({ basePath: "/other", filename: "b.txt" });

      expect(datum.has("title")).toBe(false);
    });

    test("pushes the previous data onto the lineage", () => {
      const datum = new Datum<DatumShape>(makeData());

      datum.set({ basePath: "/other", filename: "b.txt" });

      expect(datum.lineage).toEqual([makeData()]);
    });

    test("does not store the caller's object by reference", () => {
      const datum = new Datum<DatumShape>(makeData());
      const newData = { basePath: "/other", filename: "b.txt" };

      datum.set(newData);
      newData.filename = "mutated.txt";

      expect(datum.get("filename")).toBe("b.txt");
    });
  });

  describe("delete", () => {
    test("returns itself", () => {
      const datum = new Datum(makeData());

      const result = datum.delete("title");

      expect(result).toBe(datum);
    });

    test("pushes the previous data onto the lineage", () => {
      const datum = new Datum(makeData());

      datum.delete("title");

      expect(datum.lineage).toEqual([makeData()]);
    });

    test("removes the key", () => {
      // i.e., doesn't just set it to null/undefined/etc
      const datum = new Datum(makeData());

      datum.delete("title");

      expect(datum.has("title")).toBe(false);
      expect(Object.keys(datum.toRecord())).not.toContain("title");
    });
  });

  describe("get", () => {
    test("returns the value for a present key", () => {
      const datum = new Datum(makeData());

      expect(datum.get("title")).toBe("a");
    });

    test("returns undefined for a missing key", () => {
      const datum = new Datum<DatumShape>(makeData());

      expect(datum.get("url")).toBeUndefined();
    });

    test("supports symbol keys", () => {
      const datum = new Datum({ ...makeData(), [symProcessingTimeNs]: 5n });

      expect(datum.get(symProcessingTimeNs)).toBe(5n);
    });
  });

  describe("maybeGetString", () => {
    test("returns the value when it is a string", () => {
      const datum = new Datum(makeData());

      expect(datum.maybeGetString("title")).toBe("a");
    });

    test("returns undefined when the value is not a string", () => {
      const datum = new Datum({ ...makeData(), [symProcessingTimeNs]: 5n });

      expect(datum.maybeGetString(symProcessingTimeNs)).toBeUndefined();
    });

    test("returns undefined when the key is missing", () => {
      const datum = new Datum<DatumShape>(makeData());

      expect(datum.maybeGetString("url")).toBeUndefined();
    });
  });

  describe("stringOrThrow", () => {
    test("returns the value when it is a string", () => {
      const datum = new Datum(makeData());

      expect(datum.stringOrThrow("title")).toBe("a");
    });

    test("throws when the value is missing", () => {
      const datum = new Datum(makeData());

      expect(() => datum.stringOrThrow("url")).toThrow();
    });

    test("throws when the value is not a string", () => {
      const datum = new Datum({ ...makeData(), [symProcessingTimeNs]: 5n });
      expect(() => datum.stringOrThrow(symProcessingTimeNs)).toThrow();
    });
  });

  describe("has", () => {
    test("returns true for a present key", () => {
      const datum = new Datum(makeData());

      expect(datum.has("title")).toBe(true);
    });

    test("returns false for a missing key", () => {
      const datum = new Datum<DatumShape>(makeData());

      expect(datum.has("url")).toBe(false);
    });

    test("returns true for a present symbol key", () => {
      const datum = new Datum({ ...makeData(), [symProcessedBy]: "processorA" });

      expect(datum.has(symProcessedBy)).toBe(true);
    });
  });

  describe("lineage", () => {
    test("is empty for a freshly constructed datum", () => {
      const datum = new Datum(makeData());

      expect(datum.lineage).toEqual([]);
    });

    test("accumulates one entry per with()/set()/delete() call", () => {
      const datum = new Datum<DatumShape>(makeData());

      datum.with({ title: "b" });
      datum.set({ basePath: "/", filename: "c.txt" });
      datum.delete("basePath");

      expect(datum.lineage).toHaveLength(3);
    });

    test("mutating the returned array via push does not affect the datum's lineage", () => {
      const datum = new Datum(makeData());
      datum.with({ title: "b" });

      const lineage = datum.lineage as unknown as unknown[];
      lineage.push("intruder");

      expect(datum.lineage).toHaveLength(1);
    });

    test("mutating the returned array via splice does not affect the datum's lineage", () => {
      const datum = new Datum(makeData());
      datum.with({ title: "b" });

      const lineage = datum.lineage as unknown as unknown[];
      lineage.splice(0, 1);

      expect(datum.lineage).toHaveLength(1);
    });
  });

  describe("toRecord", () => {
    test("returns the datum's data", () => {
      const datum = new Datum(makeData());

      expect(datum.toRecord()).toEqual(makeData());
    });

    test("mutating the returned record does not alter the datum", () => {
      const datum = new Datum(makeData());

      const record = datum.toRecord() as unknown as { title: string };
      record.title = "mutated";

      expect(datum.get("title")).toBe("a");
    });
  });

  describe("toJSON", () => {
    test("returns the datum's data", () => {
      const datum = new Datum(makeData());

      expect(datum.toJSON()).toEqual(makeData());
    });

    test("is used by JSON.stringify", () => {
      const datum = new Datum(makeData());

      expect(JSON.parse(JSON.stringify(datum))).toEqual(makeData());
    });
  });

  describe("toString", () => {
    test("returns a JSON representation of the data", () => {
      const datum = new Datum(makeData());

      expect(JSON.parse(datum.toString())).toEqual(makeData());
    });

    test("does not throw for a datum carrying a bigint value", () => {
      const datum = new Datum<DatumShape>({ ...makeData(), big: 5n });

      expect(() => datum.toString()).not.toThrow();
    });
  });

  describe("nodejs.util.inspect.custom", () => {
    test("returns the same output as toString()", () => {
      const datum = new Datum(makeData());

      const inspect = (datum as unknown as Record<symbol, () => string>)[
        Symbol.for("nodejs.util.inspect.custom")
      ].bind(datum);

      expect(inspect()).toBe(datum.toString());
    });
  });
});
