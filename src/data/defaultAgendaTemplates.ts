import { AgendaTemplate } from '../types';

export const DEFAULT_AGENDA_TEMPLATES: AgendaTemplate[] = [
  {
    id: 'stuurgroep',
    nameNl: 'Stuurgroep / Directie (Strategie, Knelpunten & Besluiten)',
    nameEn: 'Steering Committee (Strategy, Issues & Decisions)',
    icon: '🏛️',
    category: 'stuurgroep',
    descriptionNl: 'Ideaal voor formele stuurgroepvergaderingen met statusoverzicht, project aandachtspunten, risico\'s en formele besluitvorming.',
    descriptionEn: 'Formal steering committee template with status, project risks, milestones and decision points.',
    html: `<h2>🏛️ Stuurgroep Agenda &amp; Besluitvorming</h2>
<p><em>Doel: Mijlpalen monitoren, risico's bespreken en formele besluiten nemen.</em></p>
<hr/>

<h3>1. Opening &amp; Goedkeuring Agenda <span style="background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px;">5 min</span></h3>
<ul>
  <li>Welkom door de voorzitter</li>
  <li>Vaststellen definitieve agenda &amp; inventarisatie ingekomen stukken</li>
</ul>

<h3>2. Goedkeuring Notulen &amp; Actielijst Vorig Overleg <span style="background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px;">10 min</span></h3>
<ul>
  <li>Formele vaststelling notulen vorig overleg</li>
  <li>Status van openstaande actiepunten stuurgroep</li>
</ul>

<h3>3. Stand van Zaken &amp; Projectstatus <span style="background-color:#dcfce7; color:#166534; padding:2px 8px; border-radius:12px; font-size:12px;">20 min</span></h3>
<ul>
  <li>Mijlpalendashboard (Groen / Geel / Rood) per project/verkenning</li>
  <li>Belangrijkste behaalde resultaten afgelopen periode</li>
  <li>Planning en deliverables komende periode</li>
</ul>

<h3>4. Project Aandachtspunten, Risico's &amp; Escalaties <span style="background-color:#fef3c7; color:#92400e; padding:2px 8px; border-radius:12px; font-size:12px;">20 min</span></h3>
<ul>
  <li>Top 3 operationele en strategische risico's &amp; beheersmaatregelen</li>
  <li>Kritieke afhankelijkheden met externe leveranciers of stakeholders</li>
  <li>Eventuele escalaties vanuit de projectgroepen</li>
</ul>

<h3>5. Financiën &amp; Budgetbewaking <span style="background-color:#f1f5f9; color:#475569; padding:2px 8px; border-radius:12px; font-size:12px;">10 min</span></h3>
<ul>
  <li>Realisatie tot nu toe vs. toegekend budget</li>
  <li>Prognose tot einde boekjaar / projectfase</li>
</ul>

<h3>6. Gevraagde Besluiten (Go / No-Go &amp; Vrijgaven) <span style="background-color:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:bold;">20 min</span></h3>
<ul>
  <li><strong>Besluitpunt A:</strong> Goedkeuring faseovergang / start vervolgactiviteiten</li>
  <li><strong>Besluitpunt B:</strong> Vrijgave aanvullend budget of inzet externe expertise</li>
  <li><strong>Besluitpunt C:</strong> Goedkeuring architectuurkeuze / beleidsdocument</li>
</ul>

<h3>7. Rondvraag &amp; W.v.t.t.k. <span style="background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px;">10 min</span></h3>
<ul>
  <li>Wat verder ter tafel komt</li>
  <li>Korte mededelingen vanuit stuurgroepleden</li>
</ul>

<h3>8. Samenvatting Genomen Besluiten &amp; Sluiting <span style="background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px;">5 min</span></h3>
<p>Volgende stuurgroepbijeenkomst gepland op: <em>...</em></p>`
  },
  {
    id: 'kenniskring',
    nameNl: 'Kenniskring (Thema\'s, Best Practices & Rondje langs de Velden)',
    nameEn: 'Knowledge Circle (Themes, Best Practices & Field Round)',
    icon: '💡',
    category: 'kenniskring',
    descriptionNl: 'Voor regionale kenniskringen en vakgroepen met kennisdeling, gastpresentaties, praktijkvoorbeelden en het rondje langs de velden.',
    descriptionEn: 'Knowledge sharing session with presentations, best practice demonstrations, and round table updates.',
    html: `<h2>💡 Kenniskring Agenda &amp; Kennisdeling</h2>
<p><em>Doel: Ervaringen uitwisselen, regionale expertise bundelen en samen innoveren.</em></p>
<hr/>

<h3>1. Opening &amp; Welkom <span style="background-color:#fef3c7; color:#92400e; padding:2px 8px; border-radius:12px; font-size:12px;">5 min</span></h3>
<ul>
  <li>Welkom door de moderator / kenniskringleider</li>
  <li>Doelen en thema van deze bijeenkomst</li>
</ul>

<h3>2. Mededelingen &amp; Regionale Ontwikkelingen <span style="background-color:#fef3c7; color:#92400e; padding:2px 8px; border-radius:12px; font-size:12px;">10 min</span></h3>
<ul>
  <li>Korte updates vanuit IT Platform Twente en deelnemende organisaties</li>
  <li>Landelijke en sectorale trends / nieuwe wet- en regelgeving</li>
</ul>

<h3>3. Hoofdthema: Inhoudelijke Verdieping / Presentatie <span style="background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:bold;">30 min</span></h3>
<ul>
  <li>Presentatie door spreker / expertteam over het centrale thema</li>
  <li>Vragenronde en toelichting op de kernconcepten</li>
</ul>

<h3>4. Praktijkcasus / Best Practice Demonstratie <span style="background-color:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:12px; font-size:12px;">20 min</span></h3>
<ul>
  <li>Live demo of toelichting op een concrete praktijkimplementatie</li>
  <li>Valkuilen, geleerde lessen en behaalde meerwaarde</li>
</ul>

<h3>5. Rondje langs de Velden <span style="background-color:#ecfdf5; color:#065f46; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:bold;">35 min</span></h3>
<ul>
  <li>Korte update per deelnemende organisatie: waar staat men momenteel?</li>
  <li>Welke knelpunten of uitdagingen spelen er en waar is hulp gewenst?</li>
  <li>Kansen voor gezamenlijke inkoop, standaardisatie of pilots</li>
</ul>

<h3>6. Vervolgafspraken &amp; Volgende Bijeenkomst <span style="background-color:#fef3c7; color:#92400e; padding:2px 8px; border-radius:12px; font-size:12px;">15 min</span></h3>
<ul>
  <li>Vastleggen van actiepunten en opvolging</li>
  <li>Thema en gastlocatie voor de volgende kenniskring</li>
  <li>Afsluiting en informeel napraten</li>
</ul>`
  },
  {
    id: 'projectgroep',
    nameNl: 'Projectgroep / Expertteam (Thema\'s, Knelpunten & Acties)',
    nameEn: 'Project Team / Expert Team (Themes, Issues & Actions)',
    icon: '👥',
    category: 'projectteam',
    descriptionNl: 'Voor operationele en tactische projectteams met focus op werkpakketten, inhoudelijke thema\'s, knelpunten en concrete acties.',
    descriptionEn: 'Action-oriented project team meeting reviewing deliverables, sprint items, blockers, and agreements.',
    html: `<h2>👥 Projectgroep / Expertteam Overleg</h2>
<p><em>Doel: Voortgang werkpakketten borgen, inhoudelijke keuzes maken en acties afstemmen.</em></p>
<hr/>

<h3>1. Opening &amp; Agenda Vaststellen <span style="background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px;">5 min</span></h3>
<ul>
  <li>Check-in en korte inventarisatie dringende agendapunten</li>
</ul>

<h3>2. Voortgang Werkpakketten &amp; Thema\'s <span style="background-color:#dcfce7; color:#166534; padding:2px 8px; border-radius:12px; font-size:12px;">25 min</span></h3>
<ul>
  <li><strong>Thema / Werkpakket 1:</strong> Voortgang, status en oplevering</li>
  <li><strong>Thema / Werkpakket 2:</strong> Voortgang, status en oplevering</li>
  <li><strong>Thema / Werkpakket 3:</strong> Voortgang, status en oplevering</li>
</ul>

<h3>3. Inhoudelijke Afstemming &amp; Uitwerking <span style="background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px;">20 min</span></h3>
<ul>
  <li>Gezamenlijke behandeling van inhoudelijk voorstel of technisch ontwerp</li>
  <li>Afstemming van standaarden en koppelvlakken</li>
</ul>

<h3>4. Knelpunten &amp; Te Nemen Beslissingen <span style="background-color:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:bold;">15 min</span></h3>
<ul>
  <li>Blockers die de voortgang vertragen</li>
  <li>Besluiten die binnen het team genomen kunnen worden</li>
  <li>Eventuele punten ter escalatie naar de stuurgroep</li>
</ul>

<h3>5. Acties &amp; Afspraken Review <span style="background-color:#f1f5f9; color:#475569; padding:2px 8px; border-radius:12px; font-size:12px;">15 min</span></h3>
<ul>
  <li>Status openstaande actiepunten vorig overleg</li>
  <li>Nieuwe acties vastleggen: wie, wat, wanneer</li>
</ul>

<h3>6. Sluiting &amp; Volgende Werksessie <span style="background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px;">5 min</span></h3>
<p>Volgende projectteam overleg op: <em>...</em></p>`
  },
  {
    id: 'bila',
    nameNl: 'Bila (1-op-1 Bilateraal Overleg)',
    nameEn: '1-on-1 Meeting (Bi-weekly / Monthly)',
    icon: '🤝',
    category: 'bila',
    descriptionNl: 'Persoonlijke afstemming tussen leidinggevende en medewerker of twee projectpartners met focus op taken, knelpunten en ontwikkeling.',
    descriptionEn: 'Dedicated 1-on-1 check-in focusing on well-being, workload, priorities, blockers, and development.',
    html: `<h2>🤝 Bila Afstemming &amp; Prioriteiten</h2>
<p><em>Doel: Open afstemming over prioriteiten, samenwerking, welzijn en opvolging.</em></p>
<hr/>

<h3>1. Check-in &amp; Welbevinden <span style="background-color:#ecfdf5; color:#065f46; padding:2px 8px; border-radius:12px; font-size:12px;">10 min</span></h3>
<ul>
  <li>Hoe staat het met energie en werkdruk?</li>
  <li>Algemene reflectie op afgelopen weken</li>
</ul>

<h3>2. Voortgang Lopende Prioriteiten &amp; Taken <span style="background-color:#ecfdf5; color:#065f46; padding:2px 8px; border-radius:12px; font-size:12px;">15 min</span></h3>
<ul>
  <li>Wat is er afgerond en waar liggen de successen?</li>
  <li>Status van de belangrijkste projecten en deadlines</li>
</ul>

<h3>3. Knelpunten, Hulpvragen &amp; Escalatie <span style="background-color:#fffbeb; color:#92400e; padding:2px 8px; border-radius:12px; font-size:12px;">15 min</span></h3>
<ul>
  <li>Waar loop je inhoudelijk of organisatorisch tegenaan?</li>
  <li>Wat is er nodig vanuit het team of management om door te kunnen?</li>
</ul>

<h3>4. Ontwikkeling &amp; Samenwerking <span style="background-color:#eff6ff; color:#1d4ed8; padding:2px 8px; border-radius:12px; font-size:12px;">10 min</span></h3>
<ul>
  <li>Kansen voor opleiding, verdieping of nieuwe rollen</li>
  <li>Onderlinge feedback en procesverbetering</li>
</ul>

<h3>5. Concrete Afspraken &amp; Actielijst <span style="background-color:#ecfdf5; color:#065f46; padding:2px 8px; border-radius:12px; font-size:12px;">10 min</span></h3>
<ul>
  <li>Actiepunten en focus voor de komende sprint / maand</li>
</ul>`
  },
  {
    id: 'brainstorm',
    nameNl: 'Brainstorm & Innovatiesessie',
    nameEn: 'Brainstorm & Innovation Workshop',
    icon: '🚀',
    category: 'brainstorm',
    descriptionNl: 'Gestructureerde creatieve sessie voor probleemverkenning, ideeëngeneratie, clustering en prioritering.',
    descriptionEn: 'Structured creative ideation session with problem definition, divergence, clustering, and action items.',
    html: `<h2>🚀 Brainstorm &amp; Innovatiesessie</h2>
<p><em>Doel: Nieuwe oplossingsrichtingen verkennen, divergeren en concrete initiatieven prioriteren.</em></p>
<hr/>

<h3>1. Welkom, Doel &amp; Spelregels <span style="background-color:#fef3c7; color:#92400e; padding:2px 8px; border-radius:12px; font-size:12px;">10 min</span></h3>
<ul>
  <li>Spelregels: oordeel uitstellen, kwantiteit boven kwaliteit, bouw voort op ideeën van anderen</li>
</ul>

<h3>2. Context &amp; Centrale Uitdaging <span style="background-color:#fef3c7; color:#92400e; padding:2px 8px; border-radius:12px; font-size:12px;">15 min</span></h3>
<ul>
  <li>Toelichting op het probleem: "Hoe kunnen we..."</li>
  <li>Kaders, doelgroep en randvoorwaarden</li>
</ul>

<h3>3. Ideation: Plenaire Brainstormronde <span style="background-color:#fef3c7; color:#92400e; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:bold;">30 min</span></h3>
<ul>
  <li>Stille individuele brainstorm (post-its / digitaal bord)</li>
  <li>Ronde van inspiratie en ideeën presenteren</li>
</ul>

<h3>4. Clustering &amp; Thematisering <span style="background-color:#fef3c7; color:#92400e; padding:2px 8px; border-radius:12px; font-size:12px;">20 min</span></h3>
<ul>
  <li>Samenvoegen van overeenkomstige concepten in hoofdthema's</li>
</ul>

<h3>5. Dot-voting &amp; Prioritering (Impact vs. Haalbaarheid) <span style="background-color:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:12px; font-size:12px;">15 min</span></h3>
<ul>
  <li>Stemmen op de meest kansrijke ideeën en quick wins</li>
</ul>

<h3>6. Eigenaarschap &amp; Volgende Stappen <span style="background-color:#dcfce7; color:#166534; padding:2px 8px; border-radius:12px; font-size:12px;">15 min</span></h3>
<ul>
  <li>Koppelen van trekkers per initiatief</li>
  <li>Eerste experiment of validatiestap definiëren</li>
</ul>`
  },
  {
    id: 'kickoff',
    nameNl: 'Kick-off Nieuw Project of Verkenning',
    nameEn: 'Kick-off Meeting (New Project / Exploration)',
    icon: '🎯',
    category: 'kickoff',
    descriptionNl: 'Gezamenlijke start van een project of verkenning met context, doelen, scope, governance en teamleden.',
    descriptionEn: 'Project kick-off covering vision, scope, deliverables, RACI roles, and initial sprint activities.',
    html: `<h2>🎯 Kick-off Nieuw Project / Verkenning</h2>
<p><em>Doel: Neuzen dezelfde kant op, scope verhelderen en heldere afspraken over samenwerking maken.</em></p>
<hr/>

<h3>1. Welkom &amp; Voorstelronde <span style="background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px;">10 min</span></h3>
<ul>
  <li>Kennismaking teamleden, rollen en verwachtingen</li>
</ul>

<h3>2. Aanleiding &amp; Projectdoelstellingen <span style="background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px;">20 min</span></h3>
<ul>
  <li>Waarom doen we dit project? Welk regionaal/organisatorisch probleem lossen we op?</li>
  <li>Gewenst eindresultaat en succesfactoren</li>
</ul>

<h3>3. Scope &amp; Deliverables <span style="background-color:#f1f5f9; color:#475569; padding:2px 8px; border-radius:12px; font-size:12px;">20 min</span></h3>
<ul>
  <li>Wat valt wél binnen de scope (In Scope)</li>
  <li>Wat valt expliciet búiten de scope (Out of Scope)</li>
</ul>

<h3>4. Fasering, Planning &amp; Mijlpalen <span style="background-color:#dcfce7; color:#166534; padding:2px 8px; border-radius:12px; font-size:12px;">20 min</span></h3>
<ul>
  <li>Overzicht van de belangrijkste fasen en deadlines</li>
  <li>Eerste mijlpaal en tussentijdse reviews</li>
</ul>

<h3>5. Rollen, Governance &amp; Communicatie <span style="background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px;">15 min</span></h3>
<ul>
  <li>Projectleider, expertteamleden, opdrachtgever en stuurgroep</li>
  <li>Overlegfrequentie en samenwerkingsomgeving</li>
</ul>

<h3>6. Eerste Acties &amp; Vervolgbijeenkomst <span style="background-color:#fef3c7; color:#92400e; padding:2px 8px; border-radius:12px; font-size:12px;">10 min</span></h3>
<ul>
  <li>Wat moet er deze en volgende week gebeuren?</li>
</ul>`
  },
  {
    id: 'retrospective',
    nameNl: 'Periodieke Evaluatie & Retrospective',
    nameEn: 'Retrospective & Review Meeting',
    icon: '🔄',
    category: 'retro',
    descriptionNl: 'Terugblik op de afgelopen sprint of projectfase: wat ging goed, wat kan beter en welke procesverbeteringen voeren we door.',
    descriptionEn: 'Team reflection on successes, bottlenecks, lessons learned, and continuous improvements.',
    html: `<h2>🔄 Periodieke Evaluatie &amp; Retrospective</h2>
<p><em>Doel: Continu leren en verbeteren als projectteam en expertgroep.</em></p>
<hr/>

<h3>1. Introductie &amp; Veilige Setting <span style="background-color:#ecfdf5; color:#065f46; padding:2px 8px; border-radius:12px; font-size:12px;">5 min</span></h3>
<p>Alles wat besproken wordt dient om het proces en de samenwerking te versterken.</p>

<h3>2. Terugblik op Feiten &amp; Mijlpalen <span style="background-color:#eff6ff; color:#1d4ed8; padding:2px 8px; border-radius:12px; font-size:12px;">10 min</span></h3>
<ul>
  <li>Welke doelen hadden we gesteld en wat is er daadwerkelijk opgeleverd?</li>
</ul>

<h3>3. Wat ging goed? (Topmomenten &amp; Successen) <span style="background-color:#dcfce7; color:#166534; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:bold;">15 min</span></h3>
<ul>
  <li>Welke aanpak werkte uitstekend?</li>
  <li>Wat willen we vasthouden en standaardiseren?</li>
</ul>

<h3>4. Wat kan beter? (Knelpunten &amp; Valkuilen) <span style="background-color:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:bold;">15 min</span></h3>
<ul>
  <li>Waar verloren we onnodig tijd of energie aan?</li>
  <li>Welke belemmeringen kwamen we tegen in de communicatie of techniek?</li>
</ul>

<h3>5. Concrete Verbeteracties Bepalen <span style="background-color:#fef3c7; color:#92400e; padding:2px 8px; border-radius:12px; font-size:12px;">20 min</span></h3>
<ul>
  <li>Kies maximaal 3 concrete actiepunten voor de volgende periode</li>
  <li>Wijs per verbeterpunt een eigenaar toe</li>
</ul>`
  },
  {
    id: 'standaard',
    nameNl: 'Standaard Periodiek Overleg (Kort & Bondig)',
    nameEn: 'Standard Meeting (Short & Concise)',
    icon: '📋',
    category: 'algemeen',
    descriptionNl: 'Efficiënte agenda van 45 tot 60 minuten voor algemene werkgroepen en periodieke overleggen.',
    descriptionEn: 'Concise standard agenda covering progress, discussions, and actions.',
    html: `<h2>📋 Overleg Agenda</h2>
<p><em>Doel: Voortgang bespreken, knelpunten oplossen en acties uitzetten.</em></p>
<hr/>

<h3>1. Opening &amp; Vaststellen Agenda <span style="background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px;">5 min</span></h3>
<ul>
  <li>Welkom door de voorzitter</li>
  <li>Eventuele toevoegingen of wijzigingen aan de agenda</li>
</ul>

<h3>2. Mededelingen &amp; Stand van Zaken <span style="background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px;">10 min</span></h3>
<ul>
  <li>Korte update vanuit de organisatie en werkgroepen</li>
</ul>

<h3>3. Voortgang Lopende Projecten &amp; Actielijst <span style="background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px;">15 min</span></h3>
<ul>
  <li>Review status actiepunten vorig overleg</li>
</ul>

<h3>4. Inhoudelijke Bespreekpunten <span style="background-color:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:12px; font-size:12px;">20 min</span></h3>
<ul>
  <li>Hoofdonderwerp / Toelichting voorstel en inventarisatie standpunten</li>
</ul>

<h3>5. Rondvraag &amp; Nieuwe Actiepunten <span style="background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px;">10 min</span></h3>
<ul>
  <li>Korte vragenronde en toewijzing actiehouders</li>
</ul>

<h3>6. Sluiting &amp; Volgende Bijeenkomst <span style="background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px;">5 min</span></h3>
<p>Volgend overleg gepland op: <em>...</em></p>`
  }
];
