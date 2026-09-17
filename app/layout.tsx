import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoveMate — Voice Booking Agent",
  description: "Conversational transportation booking assessment"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
