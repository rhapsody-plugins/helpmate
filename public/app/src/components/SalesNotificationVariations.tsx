import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HelpmateURL } from '@/lib/constants';
import { formatDistanceToNow, parse } from 'date-fns';
import { Bell, X } from 'lucide-react';
import { toast } from 'sonner';

// Helper function to parse date strings in various formats
const parseOrderTime = (timeString: string): Date => {
  try {
    // Try parsing with date-fns for "Jul 13, 2025 10:45 am" format
    return parse(timeString, 'MMM dd, yyyy h:mm a', new Date());
  } catch {
    try {
      // Try alternative format without space after comma
      return parse(timeString, 'MMM dd,yyyy h:mm a', new Date());
    } catch {
      try {
        // Try ISO format
        return new Date(timeString);
      } catch (error) {
        // Last resort: return current date
        console.warn('Failed to parse date:', timeString, error);
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

// Default variation - Current design
export const DefaultToast = ({ order, t }: { order: Order; t: string }) => (
  <Card className="flex flex-row items-center gap-2 w-full max-w-[320px] rounded-full p-0 pr-10 border-primary-300 shadow-lg">
    <Button
      variant="link"
      size="icon"
      onClick={() => toast.dismiss(t)}
      className="absolute top-[2px] right-4"
    >
      <X />
    </Button>
    <img
      src={order.product_image}
      alt={order.product_name}
      className="w-20 h-20 ml-[-1px] my-[-1px] rounded-full border border-primary-300"
    />
    <div className="flex flex-col">
      <div className="text-xs">
        <span className="font-bold truncate max-w-[100px]">
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
        onClick={() => window.open(order.product_url, '_blank')}
      >
        <div className="text-lg font-semibold truncate max-w-[180px]">
          {order.product_name}
        </div>
      </Button>
      <div className="flex flex-row flex-wrap gap-2 justify-between items-center">
        <span className="flex gap-1 items-center text-xs text-primary">
          <Bell className="w-3 h-3" /> by{' '}
          <a
            href={HelpmateURL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold cursor-pointer text-primary"
          >
            Helpmate
          </a>
        </span>
        <span className="text-xs text-neutral-500">
          {formatDistanceToNow(parseOrderTime(order.time), { addSuffix: true })}
        </span>
      </div>
    </div>
  </Card>
);

// Compact variation - More condensed design
export const CompactToast = ({ order, t }: { order: Order; t: string }) => (
  <div className="flex flex-row items-center">
    <img
      src={order.product_image}
      alt={order.product_name}
      className="w-20 h-20 my-[-1px] rounded-full border border-primary-300 z-10 shadow-lg"
    />
    <Card className="flex flex-row relative -ml-8 items-center gap-2 pb-2 pt-6 !pr-16 w-full max-w-[300px] !pl-10 rounded-full shadow-lg">
      <Button
        variant="link"
        size="icon"
        onClick={() => toast.dismiss(t)}
        className="absolute top-[2px] right-4"
      >
        <X />
      </Button>
      <div className="flex flex-col">
        <span className="flex absolute top-0 left-10 gap-1 items-center px-2 py-1 text-xs rounded-b-lg bg-primary/20 w-fit text-primary">
          <Bell className="w-3 h-3" /> by{' '}
          <a
            href={HelpmateURL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold cursor-pointer text-primary"
          >
            Helpmate
          </a>
        </span>
        <div className="flex flex-row flex-wrap gap-1 items-center pl-2 mt-1 text-xs">
          <span className="font-bold">{order.customer_name}</span>
          <span className="text-neutral-500">
            {order.type === 'sale'
              ? 'bought'
              : order.type === 'download'
              ? 'downloaded'
              : 'reviewed'}
          </span>
          {/* <Button
            variant="link"
            className="justify-start p-0 h-auto cursor-pointer hover:no-underline"
            onClick={() => window.open(order.product_url, '_blank')}
          >
            <div className="font-semibold truncate max-w-[200px]">
              {order.product_name}
            </div>
          </Button> */}
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

// Detailed variation - Card style with accent border
export const DetailedToast = ({ order, t }: { order: Order; t: string }) => (
  <Card className="flex flex-row items-center gap-2 w-full max-w-[320px] rounded-full p-0 pr-10 border-primary-300 shadow-lg">
    <Button
      variant="link"
      size="icon"
      onClick={() => toast.dismiss(t)}
      className="absolute top-[2px] right-4"
    >
      <X />
    </Button>
    <img
      src={order.product_image}
      alt={order.product_name}
      className="w-20 h-20 ml-[-1px] my-[-1px] rounded-l-full border border-primary-300"
    />
    <div className="flex flex-col">
      <div className="text-xs">
        <span className="font-bold">{order.customer_name}</span>{' '}
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
        onClick={() => window.open(order.product_url, '_blank')}
      >
        <div className="text-lg font-semibold truncate max-w-[200px]">
          {order.product_name}
        </div>
      </Button>
      <div className="flex flex-row flex-wrap gap-2 justify-between items-center">
        <span className="flex gap-1 items-center -mb-2 -ml-2 text-xs border !border-b-0 !border-l-0 border-primary/30 rounded-tr-lg text-primary py-1 px-2 bg-primary/10">
          <Bell className="w-3 h-3" /> by{' '}
          <a
            href={HelpmateURL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold cursor-pointer text-primary"
          >
            Helpmate
          </a>
        </span>
        <span className="text-xs text-neutral-500">
          {formatDistanceToNow(parseOrderTime(order.time), { addSuffix: true })}
        </span>
      </div>
    </div>
  </Card>
);
