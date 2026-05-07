import { cn } from '@/lib/utils';

type BuyerNodusBrandProps = {
  collapsed?: boolean;
  className?: string;
};

export function BuyerNodusBrand({ collapsed = false, className }: BuyerNodusBrandProps) {
  return (
    <div
      className={cn(
        'flex items-center text-white',
        collapsed ? 'justify-center' : 'gap-2',
        className,
      )}
    >
      <img
        src="/buyer-nodus-isotipo.svg"
        alt="Buyer Nodus"
        className={cn('shrink-0 object-contain', collapsed ? 'h-7 w-7' : 'h-8 w-8')}
      />
      {!collapsed && (
        <span className="text-xl font-bold tracking-tight">
          BUYER NODUS
        </span>
      )}
    </div>
  );
}
