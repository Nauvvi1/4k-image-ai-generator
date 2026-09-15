# OpenAI 4K Image Generator on Node.js

Express app for generating or recreating 4K images with the OpenAI Images API.

## What it does

- lets you enter a prompt in the browser
- optionally lets you upload a source image
- if no image is attached, it calls `images.generate`
- if an image is attached, it calls `images.edit`
- saves the generated result locally and shows it in the browser
- supports 4K-sized requests such as `3840x2160` or `2160x3840`

## Setup
Install dependencies:

```bash
npm install
```

4. Copy `.env.example` to `.env`.
5. Put your API key into `.env`:

```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
```

## Run

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

## How to use

1. Enter your prompt.
2. (Optional) attach a source image.
3. Choose a size:
   - `2160x3840` for portrait 4K
   - `3840x2160` for landscape 4K
4. Click **Generate**.
5. Wait for the image to appear.
6. Download it using the link under the preview.

## Important notes

- The app validates the size before sending the request.
- Width and height must be multiples of 16.
- Neither side may exceed 3840 px.
- The total pixel count may not exceed 8,294,400 pixels.
- Very large outputs are more expensive and may take longer.
- According to the OpenAI docs, resolutions above `2560x1440` are experimental.

## Good example prompts

### Generate from text only

```text
Create a dark deep-space background in portrait 4K with very small stars, subtle blue-purple nebula streaks, clean detail, and no planets or text.
```

### Recreate an uploaded image in 4K

```text
Recreate the uploaded image in sharp portrait 4K. Keep the same composition, mood, and colors. Make the stars very fine and the nebula details clean and crisp.
```
