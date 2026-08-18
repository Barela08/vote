import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VotePro — Production Real-Time Voting System",
  description: "Secure, real-time election voting platform powered by Next.js, Supabase, and Web Audio.",
  keywords: ["voting", "election", "realtime", "VotePro", "Supabase"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[#080c14] text-slate-100 selection:bg-blue-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
