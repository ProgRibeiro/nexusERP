"use client";

import React from "react";
import { Overlay } from "./Overlay";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Drawer({ isOpen, onClose, title, children }: DrawerProps) {
  return (
    <Overlay
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      containerClassName="justify-end"
      panelClassName="w-full max-w-[440px] h-full rounded-none animate-in slide-in-from-right duration-200"
    >
      {children}
    </Overlay>
  );
}
