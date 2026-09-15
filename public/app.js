const form = document.getElementById("generateForm");
const promptInput = document.getElementById("prompt");
const imageInput = document.getElementById("image");
const dropZone = document.getElementById("dropZone");
const fileInfo = document.getElementById("fileInfo");
const presetSize = document.getElementById("presetSize");
const sizeInput = document.getElementById("size");
const modelInput = document.getElementById("model");
const qualityInput = document.getElementById("quality");
const outputFormat = document.getElementById("outputFormat");
const background = document.getElementById("background");
const costEstimate = document.getElementById("costEstimate");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submitBtn");
const previewBlock = document.getElementById("previewBlock");
const resultImage = document.getElementById("resultImage");
const downloadLink = document.getElementById("downloadLink");
const responseInfo = document.getElementById("responseInfo");

const TOKEN_RATES = {
  textInput: 5 / 1_000_000,
  imageInput: 8 / 1_000_000,
  imageOutput: 30 / 1_000_000,
};

// Official GPT Image 2 calculator examples, expressed as high-quality
// output cost. For arbitrary custom sizes we use the nearest anchor and
// scale it gently, so this remains an estimate rather than a billing quote.
const HIGH_QUALITY_COST_ANCHORS = [
  { width: 1024, height: 1024, cost: 0.21072 },
  { width: 1536, height: 1024, cost: 0.16464 },
  { width: 2048, height: 1152, cost: 0.16950 },
  { width: 2048, height: 2048, cost: 0.42816 },
  { width: 3840, height: 2160, cost: 0.40026 },
];

const QUALITY_FACTORS = {
  "gpt-image-2": {
    low: 0.028,
    medium: 0.25,
    high: 1,
    auto: 0.25,
  },
  "gpt-image-2.5": {
    low: 0.028,
    medium: 0.0625,
    high: 0.25,
    xhigh: 0.445,
    max: 1,
    auto: 0.25,
  },
};

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`.trim();
}

function normalizeDimensions(width, height) {
  return width >= height ? [width, height] : [height, width];
}

function parseSize(value) {
  const match = String(value || "").trim().match(/^(\d+)x(\d+)$/i);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;

  return { width, height };
}

function estimateHighQualityOutputCost(width, height) {
  const [longEdge, shortEdge] = normalizeDimensions(width, height);
  const targetPixels = longEdge * shortEdge;
  const targetRatio = longEdge / shortEdge;

  const exact = HIGH_QUALITY_COST_ANCHORS.find((anchor) => {
    const [anchorLong, anchorShort] = normalizeDimensions(anchor.width, anchor.height);
    return anchorLong === longEdge && anchorShort === shortEdge;
  });

  if (exact) return exact.cost;

  let nearest = HIGH_QUALITY_COST_ANCHORS[0];
  let nearestScore = Number.POSITIVE_INFINITY;

  for (const anchor of HIGH_QUALITY_COST_ANCHORS) {
    const [anchorLong, anchorShort] = normalizeDimensions(anchor.width, anchor.height);
    const anchorPixels = anchorLong * anchorShort;
    const anchorRatio = anchorLong / anchorShort;
    const pixelDistance = Math.abs(Math.log(targetPixels / anchorPixels));
    const ratioDistance = Math.abs(Math.log(targetRatio / anchorRatio));
    const score = pixelDistance + ratioDistance * 1.5;

    if (score < nearestScore) {
      nearest = anchor;
      nearestScore = score;
    }
  }

  const nearestPixels = nearest.width * nearest.height;
  const scale = Math.sqrt(targetPixels / nearestPixels);
  return nearest.cost * Math.max(0.55, Math.min(1.8, scale));
}

function getModelFamily() {
  return modelInput.value.startsWith("gpt-image-2.5")
    ? "gpt-image-2.5"
    : "gpt-image-2";
}

function updateCostEstimate() {
  const dimensions = parseSize(sizeInput.value);
  if (!dimensions) {
    costEstimate.textContent = "Estimated API cost: enter a valid WIDTHxHEIGHT size.";
    return;
  }

  const family = getModelFamily();
  const quality = qualityInput.value;
  const factor = QUALITY_FACTORS[family][quality];
  const highCost = estimateHighQualityOutputCost(dimensions.width, dimensions.height);

  if (!factor) {
    costEstimate.textContent = "Estimated API cost: unavailable for this model/quality combination.";
    return;
  }

  const outputCost = highCost * factor;
  const estimatedPromptTokens = Math.max(1, Math.ceil(promptInput.value.length / 4));
  const promptCost = estimatedPromptTokens * TOKEN_RATES.textInput;
  const totalWithoutImageInput = outputCost + promptCost;
  const sourceNote = imageInput.files?.length
    ? " + input-image tokens"
    : "";

  costEstimate.innerHTML = [
    `<strong>Estimated API cost:</strong> ≈ $${totalWithoutImageInput.toFixed(3)}${sourceNote}.`,
    `Rates: text input $5/M · image input $8/M · image output $30/M tokens.`,
    `<span class="cost-note">Estimate only; actual token usage can vary.</span>`,
  ].join(" ");
}

function isSupportedImage(file) {
  return file && ["image/png", "image/jpeg", "image/webp"].includes(file.type);
}

function setSourceImage(file, sourceLabel = "Selected") {
  if (!isSupportedImage(file)) {
    setStatus("Please use a PNG, JPEG, or WebP image.", "error");
    return false;
  }

  if (file.size > 25 * 1024 * 1024) {
    setStatus("Source image must be 25 MB or smaller.", "error");
    return false;
  }

  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  imageInput.files = dataTransfer.files;

  const sizeMb = (file.size / (1024 * 1024)).toFixed(file.size >= 1024 * 1024 ? 2 : 3);
  fileInfo.textContent = `${sourceLabel}: ${file.name} (${sizeMb} MB)`;
  dropZone.classList.add("has-file");
  setStatus("");
  updateCostEstimate();
  return true;
}

presetSize.addEventListener("change", () => {
  if (presetSize.value !== "custom") {
    sizeInput.value = presetSize.value;
  }
  updateCostEstimate();
});

sizeInput.addEventListener("input", updateCostEstimate);
modelInput.addEventListener("change", updateCostEstimate);
qualityInput.addEventListener("change", updateCostEstimate);
promptInput.addEventListener("input", updateCostEstimate);

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (file) {
    setSourceImage(file);
  } else {
    fileInfo.textContent = "No image selected";
    dropZone.classList.remove("has-file");
    updateCostEstimate();
  }
});

dropZone.addEventListener("click", (event) => {
  if (event.target !== imageInput) {
    imageInput.click();
  }
});

dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    imageInput.click();
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.remove("drag-over");
  });
});

dropZone.addEventListener("drop", (event) => {
  const file = Array.from(event.dataTransfer?.files || []).find((item) => item.type.startsWith("image/"));
  if (!file) {
    setStatus("Drop a PNG, JPEG, or WebP image.", "error");
    return;
  }
  setSourceImage(file, "Dropped");
});

document.addEventListener("paste", (event) => {
  const item = Array.from(event.clipboardData?.items || []).find((entry) => entry.type.startsWith("image/"));
  if (!item) return;

  const blob = item.getAsFile();
  if (!blob) return;

  const extensionByType = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };
  const extension = extensionByType[blob.type] || "png";
  const file = new File([blob], `clipboard-${Date.now()}.${extension}`, { type: blob.type });

  if (setSourceImage(file, "Pasted")) {
    event.preventDefault();
  }
});

outputFormat.addEventListener("change", () => {
  if (outputFormat.value === "png" && background.value === "transparent") {
    return;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  previewBlock.classList.add("hidden");
  setStatus("Generating image... please wait.");
  submitBtn.disabled = true;

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Generation failed.");
    }

    resultImage.src = data.imageUrl;
    downloadLink.href = data.imageUrl;
    downloadLink.download = data.fileName || "generated-image";
    responseInfo.textContent = JSON.stringify(data, null, 2);
    previewBlock.classList.remove("hidden");
    setStatus("Done! Your image is ready.", "success");
  } catch (error) {
    setStatus(error.message || "Something went wrong.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

updateCostEstimate();
