import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function MediaPicker({
  imageUrl,
  setImageUrl,
  className,
  defaultImage,
}: {
  imageUrl: string | null;
  setImageUrl: (imageUrl: string) => void;
  className?: string;
  defaultImage: React.ReactNode;
}) {
  const openMediaLibrary = () => {
    const frame = window.wp.media({
      title: 'Select or Upload Image',
      button: {
        text: 'Use this image',
      },
      multiple: false,
    });

    frame.on('select', () => {
      const attachment = frame.state().get('selection').first().toJSON();
      setImageUrl(attachment.url);
    });

    frame.open();
  };

  return (
    <div className={cn('flex gap-2', className)}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Icon"
          className="h-full rounded max-w-9"
        />
      ) : (
        defaultImage
      )}
      <Button
        type="button"
        variant="outline"
        onClick={openMediaLibrary}
        className="flex-auto w-full"
      >
        Select Image
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setImageUrl('')}
        className="flex-auto"
      >
        Clear
      </Button>
    </div>
  );
}
