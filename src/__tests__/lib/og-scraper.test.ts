import { describe, it, expect, vi, beforeEach } from "vitest";

// All hostnames resolve to a public IP unless the test overrides the mock.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

import { lookup } from "node:dns/promises";
import { fetchOgCard } from "@/lib/widgets/og-scraper";

const mockLookup = vi.mocked(lookup);
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html" },
  });
}

function redirectResponse(location: string): Response {
  // Response() forbids 3xx statuses; build the shape the scraper reads.
  return {
    status: 302,
    ok: false,
    headers: new Headers({ location }),
    body: null,
  } as unknown as Response;
}

describe("fetchOgCard SSRF hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
  });

  it("fetches a public URL and parses OG metadata", async () => {
    mockFetch.mockResolvedValueOnce(
      htmlResponse(`<html><head><meta property="og:title" content="Hello"/></head></html>`)
    );
    const card = await fetchOgCard("https://example.com/page");
    expect(card?.title).toBe("Hello");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Manual redirect handling — never let fetch follow on its own.
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("follows a redirect to another public host", async () => {
    mockFetch
      .mockResolvedValueOnce(redirectResponse("https://other.example.com/final"))
      .mockResolvedValueOnce(
        htmlResponse(`<html><head><meta property="og:title" content="Final"/></head></html>`)
      );
    const card = await fetchOgCard("https://example.com/start");
    expect(card?.title).toBe("Final");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toBe("https://other.example.com/final");
  });

  it("refuses to follow a redirect to a private IP", async () => {
    mockFetch.mockResolvedValueOnce(redirectResponse("http://169.254.169.254/latest/meta-data/"));
    const card = await fetchOgCard("https://example.com/evil");
    // Falls back to a bare card — and crucially never fetches the target.
    expect(card?.title).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("refuses to follow a redirect to a host that resolves privately", async () => {
    mockFetch.mockResolvedValueOnce(redirectResponse("https://internal.example.com/"));
    mockLookup
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }] as never) // initial host (unused: already validated)
      .mockResolvedValue([{ address: "10.0.0.5", family: 4 }] as never); // redirect target
    const card = await fetchOgCard("https://example.com/evil");
    expect(card?.title).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("caps redirect chains", async () => {
    mockFetch.mockResolvedValue(redirectResponse("https://example.com/loop"));
    const card = await fetchOgCard("https://example.com/start");
    expect(card?.title).toBeNull();
    // initial request + at most MAX_REDIRECTS (3) follow-ups
    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("rejects a directly-private URL without fetching at all", async () => {
    const card = await fetchOgCard("http://127.0.0.1/admin");
    expect(card).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
