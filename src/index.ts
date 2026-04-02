import 'dotenv/config';
import express from 'express';
import { getContact, sendSms, lookupContactByPhone } from './ghl.js';
import { generateMessage, generateReply } from './ai.js';
import { canSend } from './scheduler.js';
import { logMessage, getHistory, getRecentMessages } from './db.js';
import type {
  SendRequest,
  GhlWebhookEvent,
  VapiWebhookEvent,
  NotifyEvent,
  InboundSmsEvent,
  MessageType,
} from './types.js';

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || '3000', 10);

// ── Health ────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'sandy-sms-agent',
    timestamp: new Date().toISOString(),
  });
});

// ── DD API Gateway Notify ─────────────────────────────────
// Receives install and purchase events from the DD API Gateway
app.post('/api/notify', async (req, res) => {
  try {
    const event = req.body as NotifyEvent;
    console.log('Notify event received:', JSON.stringify(event).slice(0, 500));

    // Validate required fields
    if (!event.type || !event.contactId) {
      return res.status(400).json({
        error: 'Missing required fields: type and contactId are required',
      });
    }

    if (event.type !== 'install' && event.type !== 'purchase') {
      return res.status(400).json({
        error: `Invalid event type: ${event.type}. Must be "install" or "purchase".`,
      });
    }

    // Map event type to message type
    const messageType: MessageType =
      event.type === 'install' ? 'install-welcome' : 'purchase-thank-you';

    // Check sending rules (rate limit, quiet hours, clean exit)
    const check = await canSend(event.contactId);
    if (!check.allowed) {
      console.log(`Notify blocked for ${event.contactId}: ${check.reason}`);
      await logMessage({
        contact_id: event.contactId,
        contact_name: event.firstName ?? null,
        message_type: messageType,
        message_content: `[BLOCKED] ${check.reason}`,
        ghl_message_id: null,
        status: 'blocked',
      });
      return res.status(200).json({
        received: true,
        action: 'blocked',
        reason: check.reason,
      });
    }

    // Get full contact from GHL
    const contact = await getContact(event.contactId);
    const contactName =
      [contact.firstName, contact.lastName].filter(Boolean).join(' ') || event.firstName || null;

    // Generate personalized follow-up message
    const messageContent = await generateMessage(messageType, contact, {
      tier: event.tier,
    });

    // Send via GHL Conversations API
    const ghlMessageId = await sendSms(event.contactId, messageContent);

    // Log to Supabase
    const logged = await logMessage({
      contact_id: event.contactId,
      contact_name: contactName,
      message_type: messageType,
      message_content: messageContent,
      ghl_message_id: ghlMessageId,
      status: 'sent',
    });

    console.log(`Notify ${event.type} -> ${messageType} sent to ${event.contactId}`);

    res.json({
      received: true,
      action: 'sent',
      messageType,
      contactId: event.contactId,
      messageId: ghlMessageId,
      logged: logged.id,
    });
  } catch (err: any) {
    console.error('Notify error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Status ────────────────────────────────────────────────
app.get('/status', async (_req, res) => {
  try {
    const recent = await getRecentMessages(10);
    res.json({
      status: 'ok',
      service: 'sandy-sms-agent',
      recentMessages: recent,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Message history for a contact ─────────────────────────
app.get('/history/:contactId', async (req, res) => {
  try {
    const history = await getHistory(req.params.contactId);
    res.json({ contactId: req.params.contactId, messages: history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Manual send ───────────────────────────────────────────
app.post('/send', async (req, res) => {
  try {
    const { contactId, messageType, dryRun, appointmentTime } = req.body as SendRequest;

    if (!contactId || !messageType) {
      return res.status(400).json({ error: 'contactId and messageType are required' });
    }

    const validTypes: MessageType[] = [
      'prospect-followup',
      'appointment-confirmation',
      'post-meeting',
      'recovery',
      'clean-exit',
      'install-welcome',
      'purchase-thank-you',
    ];
    if (!validTypes.includes(messageType)) {
      return res.status(400).json({ error: `Invalid messageType. Valid: ${validTypes.join(', ')}` });
    }

    // Dry run mode — validate request without sending
    if (dryRun) {
      const check = await canSend(contactId);
      return res.json({
        dryRun: true,
        contactId,
        messageType,
        schedulerCheck: check,
        message: 'Dry run — no SMS sent',
      });
    }

    // Rate limit / quiet hours / clean exit check
    const check = await canSend(contactId);
    if (!check.allowed) {
      await logMessage({
        contact_id: contactId,
        contact_name: null,
        message_type: messageType,
        message_content: `[BLOCKED] ${check.reason}`,
        ghl_message_id: null,
        status: 'blocked',
      });
      return res.status(429).json({ error: check.reason, blocked: true });
    }

    // Get contact from GHL
    const contact = await getContact(contactId);
    const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null;

    // Generate personalized message
    const messageContent = await generateMessage(messageType, contact, { appointmentTime });

    // Send via GHL Conversations API
    const ghlMessageId = await sendSms(contactId, messageContent);

    // Log to Supabase
    const logged = await logMessage({
      contact_id: contactId,
      contact_name: contactName,
      message_type: messageType,
      message_content: messageContent,
      ghl_message_id: ghlMessageId,
      status: 'sent',
    });

    res.json({
      success: true,
      messageId: ghlMessageId,
      content: messageContent,
      logged: logged.id,
    });
  } catch (err: any) {
    console.error('Send error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GHL Webhook ───────────────────────────────────────────
app.post('/webhook/ghl', async (req, res) => {
  try {
    const event = req.body as GhlWebhookEvent;
    console.log('GHL webhook received:', JSON.stringify(event).slice(0, 500));

    const contactId = event.contactId ?? event.contact?.id;
    if (!contactId) {
      return res.status(200).json({ received: true, action: 'no_contact_id' });
    }

    // Map pipeline stage names to message types
    const stageName = (event.pipelineStageName ?? '').toLowerCase();
    let messageType: MessageType | null = null;

    if (stageName.includes('new lead') || stageName.includes('inquiry')) {
      messageType = 'prospect-followup';
    } else if (stageName.includes('appointment') || stageName.includes('booked')) {
      messageType = 'appointment-confirmation';
    } else if (stageName.includes('closed lost') || stageName.includes('lost')) {
      messageType = 'clean-exit';
    }

    if (!messageType) {
      return res.status(200).json({ received: true, action: 'no_matching_stage', stage: stageName });
    }

    // Check sending rules
    const check = await canSend(contactId);
    if (!check.allowed) {
      console.log(`Webhook blocked for ${contactId}: ${check.reason}`);
      return res.status(200).json({ received: true, action: 'blocked', reason: check.reason });
    }

    // Generate and send
    const contact = await getContact(contactId);
    const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null;
    const messageContent = await generateMessage(messageType, contact);
    const ghlMessageId = await sendSms(contactId, messageContent);

    await logMessage({
      contact_id: contactId,
      contact_name: contactName,
      message_type: messageType,
      message_content: messageContent,
      ghl_message_id: ghlMessageId,
      status: 'sent',
    });

    res.json({ received: true, action: 'sent', messageType, contactId });
  } catch (err: any) {
    console.error('GHL webhook error:', err);
    res.status(200).json({ received: true, action: 'error', error: err.message });
  }
});

// ── Inbound SMS Reply Handler ─────────────────────────────
// GHL sends inbound SMS events here; Sandy generates a contextual reply
app.post('/webhook/inbound', async (req, res) => {
  try {
    const event = req.body as InboundSmsEvent;
    console.log('Inbound SMS received:', JSON.stringify(event).slice(0, 500));

    // Only process inbound messages
    if (event.direction && event.direction !== 'inbound') {
      return res.status(200).json({ received: true, action: 'ignored', reason: 'not inbound' });
    }

    const contactId = event.contactId ?? event.contact?.id;
    if (!contactId || !event.body) {
      return res.status(200).json({ received: true, action: 'no_contact_or_body' });
    }

    // Check sending rules
    const check = await canSend(contactId);
    if (!check.allowed) {
      console.log(`Inbound reply blocked for ${contactId}: ${check.reason}`);
      return res.status(200).json({ received: true, action: 'blocked', reason: check.reason });
    }

    // Get contact details and conversation history
    const contact = await getContact(contactId);
    const contactName =
      [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null;
    const history = await getHistory(contactId);

    // Generate contextual reply using AI
    const replyContent = await generateReply(contact, event.body, history);
    const ghlMessageId = await sendSms(contactId, replyContent);

    await logMessage({
      contact_id: contactId,
      contact_name: contactName,
      message_type: 'prospect-followup',
      message_content: replyContent,
      ghl_message_id: ghlMessageId,
      status: 'sent',
    });

    console.log(`Inbound reply sent to ${contactId}`);
    res.json({ received: true, action: 'replied', contactId });
  } catch (err: any) {
    console.error('Inbound SMS error:', err);
    res.status(200).json({ received: true, action: 'error', error: err.message });
  }
});

// ── VAPI Webhook ──────────────────────────────────────────
app.post('/webhook/vapi', async (req, res) => {
  try {
    const event = req.body as VapiWebhookEvent;
    console.log('VAPI webhook received:', JSON.stringify(event).slice(0, 500));

    // Only handle call-completed events
    const callStatus = event.call?.status;
    if (callStatus !== 'ended' && event.type !== 'end-of-call-report') {
      return res.status(200).json({ received: true, action: 'ignored', reason: 'not a call completion' });
    }

    // Look up contact by phone number from the call
    const customerPhone = event.call?.customer?.number;
    const contactIdFromMeta = event.call?.metadata?.contactId;

    let contactId = contactIdFromMeta;
    if (!contactId && customerPhone) {
      const contact = await lookupContactByPhone(customerPhone);
      contactId = contact?.id;
    }

    if (!contactId) {
      return res.status(200).json({ received: true, action: 'no_contact_found' });
    }

    // Check sending rules
    const check = await canSend(contactId);
    if (!check.allowed) {
      return res.status(200).json({ received: true, action: 'blocked', reason: check.reason });
    }

    // Send post-meeting follow-up (after voice call completes)
    const contact = await getContact(contactId);
    const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null;
    const messageContent = await generateMessage('post-meeting', contact);
    const ghlMessageId = await sendSms(contactId, messageContent);

    await logMessage({
      contact_id: contactId,
      contact_name: contactName,
      message_type: 'post-meeting',
      message_content: messageContent,
      ghl_message_id: ghlMessageId,
      status: 'sent',
    });

    res.json({ received: true, action: 'sent', messageType: 'post-meeting', contactId });
  } catch (err: any) {
    console.error('VAPI webhook error:', err);
    res.status(200).json({ received: true, action: 'error', error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Sandy Beach SMS Agent running on port ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
  });
}

export default app;
