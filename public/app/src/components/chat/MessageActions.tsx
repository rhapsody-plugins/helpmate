'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MessageActionsProps } from '@/types';
import { useAi } from '@/hooks/useAi';

export function MessageActions({ message, messageId }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { updateChatMetadataMutation } = useAi();
  const { mutateAsync: updateChatMetadata } = updateChatMetadataMutation;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      updateChatMetadata({
        id: parseInt(messageId),
        key: 'copied',
        value: true,
      });
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleFeedback = (type: string, messageId: string) => {
    setFeedback(type);
    // In a real app, you would send this feedback to your backend
    console.log(`User gave ${type} feedback`);
    updateChatMetadata({
      id: parseInt(messageId),
      key: 'feedback',
      value: type,
    });
  };

  return (
    <div className="flex items-center space-x-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 hover:bg-primary/20 ${
                feedback === 'good' ? 'bg-green-100 text-green-600' : ''
              }`}
              onClick={() => handleFeedback('good', messageId)}
            >
              <ThumbsUp size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>This was helpful</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 hover:bg-primary/20 ${
                feedback === 'bad' ? 'bg-red-100 text-red-600' : ''
              }`}
              onClick={() => handleFeedback('bad', messageId)}
            >
              <ThumbsDown size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>This was not helpful</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-primary/20"
              onClick={copyToClipboard}
            >
              {copied ? (
                <Check size={14} className="text-green-600" />
              ) : (
                <Copy size={14} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{copied ? 'Copied!' : 'Copy message'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
