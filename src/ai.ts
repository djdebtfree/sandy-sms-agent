import Anthropic from '@anthropic-ai/sdk';
import type { Contact, MessageType } from './types.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const SANDY_SYSTEM_PROMPT = `You are Sandy Beach — a warm, sharp, confident AI sales assistant for Data Driver.
Your voice is casual but professional. You text like a real person, not a bot.

RULES:
- Keep messages under 160 characters when possible (SMS-friendly)
- Never say "just checking in", "touching base", or "circling back"
- Never guilt or pressure anyone
- Match the lead's energy — if they were chill, be chill. If they were excited, mirror that.
- Use their first name naturally
- Sound like a helpful person, not a corporation
- No emojis unless the lead used them first
- No exclamation marks overload — one max per message
- Be direct, be real, be Sandy

CONTEXT:
- Data Driver is a marketing analytics platform that connects ad spend to revenue
- Users install it via the GHL marketplace and can upgrade to paid tiers
- You are the friendly face that follows up after installs, purchases, and demos`;

const MESSAGE_TYPE_PROMPTS: Record<MessageType, string> = {
  'prospect-followup': `Write a casual follow-up SMS to a prospect who reached out but hasn't booked an appointment yet.
Mention Data Driver naturally. Suggest a quick 10-min walkthrough. Keep it conversational.`,

  'appointment-confirmation': `Write a brief appointment confirmation/reminder SMS.
If it's the day before, confirm tomorrow's call. If it's the day of, keep it short and ready.
Include the appointment time if provided.`,

  'post-meeting': `Write a follow-up SMS for 2 hours after a meeting/demo completed.
Ask what stood out to them. Don't pitch — just check in authentically.`,

  'recovery': `Write a re-engagement SMS for a lead who went silent for 7+ days.
Acknowledge the gap naturally. Ask where their head is at. No guilt, no pressure.`,

  'clean-exit': `Write a respectful exit SMS for a lead who is unresponsive after recovery attempts.
Thank them for their time. Leave the door open. This is the LAST message — make it count and make it kind.`,

  'install-welcome': `Write a welcome SMS to someone who just installed Data Driver from the GHL marketplace.
Congratulate them briefly. Offer to walk them through the setup in a quick call. Keep it warm and low-pressure.`,

  'purchase-thank-you': `Write a thank-you SMS to someone who just upgraded to a paid Data Driver plan.
Acknowledge their investment. Let them know you're here if they need anything. Mention you'll reach out to help them get the most out of it.`,
};

export async function generateMessage(
  messageType: MessageType,
  contact: Contact,
  context?: { appointmentTime?: string; tier?: string }
): Promise<string> {
  const name = contact.firstName || 'there';

  let userPrompt = MESSAGE_TYPE_PROMPTS[messageType];
  userPrompt += `\n\nContact first name: ${name}`;

  if (context?.appointmentTime) {
    userPrompt += `\nAppointment time: ${context.appointmentTime}`;
  }

  if (context?.tier) {
    userPrompt += `\nPlan tier: ${context.tier}`;
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    system: SANDY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text in AI response');
  }

  // Strip any quotation marks the model might wrap the message in
  return textBlock.text.replace(/^["']|["']$/g, '').trim();
}

/**
 * Generate a contextual reply to an inbound SMS.
 * Uses conversation history for context so Sandy responds coherently.
 */
export async function generateReply(
  contact: Contact,
  inboundMessage: string,
  history: Array<{ message_type: string; message_content: string; sent_at?: string }>
): Promise<string> {
  const name = contact.firstName || 'there';

  // Build conversation context from recent history (last 5 messages)
  const recentHistory = history.slice(0, 5).reverse();
  let historyContext = '';
  if (recentHistory.length > 0) {
    historyContext = '\n\nRecent conversation history:\n';
    for (const msg of recentHistory) {
      historyContext += `- Sandy (${msg.message_type}): ${msg.message_content}\n`;
    }
  }

  const userPrompt = `The contact "${name}" just replied to our SMS conversation with:
"${inboundMessage}"
${historyContext}
Write a natural, contextual reply. Stay in character as Sandy. Keep it under 160 chars if possible.
If they're asking a question about Data Driver, answer helpfully. If they seem interested, gently steer toward booking a walkthrough.
If they want to opt out or seem annoyed, respect that immediately and gracefully.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    system: SANDY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text in AI response');
  }

  return textBlock.text.replace(/^["']|["']$/g, '').trim();
}
