import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBotSettings } from '@/hooks/useBotSettings';
import { useMutation, useQuery } from '@tanstack/react-query';
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as reactHookForm from 'react-hook-form';
import { toast } from 'sonner';
import './index.css';
import App from './App.tsx';

// Expose for Pro components (OrderTracker, RefundReturn) in Social Inbox
declare global {
  interface Window {
    Helpmate?: {
      React: typeof React;
      useQuery: typeof useQuery;
      useMutation: typeof useMutation;
      sonner: typeof toast;
      reactHookForm: typeof reactHookForm;
      useSettings: typeof useBotSettings;
      components: {
        Button: typeof Button;
        Card: {
          Card: typeof Card;
          CardHeader: typeof CardHeader;
          CardTitle: typeof CardTitle;
          CardDescription: typeof CardDescription;
          CardAction: typeof CardAction;
        };
        Form: {
          Form: typeof Form;
          FormControl: typeof FormControl;
          FormField: typeof FormField;
          FormItem: typeof FormItem;
          FormLabel: typeof FormLabel;
          FormMessage: typeof FormMessage;
        };
        Input: typeof Input;
        Select: {
          Select: typeof Select;
          SelectContent: typeof SelectContent;
          SelectItem: typeof SelectItem;
          SelectTrigger: typeof SelectTrigger;
          SelectValue: typeof SelectValue;
        };
        Textarea: typeof Textarea;
        Tooltip: {
          Tooltip: typeof Tooltip;
          TooltipContent: typeof TooltipContent;
          TooltipProvider: typeof TooltipProvider;
          TooltipTrigger: typeof TooltipTrigger;
        };
      };
    };
  }
}

window.Helpmate = {
  React,
  useQuery,
  useMutation,
  sonner: toast,
  reactHookForm,
  useSettings: useBotSettings,
  components: {
    Button,
    Card: {
      Card,
      CardHeader,
      CardTitle,
      CardDescription,
      CardAction,
    },
    Form: {
      Form,
      FormControl,
      FormField,
      FormItem,
      FormLabel,
      FormMessage,
    },
    Input,
    Select: {
      Select,
      SelectContent,
      SelectItem,
      SelectTrigger,
      SelectValue,
    },
    Textarea,
    Tooltip: {
      Tooltip,
      TooltipContent,
      TooltipProvider,
      TooltipTrigger,
    },
  },
};

const rootElement = document.getElementById('helpmate-root');
if (!rootElement) throw new Error('Root element not found');

// Create portal container before React mounts to prevent WordPress DOM conflicts
// Place it as a sibling of the root so React doesn't clear it when mounting
let portalContainer = document.getElementById('helpmate-portal-root');
if (!portalContainer) {
  portalContainer = document.createElement('div');
  portalContainer.id = 'helpmate-portal-root';
  // Insert as sibling after the root element
  if (rootElement.parentNode) {
    rootElement.parentNode.insertBefore(portalContainer, rootElement.nextSibling);
  } else {
    // Fallback: append to root element if parent doesn't exist
    rootElement.appendChild(portalContainer);
  }
}

// Only use StrictMode in development
const root = createRoot(rootElement);
if (import.meta.env.DEV) {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  root.render(<App />);
}
