import { type HTMLAttributes } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-800 border-slate-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  destructive: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  outline: 'bg-transparent text-slate-700 border-slate-300',
};

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
