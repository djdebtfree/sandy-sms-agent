export type ContactRole = 'owner' | 'admin' | 'internal' | 'customer' | 'prospect' | 'unknown';

export interface GhlContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  customFields?: Record<string, string>;
  state?: string;
}

export interface SandyBrainContact extends GhlContact {
  role: ContactRole;
  isOwner: boolean;
  isAdmin: boolean;
  isInternal: boolean;
  isCustomer: boolean;
  isProspect: boolean;
}

export type ChannelType = 'sms' | 'email' | 'vapi' | 'liveavatar' | 'webhook' | 'form';

export type MessageType =
  | 'prospect-followup'
  | 'appointment-confirmation'
  | 'post-meeting'
  | 'recovery'
  | 'clean-exit'
  | 'install-welcome'
  | 'purchase-thank-you'
  | 'inbound-reply'
  | 'audit-report';

export interface ConversationEntry {
  id?: string;
  contact_id: string;
  client_id: string | null;
  ghl_contact_id: string | null;
  channel: ChannelType;
  role: 'sandy' | 'contact';
  message: string;
  sentiment: string | null;
  key_facts: string[];
  created_at?: string;
}

export interface SandyBrainInput {
  channel: ChannelType;
  inboundMessage?: string;
  contactId?: string;
  phone?: string;
  email?: string;
  locationId?: string;
  eventType?: string;
  messageType?: MessageType;
  eventData?: Record<string, any>;
  auditedUrl?: string;
}

export interface SandyBrainOutput {
  response: string | null;
  action: 'send_message' | 'log_only' | 'no_action' | 'update_contact';
  messageType?: MessageType;
  contactUpdate?: Partial<GhlContact>;
  logReason?: string;
  suppressed?: boolean;
  frustrationDetected?: boolean;
  retryLimitReached?: boolean;
}

export interface SendRequest {
  contactId: string;
  messageType: MessageType;
  dryRun?: boolean;
  appointmentTime?: string;
}

export interface NotifyEvent {
  type: 'install' | 'purchase';
  email: string;
  firstName?: string;
  locationId: string;
  contactId: string;
  tier?: string;
  apiKey?: string;
}

export interface InboundSmsEvent {
  type?: string;
  contactId?: string;
  locationId?: string;
  body?: string;
  direction?: 'inbound' | 'outbound';
  messageType?: string;
  contact?: GhlContact;
  [key: string]: unknown;
}

export interface GhlWebhookEvent {
  type?: string;
  contactId?: string;
  contact?: GhlContact;
  pipelineStageId?: string;
  pipelineStageName?: string;
  [key: string]: unknown;
}

export interface VapiWebhookEvent {
  type?: string;
  call?: {
    id: string;
    status: string;
    customer?: {
      number?: string;
    };
    metadata?: Record<string, string>;
  };
  [key: string]: unknown;
}

export interface SchedulerResult {
  allowed: boolean;
  reason?: string;
}

export interface SmsMessage {
  id?: string;
  contact_id: string;
  contact_name: string | null;
  message_type: MessageType;
  message_content: string;
  sent_at?: string;
  ghl_message_id?: string | null;
  status: 'sent' | 'failed' | 'blocked' | 'dry-run';
}
