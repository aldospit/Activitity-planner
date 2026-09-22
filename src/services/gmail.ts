import { GoogleAuthProvider, signInWithPopup, getAuth, linkWithPopup, OAuthProvider } from 'firebase/auth';

// In-memory cache for the Google access token as strictly mandated by workspace-integration skill
let cachedAccessToken: string | null = null;

export function getCachedAccessToken(): string | null {
  return cachedAccessToken;
}

export function setCachedAccessToken(token: string | null): void {
  cachedAccessToken = token;
}

/**
 * Register automatic token clearing on sign out
 */
export function initializeGmailAuthListener(authInstance: any): void {
  authInstance.onAuthStateChanged((user: any) => {
    if (!user) {
      cachedAccessToken = null;
    }
  });
}

/**
 * Trigger Google Sign-In and request Gmail Send scope
 */
export async function acquireGmailAccessToken(): Promise<string> {
  const auth = getAuth();
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/gmail.send');
  
  try {
    let result;
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.isAnonymous) {
      try {
        console.log('Linking anonymous user to Google account to preserve data and avoid session loss');
        result = await linkWithPopup(currentUser, provider);
      } catch (linkErr) {
        console.warn('linkWithPopup failed, falling back to signInWithPopup:', linkErr);
        result = await signInWithPopup(auth, provider);
      }
    } else {
      result = await signInWithPopup(auth, provider);
    }
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential || !credential.accessToken) {
      throw new Error('Geen access token ontvangen van Google.');
    }
    cachedAccessToken = credential.accessToken;
    return cachedAccessToken;
  } catch (error) {
    console.error('Fout bij ophalen van Google Gmail machtigingen:', error);
    throw error;
  }
}

/**
 * Trigger Microsoft Sign-In and request Outlook Mail Send scope
 */
export async function acquireOutlookAccessToken(): Promise<string> {
  const auth = getAuth();
  const provider = new OAuthProvider('microsoft.com');
  provider.addScope('mail.send');
  provider.addScope('offline_access');
  
  try {
    let result;
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.isAnonymous) {
      try {
        console.log('Linking anonymous user to Microsoft account');
        result = await linkWithPopup(currentUser, provider);
      } catch (linkErr) {
        console.warn('linkWithPopup failed, falling back to signInWithPopup:', linkErr);
        result = await signInWithPopup(auth, provider);
      }
    } else {
      result = await signInWithPopup(auth, provider);
    }
    const credential = OAuthProvider.credentialFromResult(result);
    if (!credential || !credential.accessToken) {
      throw new Error('Geen access token ontvangen van Microsoft.');
    }
    return credential.accessToken;
  } catch (error) {
    console.error('Fout bij ophalen van Microsoft Outlook machtigingen:', error);
    throw error;
  }
}

/**
 * Wraps clean messaging into a premium responsive HTML email wrapper for general / datumprikker emails
 */
export function wrapInHtmlEmailTemplate(
  title: string, 
  formattedBodyHtml: string, 
  actionUrl?: string, 
  actionText?: string,
  options?: { headerTitle?: string; footerText?: string; headerBadge?: string }
): string {
  const header = options?.headerTitle || '📅 Datumprikker';
  const footer = options?.footerText || 'Dit is een automatische uitnodiging verstuurd namens de organisator via Datumprikker.';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 32px 16px; color: #334155; margin: 0;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <!-- Header -->
        <div style="background-color: #4f46e5; padding: 24px; text-align: center; color: #ffffff;">
          ${options?.headerBadge ? `
            <div style="margin-bottom: 6px;">
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background-color: rgba(255,255,255,0.2); padding: 3px 10px; border-radius: 9999px;">
                ${options.headerBadge}
              </span>
            </div>
          ` : ''}
          <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em; font-family: sans-serif;">${header}</h1>
        </div>
        <!-- Body -->
        <div style="padding: 32px 24px;">
          <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 18px; font-weight: 600; color: #0f172a;">${title}</h2>
          <div style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
            ${formattedBodyHtml}
          </div>
          ${actionUrl ? `
            <div style="text-align: center; margin: 32px 0;">
              <a href="${actionUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; font-weight: 600; font-size: 14px; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2); text-align: center;">
                ${actionText || 'Bekijk details & stem'}
              </a>
            </div>
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px; line-height: 1.4;">
              Werkt de knop hierboven niet? Kopieer en plak de volgende link in uw browser:<br/>
              <a href="${actionUrl}" style="color: #4f46e5; text-decoration: underline; word-break: break-all;">${actionUrl}</a>
            </p>
          ` : ''}
        </div>
        <!-- Footer -->
        <div style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
          <p style="margin: 0; line-height: 1.4;">${footer}</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Wraps meeting agendas, notes, and action lists into a dedicated, professional email template (no Datumprikker branding)
 */
export function wrapInMeetingEmailTemplate(
  title: string,
  formattedBodyHtml: string,
  options: {
    badge?: string; // e.g. "Agenda", "Actielijst", "Notities & Acties", "Agenda & Actielijst"
    headerTitle?: string; // e.g. "📋 Overleg & Agenda" or "🎯 Actielijst" or "📋 Overlegverslag & Acties"
    actionUrl?: string;
    actionText?: string;
    footerNote?: string;
    themeGradient?: string;
  } = {}
): string {
  const badge = options.badge || 'Agenda & Actielijst';
  const header = options.headerTitle || '📋 Agenda & Actielijst';
  const footerNote = options.footerNote || 'IT Platform Twente • Overleg-, Notities- en Actiebeheer';
  const gradient = options.themeGradient || 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 32px 16px; color: #334155; margin: 0;">
      <div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
        <!-- Header -->
        <div style="background: ${gradient}; padding: 26px 28px; text-align: left; color: #ffffff; border-bottom: 3px solid #6366f1;">
          <div style="margin-bottom: 8px;">
            <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; background-color: rgba(255, 255, 255, 0.18); color: #ffffff; padding: 4px 12px; border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.25); display: inline-block;">
              ${badge}
            </span>
          </div>
          <h1 style="margin: 0 0 4px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.025em; color: #ffffff; font-family: sans-serif;">
            ${header}
          </h1>
          <p style="margin: 0; font-size: 12px; color: #c7d2fe;">
            IT Platform Twente Overleg- & Notitiebeheer
          </p>
        </div>

        <!-- Body -->
        <div style="padding: 28px 24px; font-size: 14px; line-height: 1.6; color: #334155;">
          ${formattedBodyHtml}

          ${options.actionUrl ? `
            <div style="text-align: center; margin: 32px 0 16px 0;">
              <a href="${options.actionUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 13px 28px; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3); text-align: center;">
                ${options.actionText || 'Bekijk Online & Acties Bijwerken'}
              </a>
            </div>
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 14px; line-height: 1.4;">
              Werkt de knop niet? Kopieer en plak de volgende link in uw browser:<br/>
              <a href="${options.actionUrl}" style="color: #4f46e5; text-decoration: underline; word-break: break-all;">${options.actionUrl}</a>
            </p>
          ` : ''}
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
          <p style="margin: 0 0 4px 0; font-weight: 700; color: #334155;">
            ${footerNote}
          </p>
          <p style="margin: 0; font-size: 11px; color: #94a3b8;">
            U ontvangt deze e-mail als deelnemer, genodigde of actiehouder.
          </p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Build RFC822 compliant raw message and encode to base64url standard format
 */
function buildRawEmail(to: string, subject: string, bodyHtml: string): string {
  const emailLines = [
    `To: ${to}`,
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    bodyHtml
  ];
  const email = emailLines.join('\r\n');
  const base64 = btoa(unescape(encodeURIComponent(email)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export function getSavedSmtpConfig(): SmtpConfig | null {
  try {
    const saved = localStorage.getItem('app_smtp_config');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Fout bij ophalen van SMTP instellingen:', e);
  }
  return {
    host: 'smtp.office365.com',
    port: 587,
    user: 'team@itplatformtwente.nl',
    pass: '',
    from: 'IT Platform Twente <team@itplatformtwente.nl>'
  };
}

export function saveSmtpConfig(config: SmtpConfig): void {
  localStorage.setItem('app_smtp_config', JSON.stringify(config));
}

/**
 * Universal email dispatcher: tries backend server SMTP first, then falls back to client OAuth token
 */
export async function sendSystemEmail({
  to,
  subject,
  bodyHtml,
  token
}: {
  to: string;
  subject: string;
  bodyHtml: string;
  token?: string | null;
}) {
  const smtpConfig = getSavedSmtpConfig();

  // Attempt server dispatch first
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        subject,
        bodyHtml,
        smtpConfig
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return data;
      }
      if (data.needsConfig && token) {
        // Fall back to client token if server SMTP is missing pass
        console.log('Server SMTP needs config, falling back to client OAuth token');
        return sendGmailEmail({ to, subject, bodyHtml, token });
      }
      throw new Error(data.message || data.error || 'Server mail verzending mislukt');
    } else {
      const errorData = await res.json().catch(() => ({}));
      const serverErrMsg = errorData.error || errorData.message || `Mailserver gaf een foutcode ${res.status}`;
      if (token) {
        console.log('Server dispatch failed with status', res.status, ', attempting fallback to client token');
        return sendGmailEmail({ to, subject, bodyHtml, token });
      }
      throw new Error(serverErrMsg);
    }
  } catch (err) {
    console.warn('Server send-email fetch warning:', err);
    if (token) {
      return sendGmailEmail({ to, subject, bodyHtml, token });
    }
    throw err;
  }
}

/**
 * Test SMTP server connection
 */
export async function testSmtpConnection(config: SmtpConfig) {
  const res = await fetch('/api/email/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ smtpConfig: config })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Verbinding testen mislukt.');
  }
  return data;
}

/**
 * Send email via official rest endpoint using direct GMail credentials
 */
export async function sendGmailEmail({
  to,
  subject,
  bodyHtml,
  token
}: {
  to: string;
  subject: string;
  bodyHtml: string;
  token: string;
}) {
  const raw = buildRawEmail(to, subject, bodyHtml);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gmail API fout: ${response.status} - ${errText}`);
  }

  return response.json();
}

/**
 * Send email via Microsoft Graph API using Outlook credentials
 */
export async function sendOutlookEmail({
  to,
  subject,
  bodyHtml,
  token
}: {
  to: string;
  subject: string;
  bodyHtml: string;
  token: string;
}) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: bodyHtml
        },
        toRecipients: [
          {
            emailAddress: {
              address: to
            }
          }
        ]
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Outlook API fout: ${response.status} - ${errText}`);
  }

  return response.json();
}
