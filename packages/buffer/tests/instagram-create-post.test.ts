import assert from "node:assert/strict";
import test from "node:test";
import { createBufferUpdate } from "../src/client";

process.env.BUFFER_ACCESS_TOKEN = "test-buffer-token";
process.env.BUFFER_PROFILE_ID_X = "test-x-channel";
process.env.BUFFER_PROFILE_ID_INSTAGRAM = "test-ig-channel";
delete process.env.BUFFER_PROFILE_ID_LINKEDIN;

const originalFetch = globalThis.fetch;

type CapturedCall = {
  url: string;
  init: RequestInit;
};

function stubFetch(responder?: (call: CapturedCall) => Response): CapturedCall[] {
  const calls: CapturedCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = {
      url: typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
      init: init ?? {},
    };
    calls.push(call);
    if (responder) {
      return responder(call);
    }
    return new Response(
      JSON.stringify({
        data: {
          createPost: {
            __typename: "PostActionSuccess",
            post: {
              id: "buffer-post-1",
              status: "queued",
              channelService: "instagram",
              externalLink: null,
            },
          },
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  return calls;
}

function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}

function parseInput(call: CapturedCall): Record<string, unknown> {
  const body = JSON.parse(String(call.init.body)) as {
    query: string;
    variables: { input: Record<string, unknown> };
  };
  assert.match(body.query, /createPost/);
  return body.variables.input;
}

test("instagram createPost payload uses metadata.instagram, one image asset and unchanged scheduling", async (t) => {
  const calls = stubFetch();
  t.after(restoreFetch);

  const outcome = await createBufferUpdate(
    "instagram",
    "Exact caption text",
    "https://cdn.test/instagram-card.png",
  );

  assert.equal(outcome.externalPostId, "buffer-post-1");
  assert.equal(outcome.publishedUrl, null);
  assert.equal(outcome.status, "queued");

  assert.equal(calls.length, 1);
  const call = calls[0]!;
  assert.equal(call.url, "https://api.buffer.com");
  assert.equal(call.init.method, "POST");
  const headers = call.init.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer test-buffer-token");
  assert.equal(headers["content-type"], "application/json");

  const input = parseInput(call);
  assert.equal("type" in input, false, "type must never be a top-level CreatePostInput field");
  assert.equal(input.channelId, "test-ig-channel");
  assert.equal(input.text, "Exact caption text");
  assert.equal(input.mode, "shareNow");
  assert.equal(input.schedulingType, "automatic");
  assert.equal(input.needsApproval, false);
  assert.deepEqual(input.assets, [{ image: { url: "https://cdn.test/instagram-card.png" } }]);
  assert.deepEqual(input.metadata, {
    instagram: { type: "post", shouldShareToFeed: true },
  });
});

test("x createPost payload stays text-only without instagram metadata", async (t) => {
  const calls = stubFetch();
  t.after(restoreFetch);

  const outcome = await createBufferUpdate("x", "X text only");

  assert.equal(outcome.externalPostId, "buffer-post-1");
  assert.equal(calls.length, 1);

  const input = parseInput(calls[0]!);
  assert.equal("type" in input, false);
  assert.equal("metadata" in input, false, "x must not receive instagram metadata");
  assert.deepEqual(input, {
    channelId: "test-x-channel",
    text: "X text only",
    mode: "shareNow",
    schedulingType: "automatic",
    needsApproval: false,
    assets: [],
  });
});

test("buffer error unions surface sanitized messages without a second request", async (t) => {
  const calls = stubFetch(
    () =>
      new Response(
        JSON.stringify({
          data: {
            createPost: {
              __typename: "InvalidInputError",
              message: "Invalid post: Instagram posts require a type (post, story, or reel).",
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  );
  t.after(restoreFetch);

  await assert.rejects(
    () => createBufferUpdate("instagram", "caption", "https://cdn.test/card.png"),
    /Instagram posts require a type/,
  );
  assert.equal(calls.length, 1);
});

test("graphql coercion errors keep field-level detail while redacting secrets", async (t) => {
  const longInputDump = "x".repeat(600);
  stubFetch(
    () =>
      new Response(
        JSON.stringify({
          errors: [
            {
              message: `Variable "$input" got invalid value { text: "${longInputDump}", mode: "shareNow" }; Field "type" is not defined by type "CreatePostInput". See https://api.buffer.com/docs?access_token=supersecret123&view=full`,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  );
  t.after(restoreFetch);

  await assert.rejects(
    () => createBufferUpdate("instagram", "caption", "https://cdn.test/card.png"),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(
        message,
        /Field "type" is not defined by type "CreatePostInput"\./,
        "field-level detail must survive sanitization",
      );
      assert.equal(message.includes("supersecret123"), false, "secrets must be redacted");
      assert.equal(message.includes("access_token=supersecret123"), false);
      assert.ok(
        message.length <= 320,
        `sanitized message must stay bounded (got ${message.length})`,
      );
      return true;
    },
  );
});
