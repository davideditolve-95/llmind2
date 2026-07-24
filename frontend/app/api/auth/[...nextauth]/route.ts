import NextAuth, { NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";

async function refreshAccessToken(token: any) {
  try {
    const issuer = process.env.KEYCLOAK_ISSUER;
    if (!issuer) {
      throw new Error("Missing KEYCLOAK_ISSUER");
    }
    const tokenUrl = `${issuer}/protocol/openid-connect/token`;
    
    const response = await fetch(tokenUrl, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.KEYCLOAK_CLIENT_ID || "llmind2",
        client_secret: process.env.KEYCLOAK_CLIENT_SECRET || "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken || "",
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + refreshedTokens.expires_in,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fallback to old refresh token
    };
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID || "llmind2",
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || "",
      issuer: process.env.KEYCLOAK_ISSUER || "",
      // Richiedi gli scope necessari: openid, profile, email
      authorization: { params: { scope: "openid profile email" } },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Salva l'access token nell'oggetto JWT di NextAuth quando l'utente effettua il login
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        token.expiresAt = account.expires_at;
        token.refreshToken = account.refresh_token;
        return token;
      }

      // Se il token non è ancora scaduto, restituiscilo
      // expiresAt è in secondi, Date.now() è in millisecondi
      const expiresAtMs = (token.expiresAt as number) * 1000;
      // Refresh se mancano meno di 30 secondi alla scadenza
      if (Date.now() < expiresAtMs - 30 * 1000) {
        return token;
      }

      // Il token è scaduto o sta per scadere: prova a rinfrescarlo
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      // Espone l'access token e l'eventuale errore alla sessione lato client
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Consente URL di callback relativi
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Consente solo URL appartenenti al medesimo dominio originario di dev/prod
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) return url;
      } catch (e) {
        // ignora URL malformati
      }
      return baseUrl;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  debug: process.env.NEXTAUTH_DEBUG === "true",
  secret: process.env.NEXTAUTH_SECRET || process.env.SECRET_KEY,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
