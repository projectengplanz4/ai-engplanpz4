import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 ${
            error ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/30' : 'border-slate-300'
          } ${className ?? ''}`}
          {...props}
        />
        {error && <p className="mt-1.5 text-sm text-rose-600">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
