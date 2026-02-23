import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useCrm } from '@/hooks/useCrm';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import type { ContactFormData } from '../schemas';
import { UseFormReturn } from 'react-hook-form';

interface WordPressUserSelectorProps {
  form: UseFormReturn<ContactFormData>;
}

export function WordPressUserSelector({ form }: WordPressUserSelectorProps) {
  const { useSearchWpUsers } = useCrm();
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  const { data: users, isLoading } = useSearchWpUsers(searchQuery);

  const selectedUserId = form.watch('wp_user_id');
  const selectedUser = users?.find((u) => u.id === selectedUserId);

  return (
    <FormField
      control={form.control}
      name="wp_user_id"
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>WordPress User</FormLabel>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    'w-full justify-between',
                    !field.value && 'text-muted-foreground'
                  )}
                >
                  {selectedUser
                    ? `${selectedUser.display_name} (${selectedUser.email})`
                    : 'Select WordPress user...'}
                  <ChevronsUpDown className="ml-2 w-4 h-4 opacity-50 shrink-0" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-full" align="start">
              <Command>
                <CommandInput
                  className="!border-none !ring-0 !ring-offset-0 h-5"
                  placeholder="Search users..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandEmpty>
                  {isLoading ? 'Loading...' : 'No user found.'}
                </CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value=""
                    onSelect={() => {
                      form.setValue('wp_user_id', null);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        !field.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    No user
                  </CommandItem>
                  {users?.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={`${user.id}-${user.display_name}`}
                      onSelect={() => {
                        form.setValue('wp_user_id', user.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          user.id === field.value ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {user.display_name} ({user.email})
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

