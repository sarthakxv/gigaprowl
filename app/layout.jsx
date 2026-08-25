import "./globals.css";

export const metadata = {
  title: "Gigaprowl, the smartest job hunter in the world",
  description: "Upload your resume. Gigaprowl finds the companies and hiring managers, then drafts the outreach: pitch pages, videos, and cadences.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-body text-white antialiased">{children}</body>
    </html>
  );
}
