"use client";

import React from "react";
import { Check } from "lucide-react";

interface TimelineStep {
  label: string;
  completed: boolean;
  active?: boolean;
}

interface TimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export function Timeline({ steps, className = "" }: TimelineProps) {
  return (
    <div className={`w-full overflow-x-auto py-4 ${className}`}>
      <div className="flex items-center justify-between min-w-[760px] px-4">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;

          return (
            <React.Fragment key={idx}>
              {/* Step circle */}
              <div className="flex flex-col items-center gap-2 group relative">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 ${
                    step.completed
                      ? "bg-success border-success text-white shadow-lg shadow-success/15"
                      : step.active
                      ? "bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10 scale-105"
                      : "bg-white dark:bg-zinc-800 border-zinc-250 dark:border-zinc-750 text-zinc-400"
                  }`}
                >
                  {step.completed ? (
                    <Check size={16} strokeWidth={3} className="animate-in zoom-in-50 duration-200" />
                  ) : (
                    <span className="text-xs font-bold">{idx + 1}</span>
                  )}
                </div>

                <span
                  className={`text-[10px] font-bold uppercase tracking-wider text-center select-none ${
                    step.completed
                      ? "text-success"
                      : step.active
                      ? "text-primary font-extrabold"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 h-0.5 relative mx-2 -mt-6">
                  <div className="absolute inset-0 bg-zinc-200 dark:bg-zinc-850 rounded" />
                  <div
                    className="absolute inset-y-0 left-0 bg-success transition-all duration-500 rounded"
                    style={{ width: step.completed ? "100%" : "0%" }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
