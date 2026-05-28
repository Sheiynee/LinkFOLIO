import { describe, it, expect } from "vitest";
import { validateLinkUrl } from "@/lib/url-validate";

describe("validateLinkUrl", () => {
  describe("empty / blank input", () => {
    it("rejects empty string", () => {
      expect(validateLinkUrl("")).toEqual({ ok: false, reason: "URL is required" });
    });

    it("rejects whitespace-only string", () => {
      expect(validateLinkUrl("   ")).toEqual({ ok: false, reason: "URL is required" });
    });
  });

  describe("dangerous scheme pre-check", () => {
    it("blocks javascript:", () => {
      expect(validateLinkUrl("javascript:alert(1)").ok).toBe(false);
    });

    it("blocks JavaScript: (case-insensitive)", () => {
      expect(validateLinkUrl("JavaScript:alert(1)").ok).toBe(false);
    });

    it("blocks vbscript:", () => {
      expect(validateLinkUrl("vbscript:msgbox(1)").ok).toBe(false);
    });

    it("blocks data: URI", () => {
      expect(validateLinkUrl("data:text/html,<h1>xss</h1>").ok).toBe(false);
    });

    it("blocks file:", () => {
      expect(validateLinkUrl("file:///etc/passwd").ok).toBe(false);
    });
  });

  describe("allowed schemes", () => {
    it("accepts https://", () => {
      const r = validateLinkUrl("https://example.com");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.url).toBe("https://example.com/");
    });

    it("accepts http://", () => {
      const r = validateLinkUrl("http://example.com");
      expect(r.ok).toBe(true);
    });

    it("accepts mailto:", () => {
      const r = validateLinkUrl("mailto:user@example.com");
      expect(r.ok).toBe(true);
    });

    it("accepts tel:", () => {
      const r = validateLinkUrl("tel:+1234567890");
      expect(r.ok).toBe(true);
    });

    it("rejects ftp: scheme", () => {
      expect(validateLinkUrl("ftp://example.com").ok).toBe(false);
    });

    it("rejects ssh: scheme", () => {
      expect(validateLinkUrl("ssh://server.example.com").ok).toBe(false);
    });
  });

  describe("auto-prepend https://", () => {
    it("prepends https:// to a bare domain", () => {
      const r = validateLinkUrl("example.com");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.url).toBe("https://example.com/");
    });

    it("prepends https:// to a domain with a path", () => {
      const r = validateLinkUrl("example.com/path");
      expect(r.ok).toBe(true);
    });

    it("does not double-prepend for existing https://", () => {
      const r = validateLinkUrl("https://example.com");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.url.startsWith("https://")).toBe(true);
    });
  });

  describe("blocked hostnames", () => {
    it("blocks localhost", () => {
      expect(validateLinkUrl("http://localhost").ok).toBe(false);
    });

    it("blocks 127.0.0.1", () => {
      expect(validateLinkUrl("http://127.0.0.1").ok).toBe(false);
    });

    it("blocks 0.0.0.0", () => {
      expect(validateLinkUrl("http://0.0.0.0").ok).toBe(false);
    });

    it("blocks ::1 (IPv6 loopback)", () => {
      expect(validateLinkUrl("http://[::1]").ok).toBe(false);
    });
  });

  describe("private IPv4 ranges", () => {
    it("blocks 10.x.x.x (class A private)", () => {
      expect(validateLinkUrl("http://10.0.0.1").ok).toBe(false);
    });

    it("blocks 192.168.x.x (class C private)", () => {
      expect(validateLinkUrl("http://192.168.1.1").ok).toBe(false);
    });

    it("blocks 172.16.x.x (class B private lower bound)", () => {
      expect(validateLinkUrl("http://172.16.0.1").ok).toBe(false);
    });

    it("blocks 172.31.x.x (class B private upper bound)", () => {
      expect(validateLinkUrl("http://172.31.255.255").ok).toBe(false);
    });

    it("allows 172.15.x.x (just below private range)", () => {
      expect(validateLinkUrl("http://172.15.0.1").ok).toBe(true);
    });

    it("allows 172.32.x.x (just above private range)", () => {
      expect(validateLinkUrl("http://172.32.0.1").ok).toBe(true);
    });

    it("blocks 169.254.x.x (link-local)", () => {
      expect(validateLinkUrl("http://169.254.1.1").ok).toBe(false);
    });

    it("blocks 127.1.2.3 (loopback /8)", () => {
      expect(validateLinkUrl("http://127.1.2.3").ok).toBe(false);
    });

    it("blocks 100.64.0.1 (CGNAT lower bound)", () => {
      expect(validateLinkUrl("http://100.64.0.1").ok).toBe(false);
    });

    it("blocks 100.127.255.255 (CGNAT upper bound)", () => {
      expect(validateLinkUrl("http://100.127.255.255").ok).toBe(false);
    });

    it("allows 100.128.0.1 (just above CGNAT range)", () => {
      expect(validateLinkUrl("http://100.128.0.1").ok).toBe(true);
    });

    it("allows 100.63.255.255 (just below CGNAT range)", () => {
      expect(validateLinkUrl("http://100.63.255.255").ok).toBe(true);
    });
  });

  describe("mailto / tel skip host checks", () => {
    it("mailto: passes even with a localhost address", () => {
      expect(validateLinkUrl("mailto:user@localhost").ok).toBe(true);
    });

    it("tel: passes any value", () => {
      expect(validateLinkUrl("tel:+1800555000").ok).toBe(true);
    });
  });

  describe("invalid URLs", () => {
    it("rejects a completely unparseable string", () => {
      expect(validateLinkUrl("not a url at all!!!").ok).toBe(false);
    });
  });
});
