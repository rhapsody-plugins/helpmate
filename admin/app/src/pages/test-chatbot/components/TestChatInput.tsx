import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMain } from '@/contexts/MainContext';
import { useSettings } from '@/hooks/useSettings';
import { ImageIcon, Send, X } from 'lucide-react';
import { useMemo, useRef } from 'react';

interface TestChatInputProps {
  input: string;
  setInput: (value: string) => void;
  image: File | null;
  setImage: (file: File | null) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export function TestChatInput({
  input,
  setInput,
  image,
  setImage,
  onSubmit,
  isLoading,
}: TestChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { modules } = useMain();
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;

  // Check if image search is enabled and Pro is active
  const imageSearch = useMemo(
    () => modules?.['image-search'] ?? false,
    [modules]
  );

  const hasProAccess = useMemo(() => {
    return isPro;
  }, [isPro]);

  // Check if running on localhost
  const isLocalhost = useMemo(() => {
    const hostname = window.location.hostname;
    const result =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.');
    console.log('Localhost check:', { hostname, isLocalhost: result });
    return result;
  }, []);

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveImage = () => {
    setImage(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('Image selected:', file.name, 'isLocalhost:', isLocalhost);
      setImage(file);
    }
  };

  // Debug log for warning display
  if (image) {
    console.log('Warning display check:', {
      isLocalhost,
      hasImage: !!image,
      shouldShow: isLocalhost && !!image,
    });
  }

  return (
    <div className="p-4">
      {/* Image preview */}
      {image && (
        <div className="relative mb-3">
          <div className="flex gap-2 items-center p-2 bg-gray-50 rounded-md border border-gray-200">
            <img
              src={URL.createObjectURL(image)}
              alt="Preview"
              className="object-cover w-16 h-16 rounded"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">{image.name}</p>
              <p className="text-xs text-gray-500">
                {(image.size / 1024).toFixed(2)} KB
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={handleRemoveImage}
              className="w-8 h-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Type your test message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="w-full"
          />
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageChange}
          accept="image/*"
          className="hidden"
        />

        {/* Image upload button - only show if Pro and image-search enabled */}
        {hasProAccess && imageSearch && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleImageButtonClick}
            disabled={isLoading}
            title="Upload image"
          >
            <ImageIcon className="w-4 h-4" />
          </Button>
        )}
        <Button
          type="submit"
          disabled={isLoading || !input.trim() || (isLocalhost && !!image)}
          className="flex gap-2 items-center"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>

      {/* Localhost image search warning */}
      {isLocalhost && image && (
        <div className="p-2 mt-2 bg-yellow-50 rounded-md border border-yellow-200">
          <p className="text-xs text-yellow-800 !m-0 !p-0">
            ⚠️ Image search is not available on localhost. Please deploy to a
            live server to use image search features.
          </p>
        </div>
      )}
    </div>
  );
}
