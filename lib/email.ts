/**
 * EMAIL UTILITIES
 * 
 * Handles sending automated transaction emails (like indexing notifications) 
 * using the Resend API and React-Email templates.
 */

import { Resend } from 'resend';
import { IndexingCompleteEmail } from '@/components/email/indexing-complete';

// Initialize the Resend client with the API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailParams {
  to: string;
  codebaseName: string;
  codebaseId: string;
}

/**
 * SEND INDEXING COMPLETE EMAIL
 * 
 * Triggered by the Inngest background job once a repository has been processed.
 */
export async function sendIndexingCompleteEmail({ to, codebaseName, codebaseId }: SendEmailParams) {
  // Construct the absolute URL to the specific codebase page
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const codebaseUrl = `${baseUrl}/codebase/${codebaseId}`;

  try {
    // Send the email using a React-Email component for the HTML output
    const { data, error } = await resend.emails.send({
      from: 'Code Atlas <onboarding@resend.dev>', // Sender address
      to: [to], // Recipient
      subject: `✨ Architecture Map Ready: ${codebaseName}`, // Inbox subject line
      react: IndexingCompleteEmail({ codebaseName, codebaseUrl }), // Component-based template
    });

    // Check for transit-level errors from the Resend API
    if (error) {
      console.error('[RESEND_ERROR]', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    // Catch-all for network or authentication exceptions
    console.error('[EMAIL_SEND_EXCEPTION]', err);
    return { success: false, error: err };
  }
}

