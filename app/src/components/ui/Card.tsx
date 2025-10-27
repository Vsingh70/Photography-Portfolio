import { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Card = ({
  hover = false,
  padding = 'md',
  className = '',
  children,
  ...props
}: CardProps) => {
  const baseStyles = 'bg-white rounded-lg shadow-sm border border-primary-200';

  const hoverStyles = hover
    ? 'transition-all duration-300 hover:shadow-md hover:-translate-y-1 cursor-pointer'
    : '';

  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={`${baseStyles} ${hoverStyles} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
