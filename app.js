(() => {
  'use strict';
  const STORAGE_KEY = 'galaxy_sprite_tracker_progress_v1';
  const data = window.SPRITE_DATA || [];
  const rarities = ['Rare','Epic','Legendary','Mythic'];
  let activeRarity = 'Rare';
  let state = loadState();

  const tabsEl = document.getElementById('rarityTabs');
  const collectionsEl = document.getElementById('collections');
  const collectedTotalEl = document.getElementById('collectedTotal');
  const masteredTotalEl = document.getElementById('masteredTotal');

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function variantState(familyId, variantId) {
    state[familyId] ||= {};
    state[familyId][variantId] ||= { collected:false, mastered:false };
    return state[familyId][variantId];
  }
  function crownSvg() {
    return '<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M8 40h48l-4-26-12 10L32 8l-8 16-12-10-4 26Z"></path><path d="M12 45h40"></path></svg>';
  }
  function makeCard(family, variant) {
    const current = variantState(family.id, variant.id);
    const card = document.createElement('article');
    card.className = 'card' + (current.collected ? ' collected' : '') + (current.mastered ? ' mastered' : '');
    card.innerHTML = `
      <button class="image-button" type="button" aria-label="Toggle ${variant.name} ${family.name} collected">
        <div class="image-wrap">
          <button class="crown-button" type="button" aria-label="Toggle ${variant.name} ${family.name} mastered">${crownSvg()}</button>
          <img src="${variant.image}" alt="${variant.name} ${family.name} Sprite">
          <span class="check-badge">✓</span>
        </div>
      </button>
      <h3>${variant.name}</h3>
      <button class="collect-button" type="button"><span class="box"></span><span>Collected</span></button>
      <div class="master-label">${current.mastered ? 'Mastered' : 'Tap crown to master'}</div>`;

    const toggleCollected = () => {
      current.collected = !current.collected;
      saveState();
      render();
    };
    card.querySelector('.image-button').addEventListener('click', toggleCollected);
    card.querySelector('.collect-button').addEventListener('click', toggleCollected);
    card.querySelector('.crown-button').addEventListener('click', (event) => {
      event.stopPropagation();
      current.mastered = !current.mastered;
      saveState();
      render();
    });
    return card;
  }
  function renderTabs() {
    tabsEl.innerHTML = '';
    rarities.forEach((rarity) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tab' + (rarity === activeRarity ? ' active' : '');
      button.textContent = rarity;
      button.addEventListener('click', () => { activeRarity = rarity; render(); });
      tabsEl.appendChild(button);
    });
  }
  function renderCollections() {
    collectionsEl.innerHTML = '';
    data.filter((family) => family.rarity === activeRarity).forEach((family) => {
      const collectedInFamily = family.variants.filter((v) => variantState(family.id,v.id).collected).length;
      const section = document.createElement('section');
      section.className = 'collection';
      section.innerHTML = `<div class="collection-head"><h2>${family.name} Sprite Collection</h2><span class="collection-count">${collectedInFamily} / ${family.variants.length} collected</span></div><div class="variant-row"></div>`;
      const row = section.querySelector('.variant-row');
      family.variants.forEach((variant) => row.appendChild(makeCard(family,variant)));
      collectionsEl.appendChild(section);
    });
  }
  function updateTotals() {
    let total=0, collected=0, mastered=0;
    data.forEach((family) => family.variants.forEach((variant) => {
      total += 1;
      const current = variantState(family.id,variant.id);
      if (current.collected) collected += 1;
      if (current.mastered) mastered += 1;
    }));
    collectedTotalEl.textContent = `${collected} / ${total}`;
    masteredTotalEl.textContent = `${mastered} / ${total}`;
  }
  function render() { renderTabs(); renderCollections(); updateTotals(); }

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('Reset all collected and mastered progress?')) return;
    state = {};
    saveState();
    render();
  });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  render();
})();
