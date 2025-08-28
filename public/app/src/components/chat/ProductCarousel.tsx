'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { Product } from '@/types';
export function ProductCarousel({ data }: { data: Product[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const maxIndex = data.length - 1;

  const nextProduct = () => {
    setCurrentIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
  };

  const prevProduct = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
  };

  const visibleProducts = () => {
    const products = [];
    const start = currentIndex;
    for (let i = 0; i < 3 && i < data.length; i++) {
      const index = (start + i) % data.length;
      products.push(data[index]);
    }
    return products;
  };

  return (
    <div className="my-2 w-full">
      <div className="flex justify-between items-center mb-2">
        <h3 className="!text-sm !font-medium">Products</h3>
        <div className="flex space-x-1">
          <Button
            variant="outline"
            size="icon"
            className="w-6 h-6"
            onClick={prevProduct}
          >
            <ChevronLeft size={14} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="w-6 h-6"
            onClick={nextProduct}
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
      <div className="flex overflow-hidden space-x-2">
        {visibleProducts().map((product) => (
          <div
            key={product.id}
            className="flex flex-col flex-shrink-0 items-center p-2 w-24 bg-white rounded-md border"
          >
            <img
              src={product.image || '/placeholder.svg'}
              alt={product.name}
              className="object-cover mb-1 w-full h-16"
            />
            <p className="w-full text-xs font-medium text-center truncate">
              {product.name}
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              {product.regular_price && (
                <span className="text-xs line-through text-slate-600">
                  <span
                    className="-mr-0.5"
                    dangerouslySetInnerHTML={{
                      __html: product.currency_symbol,
                    }}
                  />
                  {product.regular_price}
                </span>
              )}
              {product.sale_price && (
                <span className="text-xs font-semibold text-slate-600">
                  <span
                    className="-mr-0.5"
                    dangerouslySetInnerHTML={{
                      __html: product.currency_symbol,
                    }}
                  />
                  {product.sale_price}
                </span>
              )}
            </div>
            <Button
              size="sm"
              className="mt-1 w-full h-6 text-xs hover:bg-primary/20"
              onClick={() => {
                window.open(product.permalink, '_blank');
              }}
            >
              View Details
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
