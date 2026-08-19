import type { Metadata, Viewport } from "next";
import { Geist, IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { RegisterSW } from "@/components/register-sw";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MemPlayground",
  description:
    "Memory allocation and fragmentation playground: contiguous allocation, compaction, and paging, simulated live.",
  applicationName: "MemPlayground",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MemPlayground",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#14161f" },
    { media: "(prefers-color-scheme: light)", color: "#f2f3f6" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${plexMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overscroll-none">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          {/* Keep toasts below the iOS notch / Dynamic Island. */}
          <Toaster
            position="top-center"
            offset={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
            mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
          />
          <RegisterSW />
        </ThemeProvider>
      </body>
    </html>
  );
}
