import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SpliceForge",
  description: "Professional fiber splice diagram builder for ISPs and TelCos",
};

// This root layout is a passthrough. The locale-aware <html>/<body> live in
// app/[locale]/layout.tsx so we can set `lang` correctly. The only routes
// rendered through this root (without a locale prefix) are non-page route
// handlers like /auth/callback, which don't need a DOM document.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
