import "./globals.css";

export const metadata = {
  title: "Prowl — the smartest job hunter in the world",
  description: "Upload your resume. Prowl finds the companies, the hiring managers, and does the outreach — personalized landing pages, videos, and cadences, on autopilot.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-body text-white antialiased">{children}</body>
    </html>
  );
}
