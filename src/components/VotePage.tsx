import React, { useState, useEffect } from 'react';
import { Poll, Invitee, VoteValue, Language } from '../types';
import { dbService } from '../services/db';
import { translations } from '../translations';
import { Check, X, AlertCircle, Sparkles, CheckCircle2, Heart } from 'lucide-react';

interface VotePageProps {
  pollId: string;
  lang: Language;
  onVoteSubmitted: () => void;
}

export default function VotePage({ pollId, lang, onVoteSubmitted }: VotePageProps) {
  const t = translations[lang];
  const [poll, setPoll] = useState<Poll | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [selectedInviteeId, setSelectedInviteeId] = useState<string>('new');
  const [prevSelectedId, setPrevSelectedId] = useState<string>('new');
  
  // Form for new guest signup
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Voting states
  const [votes, setVotes] = useState<Record<string, VoteValue>>({});
  const [optionComments, setOptionComments] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Admin / Creator editing fields inside the vote page itself:
  const [isAdminEditing, setIsAdminEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocationType, setEditLocationType] = useState<'physical' | 'digital' | 'hybrid' | ''>('');
  const [editLocationAddress, setEditLocationAddress] = useState('');

  const loadPollData = async () => {
    setIsLoading(true);
    let p = dbService.getPoll(pollId);
    if (!p) {
      p = await dbService.fetchPollAsync(pollId);
    }
    if (p) {
      setPoll(p);
      if (!isAdminEditing) {
        setEditTitle(p.title || '');
        setEditDescription(p.description || '');
        setEditLocationType(p.locationType || '');
        setEditLocationAddress(p.locationAddress || '');
      }
      const list = await dbService.fetchInviteesForPoll(pollId);
      setInvitees(list);
      
      const initialVotes: Record<string, VoteValue> = {};
      setVotes(prev => (Object.keys(prev).length === 0 ? initialVotes : prev));
    }
    setIsLoading(false);
  };

  const handleSaveAdminEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poll) return;
    if (!editTitle.trim()) {
      alert(lang === 'nl' ? 'Titel is verplicht.' : 'Title is required.');
      return;
    }
    const updated: Poll = {
      ...poll,
      title: editTitle.trim(),
      description: editDescription.trim(),
      locationType: editLocationType,
      locationAddress: editLocationAddress.trim()
    };
    dbService.savePoll(updated);
    setPoll(updated);
    setIsAdminEditing(false);
  };

  useEffect(() => {
    loadPollData();

    const unsubscribeLocal = dbService.subscribe(() => {
      const updated = dbService.getPoll(pollId);
      if (updated) setPoll(updated);
    });

    const unsubscribePollCloud = dbService.subscribeToPoll(pollId, (updatedPoll) => {
      if (updatedPoll) {
        setPoll(updatedPoll);
        setIsLoading(false);
      }
    });
    
    // Subscribe to invitees in real-time for instant statistics / vote feedback
    const unsubscribeInvitees = dbService.subscribeToPollInvitees(pollId, (updatedList) => {
      setInvitees(updatedList);
    });

    return () => {
      unsubscribeLocal();
      unsubscribePollCloud();
      unsubscribeInvitees();
    };
  }, [pollId, isAdminEditing]);

  // When a guest is selected from dropdown
  useEffect(() => {
    if (selectedInviteeId && selectedInviteeId !== 'new') {
      const invitee = invitees.find(i => i.id === selectedInviteeId);
      if (invitee) {
        setVotes(invitee.votes || {});
        setComment(invitee.comment || '');
        setOptionComments(invitee.optionComments || {});
        setNewFirstName(invitee.firstName);
        setNewLastName(invitee.lastName);
        setNewEmail(invitee.email);
        setPrevSelectedId(selectedInviteeId);
      }
    } else {
      // It is 'new'
      if (prevSelectedId !== 'new') {
        setPrevSelectedId('new');
        setNewFirstName('');
        setNewLastName('');
        setNewEmail('');
        setComment('');
        setOptionComments({});
        if (poll) {
          setVotes({});
        }
      }
    }
  }, [selectedInviteeId, invitees, poll, prevSelectedId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md w-full text-center border border-slate-100 flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <h2 className="text-base font-bold text-slate-800">
            {lang === 'nl' ? 'Datumprikker laden...' : 'Loading poll...'}
          </h2>
          <p className="text-slate-400 mt-1 text-xs">
            {lang === 'nl' ? 'Een moment geduld alstublieft.' : 'Please wait a moment.'}
          </p>
        </div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md w-full text-center border border-slate-100">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800">
            {lang === 'nl' ? 'Datumprikker niet gevonden' : 'Poll not found'}
          </h2>
          <p className="text-slate-500 mt-2 text-sm">
            {lang === 'nl' 
              ? 'De opgevraagde datumprikker bestaat niet of is verwijderd.' 
              : 'The requested poll does not exist or has been removed.'}
          </p>
          <a
            href="/"
            className="mt-6 inline-block bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-6 py-2.5 text-sm font-medium transition-all"
          >
            {lang === 'nl' ? 'Naar de Manager' : 'Go to Organizer Dashboard'}
          </a>
        </div>
      </div>
    );
  }

  const handleVoteType = (optionId: string, value: VoteValue) => {
    setVotes(prev => ({
      ...prev,
      [optionId]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validate that every option in the poll has a chosen vote
    const missingOption = poll.options.find(opt => !votes[opt.id]);
    if (missingOption) {
      setErrorMsg(
        lang === 'nl'
          ? 'Geef voor alle voorgestelde momenten een reactie op (Ja, Nee, of Misschien).'
          : 'Please choose an option (Yes, No, or Maybe) for all proposed slots.'
      );
      return;
    }

    let activeInvitee: Invitee;

    if (selectedInviteeId === 'new') {
      if (!newFirstName.trim() || !newLastName.trim() || !newEmail.trim()) {
        setErrorMsg(lang === 'nl' ? 'Vul alsjeblieft al je gegevens in om te stemmen.' : 'Please fill in all your details to vote.');
        return;
      }
      if (!newEmail.includes('@')) {
        setErrorMsg(lang === 'nl' ? 'Vul een geldig e-mailadres in.' : 'Please enter a valid email address.');
        return;
      }

      // Check if this guest already exists in the invitee list for this poll
      const existingInv = invitees.find(i => i.id === selectedInviteeId || i.email.toLowerCase().trim() === newEmail.toLowerCase().trim());
      if (existingInv) {
        // Automatically switch over to this existing invitee safely
        activeInvitee = {
          ...existingInv,
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          votes,
          comment: comment.trim(),
          optionComments,
          votedAt: new Date().toISOString()
        };
      } else {
        // Create new invitee record
        activeInvitee = {
          id: 'i-' + Math.random().toString(36).substr(2, 9),
          pollId: poll.id,
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          email: newEmail.toLowerCase().trim(),
          votes,
          comment: comment.trim(),
          optionComments,
          votedAt: new Date().toISOString(),
          lastReminderAt: null,
          ownerId: poll.ownerId || undefined
        };
      }
    } else {
      // Find and update matched invitee
      const inv = invitees.find(i => i.id === selectedInviteeId);
      if (!inv) return;
      activeInvitee = {
        ...inv,
        votes,
        comment: comment.trim(),
        optionComments,
        votedAt: new Date().toISOString()
      };
    }

    // Save invitee
    dbService.saveInvitee(activeInvitee);

    // Add a Notification to the Organizer dashboard!
    const yesOptionsCount = Object.values(votes).filter(v => v === 'YES' || v === 'HEART').length;
    const notificationMessage = lang === 'nl'
      ? `${activeInvitee.firstName} ${activeInvitee.lastName} heeft gestemd op "${poll.title}" (${yesOptionsCount} ja-opties).`
      : `${activeInvitee.firstName} ${activeInvitee.lastName} cast votes on "${poll.title}" (${yesOptionsCount} yes preferences).`;

    dbService.addNotification({
      pollId: poll.id,
      pollTitle: poll.title,
      inviteeName: `${activeInvitee.firstName} ${activeInvitee.lastName}`,
      message: notificationMessage,
      type: 'vote_submitted',
    });

    if (comment.trim()) {
      dbService.addNotification({
        pollId: poll.id,
        pollTitle: poll.title,
        inviteeName: `${activeInvitee.firstName} ${activeInvitee.lastName}`,
        message: lang === 'nl' 
          ? `Opmerking toegevoegd: "${comment.trim()}"` 
          : `Added comment: "${comment.trim()}"`,
        type: 'comment_added'
      });
    }

    setIsSuccess(true);
    onVoteSubmitted();
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 md:px-8" id="votepage-root">
      <div className="max-w-2xl mx-auto">
        
        {/* Simple top brand banner */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-200">
              <div className="w-3.5 h-3.5 border-2 border-white rotate-45 rounded-sm"></div>
            </div>
            <span className="font-bold font-display text-slate-900 tracking-tight text-lg">datumprikker <span className="text-xs bg-indigo-50 text-indigo-750 px-1 py-0.5 rounded font-sans font-semibold">Pro</span></span>
          </div>
          <div className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
            {lang === 'nl' ? 'Uitnodiging' : 'Invitation'}
          </div>
        </div>

        {isSuccess ? (
          <div className="bg-white rounded-3xl p-8 shadow-md border border-slate-200/60 text-center" id="vote-success-panel">
            <div className="h-16 w-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2 font-display">
              {lang === 'nl' ? 'Bedankt voor je reactie!' : 'Thank you for responding!'}
            </h1>
            <p className="text-slate-500 text-xs max-w-sm mx-auto mb-8 font-sans">
              {lang === 'nl'
                ? 'De organisator is direct op de hoogte gesteld. Je kunt deze pagina sluiten.'
                : 'The organizer has been notified immediately. You can now close this tab.'}
            </p>

            <div className="space-y-3 max-w-xs mx-auto">
              <button
                onClick={() => setIsSuccess(false)}
                className="w-full py-2.5 bg-slate-55 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {lang === 'nl' ? 'Mijn stemmen wijzigen' : 'Modify my votes'}
              </button>
              <a
                href="/"
                className="block text-center py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100"
              >
                {lang === 'nl' ? 'Mijn eigen afspraak plannen' : 'Plan my own meeting'}
              </a>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-md border border-slate-200/60 overflow-hidden" id="voting-panel">
            
            {/* Header info / Inline Edit form */}
            {isAdminEditing ? (
              <form onSubmit={handleSaveAdminEdit} className="p-6 md:p-8 border-b border-slate-200/60 bg-slate-50/50 space-y-4" id="vote-admin-edit-form">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                    ✏️ {lang === 'nl' ? 'Afspraak Aanpassen' : 'Edit Appointment'}
                  </h3>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">ID: {poll.id}</span>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 block">
                    {lang === 'nl' ? 'Titel' : 'Title'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-205 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 block">
                    {lang === 'nl' ? 'Omschrijving' : 'Description'}
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-white border border-slate-205 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 block">
                      {lang === 'nl' ? 'Vorm / Locatietype' : 'Format / Location Type'}
                    </label>
                    <select
                      value={editLocationType}
                      onChange={(e) => setEditLocationType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-205 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">-- {lang === 'nl' ? 'Geen specifiek type' : 'Not specified'} --</option>
                      <option value="physical">🏢 {lang === 'nl' ? 'Fysiek op locatie' : 'Physical (On-site)'}</option>
                      <option value="digital">💻 {lang === 'nl' ? 'Digitaal (Videobellen/Online)' : 'Digital (Online meeting)'}</option>
                      <option value="hybrid">🌐 {lang === 'nl' ? 'Hybride' : 'Hybrid'}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 block">
                      {lang === 'nl' ? 'Locatie / Adres / Link' : 'Location / Address / Link'}
                    </label>
                    <input
                      type="text"
                      value={editLocationAddress}
                      onChange={(e) => setEditLocationAddress(e.target.value)}
                      placeholder={lang === 'nl' ? 'Bijv: Teams link of kantoor...' : 'E.g. Zoom link or office...'}
                      className="w-full px-3 py-2 bg-white border border-slate-205 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditTitle(poll.title || '');
                      setEditDescription(poll.description || '');
                      setEditLocationType(poll.locationType || '');
                      setEditLocationAddress(poll.locationAddress || '');
                      setIsAdminEditing(false);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all"
                  >
                    {lang === 'nl' ? 'Annuleren' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-100 transition-all"
                  >
                    {lang === 'nl' ? 'Opslaan' : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6 md:p-8 border-b border-slate-200/60 bg-slate-50/50">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold font-display text-slate-900 leading-tight break-words">{poll.title}</h1>
                    {poll.description && (
                      <p className="text-slate-650 text-xs mt-3 whitespace-pre-line leading-relaxed font-sans">{poll.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAdminEditing(true)}
                    className="shrink-0 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>✏️</span>
                    <span>{lang === 'nl' ? 'Aanpassen' : 'Edit'}</span>
                  </button>
                </div>

                {poll.locationType && (
                  <div className="mt-4 p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center gap-2.5 text-xs text-indigo-900 font-sans">
                    <span className="text-lg">
                      {poll.locationType === 'physical' && '🏢'}
                      {poll.locationType === 'digital' && '💻'}
                      {poll.locationType === 'hybrid' && '🌐'}
                    </span>
                    <div>
                      <span className="font-bold">
                        {poll.locationType === 'physical' && (lang === 'nl' ? 'Fysieke bijeenkomst' : 'In-person location')}
                        {poll.locationType === 'digital' && (lang === 'nl' ? 'Digitale bijeenkomst' : 'Digital online meeting')}
                        {poll.locationType === 'hybrid' && (lang === 'nl' ? 'Hybride bijeenkomst' : 'Hybrid format')}
                      </span>
                      {poll.locationAddress && (
                        <span className="opacity-90 block mt-0.5 font-medium">
                          📍 {poll.locationAddress}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
              
              {/* Step 1: Who are you? */}
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  1. {lang === 'nl' ? 'Wie ben je?' : 'Who are you?'}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select from existing if they were invited explicitly */}
                  {invitees.length > 0 && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                        {lang === 'nl' ? 'Selecteer je naam uit de gastenlijst' : 'Select your name from the guest list'}
                      </label>
                      <select
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans"
                        value={selectedInviteeId}
                        onChange={(e) => setSelectedInviteeId(e.target.value)}
                        id="voter-invitee-select"
                      >
                        <option value="new">
                          -- {lang === 'nl' ? 'Handmatig invullen / Niet in de lijst' : 'Register as new participant'} --
                        </option>
                        {invitees.map(i => (
                          <option key={i.id} value={i.id}>
                            {i.firstName} {i.lastName} ({i.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Manual inputs if register as new is selected */}
                  {selectedInviteeId === 'new' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t.firstName}</label>
                        <input
                          type="text"
                          required
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans"
                          value={newFirstName}
                          onChange={(e) => setNewFirstName(e.target.value)}
                          placeholder="Jan"
                          id="new-voter-firstname"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t.lastName}</label>
                        <input
                          type="text"
                          required
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans"
                          value={newLastName}
                          onChange={(e) => setNewLastName(e.target.value)}
                          placeholder="de Vries"
                          id="new-voter-lastname"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t.email}</label>
                        <input
                          type="email"
                          required
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans font-mono"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="jan@example.com"
                          id="new-voter-email"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Step 2: Date preferences */}
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  2. {lang === 'nl' ? 'Geef je beschikbaarheid op' : 'Indicate your availability'}
                </h2>

                <div className="space-y-3" id="voting-options-list">
                  {poll.options.map((opt, idx) => {
                    const optDate = new Date(opt.dateTime);
                    const longDate = optDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    });
                    const timeLabel = optDate.toLocaleTimeString(lang === 'nl' ? 'nl-NL' : 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    const currentVote = votes[opt.id];

                    return (
                      <div
                        key={opt.id}
                        className={`p-4 rounded-2xl border transition-all space-y-3 ${
                          currentVote === 'YES' 
                            ? 'bg-emerald-50/20 border-emerald-200 shadow-sm' : currentVote === 'HEART' ? 'bg-rose-50/30 border-rose-200/80 shadow-sm'
                            : currentVote === 'NO'
                              ? 'bg-rose-50/10 border-slate-200'
                              : currentVote === 'MAYBE'
                                ? 'bg-amber-50/10 border-amber-200'
                                : 'bg-white border-slate-200/80 shadow-xs hover:border-slate-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className={`h-10 w-10 rounded-xl flex flex-col items-center justify-center font-bold text-xs shrink-0 ${
                              currentVote === 'YES'
                                ? 'bg-emerald-100 text-emerald-700' : currentVote === 'HEART' ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : currentVote === 'NO'
                                  ? 'bg-slate-100 text-slate-500'
                                  : currentVote === 'MAYBE'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-100 text-slate-400 border border-slate-200/60'
                            }`}>
                              <span>{optDate.getDate()}</span>
                              <span className="uppercase text-[9px]">{optDate.toLocaleString(lang === 'nl' ? 'nl-NL' : 'en-US', { month: 'short' })}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-slate-800 text-sm capitalize">{longDate}</p>
                                {!currentVote && (
                                  <span className="bg-rose-50 text-rose-600 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border border-rose-100 animate-pulse">
                                    {lang === 'nl' ? 'Keuze vereist' : 'Choice required'}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 font-medium font-sans">
                                🕒 {timeLabel} ({opt.durationMin} min)
                              </p>
                            </div>
                          </div>

                          {/* Three state buttons (Ja, Nee, Misschien) */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleVoteType(opt.id, 'HEART')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all border cursor-pointer ${
                                currentVote === 'HEART'
                                  ? 'bg-rose-500 border-rose-500 text-white shadow-sm shadow-rose-500/20'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <Heart className={`h-3.5 w-3.5 ${currentVote === 'HEART' ? 'fill-current text-white' : 'text-rose-500'}`} />
                              {t.voteHeart}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleVoteType(opt.id, 'YES')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all border cursor-pointer ${
                                currentVote === 'YES'
                                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                              {t.voteYes}
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => handleVoteType(opt.id, 'MAYBE')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all border cursor-pointer ${
                                currentVote === 'MAYBE'
                                  ? 'bg-amber-500 border-amber-500 text-white shadow-sm shadow-amber-500/20'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <span className="text-xs font-bold font-mono">?</span>
                              {t.voteMaybe}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleVoteType(opt.id, 'NO')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all border cursor-pointer ${
                                currentVote === 'NO'
                                  ? 'bg-slate-600 border-slate-600 text-white shadow-sm'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <X className="h-3.5 w-3.5" />
                              {t.voteNo}
                            </button>
                          </div>
                        </div>

                        {/* Option custom comment */}
                        <div className="pt-2.5 border-t border-slate-200/50 flex flex-col sm:flex-row sm:items-center gap-2">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0 min-w-[120px]">
                            💬 {lang === 'nl' ? 'Toelichting bij deze optie:' : 'Comment for this option:'}
                          </label>
                          <input
                            type="text"
                            placeholder={lang === 'nl' ? 'Bijv: Kan eventueel iets later aansluiten, thuiswerken, etc.' : 'E.g., Can join slightly later, working from home...'}
                            className="w-full bg-white/70 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-705 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 font-sans"
                            value={optionComments[opt.id] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setOptionComments(prev => ({
                                ...prev,
                                [opt.id]: val
                              }));
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Statistics Section (Ja-Nee-Misschien) */}
              {invitees.length > 0 && (
                <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4" id="voter-realtime-stats">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5 font-sans">
                      📊 {lang === 'nl' ? 'Real-time Statistieken' : 'Real-time Statistics'} ({lang === 'nl' ? 'Wie stemde wat' : 'Who voted what'})
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                      {invitees.filter(i => i.votedAt).length} / {invitees.length} {lang === 'nl' ? 'gestemd' : 'voted'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {poll.options.map((opt) => {
                      const optDate = new Date(opt.dateTime);
                      const votedInvitees = invitees.filter(i => i.votedAt);
                      const votedCount = votedInvitees.length;
                      
                      // Calculate Yes / No / Maybe counts & voter names
                      let yes = 0, no = 0, maybe = 0, heart = 0;
                      const yesNames: string[] = []; const heartNames: string[] = [];
                      const maybeNames: string[] = [];
                      const noNames: string[] = [];

                      votedInvitees.forEach(inv => {
                        const v = inv.votes?.[opt.id];
                        const fullName = `${inv.firstName} ${inv.lastName}`.trim();
                        if (v === 'HEART') {
                          heart++;
                          heartNames.push(fullName);
                        } else if (v === 'YES') {
                          yes++;
                          yesNames.push(fullName);
                        } else if (v === 'MAYBE') {
                          maybe++;
                          maybeNames.push(fullName);
                        } else if (v === 'NO') {
                          no++;
                          noNames.push(fullName);
                        }
                      });

                      const heartPct = votedCount > 0 ? Math.round((heart / votedCount) * 100) : 0; const yesPct = votedCount > 0 ? Math.round((yes / votedCount) * 100) : 0;
                      const maybePct = votedCount > 0 ? Math.round((maybe / votedCount) * 100) : 0;
                      const noPct = votedCount > 0 ? Math.round((no / votedCount) * 100) : 0;

                      return (
                        <div key={opt.id} className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-bold text-xs text-slate-700 capitalize">
                              {optDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                              {` - ${optDate.toLocaleTimeString(lang === 'nl' ? 'nl-NL' : 'en-US', { hour: '2-digit', minute: '2-digit' })}`}
                            </span>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold font-mono">
                              <span className="text-rose-700 bg-rose-50 px-2 py-0.5 border border-rose-100 rounded-md flex items-center gap-1 shadow-2xs">❤️ {heart} {lang === 'nl' ? 'Voorkeur' : 'Pref'} ({heartPct}%)</span> <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-100 rounded-md flex items-center gap-1 shadow-2xs">
                                👍 {yes} {lang === 'nl' ? 'Ja' : 'Yes'} ({yesPct}%)
                              </span>
                              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 border border-amber-100 rounded-md flex items-center gap-1 shadow-2xs">
                                ❓ {maybe} {lang === 'nl' ? 'Misschien' : 'Maybe'} ({maybePct}%)
                              </span>
                              <span className="text-slate-600 bg-slate-50 px-2 py-0.5 border border-slate-200 rounded-md flex items-center gap-1 shadow-2xs">
                                👎 {no} {lang === 'nl' ? 'Nee' : 'No'} ({noPct}%)
                              </span>
                            </div>
                          </div>
                          
                          {/* Visual progress bar */}
                          <div className="w-full flex h-2 rounded-full overflow-hidden bg-slate-100/80 border border-slate-200/50">
                            <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${heartPct}%` }} title={`Voorkeur: ${heartPct}%`} /> <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${yesPct}%` }} title={`Ja: ${yesPct}%`} />
                            <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${maybePct}%` }} title={`Misschien: ${maybePct}%`} />
                            <div className="bg-slate-400 h-full transition-all duration-300" style={{ width: `${noPct}%` }} title={`Nee: ${noPct}%`} />
                          </div>

                          {/* Voter Names Breakdown */}
                          <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100/80 space-y-1 text-[11px]" id={`voters-names-vote-${opt.id}`}>
                            {heartNames.length > 0 && (<div className="flex items-start gap-1.5"><span className="text-rose-700 font-extrabold shrink-0">❤️ {lang === 'nl' ? 'Voorkeur' : 'Pref'} ({heartNames.length}):</span><span className="text-slate-600 font-medium">{heartNames.join(', ')}</span></div>)} {yesNames.length > 0 && (
                              <div className="flex items-start gap-1.5">
                                <span className="text-emerald-700 font-extrabold shrink-0">👍 {lang === 'nl' ? 'Ja' : 'Yes'} ({yesNames.length}):</span>
                                <span className="text-slate-600 font-medium">{yesNames.join(', ')}</span>
                              </div>
                            )}
                            {maybeNames.length > 0 && (
                              <div className="flex items-start gap-1.5">
                                <span className="text-amber-700 font-extrabold shrink-0">❓ {lang === 'nl' ? 'Misschien' : 'Maybe'} ({maybeNames.length}):</span>
                                <span className="text-slate-600 font-medium">{maybeNames.join(', ')}</span>
                              </div>
                            )}
                            {noNames.length > 0 && (
                              <div className="flex items-start gap-1.5">
                                <span className="text-slate-500 font-extrabold shrink-0">👎 {lang === 'nl' ? 'Nee' : 'No'} ({noNames.length}):</span>
                                <span className="text-slate-500 font-medium">{noNames.join(', ')}</span>
                              </div>
                            )}
                            {heartNames.length === 0 && yesNames.length === 0 && maybeNames.length === 0 && noNames.length === 0 && (
                              <div className="text-[10px] text-slate-400 italic text-center py-1">
                                {lang === 'nl' ? 'Nog geen stemmen uitgebracht.' : 'No votes cast yet.'}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Step 3: Comment */}
            <div className="space-y-2">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  3. {lang === 'nl' ? 'Plaats een opmerking (optioneel)' : 'Add a comment (optional)'}
                </h2>
                <textarea
                  className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none h-20 font-sans"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={lang === 'nl' ? 'Bijv: Ik kom wat later, of ik kan hapjes meenemen.' : 'E.g.: I might be late, or I can provide drinks.'}
                  id="vote-comment"
                />
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 text-rose-500 text-xs font-semibold p-3 bg-rose-50/50 rounded-xl border border-rose-100" id="vote-error">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit btn */}
              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-indigo-150 cursor-pointer flex items-center justify-center gap-2"
                id="vote-submit"
              >
                <Sparkles className="h-4 w-4 text-white animate-pulse" />
                {t.submitVote}
              </button>

            </form>
          </div>
        )}
      </div>
    </div>
  );
}
