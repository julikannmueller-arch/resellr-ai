import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * Image download proxy.
 *
 * The try-on CDN doesn't send CORS headers, so the browser can't fetch the
 * image as a blob directly. This route fetches it server-side and returns it
 * with Content-Disposition: attachment → the browser saves the file directly,
 * no new tab.
 *
 * Auth-gated + URL validation so it can't be abused as an open proxy (SSRF).
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const urlParam = request.nextUrl.searchParams.get("url");
  if (!urlParam) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(urlParam);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  // Only public https hosts — no internal networks, no IP literals
  const host = target.hostname.toLowerCase();
  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
  if (
    target.protocol !== "https:" ||
    isIpLiteral ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return new NextResponse("URL not allowed", { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      signal: AbortSignal.timeout(30_000),
    });
    if (!upstream.ok || !upstream.body) {
      return new NextResponse("Upstream fetch failed", { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return new NextResponse("Not an image", { status: 400 });
    }

    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
      ? "webp"
      : "jpg";

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="resellr-tryon.${ext}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse("Download failed", { status: 502 });
  }
}
