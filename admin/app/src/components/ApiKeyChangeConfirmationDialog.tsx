import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { HelpmatePricingURL } from '@/lib/constants';
import { __ } from '@/lib/utils';
import { CrownIcon } from 'lucide-react';

interface ApiKeyChangeConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onUpgrade?: () => void;
}

export function ApiKeyChangeConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  onUpgrade,
}: ApiKeyChangeConfirmationDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      window.open(HelpmatePricingURL, '_blank');
    }
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="!py-0 !my-0 text-left">
            {__('Change Api Key')}
          </DialogTitle>
          <div className="!py-0 !my-0 text-left">
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              {__('Your trained data is')}{' '}
              <span className="font-semibold">{__('bound to your current api key')}</span>.
              {' '}
              {__(
                'Changing your api key will require you to delete all your trained data and train them again.'
              )}
            </p>

            <div className="space-y-6">
              <section>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {__('What happens when you change your api key:')}
                </h4>
                <ul className="!pl-6 mt-3 space-y-3 !list-disc text-slate-700 dark:text-slate-200">
                  <li>
                    <span className="font-semibold">{__('All trained data will be lost')}</span>{' '}
                    — {__('Your chatbot will lose all the knowledge it has learned from your training data.')}
                  </li>
                  <li>
                    <span className="font-semibold">{__("You'll need to retrain everything")}</span>{' '}
                    — {__("You'll have to upload and train all your data again from scratch.")}
                  </li>
                  <li>
                    <span className="font-semibold">{__('Temporary service interruption')}</span>{' '}
                    — {__('Your chatbot may not work properly until you retrain your data.')}
                  </li>
                </ul>
              </section>

              <section>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {__('Better alternative: Upgrade your api key')}
                </h4>
                <ul className="!pl-6 mt-3 space-y-3 !list-disc text-slate-700 dark:text-slate-200">
                  <li>
                    <span className="font-semibold">{__('Keep all your trained data')}</span>{' '}
                    — {__('Your chatbot retains all its knowledge and continues working seamlessly.')}
                  </li>
                  <li>
                    <span className="font-semibold">{__('Get more features and credits')}</span>{' '}
                    — {__('Unlock advanced features and higher usage limits.')}
                  </li>
                  <li>
                    <span className="font-semibold">{__('No downtime or retraining')}</span>{' '}
                    — {__('Your chatbot keeps working without any interruption.')}
                  </li>
                </ul>
              </section>

              <section className="px-4 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                <p className="text-slate-700 dark:text-slate-200">
                  💡 <span className="font-semibold">{__('Recommendation:')}</span>{' '}
                  {__('If you need more features or credits, consider upgrading your api key instead of changing it. This way you keep all your trained data and get better performance.')}
                </p>
              </section>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="w-full sm:w-auto"
          >
            {__('Cancel')}
          </Button>
          <Button
            variant="default"
            onClick={handleUpgrade}
            className="w-full bg-blue-600 sm:w-auto hover:bg-blue-700"
          >
            <CrownIcon className="mr-2 w-4 h-4" />
            {__('Upgrade ApiKey')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            className="w-full sm:w-auto"
          >
            {__('Change ApiKey Anyway')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
