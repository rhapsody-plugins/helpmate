import api from '@/lib/axios';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import {
  UNMAPPED_FIELD,
  type FormConfigState,
  type IntegrationFormsResponse,
  type IntegrationRegistryItem,
} from '../types';

type UseIntegrationConfigArgs = {
  definition: IntegrationRegistryItem;
  sheetOpen: boolean;
  updateSettings: (args: { key: string; data: { forms: Record<number, FormConfigState> } }) => Promise<unknown>;
};

export function useIntegrationConfig({
  definition,
  sheetOpen,
  updateSettings,
}: UseIntegrationConfigArgs) {
  const [configs, setConfigs] = useState<Record<number, FormConfigState>>({});

  const formsQuery = useQuery<IntegrationFormsResponse, Error>({
    queryKey: [definition.queryKey],
    queryFn: async () => {
      const response = await api.get(definition.formsEndpoint);
      return response.data;
    },
    refetchOnWindowFocus: false,
    enabled: sheetOpen,
  });

  useEffect(() => {
    const forms = formsQuery.data?.forms ?? [];
    const initial: Record<number, FormConfigState> = {};
    forms.forEach((form) => {
      initial[form.id] = {
        enabled: !!form.config.enabled,
        action: form.config.action ?? '',
        field_map: form.config.field_map ?? {},
      };
    });
    setConfigs(initial);
  }, [formsQuery.data?.forms]);

  const updateConfig = useCallback((formId: number, patch: Partial<FormConfigState>) => {
    setConfigs((prev) => ({
      ...prev,
      [formId]: {
        enabled: prev[formId]?.enabled ?? false,
        action: prev[formId]?.action ?? '',
        field_map: prev[formId]?.field_map ?? {},
        ...patch,
      },
    }));
  }, []);

  const updateFieldMap = useCallback(
    (formId: number, targetField: string, sourceFieldName: string) => {
      const value = sourceFieldName === UNMAPPED_FIELD ? '' : sourceFieldName;
      setConfigs((prev) => {
        const nextMap = { ...(prev[formId]?.field_map ?? {}) };
        if (value === '') {
          delete nextMap[targetField];
        } else {
          nextMap[targetField] = value;
        }
        return {
          ...prev,
          [formId]: {
            enabled: prev[formId]?.enabled ?? false,
            action: prev[formId]?.action ?? '',
            field_map: nextMap,
          },
        };
      });
    },
    []
  );

  const saveConfig = useCallback(async () => {
    await updateSettings({
      key: definition.settingsKey,
      data: { forms: configs },
    });
    await formsQuery.refetch();
  }, [configs, definition.settingsKey, formsQuery, updateSettings]);

  return {
    formsQuery,
    configs,
    updateConfig,
    updateFieldMap,
    saveConfig,
  };
}
