import React, { useState, useEffect } from 'react';
import { Contact, Language } from '../types';
import { dbService } from '../services/db';
import { translations } from '../translations';
import { Plus, Search, Edit2, Trash2, ArrowUpDown, X, Check, Save } from 'lucide-react';

interface ContactsManagerProps {
  lang: Language;
  onContactsUpdated?: () => void;
}

type SortField = 'firstName' | 'lastName' | 'email' | 'organization';
type SortOrder = 'asc' | 'desc';

export default function ContactsManager({ lang, onContactsUpdated }: ContactsManagerProps) {
  const t = translations[lang];
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('lastName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Form State for Create/Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formOrganization, setFormOrganization] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Loaded contacts
  const loadContacts = () => {
    const list = dbService.getContacts();
    setContacts(list);
    if (onContactsUpdated) onContactsUpdated();
  };

  useEffect(() => {
    const unsubscribe = dbService.subscribe(() => {
      loadContacts();
    });
    return unsubscribe;
  }, []);

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFirstName.trim() || !formLastName.trim() || !formEmail.trim()) {
      setErrorMsg(lang === 'nl' ? 'Alle velden zijn verplicht.' : 'All fields are required.');
      return;
    }
    if (!formEmail.includes('@')) {
      setErrorMsg(lang === 'nl' ? 'Ongeldig e-mailadres' : 'Invalid email address');
      return;
    }

    const contactData: Contact = {
      id: editingId || 'c-' + Math.random().toString(36).substr(2, 9),
      firstName: formFirstName.trim(),
      lastName: formLastName.trim(),
      email: formEmail.toLowerCase().trim(),
      organization: formOrganization.trim()
    };

    dbService.saveContact(contactData);
    setFormFirstName('');
    setFormLastName('');
    setFormEmail('');
    setFormOrganization('');
    setEditingId(null);
    setErrorMsg('');
    loadContacts();
  };

  const handleEditInit = (contact: Contact) => {
    setEditingId(contact.id);
    setFormFirstName(contact.firstName);
    setFormLastName(contact.lastName);
    setFormEmail(contact.email);
    setFormOrganization(contact.organization || '');
    setErrorMsg('');
  };

  const handleDelete = (id: string) => {
    if (confirm(lang === 'nl' ? 'Weet je zeker dat je dit contact wilt verwijderen?' : 'Are you sure you want to delete this contact?')) {
      dbService.deleteContact(id);
      loadContacts();
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter & Sort implementation
  const filteredSortedContacts = contacts
    .filter(c => {
      const query = searchQuery.toLowerCase();
      return (
        c.firstName.toLowerCase().includes(query) ||
        c.lastName.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        (c.organization || '').toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let valA = (a[sortField] || '').toLowerCase();
      let valB = (b[sortField] || '').toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6" id="contacts-manager">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
            <span className="text-xl">👤</span> {t.contacts}
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            {lang === 'nl' 
              ? 'Beheer eerdere genodigden, zoek, filter en wijzig contactgegevens.' 
              : 'Manage previous invitees, search, filter and update contact details.'}
          </p>
        </div>
        
        {/* Search Input bar */}
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={`${t.search}...`}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="contact-search"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Standard / Modify Form Panel */}
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 h-fit" id="contact-form-panel">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            {editingId ? <Edit2 className="h-4 w-4 text-indigo-600" /> : <Plus className="h-4 w-4 text-indigo-600" />}
            {editingId 
              ? (lang === 'nl' ? 'Contact Bewerken' : 'Edit Contact') 
              : t.addContact}
          </h3>

          <form onSubmit={handleSaveContact} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t.firstName}</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                value={formFirstName}
                onChange={(e) => setFormFirstName(e.target.value)}
                id="contact-form-firstname"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t.lastName}</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                value={formLastName}
                onChange={(e) => setFormLastName(e.target.value)}
                id="contact-form-lastname"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t.email}</label>
              <input
                type="email"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans font-mono"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                id="contact-form-email"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{lang === 'nl' ? 'Organisatie' : 'Organization'}</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans font-mono"
                value={formOrganization}
                onChange={(e) => setFormOrganization(e.target.value)}
                id="contact-form-organization"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-500 font-semibold" id="contact-form-error">{errorMsg}</p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-1.8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5 cursor-pointer"
                id="contact-form-submit"
              >
                <Save className="h-3.5 w-3.5" />
                {editingId ? t.save : t.saveContact}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setFormFirstName('');
                    setFormLastName('');
                    setFormEmail('');
                    setFormOrganization('');
                    setErrorMsg('');
                  }}
                  className="py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-all cursor-pointer"
                  id="contact-form-cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Contacts list Panel */}
        <div className="lg:col-span-2 space-y-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse" id="contacts-table">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-medium text-xs">
                  <th className="py-2 px-3 cursor-pointer select-none hover:text-slate-600 transition-colors" onClick={() => handleSort('firstName')}>
                    <div className="flex items-center gap-1">
                      {t.firstName} <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-2 px-3 cursor-pointer select-none hover:text-slate-600 transition-colors" onClick={() => handleSort('lastName')}>
                    <div className="flex items-center gap-1">
                      {t.lastName} <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-2 px-3 cursor-pointer select-none hover:text-slate-600 transition-colors" onClick={() => handleSort('email')}>
                    <div className="flex items-center gap-1">
                      {t.email} <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-2 px-3 cursor-pointer select-none hover:text-slate-600 transition-colors" onClick={() => handleSort('organization')}>
                    <div className="flex items-center gap-1">
                      {lang === 'nl' ? 'Organisatie' : 'Organization'} <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-2 px-3 text-right">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSortedContacts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 bg-slate-50/50 rounded-xl">
                      {t.noContactsYet}
                    </td>
                  </tr>
                ) : (
                  filteredSortedContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${
                        editingId === contact.id ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-semibold text-slate-800">{contact.firstName}</td>
                      <td className="py-3 px-3 text-slate-800">{contact.lastName}</td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-xs">{contact.email}</td>
                      <td className="py-3 px-3 text-slate-600">{contact.organization || '-'}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEditInit(contact)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                            title={t.edit}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(contact.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-55 rounded-lg transition-all cursor-pointer"
                            title={t.delete}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="text-xs text-slate-400 pt-2 flex items-center justify-between">
            <div>
              Total: {contacts.length} {lang === 'nl' ? 'contacten' : 'contacts'}
            </div>
            {searchQuery && (
              <div className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                {filteredSortedContacts.length} {lang === 'nl' ? 'gevonden' : 'found'}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
