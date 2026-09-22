import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Helper to format M365 / Gmail / SMTP auth errors cleanly
  const formatSmtpError = (errMessage: string): string => {
    if (errMessage.includes('535 5.7.139') || errMessage.includes('basic authentication is disabled') || errMessage.includes('Authentication unsuccessful')) {
      return `Microsoft 365 heeft Basic Authentication uitgeschakeld voor dit account (${errMessage}).\n\n` +
        `Oplossingen voor Microsoft 365 / Outlook:\n` +
        `1. Gebruik een 'App Wachtwoord' (App Password): Ga naar mysignins.microsoft.com -> Beveiligingsinformatie -> Methode toevoegen -> Wachtwoord voor app.\n` +
        `2. Schakel 'Geauthenticeerde SMTP' in: M365 Admin Center -> Actieve gebruikers -> Selecteer gebruiker -> Mail -> Beheer e-mailapps -> Schakel 'Geauthenticeerde SMTP' in.`;
    }
    if (errMessage.includes('535') && (errMessage.includes('5.7.8') || errMessage.includes('BadCredentials') || errMessage.includes('Username and Password not accepted'))) {
      return `Google staat inloggen met uw normale Gmail-wachtwoord niet toe voor externe SMTP-apps (${errMessage}).\n\n` +
        `Oplossing (Google App-wachtwoord):\n` +
        `1. Zorg dat '2-stapsverificatie' aan staat op uw Google-account.\n` +
        `2. Ga naar https://myaccount.google.com/apppasswords\n` +
        `3. Maak een nieuw app-wachtwoord aan (bijv. naam 'IT Platform Twente').\n` +
        `4. Kopieer het 16-letterige wachtwoord (zonder spaties) en plak dit in het veld 'Wachtwoord / App Wachtwoord'.`;
    }
    return errMessage;
  };

  // API Endpoint: Send Email via Server (SMTP / Office 365 / Gmail)
  app.post('/api/send-email', async (req, res) => {
    try {
      const { to, subject, bodyHtml, bodyText, from, smtpConfig } = req.body;

      if (!to || !subject || (!bodyHtml && !bodyText)) {
        return res.status(400).json({ success: false, error: 'Ontbrekende velden (ontvanger, onderwerp of inhoud)' });
      }

      // Determine transport configuration
      const host = smtpConfig?.host || process.env.SMTP_HOST || 'smtp.office365.com';
      const port = Number(smtpConfig?.port || process.env.SMTP_PORT || 587);
      const user = smtpConfig?.user || process.env.SMTP_USER || '';
      const pass = smtpConfig?.pass || process.env.SMTP_PASS || '';
      const fromAddr = from || smtpConfig?.from || process.env.SMTP_FROM || (user ? `IT Platform Twente <${user}>` : 'Datumprikker <team@itplatformtwente.nl>');

      if (!user || !pass) {
        console.warn('[/api/send-email] Geen SMTP-authenticatiegegevens ingesteld.');
        return res.json({
          success: false,
          needsConfig: true,
          message: 'Geen SMTP wachtwoord geconfigureerd op de server. Stel uw M365 of Gmail gegevens in via de E-mail configuratie in de app.'
        });
      }

      const isSecure = port === 465;
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: isSecure,
        auth: { user, pass },
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false
        }
      });

      const mailOptions = {
        from: fromAddr,
        to,
        subject,
        text: bodyText || (bodyHtml ? bodyHtml.replace(/<[^>]*>/g, '') : ''),
        html: bodyHtml || bodyText
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('[/api/send-email] E-mail succesvol verzonden:', info.messageId);

      return res.json({
        success: true,
        messageId: info.messageId
      });
    } catch (err: any) {
      console.error('[/api/send-email] Fout bij verzenden van e-mail:', err);
      const formattedError = formatSmtpError(err.message || 'Fout bij het versturen van de mail via de server');
      return res.status(500).json({
        success: false,
        error: formattedError
      });
    }
  });

  // API Endpoint: Test SMTP configuration
  app.post('/api/email/test', async (req, res) => {
    try {
      const { smtpConfig } = req.body;
      const host = smtpConfig?.host || process.env.SMTP_HOST || 'smtp.office365.com';
      const port = Number(smtpConfig?.port || process.env.SMTP_PORT || 587);
      const user = smtpConfig?.user || process.env.SMTP_USER || '';
      const pass = smtpConfig?.pass || process.env.SMTP_PASS || '';

      if (!user || !pass) {
        return res.status(400).json({ success: false, error: 'Gebruikersnaam en wachtwoord zijn verplicht om de verbinding te testen.' });
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false }
      });

      await transporter.verify();
      return res.json({ success: true, message: `Verbinding met ${host}:${port} (${user}) is succesvol tot stand gebracht!` });
    } catch (err: any) {
      console.error('[/api/email/test] SMTP Test Fout:', err);
      const formattedError = formatSmtpError(err.message || 'Verbinding met de mailserver mislukt.');
      return res.status(500).json({ success: false, error: formattedError });
    }
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    let distPath = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(path.join(distPath, 'index.html')) && fs.existsSync(path.join(__dirname, 'index.html'))) {
      distPath = __dirname;
    }
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
