import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "Terrain Intelligence | Infryne TechWorks",
  description: "Edge-computed terrain feasibility, slope compliance, and earthwork estimation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
