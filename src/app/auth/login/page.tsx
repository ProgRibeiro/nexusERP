"use client";

import { useCallback } from "react";
import LoginView from "@/components/LoginView";
import { UserSession } from "@/app/actions/userActions";
import { LandingArea, portalBaseUrls } from "@/lib/portalRouting";

function destinationFor(area: LandingArea, platformRole?: UserSession["platformRole"]) {
  const urls = portalBaseUrls();
  const targetByArea: Record<LandingArea, string> = {
    app: urls.app,
    commercial: urls.commercial,
    developer: urls.developer,
  };

  if (typeof window === "undefined") {
    return platformRole === "SUPER_ADMIN" ? targetByArea.developer : targetByArea[area];
  }

  const host = window.location.hostname.toLowerCase();
  const currentAreaHost = new Set([
    new URL(urls.app).hostname,
    new URL(urls.commercial).hostname,
    new URL(urls.developer).hostname,
  ]);

  if (currentAreaHost.has(host)) {
    return window.location.origin;
  }

  if (platformRole === "SUPER_ADMIN") {
    return targetByArea.developer;
  }

  return targetByArea[area];
}

export default function CentralLoginPage() {
  const handleLoginSuccess = useCallback((user: UserSession, area: LandingArea) => {
    const target = destinationFor(area, user.platformRole);
    if (typeof window !== "undefined") {
      window.location.assign(target);
    }
  }, []);

  return <LoginView onLoginSuccess={handleLoginSuccess} />;
}
