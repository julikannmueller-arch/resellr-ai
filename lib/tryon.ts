const PIAPI_BASE = "https://api.piapi.ai/api/v1/task";

const TRYON_PROMPT =
  "The person in the first image should wear the pants/clothing from the second image. Keep everything else exactly the same — same person, same pose, same background, same top. Only replace the clothing item with the one from the second image, preserving all details, stitching, color and wash exactly.";

async function toPublicUrl(base64DataUrl: string): Promise<string> {
  // Parse "data:<mime>;base64,<payload>" via string slicing, NOT a regex. A
  // capture-group regex with an unbounded quantifier (`([\s\S]+)`) over a
  // multi-MB data URL can blow V8's regex stack ("Maximum call stack size
  // exceeded") when invoked from a deep async server context. Slicing is O(1)
  // stack and safe at any image size.
  const semi = base64DataUrl.indexOf(";");
  const comma = base64DataUrl.indexOf(",");
  if (
    !base64DataUrl.startsWith("data:") ||
    semi < 5 ||
    comma < semi ||
    !base64DataUrl.slice(semi + 1, comma).includes("base64")
  ) {
    throw new Error("Invalid image format");
  }

  const mimeType = base64DataUrl.slice(5, semi);
  const b64 = base64DataUrl.slice(comma + 1);
  const buffer = Buffer.from(b64, "base64");
  const ext = mimeType.includes("png") ? "png" : "jpg";

  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("time", "1h");
  form.append(
    "fileToUpload",
    new Blob([buffer], { type: mimeType }),
    `image.${ext}`
  );

  const res = await fetch(
    "https://litterbox.catbox.moe/resources/internals/api.php",
    { method: "POST", body: form }
  );

  if (!res.ok) throw new Error(`Image upload failed (${res.status})`);
  const url = (await res.text()).trim();
  if (!url.startsWith("http")) throw new Error(`Upload returned invalid URL: ${url}`);
  console.log("[tryon] uploaded image →", url);
  return url;
}

export interface TryOnOptions {
  /** PiAPI task_type — chosen model (nano-banana-pro | nano-banana-2). */
  taskType: "nano-banana-pro" | "nano-banana-2";
  /** PiAPI resolution — "1K" (standard) or "4K". Same field for both models. */
  resolution: "1K" | "4K";
}

export async function generateTryOn(
  modelImageBase64: string,
  garmentImageBase64: string,
  opts: TryOnOptions
): Promise<string> {
  const apiKey = process.env.PIAPI_KEY;
  if (!apiKey) throw new Error("PIAPI_KEY not configured");

  const [modelUrl, garmentUrl] = await Promise.all([
    toPublicUrl(modelImageBase64),
    toPublicUrl(garmentImageBase64),
  ]);

  const createRes = await fetch(PIAPI_BASE, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini",
      task_type: opts.taskType,
      input: {
        prompt: TRYON_PROMPT,
        image_urls: [modelUrl, garmentUrl],
        aspect_ratio: "9:16", // portrait, mobile-optimized output
        resolution: opts.resolution,
      },
    }),
  });

  const createData = await createRes.json();
  console.log("[tryon] create response:", JSON.stringify(createData));

  if (!createRes.ok) {
    throw new Error(`PiAPI error (${createRes.status}): ${JSON.stringify(createData)}`);
  }

  const taskId: string = createData.data?.task_id;
  if (!taskId) throw new Error("No task_id returned from PiAPI");

  console.log("[tryon] polling task:", taskId);

  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(2000);

    const statusRes = await fetch(`${PIAPI_BASE}/${taskId}`, {
      headers: { "X-API-Key": apiKey },
    });

    if (!statusRes.ok) continue;

    const statusData = await statusRes.json();
    const status: string = (statusData.data?.status ?? "").toLowerCase();

    console.log(`[tryon] poll ${i + 1}/${maxAttempts} status: ${status}`);

    if (status === "completed") {
      const output = statusData.data?.output;
      console.log("[tryon] output:", JSON.stringify(output));
      const imageUrl: string | undefined =
        output?.image_urls?.[0] ?? output?.images?.[0] ?? output?.url;
      if (imageUrl) return imageUrl;
      throw new Error("Task completed but no image URL found in output");
    }

    if (status === "failed") {
      const errMsg =
        statusData.data?.error?.message ??
        statusData.data?.detail ??
        "Generation failed";
      console.log("[tryon] failed:", JSON.stringify(statusData.data));
      throw new Error(`PiAPI: ${errMsg}`);
    }
  }

  throw new Error("Try-on timed out after 2 minutes — please try again");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
