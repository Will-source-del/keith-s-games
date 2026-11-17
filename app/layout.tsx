import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Keith's Games",
  description: "A collection of fun games made for Keith."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
