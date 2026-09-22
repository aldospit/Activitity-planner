import React, { useState, useEffect } from 'react';
import { Poll, Language } from '../types';
import { getPublicOrigin } from '../utils/url';
import { dbService } from '../services/db';
import { translations } from '../translations';
import { Mail, Copy, Check, Send, Sparkles, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { sendGmailEmail, wrapInHtmlEmailTemplate, getCachedAccessToken, acquireGmailAccessToken, sendSystemEmail, getSavedSmtpConfig, saveSmtpConfig, testSmtpConnection, SmtpConfig } from '../services/gmail';
import { auth } from '../services/firebase';

interface TemplateEditorProps {
  poll: Poll;
  lang: Language;
  onSaved: (updatedPoll: Poll) => void;
}

export default function TemplateEditor({ poll, lang, onSaved }: TemplateEditorProps) {
  const t = translations[lang];
  const [inviteTemplate, setInviteTemplate] = useState(poll.invitationTemplate);
  const [confirmTemplate, setConfirmTemplate] = useState(poll.confirmationTemplate);
  const [copiedType, setCopiedType] = useState<'invite' | 'confirm' | null>(null);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [selectedInviteeId, setSelectedInviteeId] = useState<string>('');
  const [customName, setCustomName] = useState<string>('Jan Pietersen');
  const [customEmail, setCustomEmail] = useState<string>('');

  const invitees = dbService.getInviteesForPoll(poll.id);

  // Pre-fill email with logged-in user email if available
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user && user.email && !customEmail) {
        setCustomEmail(user.email);
      }
    });
    return unsub;
  }, [customEmail]);

  useEffect(() => {
    setInviteTemplate(poll.invitationTemplate);
    setConfirmTemplate(poll.confirmationTemplate);
  }, [poll]);

  const handleSave = () => {
    const updated: Poll = {
      ...poll,
      invitationTemplate: inviteTemplate,
      confirmationTemplate: confirmTemplate
    };
    dbService.savePoll(updated);
    onSaved(updated);
  };

  const getUrl = () => {
    const baseUrl = getPublicOrigin() + window.location.pathname;
    return `${baseUrl}?poll=${poll.id}`;
  };

  const getActiveRecipient = () => {
    if (selectedInviteeId && selectedInviteeId !== 'custom') {
      const inv = invitees.find(i => i.id === selectedInviteeId);
      if (inv) {
        return {
          name: `${inv.firstName} ${inv.lastName}`.trim(),
          email: inv.email
        };
      }
    }
    return {
      name: customName || 'Jan Pietersen',
      email: customEmail
    };
  };

  const recipient = getActiveRecipient();

  const replacePlaceholders = (text: string, isConfirmation: boolean) => {
    let replaced = text
      .replace(/{name}/g, recipient.name)
      .replace(/{title}/g, poll.title)
      .replace(/{url}/g, getUrl());

    if (isConfirmation) {
      const firstOpt = poll.options[0];
      const optDateStr = firstOpt ? new Date(firstOpt.dateTime).toLocaleString(lang === 'nl' ? 'nl-NL' : 'en-US', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'TBD';
      replaced = replaced.replace(/{datetime}/g, optDateStr);
    }
    return replaced;
  };

  const handleCopy = (type: 'invite' | 'confirm') => {
    const targetText = type === 'invite' 
      ? replacePlaceholders(inviteTemplate, false) 
      : replacePlaceholders(confirmTemplate, true);
    
    navigator.clipboard.writeText(targetText).then(() => {
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    });
  };

  const handleSendDirectly = async (type: 'invite' | 'confirm') => {
    if (!recipient.email.trim() || !recipient.email.includes('@')) {
      alert(lang === 'nl' 
        ? 'Vul alstublieft een geldig e-mailadres in voor de ontvanger.' 
        : 'Please enter a valid recipient email address.');
      return;
    }

    setSendStatus('sending');
    try {
      const rawContent = type === 'invite'
        ? replacePlaceholders(inviteTemplate, false)
        : replacePlaceholders(confirmTemplate, true);

      const htmlBody = wrapInHtmlEmailTemplate(
        poll.title,
        rawContent,
        getUrl(),
        lang === 'nl' ? 'Bekijk & Geef Beschikbaarheid Door' : 'View & Submit Availability'
      );

      await sendSystemEmail({
        to: recipient.email.trim().toLowerCase(),
        subject: lang === 'nl' 
          ? `${type === 'invite' ? 'Uitnodiging' : 'Bevestiging'}: ${poll.title}`
          : `${type === 'invite' ? 'Invitation' : 'Confirmation'}: ${poll.title}`,
        bodyHtml: htmlBody,
        token: getCachedAccessToken()
      });

      setSendStatus('success');
      setTimeout(() => setSendStatus('idle'), 4000);
    } catch (err: any) {
      console.error('Email sending error:', err);
      alert(lang === 'nl'
        ? `Fout bij verzenden: ${err.message || 'Controleer uw verbinding of e-mailinstellingen'}`
        : `Error sending email: ${err.message || 'Check your connection or email settings'}`
      );
      setSendStatus('idle');
    }
  };

  const handleSendToAll = async (type: 'invite' | 'confirm') => {
    if (invitees.length === 0) {
      alert(lang === 'nl'
        ? 'Er zijn nog geen genodigden toegevoegd aan deze datumprikker.'
        : 'No invitees have been added to this date planner yet.');
      return;
    }

    const confirmSend = window.confirm(lang === 'nl'
      ? `Weet u zeker dat u de echte ${type === 'invite' ? 'uitnodigingsmail' : 'bevestigingsmail'} wilt sturen naar alle ${invitees.length} genodigden?`
      : `Are you sure you want to send the real ${type === 'invite' ? 'invitation' : 'confirmation'} email to all ${invitees.length} invitees?`
    );
    if (!confirmSend) return;

    setSendStatus('sending');
    try {
      let successCount = 0;
      let failCount = 0;

      for (const inv of invitees) {
        try {
          const invName = `${inv.firstName} ${inv.lastName}`.trim();
          const pContent = type === 'invite' ? inviteTemplate : confirmTemplate;

          let replaced = pContent
            .replace(/{name}/g, invName)
            .replace(/{title}/g, poll.title)
            .replace(/{url}/g, getUrl());

          if (type === 'confirm') {
            const firstOpt = poll.options[0];
            const optDateStr = firstOpt ? new Date(firstOpt.dateTime).toLocaleString(lang === 'nl' ? 'nl-NL' : 'en-US', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            }) : 'TBD';
            replaced = replaced.replace(/{datetime}/g, optDateStr);
          }

          const htmlBody = wrapInHtmlEmailTemplate(
            poll.title,
            replaced,
            getUrl(),
            lang === 'nl' ? 'Bekijk & Geef Beschikbaarheid Door' : 'View & Submit Availability'
          );

          await sendSystemEmail({
            to: inv.email.trim().toLowerCase(),
            subject: lang === 'nl'
              ? `${type === 'invite' ? 'Uitnodiging' : 'Bevestiging'}: ${poll.title}`
              : `${type === 'invite' ? 'Invitation' : 'Confirmation'}: ${poll.title}`,
            bodyHtml: htmlBody,
            token: getCachedAccessToken()
          });
          successCount++;
        } catch (err) {
          console.error(`Error sending email to ${inv.email}:`, err);
          failCount++;
        }
      }

      setSendStatus('success');
      setTimeout(() => setSendStatus('idle'), 4000);

      alert(lang === 'nl'
        ? `Gereed! E-mails succesvol verzonden naar ${successCount} genodigden.${failCount > 0 ? ` (${failCount} mislukt)` : ''}`
        : `Done! Emails successfully sent to ${successCount} invitees.${failCount > 0 ? ` (${failCount} failed)` : ''}`
      );
    } catch (err: any) {
      console.error('Send to all error:', err);
      alert(lang === 'nl'
        ? `Fout bij verzenden: ${err.message || 'Controleer uw verbinding'}`
        : `Error sending: ${err.message || 'Check your connection'}`
      );
      setSendStatus('idle');
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-6" id="template-editor">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider font-display">
            <Mail className="h-4 w-4 text-indigo-600" />
            {t.templates}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {lang === 'nl' 
              ? 'Pas de uitnodigings- of bevestigingsmails aan met dynamische variabelen.' 
              : 'Customize the invitation or confirmation emails with placeholders.'}
          </p>
        </div>
        <div className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
          <span>🏷️</span> Tags: &#123;name&#125;, &#123;title&#125;, &#123;url&#125;, &#123;datetime&#125;
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Invitation template */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-sm" id="invitation-template-panel">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              {t.invitationMailTemplate}
            </span>
          </div>
          <textarea
            className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-40"
            value={inviteTemplate}
            onChange={(e) => setInviteTemplate(e.target.value)}
            id="invite-template-textarea"
          />
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => handleCopy('invite')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-750 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all border border-slate-200"
              id="copy-invite-preview-btn"
            >
              <Copy className="h-3 w-3" />
              {copiedType === 'invite' ? t.copied : t.copyBtn}
            </button>
            <span className="text-[10px] text-slate-400 font-medium">
              {lang === 'nl' 
                ? 'Voorbeeld voor ' 
                 : 'Previewing for '}
              {recipient.name}
            </span>
          </div>
        </div>

        {/* Confirmation template */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-sm" id="confirmation-template-panel">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              {t.confirmationMailTemplate}
            </span>
          </div>
          <textarea
            className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-40"
            value={confirmTemplate}
            onChange={(e) => setConfirmTemplate(e.target.value)}
            id="confirm-template-textarea"
          />
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => handleCopy('confirm')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-750 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all border border-slate-200"
              id="copy-confirm-preview-btn"
            >
              <Copy className="h-3 w-3" />
              {copiedType === 'confirm' ? t.copied : t.copyBtn}
            </button>
            <span className="text-[10px] text-slate-400 font-medium">
              Optie: {poll.options[0] ? '1e voorstel' : 'TBD'}
            </span>
          </div>
        </div>

      </div>

      {/* Gmail sending integration settings and control panel */}
      <div className="border-t border-slate-200/50 pt-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5 text-indigo-505" />
            {lang === 'nl' ? 'Echte E-mails Verzenden via Gmail' : 'Send Real Emails via Gmail'}
          </h4>
          <span className="text-[10px] text-slate-400 font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100">
            {lang === 'nl' ? 'Gebruikt uw eigen Gmail' : 'Uses your own Gmail'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Quick Individual Delivery Option */}
          <div className="lg:col-span-7 bg-white border border-slate-200 p-4 rounded-xl space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-600">{lang === 'nl' ? 'Optie 1: Handmatige / individuele levering' : 'Option 1: Manual / Individual Delivery'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{lang === 'nl' ? 'Ontvanger selecteren' : 'Select Recipient'}</label>
                <select
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={selectedInviteeId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedInviteeId(val);
                    if (val && val !== 'custom') {
                      const inv = invitees.find(i => i.id === val);
                      if (inv) {
                        setCustomName(`${inv.firstName} ${inv.lastName}`.trim());
                        setCustomEmail(inv.email);
                      }
                    } else if (val === 'custom') {
                      setCustomName('');
                      setCustomEmail('');
                    }
                  }}
                >
                  <option value="">{lang === 'nl' ? '— Kies een genodigde —' : '— Choose an invitee —'}</option>
                  {invitees.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.firstName} {i.lastName} ({i.email})
                    </option>
                  ))}
                  <option value="custom">{lang === 'nl' ? '✍️ Handmatig invoeren...' : '✍️ Custom Entry...'}</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{lang === 'nl' ? 'Naam' : 'Name'}</label>
                <input
                  type="text"
                  value={recipient.name}
                  disabled={selectedInviteeId !== '' && selectedInviteeId !== 'custom'}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={lang === 'nl' ? 'Bijv. Jan' : 'e.g. John'}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{lang === 'nl' ? 'E-mailadres' : 'Email Address'}</label>
                <input
                  type="email"
                  value={recipient.email}
                  disabled={selectedInviteeId !== '' && selectedInviteeId !== 'custom'}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="naam@voorbeeld.nl"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3 text-indigo-400" />
                {lang === 'nl' ? 'Wordt direct verstuurd naar deze persoon.' : 'Sent directly to this person.'}
              </span>

              {sendStatus === 'sending' ? (
                <span className="text-xs font-bold text-indigo-600 animate-pulse">{lang === 'nl' ? 'Verzenden...' : 'Sending...'}</span>
              ) : sendStatus === 'success' ? (
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{lang === 'nl' ? 'Mail verzonden!' : 'Mail sent!'}</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSendDirectly('invite')}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Send className="h-2.5 w-2.5" />
                    {lang === 'nl' ? 'Verstuur Uitnodiging' : 'Send Invite'}
                  </button>
                  <button
                    onClick={() => handleSendDirectly('confirm')}
                    className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-100 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Send className="h-2.5 w-2.5" />
                    {lang === 'nl' ? 'Verstuur Bevestiging' : 'Send Confirm'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bulk Delivery Option */}
          <div className="lg:col-span-5 bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-600">{lang === 'nl' ? 'Optie 2: Bulk verzending' : 'Option 2: Bulk Mailing'}</span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {invitees.length} {lang === 'nl' ? 'genodigden' : 'invitees'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                {lang === 'nl' 
                  ? 'Stuur de momenteel getoonde templates in één keer naar álle geregistreerde genodigden van deze datumprikker via uw eigen Gmail account.'
                  : 'Send the currently shown templates to all registered invitees at once using your direct Gmail account.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4">
              {sendStatus === 'sending' ? (
                <span className="text-xs font-bold text-indigo-600 animate-pulse">{lang === 'nl' ? 'Mails versturen...' : 'Sending bulk...'}</span>
              ) : (
                <>
                  <button
                    onClick={() => handleSendToAll('invite')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-100 transition-all w-full sm:w-auto justify-center"
                  >
                    <Send className="h-3 w-3" />
                    {lang === 'nl' ? 'Meld allen (Uitnodiging)' : 'Notify All (Invite)'}
                  </button>
                  <button
                    onClick={() => handleSendToAll('confirm')}
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-violet-100 transition-all w-full sm:w-auto justify-center"
                  >
                    <Send className="h-3 w-3" />
                    {lang === 'nl' ? 'Meld allen (Bevestiging)' : 'Notify All (Confirm)'}
                  </button>
                </>
              )}
            </div>
          </div>

        </div>

        {/* Global Action Bottom Bar */}
        <div className="flex items-center justify-between border-t border-slate-200/50 pt-4">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            id="save-templates-bottom-btn"
          >
            {lang === 'nl' ? 'Templates Opslaan' : 'Save Templates'}
          </button>
          <span className="text-[11px] text-slate-400 font-medium font-mono">
            ID: {poll.id}
          </span>
        </div>
      </div>
    </div>
  );
}
