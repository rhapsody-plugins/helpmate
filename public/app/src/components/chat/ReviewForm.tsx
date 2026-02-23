'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

interface ReviewFormProps {
  onSubmit: (rating: number, message: string) => void;
  onCancel?: () => void;
  onSkip?: () => void;
  isLoading?: boolean;
}

export function ReviewForm({
  onSubmit,
  onCancel,
  onSkip,
  isLoading,
}: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [message, setMessage] = useState('');
  const { icon_shape } = useTheme();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating > 0) {
      onSubmit(rating, message);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full',
        icon_shape === 'square'
          ? 'rounded-none'
          : icon_shape === 'circle'
          ? 'rounded-xl'
          : icon_shape === 'rounded'
          ? 'rounded-lg'
          : icon_shape === 'rectangle'
          ? 'rounded-lg'
          : 'rounded-xl'
      )}
    >
      <div className="flex-1 p-6 flex flex-col items-center justify-center">
        <h2 className="text-xl font-semibold mb-2 text-center">
          How was your experience?
        </h2>
        <p className="text-sm text-muted-foreground mb-6 text-center">
          Please rate your chat session
        </p>

        {/* Star Rating */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="focus:outline-none transition-transform hover:scale-110"
              disabled={isLoading}
            >
              <Star
                size={40}
                className={cn(
                  'transition-colors',
                  star <= (hoveredRating || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-gray-200 text-gray-200'
                )}
              />
            </button>
          ))}
        </div>

        {/* Message Input */}
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <Textarea
            placeholder="Share your feedback (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mb-4 min-h-[100px] resize-none"
            disabled={isLoading}
          />

          {/* Buttons */}
          <div className="flex gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
            )}
            {onSkip && (
              <Button
                type="button"
                variant="outline"
                onClick={onSkip}
                disabled={isLoading}
                className="flex-1"
              >
                Skip
              </Button>
            )}
            <Button
              type="submit"
              disabled={rating === 0 || isLoading}
              className="flex-1"
            >
              {isLoading ? 'Submitting...' : 'Submit Review'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

