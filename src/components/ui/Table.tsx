"use client";

import React from "react";

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  headers: string[];
  children: React.ReactNode;
}

export function Table({ headers, children, className = "", ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto rounded-[22px] border border-slate-200/80 bg-white/95 shadow-[0_12px_35px_rgba(15,23,42,.055)] ring-1 ring-white/70 dark:border-zinc-800 dark:bg-zinc-900/95 dark:ring-white/[.03]">
      <table className={`w-full text-left border-collapse ${className}`} {...props}>
        <thead>
          <tr className="border-b border-slate-200/80 bg-[linear-gradient(180deg,#f8fafc,#f3f6fa)] dark:border-zinc-800 dark:bg-none dark:bg-zinc-800/45">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-5 py-3.5 text-[10px] font-black uppercase tracking-[0.09em] text-slate-500 dark:text-zinc-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm text-zinc-700 dark:divide-zinc-800/80 dark:text-zinc-300">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function TableRow({ children, onClick, className = "", ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      onClick={onClick}
      className={`hover:bg-blue-50/45 dark:hover:bg-blue-950/20 transition-colors duration-150 ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, className = "", ...props }: React.HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-5 py-4 align-middle ${className}`} {...props}>
      {children}
    </td>
  );
}
