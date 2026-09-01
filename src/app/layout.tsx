import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import Providers from "@/components/provider";
import AIAssistant from "@/components/layout/AIAssistant";
import { ScreenShareProvider } from "@/components/screenshare/ScreenShareProvider";
import { ScreenShareOrchestrator } from "@/components/screenshare/ScreenShareUI";
import { ScreenShareWebRTCOrchestrator } from "@/components/screenshare/ScreenShareWebRTC";
import { ToastProvider } from "@/components/ui/ToastProvider"; // ✅ ADDED

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
            {/* ✅ Wrap the entire app with ToastProvider */}
            <ToastProvider>
              <ScreenShareProvider>
                {children}
                <ScreenShareOrchestrator />
                <ScreenShareWebRTCOrchestrator />
                <AIAssistant />
              </ScreenShareProvider>
            </ToastProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}