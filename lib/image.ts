/**
 * Client-side image downscale + JPEG re-encode, run BEFORE upload.
 *
 * Why: iPhone photos are large (3–12 MB) and often HEIC. Sending them raw blows
 * past Vercel's ~4.5 MB serverless body limit and can fail on iOS Safari
 * (the "string did not match the expected pattern" DOMException). Drawing to a
 * canvas normalizes HEIC → JPEG and shrinks the payload, while keeping far more
 * than enough quality for the AI try-on + vision listing.
 *
 * Fails safe: on any decode/encode problem it returns the original data URL.
 */
export async function downscaleImage(
  dataUrl: string,
  maxDim = 1600,
  quality = 0.85
): Promise<string> {
  if (typeof document === "undefined") return dataUrl; // never runs server-side
  if (!dataUrl.startsWith("data:image/")) return dataUrl;

  let img: HTMLImageElement;
  try {
    img = await loadImage(dataUrl);
  } catch {
    return dataUrl; // couldn't decode (e.g. unsupported format) → send as-is
  }

  let width = img.naturalWidth;
  let height = img.naturalHeight;
  if (!width || !height) return dataUrl;

  const longest = Math.max(width, height);
  if (longest > maxDim) {
    const scale = maxDim / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);

  try {
    const out = canvas.toDataURL("image/jpeg", quality);
    // Guard against pathological cases where re-encoding grew the payload.
    return out.length < dataUrl.length ? out : dataUrl;
  } catch {
    return dataUrl;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = src;
  });
}
