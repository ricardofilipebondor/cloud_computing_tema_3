import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YourVoiceYourNotes",
  description: "Record voice notes, transcribe with Google Cloud, listen with TTS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
