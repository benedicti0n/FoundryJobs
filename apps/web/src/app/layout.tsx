import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_NAME } from "@foundryjobs/shared";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Fresh tech hiring alerts for interns, freshers, and 0–3 YOE candidates.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
