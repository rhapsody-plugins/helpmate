import adminHub from '@/assets/apps/admin-hub.svg';
import automation from '@/assets/apps/automation.svg';
import behavior from '@/assets/apps/behavior.svg';
import comments from '@/assets/apps/comments.svg';
import crm from '@/assets/apps/crm.svg';
import emailTemplate from '@/assets/apps/email-template.svg';
import liveChat from '@/assets/apps/live-chat.svg';
import promoMegaphone from '@/assets/apps/promo-megaphone.svg';
import rotateCCW from '@/assets/apps/rotate-ccw.svg';
import shoppingCartAbandoned from '@/assets/apps/shopping-cart-abandoned.svg';
import teamManagement from '@/assets/apps/team-management.svg';
import ticketSystem from '@/assets/apps/ticket-system.svg';
import truckLocation from '@/assets/apps/truck-location.svg';
import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMain } from '@/contexts/MainContext';
import { useDashboard } from '@/hooks/useDashboard';
import { useDashboardChecklist } from '@/hooks/useDashboardChecklist';
import { useSettings } from '@/hooks/useSettings';
import { HelpmateFreeVsProURL, HelpmatePricingURL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Icon } from '@iconify/react';
import {
  ArrowUpRight,
  BarChart3,
  BellRing,
  BookUser,
  Bot,
  Brain,
  CalendarClock,
  CheckCircle2,
  Circle,
  Crown,
  Database,
  Facebook,
  FileText,
  FlaskConical,
  Inbox,
  Instagram,
  KeyRound,
  Languages,
  Layers,
  ListChecks,
  Mails,
  MessageCircleReply,
  MessageSquare,
  NotebookPen,
  Package,
  Palette,
  Radio,
  Rocket,
  ScanSearch,
  Send,
  Share2,
  ShoppingBag,
  TextCursorInput,
  TicketPercent,
  UserRoundSearch,
  UserSearch,
  Users
} from 'lucide-react';
import * as React from 'react';
import { ChangeSvgColor } from 'svg-color-tools';

interface ChecklistItemProps {
  completed: boolean;
  label: string;
  onClick: () => void;
}

function ChecklistItem({ completed, label, onClick }: ChecklistItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex gap-3 items-center p-3 w-full text-left rounded-lg transition-colors',
        completed
          ? 'bg-green-50 hover:bg-green-100'
          : 'bg-yellow-50 cursor-pointer hover:bg-yellow-100'
      )}
    >
      {completed ? (
        <CheckCircle2 className="flex-shrink-0 w-5 h-5 text-green-600" />
      ) : (
        <Circle className="flex-shrink-0 w-5 h-5 text-gray-400" />
      )}
      <span
        className={cn(
          'text-sm font-medium',
          completed ? 'text-green-900 line-through' : 'text-gray-700'
        )}
      >
        {label}
      </span>
    </button>
  );
}

type UpgradeFeatureIconKey =
  | 'database'
  | 'inbox'
  | 'bot'
  | 'liveChat'
  | 'ticketSystem'
  | 'share2'
  | 'comments'
  | 'facebook'
  | 'instagram'
  | 'whatsapp'
  | 'tiktok'
  | 'flaskConical'
  | 'palette'
  | 'behavior'
  | 'chatbotToneLanguage'
  | 'truckLocation'
  | 'scanSearch'
  | 'rotateCCW'
  | 'promoMegaphone'
  | 'bellRing'
  | 'mails'
  | 'shoppingCartAbandoned'
  | 'messageCircleReply'
  | 'send'
  | 'userRoundSearch'
  | 'ticketPercent'
  | 'rocket'
  | 'bookUser'
  | 'userSearch'
  | 'calendarClock'
  | 'layers'
  | 'textCursorInput'
  | 'listChecks'
  | 'emailTemplate'
  | 'teamManagement'
  | 'keyRound'
  | 'barChart3'
  | 'package'
  | 'notebookPen'
  | 'shoppingCart';

interface UpgradeFeature {
  name: string;
  icon: UpgradeFeatureIconKey;
  free?: 'check' | 'limit';
  freeText?: string;
  freeLimit?: number;
  proValue?: string;
}
interface UpgradeSection {
  title: string;
  features: UpgradeFeature[];
}

const UPGRADE_SECTIONS: UpgradeSection[] = [
  {
    title: 'Helpmate AI',
    features: [
      { name: 'Knowledge Base', icon: 'database', free: 'limit', freeLimit: 30, proValue: '1k to 30k' },
    ],
  },
  {
    title: 'Automations',
    features: [
      { name: 'Auto DM & Comments', icon: 'messageCircleReply' },
      { name: 'Test Chatbot', icon: 'flaskConical', free: 'check' },
      { name: 'Appearance', icon: 'palette', free: 'check' },
      { name: 'Behavior', icon: 'behavior', free: 'check' },
      { name: 'Chatbot Tone & Language', icon: 'chatbotToneLanguage', free: 'check' },
      { name: 'Order Status Tracking', icon: 'truckLocation' },
      { name: 'Product Search by Image', icon: 'scanSearch' },
      { name: 'Refund & Return', icon: 'rotateCCW' },
      { name: 'Email Campaigns', icon: 'send' },
      { name: 'Lead Capture', icon: 'userRoundSearch' },
      { name: 'Coupon Delivery', icon: 'ticketPercent' },
      { name: 'Proactive Sales', icon: 'rocket' },
      { name: 'Email Sequences', icon: 'mails' },
      { name: 'Abandoned Cart', icon: 'shoppingCartAbandoned' },
      { name: 'Promo Bar', icon: 'promoMegaphone', freeText: '1 template' },
      { name: 'Sales Notifications', icon: 'bellRing', freeText: '1 template' },
    ],
  },
  {
    title: 'Inbox',
    features: [
      { name: 'All Conversations', icon: 'inbox', freeText: 'Partial' },
      { name: 'Chatbot', icon: 'bot', free: 'limit', freeLimit: 200, proValue: 'Unlimited (BYOK)' },
      { name: 'Live Chat', icon: 'liveChat' },
      { name: 'Tickets', icon: 'ticketSystem', free: 'check' },
      { name: 'Social Messages', icon: 'share2' },
      { name: 'Comments', icon: 'comments' },
    ],
  },
  {
    title: 'Channels',
    features: [
      { name: 'Facebook Messages', icon: 'facebook' },
      { name: 'Facebook Comments', icon: 'facebook' },
      { name: 'Instagram Messages', icon: 'instagram' },
      { name: 'Instagram Comments', icon: 'instagram' },
      { name: 'WhatsApp', icon: 'whatsapp' },
      { name: 'TikTok (coming soon)', icon: 'tiktok' },
      { name: 'Live Chat', icon: 'liveChat' },
    ],
  },
  {
    title: 'CRM',
    features: [
      { name: 'Contacts', icon: 'bookUser', free: 'limit', freeLimit: 50, proValue: 'Unlimited' },
      { name: 'Notes', icon: 'notebookPen', free: 'check' },
      { name: 'Order Management', icon: 'shoppingCart', free: 'check' },
      { name: 'Leads', icon: 'userSearch', freeText: 'Chat widget' },
      { name: 'Appointments & Bookings', icon: 'calendarClock' },
      { name: 'Segments', icon: 'layers' },
      { name: 'Custom Fields', icon: 'textCursorInput' },
      { name: 'Tasks', icon: 'listChecks' },
      { name: 'Email Templates', icon: 'emailTemplate' },
    ],
  },
  {
    title: 'Admin Hub',
    features: [
      { name: 'Teams & Roles', icon: 'teamManagement', free: 'check' },
      { name: 'Manage API Key', icon: 'keyRound', free: 'check' },
      { name: 'Analytics', icon: 'barChart3', free: 'check' },
    ],
  },
];

function UpgradeFeatureIcon({ type }: { type: UpgradeFeatureIconKey }) {
  const className = 'w-4 h-4 text-muted-foreground shrink-0';
  switch (type) {
    case 'database':
      return <Database className={className} strokeWidth={1.5} />;
    case 'inbox':
      return <Inbox className={className} strokeWidth={1.5} />;
    case 'bot':
      return <Bot className={className} strokeWidth={1.5} />;
    case 'liveChat':
      return (
        <ChangeSvgColor
          src={liveChat}
          strokeWidth="1.5px"
          className={cn(className, 'stroke-current [&_path]:stroke-current')}
        />
      );
    case 'ticketSystem':
      return (
        <ChangeSvgColor
          src={ticketSystem}
          strokeWidth="1.5px"
          className={cn(className, 'stroke-current [&_path]:stroke-current')}
        />
      );
    case 'share2':
      return <Share2 className={className} strokeWidth={1.5} />;
    case 'comments':
      return (
        <ChangeSvgColor
          src={comments}
          strokeWidth="1.5px"
          className={cn(className, 'stroke-current [&_path]:stroke-current')}
        />
      );
    case 'facebook':
      return <Facebook className={className} strokeWidth={1.5} />;
    case 'instagram':
      return <Instagram className={className} strokeWidth={1.5} />;
    case 'whatsapp':
      return <Icon icon="mdi:whatsapp" className={className} />;
    case 'tiktok':
      return (
        <Icon
          icon="ph:tiktok-logo-thin"
          className={cn(className, '[&_path]:stroke-[8] [&_path]:fill-none [&_path]:stroke-current')}
        />
      );
    case 'flaskConical':
      return <FlaskConical className={className} strokeWidth={1.5} />;
    case 'palette':
      return <Palette className={className} strokeWidth={1.5} />;
    case 'behavior':
      return (
        <ChangeSvgColor
          src={behavior}
          strokeWidth="1.5px"
          className={cn(className, 'stroke-current [&_path]:stroke-current')}
        />
      );
    case 'chatbotToneLanguage':
      return <Languages className={className} strokeWidth={1.5} />;
    case 'truckLocation':
      return (
        <ChangeSvgColor
          src={truckLocation}
          strokeWidth="2px"
          className={cn(className, 'stroke-current [&_path]:stroke-current')}
        />
      );
    case 'scanSearch':
      return <ScanSearch className={className} strokeWidth={1.5} />;
    case 'rotateCCW':
      return (
        <ChangeSvgColor
          src={rotateCCW}
          strokeWidth="2px"
          className={cn(className, 'stroke-current [&_path]:stroke-current')}
        />
      );
    case 'promoMegaphone':
      return (
        <ChangeSvgColor
          src={promoMegaphone}
          strokeWidth="2px"
          className={cn(className, 'stroke-current [&_path]:stroke-current')}
        />
      );
    case 'bellRing':
      return <BellRing className={className} strokeWidth={1.5} />;
    case 'mails':
      return <Mails className={className} strokeWidth={1.5} />;
    case 'shoppingCartAbandoned':
      return (
        <ChangeSvgColor
          src={shoppingCartAbandoned}
          strokeWidth="2px"
          className={cn(className, 'stroke-current [&_path]:stroke-current')}
        />
      );
    case 'messageCircleReply':
      return <MessageCircleReply className={className} strokeWidth={1.5} />;
    case 'send':
      return <Send className={className} strokeWidth={1.5} />;
    case 'userRoundSearch':
      return <UserRoundSearch className={className} strokeWidth={1.5} />;
    case 'ticketPercent':
      return <TicketPercent className={className} strokeWidth={1.5} />;
    case 'rocket':
      return <Rocket className={className} strokeWidth={1.5} />;
    case 'bookUser':
      return <BookUser className={className} strokeWidth={1.5} />;
    case 'userSearch':
      return <UserSearch className={className} strokeWidth={1.5} />;
    case 'calendarClock':
      return <CalendarClock className={className} strokeWidth={1.5} />;
    case 'layers':
      return <Layers className={className} strokeWidth={1.5} />;
    case 'textCursorInput':
      return <TextCursorInput className={className} strokeWidth={1.5} />;
    case 'listChecks':
      return <ListChecks className={className} strokeWidth={1.5} />;
    case 'emailTemplate':
      return (
        <ChangeSvgColor
          src={emailTemplate}
          strokeWidth=".14px"
          className={cn(className, 'stroke-white fill-current [&_path]:fill-current [&_path]:!stroke-white')}
        />
      );
    case 'teamManagement':
      return (
        <ChangeSvgColor
          src={teamManagement}
          strokeWidth="1.5px"
          className={cn(className, 'stroke-current [&_path]:stroke-current')}
        />
      );
    case 'keyRound':
      return <KeyRound className={className} strokeWidth={1.5} />;
    case 'barChart3':
      return <BarChart3 className={className} strokeWidth={1.5} />;
    case 'package':
      return <Package className={className} strokeWidth={1.5} />;
    case 'notebookPen':
      return <NotebookPen className={className} strokeWidth={1.5} />;
    case 'shoppingCart':
      return <ShoppingBag className={className} strokeWidth={1.5} />;
    default:
      return <MessageSquare className={className} strokeWidth={1.5} />;
  }
}

function ProCheck() {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10">
      <CheckCircle2 className="w-3.5 h-3.5 text-primary" strokeWidth={2.5} />
    </span>
  );
}

function SectionIcon({ title }: { title: string }) {
  const className = 'w-4 h-4 text-foreground shrink-0';
  switch (title) {
    case 'Helpmate AI':
      return <Brain className={className} strokeWidth={1.5} />;
    case 'Automations':
      return (
        <ChangeSvgColor
          src={automation}
          stroke="currentColor"
          className={className}
        />
      );
    case 'Inbox':
      return <Inbox className={className} strokeWidth={1.5} />;
    case 'Channels':
      return <Radio className={className} strokeWidth={1.5} />;
    case 'CRM':
      return (
        <ChangeSvgColor
          src={crm}
          strokeWidth="1.5px"
          className={cn(className, 'stroke-current [&_path]:stroke-current')}
        />
      );
    case 'Admin Hub':
      return (
        <ChangeSvgColor
          src={adminHub}
          strokeWidth="1.5px"
          className={className}
        />
      );
    default:
      return null;
  }
}

export default function Dashboard() {
  const { setPage } = useMain();
  const { checklistQuery } = useDashboardChecklist();
  const { getDashboardOverviewQuery } = useDashboard();
  const { getProQuery } = useSettings();
  const checklist = checklistQuery.data;
  const overviewData = getDashboardOverviewQuery.data;
  const isPro = getProQuery.data ?? false;

  return (
    <PageGuard page="control-center-dashboard">
      <div className="gap-0">
        <PageHeader title="Dashboard" disableTrigger={true} />
        <div className="min-h-[30vh] flex flex-col justify-between p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left Column: System Overview */}
            <Card className="flex flex-col h-full shadow-lg">
              <CardHeader>
                <CardTitle className="!text-lg">Overview</CardTitle>
                <CardDescription>
                  Key metrics and performance indicators
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 px-6">
                {getDashboardOverviewQuery.isLoading ? (
                  <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-full bg-gray-100 rounded-lg animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Total Chats */}
                    <div className="flex justify-between items-center px-6 py-6 h-full bg-blue-50 rounded-lg">
                      <div className="flex flex-col justify-center h-full">
                        <p className="mb-2 text-sm font-normal text-gray-600">
                          Total Chats
                        </p>
                        <p className="!text-2xl font-semibold text-gray-900 !my-0">
                          {overviewData?.total_chats?.toLocaleString() ?? 0}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 justify-center items-center w-14 h-14 bg-blue-100 rounded-lg">
                        <MessageSquare
                          className="w-7 h-7 text-blue-600"
                          strokeWidth={1.5}
                        />
                      </div>
                    </div>

                    {/* Total Contacts */}
                    <div className="flex justify-between items-center px-6 py-6 h-full bg-purple-50 rounded-lg">
                      <div className="flex flex-col justify-center h-full">
                        <p className="mb-2 text-sm font-normal text-gray-600">
                          Total Contacts
                        </p>
                        <p className="!text-2xl font-semibold text-gray-900 !my-0">
                          {overviewData?.total_contacts?.toLocaleString() ?? 0}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 justify-center items-center w-14 h-14 bg-purple-100 rounded-lg">
                        <Users
                          className="w-7 h-7 text-purple-600"
                          strokeWidth={1.5}
                        />
                      </div>
                    </div>

                    {/* Employee of the Month */}
                    <div className="flex justify-between items-center px-6 py-6 h-full bg-yellow-50 rounded-lg">
                      <div className="flex flex-col justify-center h-full">
                        <p className="mb-2 text-sm font-normal text-gray-600">
                          Employee of Month
                        </p>
                        <p className="!text-xl font-semibold text-gray-900 !my-0">
                          {overviewData?.employee_of_month?.display_name ??
                            'N/A'}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 justify-center items-center w-14 h-14 bg-yellow-100 rounded-lg">
                        <Crown
                          className="w-7 h-7 text-yellow-600"
                          strokeWidth={1.5}
                        />
                      </div>
                    </div>

                    {/* Total Knowledge Bases */}
                    <div className="flex justify-between items-center px-6 py-6 h-full bg-green-50 rounded-lg">
                      <div className="flex flex-col justify-center h-full">
                        <p className="mb-2 text-sm font-normal text-gray-600">
                          Knowledge Bases
                        </p>
                        <p className="!text-2xl font-semibold text-gray-900 !my-0">
                          {overviewData?.total_knowledge_bases?.toLocaleString() ??
                            0}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 justify-center items-center w-14 h-14 bg-green-100 rounded-lg">
                        <FileText
                          className="w-7 h-7 text-green-600"
                          strokeWidth={1.5}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Column: Getting Started Checklist */}
            <Card className="flex flex-col h-full shadow-lg">
              <CardHeader>
                <CardTitle className="!text-lg">Getting Started</CardTitle>
                <CardDescription>
                  Complete these steps to get the most out of your chatbot
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex flex-col gap-3 h-full">
                  {checklistQuery.isLoading ? (
                    <div className="text-sm text-muted-foreground">
                      Loading checklist...
                    </div>
                  ) : (
                    <>
                      <ChecklistItem
                        completed={checklist?.has_knowledge_base ?? false}
                        label="Add knowledge base"
                        onClick={() => setPage('data-source')}
                      />
                      <ChecklistItem
                        completed={checklist?.has_test_chat ?? false}
                        label="Test chatbot"
                        onClick={() => setPage('test-chatbot')}
                      />
                      <ChecklistItem
                        completed={checklist?.has_customization ?? false}
                        label="Customize chatbot"
                        onClick={() => setPage('settings')}
                      />
                      <ChecklistItem
                        completed={checklist?.has_business_hours_configured ?? false}
                        label="Configure business hours"
                        onClick={() => setPage('live-chat-settings')}
                      />
                      <ChecklistItem
                        completed={checklist?.has_contacts ?? false}
                        label="Create contacts"
                        onClick={() => setPage('crm-contacts')}
                      />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {!isPro && (
            <Card className="gap-0 py-0 mt-6 shadow-lg border-primary/50">
            <div className="p-6 !flex justify-between items-center bg-[#FAFBFF] rounded-t-xl">
              <div className="flex gap-4 items-center">
                <Crown className="w-12 h-12 text-primary" />
                <div className="flex-1">
                  <CardTitle className="text-2xl text-primary-800">
                    Why upgrade to pro?
                  </CardTitle>
                  <CardDescription className="text-base text-primary-800">
                    Our top features that driving revenue and elevating the
                    customer experience.
                  </CardDescription>
                </div>
              </div>
              <CardAction className="flex gap-3 justify-center items-center my-auto">
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => window.open(HelpmateFreeVsProURL, '_blank')}
                >
                  Learn More
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
                <Button
                  size="default"
                  onClick={() => window.open(HelpmatePricingURL, '_blank')}
                >
                  Upgrade Now
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
              </CardAction>
            </div>
            <CardContent className="py-6">
              <Table className="border border-border border-collapse">
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead
                      className="w-[50%] border-r border-border font-semibold text-foreground"
                    >
                      Feature Name
                    </TableHead>
                    <TableHead className="w-[25%] border-r border-border text-center font-semibold text-foreground">
                      Free
                    </TableHead>
                    <TableHead className="w-[25%] text-center font-semibold text-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Crown className="w-4 h-4" strokeWidth={1.5} />
                        Pro
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {UPGRADE_SECTIONS.map((section) => (
                    <React.Fragment key={section.title}>
                      <TableRow className="border-border bg-primary-50 hover:bg-primary-50/80">
                        <TableCell className="border-r border-border font-semibold text-foreground py-2">
                          <span className="flex font-medium items-center gap-2">
                            <SectionIcon title={section.title} />
                            {section.title}
                          </span>
                        </TableCell>
                        <TableCell className="border-r border-border bg-primary-50 py-2" />
                        <TableCell className="py-2" />
                      </TableRow>
                      {section.features.map((feature) => (
                        <TableRow
                          key={`${section.title}-${feature.name}`}
                          className="border-border"
                        >
                          <TableCell className="border-r border-border py-2.5">
                            <span className="flex items-center gap-2">
                              <UpgradeFeatureIcon type={feature.icon} />
                              <span className="text-sm text-foreground">
                                {feature.name}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="border-r border-border text-center py-2.5">
                            {feature.freeText
                              ? (
                                <span className="text-sm text-foreground">
                                  {feature.freeText}
                                </span>
                                )
                              : feature.free === 'limit' && feature.freeLimit != null
                                ? String(feature.freeLimit)
                                : feature.free === 'check'
                                  ? <ProCheck />
                                  : null}
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            {feature.proValue ? (
                              <span className="text-sm font-medium text-foreground">
                                {feature.proValue}
                              </span>
                            ) : (
                              <ProCheck />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          )}
        </div>
      </div>
    </PageGuard>
  );
}
