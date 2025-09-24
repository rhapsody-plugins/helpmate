'use client';

import { QuickOptions } from '@/components/chat/QuickOptions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/context/ThemeContext';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { Send, X } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

interface ChatInputProps {
  input: string;
  image: File | null;
  productId: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleProductIdChange: () => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  isChatOpen: boolean;
  hasStartedConversation: boolean;
  handleQuickOptionClick: (message: string) => void;
}

export function ChatInput({
  input,
  image,
  productId,
  handleInputChange,
  handleImageChange,
  handleProductIdChange,
  handleSubmit,
  isLoading,
  isChatOpen,
  hasStartedConversation,
  handleQuickOptionClick,
}: ChatInputProps) {
  const { icon_shape } = useTheme();
  const { getSettingsQuery } = useSettings();
  const { data: settings } = getSettingsQuery;

  // Memoize expensive computations
  const imageSearch = useMemo(
    () => settings?.modules?.['image-search'] ?? false,
    [settings?.modules]
  );
  const products = useMemo(
    () => settings?.proactive_sales_products ?? [],
    [settings?.proactive_sales_products]
  );
  const product = useMemo(() => {
    return (
      products?.find((product) => productId && product.id === +productId) ??
      null
    );
  }, [products, productId]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Memoize hasProAccess check
  const hasProAccess = useMemo(() => {
    return settings?.is_pro && window?.HelpmatePro?.isPro;
  }, [settings?.is_pro]);

  // Check if running on localhost
  const isLocalhost = useMemo(() => {
    return (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.') ||
      window.location.hostname.startsWith('172.')
    );
  }, []);

  // Check if submit should be disabled due to localhost image search
  const isSubmitDisabled = useMemo(() => {
    return isLoading || !input.trim() || (isLocalhost && !!image);
  }, [isLoading, input, isLocalhost, image]);

  const handleImageButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle image paste from clipboard
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (!hasProAccess || !imageSearch) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            // Create a synthetic event to match the expected interface
            const syntheticEvent = {
              target: { files: [file] },
            } as unknown as React.ChangeEvent<HTMLInputElement>;
            handleImageChange(syntheticEvent);
            e.preventDefault();
            break;
          }
        }
      }
    },
    [hasProAccess, imageSearch, handleImageChange]
  );

  // Handle drag and drop
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!hasProAccess || !imageSearch) return;
      e.preventDefault();
      e.stopPropagation();
    },
    [hasProAccess, imageSearch]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!hasProAccess || !imageSearch) return;
      e.preventDefault();
      e.stopPropagation();
    },
    [hasProAccess, imageSearch]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!hasProAccess || !imageSearch) return;
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          // Create a synthetic event to match the expected interface
          const syntheticEvent = {
            target: { files: [file] },
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          handleImageChange(syntheticEvent);
        }
      }
    },
    [hasProAccess, imageSearch, handleImageChange]
  );

  // Auto-focus textarea when loading becomes false
  useEffect(() => {
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading]);

  // Memoize keydown handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isLoading && input.trim()) {
          handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
        }
      }
    },
    [isLoading, input, handleSubmit]
  );

  return (
    <div
      className={cn(
        'p-4 border-t border-white bg-primary/10',
        icon_shape === 'square'
          ? 'rounded-b-none'
          : icon_shape === 'circle'
          ? 'rounded-b-xl'
          : icon_shape === 'rounded'
          ? 'rounded-b-lg'
          : icon_shape === 'rectangle'
          ? 'rounded-b-lg'
          : 'rounded-b-xl'
      )}
    >
      {/* Quick options - now above the input field */}
      {isChatOpen && !hasStartedConversation && (
        <QuickOptions onOptionClick={handleQuickOptionClick} />
      )}
      {productId && (
        <div className="flex relative gap-2 items-center mb-3 w-full">
          <img
            src={product?.image}
            alt={product?.name}
            className="w-10 h-10 rounded-full"
          />
          <div className="flex flex-col">
            <h3 className="!text-sm !font-medium">{product?.name}</h3>
            <div
              className="text-sm text-gray-500"
              dangerouslySetInnerHTML={{
                __html: product?.price ?? '',
              }}
            />
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={handleProductIdChange}
            className="absolute top-0 right-0 bottom-0 my-auto w-6 h-6 cursor-pointer"
          >
            <X size={10} />
          </Button>
        </div>
      )}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={`flex relative flex-col items-center bg-white rounded-lg border border-input ${
          hasProAccess && imageSearch ? 'cursor-pointer' : ''
        }`}
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDrop={handleDrop}
      >
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          rows={3}
          className="flex-grow bg-white resize-none min-h-[100px] !pb-15 shadow-none !border-none focus-visible:ring-0 focus-visible:ring-offset-0"
          disabled={isLoading}
        />
        <div className="absolute bottom-3 left-3 z-10">
          {settings?.is_pro &&
            window?.HelpmatePro?.isPro &&
            window?.HelpmatePro?.components?.ImageSearch &&
            imageSearch && (
              <window.HelpmatePro.components.ImageSearch
                image={image}
                handleImageChange={handleImageChange}
                handleImageButtonClick={handleImageButtonClick}
                fileInputRef={fileInputRef}
              />
            )}
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={isSubmitDisabled}
          className="absolute right-3 bottom-3 z-10 ml-auto bg-primary"
        >
          <Send size={16} />
        </Button>
      </form>

      {/* Localhost image search warning */}
      {isLocalhost && image && (
        <div className="p-2 mt-2 bg-yellow-50 rounded-md border border-yellow-200">
          <p className="text-xs text-yellow-800">
            ⚠️ Image search is not available on localhost. Please deploy to a
            live server to use image search features.
          </p>
        </div>
      )}
    </div>
  );
}
