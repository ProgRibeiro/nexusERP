"use client";

import { useCallback } from "react";
import LoginView from "@/components/LoginView";
import { UserSession } from "@/app/actions/userActions";
import { LandingArea, portalBaseUrls } from "@/lib/portalRouting";

function destinationFor(area: LandingArea, platformRole?: UserSession["platformRole"]) {
  const urls = portalBaseUrls();
  const targetByArea: Record<LandingArea, string> = {
    app: urls.app,
    commercial: `${urls.commercial}/comercial`,
    developer: urls.developer,
  };

  if (typeof window === "undefined") {
    return platformRole === "SUPER_ADMIN" ? targetByArea.developer : targetByArea[area];
  }

  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") {
    return window.location.origin;
  }

  if (platformRole === "SUPER_ADMIN") {
    return targetByArea.developer;
  }

  const desired = targetByArea[area];
  if (host === new URL(desired).hostname) return window.location.origin;
  return desired;
}

export default function CentralLoginPage() {
  const handleLoginSuccess = useCallback((user: UserSession, area: LandingArea) => {
    const target = destinationFor(area, user.platformRole);
    if (typeof window !== "undefined") {
      const redirectTo = new URLSearchParams(window.location.search).get("redirectTo");
      const targetOrigin = new URL(target, window.location.origin).origin;
      const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
      if ((isLocal || targetOrigin === window.location.origin) && redirectTo?.startsWith("/") && !redirectTo.startsWith("//")) {
        window.location.assign(redirectTo);
        return;
      }
    }
    if (typeof window !== "undefined") {
      window.location.assign(target);
    }
  }, []);

  return <LoginView onLoginSuccess={handleLoginSuccess} />;
}
