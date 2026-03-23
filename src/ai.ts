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
- Be direct, be real, be Sandy`;

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
};

export async function generateMessage(
  messageType: MessageType,
  contact: Contact,
  context?: { appointmentTime?: string }
): Promise<string> {
  const name = contact.firstName || 'there';

  let userPrompt = MESSAGE_TYPE_PROMPTS[messageType];
  userPrompt += `\n\nContact first name: ${name}`;

  if (context?.appointmentTime) {
    userPrompt += `\nAppointment time: ${context.appointmentTime}`;
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
