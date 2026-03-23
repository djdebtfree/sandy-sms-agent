import type { Contact } from './types.js';

const API_BASE = process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';
// GHL_PIT_TOKEN is the primary auth token (Private Integration Token for DD Installs sub-account)
// Falls back to GHL_API_KEY for backward compatibility
const API_KEY = process.env.GHL_PIT_TOKEN || process.env.GHL_API_KEY;
if (!API_KEY) {
  console.error('FATAL: GHL_PIT_TOKEN (or GHL_API_KEY) must be set');
  process.exit(1);
}
const API_VERSION = process.env.GHL_API_VERSION || '2021-07-28';

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  Version: API_VERSION,
  'Content-Type': 'application/json',
};

export async function getContact(contactId: string): Promise<Contact> {
  const res = await fetch(`${API_BASE}/contacts/${contactId}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL getContact failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.contact ?? data;
}

export async function sendSms(contactId: string, message: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/conversations/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: 'SMS',
      contactId,
      message,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL sendSms failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.messageId ?? data.id ?? null;
}

export async function lookupContactByPhone(phone: string): Promise<Contact | null> {
  const locationId = process.env.GHL_LOCATION_ID;
  const res = await fetch(
    `${API_BASE}/contacts/?locationId=${locationId}&query=${encodeURIComponent(phone)}&limit=1`,
    { headers }
  );

  if (!res.ok) return null;

  const data = await res.json();
  const contacts = data.contacts ?? [];
  return contacts.length > 0 ? contacts[0] : null;
}
