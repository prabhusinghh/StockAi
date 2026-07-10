import "./globals.css";

export const metadata = {
  title: "AI Investment Research Agent",
  description: "A multi-agent committee that researches a company and decides invest / pass / watch.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
