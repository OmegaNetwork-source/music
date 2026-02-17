import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { SolanaWalletProviderWrapper } from "@/components/SolanaWalletProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Omega Music",
    description: "AI Music Generation Platform",
    icons: { icon: "/icon.svg" },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <SolanaWalletProviderWrapper>
                    {children}
                </SolanaWalletProviderWrapper>
            </body>
        </html>
    );
}
