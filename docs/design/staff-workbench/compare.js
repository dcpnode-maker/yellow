(function runOfflineComparator() {
  "use strict";

  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const MAX_PIXELS = 8_500_000;
  const sourceInput = document.querySelector("#source-file");
  const currentInput = document.querySelector("#current-file");
  const sourceMeta = document.querySelector("#source-meta");
  const currentMeta = document.querySelector("#current-meta");
  const sourceCanvas = document.querySelector("#source-canvas");
  const currentCanvas = document.querySelector("#current-canvas");
  const overlaySource = document.querySelector("#overlay-source");
  const overlayCurrent = document.querySelector("#overlay-current");
  const differenceCanvas = document.querySelector("#difference-canvas");
  const overlayFrame = document.querySelector("#overlay-frame");
  const inspection = document.querySelector("#inspection");
  const status = document.querySelector("#status");
  const changedCount = document.querySelector("#changed-count");
  const changedPercent = document.querySelector("#changed-percent");
  const totalCount = document.querySelector("#total-count");
  const alphaCount = document.querySelector("#alpha-count");
  const channelDetail = document.querySelector("#channel-detail");
  const opacity = document.querySelector("#overlay-opacity");
  const opacityValue = document.querySelector("#opacity-value");
  const clearButton = document.querySelector("#clear");
  const number = new Intl.NumberFormat();
  const state = { source: null, current: null, sourceLoad: 0, currentLoad: 0 };

  function setStatus(kind, message) {
    status.className = `status ${kind}`;
    status.textContent = message;
  }

  function clearCanvas(canvas) {
    canvas.width = 0;
    canvas.height = 0;
    canvas.closest(".canvas-frame")?.classList.remove("has-image");
  }

  function drawImageData(canvas, image) {
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("This browser could not create a comparison canvas.");
    context.putImageData(
      new ImageData(image.data, image.width, image.height),
      0,
      0,
    );
    canvas.closest(".canvas-frame")?.classList.add("has-image");
  }

  function clearResult(message = "Choose both images. No result yet.") {
    setStatus("waiting", message);
    changedCount.textContent = "—";
    changedPercent.textContent = "—";
    totalCount.textContent = "—";
    alphaCount.textContent = "—";
    channelDetail.textContent = "RGBA channel counts will appear after a valid comparison.";
    inspection.hidden = true;
    for (const canvas of [overlaySource, overlayCurrent, differenceCanvas]) clearCanvas(canvas);
  }

  function fileSize(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  }

  async function decodeFile(file) {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`File is ${fileSize(file.size)}; maximum is 20 MiB.`);
    }
    if (file.type && !file.type.startsWith("image/")) {
      throw new Error("The selected file is not identified as an image.");
    }
    if (file.type === "image/svg+xml" || /\.svgz?$/i.test(file.name)) {
      throw new Error("SVG files are not accepted. Choose a decoded raster screenshot such as PNG.");
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    try {
      image.src = objectUrl;
      await image.decode();
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (!width || !height) throw new Error("The image has no decodable dimensions.");
      if (width * height > MAX_PIXELS) {
        throw new Error(`Decoded size is ${number.format(width * height)} pixels; maximum is ${number.format(MAX_PIXELS)}.`);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
      if (!context) throw new Error("This browser could not create a comparison canvas.");
      context.drawImage(image, 0, 0);
      return { width, height, data: context.getImageData(0, 0, width, height).data };
    } catch (error) {
      if (error instanceof Error && /maximum|comparison canvas|no decodable/.test(error.message)) throw error;
      throw new Error("The browser could not decode this image. Choose a supported, readable local image file.");
    } finally {
      image.src = "";
      URL.revokeObjectURL(objectUrl);
    }
  }

  function compare() {
    if (!state.source || !state.current) {
      clearResult("Choose both images. No result yet.");
      return;
    }

    const result = window.YellowPixelCompare.compareRgba(state.source.image, state.current.image);
    if (!result.comparable) {
      clearResult();
      setStatus(
        "fail",
        `Dimension mismatch: source ${result.sourceWidth}×${result.sourceHeight}; current ${result.currentWidth}×${result.currentHeight}. No comparison or pass result.`,
      );
      return;
    }

    changedCount.textContent = `${number.format(result.changedPixels)} / ${number.format(result.totalPixels)}`;
    changedPercent.textContent = `${result.changedPercent.toFixed(8)}%`;
    totalCount.textContent = number.format(result.totalPixels);
    alphaCount.textContent = number.format(result.channelDifferences.alpha);
    channelDetail.textContent = `Differing channel positions — R ${number.format(result.channelDifferences.red)}, G ${number.format(result.channelDifferences.green)}, B ${number.format(result.channelDifferences.blue)}, A ${number.format(result.channelDifferences.alpha)}. Alpha-only changed pixels: ${number.format(result.alphaOnlyPixels)}.`;
    setStatus(
      result.equal ? "pass" : "fail",
      result.equal
        ? "Exact decoded-pixel match for these two supplied artifacts."
        : `${number.format(result.changedPixels)} decoded pixel${result.changedPixels === 1 ? "" : "s"} differ.`,
    );

    drawImageData(overlaySource, state.source.image);
    drawImageData(overlayCurrent, state.current.image);
    drawImageData(differenceCanvas, {
      width: result.width,
      height: result.height,
      data: result.differenceData,
    });
    overlayFrame.style.aspectRatio = `${result.width} / ${result.height}`;
    inspection.hidden = false;
  }

  async function selectFile(kind, file) {
    const input = kind === "source" ? sourceInput : currentInput;
    const meta = kind === "source" ? sourceMeta : currentMeta;
    const canvas = kind === "source" ? sourceCanvas : currentCanvas;
    const loadKey = kind === "source" ? "sourceLoad" : "currentLoad";
    const token = state[loadKey] + 1;
    state[loadKey] = token;
    state[kind] = null;
    clearCanvas(canvas);
    meta.classList.remove("error");

    if (!file) {
      meta.textContent = kind === "source" ? "No source selected" : "No implementation selected";
      compare();
      return;
    }

    meta.textContent = `Reading ${file.name}…`;
    clearResult("Reading selected image…");
    try {
      const image = await decodeFile(file);
      if (state[loadKey] !== token) return;
      state[kind] = { file, image };
      meta.textContent = `${file.name} · ${image.width}×${image.height} · ${fileSize(file.size)}`;
      drawImageData(canvas, image);
      compare();
    } catch (error) {
      if (state[loadKey] !== token) return;
      state[kind] = null;
      input.value = "";
      meta.textContent = error instanceof Error ? error.message : "The selected image could not be read.";
      meta.classList.add("error");
      clearResult("Image unreadable. No result.");
    }
  }

  sourceInput.addEventListener("change", () => selectFile("source", sourceInput.files?.[0]));
  currentInput.addEventListener("change", () => selectFile("current", currentInput.files?.[0]));
  opacity.addEventListener("input", () => {
    overlayCurrent.style.opacity = String(Number(opacity.value) / 100);
    opacityValue.textContent = `${opacity.value}%`;
  });
  clearButton.addEventListener("click", () => {
    state.sourceLoad += 1;
    state.currentLoad += 1;
    state.source = null;
    state.current = null;
    sourceInput.value = "";
    currentInput.value = "";
    sourceMeta.textContent = "No source selected";
    currentMeta.textContent = "No implementation selected";
    sourceMeta.classList.remove("error");
    currentMeta.classList.remove("error");
    clearCanvas(sourceCanvas);
    clearCanvas(currentCanvas);
    clearResult();
    sourceInput.focus();
  });

  overlayCurrent.style.opacity = "0.5";
}());
