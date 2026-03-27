import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuraDirector — Cinematic Visualization Platform",
  description:
    "Turn story ideas into 20–30 second cinematic teaser videos. AI pre-production for filmmakers, students, and content creators.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
