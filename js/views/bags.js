import { storage } from '../storage.js';
import { makeBag, makeId } from '../models.js';
import { escapeHtml } from './home.js';

export async function renderBags(outlet) {
  const bags = await storage.getBags();
  outlet.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <a class="btn btn-primary" href="#/bags/new">New bag</a>
      </div>
      <ul class="plain-list">
        ${bags
          .map(
            (b) => `
          <li class="list-row">
            <a class="list-row-link" href="#/bags/${b.id}/edit">
              <span class="list-row-name">${escapeHtml(b.name)}</span>
              <span class="list-row-meta">${b.clubs.map((c) => escapeHtml(c.name)).join(', ') || 'No clubs yet'}</span>
            </a>
            ${bags.length > 1 ? `<button type="button" class="icon-btn delete-bag-btn" data-id="${b.id}" data-name="${escapeHtml(b.name)}" aria-label="Delete ${escapeHtml(b.name)}">${trashIcon()}</button>` : ''}
          </li>
        `
          )
          .join('')}
      </ul>
      <p class="field-hint">Used for club-distance tracking while playing. If you have more than one, you'll be asked which one you're carrying when you start a round.</p>
    </section>
  `;

  document.querySelectorAll('.delete-bag-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const { id, name } = btn.dataset;
      const confirmed = window.confirm(`Delete "${name}"? Shots already tracked with these clubs keep their club stats — this only removes it as a bag you can pick from.`);
      if (!confirmed) return;
      await storage.deleteBag(id);
      renderBags(outlet);
    });
  });
}

export async function renderNewBag(outlet) {
  const bags = await storage.getBags();
  // Every new bag starts from the standard set (same as the very first
  // one) — a sensible full starting point to edit down from, per your
  // call on this, rather than an empty list to build up from scratch.
  const bag = makeBag({ name: `Bag ${bags.length + 1}` });
  renderBagForm(outlet, { bag, isNew: true, bagCount: bags.length + 1 });
}

export async function renderEditBag(outlet, params) {
  const bag = await storage.getBag(params.id);
  if (!bag) {
    outlet.innerHTML = `<p class="empty-state">Bag not found. <a href="#/bags">Back to bags</a></p>`;
    return;
  }
  const bags = await storage.getBags();
  renderBagForm(outlet, { bag, isNew: false, bagCount: bags.length });
}

function renderBagForm(outlet, { bag, isNew, bagCount }) {
  // Single expanded club at a time (accordion) — opening one closes
  // whatever was open, since a stack of several expanded detail forms on
  // a phone screen is exactly what gets unwieldy fast.
  let expandedClubId = null;
  // The brand value a field had when it was focused — compared against
  // on blur to tell "actually changed" from "tapped in and back out"
  // before offering to cascade it to every other club.
  let brandFieldOriginalValue = null;

  outlet.innerHTML = `
    <section class="panel">
      <label class="field">
        <span>Bag name</span>
        <input type="text" id="bag-name-input" value="${escapeHtml(bag.name)}" autocomplete="off" />
      </label>
      <div class="field-group-label">Clubs</div>
      <p class="field-hint">Tap a club to rename it or add a brand/notes.</p>
      <div id="club-list" class="plain-list"></div>
      <form id="add-club-form" class="add-club-row">
        <input type="text" id="new-club-input" placeholder="Add a club…" autocomplete="off" />
        <button type="submit" class="btn btn-secondary">Add</button>
      </form>
      ${!isNew && bagCount > 1 ? `<button type="button" class="text-btn text-btn-danger abandon-round-btn" id="delete-bag-btn">Delete bag</button>` : ''}
    </section>
  `;

  // The header's Save button (see header.js / app.js route meta) is the
  // only save action now — a full-width button in the scrolling content
  // read as "there might also be autosave," which there wasn't.
  document.getElementById('header-action-btn')?.addEventListener('click', saveBag);

  const clubList = document.getElementById('club-list');

  function renderClubRows() {
    clubList.innerHTML = bag.clubs
      .map((c, i) => {
        const isOpen = expandedClubId === c.id;
        return `
      <div class="club-card ${isOpen ? 'is-expanded' : ''}" data-club-id="${c.id}">
        <div class="list-row club-row">
          <button type="button" class="club-row-summary" data-toggle="${c.id}">
            <span class="list-row-name">${escapeHtml(c.name)}</span>
            ${c.brand ? `<span class="list-row-meta">${escapeHtml(c.brand)}</span>` : ''}
          </button>
          <div class="club-row-actions">
            <button type="button" class="icon-btn club-move-btn" data-index="${i}" data-dir="-1" aria-label="Move ${escapeHtml(c.name)} up" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="icon-btn club-move-btn" data-index="${i}" data-dir="1" aria-label="Move ${escapeHtml(c.name)} down" ${i === bag.clubs.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="icon-btn club-remove-btn" data-index="${i}" aria-label="Remove ${escapeHtml(c.name)}">${trashIcon()}</button>
          </div>
        </div>
        ${
          isOpen
            ? `
          <div class="club-detail-fields">
            <label class="field">
              <span>Name</span>
              <input type="text" class="club-field" data-index="${i}" data-key="name" value="${escapeHtml(c.name)}" autocomplete="off" />
            </label>
            <label class="field">
              <span>Brand</span>
              <input type="text" class="club-field" data-index="${i}" data-key="brand" value="${escapeHtml(c.brand || '')}" placeholder="e.g. Titleist" autocomplete="off" />
            </label>
            <label class="field">
              <span>Notes</span>
              <textarea class="club-field" data-index="${i}" data-key="notes" rows="2" placeholder="Shaft, loft, anything worth remembering…">${escapeHtml(c.notes || '')}</textarea>
            </label>
          </div>
        `
            : ''
        }
      </div>
    `;
      })
      .join('');
  }

  // Delegated so it survives renderClubRows() re-running on every edit.
  clubList.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('[data-toggle]');
    if (toggleBtn) {
      const id = toggleBtn.dataset.toggle;
      expandedClubId = expandedClubId === id ? null : id; // tap the open one again to close it
      renderClubRows();
      return;
    }
    const moveBtn = e.target.closest('.club-move-btn');
    if (moveBtn) {
      const i = Number(moveBtn.dataset.index);
      const dir = Number(moveBtn.dataset.dir);
      const j = i + dir;
      if (j < 0 || j >= bag.clubs.length) return;
      [bag.clubs[i], bag.clubs[j]] = [bag.clubs[j], bag.clubs[i]];
      renderClubRows();
      return;
    }
    const removeBtn = e.target.closest('.club-remove-btn');
    if (removeBtn) {
      removeClubWithAnimation(Number(removeBtn.dataset.index));
    }
  });

  function removeClubWithAnimation(index) {
    const card = clubList.querySelector(`.club-card[data-club-id="${bag.clubs[index].id}"]`);
    if (!card) {
      bag.clubs.splice(index, 1);
      renderClubRows();
      return;
    }
    // Collapse-and-fade, then actually remove the data once it's finished —
    // an instant disappearance reads as "did that actually register?" on
    // a touch screen; this makes the removal itself the confirmation.
    card.classList.add('is-removing');
    card.addEventListener(
      'transitionend',
      () => {
        const removed = bag.clubs.splice(index, 1)[0];
        if (removed && expandedClubId === removed.id) expandedClubId = null;
        renderClubRows();
      },
      { once: true }
    );
    // Belt-and-suspenders: if transitionend never fires for some reason
    // (reduced-motion, a browser quirk), don't leave the club stuck forever.
    setTimeout(() => {
      if (card.isConnected) card.dispatchEvent(new Event('transitionend'));
    }, 260);
  }

  // Delegated 'input' (every keystroke, so the row's own summary name
  // updates live) and 'focusin'/'change' (to detect a genuine, completed
  // brand edit and offer to cascade it) on the same list.
  clubList.addEventListener('input', (e) => {
    const field = e.target.closest('.club-field');
    if (!field) return;
    const club = bag.clubs[Number(field.dataset.index)];
    if (!club) return;
    club[field.dataset.key] = field.value;
    if (field.dataset.key === 'name') {
      const row = field.closest('.club-card')?.querySelector('.list-row-name');
      if (row) row.textContent = field.value || 'Unnamed club';
    }
  });

  clubList.addEventListener('focusin', (e) => {
    const field = e.target.closest('.club-field[data-key="brand"]');
    if (field) brandFieldOriginalValue = field.value;
  });

  clubList.addEventListener(
    'change',
    (e) => {
      const field = e.target.closest('.club-field[data-key="brand"]');
      if (!field) return;
      const newBrand = field.value.trim();
      const changed = newBrand && newBrand !== (brandFieldOriginalValue || '').trim();
      if (!changed || bag.clubs.length < 2) return;

      // A lot of people carry one brand across their whole bag — offer to
      // apply it everywhere instead of making that 14 separate edits.
      const confirmed = window.confirm(`Set every club in this bag to "${newBrand}"?`);
      if (!confirmed) return;
      bag.clubs.forEach((c) => (c.brand = newBrand));
      renderClubRows();
    },
    true // capture: 'change' doesn't bubble the same way on some inputs — capture phase catches it reliably either way
  );

  renderClubRows();

  document.getElementById('add-club-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('new-club-input');
    const name = input.value.trim();
    if (!name) return;
    bag.clubs.push({ id: makeId(), name, brand: '', notes: '' });
    input.value = '';
    renderClubRows();
  });

  async function saveBag() {
    bag.name = document.getElementById('bag-name-input').value.trim() || bag.name;
    // Empty club names (edited down to nothing) would be confusing to show
    // up as blank chips in the club picker while playing — drop them.
    bag.clubs = bag.clubs.filter((c) => c.name.trim());
    await storage.saveBag(bag);
    location.hash = '#/bags';
  }

  const deleteBtn = document.getElementById('delete-bag-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const confirmed = window.confirm(`Delete "${bag.name}"? Shots already tracked with these clubs keep their club stats — this only removes it as a bag you can pick from.`);
      if (!confirmed) return;
      await storage.deleteBag(bag.id);
      location.hash = '#/bags';
    });
  }
}

function trashIcon() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/></svg>`;
}
