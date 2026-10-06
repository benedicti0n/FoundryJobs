import assert from "node:assert/strict";
import test from "node:test";
import { validateTelegramPhotoUrl } from "../src/logo";

const originalFetch = globalThis.fetch;

function stubFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): string[] {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);
    return handler(url, init);
  }) as typeof fetch;
  return calls;
}

function imageResponse(bytes: number, contentType = "image/png"): Response {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { "content-type": contentType, "content-length": String(bytes) },
  });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("valid PNG logo is accepted", async () => {
  stubFetch(() => imageResponse(2048, "image/png"));
  const result = await validateTelegramPhotoUrl("https://cdn.example.com/logo.png");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.contentType, "image/png");
    assert.equal(result.sizeBytes, 2048);
  }
});

test("valid JPEG logo is accepted", async () => {
  stubFetch(() => imageResponse(4096, "image/jpeg"));
  const result = await validateTelegramPhotoUrl("https://cdn.example.com/logo.jpg");
  assert.equal(result.ok, true);
});

test("broken logo URL fails cleanly", async () => {
  stubFetch(() => new Response("gone", { status: 404, headers: { "content-type": "text/plain" } }));
  const result = await validateTelegramPhotoUrl("https://cdn.example.com/missing.png");
  assert.equal(result.ok, false);
});

test("non-image content type is rejected", async () => {
  stubFetch(
    () => new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } }),
  );
  const result = await validateTelegramPhotoUrl("https://cdn.example.com/page");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /content type/);
  }
});

test("network failure is rejected", async () => {
  stubFetch(() => {
    throw new Error("connection refused");
  });
  const result = await validateTelegramPhotoUrl("https://cdn.example.com/logo.png");
  assert.equal(result.ok, false);
});

test("timeout is rejected", async () => {
  stubFetch(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      }),
  );
  const result = await validateTelegramPhotoUrl("https://cdn.example.com/slow.png", 50);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /timed out/);
  }
});

test("oversized logo is rejected via content-length", async () => {
  stubFetch(
    () =>
      new Response(new Uint8Array(16), {
        status: 200,
        headers: { "content-type": "image/png", "content-length": String(11 * 1024 * 1024) },
      }),
  );
  const result = await validateTelegramPhotoUrl("https://cdn.example.com/huge.png");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /size limit/);
  }
});

test("oversized streamed logo is rejected while reading", async () => {
  const big = new Uint8Array(2 * 1024 * 1024);
  stubFetch(
    () =>
      new Response(
        new ReadableStream({
          start(controller) {
            for (let index = 0; index < 8; index += 1) {
              controller.enqueue(big);
            }
            controller.close();
          },
        }),
        { status: 200, headers: { "content-type": "image/png" } },
      ),
  );
  const result = await validateTelegramPhotoUrl("https://cdn.example.com/stream.png");
  assert.equal(result.ok, false);
});

test("SVG logos are rejected as Telegram photos", async () => {
  stubFetch(
    () => new Response("<svg/>", { status: 200, headers: { "content-type": "image/svg+xml" } }),
  );
  const result = await validateTelegramPhotoUrl("https://cdn.example.com/logo.svg");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /svg/);
  }
});

test("private-network and invalid URLs are rejected before fetching", async () => {
  const calls = stubFetch(() => imageResponse(128));
  for (const url of [
    "http://localhost/logo.png",
    "http://127.0.0.1/logo.png",
    "http://192.168.1.5/logo.png",
    "http://10.0.0.1/logo.png",
    "ftp://cdn.example.com/logo.png",
    "not-a-url",
  ]) {
    const result = await validateTelegramPhotoUrl(url);
    assert.equal(result.ok, false, `${url} should be rejected`);
  }
  assert.equal(calls.length, 0);
});
