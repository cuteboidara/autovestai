'use client';

import {
  ButtonHTMLAttributes,
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
} from 'react';

import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ExtendedButtonVariant = ButtonVariant | 'success';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ExtendedButtonVariant;
  asChild?: boolean;
}

const variantClasses: Record<ExtendedButtonVariant, string> = {
  primary:
    'border border-accent bg-accent text-[#0A0E1A] font-semibold hover:border-accentHover hover:bg-accentHover',
  secondary:
    'border border-border bg-surface text-primary hover:bg-page',
  ghost: 'border border-transparent bg-transparent text-secondary hover:bg-page hover:text-primary',
  danger:
    'border border-danger bg-danger text-white hover:opacity-90',
  success:
    'border border-success bg-success text-white hover:opacity-90',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { asChild = false, children, className, variant = 'primary', type = 'button', ...props },
  ref,
) {
  const resolvedClassName = cn(
    'inline-flex h-9 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-medium leading-none transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60',
    variantClasses[variant],
    className,
  );

  if (asChild && children) {
    const child = Children.only(children);

    if (isValidElement<{ className?: string }>(child)) {
      return cloneElement(child, {
        className: cn(resolvedClassName, child.props.className),
      });
    }
  }

  return (
    <button
      ref={ref}
      type={type}
      className={resolvedClassName}
      {...props}
    >
      {children}
    </button>
  );
});
