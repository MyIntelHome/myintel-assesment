import type { Metadata } from "next";
import "./globals.css";
import "./workspace.css";
import "@/components/FamilyFlow.css";
import "./redesign.css";

export const metadata: Metadata = {
  title: "MyIntel | Home Check",
  description: "Guided home checks, clinician assessments and a clear path to professional support.",
  robots: { index: false, follow: false },
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }], apple: "/myintel-symbol.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <nav
          className="no-print"
          aria-label="MyIntel website"
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px 24px", padding: "12px 24px", background: "#e6f1fb", borderBottom: "1px solid #d4e2f0", color: "#1e3258", fontSize: "16px" }}
        >
          <span style={{ fontWeight: 800 }}>HomeCheck by MyIntel</span>
          <a
            href="https://myintelhome.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontWeight: 800, textDecoration: "underline", textUnderlineOffset: "3px", padding: "8px 0" }}
          >
            ← Back to MyIntel website <span style={{ fontWeight: 400 }}>(opens a new tab)</span>
          </a>
        </nav>
        {children}
      </body>
    </html>
  );
}

