export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: 2026-05-21</p>

      <p>
        These terms govern your use of LinkFolio (&quot;the Service&quot;), a creator
        landing-page builder operated by the LinkFolio team (&quot;we&quot;,
        &quot;us&quot;). By creating an account or using the Service you agree
        to these terms. If you don&apos;t agree, don&apos;t use the Service.
      </p>

      <h2>Accounts</h2>
      <p>
        You need a working OAuth provider (Google or GitHub) to sign in. You
        are responsible for keeping access to that provider account secure.
        We may suspend or terminate accounts that violate these terms or that
        are reported for abuse.
      </p>

      <h2>Your content</h2>
      <p>
        You own everything you upload — text, images, fonts, links, theme
        configuration, custom layout. You grant us a non-exclusive license to
        store and display that content for the purpose of running the
        Service (rendering your public page, generating OG share images,
        running analytics).
      </p>
      <p>
        Don&apos;t upload content you don&apos;t have the right to share, and
        don&apos;t use the Service to host illegal material, malware, phishing
        targets, doxxing, harassment, or content that violates third-party
        platform terms (e.g. impersonating someone else&apos;s Twitch channel).
      </p>

      <h2>Third-party platforms</h2>
      <p>
        Widgets pull live data from Twitch, YouTube, GitHub, Discord, Spotify,
        TikTok, and the open web. We don&apos;t control those platforms and
        can&apos;t guarantee their APIs stay available. Widget availability is
        best-effort.
      </p>

      <h2>Storage</h2>
      <p>
        Free accounts include 50 MB of storage across avatars, backgrounds,
        custom fonts, and image elements. Hitting the cap blocks further
        uploads until you remove existing content.
      </p>

      <h2>Account deletion</h2>
      <p>
        You can delete your account from <a href="/dashboard/settings">Settings</a>.
        Deletion is soft for 30 days — your page goes dark immediately but
        you can recover by signing back in within that window. After 30 days
        we hard-delete the row and the associated uploads.
      </p>

      <h2>Termination by us</h2>
      <p>
        We can suspend or close any account that breaks these terms or that
        we&apos;re legally required to remove. We&apos;ll give a reason where
        we&apos;re able to.
      </p>

      <h2>No warranty</h2>
      <p>
        The Service is provided &quot;as is&quot;. We don&apos;t promise it
        will be uninterrupted, error-free, or that the analytics counts are
        exact. To the extent allowed by law, we&apos;re not liable for indirect
        or consequential damages.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. Material changes will be announced on the
        page you sign in from at least 14 days before they take effect.
      </p>

      <h2>Contact</h2>
      <p>Questions? Open an issue on the LinkFolio GitHub repo.</p>
    </>
  );
}
