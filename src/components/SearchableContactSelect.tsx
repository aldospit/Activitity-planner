import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, User, X } from 'lucide-react';
import { Contact } from '../types';

interface SearchableContactSelectProps {
  contacts: Contact[];
  selectedContactId?: string;
  onSelect: (contact: Contact | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  className?: string;
  label?: string;
}

export const SearchableContactSelect: React.FC<SearchableContactSelectProps> = ({
  contacts,
  selectedContactId,
  onSelect,
  placeholder = 'Kies een contactpersoon...',
  allowClear = false,
  className = '',
  label
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Alphabetically sorted contacts
  const sortedContacts = React.useMemo(() => {
    return [...contacts].sort((a, b) => {
      const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
      const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB, 'nl');
    });
  }, [contacts]);

  // Filtered contacts based on search query
  const filteredContacts = React.useMemo(() => {
    if (!query.trim()) return sortedContacts;
    const q = query.toLowerCase().trim();
    return sortedContacts.filter(c => {
      const full = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
      const email = (c.email || '').toLowerCase();
      const org = (c.organization || '').toLowerCase();
      return full.includes(q) || email.includes(q) || org.includes(q);
    });
  }, [sortedContacts, query]);

  const selectedContact = React.useMemo(() => {
    if (!selectedContactId) return null;
    return contacts.find(c => c.id === selectedContactId) || null;
  }, [contacts, selectedContactId]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleSelectContact = (contact: Contact) => {
    onSelect(contact);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setQuery('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <div
        onClick={handleOpen}
        className="w-full min-h-[38px] px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs flex items-center justify-between gap-2 cursor-pointer hover:border-slate-300 transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <User className="h-4 w-4 text-slate-400 shrink-0" />
          {selectedContact ? (
            <span className="font-bold text-slate-800 truncate">
              {selectedContact.firstName} {selectedContact.lastName}
              {selectedContact.email && (
                <span className="text-slate-400 font-normal ml-1">({selectedContact.email})</span>
              )}
            </span>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {allowClear && selectedContact && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition"
              title="Wissen"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Search Box */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Zoek op naam, e-mail of organisatie..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* List of Contacts */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
            {filteredContacts.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Geen contactpersonen gevonden
              </div>
            ) : (
              filteredContacts.map(contact => {
                const isSelected = selectedContactId === contact.id;
                return (
                  <div
                    key={contact.id}
                    onClick={() => handleSelectContact(contact)}
                    className={`p-2.5 px-3 flex items-center justify-between gap-2 hover:bg-indigo-50/60 cursor-pointer text-xs transition-colors ${
                      isSelected ? 'bg-indigo-50/80 font-bold text-indigo-900' : 'text-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{contact.firstName} {contact.lastName}</span>
                        {contact.organization && (
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-normal truncate">
                            {contact.organization}
                          </span>
                        )}
                      </div>
                      {contact.email && (
                        <div className="text-[11px] text-slate-400 font-normal truncate mt-0.5">
                          {contact.email}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-indigo-600 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
