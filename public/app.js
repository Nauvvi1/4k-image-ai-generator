const form = document.getElementById("generateForm");
const presetSize = document.getElementById("presetSize");
const sizeInput = document.getElementById("size");
const outputFormat = document.getElementById("outputFormat");
const background = document.getElementById("background");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submitBtn");
const previewBlock = document.getElementById("previewBlock");
const resultImage = document.getElementById("resultImage");
const downloadLink = document.getElementById("downloadLink");
const responseInfo = document.getElementById("responseInfo");

presetSize.addEventListener("change", () => {
  if (presetSize.value !== "custom") {
    sizeInput.value = presetSize.value;
  }
});

outputFormat.addEventListener("change", () => {
  if (outputFormat.value === "png" && background.value === "transparent") {
    return;
  }
});

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`.trim();
}

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
