import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCrm } from '@/hooks/useCrm';
import { siteToDatetimeLocal } from '@/pages/crm/contacts/utils';
import { TaskFilters as TaskFiltersType } from '@/types/crm';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface TaskFiltersProps {
  filters: TaskFiltersType;
  onFiltersChange: (filters: TaskFiltersType) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TaskFilters({
  filters,
  onFiltersChange,
  open,
  onOpenChange,
  children,
}: TaskFiltersProps & { children?: React.ReactNode }) {
  const { useCustomFields, useSearchWpUsers } = useCrm();
  const { data: customFields } = useCustomFields('task');
  const { data: users } = useSearchWpUsers();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto-open advanced filters if any are active
  useEffect(() => {
    const hasAdvancedFilters =
      filters.due_date_from ||
      filters.due_date_to ||
      filters.overdue ||
      filters.has_contacts;
    if (hasAdvancedFilters && !showAdvanced) {
      setShowAdvanced(true);
    }
  }, [filters.due_date_from, filters.due_date_to, filters.overdue, filters.has_contacts]);

  const statusField = customFields?.find((f) => f.field_name === 'status');
  const priorityField = customFields?.find((f) => f.field_name === 'priority');

  const updateFilter = (key: keyof TaskFiltersType, value: string | number | boolean | undefined) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.keys(filters).length > 0;
  const hasAdvancedFilters =
    filters.due_date_from ||
    filters.due_date_to ||
    filters.overdue ||
    filters.has_contacts;

  const filtersContent = (
    <PopoverContent className="w-96" align="end">
      <div className="flex flex-col max-h-[50vh]">
        <div className="flex flex-shrink-0 justify-between items-center mb-3">
          <h4 className="!font-medium !text-lg !my-0">Filters</h4>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="xs"
              onClick={clearFilters}
            >
              Clear All
            </Button>
          )}
        </div>
        <div className="overflow-y-auto pr-2 -mr-2 space-y-3">

        {/* Search Filter */}
        <div className="p-3 space-y-2 rounded-lg border border-border">
          <div className="mb-2 text-sm font-medium">Search</div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search tasks..."
              value={filters.search || ''}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="!pl-8"
            />
          </div>
        </div>

        {/* Status Filter */}
        {statusField && statusField.field_options && (
          <div className="p-3 space-y-2 rounded-lg border border-border">
            <div className="mb-2 text-sm font-medium">Status</div>
            <Select
              value={filters.status || 'all'}
              onValueChange={(value) =>
                updateFilter('status', value === 'all' ? undefined : value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statusField.field_options.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Priority Filter */}
        {priorityField && priorityField.field_options && (
          <div className="p-3 space-y-2 rounded-lg border border-border">
            <div className="mb-2 text-sm font-medium">Priority</div>
            <Select
              value={filters.priority || 'all'}
              onValueChange={(value) =>
                updateFilter('priority', value === 'all' ? undefined : value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {priorityField.field_options.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Assigned To Filter */}
        <div className="p-3 space-y-2 rounded-lg border border-border">
          <div className="mb-2 text-sm font-medium">Assigned To</div>
          <Select
            value={
              filters.assigned_to === undefined
                ? 'all'
                : String(filters.assigned_to)
            }
            onValueChange={(value) =>
              updateFilter(
                'assigned_to',
                value === 'all' ? undefined : value === 'unassigned' ? 'unassigned' : value === 'me' ? 'me' : Number(value)
              )
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              <SelectItem value="me">My Tasks</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {users?.map((user) => (
                <SelectItem key={user.id} value={String(user.id)}>
                  {user.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Advanced Filters */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="justify-between w-full text-sm"
            >
              <span className="flex gap-2 items-center">
                Advanced Filters
                {hasAdvancedFilters && (
                  <span className="flex justify-center items-center w-5 h-5 text-xs rounded-full bg-primary text-primary-foreground">
                    •
                  </span>
                )}
              </span>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pt-3 space-y-3">
              {/* Due Date From */}
              <div className="p-3 space-y-2 rounded-lg border border-border">
                <Label htmlFor="due_date_from" className="mb-2 text-sm font-medium">Due From</Label>
                <Input
                  id="due_date_from"
                  type="datetime-local"
                  value={siteToDatetimeLocal(filters.due_date_from) || ''}
                  onChange={(e) => updateFilter('due_date_from', e.target.value)}
                />
              </div>

              {/* Due Date To */}
              <div className="p-3 space-y-2 rounded-lg border border-border">
                <Label htmlFor="due_date_to" className="mb-2 text-sm font-medium">Due To</Label>
                <Input
                  id="due_date_to"
                  type="datetime-local"
                  value={siteToDatetimeLocal(filters.due_date_to) || ''}
                  onChange={(e) => updateFilter('due_date_to', e.target.value)}
                />
              </div>

              {/* Overdue Only */}
              <div className="p-3 space-y-2 rounded-lg border border-border">
                <div className="mb-2 text-sm font-medium">Overdue Only</div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="overdue"
                    checked={filters.overdue || false}
                    onCheckedChange={(checked) =>
                      updateFilter('overdue', checked === true ? true : undefined)
                    }
                  />
                  <Label
                    htmlFor="overdue"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Overdue only
                  </Label>
                </div>
              </div>

              {/* Has Contacts */}
              <div className="p-3 space-y-2 rounded-lg border border-border">
                <div className="mb-2 text-sm font-medium">Has Contacts</div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has_contacts"
                    checked={
                      filters.has_contacts === undefined ? undefined : filters.has_contacts
                    }
                    onCheckedChange={(checked) =>
                      updateFilter(
                        'has_contacts',
                        checked === 'indeterminate' ? undefined : checked
                      )
                    }
                  />
                  <Label
                    htmlFor="has_contacts"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Has contacts
                  </Label>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
        </div>
      </div>
    </PopoverContent>
  );

  if (children) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              {children}
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Filter tasks</TooltipContent>
        </Tooltip>
        {filtersContent}
      </Popover>
    );
  }

  // Fallback to old style if no children (for backward compatibility)
  // Return just the content without Popover wrapper
  return filtersContent;
}

// Export filter count calculation helper
export function getTaskFilterCount(filters: TaskFiltersType): number {
  const hasAdvancedFilters =
    filters.due_date_from ||
    filters.due_date_to ||
    filters.overdue ||
    filters.has_contacts;

  return [
    filters.search ? 1 : 0,
    filters.status ? 1 : 0,
    filters.priority ? 1 : 0,
    filters.assigned_to !== undefined ? 1 : 0,
    hasAdvancedFilters ? 1 : 0,
  ].reduce((a, b) => a + b, 0);
}
