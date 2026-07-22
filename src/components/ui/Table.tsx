"use client";

import React from "react";

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  headers: string[];
  children: React.ReactNode;
}

export function Table({ headers, children, className = "", ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-premium">
      <table className={`w-full text-left border-collapse ${className}`} {...props}>
        <thead>
          <tr className="bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-150 dark:border-zinc-850">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-sm text-zinc-700 dark:text-zinc-350">
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
      className={`hover:bg-zinc-50/40 dark:hover:bg-zinc-800/25 transition-colors ${
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
    <td className={`px-4 py-3 align-middle ${className}`} {...props}>
      {children}
    </td>
  );
}
