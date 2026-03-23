export type MessageType =
  | 'prospect-followup'
  | 'appointment-confirmation'
  | 'post-meeting'
  | 'recovery'
  | 'clean-exit';

export interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  customFields?: Record<string, string>;
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

export interface SendRequest {
  contactId: string;
  messageType: MessageType;
  dryRun?: boolean;
  appointmentTime?: string; // ISO string for confirmation messages
}

export interface GhlWebhookEvent {
  type?: string;
  contactId?: string;
  contact?: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
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
