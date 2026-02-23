import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { TeamMember, useTeam } from '@/hooks/useTeam';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  live_chat_agent: 'Live Chat Agent',
  salesperson: 'Salesperson',
  marketer: 'Marketer',
};

const teamMemberFormSchema = z
  .object({
    mode: z.enum(['new', 'existing']),
    // New user fields
    username: z.string().optional(),
    email: z.string().optional(),
    password: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    // Password email options (only for new users)
    include_password: z.boolean().optional(),
    send_reset_link: z.boolean().optional(),
    // Existing user field
    user_id: z.number().optional().nullable(),
    // Roles
    roles: z.array(z.string()).min(1, 'At least one role is required'),
  })
  .refine(
    (data) => {
      if (data.mode === 'new') {
        return (
          data.username &&
          data.email &&
          data.password &&
          data.username.length > 0 &&
          data.email.length > 0 &&
          data.password.length > 0
        );
      } else {
        return data.user_id !== null && data.user_id !== undefined;
      }
    },
    {
      message: 'Please fill in all required fields',
      path: ['mode'],
    }
  );

type TeamMemberFormData = z.infer<typeof teamMemberFormSchema>;

interface TeamMemberFormProps {
  member: TeamMember | null;
  onClose: () => void;
  onSuccess: () => void;
  /** When set, form adds only this role (e.g. 'live_chat_agent'); role selector is hidden, existing user uses addRole. */
  addRoleOnly?: string;
}

export default function TeamMemberForm({
  member,
  onClose,
  onSuccess,
  addRoleOnly,
}: TeamMemberFormProps) {
  const { getProQuery } = useSettings();
  const { data: isPro } = getProQuery;
  const {
    useCreateTeamMember,
    useUpdateTeamMember,
    useAddRole,
    useSearchUsers,
    useAvailableRoles,
    useTeamMembers,
    useUserPermissions,
  } = useTeam();
  const createMutation = useCreateTeamMember();
  const updateMutation = useUpdateTeamMember();
  const addRoleMutation = useAddRole();
  const availableRolesQuery = useAvailableRoles();
  const allTeamMembersQuery = useTeamMembers();
  const { data: userPermissions } = useUserPermissions();
  const currentUserId = userPermissions?.user_id;

  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchOpen, setUserSearchOpen] = useState(false);

  const usersQuery = useSearchUsers(userSearchQuery, 20, userSearchOpen);

  const isEditing = member !== null;
  const defaultMode = addRoleOnly ? 'existing' : isEditing ? 'existing' : 'new';

  // Count team members excluding current user
  const teamMemberCount = useMemo(() => {
    if (!allTeamMembersQuery.data || !currentUserId) return 0;
    return allTeamMembersQuery.data.filter(
      (member) => member.user_id !== currentUserId
    ).length;
  }, [allTeamMembersQuery.data, currentUserId]);

  const form = useForm<TeamMemberFormData>({
    resolver: zodResolver(teamMemberFormSchema),
    defaultValues: {
      mode: defaultMode,
      username: '',
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      include_password: false,
      send_reset_link: true,
      user_id: isEditing ? member.user_id : null,
      roles: addRoleOnly ? [addRoleOnly] : isEditing ? member.roles : [],
    },
  });

  const mode = form.watch('mode');
  const selectedUserId = form.watch('user_id');
  const selectedUser = usersQuery.data?.find((u) => u.id === selectedUserId);

  const onSubmit = async (data: TeamMemberFormData) => {
    if (mode === 'new') {
      // Check team member limit for non-Pro users
      if (!isPro && teamMemberCount >= 3) {
        toast.error(
          'Upgrade to Pro to Add More Team Members'
        );
        return;
      }
      // Create new user
      const result = await createMutation.mutateAsync({
        username: data.username!,
        email: data.email!,
        password: data.password!,
        first_name: data.first_name,
        last_name: data.last_name,
        roles: addRoleOnly ? [addRoleOnly] : data.roles,
        include_password: data.include_password ?? false,
        send_reset_link: data.send_reset_link ?? true,
      });
      if (result) {
        onSuccess();
      }
    } else {
      if (!data.user_id) return;
      if (addRoleOnly) {
        // Add role only mode: use useAddRole, don't replace existing roles
        const existingMember = allTeamMembersQuery.data?.find(
          (m) => m.user_id === data.user_id
        );
        if (existingMember?.roles?.includes(addRoleOnly)) {
          toast.error('This user is already a live chat agent');
          return;
        }
        if (!existingMember && !isPro && teamMemberCount >= 3) {
          toast.error('Upgrade to Pro to Add More Team Members');
          return;
        }
        const result = await addRoleMutation.mutateAsync({
          user_id: data.user_id,
          role: addRoleOnly,
        });
        if (result) {
          onSuccess();
        }
      } else {
        // Update existing user (replace roles)
        const result = await updateMutation.mutateAsync({
          user_id: data.user_id,
          data: { roles: data.roles },
        });
        if (result) {
          onSuccess();
        }
      }
    }
  };

  const isLoading =
    createMutation.isPending ||
    updateMutation.isPending ||
    addRoleMutation.isPending;
  const availableRoles = availableRolesQuery.data || [];

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="sm:!max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {addRoleOnly
              ? 'Add Live Chat Agent'
              : isEditing
                ? 'Edit Team Member'
                : 'Add Team Member'}
          </SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto flex-1 p-4 pt-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6"
            >
              {!isEditing && (
                <FormField
                  control={form.control}
                  name="mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mode</FormLabel>
                      <FormControl>
                        <div className="flex gap-4">
                          <Button
                            type="button"
                            variant={
                              field.value === 'new' ? 'default' : 'outline'
                            }
                            onClick={() => {
                              field.onChange('new');
                              form.resetField('user_id');
                            }}
                          >
                            Create New User
                          </Button>
                          <Button
                            type="button"
                            variant={
                              field.value === 'existing' ? 'default' : 'outline'
                            }
                            onClick={() => {
                              field.onChange('existing');
                              form.resetField('username');
                              form.resetField('email');
                              form.resetField('password');
                              form.resetField('first_name');
                              form.resetField('last_name');
                            }}
                          >
                            Select Existing User
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {mode === 'new' && (
                <>
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Username <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Email <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Password <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3 p-4 bg-gray-50 rounded-md">
                    <div className="text-sm font-medium">Welcome Email Options</div>
                    <FormField
                      control={form.control}
                      name="send_reset_link"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value ?? true}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                // If enabling reset link, disable password inclusion
                                if (checked) {
                                  form.setValue('include_password', false);
                                }
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="font-normal cursor-pointer">
                              Send password reset link (recommended)
                            </FormLabel>
                            <p className="text-xs text-gray-500">
                              User will receive a secure link to set their password
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="include_password"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value ?? false}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                // If including password, disable reset link
                                if (checked) {
                                  form.setValue('send_reset_link', false);
                                }
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="font-normal cursor-pointer">
                              Include password in email
                            </FormLabel>
                            <p className="text-xs text-gray-500">
                              Password will be included in the welcome email (less secure)
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              {mode === 'existing' && (
                <FormField
                  control={form.control}
                  name="user_id"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>
                        WordPress User <span className="text-red-500">*</span>
                      </FormLabel>
                      <Popover
                        open={userSearchOpen}
                        onOpenChange={setUserSearchOpen}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              type="button"
                              className={cn(
                                'w-full justify-between',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {selectedUser
                                ? `${selectedUser.display_name} (${selectedUser.email})`
                                : isEditing && selectedUserId && member?.user
                                  ? `${member.user.display_name} (${member.user.email})`
                                  : 'Search and select user...'}
                              <ChevronsUpDown className="ml-2 w-4 h-4 opacity-50 shrink-0" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-full" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              className="!border-none !ring-0 !ring-offset-0 h-5"
                              placeholder="Search users..."
                              value={userSearchQuery}
                              onValueChange={setUserSearchQuery}
                            />
                            <CommandEmpty>
                              {usersQuery.isLoading
                                ? 'Loading...'
                                : 'No user found.'}
                            </CommandEmpty>
                            <CommandGroup>
                              {usersQuery.data?.map((user) => (
                                <CommandItem
                                  key={user.id}
                                  value={`${user.id}-${user.display_name}`}
                                  onSelect={() => {
                                    form.setValue('user_id', user.id);
                                    setUserSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      user.id === field.value
                                        ? 'opacity-100'
                                        : 'opacity-0'
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
              )}

              {isEditing && (
                <div className="p-4 bg-gray-50 rounded-md">
                  <div className="mb-1 text-sm font-medium">Current User</div>
                  <div className="text-sm text-gray-600">
                    {member.user?.display_name || member.user?.login} (
                    {member.user?.email})
                  </div>
                </div>
              )}

              {!addRoleOnly && (
              <FormField
                control={form.control}
                name="roles"
                render={() => (
                  <FormItem>
                    <div>
                      <FormLabel className="text-base">
                        Roles <span className="text-red-500">*</span>
                      </FormLabel>
                      <p className="text-sm text-gray-500">
                        Select one or more roles for this team member
                      </p>
                    </div>
                    {availableRoles.map((role) => (
                      <FormField
                        key={role}
                        control={form.control}
                        name="roles"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={role}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(role)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, role])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== role
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer">
                                {ROLE_LABELS[role] || role}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                    <FormMessage />
                  </FormItem>
                )}
              />
              )}

              <div className="flex gap-3 justify-end pt-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  )}
                  {isEditing ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
