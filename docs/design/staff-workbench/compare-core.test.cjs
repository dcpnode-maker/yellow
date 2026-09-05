"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { compareRgba } = require("./compare-core.js");

function image(width, height, values) {
  return { width, height, data: new Uint8ClampedArray(values) };
}

test("counts strict 2x2 RGBA changes, including alpha-only differences", () => {
  const source = image(2, 2, [
    0, 0, 0, 255,
    10, 20, 30, 255,
    40, 50, 60, 255,
    70, 80, 90, 100,
  ]);
  const current = image(2, 2, [
    0, 0, 0, 255,
    11, 20, 30, 255,
    40, 50, 60, 254,
    70, 81, 91, 101,
  ]);

  const result = compareRgba(source, current);
  assert.equal(result.comparable, true);
  assert.equal(result.equal, false);
  assert.equal(result.totalPixels, 4);
  assert.equal(result.changedPixels, 3);
  assert.equal(result.changedPercent, 75);
  assert.equal(result.alphaOnlyPixels, 1);
  assert.deepEqual(result.channelDifferences, { red: 1, green: 1, blue: 1, alpha: 2 });
  assert.deepEqual(Array.from(result.differenceData.slice(8, 12)), [237, 47, 120, 255]);
});

test("rejects comparison when decoded dimensions differ", () => {
  const result = compareRgba(
    image(2, 2, new Array(16).fill(0)),
    image(1, 2, new Array(8).fill(0)),
  );

  assert.deepEqual(result, {
    comparable: false,
    reason: "dimension-mismatch",
    sourceWidth: 2,
    sourceHeight: 2,
    currentWidth: 1,
    currentHeight: 2,
  });
});
