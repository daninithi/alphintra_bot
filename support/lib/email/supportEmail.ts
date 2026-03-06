'use client';

import emailjs from 'emailjs-com';

const EMAILJS_SERVICE_ID =
  process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID ?? 'service_hd0x07j';
const EMAILJS_TEMPLATE_ID =
  process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID ?? 'template_bm1j6uo';
const EMAILJS_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY ?? 'QuWnJl-wEWqo6qnoL';

export async function sendSupportCredentials(
  email: string,
  username: string,
  password: string
): Promise<void> {
  console.log('[Email] Sending support credentials email', { email, username });
  
  const message = `Welcome to Alphintra Support Team!

Your account has been created successfully.

Login Credentials:
Username: ${username}
Password: ${password}

Please keep these credentials secure and change your password after first login.

Best regards,
Alphintra Admin Team`;

  await emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    {
      to_email: email,
      to_name: username,
      verification_code: `${username} / ${password}`,
      message: message,
    },
    EMAILJS_PUBLIC_KEY
  );
  
  console.log('[Email] Support credentials email sent successfully');
}
