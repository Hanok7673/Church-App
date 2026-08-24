import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Church App | नेपाली मण्डली",
  description: "नेपाली चर्च समुदायका लागि संगति, बाइबल, आराधना गीत र सेवाको सरल डिजिटल घर।",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ne">
      <body>{children}</body>
    </html>
  );
}
