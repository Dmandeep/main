import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { Providers } from "@/components/providers";

/**
 * Fonts are bound to --font-display / --font-body / --font-mono HERE AND
 * NOWHERE ELSE. globals.css previously redeclared the same three variables at
 * identical specificity, which made the answer to "what font is this" depend
 * on stylesheet order. See docs/design/ART-DIRECTION-V2.md §4.1.
 *
 * These are declared as plain CSS variables rather than via `next/font/google`
 * on purpose. `next/font` downloads the files at BUILD time, so a build machine
 * that cannot reach fonts.googleapis.com fails outright — which is exactly what
 * happened here, taking every route to a 500. A build must not depend on a
 * third-party network call.
 *
 * The stylesheet link below is a progressive enhancement: when Google is
 * reachable the intended faces load, and when it is not, the fallback stacks
 * render something reasonable instead of nothing. Self-hosting the woff2 files
 * under /public/fonts is the production end state; see the note in
 * docs/design/ART-DIRECTION-V2.md.
 *
 * Display is a serif because every competitor in this category uses a
 * geometric or neo-grotesque sans.
 */
const FONT_STACKS = `
  :root {
    --font-display: "Poppins", ui-sans-serif, system-ui, -apple-system, sans-serif;
    --font-body: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
    --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, "Cascadia Mono", monospace;
  }
`;

export const metadata: Metadata = {
  title: "IdeaSpace — the record of what this campus built",
  description:
    "IdeaSpace is the campus innovation ledger for Lendi Institute. Students post ideas, form teams, submit evidence, and graduate with a verified contribution record the institution can stand behind.",
  keywords: ["campus innovation", "verified contribution", "student projects", "Lendi"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: FONT_STACKS }} />
        {/* Preconnect first so the stylesheet request does not pay for DNS
            and TLS separately on a slow campus connection. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--paper-1)",
                color: "var(--ink-900)",
                border: "1px solid var(--rule)",
                borderRadius: "var(--r-md)",
                fontSize: "14px",
                fontFamily: "var(--font-body)",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
