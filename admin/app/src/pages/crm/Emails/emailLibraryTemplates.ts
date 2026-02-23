export interface LibraryTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  description?: string;
}

const c = {
  font: 'font-family: Arial, sans-serif;',
  accent: '#455CFE',
  text: '#666666',
  mute: '#999999',
  bg: '#ffffff',
  card: '#f8f9fa',
  urgency: '#dc3545',
};

export const LIBRARY_TEMPLATES: LibraryTemplate[] = [
  // 1. General – minimal blank canvas
  {
    id: 'general-html',
    name: 'General HTML',
    subject: 'Message from {shop_name}',
    description: 'Minimal blank layout for any purpose',
    body: `<div style="${c.font} margin: 0; padding: 24px; background: ${c.bg}; max-width: 600px; margin: 0 auto;">
  <p style="color: ${c.text}; font-size: 14px; margin: 0 0 16px;">Hello {first_name},</p>
  <h2 style="color: ${c.accent}; font-size: 20px; margin: 0 0 12px;">Email Title</h2>
  <p style="color: ${c.text}; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">Your content here. Use {first_name}, {name}, {email}, {shop_name}.</p>
  <div style="border-left: 4px solid ${c.accent}; padding: 12px 16px; background: ${c.card}; margin: 20px 0;">
    <p style="color: ${c.text}; font-size: 14px; margin: 0;">Details block for variables.</p>
  </div>
  <p style="color: ${c.mute}; font-size: 12px; margin-top: 24px;">Best regards,<br>{shop_name}</p>
</div>`,
  },
  // 2. Welcome – hero banner, high impact
  {
    id: 'welcome-onboarding',
    name: 'Welcome / Onboarding',
    subject: 'Welcome to {shop_name}!',
    description: 'New subscriber or customer welcome',
    body: `<div style="${c.font} margin: 0; padding: 0; background: ${c.bg}; max-width: 600px; margin: 0 auto;">
  <div style="background: ${c.accent}; color: white; padding: 40px 24px; text-align: center;">
    <h1 style="margin: 0; font-size: 28px; letter-spacing: -0.5px;">Welcome, {first_name}!</h1>
    <p style="margin: 12px 0 0; font-size: 16px; opacity: 0.95;">You're in. Here's what's next.</p>
  </div>
  <div style="padding: 28px;">
    <p style="color: ${c.text}; font-size: 15px; line-height: 1.7;">Thank you for joining {shop_name}. We're excited to have you. Use the button below to get started.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="#" style="display: inline-block; background: ${c.accent}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: bold;">Get Started</a>
    </div>
    <p style="color: ${c.mute}; font-size: 12px;">Best regards,<br>{shop_name}</p>
  </div>
</div>`,
  },
  // 3. Newsletter – two-column, content-rich
  {
    id: 'marketing-newsletter',
    name: 'Marketing Newsletter',
    subject: 'Our latest updates just for you',
    description: 'Promotional newsletter with hero and CTA',
    body: `<div style="${c.font} margin: 0; padding: 0; background: ${c.bg}; max-width: 600px; margin: 0 auto;">
  <div style="padding: 28px; text-align: center; background: ${c.card}; border-bottom: 3px solid ${c.accent};">
    <h2 style="color: ${c.accent}; margin: 0; font-size: 24px;">Don't Miss Out</h2>
    <p style="color: ${c.text}; font-size: 14px; margin: 10px 0 0;">Hi {first_name}, here's what's new this week.</p>
  </div>
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="width: 58%; padding: 24px; vertical-align: top;">
        <h3 style="color: ${c.accent}; margin: 0 0 12px; font-size: 17px;">Featured</h3>
        <p style="color: ${c.text}; font-size: 14px; margin: 0; line-height: 1.6;">Your main content, links, and updates go here.</p>
      </td>
      <td style="width: 42%; padding: 24px; vertical-align: top; background: ${c.card};">
        <h3 style="color: ${c.accent}; margin: 0 0 10px; font-size: 15px;">Quick Links</h3>
        <p style="color: ${c.text}; font-size: 13px; margin: 0; line-height: 1.8;">• Link one<br>• Link two<br>• Link three</p>
      </td>
    </tr>
  </table>
  <div style="text-align: center; padding: 20px;">
    <a href="#" style="display: inline-block; background: ${c.accent}; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-size: 14px;">Learn More</a>
  </div>
  <p style="color: ${c.mute}; font-size: 12px; text-align: center; padding: 16px;">{shop_name}</p>
</div>`,
  },
  // 4. Product Announcement – bold product focus
  {
    id: 'product-announcement',
    name: 'Product Announcement',
    subject: 'Introducing our newest product',
    description: 'New product launch',
    body: `<div style="${c.font} margin: 0; padding: 24px; background: ${c.bg}; max-width: 600px; margin: 0 auto;">
  <p style="color: ${c.text}; font-size: 14px; margin: 0;">Hello {first_name},</p>
  <div style="background: ${c.card}; border: 2px dashed ${c.accent}; padding: 48px; text-align: center; margin: 24px 0; border-radius: 8px;">
    <p style="color: ${c.mute}; font-size: 12px; margin: 0;">Product image</p>
  </div>
  <h2 style="color: ${c.accent}; font-size: 24px; margin: 0 0 12px; text-align: center;">Something New Just Landed</h2>
  <p style="color: ${c.text}; font-size: 15px; line-height: 1.6; text-align: center;">Our latest product is here. Designed with you in mind.</p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="#" style="display: inline-block; background: ${c.accent}; color: white; padding: 16px 36px; text-decoration: none; border-radius: 8px; font-size: 15px;">Shop Now</a>
  </div>
  <p style="color: ${c.mute}; font-size: 12px; text-align: center;">{shop_name}</p>
</div>`,
  },
  // 5. Flash Sale – urgency-driven
  {
    id: 'flash-sale',
    name: 'Flash Sale',
    subject: 'Limited time offer – act now!',
    description: 'Urgency-driven sales email',
    body: `<div style="${c.font} margin: 0; padding: 0; background: ${c.bg}; max-width: 600px; margin: 0 auto;">
  <div style="background: ${c.urgency}; color: white; padding: 14px; text-align: center; font-weight: bold; font-size: 15px;">⏰ FLASH SALE – ENDS SOON</div>
  <div style="padding: 28px;">
    <p style="color: ${c.text}; font-size: 14px; margin: 0;">Hi {first_name},</p>
    <h2 style="color: ${c.accent}; font-size: 24px; margin: 16px 0;">Don't Miss This</h2>
    <div style="background: ${c.card}; border: 2px solid ${c.urgency}; padding: 20px; margin: 24px 0; text-align: center; border-radius: 8px;">
      <p style="color: ${c.urgency}; font-weight: bold; font-size: 16px; margin: 0;">Your discount code</p>
    </div>
    <div style="text-align: center;">
      <a href="#" style="display: inline-block; background: ${c.accent}; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 15px;">Claim Offer</a>
    </div>
    <p style="color: ${c.mute}; font-size: 12px; margin-top: 28px;">{shop_name}</p>
  </div>
</div>`,
  },
  // 6. Win-Back – re-engagement
  {
    id: 'win-back',
    name: 'Win-Back / Re-engagement',
    subject: 'We miss you, {first_name}!',
    description: 'Re-engage inactive customers',
    body: `<div style="${c.font} margin: 0; padding: 0; background: ${c.bg}; max-width: 600px; margin: 0 auto;">
  <div style="padding: 28px; background: ${c.card};">
    <p style="color: ${c.text}; font-size: 14px; margin: 0;">Hi {first_name},</p>
    <h2 style="color: ${c.accent}; font-size: 22px; margin: 14px 0;">We Miss You!</h2>
    <p style="color: ${c.text}; font-size: 15px; line-height: 1.7;">It's been a while. We've saved something special for you — come back and see what's new.</p>
  </div>
  <div style="padding: 28px; border-top: 3px solid ${c.accent};">
    <p style="color: ${c.text}; font-size: 14px; margin: 0 0 14px;">Your exclusive offer:</p>
    <div style="background: ${c.card}; padding: 20px; text-align: center; border-radius: 8px;">
      <p style="color: ${c.accent}; font-weight: bold; font-size: 18px; margin: 0;">Your discount here</p>
    </div>
    <div style="text-align: center; margin-top: 20px;">
      <a href="#" style="display: inline-block; background: ${c.accent}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px;">Claim My Offer</a>
    </div>
  </div>
  <p style="color: ${c.mute}; font-size: 12px; padding: 24px;">{shop_name}</p>
</div>`,
  },
  // 7. Review Request – feedback collection
  {
    id: 'review-request',
    name: 'Review Request',
    subject: 'How was your experience?',
    description: 'Post-purchase or service feedback',
    body: `<div style="${c.font} margin: 0; padding: 24px; background: ${c.bg}; max-width: 600px; margin: 0 auto;">
  <p style="color: ${c.text}; font-size: 14px; margin: 0;">Hello {first_name},</p>
  <div style="margin: 28px 0; padding: 28px; background: ${c.card}; border-radius: 12px; text-align: center;">
    <p style="color: ${c.accent}; font-size: 32px; margin: 0;">★ ★ ★ ★ ★</p>
    <h2 style="color: ${c.accent}; font-size: 20px; margin: 14px 0;">Share Your Experience</h2>
    <p style="color: ${c.text}; font-size: 15px; line-height: 1.6; margin: 0;">Your feedback helps others and helps us improve. Would you take a moment to leave a review?</p>
  </div>
  <div style="text-align: center;">
    <a href="#" style="display: inline-block; background: ${c.accent}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px;">Leave a Review</a>
  </div>
  <p style="color: ${c.mute}; font-size: 12px; text-align: center; margin-top: 28px;">Thank you,<br>{shop_name}</p>
</div>`,
  },
  // 8. Event Invitation – date/time CTA
  {
    id: 'event-invitation',
    name: 'Event Invitation',
    subject: "You're invited – join us!",
    description: 'Invite contacts to events or webinars',
    body: `<div style="${c.font} margin: 0; padding: 0; background: ${c.bg}; max-width: 600px; margin: 0 auto;">
  <div style="padding: 28px; text-align: center; background: ${c.accent}; color: white;">
    <h2 style="margin: 0; font-size: 24px;">You're Invited</h2>
    <p style="margin: 10px 0 0; font-size: 14px; opacity: 0.9;">{first_name}, we'd love to see you there.</p>
  </div>
  <div style="padding: 28px;">
    <h3 style="color: ${c.accent}; margin: 0 0 12px; font-size: 18px;">Event Name</h3>
    <p style="color: ${c.text}; font-size: 14px; margin: 0 0 8px;">Date: Add your date</p>
    <p style="color: ${c.text}; font-size: 14px; margin: 0 0 20px;">Time: Add your time</p>
    <p style="color: ${c.text}; font-size: 14px; line-height: 1.6;">Brief description of your event. Why should {first_name} attend?</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="#" style="display: inline-block; background: ${c.accent}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px;">RSVP Now</a>
    </div>
    <p style="color: ${c.mute}; font-size: 12px;">{shop_name}</p>
  </div>
</div>`,
  },
  // 9. Thank You – appreciation (non-transactional)
  {
    id: 'thank-you',
    name: 'Thank You / Appreciation',
    subject: 'Thank you from {shop_name}',
    description: 'General appreciation or milestone',
    body: `<div style="${c.font} margin: 0; padding: 24px; background: ${c.bg}; max-width: 600px; margin: 0 auto;">
  <p style="color: ${c.text}; font-size: 14px; margin: 0;">Hello {first_name},</p>
  <div style="margin: 24px 0; padding: 32px; background: ${c.card}; border-radius: 12px; text-align: center; border-left: 6px solid ${c.accent};">
    <h2 style="color: ${c.accent}; margin: 0 0 12px; font-size: 22px;">Thank You</h2>
    <p style="color: ${c.text}; font-size: 15px; line-height: 1.7; margin: 0;">We wanted to take a moment to say thanks for being part of {shop_name}. We truly appreciate you.</p>
  </div>
  <p style="color: ${c.mute}; font-size: 12px; margin-top: 24px;">With gratitude,<br>{shop_name}</p>
</div>`,
  },
];
