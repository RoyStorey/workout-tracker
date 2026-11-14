import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";
import { Nav, BottomNav } from "@/components/nav";
import { TzSync } from "@/components/tz-sync";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f2ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0b" },
  ],
};

// Applies a saved light/dark choice before paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <TzSync />
        <Nav user={user} />
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6 sm:pb-20 sm:pt-8">{children}</main>
        {user && <BottomNav username={user.username} />}
      </body>
    </html>
  );
}
