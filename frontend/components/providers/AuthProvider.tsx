"use client";

import { SessionProvider, useSession, signOut } from "next-auth/react";
import React, { useEffect } from "react";

function AuthMonitor({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError") {
      console.warn("Session expired or refresh token invalid. Signing out...");
      signOut({ callbackUrl: "/auth/signin" });
    }
  }, [session]);

  return <>{children}</>;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthMonitor>{children}</AuthMonitor>
    </SessionProvider>
  );
}
