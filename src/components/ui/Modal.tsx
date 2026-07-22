"use client";

import React from "react";
import { Overlay } from "./Overlay";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
}

export function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  const sizeClass = {
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  return (
    <Overlay
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      containerClassName="items-center justify-center p-4"
      panelClassName={`w-full ${sizeClass} rounded-2xl max-h-[85vh] animate-in zoom-in-95 duration-150`}
    >
      {children}
    </Overlay>
  );
}
