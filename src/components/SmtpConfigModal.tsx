import React, { useState, useEffect } from 'react';
import { Language } from '../types';
import { Mail, Server, CheckCircle2, AlertCircle, X, Key, Send, ShieldCheck, RefreshCw } from 'lucide-react';
import { getSavedSmtpConfig, saveSmtpConfig, testSmtpConnection, SmtpConfig } from '../services/gmail';

interface SmtpConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export default function SmtpConfigModal({ isOpen, onClose, lang }: SmtpConfigModalProps) {
  const isNl = lang === 'nl';
  
  const [config, setConfig] = useState<SmtpConfig>({
    host: 'smtp.office365.com',
    port: 587,
    user: 'team@itplatformtwente.nl',
    pass: '',
    from: 'IT Platform Twente <team@itplatformtwente.nl>'
  });

  const [testingStatus, setTestingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testResultMsg, setTestResultMsg] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const saved = getSavedSmtpConfig();
      if (saved) {
        setConfig(saved);
      }
      setTestingStatus('idle');
      setTestResultMsg('');
      setSaveSuccessMsg(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: 'm365' | 'gmail' | 'custom') => {
    if (preset === 'm365') {
      setConfig(prev => ({
        ...prev,
        host: 'smtp.office365.com',
        port: 587,
        user: prev.user || 'team@itplatformtwente.nl',
        from: prev.from || 'IT Platform Twente <team@itplatformtwente.nl>'
      }));
    } else if (preset === 'gmail') {
      setConfig(prev => ({
        ...prev,
        host: 'smtp.gmail.com',
        port: 587,
        user: prev.user || 'team@itplatformtwente.nl',
        from: prev.from || 'IT Platform Twente <team@itplatformtwente.nl>'
      }));
    }
    setTestingStatus('idle');
  };

  const handleTestConnection = async () => {
    if (!config.user.trim() || !config.pass.trim()) {
      setTestingStatus('error');
      setTestResultMsg(isNl 
        ? 'Vul a.u.b. een e-mailadres en wachtwoord in om de verbinding te testen.' 
        : 'Please enter an email address and password to test the connection.');
      return;
    }

    setTestingStatus('testing');
    setTestResultMsg('');

    try {
      const res = await testSmtpConnection(config);
      setTestingStatus('success');
      setTestResultMsg(res.message || (isNl ? 'Verbinding met de e-mailserver is succesvol geverifieerd!' : 'Connection to mail server successfully verified!'));
    } catch (err: any) {
      setTestingStatus('error');
      setTestResultMsg(err.message || (isNl ? 'Kan geen verbinding maken met de e-mailserver.' : 'Failed to connect to mail server.'));
    }
  };

  const handleSave = () => {
    if (!config.user.trim()) {
      alert(isNl ? 'Gebruikersnaam / E-mailadres is verplicht.' : 'Username / Email address is required.');
      return;
    }
    saveSmtpConfig(config);
    setSaveSuccessMsg(true);
    setTimeout(() => {
      setSaveSuccessMsg(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                {isNl ? 'E-mail Server & M365 Integratie' : 'Email Server & M365 Integration'}
              </h2>
              <p className="text-xs text-slate-300">
                {isNl ? 'Configureer 24/7 geautomatiseerde mailverzending via M365 of Gmail' : 'Configure 24/7 automated email sending via M365 or Gmail'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Preset Selection Buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              {isNl ? 'Snelkiezer Mailprovider' : 'Quick Select Mail Provider'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset('m365')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                  config.host.includes('office365') || config.host.includes('outlook')
                    ? 'border-indigo-600 bg-indigo-50/80 text-indigo-700 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700'
                }`}
              >
                <span className="text-base mb-1">🏢</span>
                Microsoft 365
                <span className="text-[10px] font-normal text-slate-500">team@itplatformtwente.nl</span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('gmail')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                  config.host.includes('gmail')
                    ? 'border-indigo-600 bg-indigo-50/80 text-indigo-700 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700'
                }`}
              >
                <span className="text-base mb-1">📧</span>
                Google / Gmail
                <span className="text-[10px] font-normal text-slate-500">smtp.gmail.com</span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('custom')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                  !config.host.includes('office365') && !config.host.includes('gmail')
                    ? 'border-indigo-600 bg-indigo-50/80 text-indigo-700 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700'
                }`}
              >
                <Server className="w-4 h-4 mb-1 text-slate-600" />
                Custom SMTP
                <span className="text-[10px] font-normal text-slate-500">{isNl ? 'Eigen server' : 'Custom server'}</span>
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {isNl ? 'SMTP Hostnaam' : 'SMTP Hostname'}
              </label>
              <input
                type="text"
                value={config.host}
                onChange={e => setConfig({ ...config, host: e.target.value })}
                placeholder="smtp.office365.com"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {isNl ? 'Poort (TLS / SSL)' : 'Port (TLS / SSL)'}
              </label>
              <input
                type="number"
                value={config.port}
                onChange={e => setConfig({ ...config, port: Number(e.target.value) })}
                placeholder="587"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {isNl ? 'Verzender Weergavenaam & E-mail' : 'Sender Display Name & Email'}
              </label>
              <input
                type="text"
                value={config.from}
                onChange={e => setConfig({ ...config, from: e.target.value })}
                placeholder="IT Platform Twente <team@itplatformtwente.nl>"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {isNl ? 'Gebruikersnaam / Mailadres' : 'Username / Mail Address'}
              </label>
              <input
                type="email"
                value={config.user}
                onChange={e => setConfig({ ...config, user: e.target.value })}
                placeholder="team@itplatformtwente.nl"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
                <span>{isNl ? 'Wachtwoord / App Wachtwoord' : 'Password / App Password'}</span>
                <Key className="w-3.5 h-3.5 text-slate-400" />
              </label>
              <input
                type="password"
                value={config.pass}
                onChange={e => setConfig({ ...config, pass: e.target.value })}
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Test Status Banner */}
          {testResultMsg && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              testingStatus === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              {testingStatus === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed whitespace-pre-line flex-1">
                {testResultMsg}
              </div>
            </div>
          )}

          {/* Helpful Tips Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2.5">
            <div className="font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                {config.host.includes('gmail')
                  ? (isNl ? 'Google / Gmail Instelinstructies:' : 'Google / Gmail Setup:')
                  : (isNl ? 'Microsoft 365 / Outlook Instelinstructies:' : 'Microsoft 365 / Outlook Setup:')}
              </span>
              <span className="text-[10px] text-slate-500 font-normal">
                {config.host.includes('gmail') ? 'smtp.gmail.com:587' : 'smtp.office365.com:587'}
              </span>
            </div>

            {config.host.includes('gmail') ? (
              <div className="text-[11px] text-slate-600 leading-relaxed space-y-2">
                <p>
                  {isNl 
                    ? 'Google staat inloggen met uw normale Gmail-wachtwoord uit veiligheidsoverwegingen niet toe. Om via Gmail te mailen heeft u een gratis App-wachtwoord nodig:'
                    : 'Google requires an App Password instead of your normal account password:'}
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-700 font-medium">
                  <li>
                    {isNl ? 'Zorg dat 2-stapsverificatie aan staat op uw Google Account.' : 'Ensure 2-Step Verification is active.'}
                  </li>
                  <li>
                    {isNl ? 'Ga naar ' : 'Go to '}
                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-mono font-bold">myaccount.google.com/apppasswords</a>
                  </li>
                  <li>
                    {isNl 
                      ? 'Vul een naam in (bijv. "ITPT App") en klik op Genereren.' 
                      : 'Type an app name (e.g. "ITPT App") and click Create.'}
                  </li>
                  <li>
                    {isNl 
                      ? 'Kopieer de 16 letters (zonder spaties) en plak deze hierboven in het veld "Wachtwoord / App Wachtwoord".' 
                      : 'Copy the 16-character code into the Password field above.'}
                  </li>
                </ol>
              </div>
            ) : (
              <div className="text-[11px] text-slate-600 leading-relaxed space-y-1.5">
                <p>
                  {isNl 
                    ? 'Microsoft blokkeert sinds kort standaard basic authenticatie (inloggen met uw reguliere M365 wachtwoord). Om te koppelen via smtp.office365.com (poort 587):'
                    : 'Microsoft disables basic auth by default for SMTP. To connect via smtp.office365.com (port 587):'}
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-700 font-medium">
                  <li>
                    <strong>{isNl ? 'Optie A - App Wachtwoord (Aanbevolen):' : 'Option A - App Password (Recommended):'}</strong>{' '}
                    {isNl ? 'Ga naar ' : 'Go to '}
                    <a href="https://mysignins.microsoft.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-mono">mysignins.microsoft.com</a>
                    {isNl ? ' -> Beveiligingsinformatie -> Methode toevoegen -> Kies "Wachtwoord voor app" en plak die hier als wachtwoord.' : ' -> Security Info -> Add Method -> App Password.'}
                  </li>
                  <li>
                    <strong>{isNl ? 'Optie B - M365 Admin Instelling:' : 'Option B - M365 Admin Setting:'}</strong>{' '}
                    {isNl ? 'Laat de IT-beheerder in M365 Admin Center bij Actieve Gebruikers -> ' : 'Enable "Authenticated SMTP" in M365 Admin Center under Active Users -> '}
                    <span className="font-semibold text-slate-900">{config.user}</span>
                    {isNl ? ' -> Mail -> Beheer e-mailapps het vinkje "Geauthenticeerde SMTP" aanzetten.' : ' -> Mail -> Manage email apps.'}
                  </li>
                </ol>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testingStatus === 'testing'}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 hover:border-slate-400 bg-white text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {testingStatus === 'testing' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                {isNl ? 'Verbinding testen...' : 'Testing connection...'}
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 text-slate-500" />
                {isNl ? 'Test Verbinding' : 'Test Connection'}
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
            >
              {isNl ? 'Annuleren' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 transition-colors"
            >
              {saveSuccessMsg ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {isNl ? 'Opgeslagen!' : 'Saved!'}
                </>
              ) : (
                <>
                  {isNl ? 'Instellingen Opslaan' : 'Save Settings'}
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
