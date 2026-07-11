(() => {
  'use strict';
  const collections = window.SPRITE_DATA || [];
  const rarities = ['Rare','Epic','Legendary','Mythic'];
  const STATE_KEY = 'sprite-checklist-state-v1';
  let activeRarity = 'Rare';
  let state = loadState();

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY)) || {}; }
    catch { return {}; }
  }
  function saveState() { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
  function getState(collectionId, variantId) {
    state[collectionId] ||= {};
    state[collectionId][variantId] ||= { collected:false, mastered:false };
    return state[collectionId][variantId];
  }
  function countAll(type) {
    return collections.reduce((sum, collection) => sum + collection.variants.filter(v => getState(collection.id, v.id)[type]).length, 0);
  }
  function updateStats() {
    document.getElementById('collectedCount').textContent = `${countAll('collected')} / 66`;
    document.getElementById('masteredCount').textContent = `${countAll('mastered')} / 66`;
  }
  function renderTabs() {
    const tabs = document.getElementById('tabs');
    tabs.replaceChildren();
    rarities.forEach(rarity => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `tab${activeRarity === rarity ? ' active' : ''}`;
      button.textContent = rarity;
      button.addEventListener('click', () => { activeRarity = rarity; render(); });
      tabs.appendChild(button);
    });
  }
  function crownSvg() {
    return `<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M8 40h48l-4-26-12 10L32 8l-8 16-12-10-4 26Z"></path><path d="M12 45h40"></path></svg>`;
  }
  function makeCard(collection, variant) {
    const current = getState(collection.id, variant.id);
    const card = document.createElement('article');
    card.className = `card${current.collected ? ' collected' : ''}${current.mastered ? ' mastered' : ''}`;
    card.innerHTML = `
      <div class="image-stage">
        <button class="master-crown" type="button" aria-label="Toggle ${variant.name} ${collection.name} mastered">${crownSvg()}</button>
        <button class="image-button" type="button" aria-label="Toggle ${variant.name} ${collection.name} collected">
          <span class="image-wrap"><img src="${variant.image}" alt="${variant.name} ${collection.name} Sprite"><span class="check-badge">✓</span></span>
        </button>
      </div>
      <h3>${variant.name}</h3>
      <button class="collected-button" type="button"><span class="box"></span><span>Collected</span></button>
      <p class="master-label">${current.mastered ? 'Mastered' : 'Tap crown to master'}</p>`;

    const toggleCollected = () => { current.collected = !current.collected; saveState(); render(); };
    card.querySelector('.image-button').addEventListener('click', toggleCollected);
    card.querySelector('.collected-button').addEventListener('click', toggleCollected);
    card.querySelector('.master-crown').addEventListener('click', () => { current.mastered = !current.mastered; saveState(); render(); });
    return card;
  }
  function renderMain() {
    const main = document.getElementById('main');
    main.replaceChildren();
    collections.filter(c => c.rarity === activeRarity).forEach(collection => {
      const section = document.createElement('section');
      section.className = 'collection';
      const collected = collection.variants.filter(v => getState(collection.id, v.id).collected).length;
      const head = document.createElement('div');
      head.className = 'collection-head';
      head.innerHTML = `<h2>${collection.name} Sprite Collection</h2><span class="family-count">${collected} / ${collection.variants.length} collected</span>`;
      const row = document.createElement('div');
      row.className = 'row';
      collection.variants.forEach(v => row.appendChild(makeCard(collection, v)));
      section.append(head, row);
      main.appendChild(section);
    });
  }
  function render() { renderTabs(); renderMain(); updateStats(); }
  document.getElementById('reset').addEventListener('click', () => {
    if (!confirm('Reset all Collected and Mastered progress?')) return;
    state = {}; saveState(); render();
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
  }
  render();
})();
