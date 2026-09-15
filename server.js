import express from "express";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const GENERATED_DIR = path.join(__dirname, "generated");
const UPLOAD_DIR = path.join(__dirname, "uploads");

fs.mkdirSync(GENERATED_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/generated", express.static(GENERATED_DIR));

function validateSize(size) {
  if (!/^\d+x\d+$/i.test(size || "")) {
    return 'Size must be in the format WIDTHxHEIGHT, for example: 2160x3840';
  }

  const [width, height] = size.toLowerCase().split("x").map(Number);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "Width and height must be positive numbers.";
  }

  if (width % 16 !== 0 || height % 16 !== 0) {
    return "Width and height must be multiples of 16.";
  }

  if (width > 3840 || height > 3840) {
    return "Neither image side may exceed 3840 pixels.";
  }

  const ratio = width / height;
  if (ratio < 1 / 3 || ratio > 3) {
    return "Aspect ratio must be between 1:3 and 3:1.";
  }

  const pixels = width * height;
  if (pixels < 655360 || pixels > 8294400) {
    return "Total pixel count must be between 655,360 and 8,294,400 (4K max).";
  }

  return null;
}

function sanitizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "image";
}

function buildPrompt(userPrompt, size, hasSourceImage) {
  const base = (userPrompt || "").trim();
  if (!hasSourceImage) {
    return base;
  }

  return [
    base,
    "",
    `Use the uploaded image as the source/reference and recreate it at ${size} resolution.`,
    "Preserve the main subject, overall composition, colors, and visual style unless the user's prompt explicitly asks for changes.",
    "Aim for a clean, high-detail result suitable for a 4K render.",
  ].join("\n");
}

function getMimeByFormat(format) {
  switch (format) {
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "png":
    default:
      return "image/png";
  }
}

function ensureApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.");
    error.statusCode = 500;
    throw error;
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/generate", upload.single("image"), async (req, res) => {
  try {
    ensureApiKey();

    const {
      prompt,
      size = "2160x3840",
      quality = "high",
      outputFormat = "png",
      background = "auto",
      compression = "90",
      model = "gpt-image-2.5-sunburst",
    } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ ok: false, error: "Prompt is required." });
    }

    const sizeError = validateSize(size);
    if (sizeError) {
      return res.status(400).json({ ok: false, error: sizeError });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const hasSourceImage = Boolean(req.file);
    const finalPrompt = buildPrompt(prompt, size, hasSourceImage);

    const commonParams = {
      model,
      prompt: finalPrompt,
      size,
      quality,
      output_format: outputFormat,
    };

    if (background && background !== "auto") {
      commonParams.background = background;
    }

    if (["jpeg", "webp"].includes(outputFormat)) {
      commonParams.output_compression = Number(compression);
    }

    let result;

    if (hasSourceImage) {
      const uploadedFile = await toFile(
        fs.createReadStream(req.file.path),
        req.file.originalname,
        { type: req.file.mimetype || getMimeByFormat(outputFormat) }
      );

      result = await client.images.edit({
        ...commonParams,
        image: uploadedFile,
      });
    } else {
      result = await client.images.generate(commonParams);
    }

    const imageData = result?.data?.[0];

    if (!imageData?.b64_json) {
      throw new Error("OpenAI did not return image data.");
    }

    const extension = outputFormat === "jpeg" ? "jpg" : outputFormat;
    const fileBase = `${sanitizeName(prompt)}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const fileName = `${fileBase}.${extension}`;
    const filePath = path.join(GENERATED_DIR, fileName);

    fs.writeFileSync(filePath, Buffer.from(imageData.b64_json, "base64"));

    res.json({
      ok: true,
      imageUrl: `/generated/${fileName}`,
      fileName,
      prompt: finalPrompt,
      revisedPrompt: imageData.revised_prompt || null,
      size,
      quality,
      outputFormat,
      model,
      hadSourceImage: hasSourceImage,
    });
  } catch (error) {
    console.error(error);
    const status = error.statusCode || error.status || 500;
    const message = error?.error?.message || error?.message || "Unknown error";
    res.status(status).json({ ok: false, error: message });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server started: http://localhost:${PORT}`);
});
