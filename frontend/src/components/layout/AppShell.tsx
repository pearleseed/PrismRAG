import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

const STORAGE_KEY = "sidebar-collapsed";
const AUTO_COLLAPSE_WIDTH = 1200;
const MOBILE_WIDTH = 768;

export function AppShell() {
  const [userCollapsed, setUserCollapsed] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "true";
  });
  const [autoCollapsed, setAutoCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      const width = window.innerWidth;
      setIsMobile(width < MOBILE_WIDTH);
      setAutoCollapsed(width < AUTO_COLLAPSE_WIDTH && width >= MOBILE_WIDTH);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const collapsed = isMobile ? true : userCollapsed || autoCollapsed;

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setMobileMenuOpen((prev) => !prev);
    } else {
      setUserCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem(STORAGE_KEY, String(next));
        return next;
      });
    }
  }, [isMobile]);

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleSidebar}
        isMobile={isMobile}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <TopBar onMenuClick={() => setMobileMenuOpen(true)} isMobile={isMobile} />
        <main className="flex-1 overflow-hidden relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
