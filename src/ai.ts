import { SandyBrainInput, SandyBrainOutput, MessageType, GhlContact } from "./types.js";

const SANDY_BRAIN_API_URL = process.env.SANDY_BRAIN_API_URL || "http://localhost:3000/sandy-brain";
const SANDY_BRAIN_AUTH_TOKEN = process.env.SANDY_BRAIN_AUTH_TOKEN;

async function callSandyBrain(input: SandyBrainInput): Promise<SandyBrainOutput> {
  if (!SANDY_BRAIN_AUTH_TOKEN) {
    throw new Error("SANDY_BRAIN_AUTH_TOKEN is not set.");
  }

  const response = await fetch(SANDY_BRAIN_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SANDY_BRAIN_AUTH_TOKEN}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Sandy Brain API error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

export async function processSandyMessage(
  messageType: MessageType,
  contact: GhlContact,
  context?: Record<string, any>,
  inboundMessage?: string,
): Promise<SandyBrainOutput> {
  const input: SandyBrainInput = {
    channel: "sms",
    contactId: contact.id,
    phone: contact.phone,
    email: contact.email,
    locationId: contact.customFields?.dd_ghl_location_id, // Assuming this custom field exists
    messageType: messageType,
    eventData: context,
    inboundMessage: inboundMessage,
  };

  return callSandyBrain(input);
}
