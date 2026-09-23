(function exposePixelComparison(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.YellowPixelCompare = api;
}(typeof globalThis === "object" ? globalThis : this, function buildPixelComparison() {
  "use strict";

  function validateImage(image, label) {
    if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height)
      || image.width <= 0 || image.height <= 0) {
      throw new TypeError(`${label} dimensions must be positive integers`);
    }
    if (!(image.data instanceof Uint8ClampedArray)
      || image.data.length !== image.width * image.height * 4) {
      throw new TypeError(`${label} data must contain exactly four RGBA values per pixel`);
    }
  }

  function compareRgba(source, current) {
    validateImage(source, "source");
    validateImage(current, "current");

    if (source.width !== current.width || source.height !== current.height) {
      return {
        comparable: false,
        reason: "dimension-mismatch",
        sourceWidth: source.width,
        sourceHeight: source.height,
        currentWidth: current.width,
        currentHeight: current.height,
      };
    }

    const totalPixels = source.width * source.height;
    const channelDifferences = { red: 0, green: 0, blue: 0, alpha: 0 };
    const differenceData = new Uint8ClampedArray(source.data.length);
    let changedPixels = 0;
    let alphaOnlyPixels = 0;

    for (let offset = 0; offset < source.data.length; offset += 4) {
      const redChanged = source.data[offset] !== current.data[offset];
      const greenChanged = source.data[offset + 1] !== current.data[offset + 1];
      const blueChanged = source.data[offset + 2] !== current.data[offset + 2];
      const alphaChanged = source.data[offset + 3] !== current.data[offset + 3];
      const pixelChanged = redChanged || greenChanged || blueChanged || alphaChanged;

      if (redChanged) channelDifferences.red += 1;
      if (greenChanged) channelDifferences.green += 1;
      if (blueChanged) channelDifferences.blue += 1;
      if (alphaChanged) channelDifferences.alpha += 1;
      if (alphaChanged && !redChanged && !greenChanged && !blueChanged) alphaOnlyPixels += 1;

      if (pixelChanged) {
        changedPixels += 1;
        differenceData[offset] = 237;
        differenceData[offset + 1] = 47;
        differenceData[offset + 2] = 120;
        differenceData[offset + 3] = 255;
      }
    }

    return {
      comparable: true,
      equal: changedPixels === 0,
      width: source.width,
      height: source.height,
      totalPixels,
      changedPixels,
      changedPercent: changedPixels / totalPixels * 100,
      alphaOnlyPixels,
      channelDifferences,
      differenceData,
    };
  }

  return Object.freeze({ compareRgba });
}));
