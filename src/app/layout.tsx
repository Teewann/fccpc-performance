import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import Providers from "@/components/provider";
import AIAssistant from "@/components/layout/AIAssistant";
import { ScreenShareProvider } from "@/components/screenshare/ScreenShareProvider";
import { ScreenShareOrchestrator } from "@/components/screenshare/ScreenShareUI";
import { ScreenShareWebRTCOrchestrator } from "@/components/screenshare/ScreenShareWebRTC";
import { ToastProvider } from "@/components/ui/ToastProvider";
import AutoLogoutModal from "@/components/layout/AutoLogoutModal";

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
            <ToastProvider>
              <ScreenShareProvider>
                {children}
                <ScreenShareOrchestrator />
                <ScreenShareWebRTCOrchestrator />
                <AIAssistant />
                <AutoLogoutModal />
              </ScreenShareProvider>
            </ToastProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}