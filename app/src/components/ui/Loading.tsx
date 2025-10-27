export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const Loading = ({ size = 'md', text }: LoadingProps) => {
  const sizeStyles = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div
        className={`${sizeStyles[size]} animate-spin rounded-full border-4 border-primary-200 border-t-primary-900`}
      />
      {text && <p className="text-primary-600 text-sm">{text}</p>}
    </div>
  );
};

/**
 * Skeleton loader for images
 */
export const ImageSkeleton = ({ aspectRatio = '3/2' }: { aspectRatio?: string }) => {
  return (
    <div
      className={`w-full animate-pulse bg-primary-100 rounded-lg`}
      style={{ aspectRatio }}
    />
  );
};

/**
 * Gallery grid skeleton
 */
export const GallerySkeleton = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ImageSkeleton key={i} />
      ))}
    </div>
  );
};
