'use client';

import { Avatar } from '@/components/chat/Avatar';
import { ContactForm } from '@/components/chat/ContactForm';
import { Coupon } from '@/components/chat/Coupon';
import { FormattedContent } from '@/components/chat/FormattedContent';
import { Handover } from '@/components/chat/Handover';
import { MessageActions } from '@/components/chat/MessageActions';
import { ProductCarousel } from '@/components/chat/ProductCarousel';
import { Ticket } from '@/components/chat/Ticket';
import { useSettings } from '@/hooks/useSettings';
import type { ChatMessage, HandoverData } from '@/types';
import { useState } from 'react';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { getSettingsQuery } = useSettings();
  const { data: settings } = getSettingsQuery;
  const [updatedMessage, setUpdatedMessage] = useState<ChatMessage>(message);

  // Handle contact form submission
  const handleContactFormSubmit = (messageId: string, submitted: boolean) => {
    if (messageId === updatedMessage.id) {
      setUpdatedMessage((prev) => ({
        ...prev,
        data: { ...prev.data, submitted },
      }));
    }
  };

  // Handle order tracking submission
  const handleOrderTrackSubmit = (messageId: string, orderId: string) => {
    if (messageId === updatedMessage.id) {
      setUpdatedMessage((prev) => ({
        ...prev,
        data: { ...prev.data, submitted: true, orderId },
      }));
    }
  };

  const handleTicketSubmit = (messageId: string, submitted: boolean) => {
    if (messageId === updatedMessage.id) {
      setUpdatedMessage((prev) => ({
        ...prev,
        data: { ...prev.data, submitted },
      }));
    }
  };

  const handleRefundReturnSubmit = (messageId: string, submitted: boolean) => {
    if (messageId === updatedMessage.id) {
      setUpdatedMessage((prev) => ({
        ...prev,
        data: { ...prev.data, submitted },
      }));
    }
  };

  return (
    <div
      className={`flex gap-2 ${
        updatedMessage.role === 'user'
          ? 'flex-row-reverse'
          : 'flex-row items-start'
      }`}
    >
      {/* Avatar */}
      {updatedMessage.role === 'assistant' && (
        <div className="flex-shrink-0 mt-1">
          <Avatar role={updatedMessage.role} />
        </div>
      )}

      <div className="flex flex-col max-w-[75%]">
        {/* Message Bubble */}
        <div
          className={`px-3 py-2 rounded-md border border-white ${
            updatedMessage.role === 'user'
              ? 'bg-secondary rounded-br-[4px] rounded-tr-2xl'
              : 'bg-primary/10 rounded-bl-[4px] rounded-tl-2xl'
          }`}
        >
          <FormattedContent
            content={updatedMessage.content}
            imageUrl={updatedMessage.imageUrl}
            className={
              updatedMessage.role === 'user' ? 'text-white' : 'text-neutral-800'
            }
          />

          {/* Specialized UI components based on message type */}
          {updatedMessage.role === 'assistant' && (
            <>
              {updatedMessage.type === 'product-carousel' &&
                updatedMessage.data &&
                'products' in updatedMessage.data && (
                  <ProductCarousel data={updatedMessage.data.products} />
                )}

              {updatedMessage.type === 'coupon' &&
                updatedMessage.data &&
                'code' in updatedMessage.data && (
                  <Coupon data={updatedMessage.data} />
                )}

              {updatedMessage.type === 'contact-form' &&
                updatedMessage.data &&
                'submitted' in updatedMessage.data && (
                  <ContactForm
                    data={updatedMessage.data}
                    messageId={updatedMessage.id}
                    onSubmit={handleContactFormSubmit}
                  />
                )}

              {updatedMessage.type === 'ticket' &&
                updatedMessage.data &&
                'submitted' in updatedMessage.data && (
                  <Ticket
                    data={updatedMessage.data}
                    messageId={updatedMessage.id}
                    onSubmit={handleTicketSubmit}
                  />
                )}

              {updatedMessage.type === 'handover' && updatedMessage.data && (
                <Handover
                  handoverData={updatedMessage.data as HandoverData}
                  messageId={updatedMessage.id}
                  onSubmit={handleTicketSubmit}
                />
              )}

              {updatedMessage.type === 'order-tracker' &&
                updatedMessage.data &&
                'orderId' in updatedMessage.data &&
                settings?.is_pro &&
                window?.HelpMatePro?.isPro &&
                window?.HelpMatePro?.components?.OrderTracker && (
                  <window.HelpMatePro.components.OrderTracker
                    data={updatedMessage.data}
                    messageId={updatedMessage.id}
                    onSubmit={handleOrderTrackSubmit}
                  />
                )}

              {updatedMessage.type === 'refund-return' &&
                updatedMessage.data &&
                'submitted' in updatedMessage.data &&
                settings?.is_pro &&
                window?.HelpMatePro?.isPro &&
                window?.HelpMatePro?.components?.RefundReturn && (
                  <window.HelpMatePro.components.RefundReturn
                    data={updatedMessage.data}
                    messageId={updatedMessage.id}
                    onSubmit={handleRefundReturnSubmit}
                  />
                )}
            </>
          )}
        </div>

        {/* Footer with actions and timestamp */}
        <div className="flex justify-between items-center mt-1">
          {/* Action buttons for AI messages only */}
          {updatedMessage.role === 'assistant' &&
          !updatedMessage.id.startsWith('welcome') ? (
            <MessageActions
              message={updatedMessage.content}
              messageId={updatedMessage.id}
            />
          ) : (
            <div></div> /* Empty div to maintain layout for user messages */
          )}

          {/* <div
            className={`text-xs ${
              updatedMessage.role === 'user' ? 'text-white' : 'text-neutral-400'
            }`}
          >
            {updatedMessage.createdAt
              ? formatTime(updatedMessage.createdAt)
              : formatTime(new Date())}
          </div> */}
        </div>
      </div>
    </div>
  );
}
