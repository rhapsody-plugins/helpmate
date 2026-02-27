import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HelpmateURL } from '@/lib/constants';
import { formatDistanceToNow, parse } from 'date-fns';
import { Bell, X } from 'lucide-react';
import { toast } from 'sonner';

const parseOrderTime = (timeString: string): Date => {
  try {
    return parse(timeString, 'MMM dd, yyyy h:mm a', new Date());
  } catch {
    try {
      return parse(timeString, 'MMM dd,yyyy h:mm a', new Date());
    } catch {
      try {
        return new Date(timeString);
      } catch {
        return new Date();
      }
    }
  }
};

interface Order {
  customer_name: string;
  product_name: string;
  product_image: string;
  product_url: string;
  time: string;
  type: 'sale' | 'download' | 'review';
}

// Dismiss: by id first; then dismiss all so toast closes even if id doesn't match (e.g. portaled Toaster)
const dismissToast = (id: string) => {
  toast.dismiss(id);
  toast.dismiss();
};

export const DefaultToast = ({ order, t }: { order: Order; t: string }) => (
  <Card className="relative flex flex-row items-center gap-2 w-full max-w-[320px] rounded-full p-0 pr-10 border-primary-300 shadow-lg">
    <button
      type="button"
      aria-label="Close"
      onClick={() => dismissToast(t)}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute top-[2px] right-4 z-10 flex size-9 items-center justify-center rounded-full text-[#0093E5] hover:bg-black/5"
    >
      <X className="size-4" />
    </button>
    <img
      src={order.product_image || ''}
      alt={order.product_name}
      className="w-20 h-20 ml-[-1px] my-[-1px] rounded-full border border-primary-300"
    />
    <div className="flex flex-col">
      <div className="text-xs">
        <span className="font-bold truncate max-w-[100px] text-[#64748B]">
          {order.customer_name}
        </span>{' '}
        <span className="text-neutral-500">
          {order.type === 'sale'
            ? 'just bought'
            : order.type === 'download'
              ? 'just downloaded'
              : 'just reviewed'}
        </span>
      </div>
      <Button
        variant="link"
        className="justify-start p-0 h-auto cursor-pointer hover:no-underline"
        onClick={() => order.product_url && window.open(order.product_url, '_blank')}
      >
        <div className="text-lg font-semibold truncate max-w-[180px] text-[#0064AB]">
          {order.product_name}
        </div>
      </Button>
      <div className="flex flex-row gap-2 justify-between items-center">
        <span className="flex gap-1 items-center text-xs text-[#0093E5]">
          <Bell className="w-3 h-3 fill-current" /> By{' '}
          <a
            href={HelpmateURL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold cursor-pointer text-[#0093E5]"
          >
            Helpmate
          </a>
        </span>
        <span className="text-xs text-neutral-500 truncate max-w-[90px]">
          {formatDistanceToNow(parseOrderTime(order.time), { addSuffix: true })}
        </span>
      </div>
    </div>
  </Card>
);

export const CompactToast = ({ order, t }: { order: Order; t: string }) => (
  <div className="flex flex-row items-center">
    <img
      src={order.product_image || ''}
      alt={order.product_name}
      className="w-20 h-20 my-[-1px] rounded-full border border-primary-300 z-10 shadow-lg"
    />
    <Card className="flex flex-row relative -ml-8 items-center gap-2 pb-2 pt-6 !pr-16 w-full max-w-[300px] !pl-10 rounded-full shadow-lg">
      <button
        type="button"
        aria-label="Close"
        onClick={() => dismissToast(t)}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-[2px] right-4 z-10 flex size-9 items-center justify-center rounded-full text-[#455CFE] hover:bg-black/5"
      >
        <X className="size-4" />
      </button>
      <div className="flex flex-col">
        <span className="flex absolute top-0 left-10 gap-1 items-center px-2 py-1 text-xs border-t-0 border border-[#9CB8FF] rounded-b-lg bg-[#ecf3ff]  w-fit text-[#0093E5]">
          <Bell className="w-3 h-3 fill-current text-[#0093E5]" /> By{' '}
          <a
            href={HelpmateURL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold cursor-pointer text-[#0093E5]"
          >
            Helpmate
          </a>
        </span>
        <div className="flex flex-row flex-wrap gap-1 items-center pl-2 mt-1 text-xs">
          <span className="font-bold text-[#64748B]">{order.customer_name}</span>
          <span className="text-neutral-500">
            {order.type === 'sale'
              ? 'bought'
              : order.type === 'download'
                ? 'downloaded'
                : 'reviewed'}
          </span>
          <Button
            variant="link"
            className="justify-start p-0 h-auto cursor-pointer hover:no-underline"
            onClick={() => order.product_url && window.open(order.product_url, '_blank')}
          >
            <div className="font-semibold truncate max-w-[50px] text-[#0064AB]">
              {order.product_name}
            </div>
          </Button>
        </div>
        <div className="flex flex-row flex-wrap gap-2 items-center pl-2 mb-1">
          <span className="text-xs text-neutral-500">
            {formatDistanceToNow(parseOrderTime(order.time), {
              addSuffix: true,
            })}
          </span>
        </div>
      </div>
    </Card>
  </div>
);

export const DetailedToast = ({ order, t }: { order: Order; t: string }) => (
  <Card className="relative flex flex-row items-center gap-2 w-full max-w-[320px] rounded-full p-0 pr-10 border-primary-300 shadow-lg">
    <button
      type="button"
      aria-label="Close"
      onClick={() => dismissToast(t)}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute top-[2px] right-4 z-10 flex size-9 items-center justify-center rounded-full text-[#0093E5] hover:bg-black/5"
    >
      <X className="size-4" />
    </button>
    <img
      src={order.product_image || ''}
      alt={order.product_name}
      className="w-20 h-20 ml-[-1px] my-[-1px] rounded-l-full border border-primary-300"
    />
    <div className="flex flex-col">
      <div className="text-xs">
        <span className="font-bold text-[#64748B]">{order.customer_name}</span>{' '}
        <span className="text-neutral-500">
          {order.type === 'sale'
            ? 'just bought'
            : order.type === 'download'
              ? 'just downloaded'
              : 'just reviewed'}
        </span>
      </div>
      <Button
        variant="link"
        className="justify-start p-0 mb-1 h-auto cursor-pointer hover:no-underline"
        onClick={() => order.product_url && window.open(order.product_url, '_blank')}
      >
        <div className="text-lg font-semibold truncate max-w-[200px] text-[#0064AB]">
          {order.product_name}
        </div>
      </Button>
      <div className="flex flex-row gap-2 justify-between items-center">
        <span className="flex gap-1 items-center -mb-2 -ml-2 text-xs border !border-b-0 !border-l-0 border-[#C2D5FF] rounded-tr-lg text-[#0093E5] py-1 px-2 bg-[#ecf3ff]">
          <Bell className="w-3 h-3 fill-current" /> By{' '}
          <a
            href={HelpmateURL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold cursor-pointer text-[#0093E5]"
          >
            Helpmate
          </a>
        </span>
        <span className="text-xs text-neutral-500 truncate max-w-[80px]">
          {formatDistanceToNow(parseOrderTime(order.time), { addSuffix: true })}
        </span>
      </div>
    </div>
  </Card>
);
