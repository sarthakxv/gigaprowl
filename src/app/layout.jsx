import "./globals.css";
import { Toaster } from "sonner";
import { VIDEO_GENERATION_ENABLED } from "@/lib/constants";

export const metadata = {
  title: "Gigaprowl, the smartest job hunter in the world",
  description: VIDEO_GENERATION_ENABLED
    ? "Upload your resume. Gigaprowl finds the companies and hiring managers, then drafts the outreach: pitch pages, videos, and cadences."
    : "Upload your resume. Gigaprowl finds the companies and hiring managers, then drafts the outreach: pitch pages and cadences.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-body text-white antialiased">
        {children}
        <Toaster
          closeButton
          position="bottom-center"
          richColors
          theme="dark"
          toastOptions={{ duration: 4500 }}
        />
      </body>
    </html>
  );
}
