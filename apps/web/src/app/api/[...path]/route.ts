/**
 * Catch-all proxy route: forwards all /api/* requests to the FastAPI backend.
 * Keeps the backend URL server-side (never exposed to the client).
 * Handles GET, POST, PUT, DELETE.
 */

import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await params;
  const targetPath = "/" + path.join("/");
  const url = `${API_URL}${targetPath}${request.nextUrl.search}`;

  const headers = new Headers();
  // Forward relevant headers, skip hop-by-hop headers
  for (const [key, value] of request.headers.entries()) {
    if (!["host", "connection", "transfer-encoding"].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.text();
    if (body) {
      init.body = body;
    }
  }

  const response = await fetch(url, init);

  const responseHeaders = new Headers();
  response.headers.forEach((value, key) => {
    if (!["connection", "transfer-encoding"].includes(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
