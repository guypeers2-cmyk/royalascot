(function(){
  'use strict';
  const TOKEN_KEY = 'ascot-admin-token-v1';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtTime = ms => ms ? new Date(ms).toLocaleString() : '—';
  const fmtMedals = v => `${Math.round((Number(v) || 0) * 100) / 100}m`;

  let token = '';
  try { token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''; } catch {}
  let statusInfo = { configured: true, envLocked: false };
  let overview = null;
  let activeTab = 'races';
  let refreshTimer = null;

  function setToken(next) {
    token = next || '';
    try {
      if (token) {
        sessionStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        sessionStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {}
  }

  async function api(op, { method = 'GET', body = null } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== null) headers['Content-Type'] = 'application/json';
    const res = await fetch(`/api/admin?op=${encodeURIComponent(op)}`, {
      method,
      headers,
      body: body !== null ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    const data = await res.json().catch(() => ({ error: 'Unreadable server response.' }));
    if (!res.ok) {
      const err = new Error(data.error || 'Administrator request failed.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function showBanner(msg, isErr = false) {
    const el = $('dashBanner');
    if (!el) return;
    el.textContent = msg;
    el.className = isErr ? 'banner error' : 'banner';
    el.hidden = !msg;
  }

  function showAuth(setupMode) {
    $('authView').hidden = false;
    $('dashView').hidden = true;
    $('refreshBtn').hidden = true;
    $('autoRefreshWrap').hidden = true;
    $('logoutBtn').hidden = true;
    $('authError').hidden = true;

    if (setupMode) {
      $('authBadge').textContent = 'First-Time Setup · Unclaimed';
      $('authTitle').textContent = 'Claim Exclusive Administrator Account';
      $('authDesc').textContent = 'Create your private administrator username and password. Once saved, setup is permanently locked so only you can access this console.';
      $('authConfirmWrap').hidden = false;
      $('authConfirm').required = true;
      $('authPass').autocomplete = 'new-password';
      $('authSubmit').textContent = 'Create & Lock Admin Account';
    } else {
      $('authBadge').textContent = statusInfo.envLocked ? 'Environment Locked · Protected' : 'Locked · Administrator Only';
      $('authTitle').textContent = 'Administrator Sign In';
      $('authDesc').textContent = 'Sign in with your exclusive administrator credentials to manage the server and inspect archived history.';
      $('authConfirmWrap').hidden = true;
      $('authConfirm').required = false;
      $('authPass').autocomplete = 'current-password';
      $('authSubmit').textContent = 'Sign In';
    }
  }

  function showDash() {
    $('authView').hidden = true;
    $('dashView').hidden = false;
    $('refreshBtn').hidden = false;
    $('autoRefreshWrap').hidden = false;
    $('logoutBtn').hidden = false;
  }

  function renderPlayers(players) {
    const body = $('playersBody');
    if (!players || !players.length) {
      body.innerHTML = '<tr><td colspan="7" class="muted">No players registered yet.</td></tr>';
      return;
    }
    body.innerHTML = players.map(p => `
      <tr data-player-id="${esc(p.id)}">
        <td><strong>${esc(p.name)}</strong><div class="arch-meta">Joined ${esc(fmtTime(p.joinedAt))}</div></td>
        <td><span class="pill ${p.online ? 'online' : 'offline'}">${p.online ? 'Online' : 'Offline'}</span></td>
        <td>${p.hasPin ? '4-digit PIN' : 'None'}</td>
        <td>
          <div class="bal-edit">
            <input type="number" min="0" max="10000000" step="1" value="${Math.round(p.balance * 100) / 100}" aria-label="Balance for ${esc(p.name)}">
            <button class="btn ghost sm" data-act="save-bal" type="button">Save</button>
          </div>
        </td>
        <td>${p.openBetsCount}</td>
        <td>${p.racesPlayed}</td>
        <td><button class="btn danger-outline sm" data-act="remove-player" type="button">Remove</button></td>
      </tr>
    `).join('');
  }

  function renderRaces(races) {
    const q = ($('historyFilter').value || '').trim().toLowerCase();
    const list = (races || []).filter(r => {
      if (!q) return true;
      const hay = [
        `s${r.sessionNo}`,
        `session ${r.sessionNo}`,
        `race ${r.raceNo}`,
        r.title || '',
        ...(r.runners || []).map(h => h.name),
        ...(r.playerResults || []).map(p => p.name)
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });

    if (!list.length) {
      $('racesList').innerHTML = '<p class="muted">No archived races match that filter yet.</p>';
      return;
    }

    $('racesList').innerHTML = list.map(r => {
      const winner = r.runners?.[ (r.order?.[0] || 1) - 1 ]?.name || `#${r.order?.[0] || '?'}`;
      const second = r.runners?.[ (r.order?.[1] || 2) - 1 ]?.name || `#${r.order?.[1] || '?'}`;
      const pRows = (r.playerResults || []).map(p => {
        const betsText = (p.bets || []).map(b => `${b.market.toUpperCase()} [${(b.nums || []).join('+')}] ${b.stake}m → ${b.returned}m`).join(' · ') || 'No bets';
        return `<div class="runner-pill"><span><b>${esc(p.name)}</b>: ${esc(betsText)}</span><em>Stake ${fmtMedals(p.stake)} · Return ${fmtMedals(p.return)}</em></div>`;
      }).join('');
      const orderBadges = (r.order || []).map((num, idx) => {
        const h = r.runners?.[num - 1];
        return `<div class="runner-pill"><span><b>${idx + 1}.</b> #${num} ${esc(h?.name || '')}</span><em>${h?.winOdds ? h.winOdds.toFixed(1) + '×' : ''}</em></div>`;
      }).join('');
      return `
        <details class="arch-item">
          <summary>
            <span class="arch-title">Session ${r.sessionNo} · Race #${r.raceNo} — ${esc(r.title || 'Race')} · 1st: ${esc(winner)}, 2nd: ${esc(second)}</span>
            <span class="arch-meta">${esc(fmtTime(r.settledAt))} · Wagered ${fmtMedals(r.totalStake)} · Paid ${fmtMedals(r.totalReturn)}</span>
          </summary>
          <div class="arch-body">
            <div class="runners-mini">${orderBadges}</div>
            ${pRows ? `<div class="stack">${pRows}</div>` : '<span class="muted">No player wagers recorded in this race.</span>'}
          </div>
        </details>
      `;
    }).join('');
  }

  function renderResets(resets) {
    if (!resets || !resets.length) {
      $('resetsList').innerHTML = '<p class="muted">No server resets recorded yet.</p>';
      return;
    }
    $('resetsList').innerHTML = resets.map(x => `
      <details class="arch-item">
        <summary>
          <span class="arch-title">Reset from Session ${x.sessionNo} (Race #${x.endedRaceNo}, ${esc(x.mode)})</span>
          <span class="arch-meta">${esc(fmtTime(x.resetAt))} · By ${esc(x.by)} · ${x.playerCount} players</span>
        </summary>
        <div class="arch-body">
          <div><strong>Reason:</strong> ${esc(x.reason || 'None provided')} · <strong>Session Races:</strong> ${x.sessionRacesCount} · <strong>Session Wagered:</strong> ${fmtMedals(x.sessionWagered)}</div>
          <div class="runners-mini">
            ${(x.playersSnapshot || []).map(p => `<div class="runner-pill"><span>${esc(p.name)}</span><em>${fmtMedals(p.balance)}</em></div>`).join('') || '<span class="muted">No players at reset time.</span>'}
          </div>
        </div>
      </details>
    `).join('');
  }

  function renderAudit(log) {
    if (!log || !log.length) {
      $('auditList').innerHTML = '<p class="muted">No administrator events recorded yet.</p>';
      return;
    }
    $('auditList').innerHTML = log.map(a => `
      <div class="arch-item">
        <div class="card-head">
          <span class="arch-title">${esc(a.kind)}</span>
          <span class="arch-meta">${esc(fmtTime(a.at))} · ${esc(a.actor)}</span>
        </div>
        <div class="muted">${esc(a.detail)}</div>
      </div>
    `).join('');
  }

  function renderOverview(data) {
    overview = data;
    showDash();
    const { admin, table, stats, players, archive } = data;
    $('topSubtitle').textContent = `Signed in as ${admin.username} · Exclusive Administrator Console`;
    $('kpiSession').textContent = `S${table.sessionNo} · Race #${table.raceNo}`;
    $('kpiPhase').textContent = `${table.phase} (${Math.round(table.clock || 0)}s)`;
    $('kpiRaces').textContent = String(stats.archivedRaces);
    $('kpiResets').textContent = `${stats.totalResets} server resets`;
    $('kpiWagered').textContent = fmtMedals(stats.totalWageredAllTime);
    $('kpiReturned').textContent = `${fmtMedals(stats.totalReturnedAllTime)} paid out`;
    $('kpiPlayers').textContent = String(stats.registeredPlayers);
    $('kpiOnline').textContent = `${stats.onlinePlayers} online now`;
    $('joinCodePill').textContent = `Code: ${table.joinCode}`;
    if (document.activeElement !== $('joinCodeInput')) {
      $('joinCodeInput').value = table.joinCode;
    }
    $('liveRaceMeta').textContent = `${table.title} · Phase: ${table.phase} · Revision ${table.revision}`;
    $('forceCloseBtn').disabled = table.phase !== 'betting';
    $('forceNextBtn').disabled = table.phase !== 'result';

    $('tabRacesCount').textContent = String((archive.races || []).length);
    $('tabResetsCount').textContent = String((archive.resets || []).length);
    $('tabAuditCount').textContent = String((archive.auditLog || []).length);

    $('envLockNote').hidden = !admin.envLocked;
    $('secCurPass').disabled = !!admin.envLocked;
    $('secNewUser').disabled = !!admin.envLocked;
    $('secNewPass').disabled = !!admin.envLocked;
    $('secSaveBtn').disabled = !!admin.envLocked;
    if (!admin.envLocked && !$('secNewUser').value) $('secNewUser').value = admin.username;

    renderPlayers(players);
    renderRaces(archive.races);
    renderResets(archive.resets);
    renderAudit(archive.auditLog);
  }

  async function refreshOverview() {
    if (!token) return;
    try {
      const data = await api('overview');
      renderOverview(data);
    } catch (err) {
      if (err.status === 401) {
        setToken('');
        stopAutoRefresh();
        await init();
      } else {
        showBanner(err.message, true);
      }
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    if (!$('autoRefresh').checked || !token) return;
    refreshTimer = setInterval(() => {
      if (!$('dashView').hidden && $('autoRefresh').checked) refreshOverview();
    }, 4000);
  }

  function stopAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
  }

  async function init() {
    try {
      statusInfo = await api('status');
    } catch {
      statusInfo = { configured: true, envLocked: false };
    }
    if (token && statusInfo.configured) {
      try {
        const data = await api('overview');
        renderOverview(data);
        startAutoRefresh();
        return;
      } catch {
        setToken('');
      }
    }
    showAuth(!statusInfo.configured);
  }

  $('authForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('authError').hidden = true;
    const username = $('authUser').value.trim();
    const password = $('authPass').value;
    const isSetup = !statusInfo.configured;
    if (isSetup && password !== $('authConfirm').value) {
      $('authError').textContent = 'Passwords do not match.';
      $('authError').hidden = false;
      return;
    }
    $('authSubmit').disabled = true;
    try {
      const res = await api(isSetup ? 'setup' : 'login', {
        method: 'POST',
        body: { username, password }
      });
      setToken(res.token);
      $('authPass').value = '';
      $('authConfirm').value = '';
      statusInfo.configured = true;
      await refreshOverview();
      startAutoRefresh();
    } catch (err) {
      $('authError').textContent = err.message;
      $('authError').hidden = false;
    } finally {
      $('authSubmit').disabled = false;
    }
  });

  $('logoutBtn').addEventListener('click', async () => {
    stopAutoRefresh();
    try { await api('logout', { method: 'POST', body: {} }); } catch {}
    setToken('');
    await init();
  });

  $('refreshBtn').addEventListener('click', refreshOverview);
  $('autoRefresh').addEventListener('change', () => {
    if ($('autoRefresh').checked) startAutoRefresh();
    else stopAutoRefresh();
  });

  $('resetArmBtn').addEventListener('click', () => {
    const mode = $('resetMode').value;
    const desc = mode === 'archive_wipe_players'
      ? 'This will archive all race history & standings, reset to Race #1, and REMOVE all player seats.'
      : mode === 'soft_round'
        ? 'This will refund open bets and restart the current round clock while keeping balances & history.'
        : 'This will archive all race history & standings, reset to Race #1, and reset all player wallets to 500m.';
    $('resetConfirmText').textContent = desc;
    $('resetArmRow').hidden = true;
    $('resetConfirmBox').hidden = false;
  });

  $('resetCancelBtn').addEventListener('click', () => {
    $('resetConfirmBox').hidden = true;
    $('resetArmRow').hidden = false;
  });

  $('resetConfirmBtn').addEventListener('click', async () => {
    $('resetConfirmBtn').disabled = true;
    try {
      const data = await api('reset', {
        method: 'POST',
        body: {
          mode: $('resetMode').value,
          reason: $('resetReason').value.trim()
        }
      });
      $('resetReason').value = '';
      $('resetConfirmBox').hidden = true;
      $('resetArmRow').hidden = false;
      renderOverview(data);
      showBanner('Server reset complete. Full pre-reset history has been saved to the permanent archive.');
    } catch (err) {
      showBanner(err.message, true);
    } finally {
      $('resetConfirmBtn').disabled = false;
    }
  });

  $('forceCloseBtn').addEventListener('click', async () => {
    try {
      const data = await api('action', { method: 'POST', body: { action: 'force_close' } });
      renderOverview(data);
      showBanner('Betting closed — gates opening now.');
    } catch (err) { showBanner(err.message, true); }
  });

  $('forceNextBtn').addEventListener('click', async () => {
    try {
      const data = await api('action', { method: 'POST', body: { action: 'force_next' } });
      renderOverview(data);
      showBanner('Advanced to the next race.');
    } catch (err) { showBanner(err.message, true); }
  });

  $('joinCodeForm').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const data = await api('action', {
        method: 'POST',
        body: { action: 'set_join_code', data: { code: $('joinCodeInput').value } }
      });
      renderOverview(data);
      showBanner(`Table join code updated to ${data.table.joinCode}.`);
    } catch (err) { showBanner(err.message, true); }
  });

  $('playersBody').addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const row = btn.closest('tr[data-player-id]');
    const playerId = row?.dataset.playerId;
    if (!playerId) return;
    if (btn.dataset.act === 'save-bal') {
      const input = row.querySelector('input[type="number"]');
      try {
        const data = await api('action', {
          method: 'POST',
          body: { action: 'adjust_balance', data: { playerId, balance: Number(input.value) } }
        });
        renderOverview(data);
        showBanner('Player balance updated.');
      } catch (err) { showBanner(err.message, true); }
    } else if (btn.dataset.act === 'remove-player') {
      try {
        const data = await api('action', {
          method: 'POST',
          body: { action: 'remove_player', data: { playerId } }
        });
        renderOverview(data);
        showBanner('Player seat removed.');
      } catch (err) { showBanner(err.message, true); }
    }
  });

  document.querySelectorAll('.tab[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.tab[data-tab]').forEach(b => b.classList.toggle('active', b === btn));
      $('tabRaces').hidden = activeTab !== 'races';
      $('tabResets').hidden = activeTab !== 'resets';
      $('tabAudit').hidden = activeTab !== 'audit';
      $('tabSecurity').hidden = activeTab !== 'security';
      $('historyFilter').hidden = activeTab !== 'races';
    });
  });

  $('historyFilter').addEventListener('input', () => {
    if (overview?.archive?.races) renderRaces(overview.archive.races);
  });

  $('exportJsonBtn').addEventListener('click', async () => {
    try {
      const payload = await api('action', { method: 'POST', body: { action: 'export_archive' } });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `royal-ascot-archive-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showBanner('Full JSON history archive downloaded.');
    } catch (err) { showBanner(err.message, true); }
  });

  $('exportCsvBtn').addEventListener('click', () => {
    const races = overview?.archive?.races || [];
    const lines = ['session,raceNo,settledAt,title,1st,2nd,3rd,totalStake,totalReturn,playersCount'];
    for (const r of races) {
      const o = r.order || [];
      const nameOf = n => (r.runners?.[n - 1]?.name || `#${n}`).replace(/"/g, '""');
      lines.push([
        r.sessionNo,
        r.raceNo,
        new Date(r.settledAt).toISOString(),
        `"${String(r.title || '').replace(/"/g, '""')}"`,
        `"${nameOf(o[0])}"`,
        `"${nameOf(o[1])}"`,
        `"${nameOf(o[2])}"`,
        r.totalStake,
        r.totalReturn,
        (r.playerResults || []).length
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `royal-ascot-races-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showBanner('Race history CSV downloaded.');
  });

  $('credsForm').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const data = await api('action', {
        method: 'POST',
        body: {
          action: 'change_credentials',
          data: {
            currentPassword: $('secCurPass').value,
            newUsername: $('secNewUser').value.trim(),
            newPassword: $('secNewPass').value
          }
        }
      });
      $('secCurPass').value = '';
      $('secNewPass').value = '';
      renderOverview(data);
      showBanner('Administrator credentials updated.');
    } catch (err) { showBanner(err.message, true); }
  });

  init();
})();
