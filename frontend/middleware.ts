import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/signin",
  },
});

export const config = {
  matcher: [
    /*
     * Protegge tutte le pagine tranne:
     * - L'homepage '/' (e.g. l'esploratore 3D se presente)
     * - Le rotte API di NextAuth '/api/auth/*'
     * - File statici e favicon
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|$).*)",
  ],
};
