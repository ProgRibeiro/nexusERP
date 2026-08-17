"use client";

import React from "react";
import { CompanyRegistrationModal } from "@/components/modals/CompanyRegistrationModal";
import { useRouter } from "next/navigation";

export default function EmpresaPage() {
  const router = Router();

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <CompanyRegistrationModal
        isFloating={false}
      />
    </div>
  );
}

function Router() {
  return useRouter();
}
