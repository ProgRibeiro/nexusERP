"use client";

import { useCallback } from "react";
import LoginView from "@/components/LoginView";
import { UserSession } from "@/app/actions/userActions";
import { LandingArea, portalBaseUrls } from "@/lib/portalRouting";

export default function CommercialLoginPage() {
  const handleLoginSuccess = useCallback((user: UserSession, area: LandingArea) => {
    const urls = portalBaseUrls();
    const target = user.platformRole === "SUPER_ADMIN"
      ? urls.developer
      : area === "commercial"
        ? urls.commercial
        : area === "developer"
          ? urls.developer
          : urls.app;
    window.location.assign(target);
  }, []);

  return <LoginView variant="commercial" onLoginSuccess={handleLoginSuccess} />;
}
