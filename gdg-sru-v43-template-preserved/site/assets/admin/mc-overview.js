/* Mission Control → Overview. Everything on this screen is computed live and every row links to the place that fixes it. */
(() => {
  'use strict';
  const { esc, when, until, ago, icon, go, pipeline, eventFacts } = window.MC;
  const MC = window.MC;
  const NOUN = { events: 'event', team_members: 'team member', team_departments: 'department', blog_entries: 'blog post', resources: 'resource', site_settings: 'setting', attendance_records: 'attendance', certificates: 'certificate', certificate_configs: 'certificate setup', leaderboard_periods: 'leaderboard period', sponsored_leaderboards: 'sponsored board' };
  const VERB = { create: 'Created', update: 'Updated', delete: 'Deleted', import_html_team: 'Imported roster for', sync_team: 'Synced roster for', reorder: 'Reordered' };

  function attention(d) {
    const out = [], now = Date.now(), day = 864e5;
    const live = d.events.filter((e) => e.status === 'published');
    const upcoming = live.filter((e) => e.start_at && new Date(e.start_at) > now).sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
    if (upcoming.length && !live.some((e) => e.pinned_next_session)) out.push({ lvl: 'warn', t: 'No event is pinned as Next Session', s: `The home page countdown is empty. "${upcoming[0].title}" is next.`, a: 'Pin it', r: ['events', {}, upcoming[0].id] });
    upcoming.filter((e) => new Date(e.start_at) - now < 7 * day && !e.registration_url).forEach((e) => out.push({ lvl: 'warn', t: `${e.title} has no registration link`, s: `Starts ${until(e.start_at)}.`, a: 'Add link', r: ['events', {}, e.id] }));
    d.events.filter((e) => e.status === 'draft' && e.start_at && new Date(e.start_at) > now && new Date(e.start_at) - now < 14 * day).forEach((e) => out.push({ lvl: 'warn', t: `${e.title} is still a draft`, s: `It starts ${until(e.start_at)} and is hidden from the public.`, a: 'Review', r: ['events', {}, e.id] }));
    live.filter((e) => (e.end_at || e.start_at) && new Date(e.end_at || e.start_at) < now && !(d.facts[e.id]?.attended)).slice(0, 3).forEach((e) => out.push({ lvl: 'info', t: `Import attendance for ${e.title}`, s: 'The event is over and no attendance has been uploaded.', a: 'Import', r: ['attendance', { event: e.id }] }));
    d.events.filter((e) => (d.facts[e.id]?.attended) && !d.facts[e.id].cert && e.status !== 'cancelled').slice(0, 3).forEach((e) => out.push({ lvl: 'info', t: `Open certificates for ${e.title}`, s: `${d.facts[e.id].attended} people attended. Certificates are not claimable yet.`, a: 'Set up', r: ['certificates', { event: e.id }] }));
    const noPhoto = d.team.filter((m) => m.status === 'published' && !m.photo_url);
    if (noPhoto.length) out.push({ lvl: 'info', t: `${noPhoto.length} published ${noPhoto.length === 1 ? 'person has' : 'people have'} no photo`, s: noPhoto.slice(0, 3).map((m) => m.name).join(', ') + (noPhoto.length > 3 ? '…' : ''), a: 'Open team', r: ['team', { filter: 'nophoto' }] });
    const drafts = d.team.filter((m) => m.status === 'draft');
    if (drafts.length) out.push({ lvl: 'info', t: `${drafts.length} team profile${drafts.length === 1 ? ' is' : 's are'} still a draft`, s: 'Drafts do not appear on the public team page.', a: 'Review', r: ['team', { filter: 'draft' }] });
    if (!d.periods.some((p) => p.enabled)) out.push({ lvl: 'info', t: 'No leaderboard period is scoring', s: 'Points are not being awarded until a period is enabled.', a: 'Open', r: ['leaderboard'] });
    return out;
  }

  MC.pages.overview = async () => {
    const q = (p) => p.then((r) => r, () => ({ data: [] }));
    const [ev, team, certs, blog, res, per, log] = await Promise.all([
      q(window.MC.sb.from('events').select('id,title,status,start_at,end_at,pinned_next_session,featured,registration_url,venue').order('start_at', { ascending: false }).limit(60)),
      q(window.MC.sb.from('team_members').select('id,name,status,photo_url')),
      q(window.MC.sb.from('certificate_configs').select('event_id,enabled')),
      q(window.MC.sb.from('blog_entries').select('id,status')),
      q(window.MC.sb.from('resources').select('id,status')),
      q(window.MC.sb.from('leaderboard_periods').select('id,enabled,published')),
      q(window.MC.sb.from('audit_logs').select('action,table_name,record_id,created_at').order('created_at', { ascending: false }).limit(8))
    ]);
    const events = ev.data || [];
    const facts = await eventFacts(events);
    const d = { events, facts, team: team.data || [], periods: per.data || [] };
    const now = Date.now();
    const live = events.filter((e) => e.status === 'published');
    const upcoming = live.filter((e) => e.start_at && new Date(e.start_at) > now).sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
    const focus = live.find((e) => e.pinned_next_session && new Date(e.end_at || e.start_at || 0) > now) || upcoming[0]
      || events.filter((e) => e.status !== 'cancelled' && e.status !== 'draft' && !(facts[e.id]?.cert && e.status === 'archived'))[0];
    const items = attention(d);
    const published = d.team.filter((m) => m.status === 'published').length;
    const glance = [
      ['events', 'Published events', live.length, `${events.filter((e) => e.status === 'draft').length} in draft`],
      ['certificates', 'Certificates open', (certs.data || []).filter((c) => c.enabled).length, 'events people can claim from'],
      ['team', 'People on the team page', published, `${d.team.length - published} hidden`],
      ['blog', 'Blog posts live', (blog.data || []).filter((b) => b.status === 'published').length, ''],
      ['resources', 'Resources live', (res.data || []).filter((b) => b.status === 'published').length, '']
    ];
    const activity = (log.data || []).map((a) => {
      const verb = VERB[a.action] || (a.action || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
      const noun = NOUN[a.table_name] || a.table_name || '';
      return `<li><span>${esc(verb)} ${esc(noun)}</span><time>${esc(ago(a.created_at))}</time></li>`;
    }).join('');

    const hero = focus ? `<section class="mc-focus" aria-labelledby="focus-t"><div class="mc-focus-head"><div><h2 id="focus-t">${focus.pinned_next_session ? 'Pinned next session' : upcoming.includes(focus) ? 'Coming up' : 'Needs wrapping up'}</h2><p class="mc-focus-title">${esc(focus.title)}</p><p class="muted">${esc(when(focus.start_at))}${focus.start_at ? ` · ${esc(until(focus.start_at))}` : ''}${focus.venue ? ` · ${esc(focus.venue)}` : ''}</p></div><div class="mc-actions"><button type="button" class="button-outline" data-go="events" data-id="${esc(focus.id)}">${icon('edit')}Edit</button><button type="button" data-go="attendance" data-event="${esc(focus.id)}">${icon('check')}Attendance</button></div></div>${pipeline(focus, facts[focus.id])}</section>`
      : `<section class="mc-focus empty"><h2>No event on the board</h2><p class="muted">Create your first event and its progress will be tracked here, from draft to certificates.</p><button type="button" data-go="events" data-id="new">${icon('plus')}New event</button></section>`;

    MC.setWorkspace('Overview', `<div class="mc-grid-2">
<div class="mc-col">${hero}
<section class="mc-card"><div class="mc-card-head"><h2>Needs attention</h2><span class="mc-count">${items.length}</span></div>${items.length ? `<ul class="mc-todo">${items.slice(0, 8).map((i, n) => `<li class="${i.lvl}"><span class="pip" aria-hidden="true"></span><div><b>${esc(i.t)}</b><small>${esc(i.s)}</small></div><button type="button" class="button-outline" data-todo="${n}">${esc(i.a)}</button></li>`).join('')}</ul>` : '<p class="mc-ok">Everything is in order. Nothing needs your attention.</p>'}</section>
<section class="mc-card"><div class="mc-card-head"><h2>All events</h2><button type="button" class="text-link" data-go="events">Manage events</button></div>${events.length ? `<ul class="mc-rows">${events.slice(0, 6).map((e) => `<li><div><b>${esc(e.title)}</b><small>${esc(when(e.start_at))} · ${esc(e.status)}</small></div>${pipeline(e, facts[e.id])}</li>`).join('')}</ul>` : '<p class="muted">No events yet.</p>'}</section></div>
<div class="mc-col"><section class="mc-card"><div class="mc-card-head"><h2>Chapter at a glance</h2></div><ul class="mc-glance">${glance.map(([r, l, n, s]) => `<li><button type="button" data-go="${r}"><strong>${n}</strong><span><b>${esc(l)}</b>${s ? `<small>${esc(s)}</small>` : ''}</span>${icon('chev')}</button></li>`).join('')}</ul></section>
<section class="mc-card"><div class="mc-card-head"><h2>Quick actions</h2></div><div class="mc-quick"><button type="button" class="button-outline" data-go="events" data-id="new">${icon('plus')}New event</button><button type="button" class="button-outline" data-go="team" data-id="new">${icon('plus')}Team member</button><button type="button" class="button-outline" data-go="badges">${icon('idcard')}Member Badges</button><button type="button" class="button-outline" data-go="resources" data-id="new">${icon('plus')}Resource</button><button type="button" class="button-outline" data-go="settings">${icon('settings')}Social links</button></div></section>
<section class="mc-card"><div class="mc-card-head"><h2>Recent changes</h2></div>${activity ? `<ul class="mc-feed">${activity}</ul>` : '<p class="muted">Changes you make will be listed here.</p>'}</section></div></div>`);

    const ws = MC.$('#admin-workspace');
    ws.onclick = (e) => {
      const g = e.target.closest('[data-go]');
      if (g) { if (g.dataset.event) go(g.dataset.go, { event: g.dataset.event }); else go(g.dataset.go, {}, g.dataset.id || ''); return; }
      const t = e.target.closest('[data-todo]');
      if (t) { const r = items[+t.dataset.todo].r; go(r[0], r[1] || {}, r[2] || ''); }
    };
  };
})();
