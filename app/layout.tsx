import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "TeamDocs — Work, written clearly", description: "A calm, lightweight workspace for creating and sharing documents." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
