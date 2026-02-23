import TeamMemberForm from '@/components/crm/TeamMemberForm';
import Loading from '@/components/Loading';
import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { ReusableTable } from '@/components/ReusableTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSettings } from '@/hooks/useSettings';
import { TeamMember, useTeam } from '@/hooks/useTeam';
import { HelpmatePricingURL } from '@/lib/constants';
import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { Crown, Edit, Plus, Search, Trash2, UserCog } from 'lucide-react';
import { useMemo, useState } from 'react';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  live_chat_agent: 'Live Chat Agent',
  salesperson: 'Salesperson',
  marketer: 'Marketer',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  manager: 'bg-blue-100 text-blue-800',
  live_chat_agent: 'bg-green-100 text-green-800',
  salesperson: 'bg-purple-100 text-purple-800',
  marketer: 'bg-orange-100 text-orange-800',
};

export default function Team() {
  const { getProQuery } = useSettings();
  const { data: isPro } = getProQuery;
  const { useTeamMembers, useRemoveTeamMember, useUserPermissions } = useTeam();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const filters = {
    ...(search && { search }),
    ...(roleFilter && roleFilter !== 'all' && { role: roleFilter }),
  };

  const teamMembersQuery = useTeamMembers(filters);
  // Fetch all team members (without filters) for counting
  const allTeamMembersQuery = useTeamMembers();
  const { data: userPermissions } = useUserPermissions();
  const currentUserId = userPermissions?.user_id;
  const removeTeamMemberMutation = useRemoveTeamMember();

  // Count team members excluding current user
  const teamMemberCount = useMemo(() => {
    if (!allTeamMembersQuery.data || !currentUserId) return 0;
    return allTeamMembersQuery.data.filter(
      (member) => member.user_id !== currentUserId
    ).length;
  }, [allTeamMembersQuery.data, currentUserId]);

  // Filter team members: hide self for managers (but not admins)
  const filteredTeamMembers = useMemo(() => {
    if (!teamMembersQuery.data || !currentUserId || !userPermissions?.roles) {
      return teamMembersQuery.data || [];
    }

    const userRoles = userPermissions.roles;
    const isManager = userRoles.includes('manager');
    const isAdmin = userRoles.includes('admin');

    // If user is a manager but not an admin, filter out self
    if (isManager && !isAdmin) {
      return teamMembersQuery.data.filter(
        (member) => member.user_id !== currentUserId
      );
    }

    // Admins see all team members including themselves
    return teamMembersQuery.data;
  }, [teamMembersQuery.data, currentUserId, userPermissions?.roles]);

  // Check if add button should be disabled
  const isAddDisabled = !isPro && teamMemberCount >= 3;

  // WordPress admins always have access, so we don't need to check here
  // The permission check is handled on the backend

  const handleEdit = (member: TeamMember) => {
    setEditingMember(member);
    setIsFormOpen(true);
  };

  const handleDelete = async (user_id: number) => {
    if (!confirm('Are you sure you want to remove this team member?')) {
      return;
    }
    removeTeamMemberMutation.mutate(user_id);
  };

  const handleAddNew = () => {
    setEditingMember(null);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingMember(null);
  };

  const columns: ColumnDef<TeamMember>[] = [
    {
      accessorKey: 'user',
      header: 'User',
      cell: ({ row }) => {
        const user = row.original.user;
        if (!user) {
          return <span className="text-gray-400">User not found</span>;
        }
        return (
          <div>
            <div className="font-medium">{user.display_name || user.login}</div>
            <div className="text-sm text-gray-500">{user.email}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'roles',
      header: 'Roles',
      cell: ({ row }) => {
        const roles = row.original.roles || [];
        return (
          <div className="flex flex-wrap gap-1">
            {roles.map((role) => (
              <Badge
                key={role}
                className={ROLE_COLORS[role] || 'bg-gray-100 text-gray-800'}
              >
                {ROLE_LABELS[role] || role}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: 'updated_at',
      header: 'Last Updated',
      cell: ({ row }) => {
        const timestamp = row.original.updated_at * 1000; // Convert to milliseconds
        return (
          <span className="text-sm text-gray-500">
            {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const member = row.original;
        return (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(member)}
              className="p-0 w-8 h-8"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(member.user_id)}
              className="p-0 w-8 h-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const availableRoles = Object.keys(ROLE_LABELS);

  return (
    <PageGuard page="control-center-team">
      <div className="gap-0">
        <PageHeader
          title="Team Management"
          rightActions={
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild={!isAddDisabled}>
                  {isAddDisabled ? (
                    <div>
                      <Button
                        onClick={() => window.open(HelpmatePricingURL, '_blank')}
                        className="w-full"
                        size="sm"
                      >
                        <Crown className="w-4 h-4" />
                        Upgrade to Pro
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={handleAddNew}
                      size="sm"
                      disabled={isAddDisabled}
                    >
                      <Plus className="w-4 h-4" />
                      Add Team Member
                    </Button>
                  )}
                </TooltipTrigger>
                {isAddDisabled && (
                  <TooltipContent>
                    <p>Upgrade to Pro to Add More Team Members</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          }
        />

        <div className="overflow-auto flex-1 p-6">
          <Card>
            <CardHeader>
              <CardTitle className="!text-lg !my-0">Team</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 w-4 h-4 text-gray-400 transform -translate-y-1/2" />
                      <Input
                        placeholder="Search by name or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="!pl-8"
                      />
                    </div>
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Table */}
                {teamMembersQuery.isLoading ? (
                  <Loading />
                ) : teamMembersQuery.isError ? (
                  <div className="py-12 text-center text-red-500">
                    Failed to load team members
                  </div>
                ) : !filteredTeamMembers || filteredTeamMembers.length === 0 ? (
                  <div className="py-12 text-center">
                    <UserCog className="mx-auto mb-4 w-12 h-12 text-gray-400" />
                    <h3 className="mb-2 text-lg font-semibold text-gray-900">
                      No team members
                    </h3>
                    <p className="mb-4 text-gray-500">
                      Get started by adding your first team member.
                    </p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild={!isAddDisabled}>
                          {isAddDisabled ? (
                            <div>
                              <Button
                                onClick={() =>
                                  window.open(HelpmatePricingURL, '_blank')
                                }
                                className="w-full"
                              >
                                <Plus className="w-4 h-4" />
                                Upgrade to Pro
                              </Button>
                            </div>
                          ) : (
                            <Button onClick={handleAddNew} disabled={isAddDisabled}>
                              <Plus className="w-4 h-4" />
                              Add Team Member
                            </Button>
                          )}
                        </TooltipTrigger>
                        {isAddDisabled && (
                          <TooltipContent>
                            <p>Upgrade to Pro to Add More Team Members</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ) : (
                  <ReusableTable columns={columns} data={filteredTeamMembers} />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form Dialog */}
        {isFormOpen && (
          <TeamMemberForm
            member={editingMember}
            onClose={handleFormClose}
            onSuccess={handleFormClose}
          />
        )}
      </div>
    </PageGuard>
  );
}
