import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import Providers from "@/components/provider";
import AIAssistant from "@/components/layout/AIAssistant";

export const metadata: Metadata = {
  title: "FCCPC Performance Intelligence System",
  description: "Federal Competition and Consumer Protection Commission",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <Providers>
          <ThemeProvider>
            {children}
            <AIAssistant />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}