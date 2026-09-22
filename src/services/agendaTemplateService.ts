import { AgendaTemplate } from '../types';
import { DEFAULT_AGENDA_TEMPLATES } from '../data/defaultAgendaTemplates';

const LOCAL_STORAGE_KEY = 'itpt_custom_agenda_templates';

export const agendaTemplateService = {
  /**
   * Retrieves all available agenda templates (defaults + user customized/created)
   */
  getTemplates(): AgendaTemplate[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!stored) {
        return [...DEFAULT_AGENDA_TEMPLATES];
      }
      const parsed: AgendaTemplate[] = JSON.parse(stored);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return [...DEFAULT_AGENDA_TEMPLATES];
      }
      return parsed;
    } catch (e) {
      console.warn('Failed to load custom agenda templates from storage, using defaults:', e);
      return [...DEFAULT_AGENDA_TEMPLATES];
    }
  },

  /**
   * Save or update a template
   */
  saveTemplate(template: AgendaTemplate): AgendaTemplate[] {
    const current = this.getTemplates();
    const existingIndex = current.findIndex(t => t.id === template.id);

    const updatedTemplate: AgendaTemplate = {
      ...template,
      updatedAt: new Date().toISOString(),
      createdAt: template.createdAt || new Date().toISOString()
    };

    let nextList: AgendaTemplate[];
    if (existingIndex >= 0) {
      nextList = [...current];
      nextList[existingIndex] = updatedTemplate;
    } else {
      nextList = [updatedTemplate, ...current];
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextList));
    } catch (e) {
      console.error('Failed to save agenda template:', e);
    }
    return nextList;
  },

  /**
   * Delete a template by ID. If it is a default template, it removes it or marks it hidden.
   */
  deleteTemplate(id: string): AgendaTemplate[] {
    const current = this.getTemplates();
    const nextList = current.filter(t => t.id !== id);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextList));
    } catch (e) {
      console.error('Failed to delete agenda template:', e);
    }
    return nextList;
  },

  /**
   * Reset all templates back to the system defaults
   */
  resetToDefaults(): AgendaTemplate[] {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to reset agenda templates:', e);
    }
    return [...DEFAULT_AGENDA_TEMPLATES];
  }
};
