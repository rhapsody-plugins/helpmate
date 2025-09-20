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
import { HelpmateProWindowType, HelpmateWindowType } from '@/types';
import { useMutation, useQuery } from '@tanstack/react-query';
import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom';
import { createRoot, Root } from 'react-dom/client';
import * as reactHookForm from 'react-hook-form';
import { toast } from 'sonner';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    helpmateApiSettings: {
      nonce: string;
      site_url: string;
    };
    Helpmate: HelpmateWindowType;
    HelpmatePro: HelpmateProWindowType;
    helpmateShadowRoot: ShadowRoot;
    helpmateReactRoot: HTMLElement;
    helpmateReactRootInstance?: Root;
  }
}

window.Helpmate = {
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

// Function to mount React app
function mountReactApp() {
  if (window.helpmateReactRoot) {
    // Check if root already exists
    if (window.helpmateReactRootInstance) {
      // Update existing root
      window.helpmateReactRootInstance.render(
        <StrictMode>
          <App />
        </StrictMode>
      );
    } else {
      // Create new root
      window.helpmateReactRootInstance = createRoot(window.helpmateReactRoot);
      window.helpmateReactRootInstance.render(
        <StrictMode>
          <App />
        </StrictMode>
      );
    }
  } else {
    console.error('Helpmate: React root not found in shadow DOM');
  }
}

// Wait for shadow DOM to be ready
if (window.helpmateReactRoot) {
  // Shadow DOM already exists
  mountReactApp();
} else {
  // Wait for shadow DOM to be created
  window.addEventListener('helpmate-shadow-ready', mountReactApp);

  // Fallback timeout
  setTimeout(() => {
    if (window.helpmateReactRoot) {
      mountReactApp();
    } else {
      console.error('Helpmate: Shadow DOM not ready after timeout');
    }
  }, 1000);
}
