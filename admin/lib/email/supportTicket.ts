'use client';

import emailjs from 'emailjs-com';

const EMAILJS_SERVICE_ID =
  process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID ?? 'service_yzfgalt';
const EMAILJS_TEMPLATE_ID =
  process.env.NEXT_PUBLIC_SUPPORT_TEMPLATE_ID ??
  process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID ??
  'template_nx6q0ld';
const EMAILJS_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY ?? 'yDE-e-8ClQhI2pBXK';

interface SupportEmailPayload {
  toEmail: string;
  toName?: string;
  replyTo?: string;
  senderName?: string;
  senderEmail?: string;
  subject: string;
  message: string;
  ticketId: string;
  ticketTitle: string;
  messageType?: string;
}

export async function sendSupportTicketEmail(
  payload: SupportEmailPayload
): Promise<void> {
  const senderEmail = payload.senderEmail ?? '';
  const senderName = payload.senderName ?? 'Alphintra Admin';
  const compactMessage = payload.message.length > 3000
    ? `${payload.message.slice(0, 3000)}\n\n[Message truncated to fit email size limits]`
    : payload.message;
  const formattedContent = [
    `Ticket: ${payload.ticketTitle}`,
    `From: ${senderEmail || senderName}`,
    '',
    'Message:',
    compactMessage,
  ].join('\n');

  const compactEmailContent = formattedContent.length > 1200
    ? `${formattedContent.slice(0, 1200)}\n\n[Truncated]`
    : formattedContent;

  await emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    {
      to_email: payload.toEmail,
      to_name: payload.toName ?? payload.toEmail,
      reply_to: payload.replyTo ?? senderEmail,
      sender_name: senderName,
      sender_email: senderEmail,
      subject: payload.subject,
      message: compactEmailContent,
      verification_code: payload.subject,
      ticket_id: payload.ticketId,
      ticket_title: payload.ticketTitle,
      ticket_name: payload.ticketTitle,
      user_email: senderEmail,
      message_type: payload.messageType ?? 'Support Update',
      email_content: compactEmailContent,
    },
    EMAILJS_PUBLIC_KEY
  );
}