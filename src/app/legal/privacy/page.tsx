export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: 2026-05-21</p>

      <p>
        This page explains what data LinkFolio stores about you, why we
        store it, and what you can do about it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account identity.</strong> Your email and the public profile
          data your OAuth provider (Google / GitHub) returns at sign-in.
        </li>
        <li>
          <strong>Profile content.</strong> Username, display name, bio,
          avatar, theme, blocks, canvas elements, and uploads.
        </li>
        <li>
          <strong>Analytics.</strong> Bot-filtered page views and link clicks
          with referrer and country code (from the
          <code>x-vercel-ip-country</code> header). We do <strong>not</strong>
          {" "}store raw IPs in the analytics tables.
        </li>
        <li>
          <strong>Rate-limiting buckets.</strong> Hashed IPs (for the redirect
          endpoint) and user IDs (for uploads) along with a sliding-window
          counter. Buckets are pruned outside the rate-limit window.
        </li>
        <li>
          <strong>Session cookie.</strong> A 30-day JWT issued by NextAuth on
          sign-in.
        </li>
      </ul>

      <h2>What we don&apos;t collect</h2>
      <ul>
        <li>No payment information — there&apos;s no paid tier today.</li>
        <li>No tracking pixels, no cross-site cookies, no ad networks.</li>
        <li>No sale or sharing of your data with third parties for advertising.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Strictly to operate the Service: render your public page, produce OG
        share images, surface analytics to <em>you</em>, prevent abuse, and
        send the occasional transactional email tied to your account (e.g.
        confirmation of account deletion).
      </p>

      <h2>Third-party services</h2>
      <ul>
        <li>
          <strong>Supabase.</strong> Hosts the database and storage buckets
          (avatars, backgrounds, fonts).
        </li>
        <li>
          <strong>Vercel.</strong> Hosts the Next.js app + edge runtime.
        </li>
        <li>
          <strong>Auth providers.</strong> Google, GitHub — they see your
          sign-in but not your profile content.
        </li>
        <li>
          <strong>Widget targets.</strong> Twitch, YouTube, GitHub, Discord,
          Spotify, TikTok — server-side fetches we make on your behalf.
          We don&apos;t send those services any of your personal data.
        </li>
      </ul>

      <h2>Your rights</h2>
      <ul>
        <li>
          <strong>Export.</strong> Download everything we hold for you as JSON
          from <a href="/dashboard/settings">Settings → Account</a>.
        </li>
        <li>
          <strong>Delete.</strong> Soft-delete with a 30-day grace window from
          the same screen. After the grace window expires the data is
          permanently removed.
        </li>
        <li>
          <strong>Correction.</strong> Edit your profile directly. For
          analytics rows you can&apos;t edit yourself, open a GitHub issue.
        </li>
      </ul>

      <h2>Data retention</h2>
      <p>
        Account rows persist until you delete them. Soft-deleted accounts
        wipe completely 30 days after the deletion request. Analytics rows
        are kept indefinitely (no PII; just timestamps + country code).
        Rate-limit buckets self-prune outside their window.
      </p>

      <h2>Children</h2>
      <p>
        LinkFolio isn&apos;t designed for users under 13. We don&apos;t
        knowingly collect data from children. If you believe we have, contact
        us and we&apos;ll remove it.
      </p>

      <h2>Changes</h2>
      <p>
        Material changes to this policy will be announced on the sign-in page
        at least 14 days in advance.
      </p>

      <h2>Contact</h2>
      <p>Open an issue on the LinkFolio GitHub repo.</p>
    </>
  );
}
