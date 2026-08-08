import { storage } from '../storage.js';
import { makeBag, makeId } from '../models.js';
import { escapeHtml } from './home.js';
import { trashIcon, chevronUpIcon, chevronDownIcon, dragHandleIcon } from '../icons.js';

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
            ${bags.length > 1 ? `<button type="button" class="icon-btn delete-bag-btn" data-id="${b.id}" data-name="${escapeHtml(b.name)}" aria-label="Delete ${escapeHtml(b.name)}">${trashIcon(16)}</button>` : ''}
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
          <button type="button" class="club-drag-handle" data-club-id="${c.id}" aria-label="Drag to reorder ${escapeHtml(c.name)}">${dragHandleIcon(20)}</button>
          <button type="button" class="club-row-summary" data-toggle="${c.id}">
            <span class="list-row-name">${escapeHtml(c.name)}</span>
            ${c.brand ? `<span class="list-row-meta">${escapeHtml(c.brand)}</span>` : ''}
          </button>
          <div class="club-row-actions">
            <button type="button" class="icon-btn club-move-btn" data-index="${i}" data-dir="-1" aria-label="Move ${escapeHtml(c.name)} up" ${i === 0 ? 'disabled' : ''}>${chevronUpIcon(14)}</button>
            <button type="button" class="icon-btn club-move-btn" data-index="${i}" data-dir="1" aria-label="Move ${escapeHtml(c.name)} down" ${i === bag.clubs.length - 1 ? 'disabled' : ''}>${chevronDownIcon(14)}</button>
            <button type="button" class="icon-btn club-remove-btn" data-index="${i}" aria-label="Remove ${escapeHtml(c.name)}">${trashIcon(16)}</button>
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

  // ---- Drag to reorder ----
  //
  // One handle-driven implementation covers both input types, with a
  // different activation rule per pointer type:
  //  - mouse/pen: dragging starts immediately on press, but ONLY from the
  //    handle — clicking/dragging anywhere else on the row (the name, the
  //    move/remove buttons) behaves exactly as it always has.
  //  - touch: the same handle requires a short hold (LONG_PRESS_MS)
  //    before a drag begins. Without that, a finger just trying to
  //    scroll the page past this list would register as an accidental
  //    reorder the instant it landed on the handle.
  //
  // While dragging, the card is translated with a live CSS transform and
  // swapped with a neighbor via a simple accumulator-plus-threshold
  // check (classic adjacent-swap reordering) — chosen over a full
  // "insert at nearest gap" algorithm because every row is the same
  // height (any expanded detail view is collapsed the moment a drag
  // starts, specifically so this height assumption always holds), which
  // makes the accumulator approach exact rather than approximate.
  // bag.clubs itself is only reconciled once, on release, by reading the
  // final DOM order — same "mutate locally, Save persists" pattern as
  // every other edit on this screen (see saveBag()).

  const LONG_PRESS_MS = 350;
  const TOUCH_MOVE_CANCEL_PX = 10; // a touch that drifts this far before the hold completes is a scroll, not a grab
  const AUTOSCROLL_EDGE_PX = 70; // how close to the top/bottom of the viewport triggers scrolling
  const AUTOSCROLL_MAX_SPEED = 16; // px per animation frame at the very edge

  let dragState = null; // { pointerId, cardEl, translateY, lastY }
  let longPress = null; // { timer, moveListener, upListener } — only set while waiting out a touch hold
  let autoScrollFrame = null; // requestAnimationFrame handle — only set while actively auto-scrolling
  let autoScrollBy = 0; // signed px/frame; 0 means "not near an edge"

  clubList.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.club-drag-handle');
    if (!handle) return;
    const card = handle.closest('.club-card');
    if (!card) return;

    if (e.pointerType === 'touch') {
      const startX = e.clientX;
      const startY = e.clientY;
      const cancel = () => {
        clearTimeout(longPress.timer);
        document.removeEventListener('pointermove', onWaitMove);
        document.removeEventListener('pointerup', cancel);
        document.removeEventListener('pointercancel', cancel);
        longPress = null;
      };
      const onWaitMove = (ev) => {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > TOUCH_MOVE_CANCEL_PX) cancel();
      };
      const timer = setTimeout(() => {
        cancel();
        beginDrag(card, handle, e);
      }, LONG_PRESS_MS);
      longPress = { timer };
      document.addEventListener('pointermove', onWaitMove);
      document.addEventListener('pointerup', cancel, { once: true });
      document.addEventListener('pointercancel', cancel, { once: true });
    } else {
      // Mouse or pen: the handle IS the deliberate target already — no
      // hold needed, dragging begins on press.
      e.preventDefault(); // avoid a stray text-selection drag on desktop
      beginDrag(card, handle, e);
    }
  });

  function beginDrag(card, handle, e) {
    if (expandedClubId) {
      // Collapse first — see the module comment above on why every row
      // needs to be the same height for the swap math to be exact.
      expandedClubId = null;
      renderClubRows();
      // renderClubRows() just replaced every node, including the card
      // and handle passed in — re-find both from the fresh DOM before
      // continuing, or setPointerCapture below would be called on an
      // element that's no longer attached to anything.
      card = clubList.querySelector(`.club-card[data-club-id="${card.dataset.clubId}"]`);
      if (!card) return;
      handle = card.querySelector('.club-drag-handle');
      if (!handle) return;
    }

    handle.setPointerCapture(e.pointerId);
    card.classList.add('is-dragging');
    dragState = { pointerId: e.pointerId, cardEl: card, translateY: 0, lastY: e.clientY };

    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
  }

  function onDragMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    e.preventDefault();

    const dy = e.clientY - dragState.lastY;
    dragState.lastY = e.clientY;
    dragState.translateY += dy;
    dragState.cardEl.style.transform = `translateY(${dragState.translateY}px)`;

    const cardHeight = dragState.cardEl.offsetHeight;
    const threshold = cardHeight / 2;

    if (dragState.translateY > threshold) {
      const next = dragState.cardEl.nextElementSibling;
      if (next && next.classList.contains('club-card')) {
        clubList.insertBefore(next, dragState.cardEl);
        dragState.translateY -= cardHeight;
        dragState.cardEl.style.transform = `translateY(${dragState.translateY}px)`;
      }
    } else if (dragState.translateY < -threshold) {
      const prev = dragState.cardEl.previousElementSibling;
      if (prev && prev.classList.contains('club-card')) {
        clubList.insertBefore(dragState.cardEl, prev);
        dragState.translateY += cardHeight;
        dragState.cardEl.style.transform = `translateY(${dragState.translateY}px)`;
      }
    }

    updateAutoScroll(e.clientY);
  }

  // Lets a drag that's held near the top or bottom edge of the viewport
  // keep scrolling the page — without this, a club list longer than one
  // screenful would strand you: there'd be no way to drag a club past
  // whatever's currently visible, since lifting your finger to scroll
  // manually also ends the drag. Speed ramps linearly from 0 at the edge
  // of the trigger zone up to AUTOSCROLL_MAX_SPEED right at the
  // viewport's edge, rather than a single fixed speed, so a small
  // overshoot near the boundary doesn't feel like it suddenly kicks into
  // full speed.
  function updateAutoScroll(clientY) {
    const viewportHeight = window.innerHeight;
    if (clientY < AUTOSCROLL_EDGE_PX) {
      const depth = (AUTOSCROLL_EDGE_PX - clientY) / AUTOSCROLL_EDGE_PX; // 0 at the zone's outer edge, 1 at the very top
      autoScrollBy = -Math.max(2, depth * AUTOSCROLL_MAX_SPEED);
    } else if (clientY > viewportHeight - AUTOSCROLL_EDGE_PX) {
      const depth = (clientY - (viewportHeight - AUTOSCROLL_EDGE_PX)) / AUTOSCROLL_EDGE_PX;
      autoScrollBy = Math.max(2, depth * AUTOSCROLL_MAX_SPEED);
    } else {
      autoScrollBy = 0;
    }

    if (autoScrollBy !== 0 && autoScrollFrame == null) {
      autoScrollFrame = requestAnimationFrame(runAutoScroll);
    }
  }

  // Runs on its own rAF loop rather than only reacting to pointermove —
  // holding the pointer still at the edge (the normal way to say "keep
  // scrolling") produces no further pointermove events at all, so the
  // loop has to keep itself going independently once started. It only
  // stops itself once the pointer's moved back out of the edge zone
  // (autoScrollBy reset to 0 by updateAutoScroll above) or the drag has
  // ended (dragState cleared by endDrag).
  function runAutoScroll() {
    if (!dragState || autoScrollBy === 0) {
      autoScrollFrame = null;
      return;
    }
    window.scrollBy(0, autoScrollBy);
    autoScrollFrame = requestAnimationFrame(runAutoScroll);
  }

  function stopAutoScroll() {
    if (autoScrollFrame != null) cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = null;
    autoScrollBy = 0;
  }

  function endDrag(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const { cardEl } = dragState;

    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', endDrag);
    document.removeEventListener('pointercancel', endDrag);
    stopAutoScroll();

    cardEl.classList.remove('is-dragging');
    cardEl.style.transform = '';
    dragState = null;

    // Commit the visual order (already correct on screen from the swaps
    // above) into the real data — the single source of truth from here
    // on, same as every other mutation on this screen: local only until
    // the header Save button persists it.
    const orderedIds = [...clubList.querySelectorAll('.club-card')].map((el) => el.dataset.clubId);
    bag.clubs.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
    renderClubRows(); // refreshes each row's up/down disabled state and data-index values to match the new order
  }

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
