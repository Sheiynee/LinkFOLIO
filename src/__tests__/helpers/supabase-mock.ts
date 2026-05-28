import { vi } from "vitest";
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * A fluent Supabase chain that resolves to `value` no matter which terminal
 * call or `await` is used (single / maybeSingle / direct await).
 */
export function chain(
  value: { data: unknown; error: unknown } = { data: null, error: null }
) {
  const c = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(value),
    maybeSingle: vi.fn().mockResolvedValue(value),
    // Makes `await chainObject` work without calling single/maybeSingle.
    then: (
      resolve: (v: unknown) => void,
      reject?: (e: unknown) => void
    ) => Promise.resolve(value).then(resolve, reject),
  };
  return c;
}

export type Chain = ReturnType<typeof chain>;

/**
 * Build a mock Supabase client whose `from()` returns the given chains in
 * order. Falls back to an empty-data chain if more calls are made than
 * chains provided.
 */
export function mockDb(
  ...chains: Chain[]
): ReturnType<typeof createAdminClient> {
  let i = 0;
  return {
    from: vi.fn().mockImplementation(() => chains[i++] ?? chain()),
  } as unknown as ReturnType<typeof createAdminClient>;
}
