import type { Metadata } from "next";
import "./globals.css";
import "./workspace.css";
import "@/components/FamilyFlow.css";

export const metadata: Metadata = {
  title: "MyIntel Assessment Platform",
  description: "Guided home checks, clinician assessments and a clear path to professional support.",
  robots: { index: false, follow: false },
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
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Nunito:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
