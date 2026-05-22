"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Receipt, 
  Contact2, 
  Settings,
  HelpCircle,
  LogOut,
  Sparkles
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const menuLinks = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Loans", href: "/loans", icon: Receipt },
    { name: "Contacts", href: "/contacts", icon: Contact2 },
  ];

  const subLinks = [
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "Help Center", href: "/help", icon: HelpCircle },
  ];

  return (
    <aside className="d-none d-md-flex flex-column p-4 justify-content-between position-sticky top-0 bg-white border-end" style={{ width: "280px", height: "100vh", zIndex: 10, borderColor: '#E2E8F0' }}>
      
      {/* Top Section: Brand Logo & Navigation */}
      <div className="d-flex flex-column gap-4 w-100">
        
        {/* Brand Header */}
        <div className="d-flex align-items-center gap-2.5 px-2 py-1">
          <div className="bg-dark text-white rounded-3 d-flex align-items-center justify-content-center shadow-sm" style={{ width: "38px", height: "38px", borderRadius: "12px" }}>
            <span className="fw-black" style={{ fontSize: "1.15rem", letterSpacing: "-1px" }}>W</span>
          </div>
          <div>
            <h5 className="fw-black tracking-tight m-0 text-dark" style={{ fontSize: "1.05rem", letterSpacing: "-0.5px" }}>
              Whale Ledger
            </h5>
            <span className="text-muted d-block" style={{ fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.3px" }}>v1.0.4 CORE</span>
          </div>
        </div>

        {/* Main Menu Links */}
        <nav className="d-flex flex-column gap-1 w-100 mt-2">
          <span className="text-uppercase tracking-wider fw-bold text-muted mb-2 px-2" style={{ fontSize: "0.65rem", letterSpacing: "0.8px" }}>
            Main Menu
          </span>
          {menuLinks.map((link) => {
            const isActive = pathname === link.href;
            const IconComponent = link.icon;
            
            return (
              <button
                key={link.name}
                onClick={() => router.push(link.href)}
                className={`btn border-0 w-100 d-flex align-items-center gap-3 px-3 py-2.5 rounded-3 text-start sidebar-nav-item ${isActive ? "active-link text-white" : "text-secondary"}`}
                style={{ fontSize: "0.88rem", fontWeight: isActive ? 600 : 500 }}
              >
                <IconComponent size={18} className={isActive ? "text-white" : "text-muted"} />
                <span>{link.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Preference Settings Section */}
        <div className="d-flex flex-column gap-1 w-100">
          <span className="text-uppercase tracking-wider fw-bold text-muted mb-2 px-2" style={{ fontSize: "0.65rem", letterSpacing: "0.8px" }}>
            Preference Setup
          </span>
          {subLinks.map((link) => {
            const isActive = pathname === link.href;
            const IconComponent = link.icon;
            
            return (
              <button
                key={link.name}
                onClick={() => router.push(link.href)}
                className={`btn border-0 w-100 d-flex align-items-center gap-3 px-3 py-2.5 rounded-3 text-start sidebar-nav-item ${isActive ? "active-link text-white" : "text-secondary"}`}
                style={{ fontSize: "0.88rem", fontWeight: 500 }}
              >
                <IconComponent size={18} className="text-muted" />
                <span>{link.name}</span>
              </button>
            );
          })}
        </div>

      </div>

      {/* Bottom Section: Aesthetic Widget & Profile Card */}
      <div className="w-100 d-flex flex-column gap-3">
        
        {/* Floating Mini Feature Upgrade Card */}
        <div className="p-3 bg-light border rounded-4 glass-sidebar-widget position-relative overflow-hidden" style={{ borderRadius: "16px", animation: "sideWidgetFloat 5s infinite ease-in-out" }}>
          <div className="d-flex align-items-center gap-2 mb-1">
            <Sparkles size={13} className="text-warning" />
            <span className="fw-bold text-dark" style={{ fontSize: "0.75rem" }}>System Ledger Active</span>
          </div>
          <p className="text-muted m-0" style={{ fontSize: "0.68rem", lineHeight: "1.4" }}>
            Your tracking architecture matches your visual layout engine parameters perfectly.
          </p>
        </div>

        {/* User Identity Frame */}
        <div className="d-flex align-items-center justify-content-between p-2 rounded-4 bg-white border" style={{ borderRadius: "16px", borderColor: '#E2E8F0' }}>
          <div className="d-flex align-items-center gap-2">
            <div 
              className="bg-dark text-white rounded-circle d-flex align-items-center justify-content-center fw-bold border border-2 border-white shadow-sm"
              style={{ width: "36px", height: "36px", fontSize: "0.82rem" }}
            >
              JL
            </div>
            <div style={{ maxWidth: "130px" }}>
              <h6 className="text-dark fw-bold m-0 text-truncate" style={{ fontSize: "0.82rem" }}>Justine Lea</h6>
              <span className="text-muted d-block text-truncate" style={{ fontSize: "0.68rem" }}>Developer Account</span>
            </div>
          </div>
          <button className="btn border-0 p-2 text-muted hover:text-danger rounded-3 transition-colors">
            <LogOut size={15} />
          </button>
        </div>

      </div>

    </aside>
  );
}