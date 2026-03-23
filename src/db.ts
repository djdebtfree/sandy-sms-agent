import { createClient } from '@supabase/supabase-js';
import type { SmsMessage, MessageType } from './types.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function logMessage(msg: Omit<SmsMessage, 'id' | 'sent_at'>): Promise<SmsMessage> {
  const { data, error } = await supabase
    .from('sms_messages')
    .insert({
      contact_id: msg.contact_id,
      contact_name: msg.contact_name,
      message_type: msg.message_type,
      message_content: msg.message_content,
      ghl_message_id: msg.ghl_message_id,
      status: msg.status,
    })
    .select()
    .single();

  if (error) throw new Error(`Supabase insert error: ${error.message}`);
  return data as SmsMessage;
}

export async function getLastMessageTime(contactId: string): Promise<Date | null> {
  const { data, error } = await supabase
    .from('sms_messages')
    .select('sent_at')
    .eq('contact_id', contactId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return new Date(data.sent_at);
}

export async function hasCleanExit(contactId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('sms_messages')
    .select('id')
    .eq('contact_id', contactId)
    .eq('message_type', 'clean-exit')
    .eq('status', 'sent')
    .limit(1);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export async function getHistory(contactId: string): Promise<SmsMessage[]> {
  const { data, error } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('contact_id', contactId)
    .order('sent_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(`Supabase query error: ${error.message}`);
  return (data ?? []) as SmsMessage[];
}

export async function getRecentMessages(limit = 10): Promise<SmsMessage[]> {
  const { data, error } = await supabase
    .from('sms_messages')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Supabase query error: ${error.message}`);
  return (data ?? []) as SmsMessage[];
}

export { supabase };
