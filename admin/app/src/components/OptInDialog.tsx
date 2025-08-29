import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDataSource } from '@/hooks/useDataSource';
import { HelpmatePrivacyPolicyURL } from '@/lib/constants';
import { useState } from 'react';

interface OptInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConsent: () => void;
  title?: string;
  description?: string;
  acceptText?: string;
  declineText?: string;
}

export function OptInDialog({
  open,
  onOpenChange,
  onConsent,
  title = 'Consent for Data Training & Storage',
  acceptText = 'Accept & Train',
  declineText = 'Decline',
}: OptInDialogProps) {
  const { updateConsentMutation } = useDataSource();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAccept = async () => {
    setIsUpdating(true);
    try {
      await updateConsentMutation.mutateAsync(true);
      onConsent();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update consent:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDecline = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="!py-0 !my-0 text-left">{title}</DialogTitle>
          <DialogDescription className="!py-0 !my-0 text-left">
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              We’re transparent about how your data is handled while ensuring
              you get the{' '}
              <span className="font-semibold">best performance</span> from your
              Helpmate chatbot.
            </p>

            <div className="space-y-6">
              <section>
                <ul className="!pl-6 space-y-3 !list-disc text-slate-700 dark:text-slate-200">
                  <li>
                    <span className="font-semibold">
                      Your data, your choice
                    </span>{' '}
                    — Only the content you explicitly provide will be stored.
                    This information is saved securely in our vector database so
                    your chatbot can understand and respond intelligently.
                  </li>
                  <li>
                    <span className="font-semibold">
                      You control the training
                    </span>{' '}
                    — You decide what data to add. Please avoid including
                    private or sensitive details, since your chatbot may share
                    answers with your customers.
                  </li>
                  <li>
                    <span className="font-semibold">Full flexibility</span> —
                    You can add, update, or delete your training data at any
                    time.
                  </li>
                </ul>
              </section>

              <section>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Why we store your data on our servers
                </h4>
                <ul className="!pl-6 mt-3 space-y-3 !list-disc text-slate-700 dark:text-slate-200">
                  <li>
                    <span className="font-semibold">
                      Better performance, zero hassle
                    </span>{' '}
                    — Currently, there’s no solid method to handle vector data
                    properly in WordPress without extra setup on your end. We
                    manage storage for you to keep things simple. If a reliable
                    WordPress-based option becomes available in the future,
                    we’ll provide a seamless way to migrate your data to your
                    own setup.
                  </li>
                  <li>
                    <span className="font-semibold">
                      High-end infrastructure at no extra cost
                    </span>{' '}
                    — Hosting vector data is resource-intensive. We absorb that
                    cost so you get faster, more reliable performance powered by
                    our optimized servers.
                  </li>
                </ul>
              </section>

              <section className="px-4 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                <p className="text-slate-700 dark:text-slate-200">
                  ✅ You get{' '}
                  <span className="font-semibold">
                    enterprise-level AI performance
                  </span>{' '}
                  without technical overhead, while keeping full control over
                  your data at all times.
                </p>
              </section>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="link"
            className="px-1 text-slate-700 dark:text-slate-200"
            onClick={() => {
              window.open(HelpmatePrivacyPolicyURL, '_blank');
            }}
          >
            Privacy Policy
          </Button>
          <Button
            variant="outline"
            onClick={handleDecline}
            disabled={isUpdating}
            className="w-full sm:w-auto"
          >
            {declineText}
          </Button>
          <Button
            onClick={handleAccept}
            loading={isUpdating}
            disabled={isUpdating}
            className="w-full sm:w-auto"
          >
            {isUpdating ? 'Updating...' : acceptText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
