import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google"; 
import "./globals.css";
import { Toaster } from 'sonner'; 
import { SecurityProvider } from '@/context/SecurityContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { LiveChat } from '@/components/LiveChat';

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" }); 

export const viewport: Viewport = {
  width: "device-width",
  viewportFit: "cover",
  themeColor: "#050505", 
};

export const metadata: Metadata = {
  title: "Cryptofin | Beyond Digital Assets",
  description: "The secure, custodial standard for the digital economy.",
  manifest: "/manifest.json", 
  openGraph: {
    title: "Cryptofin | Beyond Digital Assets",
    description: "The secure, custodial standard for the digital economy.",
    images: [
      {
        url: "/hero_main.png",
        width: 1200,
        height: 630,
        alt: "Cryptofin Meta Image",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cryptofin | Beyond Digital Assets",
    description: "The secure, custodial standard for the digital economy.",
    images: ["/hero_main.png"],
  },
  icons: {
    icon: '/hero_main.png', 
    apple: '/hero_main.png', 
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cryptofin",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body 
        suppressHydrationWarning={true}
        className={`${inter.variable} ${outfit.variable} antialiased bg-[#050505] text-white pb-safe`}
      >
        <ThemeProvider>
          <Toaster position="top-center" richColors closeButton />
          <SecurityProvider>
            {children}
          </SecurityProvider>
          <LiveChat />
        </ThemeProvider>
      </body>
    </html>
  );
}
