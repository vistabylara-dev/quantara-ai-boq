import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage, RequestOptions } from "node:http";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const networkMocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  httpRequest: vi.fn(),
  httpsRequest: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({ lookup: networkMocks.lookup }));
vi.mock("node:http", () => ({ request: networkMocks.httpRequest }));
vi.mock("node:https", () => ({ request: networkMocks.httpsRequest }));

import { fitLogoBox, isPublicLogoAddress, loadLogoImage, logoImageToDataUri } from "@/lib/documents/logo-image";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const tinyGif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");

type StubResponse = {
  statusCode?: number;
  headers?: Record<string, string>;
  chunks?: Buffer[];
};

function queueResponse(requestMock: typeof networkMocks.httpRequest, stub: StubResponse): () => IncomingMessage | null {
  let capturedResponse: IncomingMessage | null = null;
  requestMock.mockImplementationOnce((_options: RequestOptions, callback: (response: IncomingMessage) => void) => {
    const outbound = new EventEmitter();
    Object.assign(outbound, {
      end: () => {
        const response = Readable.from(stub.chunks ?? []) as unknown as IncomingMessage;
        capturedResponse = response;
        Object.assign(response, {
          statusCode: stub.statusCode ?? 200,
          headers: stub.headers ?? {},
        });
        queueMicrotask(() => callback(response));
        return outbound;
      },
    });
    return outbound as ClientRequest;
  });
  return () => capturedResponse;
}

describe("loadLogoImage SSRF and resource bounds", () => {
  beforeEach(() => {
    networkMocks.lookup.mockReset();
    networkMocks.httpRequest.mockReset();
    networkMocks.httpsRequest.mockReset();
    networkMocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects malformed, non-HTTP, credentialed, reserved-port and local URLs before networking", async () => {
    const urls = [
      "not a URL",
      "javascript:alert(1)",
      "https://user:password@assets.quantara.ai/logo.png",
      "https://assets.quantara.ai:8443/logo.png",
      "http://localhost/logo.png",
      "http://service.internal/logo.png",
      "http://127.0.0.1/logo.png",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/logo.png",
    ];

    for (const url of urls) expect(await loadLogoImage(url)).toBeNull();
    expect(networkMocks.lookup).not.toHaveBeenCalled();
    expect(networkMocks.httpRequest).not.toHaveBeenCalled();
    expect(networkMocks.httpsRequest).not.toHaveBeenCalled();
  });

  it("rejects a hostname when any DNS result is private and never opens a socket", async () => {
    networkMocks.lookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.8", family: 4 },
    ]);

    expect(await loadLogoImage("https://assets.quantara.ai/logo.png")).toBeNull();
    expect(networkMocks.httpsRequest).not.toHaveBeenCalled();
  });

  it("pins the connection to the checked public address while preserving TLS SNI and Host", async () => {
    queueResponse(networkMocks.httpsRequest, {
      headers: { "content-type": "image/png", "content-length": String(tinyPng.byteLength) },
      chunks: [tinyPng],
    });

    const logo = await loadLogoImage("https://assets.quantara.ai/logo.png?v=1");
    expect(logo).toMatchObject({ format: "png", width: 1, height: 1 });

    const options = networkMocks.httpsRequest.mock.calls[0][0] as RequestOptions & { servername?: string };
    expect(options.hostname).toBe("93.184.216.34");
    expect(options.servername).toBe("assets.quantara.ai");
    expect(options.path).toBe("/logo.png?v=1");
    expect(options.headers).toMatchObject({ Host: "assets.quantara.ai", "Accept-Encoding": "identity" });
  });

  it("validates each redirect target and blocks a redirect to a private address", async () => {
    queueResponse(networkMocks.httpsRequest, {
      statusCode: 302,
      headers: { location: "https://127.0.0.1/private-logo.png" },
    });

    expect(await loadLogoImage("https://assets.quantara.ai/logo.png")).toBeNull();
    expect(networkMocks.httpsRequest).toHaveBeenCalledTimes(1);
  });

  it("rejects HTTPS downgrade redirects", async () => {
    queueResponse(networkMocks.httpsRequest, {
      statusCode: 302,
      headers: { location: "http://cdn.quantara.ai/logo.png" },
    });

    expect(await loadLogoImage("https://assets.quantara.ai/logo.png")).toBeNull();
    expect(networkMocks.httpRequest).not.toHaveBeenCalled();
  });

  it("streams with a hard body limit even when content-length is absent", async () => {
    queueResponse(networkMocks.httpsRequest, {
      headers: { "content-type": "image/png" },
      chunks: [Buffer.alloc(1024 * 1024), Buffer.from([0])],
    });

    expect(await loadLogoImage("https://assets.quantara.ai/logo.png")).toBeNull();
  });

  it("destroys rejected responses before returning without consuming their bodies", async () => {
    const getResponse = queueResponse(networkMocks.httpsRequest, {
      headers: { "content-type": "text/html", "content-length": "999999999" },
      chunks: [Buffer.from("untrusted response")],
    });

    expect(await loadLogoImage("https://assets.quantara.ai/not-an-image")).toBeNull();
    expect(getResponse()?.destroyed).toBe(true);
  });

  it("requires content type to match the image signature and bounds dimensions", async () => {
    queueResponse(networkMocks.httpsRequest, {
      headers: { "content-type": "image/jpeg" },
      chunks: [tinyPng],
    });
    expect(await loadLogoImage("https://assets.quantara.ai/wrong-type")).toBeNull();

    const hugePng = Buffer.from(tinyPng);
    hugePng.writeUInt32BE(5000, 16);
    queueResponse(networkMocks.httpsRequest, {
      headers: { "content-type": "image/png" },
      chunks: [hugePng],
    });
    expect(await loadLogoImage("https://assets.quantara.ai/huge.png")).toBeNull();
  });

  it("rejects GIF consistently because every generated output supports PNG and JPEG only", async () => {
    queueResponse(networkMocks.httpsRequest, {
      headers: { "content-type": "image/gif", "content-length": String(tinyGif.byteLength) },
      chunks: [tinyGif],
    });

    expect(await loadLogoImage("https://assets.quantara.ai/logo.gif")).toBeNull();
  });

  it("bounds DNS and response work with one total timeout", async () => {
    vi.useFakeTimers();
    networkMocks.lookup.mockImplementation(() => new Promise(() => undefined));
    const pending = loadLogoImage("https://assets.quantara.ai/logo.png");
    await vi.advanceTimersByTimeAsync(5001);
    await expect(pending).resolves.toBeNull();
    expect(networkMocks.httpsRequest).not.toHaveBeenCalled();
  });
});

describe("logo image helpers", () => {
  it("classifies private, link-local, reserved and public addresses", () => {
    expect(isPublicLogoAddress("10.0.0.1")).toBe(false);
    expect(isPublicLogoAddress("100.64.0.1")).toBe(false);
    expect(isPublicLogoAddress("192.0.2.1")).toBe(false);
    expect(isPublicLogoAddress("2001:2::1")).toBe(false);
    expect(isPublicLogoAddress("2001:10::1")).toBe(false);
    expect(isPublicLogoAddress("2001:20::1")).toBe(false);
    expect(isPublicLogoAddress("2001:db8::1")).toBe(false);
    expect(isPublicLogoAddress("2606:4700:4700::1111")).toBe(true);
    expect(isPublicLogoAddress("93.184.216.34")).toBe(true);
  });

  it("creates a self-contained data URI and preserves aspect ratio", () => {
    expect(logoImageToDataUri({ buffer: tinyPng, format: "png", width: 1, height: 1 })).toMatch(/^data:image\/png;base64,/);
    expect(fitLogoBox(200, 100, 100, 100)).toEqual({ width: 100, height: 50 });
  });
});
