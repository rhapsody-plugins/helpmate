import { Badge } from '@/components/ui/badge';
import { __, sprintf } from '@/lib/utils';
import { Contact } from '@/types/crm';

interface ContactPillsProps {
  contacts?: Contact[];
  maxDisplay?: number;
}

export function ContactPills({ contacts, maxDisplay = 2 }: ContactPillsProps) {
  if (!contacts || contacts.length === 0) {
    return (
      <span className="text-muted-foreground text-sm">{__('No contacts')}</span>
    );
  }

  const displayContacts = contacts.slice(0, maxDisplay);
  const remaining = contacts.length - maxDisplay;

  const getContactName = (contact: Contact) => {
    const firstName = contact.first_name?.trim();
    const lastName = contact.last_name?.trim();
    if (firstName || lastName) {
      return [firstName, lastName].filter(Boolean).join(' ');
    }
    return contact.email;
  };

  return (
    <div className="flex gap-1 items-center flex-wrap">
      {displayContacts.map((contact) => (
        <Badge key={contact.id} variant="outline" className="text-xs">
          {getContactName(contact)}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="secondary" className="text-xs">
          {sprintf(
            /* translators: %d: Count of additional items not shown */
            __('+%d more'),
            remaining
          )}
        </Badge>
      )}
    </div>
  );
}
