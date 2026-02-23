import { TicketBubble } from '@/components/chat/TicketBubble';
import Loading from '@/components/Loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import useActivity from '@/hooks/useActivity';
import { useCrm } from '@/hooks/useCrm';
import { useSettings } from '@/hooks/useSettings';
import type { TicketMessage } from '@/types';
import { Pencil, Send, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface TicketDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
  contactId: number | null;
  onStatusUpdate?: () => void;
}

export function TicketDetailsSheet({
  open,
  onOpenChange,
  ticketId,
  onStatusUpdate,
}: TicketDetailsSheetProps) {
  const activityHook = useActivity();
  const { useContacts, useContact } = useCrm();
  const [replyMessage, setReplyMessage] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('open');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { getSettingsMutation } = useSettings();
  const { mutate: getSettings } = getSettingsMutation;

  // Contact reassignment state
  const [contactSearch, setContactSearch] = useState('');
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);

  // Fetch contacts for search
  const { data: contactsData } = useContacts({ search: contactSearch }, 1, 50);
  const contacts = contactsData?.contacts || [];

  const { data: ticketMessages, isPending: messagesLoading } =
    activityHook.getTicketMessages;
  const { isPending: replyLoading } = activityHook.replyToTicket;
  const { isPending: statusLoading } = activityHook.updateTicketStatus;

  const messages: TicketMessage[] = ticketMessages?.messages ?? [];
  const ticket = ticketMessages?.ticket;

  // Fetch linked contact if ticket has contact_id
  const { data: linkedContact } = useContact(
    ticket?.contact_id ?? null,
    open && !!ticket?.contact_id
  );

  // Handle contact reassignment
  const handleAssignContact = async (newContactId: number) => {
    if (!ticketId) return;

    await activityHook.assignContactToTicket.mutateAsync({
      ticket_id: ticketId,
      contact_id: newContactId,
    });

    // Refresh ticket messages to get updated contact_id
    activityHook.getTicketMessages.mutate({ ticket_id: ticketId });
    setContactPopoverOpen(false);
    setContactSearch('');

    // Refresh parent ticket list if callback provided
    if (onStatusUpdate) {
      onStatusUpdate();
    }
  };

  // Apply customization styles
  useEffect(() => {
    getSettings('customization', {
      onSuccess: (data) => {
        if (data) {
          const {
            primary_color,
            primary_gradient,
            secondary_color,
            secondary_gradient,
            font_size,
            icon_size,
            position,
            bot_icon,
          } = data;
          document.documentElement.style.setProperty(
            '--primary-2',
            primary_color as unknown as string
          );
          document.documentElement.style.setProperty(
            '--primary-gradient',
            primary_gradient as unknown as string
          );
          document.documentElement.style.setProperty(
            '--secondary-2',
            secondary_color as unknown as string
          );
          document.documentElement.style.setProperty(
            '--secondary-gradient',
            secondary_gradient as unknown as string
          );
          document.documentElement.style.setProperty(
            '--font-size',
            font_size as unknown as string
          );
          document.documentElement.style.setProperty(
            '--icon-size',
            icon_size as unknown as string
          );
          document.documentElement.style.setProperty(
            '--position',
            position as unknown as string
          );
          document.documentElement.style.setProperty(
            '--bot-icon',
            bot_icon as unknown as string
          );
        }
      },
    });
  }, [getSettings]);

  // Fetch messages when ticketId changes and sheet is open
  useEffect(() => {
    if (ticketId && open) {
      activityHook.getTicketMessages.mutate({ ticket_id: ticketId });
      // Get initial status from ticket
      if (ticket) {
        setSelectedStatus(ticket.status);
      }
    }
  }, [ticketId, open]);

  // Update status when ticket data loads
  useEffect(() => {
    if (ticket?.status) {
      setSelectedStatus(ticket.status);
    }
  }, [ticket?.status]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleReply = async () => {
    if (!replyMessage.trim() || !ticketId) return;

    const replyMessageText = replyMessage;
    setReplyMessage('');

    await activityHook.replyToTicket.mutateAsync({
      ticket_id: ticketId,
      message: replyMessageText,
    });

    // Refresh messages
    activityHook.getTicketMessages.mutate({
      ticket_id: ticketId,
    });
  };

  const handleStatusChange = async (status: string) => {
    if (!ticketId) return;

    await activityHook.updateTicketStatus.mutateAsync({
      ticket_id: ticketId,
      status,
    });

    setSelectedStatus(status);

    // Refresh parent ticket list
    if (onStatusUpdate) {
      onStatusUpdate();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:!max-w-2xl flex flex-col h-full gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle className="!text-lg !font-semibold !m-0 !p-0">
            {ticket?.subject || 'Ticket Details'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex relative flex-col flex-1 h-full">
          {/* Header Section */}
          <div className="p-4 border-b">
            <div className="flex justify-between items-center">
              <Select
                value={selectedStatus}
                onValueChange={handleStatusChange}
                disabled={statusLoading}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-2 items-center">
                {ticket?.source && (
                  <Badge variant="outline">{ticket.source}</Badge>
                )}
                {/* Contact info with edit capability */}
                <div className="flex gap-2 items-center">
                  {linkedContact ? (
                    <div className="flex gap-3 items-center text-sm">
                      <div className="flex flex-col items-end">
                        <span className="font-medium">
                          {linkedContact.first_name} {linkedContact.last_name}
                        </span>
                        {linkedContact.email && (
                          <span className="text-muted-foreground">
                            {linkedContact.email}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-center items-center w-8 h-8 rounded-full bg-primary/10">
                        <span className="text-xs font-medium text-primary">
                          {(linkedContact.first_name || linkedContact.email || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ) : (() => {
                    const firstMessage = messages[0];
                    const userName = firstMessage?.metadata?.name as string;
                    const userEmail = firstMessage?.metadata?.email as string;

                    return userName || userEmail ? (
                      <div className="flex gap-3 items-center text-sm">
                        <div className="flex flex-col items-end">
                          <span className="font-medium">
                            {userName || userEmail}
                          </span>
                          {userName && userEmail && (
                            <span className="text-muted-foreground">
                              {userEmail}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-center items-center w-8 h-8 rounded-full bg-primary/10">
                          <span className="text-xs font-medium text-primary">
                            {(userName || userEmail).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Contact reassignment popover */}
                  <Popover open={contactPopoverOpen} onOpenChange={setContactPopoverOpen}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8"
                          >
                            {linkedContact ? (
                              <Pencil className="w-4 h-4" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        {linkedContact ? 'Change Contact' : 'Assign Contact'}
                      </TooltipContent>
                    </Tooltip>
                    <PopoverContent className="p-0 w-72" align="end">
                      <Command>
                        <CommandInput
                          placeholder="Search contacts..."
                          value={contactSearch}
                          onValueChange={setContactSearch}
                        />
                        <CommandEmpty>No contacts found.</CommandEmpty>
                        <CommandGroup className="overflow-y-auto max-h-64">
                          {contacts
                            .filter((c) => c.id !== ticket?.contact_id)
                            .map((contact) => (
                              <CommandItem
                                key={contact.id}
                                onSelect={() => handleAssignContact(contact.id)}
                              >
                                <Checkbox
                                  checked={false}
                                  className="mr-2"
                                />
                                {contact.email} ({contact.first_name}{' '}
                                {contact.last_name})
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="overflow-y-auto flex-1 p-4">
            {messagesLoading ? (
              <Loading />
            ) : messages.length > 0 ? (
              <div className="flex flex-col gap-4">
                {messages.map((message) => (
                  <TicketBubble key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No messages yet.
              </div>
            )}
          </div>

          {/* Reply Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Type your reply..."
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
                disabled={replyLoading}
              />
              <Button
                onClick={handleReply}
                disabled={!replyMessage.trim() || replyLoading}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

