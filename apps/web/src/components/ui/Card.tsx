import { type CSSProperties, forwardRef, type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  flat?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { padded = true, flat = false, className, style, ...rest },
  ref,
) {
  const baseStyle: CSSProperties = {
    background: 'var(--surface)',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    padding: padded ? 18 : 0,
    boxShadow: flat ? 'none' : 'var(--shadow-md)',
    ...style,
  };
  return <div ref={ref} className={className} style={baseStyle} {...rest} />;
});
