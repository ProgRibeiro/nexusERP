"use client";

import { useCallback } from "react";
import LoginView from "@/components/LoginView";
import { UserSession } from "@/app/actions/userActions";
import { LandingArea, portalBaseUrls } from "@/lib/portalRouting";

function destinationFor(area: LandingArea) {
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (area === "developer" && host.startsWith("dev.")) return portalBaseUrls().developer;
    if (area === "commercial" && host.startsWith("comercial.")) return portalBaseUrls().commercial;
    return "/";
  }
  return "/";
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
