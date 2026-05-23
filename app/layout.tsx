import React from "react";
import Sidebar from "./components/layout/sidebar";
import "@/app/globals.css";

export const metadata = {
  title: "AuditFlow",
  description: "Premium SaaS system layout engine context configuration",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Bootstrap Layout Core Link */}
        <link 
          rel="stylesheet" 
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" 
        />
      </head>
      <body>
        <div className="d-flex min-vh-100 w-100 overflow-hidden" style={{ backgroundColor: "#F8FAFC" }}>
          
          {/* Persistent Sidebar Navigation Drawer */}
          <Sidebar />

          {/* Scrollable Workspace Window Pane */}
          <div className="flex-grow-1 min-vh-100 overflow-y-auto w-100">
            {children}
          </div>

        </div>
      </body>
    </html>
  );
}