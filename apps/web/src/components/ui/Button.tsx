import { type ButtonHTMLAttributes, type CSSProperties, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'yes' | 'no';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const SIZES: Record<Size, { h: number; px: number; fs: number; r: string }> = {
  sm: { h: 34, px: 14, fs: 13, r: 'var(--radius-button-sm)' },
  md: { h: 46, px: 18, fs: 15, r: 'var(--radius-button)' },
  lg: { h: 54, px: 22, fs: 16, r: 'var(--radius-button-lg)' },
};

function variantStyle(variant: Variant): CSSProperties {
  switch (variant) {
    case 'primary':
      return {
        background: 'var(--accent)',
        color: 'var(--accent-ink)',
        border: '0.5px solid transparent',
        fontWeight: 600,
        boxShadow: 'var(--shadow-sm)',
      };
    case 'secondary':
      return {
        background: 'var(--surface)',
        color: 'var(--ink)',
        border: '0.5px solid var(--border)',
        fontWeight: 500,
        boxShadow: 'var(--shadow-sm)',
      };
    case 'ghost':
      return {
        background: 'transparent',
        color: 'var(--ink)',
        border: '0.5px solid transparent',
        fontWeight: 500,
      };
    case 'danger':
      return {
        background: 'transparent',
        color: 'var(--no)',
        border: '0.5px solid var(--border)',
        fontWeight: 500,
      };
    case 'yes':
      return {
        background: 'var(--yes)',
        color: '#fff',
        border: '0.5px solid transparent',
        fontWeight: 600,
        boxShadow: 'var(--shadow-sm)',
      };
    case 'no':
      return {
        background: 'var(--no)',
        color: '#fff',
        border: '0.5px solid transparent',
        fontWeight: 600,
        boxShadow: 'var(--shadow-sm)',
      };
  }
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, className, style, ...rest },
  ref,
) {
  const sizes = SIZES[size];
  const v = variantStyle(variant);
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      className={className}
      style={{
        appearance: 'none',
        cursor: rest.disabled ? 'default' : 'pointer',
        opacity: rest.disabled ? 0.5 : 1,
        width: block ? '100%' : 'auto',
        height: sizes.h,
        padding: `0 ${sizes.px}px`,
        borderRadius: sizes.r,
        fontFamily: 'var(--font-sans)',
        fontSize: sizes.fs,
        letterSpacing: -0.005,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
        transition: 'transform .08s ease, background .12s ease, box-shadow .12s ease',
        ...v,
        ...style,
      }}
      {...rest}
    />
  );
});
