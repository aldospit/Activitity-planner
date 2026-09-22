import { Invitee, PollOption } from '../types';

export function exportInviteesToCsv(pollTitle: string, invitees: Invitee[], options: PollOption[]): void {
  try {
    // Generate headers
    const optionHeaders = options.map((opt, i) => {
      const dateLabel = new Date(opt.dateTime).toLocaleString('nl-NL', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
      return `Voorstel ${i + 1} (${dateLabel})`;
    });

    const headers = ['Voornaam', 'Achternaam', 'E-mailadres', 'Status', 'Opmerking', 'Gestemd op', ...optionHeaders];

    const rows = invitees.map(invitee => {
      const status = invitee.votedAt ? 'Gestemd' : 'Niet gestemd';
      const votedAtLabel = invitee.votedAt ? new Date(invitee.votedAt).toLocaleDateString('nl-NL') : '-';
      const commentSanitized = invitee.comment.replace(/"/g, '""');

      const optionVotes = options.map(opt => {
        const val = invitee.votes[opt.id];
        if (val === 'YES') return 'Ja';
        if (val === 'NO') return 'Nee';
        if (val === 'MAYBE') return 'Misschien';
        if (val === 'HEART') return 'Voorkeur';
        return 'Niet gestemd';
      });

      return [
        `"${invitee.firstName}"`,
        `"${invitee.lastName}"`,
        `"${invitee.email}"`,
        `"${status}"`,
        `"${commentSanitized}"`,
        `"${votedAtLabel}"`,
        ...optionVotes.map(v => `"${v}"`)
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `gastenlijst_${pollTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating CSV export', error);
  }
}
