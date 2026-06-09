import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM AI Assistant — Lead Scoring & Pipeline Analytics",
  description: "Portfolio demo: AI-powered CRM for lead scoring, automated follow-ups, pipeline forecasting, and team analytics."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
