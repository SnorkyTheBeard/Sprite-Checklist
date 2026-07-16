(() => {
  'use strict';

  const STORAGE_KEY = 'galaxy_sprite_tracker_progress_v1';
  const data = Array.isArray(window.SPRITE_DATA) ? window.SPRITE_DATA : [];
  const rarities = ['Rare','Epic','Legendary','Mythic'].filter((rarity) => data.some((family) => family.rarity === rarity));
  const defaultRarity = rarities[0] || 'Rare';
  let activeRarity = rarityFromHash() || defaultRarity;
  let state = loadState();
  let toastTimer;
  let touchStart = null;

  const tabsEl = document.getElementById('rarityTabs');
  const collectionsEl = document.getElementById('collections');
  const pageTitleEl = document.getElementById('activePageTitle');
  const pageCountEl = document.getElementById('pageCount');
  const collectedTotalEl = document.getElementById('collectedTotal');
  const masteredTotalEl = document.getElementById('masteredTotal');
  const collectedBarEl = document.getElementById('collectedBar');
  const masteredBarEl = document.getElementById('masteredBar');
  const resetDialog = document.getElementById('resetDialog');
  const statusToast = document.getElementById('statusToast');
  const checklistPage = document.getElementById('checklistPage');

  function rarityFromHash() {
    const value = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    return rarities.find((rarity) => rarity.toLowerCase() === value) || null;
  }

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return stored && typeof stored === 'object' ? stored : {};
    } catch {
      return {};
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { showToast('Progress could not be saved on this device.'); }
  }

  function variantState(familyId, variantId) {
    state[familyId] ||= {};
    state[familyId][variantId] ||= { collected:false, mastered:false };
    return state[familyId][variantId];
  }

  function crownSvg() {
    return '<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M8 40h48l-4-26-12 10L32 8l-8 16-12-10-4 26Z"></path><path d="M12 45h40"></path></svg>';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
  }

  function makeCard(family, variant) {
    const current = variantState(family.id, variant.id);
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.familyId = family.id;
    card.dataset.variantId = variant.id;
    card.innerHTML = `
      <button class="crown-button" type="button" aria-label="Mark ${escapeHtml(variant.name)} ${escapeHtml(family.name)} as mastered" aria-pressed="false">${crownSvg()}</button>
      <div class="image-wrap">
        <button class="image-button" type="button" aria-label="Mark ${escapeHtml(variant.name)} ${escapeHtml(family.name)} as collected" aria-pressed="false">
          <img src="${variant.image}" alt="${escapeHtml(variant.name)} ${escapeHtml(family.name)} Sprite" loading="lazy" decoding="async">
          <span class="image-fallback">Image unavailable</span>
          <span class="check-badge" aria-hidden="true">✓</span>
        </button>
      </div>
      <h4>${escapeHtml(variant.name)}</h4>
      <button class="collect-button" type="button" aria-pressed="false"><span class="box" aria-hidden="true"></span><span>Collected</span></button>
      <div class="master-label">Tap crown to master</div>`;

    const image = card.querySelector('img');
    image.addEventListener('error', () => {
      image.hidden = true;
      card.classList.add('image-missing');
    }, { once:true });

    const toggleCollected = () => {
      current.collected = !current.collected;
      if (!current.collected) current.mastered = false;
      commitCardChange(card, family, variant, current, current.collected ? 'Collected' : 'Collection removed');
    };

    card.querySelector('.image-button').addEventListener('click', toggleCollected);
    card.querySelector('.collect-button').addEventListener('click', toggleCollected);
    card.querySelector('.crown-button').addEventListener('click', () => {
      current.mastered = !current.mastered;
      if (current.mastered) current.collected = true;
      commitCardChange(card, family, variant, current, current.mastered ? 'Mastered' : 'Mastery removed');
    });

    updateCard(card, current, family, variant);
    return card;
  }

  function updateCard(card, current, family, variant) {
    card.classList.toggle('collected', current.collected);
    card.classList.toggle('mastered', current.mastered);
    const collectedLabel = `${current.collected ? 'Remove' : 'Mark'} ${variant.name} ${family.name} ${current.collected ? 'from collected' : 'as collected'}`;
    const masteredLabel = `${current.mastered ? 'Remove mastery from' : 'Mark'} ${variant.name} ${family.name}${current.mastered ? '' : ' as mastered'}`;
    card.querySelector('.image-button').setAttribute('aria-label', collectedLabel);
    card.querySelector('.image-button').setAttribute('aria-pressed', String(current.collected));
    card.querySelector('.collect-button').setAttribute('aria-label', collectedLabel);
    card.querySelector('.collect-button').setAttribute('aria-pressed', String(current.collected));
    card.querySelector('.crown-button').setAttribute('aria-label', masteredLabel);
    card.querySelector('.crown-button').setAttribute('aria-pressed', String(current.mastered));
    card.querySelector('.master-label').textContent = current.mastered ? 'Mastered' : 'Tap crown to master';
  }

  function commitCardChange(card, family, variant, current, message) {
    updateCard(card, current, family, variant);
    saveState();
    updateCounters();
    showToast(`${variant.name} ${family.name}: ${message}`);
  }

  function familyStats(family) {
    const variants = family.variants.map((variant) => variantState(family.id, variant.id));
    return {
      total:variants.length,
      collected:variants.filter((item) => item.collected).length,
      mastered:variants.filter((item) => item.mastered).length
    };
  }

  function rarityStats(rarity) {
    return data.filter((family) => family.rarity === rarity).reduce((totals, family) => {
      const stats = familyStats(family);
      totals.total += stats.total;
      totals.collected += stats.collected;
      totals.mastered += stats.mastered;
      return totals;
    }, { total:0, collected:0, mastered:0 });
  }

  function overallStats() {
    return data.reduce((totals, family) => {
      const stats = familyStats(family);
      totals.total += stats.total;
      totals.collected += stats.collected;
      totals.mastered += stats.mastered;
      return totals;
    }, { total:0, collected:0, mastered:0 });
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    rarities.forEach((rarity) => {
      const stats = rarityStats(rarity);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tab';
      button.id = `tab-${rarity.toLowerCase()}`;
      button.role = 'tab';
      button.setAttribute('aria-controls','checklistPage');
      button.setAttribute('aria-selected', String(rarity === activeRarity));
      button.tabIndex = rarity === activeRarity ? 0 : -1;
      button.innerHTML = `${rarity}<small>${stats.collected}/${stats.total}</small>`;
      button.addEventListener('click', () => switchRarity(rarity, { historyMode:'push', announce:true }));
      button.addEventListener('keydown', handleTabKeys);
      tabsEl.appendChild(button);
    });
  }

  function handleTabKeys(event) {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = rarities.indexOf(activeRarity);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + rarities.length) % rarities.length;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % rarities.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = rarities.length - 1;
    switchRarity(rarities[nextIndex], { historyMode:'push', focusTab:true, announce:true });
  }

  function renderCollections() {
    collectionsEl.innerHTML = '';
    const families = data.filter((family) => family.rarity === activeRarity);
    pageTitleEl.textContent = `${activeRarity} Sprites`;
    pageTitleEl.dataset.rarity = activeRarity;
    checklistPage.setAttribute('aria-labelledby', `tab-${activeRarity.toLowerCase()}`);

    families.forEach((family) => {
      const stats = familyStats(family);
      const section = document.createElement('section');
      section.className = 'collection';
      section.dataset.rarity = family.rarity;
      section.dataset.familyId = family.id;
      section.innerHTML = `
        <div class="collection-head">
          <h3>${escapeHtml(family.name)} Sprite Collection</h3>
          <div class="collection-meta">
            <span class="collection-count">${stats.collected} / ${stats.total} collected</span>
            <span class="row-hint" aria-hidden="true">Swipe variants →</span>
          </div>
        </div>
        <div class="variant-row" aria-label="${escapeHtml(family.name)} variants"></div>`;
      const row = section.querySelector('.variant-row');
      family.variants.forEach((variant) => row.appendChild(makeCard(family,variant)));
      collectionsEl.appendChild(section);
    });
  }

  function updateCounters() {
    const overall = overallStats();
    const page = rarityStats(activeRarity);
    collectedTotalEl.textContent = `${overall.collected} / ${overall.total}`;
    masteredTotalEl.textContent = `${overall.mastered} / ${overall.total}`;
    pageCountEl.textContent = `${page.collected} / ${page.total}`;
    collectedBarEl.style.width = `${overall.total ? overall.collected / overall.total * 100 : 0}%`;
    masteredBarEl.style.width = `${overall.total ? overall.mastered / overall.total * 100 : 0}%`;

    collectionsEl.querySelectorAll('.collection').forEach((section) => {
      const family = data.find((item) => item.id === section.dataset.familyId);
      if (!family) return;
      const stats = familyStats(family);
      section.querySelector('.collection-count').textContent = `${stats.collected} / ${stats.total} collected`;
    });

    tabsEl.querySelectorAll('.tab').forEach((tab) => {
      const rarity = rarities.find((item) => tab.id === `tab-${item.toLowerCase()}`);
      if (!rarity) return;
      const stats = rarityStats(rarity);
      tab.querySelector('small').textContent = `${stats.collected}/${stats.total}`;
    });
  }

  function switchRarity(rarity, options = {}) {
    if (!rarities.includes(rarity)) return;
    const changed = activeRarity !== rarity;
    activeRarity = rarity;
    renderTabs();
    renderCollections();
    updateCounters();

    const hash = `#${rarity.toLowerCase()}`;
    if (options.historyMode === 'push' && location.hash !== hash) history.pushState({ rarity },'',hash);
    else if (location.hash !== hash) history.replaceState({ rarity },'',hash);

    const activeTab = document.getElementById(`tab-${rarity.toLowerCase()}`);
    activeTab?.scrollIntoView({ block:'nearest', inline:'center' });
    if (options.focusTab) activeTab?.focus();
    if (options.announce && changed) showToast(`${rarity} page`);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    statusToast.textContent = message;
    statusToast.classList.add('show');
    toastTimer = setTimeout(() => statusToast.classList.remove('show'), 1800);
  }

  function resetProgress() {
    state = {};
    saveState();
    renderCollections();
    updateCounters();
    showToast('All progress reset');
  }

  checklistPage.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1 || event.target.closest('.variant-row,button,a,input')) return;
    const touch = event.touches[0];
    touchStart = { x:touch.clientX, y:touch.clientY };
  }, { passive:true });

  checklistPage.addEventListener('touchend', (event) => {
    if (!touchStart || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    const currentIndex = rarities.indexOf(activeRarity);
    const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= rarities.length) return;
    switchRarity(rarities[nextIndex], { historyMode:'push', announce:true });
  }, { passive:true });

  window.addEventListener('popstate', () => switchRarity(rarityFromHash() || defaultRarity));
  window.addEventListener('hashchange', () => switchRarity(rarityFromHash() || defaultRarity));
  document.getElementById('resetBtn').addEventListener('click', () => resetDialog.showModal());
  document.getElementById('confirmResetBtn').addEventListener('click', resetProgress);

  switchRarity(activeRarity, { historyMode:'replace' });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
})();
