import Image from 'next/image';
import { Star, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Strategy } from './types';

interface StrategyVisualCardProps {
  strategy: Strategy;
  viewMode: 'grid' | 'list';
  onClick: () => void;
  onBuyNow?: (strategy: Strategy) => void;
}

export default function StrategyVisualCard({
  strategy,
  viewMode,
  onClick,
  onBuyNow,
}: StrategyVisualCardProps) {
  const getRiskVariant = () => {
    switch (strategy.riskLevel) {
      case 'low':
        return 'success';
      case 'medium':
        return 'warning';
      case 'high':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const cardClass = viewMode === 'list' ? 'flex flex-row items-start gap-4' : '';
  const thumbnailClass = viewMode === 'list' ? 'w-48 h-32 flex-shrink-0' : 'h-48 w-full';
  const isFree = strategy.price === 'free' || Number(strategy.price) === 0;

  const imageSrc = '/images/alphintra-strategy.png';

  return (
    <div
      onClick={onClick}
      className={`rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all cursor-pointer ${cardClass}`}
    >
      <div className={`relative overflow-hidden bg-gray-100 dark:bg-gray-900 ${thumbnailClass}`}>
        <Image
          src={imageSrc}
          alt={strategy.name}
          fill
          className="object-cover"
          sizes={viewMode === 'list' ? '192px' : '(max-width: 768px) 100vw, 25vw'}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-white font-semibold text-sm line-clamp-1">{strategy.name}</p>
          <p className="text-white/80 text-xs line-clamp-1">{strategy.creatorName}</p>
        </div>

        {strategy.isVerified && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-white/90 dark:bg-gray-800/90 rounded-full flex items-center justify-center backdrop-blur-sm">
            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>

      <div className="p-4 flex-1">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1">
              {strategy.name}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              By {strategy.creatorName}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant={getRiskVariant()}>
            {strategy.riskLevel.charAt(0).toUpperCase() + strategy.riskLevel.slice(1)} Risk
          </Badge>
        </div>

        <div className="flex items-center justify-end text-xs mb-3">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3 text-gray-400 dark:text-gray-500" />
            <span className="text-gray-600 dark:text-gray-400">{strategy.subscriberCount}</span>
         </div>
        </div>

        <div className="flex items-center justify-end mb-3">
         <span className="text-sm font-medium text-gray-700 dark:text-gray-800 bg-yellow-300 px-2 py-1 rounded-lg">
           {isFree ? 'Free' : `$${strategy.price}`}
  </span>
</div>

        <Button
          type="button"
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
          onClick={(e) => {
            e.stopPropagation();
            onBuyNow?.(strategy);
          }}
        >
          {isFree ? 'Get Now' : 'Buy Now'}
        </Button>
      </div>
    </div>
  );
}