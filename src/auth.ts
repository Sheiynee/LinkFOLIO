import NextAuth from "next-auth";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import jwt from "jsonwebtoken";
import authConfig from "./auth.config";
import { createAdminClient } from "./lib/supabase/admin";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: SupabaseAdapter({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
      if (supabaseJwtSecret && token.sub) {
        const payload = {
          aud: "authenticated",
          exp: Math.floor(new Date(session.expires).getTime() / 1000),
          sub: token.sub,
          email: session.user.email,
          role: "authenticated",
        };
        session.supabaseAccessToken = jwt.sign(payload, supabaseJwtSecret);
      }
      return session;
    },
  },
  events: {
    async linkAccount({ user, account, profile }) {
      if (!user.id) return;
      const supabase = createAdminClient();

      const { count } = await supabase
        .from("links")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if ((count ?? 0) > 0) return;

      let title: string | null = null;
      let url: string | null = null;
      let icon: string | null = null;

      if (account.provider === "google" && user.email) {
        title = "Email";
        url = `mailto:${user.email}`;
        icon = "mail";
      } else if (account.provider === "github") {
        const login = (profile as { login?: string } | null)?.login;
        const htmlUrl = (profile as { html_url?: string } | null)?.html_url;
        if (htmlUrl || login) {
          title = "GitHub";
          url = htmlUrl ?? `https://github.com/${login}`;
          icon = "github";
        }
      }

      if (title && url) {
        await supabase
          .from("links")
          .insert({ user_id: user.id, title, url, icon, position: 0 });
      }
    },
  },
});
