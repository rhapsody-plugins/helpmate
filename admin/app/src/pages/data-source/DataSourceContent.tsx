import { FloatingBar } from '@/components/FloatingBar';
import Loading from '@/components/Loading';
import PageHeader from '@/components/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useApi } from '@/hooks/useApi';
import { useDataSource } from '@/hooks/useDataSource';
import { useWooCommerce } from '@/hooks/useWooCommerce';
import { MenuItem } from '@/types';
import { RefreshCw } from 'lucide-react';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

// Lazy load tab components
const TabText = lazy(() => import('@/pages/data-source/tabs/TabText'));
const TabUrl = lazy(() => import('@/pages/data-source/tabs/TabUrl'));
const TabPost = lazy(() => import('@/pages/data-source/tabs/TabPost'));
const TabProducts = lazy(() => import('@/pages/data-source/tabs/TabProducts'));
const TabQnA = lazy(() => import('@/pages/data-source/tabs/TabQnA'));
const TabFile = lazy(() => import('@/pages/data-source/tabs/TabFile'));

const TRAINING_ARTICLE = `
## Why Training Data Makes or Breaks Your Chatbot

Your customer has three browser tabs open, comparing your product to competitors. They want to buy from you, but a small, nagging question holds them back: **"What's the return policy if this doesn't fit?"** They can't find the answer instantly. Decision fatigue sets in. They close the tab. You just lost a sale.

This scenario plays out every day on WooCommerce stores. **Uncertainty is a conversion killer.** Customers crave immediate, clear answers, and if they can't get them, they move on.

An AI chatbot is your frontline defense against this revenue leak, but **only if it has the right information.** An untrained chatbot becomes your best salesperson and support agent, working 24/7.

---

## What "Good Training" Actually Means

A smart chatbot has a brain, and you provide it by feeding it high-quality information. Proper training means giving your AI a complete understanding of your business from multiple angles.

### Available Training Sources

**Products**
This is where the magic happens for WooCommerce. By training the chatbot on your products, it can act as a virtual shopping assistant, suggesting items, answering questions about materials, and confirming availability.

**Posts & Pages**
Let the AI learn from your core website content. It can absorb your "About Us" page to answer questions about your brand story or a blog post to guide users on product usage.

**Custom Text**
Have a special promotion this weekend? A temporary change in shipping times? Use custom text to inject timely, specific information without needing to create a whole new page.

**Website URLs**
Train your chatbot on specific web pages—from your site or even external ones like a supplier's sizing guide—to give it a broader knowledge base.

**Q&A Pairs (FAQs)**
This is your direct line to the chatbot's brain. Input the most common questions your customers ask and provide the exact answer you want it to give. It's the fastest way to guarantee accuracy on critical queries.

**Files (CSV, TXT, JSON, PDF, EXCEL)**
Efficiently upload large datasets, like a full product catalog or an extensive list of technical specifications. This is a massive time-saver for stores with complex inventories.

---

## Prioritize Your Training for the Fastest Wins

You don't need to train everything at once. **Focus on the 20% of information that will solve 80% of your customer queries.**

### Follow this order for maximum impact:

1. **Top FAQs** - Start with the 5-10 questions you get asked constantly. "Where is my order?" and "What is your return policy?" are perfect candidates.

2. **Core Policies** - Train your Shipping, Returns, and Privacy Policy pages. These are major sources of buyer hesitation.

3. **Your Top 20 Products** - Focus on your bestsellers first. Ensure the chatbot knows everything about the products that drive the most revenue.

4. **High-Traffic Pages** - Train your homepage, contact page, and any popular landing pages.

---

## Your 7-Point Data Quality Checklist

**Garbage in, garbage out.** Use this checklist to ensure your training data is pristine.

1. **Is it fresh?** - Review training data quarterly to remove outdated info.

2. **Is it duplicated?** - Avoid training the same policy from a page *and* a Q&A. This can confuse the chatbot.

3. **Is it named clearly?** - Use descriptive titles when uploading files or adding custom text (e.g., "Holiday Shipping Deadlines 2025").

4. **Is there one source of truth?** - Designate one page as the master document for key policies to ensure consistency.

5. **Are product images and attributes complete?** - A chatbot can't suggest a "large, blue shirt" if that data isn't in your product listings.

6. **Are product variants clear?** - Ensure sizes, colors, and other options are properly configured so the chatbot can help customers choose.

7. **Is it seasonal?** - Add temporary training data for holiday promos or sales, and remember to remove it when the event is over.

---

## The Simple Workflow for Validating Your Chatbot

How do you know if the training worked? **Test it.**

### 4-Step Validation Process:

1. **Draft 10 Test Questions** - Write questions a real customer would ask. Include a mix of simple FAQs, product queries, and policy questions.

2. **Run the Test** - Ask the chatbot each question and review the response for accuracy and tone.

3. **Adjust the Minimum Match Score** - If the chatbot gives irrelevant answers, increase this score in your settings. If it says "I don't know" too often, lower it slightly. Start around 75-80%.

4. **Fill the Gaps** - If the chatbot fails a question, go back and add the correct information using a Q&A pair or by updating a page. Retest.

---

## Common Pitfalls and How to Fix Them

**Problem: The chatbot gives conflicting answers**
- **Solution:** You likely have duplicate or outdated information. Use the "View Trained Data" feature to find and remove the conflicting source.

**Problem: The chatbot can't answer questions about new products**
- **Solution:** Make AI training part of your new product launch checklist. Every time you add a product to WooCommerce, train your chatbot on it.

**Problem: The chatbot misinterprets slang or typos**
- **Solution:** The AI is designed to handle this, but you can help by creating Q&A pairs for common misspellings or alternative phrasing of a question.

---

## Take Action Today

Training your chatbot is the single most important investment you can make to boost its ROI. **You are not just uploading data; you are building a system that reduces anxiety, builds trust, and guides customers to checkout.**

### Quick Start (30 Minutes):
- Train your top 5 FAQs
- Add your return policy
- Include your top 10 bestselling products

You will immediately see fewer support tickets and give your customers the confidence they need to click "Buy Now."

---

*For more detailed guides, visit the [Helpmate Documentation](https://rhapsodyplugins.com/docs/train-the-right-data-to-make-helpmate-ai-chatbot-useful/)*
`;

// Simple component for right actions - no hooks to avoid violations
function RightActions({
  isApiKeyPending,
  tab,
  apiKeyData,
  syncCredits,
  isSyncing,
}: {
  isApiKeyPending: boolean;
  tab: string;
  apiKeyData:
    | {
        local_credits?: {
          feature_slug: string;
          credits: number;
          usages: number;
        }[];
      }
    | null
    | undefined;
  syncCredits: () => void;
  isSyncing: boolean;
}) {
  if (isApiKeyPending) {
    return <Skeleton className="w-10 h-10" />;
  }

  const isProductTab = tab === 'Products';
  const creditsToShow = isProductTab
    ? apiKeyData?.local_credits?.filter(
        (credit) => credit.feature_slug === 'product'
      ) || []
    : apiKeyData?.local_credits?.filter(
        (credit) => credit.feature_slug && credit.feature_slug.includes('data')
      ) || [];

  return (
    <div className="flex gap-2 justify-center items-center text-sm">
      {creditsToShow.map((credit, i: number) => {
        const spent = credit.usages ?? 0;
        const total = credit.credits ?? 1;
        const isUnlimited = Number(credit.credits) === -1;
        return (
          <div key={i} className="min-w-[80px]">
            <span className="flex gap-1 items-center text-xs leading-none">
              {isProductTab ? 'Trained Products' : 'Trained Sources'}:{' '}
              {isUnlimited ? `${spent}/∞` : `${spent}/${total}`}
              <button
                className="p-0.5 text-gray-400 hover:text-primary-600 disabled:opacity-50"
                title="Sync Credits"
                onClick={() => syncCredits()}
                disabled={isSyncing}
                style={{ lineHeight: 0, cursor: 'pointer' }}
              >
                <RefreshCw
                  className={
                    isSyncing ? 'w-3 h-3 animate-spin' : 'w-3 h-3 text-primary'
                  }
                />
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function DataSourceContent() {
  // All hooks must be called at the top level in the same order every time
  const { apiKeyQuery, syncCreditsMutation } = useApi();
  const { getSourcesMutation } = useDataSource();
  const { isWooCommerceInstalled, isLoading: isWooCommerceLoading } =
    useWooCommerce();
  const [tab, setTab] = useState('WP Posts');
  const [hasGeneralContent, setHasGeneralContent] = useState(false);

  // Extract data from queries after all hooks are called
  const { data: apiKeyData, isPending: isApiKeyPending } = apiKeyQuery;
  const { mutate: syncCredits, isPending: isSyncing } = syncCreditsMutation;

  // Move useMemo after all other hooks
  const MENU_ITEMS = useMemo<MenuItem[]>(() => {
    const baseItems: MenuItem[] = [];

    if (isWooCommerceInstalled) {
      baseItems.push({
        title: 'Products',
        status: hasGeneralContent,
      });
    }

    baseItems.push(
      {
        title: 'WP Posts',
        status: hasGeneralContent,
      },
      {
        title: 'Text',
        status: hasGeneralContent,
      },
      {
        title: 'Url',
        status: hasGeneralContent,
      },
      {
        title: 'Q&A',
        status: hasGeneralContent,
      },
      {
        title: 'File',
        status: hasGeneralContent,
      }
    );

    return baseItems;
  }, [hasGeneralContent, isWooCommerceInstalled]);

  // Set initial tab based on WooCommerce status
  useEffect(() => {
    if (!isWooCommerceLoading && isWooCommerceInstalled) {
      setTab('Products');
    }
  }, [isWooCommerceLoading, isWooCommerceInstalled]);

  // Check if general data source has content
  useEffect(() => {
    getSourcesMutation.mutate('general', {
      onSuccess: (data) => {
        const hasContent = Boolean(
          data &&
            data.length > 0 &&
            data[0].content &&
            data[0].content.trim().length > 0
        );
        setHasGeneralContent(hasContent);
      },
      onError: () => {
        setHasGeneralContent(false);
      },
    });
  }, []);

  // Listen to general data changes from the mutation
  useEffect(() => {
    if (getSourcesMutation.data) {
      const data = getSourcesMutation.data;
      const hasContent = Boolean(
        data &&
          data.length > 0 &&
          data[0].content &&
          data[0].content.trim().length > 0
      );
      setHasGeneralContent(hasContent);
    }
  }, []);

  // Handle tab change with validation
  const handleTabChange = (newTab: string) => {
    // Allow "Start Here" tab always
    if (newTab === 'Start Here') {
      setTab(newTab);
      return;
    }

    // Only allow other tabs if general content exists
    if (hasGeneralContent) {
      setTab(newTab);
    }
  };

  return (
    <>
      <Tabs className="gap-0" value={tab} onValueChange={handleTabChange}>
        <PageHeader
          menuItems={MENU_ITEMS}
          title="Knowledge Base"
          rightActions={
            <RightActions
              isApiKeyPending={isApiKeyPending}
              tab={tab}
              apiKeyData={apiKeyData}
              syncCredits={syncCredits}
              isSyncing={isSyncing}
            />
          }
        />
        <TabsContent value={tab} className="p-6">
          <Suspense fallback={<Loading />}>
            {tab === 'Products' && <TabProducts />}
            {tab === 'WP Posts' && <TabPost />}
            {tab === 'Text' && <TabText />}
            {tab === 'Url' && <TabUrl />}
            {tab === 'Q&A' && <TabQnA />}
            {tab === 'File' && <TabFile />}
          </Suspense>
        </TabsContent>
      </Tabs>

      <FloatingBar
        title="How to get 96% accurate answers with Helpmate AI Chatbot."
        buttonText="Learn More"
        articleContent={
          <div className="max-w-none !prose !prose-sm [&_ul]:!list-disc [&_ol]:!list-decimal [&>ul]:!list-disc [&>ol]:!list-decimal [&_ul]:!ml-3 [&_hr]:!my-4">
            <ReactMarkdown>{TRAINING_ARTICLE}</ReactMarkdown>
          </div>
        }
      />
    </>
  );
}
