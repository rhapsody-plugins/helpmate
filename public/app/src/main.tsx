import { Button } from '@/components/ui/button.tsx';
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.tsx';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.tsx';
import { Input } from '@/components/ui/input.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import { Textarea } from '@/components/ui/textarea.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.tsx';
import { useSettings } from '@/hooks/useSettings.ts';
import {
  HelpMateProWindowType,
  HelpMateWindowType
} from '@/types';
import { useMutation, useQuery } from '@tanstack/react-query';
import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as reactHookForm from 'react-hook-form';
import { toast } from 'sonner';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    wpHelpmateApiSettings: {
      nonce: string;
      site_url: string;
    };
    HelpMate: HelpMateWindowType;
    HelpMatePro: HelpMateProWindowType;
    helpmateShadowRoot: ShadowRoot;
    helpmateReactRoot: HTMLElement;
  }
}

window.HelpMate = {
  React,
  ReactDOM,
  useQuery,
  useMutation,
  sonner: toast,
  reactHookForm,
  useSettings,
  components: {
    Button,
    Card: {
      Card: Card,
      CardHeader: CardHeader,
      CardTitle: CardTitle,
      CardDescription: CardDescription,
      CardAction: CardAction,
    },
    Form: {
      Form: Form,
      FormControl: FormControl,
      FormField: FormField,
      FormItem: FormItem,
      FormLabel: FormLabel,
      FormMessage: FormMessage,
    },
    Input,
    Select: {
      Select: Select,
      SelectContent: SelectContent,
      SelectItem: SelectItem,
      SelectTrigger: SelectTrigger,
      SelectValue: SelectValue,
    },
    Textarea,
    Tooltip: {
      Tooltip: Tooltip,
      TooltipContent: TooltipContent,
      TooltipProvider: TooltipProvider,
      TooltipTrigger: TooltipTrigger,
    },
  },
};

// Mount React app inside the existing shadow DOM
if (window.helpmateReactRoot) {
  createRoot(window.helpmateReactRoot).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  console.error('HelpMate: React root not found in shadow DOM');
}
