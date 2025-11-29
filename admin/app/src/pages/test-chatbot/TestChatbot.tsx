import { AlertCircle, FlaskConical, Info, Lightbulb } from 'lucide-react';
import { TestChatWidget } from './components/TestChatWidget';
import { FloatingBar } from '@/components/FloatingBar';
import ReactMarkdown from 'react-markdown';

const ARTICLE_CONTENT = `
Helpmate's AI-powered customer support plugin doesn't just answer questions—it actively sells, upsells, and recovers lost revenue while providing exceptional customer experiences.

### Apps That Will Help You Increase Sales
- Proactive Sales
- Sales Notifications
- Promo Bar
- Coupon Delivery
- Abandoned Cart
- Refund & Return


## Proven Results That Matter

- **Up to 79% Less Support Tasks** - Free your team from repetitive inquiries
- **300% Sales Increase** - AI-powered recommendations drive real revenue growth
- **24/7 AI Support** - Never miss another customer question

---

## Never Miss Another Customer Question With Helpmate Chatbot

Your AI-powered chatbot handles **79% of customer inquiries instantly**, providing accurate answers from your custom knowledge base. No more lost sales from unanswered questions or delayed responses.

**Key Benefits:**
- Instant responses 24/7/365
- Reduces support workload by 67%
- Improves customer satisfaction scores by 24%
- Handles multiple languages automatically

*Research shows AI automation reduces customer support tasks by 68-80% on average*

---

## Turn Every Chat Into a Sales Opportunity With Product Recommendations

Our chatbot doesn't just answer questions—it helps you sell. When a customer mentions what they're looking for, like a "warm jacket," the chatbot shows them relevant products from your store, complete with pictures and prices.

**Proven Results:**
- 31% increase in revenue from product recommendations
- 25% higher conversion rates
- 4.5x more likely to complete purchases
- Personalized suggestions based on customer behavior

*Product recommendations account for up to 31% of e-commerce revenues*

---

## Rescue Hesitant Buyers With Coupon Delivery

Helpmate detects when customers are about to leave and automatically delivers targeted coupons via chat or exit-intent popups, converting abandoning visitors into paying customers.

**Features:**
- Exit-intent coupon triggers
- Customer-requested discounts
- Personalized discount amounts
- A/B tested delivery methods

**Impact:** Increases conversion rates by 30-40% and reduces cart abandonment through timely interventions.

*Live chat users are 513% more likely to make a purchase*

---

## Keep Customers Happy With Order Tracking

Eliminate "Where is my order?" inquiries with automated tracking updates delivered through chat. Your customers stay informed while your support team focuses on revenue-generating activities.

**Results:**
- 40% reduction in support inquiries
- Real-time delivery notifications
- Proactive issue resolution
- 91% of customers actively track their packages

---

## Visual Search Technology With Search Product by Image

Revolutionary visual search allows customers to upload photos and instantly find matching products in your store. Perfect for fashion, home decor, and lifestyle retailers.

**Benefits:**
- 27% higher conversion rates
- Appeals to 62% of Gen Z and millennials
- Reduces search frustration
- Increases product discovery

---

## Build Unstoppable Social Proof With Sales Notifications

Show real-time customer activity with strategic pop notifications that create urgency, build trust, and psychologically influence visitors to take action immediately.

**Results:**
- Increases website conversions by up to 15%
- Creates urgency with real-time activity displays
- Builds trust through transparent customer activity
- Reduces bounce rates by keeping visitors engaged

*Sales-based social proof notifications boost website conversions by 98%*

---

## Intelligent Support Ticket Management With Ticket System Integration

Never let a customer inquiry fall through the cracks with Helpmate's intelligent ticketing system that organizes, prioritizes, and resolves issues faster than ever before.

**Achievements:**
- 95% customer satisfaction rates
- Reduces resolution time by 50% with intelligent routing
- Prevents issues from being overlooked
- Comprehensive analytics on support performance

---

## Intelligent Return & Refund System With Refund & Return

Transform the most frustrating part of e-commerce into a smooth experience that keeps customers happy and reduces your workload.

**Impact:**
- Reduces return-related support inquiries by 25%
- Processes returns 40% faster than manual methods
- Improves customer satisfaction
- Automatically handles return label generation and tracking

---

## Recover Lost Sales With Abandoned Cart Recovery

Don't let thousands in lost revenue slip away. Helpmate's abandoned cart recovery system brings customers back to complete their purchases.

**Results:**
- Recovers 30% of abandoned carts through intelligent follow-up
- Uses multi-channel approach for maximum reach
- Personalizes messages based on abandonment reasons
- Automatically adjusts timing for optimal response rates

*Abandoned cart emails achieve 41.8% open rates and 10.7% conversion rates*

---

## Why Helpmate Works

Every minute your customers wait for support, you're losing sales. Studies show that **67% of customers abandon their purchase** when they can't get immediate help. Meanwhile, hiring support staff costs businesses an average of **$46.69 per ticket resolution**.

Helpmate solves these problems by:
- Providing instant, consistent responses
- Converting more visitors into buyers
- Building lasting customer trust
- Scaling effortlessly as your sales grow

**73% of consumers will switch to competitors after multiple bad experiences.** Don't let that happen to your store.

---

*All statistics and research findings are sourced from industry studies including Monetate, Zendesk, Tidio, Barilliance, Voucherify, and other leading research organizations in e-commerce and customer support.*
`;

export default function TestChatbot() {
  return (
    <div className="flex gap-6 p-6">
      {/* Left Column - Instructions */}
      <div className="overflow-y-auto pr-4 w-full">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="flex gap-2 items-center mb-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold text-gray-900 !m-0 !p-0">Test Chatbot</h1>
            </div>
            <p className="text-gray-600 !m-0">
              Test your AI chatbot responses in a safe environment before your
              customers interact with it.
            </p>
          </div>

          {/* Purpose Section */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex gap-3 items-start">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="mb-2 font-semibold text-blue-900 !m-0">
                  Purpose
                </h3>
                <p className="text-sm text-blue-800 !mb-0">
                  This test environment allows you to evaluate your AI chatbot's
                  responses, test different scenarios, and ensure it's working
                  as expected before going live. All conversations here are
                  marked as debug sessions and won't affect your analytics.
                </p>
              </div>
            </div>
          </div>

          {/* Important Note */}
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="!mb-2 font-semibold text-amber-900 !m-0">
                  Important
                </h3>
                <p className="text-sm text-amber-800 !m-0">
                  While this test environment mirrors the live chatbot, it also
                  displays training instructions when the AI doesn't have enough
                  information to answer the question. You can use this to train
                  the AI to answer the question better. Your customers will not
                  see these instructions or context in the live chatbot.
                </p>
              </div>
            </div>
          </div>

          {/* Testing Tips Section */}
          <div>
            <h3 className="font-semibold text-gray-900 !flex !items-center !gap-2 !mb-3 !m-0">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Testing Tips
            </h3>
            <div className="space-y-3 text-sm text-gray-700">
              <div>
                <p className="mb-1 font-medium text-gray-900">
                  1. Test Common Questions
                </p>
                <p className="text-gray-600">
                  Ask frequently asked questions to verify accuracy of responses
                </p>
              </div>
              <div>
                <p className="mb-1 font-medium text-gray-900">
                  2. Try Edge Cases
                </p>
                <p className="text-gray-600">
                  Test with unusual or complex queries to see how the AI handles
                  them
                </p>
              </div>
              <div>
                <p className="mb-1 font-medium text-gray-900">
                  3. Product Queries
                </p>
                <p className="text-gray-600">
                  Search for products, ask about availability, pricing, and
                  specifications
                </p>
              </div>
              <div>
                <p className="mb-1 font-medium text-gray-900">
                  4. Conversational Flow
                </p>
                <p className="text-gray-600">
                  Test multi-turn conversations to ensure context is maintained
                </p>
              </div>
              <div>
                <p className="mb-1 font-medium text-gray-900">
                  5. Special Features
                </p>
                <p className="text-gray-600">
                  Test image search, order tracking, and other enabled modules
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Test Chat Widget */}
      <div className="flex justify-center items-center w-3/5">
        <TestChatWidget />
      </div>

      <FloatingBar
        title="Helpmate AI Chatbot is not just a chatbot, it helps you increase sales."
        buttonText="Learn How"
        articleTitle="Transform Your WooCommerce Store Into a 24/7 Sales Machine"
        articleContent={
          <div className="max-w-none !prose !prose-sm [&_ul]:!list-disc [&_ol]:!list-decimal [&>ul]:!list-disc [&>ol]:!list-decimal [&_ul]:!ml-3 [&_hr]:!my-4">
            <ReactMarkdown>{ARTICLE_CONTENT}</ReactMarkdown>
          </div>
        }
      />
    </div>
  );
}
