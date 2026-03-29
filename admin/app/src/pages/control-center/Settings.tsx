import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/hooks/useSettings';
import { Bot } from 'lucide-react';
import { useCallback } from 'react';

export default function Settings() {
  const { getModulesQuery, updateSettingsMutation } = useSettings();
  const { data: modulesData } = getModulesQuery;
  const modules = (modulesData ?? {}) as Record<string, boolean>;

  const handleModuleToggle = useCallback(
    async (moduleId: string) => {
      const newSettings = { ...modules, [moduleId]: !modules[moduleId] };
      await updateSettingsMutation.mutateAsync(
        {
          key: 'modules',
          data: newSettings,
        },
        {
          onSuccess: () => {
            getModulesQuery.refetch();
          },
        }
      );
    },
    [modules, updateSettingsMutation, getModulesQuery]
  );

  return (
    <PageGuard page="control-center-settings" requiredRole="admin">
      <div className="gap-0">
        <PageHeader title="Settings" />
        <div className="p-6">
          <h1 className="!text-2xl !font-bold !my-0 !py-0 !mb-4">
            Module Settings
          </h1>

          <div className="space-y-4">
            <Card className="p-6">
              <div className="flex justify-between items-center">
                <div className="flex gap-4 items-center">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Bot className="w-5 h-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="!text-lg !font-semibold !my-0 !py-0">
                      Chatbot
                    </h3>
                    <p className="!text-sm !text-muted-foreground !my-0 !py-0 mt-1">
                      Enable or disable the AI Chatbot module. Requires an API
                      key to be activated.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={modules['chatbot'] ?? false}
                  onCheckedChange={() => handleModuleToggle('chatbot')}
                  disabled={updateSettingsMutation.isPending}
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageGuard>
  );
}
