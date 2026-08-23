import { forwardRef, type InputHTMLAttributes, useId } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      required,
      id: customId,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const id = customId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-slate-700"
          >
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}
        <div className="relative rounded-lg shadow-sm">
          <input
            ref={ref}
            id={id}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            className={cn(
              'block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-offset-1',
              'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
              error
                ? 'border-red-500 text-red-900 focus:border-red-500 focus:ring-red-500'
                : 'border-slate-300 focus:border-blue-600 focus:ring-blue-600',
              className,
            )}
            {...props}
          />
        </div>
        {error ? (
          <p id={errorId} className="text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-slate-500">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
