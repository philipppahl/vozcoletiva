import { type ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', className, style, ...rest },
  ref,
) {
  const isPrimary = variant === 'primary';
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      className={`min-h-[44px] rounded-full px-5 py-2.5 text-base font-semibold transition disabled:opacity-50 ${className ?? ''}`}
      style={{
        background: isPrimary ? 'var(--brand)' : 'transparent',
        color: isPrimary ? '#ffffff' : 'var(--text-primary)',
        border: isPrimary ? 'none' : '1px solid var(--border)',
        ...style,
      }}
      {...rest}
    />
  );
});
