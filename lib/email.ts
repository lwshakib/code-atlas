import { Resend } from 'resend';
import { IndexingCompleteEmail } from '@/components/email/indexing-complete';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailParams {
  to: string;
  codebaseName: string;
  codebaseId: string;
}

export async function sendIndexingCompleteEmail({ to, codebaseName, codebaseId }: SendEmailParams) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const codebaseUrl = `${baseUrl}/codebase/${codebaseId}`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Code Atlas <onboarding@resend.dev>',
      to: [to],
      subject: `✨ Architecture Map Ready: ${codebaseName}`,
      react: IndexingCompleteEmail({ codebaseName, codebaseUrl }),
    });

    if (error) {
      console.error('[RESEND_ERROR]', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error('[EMAIL_SEND_EXCEPTION]', err);
    return { success: false, error: err };
  }
}
