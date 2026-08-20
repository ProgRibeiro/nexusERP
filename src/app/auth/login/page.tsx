"use client";

import { useCallback } from "react";
import LoginView from "@/components/LoginView";
import { UserSession } from "@/app/actions/userActions";
import { LandingArea, portalBaseUrls } from "@/lib/portalRouting";

function destinationFor(area: LandingArea) {
  const urls = portalBaseUrls();
  if (area === "developer") return urls.developer;
  if (area === "commercial") return urls.commercial;
  return urls.app;
}

export default function CentralLoginPage() {
  const handleLoginSuccess = useCallback((_: UserSession, area: LandingArea) => {
    const target = destinationFor(area);
    if (typeof window !== "undefined") {
      window.location.assign(target);
    }
  }, []);

  return <LoginView onLoginSuccess={handleLoginSuccess} />;
}
