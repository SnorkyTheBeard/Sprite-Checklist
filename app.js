(() => {
  'use strict';

  const PROGRESS_KEY = 'galaxy_sprite_tracker_progress_v1';
  const DESIGN_KEY = 'galaxy_sprite_tracker_design_v1';
  const baseData = Array.isArray(window.SPRITE_DATA) ? window.SPRITE_DATA : [];
  const rarities = ['Rare','Epic','Legendary','Mythic'].filter((rarity) => baseData.some((family) => family.rarity === rarity));
  const defaultRarity = rarities[0] || 'Rare';

  const DEFAULT_HEADER = {
    kicker:'Fortnite Collection Tracker',
    title:'Galaxy Sprite Checklist',
    subtitle:'Tap a sprite to mark it collected. Tap its crown when it is mastered.',
    collectedLabel:'Collected',
    masteredLabel:'Mastered',
    footerNote:'Progress is saved on this device.',
    showSummary:true
  };

  const DEFAULT_PAGES = Object.fromEntries(rarities.map((rarity) => [rarity, {
    eyebrow:'Checklist page',
    title:`${rarity} Sprites`,
    description:'Track every available variant in this rarity.'
  }]));

  let activeRarity = rarityFromHash() || defaultRarity;
  let state = loadJson(PROGRESS_KEY, {});
  let design = loadDesign();
  let editMode = false;
  let toastTimer;
  let touchStart = null;
  let pendingVariantImage;
  let previewObjectUrl;

  const tabsEl = document.getElementById('rarityTabs');
  const collectionsEl = document.getElementById('collections');
  const checklistPage = document.getElementById('checklistPage');
  const pageTitleEl = document.getElementById('activePageTitle');
  const pageEyebrowEl = document.getElementById('pageEyebrow');
  const pageDescriptionEl = document.getElementById('pageDescription');
  const pageCountEl = document.getElementById('pageCount');
  const collectedTotalEl = document.getElementById('collectedTotal');
  const masteredTotalEl = document.getElementById('masteredTotal');
  const collectedBarEl = document.getElementById('collectedBar');
  const masteredBarEl = document.getElementById('masteredBar');
  const resetDialog = document.getElementById('resetDialog');
  const statusToast = document.getElementById('statusToast');

  function loadJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function normalizeDesign(stored = {}) {
    return {
      header:{ ...DEFAULT_HEADER, ...(stored.header || {}) },
      pages:Object.fromEntries(rarities.map((rarity) => [rarity, { ...DEFAULT_PAGES[rarity], ...(stored.pages?.[rarity] || {}) }])),
      families:stored.families && typeof stored.families === 'object' ? stored.families : {}
    };
  }

  function loadDesign() {
    return normalizeDesign(loadJson(DESIGN_KEY, {}));
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object,key);
  }

  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(state)); }
    catch { showToast('Progress could not be saved on this device.'); }
  }

  function saveDesign() {
    try {
      localStorage.setItem(DESIGN_KEY, JSON.stringify(design));
      return true;
    } catch {
      showToast('That image is too large to save. Try a smaller image.');
      return false;
    }
  }

  function rarityFromHash() {
    const value = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    return rarities.find((rarity) => rarity.toLowerCase() === value) || null;
  }

  function familyCustom(familyId) {
    design.families[familyId] ||= {};
    design.families[familyId].variants ||= {};
    return design.families[familyId];
  }

  function familyView(family) {
    const custom = design.families[family.id] || {};
    return {
      name:hasOwn(custom,'name') ? custom.name : family.name,
      visible:hasOwn(custom,'visible') ? custom.visible : true
    };
  }

  function variantView(family, variant) {
    const custom = design.families[family.id]?.variants?.[variant.id] || {};
    return {
      name:hasOwn(custom,'name') ? custom.name : variant.name,
      image:hasOwn(custom,'image') ? custom.image : variant.image,
      visible:hasOwn(custom,'visible') ? custom.visible : true
    };
  }

  function variantState(familyId, variantId) {
    state[familyId] ||= {};
    state[familyId][variantId] ||= { collected:false, mastered:false };
    return state[familyId][variantId];
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
  }

  function crownSvg() {
    return '<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M8 40h48l-4-26-12 10L32 8l-8 16-12-10-4 26Z"></path><path d="M12 45h40"></path></svg>';
  }

  function renderText(element, value, editPlaceholder) {
    const text = String(value ?? '');
    element.textContent = text || (editMode ? editPlaceholder : '');
    element.hidden = !text && !editMode;
  }

  function renderHeader() {
    renderText(document.getElementById('heroKicker'), design.header.kicker, '[No kicker]');
    renderText(document.getElementById('heroTitle'), design.header.title, '[No title]');
    renderText(document.getElementById('heroSubtitle'), design.header.subtitle, '[No instructions]');
    renderText(document.getElementById('collectedLabel'), design.header.collectedLabel, '[No label]');
    renderText(document.getElementById('masteredLabel'), design.header.masteredLabel, '[No label]');
    renderText(document.getElementById('footerNote'), design.header.footerNote, '[No footer note]');
    const summary = document.querySelector('.summary');
    summary.hidden = !design.header.showSummary && !editMode;
    summary.classList.toggle('is-hidden-editor', !design.header.showSummary);
    document.title = design.header.title || 'Sprite Checklist';
  }

  function makeCard(family, variant) {
    const current = variantState(family.id, variant.id);
    const view = variantView(family, variant);
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.familyId = family.id;
    card.dataset.variantId = variant.id;
    card.classList.toggle('is-hidden-editor', !view.visible);
    const displayName = view.name || (editMode ? '[No label]' : '');
    const imageMarkup = view.image
      ? `<img src="${view.image}" alt="${escapeHtml(displayName || family.name)} Sprite" loading="lazy" decoding="async">`
      : '';
    card.classList.toggle('image-missing', !view.image);

    card.innerHTML = `
      <button class="edit-chip editor-only edit-variant-btn" type="button">Edit sprite</button>
      <button class="crown-button" type="button" aria-pressed="false">${crownSvg()}</button>
      <div class="image-wrap">
        <button class="image-button" type="button" aria-pressed="false">
          ${imageMarkup}
          <span class="image-fallback">${view.image ? 'Image unavailable' : 'No image'}</span>
          <span class="check-badge" aria-hidden="true">✓</span>
        </button>
      </div>
      <h4${displayName ? '' : ' hidden'}>${escapeHtml(displayName)}</h4>
      <button class="collect-button" type="button" aria-pressed="false"><span class="box" aria-hidden="true"></span><span>${escapeHtml(design.header.collectedLabel || 'Collected')}</span></button>
      <div class="master-label">Tap crown to master</div>`;

    const image = card.querySelector('img');
    image?.addEventListener('error', () => {
      image.hidden = true;
      card.classList.add('image-missing');
    }, { once:true });

    const toggleCollected = () => {
      if (editMode) return openVariantEditor(family.id, variant.id);
      current.collected = !current.collected;
      if (!current.collected) current.mastered = false;
      commitCardChange(card, family, variant, current, current.collected ? 'Collected' : 'Collection removed');
    };

    card.querySelector('.image-button').addEventListener('click', toggleCollected);
    card.querySelector('.collect-button').addEventListener('click', toggleCollected);
    card.querySelector('.crown-button').addEventListener('click', () => {
      if (editMode) return openVariantEditor(family.id, variant.id);
      current.mastered = !current.mastered;
      if (current.mastered) current.collected = true;
      commitCardChange(card, family, variant, current, current.mastered ? 'Mastered' : 'Mastery removed');
    });
    card.querySelector('.edit-variant-btn').addEventListener('click', () => openVariantEditor(family.id, variant.id));

    updateCard(card, current, family, variant);
    return card;
  }

  function updateCard(card, current, family, variant) {
    const view = variantView(family, variant);
    const label = view.name || 'Unnamed';
    const group = familyView(family).name || 'sprite';
    card.classList.toggle('collected', current.collected);
    card.classList.toggle('mastered', current.mastered);
    const collectedAction = `${current.collected ? 'Remove' : 'Mark'} ${label} ${group} ${current.collected ? 'from collected' : 'as collected'}`;
    const masteredAction = `${current.mastered ? 'Remove mastery from' : 'Mark'} ${label} ${group}${current.mastered ? '' : ' as mastered'}`;
    card.querySelector('.image-button').setAttribute('aria-label', collectedAction);
    card.querySelector('.image-button').setAttribute('aria-pressed', String(current.collected));
    card.querySelector('.collect-button').setAttribute('aria-label', collectedAction);
    card.querySelector('.collect-button').setAttribute('aria-pressed', String(current.collected));
    card.querySelector('.crown-button').setAttribute('aria-label', masteredAction);
    card.querySelector('.crown-button').setAttribute('aria-pressed', String(current.mastered));
    card.querySelector('.master-label').textContent = current.mastered ? (design.header.masteredLabel || 'Mastered') : 'Tap crown to master';
  }

  function commitCardChange(card, family, variant, current, message) {
    updateCard(card, current, family, variant);
    saveProgress();
    updateCounters();
    showToast(`${variantView(family,variant).name || family.name}: ${message}`);
  }

  function familyStats(family) {
    const familyInfo = familyView(family);
    if (!familyInfo.visible) return { total:0, collected:0, mastered:0 };
    return family.variants.reduce((totals, variant) => {
      if (!variantView(family,variant).visible) return totals;
      const item = variantState(family.id,variant.id);
      totals.total += 1;
      totals.collected += item.collected ? 1 : 0;
      totals.mastered += item.mastered ? 1 : 0;
      return totals;
    }, { total:0, collected:0, mastered:0 });
  }

  function rarityStats(rarity) {
    return baseData.filter((family) => family.rarity === rarity).reduce((totals, family) => {
      const stats = familyStats(family);
      totals.total += stats.total;
      totals.collected += stats.collected;
      totals.mastered += stats.mastered;
      return totals;
    }, { total:0, collected:0, mastered:0 });
  }

  function overallStats() {
    return rarities.reduce((totals, rarity) => {
      const stats = rarityStats(rarity);
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
    const page = design.pages[activeRarity] || DEFAULT_PAGES[activeRarity];
    renderText(pageEyebrowEl, page.eyebrow, '[No small heading]');
    renderText(pageTitleEl, page.title, '[No page title]');
    renderText(pageDescriptionEl, page.description, '[No description]');
    checklistPage.setAttribute('aria-labelledby', `tab-${activeRarity.toLowerCase()}`);

    baseData.filter((family) => family.rarity === activeRarity).forEach((family) => {
      const familyInfo = familyView(family);
      if (!familyInfo.visible && !editMode) return;
      const stats = familyStats(family);
      const section = document.createElement('section');
      section.className = 'collection';
      section.dataset.rarity = family.rarity;
      section.dataset.familyId = family.id;
      section.classList.toggle('is-hidden-editor', !familyInfo.visible);
      const title = familyInfo.name || (editMode ? '[No group title]' : '');
      section.innerHTML = `
        <div class="collection-tools editor-only"><button class="edit-chip edit-family-btn" type="button">Edit group</button></div>
        <div class="collection-head">
          <h3${title ? '' : ' hidden'}>${escapeHtml(title)}</h3>
          <div class="collection-meta">
            <span class="collection-count">${stats.collected} / ${stats.total} collected</span>
            <span class="row-hint" aria-hidden="true">Swipe variants →</span>
          </div>
        </div>
        <div class="variant-row" aria-label="${escapeHtml(title || 'Sprite')} variants"></div>`;
      section.querySelector('.edit-family-btn').addEventListener('click', () => openFamilyEditor(family.id));
      const row = section.querySelector('.variant-row');
      family.variants.forEach((variant) => {
        const view = variantView(family,variant);
        if (view.visible || editMode) row.appendChild(makeCard(family,variant));
      });
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
      const family = baseData.find((item) => item.id === section.dataset.familyId);
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

  function renderAll() {
    document.body.classList.toggle('edit-mode', editMode);
    document.getElementById('editModeBtn').setAttribute('aria-pressed', String(editMode));
    document.getElementById('editModeBtn').textContent = editMode ? 'Done Editing' : 'Edit Mode';
    renderHeader();
    renderTabs();
    renderCollections();
    updateCounters();
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

  function openHeaderEditor() {
    document.getElementById('editKicker').value = design.header.kicker;
    document.getElementById('editTitle').value = design.header.title;
    document.getElementById('editSubtitle').value = design.header.subtitle;
    document.getElementById('editCollectedLabel').value = design.header.collectedLabel;
    document.getElementById('editMasteredLabel').value = design.header.masteredLabel;
    document.getElementById('editFooterNote').value = design.header.footerNote;
    document.getElementById('editShowSummary').checked = design.header.showSummary;
    document.getElementById('headerEditorDialog').showModal();
  }

  function openPageEditor() {
    const page = design.pages[activeRarity];
    document.getElementById('editPageEyebrow').value = page.eyebrow;
    document.getElementById('editPageTitle').value = page.title;
    document.getElementById('editPageDescription').value = page.description;
    document.getElementById('pageEditorDialog').showModal();
  }

  function openFamilyEditor(familyId) {
    const family = baseData.find((item) => item.id === familyId);
    if (!family) return;
    const view = familyView(family);
    document.getElementById('editFamilyId').value = familyId;
    document.getElementById('editFamilyName').value = view.name;
    document.getElementById('editFamilyVisible').checked = view.visible;
    document.getElementById('familyEditorDialog').showModal();
  }

  function openVariantEditor(familyId, variantId) {
    const family = baseData.find((item) => item.id === familyId);
    const variant = family?.variants.find((item) => item.id === variantId);
    if (!family || !variant) return;
    const view = variantView(family,variant);
    pendingVariantImage = undefined;
    clearPreviewObjectUrl();
    document.getElementById('editVariantFamilyId').value = familyId;
    document.getElementById('editVariantId').value = variantId;
    document.getElementById('editVariantName').value = view.name;
    document.getElementById('editVariantImage').value = '';
    document.getElementById('editVariantVisible').checked = view.visible;
    setVariantPreview(view.image);
    document.getElementById('variantEditorDialog').showModal();
  }

  function setVariantPreview(source) {
    const preview = document.getElementById('variantImagePreview');
    preview.src = source || '';
    preview.alt = source ? 'Sprite image preview' : 'No sprite image selected';
  }

  function clearPreviewObjectUrl() {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }

  async function resizeImage(file, maxSize = 900) {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve,reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
      const scale = Math.min(1,maxSize / Math.max(image.naturalWidth,image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1,Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      return canvas.toDataURL('image/webp',.86);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function exportBackup() {
    const payload = {
      type:'galaxy-sprite-checklist-backup',
      version:1,
      exportedAt:new Date().toISOString(),
      design,
      progress:state
    };
    const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sprite-checklist-backup.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url),0);
  }

  async function importBackup(file) {
    try {
      const payload = JSON.parse(await file.text());
      if (payload.type !== 'galaxy-sprite-checklist-backup' || !payload.design || !payload.progress) throw new Error();
      if (!confirm('Replace the current design and progress with this backup?')) return;
      design = normalizeDesign(payload.design);
      state = payload.progress;
      saveDesign();
      saveProgress();
      renderAll();
      showToast('Backup imported');
    } catch {
      alert('That file is not a valid Sprite Checklist backup.');
    }
  }

  function resetProgress() {
    state = {};
    saveProgress();
    renderCollections();
    updateCounters();
    showToast('All progress reset');
  }

  document.getElementById('editModeBtn').addEventListener('click', () => {
    editMode = !editMode;
    renderAll();
    showToast(editMode ? 'Edit Mode on' : 'Editing finished');
  });
  document.getElementById('editHeaderBtn').addEventListener('click', openHeaderEditor);
  document.getElementById('editPageBtn').addEventListener('click', openPageEditor);

  document.getElementById('headerEditorForm').addEventListener('submit', (event) => {
    event.preventDefault();
    design.header = {
      kicker:document.getElementById('editKicker').value,
      title:document.getElementById('editTitle').value,
      subtitle:document.getElementById('editSubtitle').value,
      collectedLabel:document.getElementById('editCollectedLabel').value,
      masteredLabel:document.getElementById('editMasteredLabel').value,
      footerNote:document.getElementById('editFooterNote').value,
      showSummary:document.getElementById('editShowSummary').checked
    };
    if (!saveDesign()) return;
    document.getElementById('headerEditorDialog').close();
    renderAll();
    showToast('Header updated');
  });

  document.getElementById('pageEditorForm').addEventListener('submit', (event) => {
    event.preventDefault();
    design.pages[activeRarity] = {
      eyebrow:document.getElementById('editPageEyebrow').value,
      title:document.getElementById('editPageTitle').value,
      description:document.getElementById('editPageDescription').value
    };
    if (!saveDesign()) return;
    document.getElementById('pageEditorDialog').close();
    renderAll();
    showToast('Page updated');
  });

  document.getElementById('familyEditorForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const id = document.getElementById('editFamilyId').value;
    const custom = familyCustom(id);
    custom.name = document.getElementById('editFamilyName').value;
    custom.visible = document.getElementById('editFamilyVisible').checked;
    if (!saveDesign()) return;
    document.getElementById('familyEditorDialog').close();
    renderAll();
    showToast('Group updated');
  });

  document.getElementById('editVariantImage').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    previewObjectUrl = URL.createObjectURL(file);
    setVariantPreview(previewObjectUrl);
    try {
      pendingVariantImage = await resizeImage(file);
      setVariantPreview(pendingVariantImage);
      clearPreviewObjectUrl();
    } catch {
      alert('That image could not be read.');
      pendingVariantImage = undefined;
    }
  });

  document.getElementById('removeVariantImageBtn').addEventListener('click', () => {
    pendingVariantImage = '';
    setVariantPreview('');
  });

  document.getElementById('restoreVariantBtn').addEventListener('click', () => {
    const family = baseData.find((item) => item.id === document.getElementById('editVariantFamilyId').value);
    const variant = family?.variants.find((item) => item.id === document.getElementById('editVariantId').value);
    if (!variant) return;
    document.getElementById('editVariantName').value = variant.name;
    document.getElementById('editVariantVisible').checked = true;
    pendingVariantImage = variant.image;
    setVariantPreview(variant.image);
  });

  document.getElementById('variantEditorForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const familyId = document.getElementById('editVariantFamilyId').value;
    const variantId = document.getElementById('editVariantId').value;
    const custom = familyCustom(familyId);
    custom.variants[variantId] ||= {};
    custom.variants[variantId].name = document.getElementById('editVariantName').value;
    custom.variants[variantId].visible = document.getElementById('editVariantVisible').checked;
    if (pendingVariantImage !== undefined) custom.variants[variantId].image = pendingVariantImage;
    if (!saveDesign()) return;
    document.getElementById('variantEditorDialog').close();
    clearPreviewObjectUrl();
    renderAll();
    showToast('Sprite updated');
  });

  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => button.closest('dialog').close());
  });

  document.getElementById('exportBtn').addEventListener('click', exportBackup);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) importBackup(file);
    event.target.value = '';
  });
  document.getElementById('resetDesignBtn').addEventListener('click', () => {
    if (!confirm('Reset all text, images, and visibility changes to the original design? Checklist progress will stay.')) return;
    design = { header:{...DEFAULT_HEADER}, pages:JSON.parse(JSON.stringify(DEFAULT_PAGES)), families:{} };
    saveDesign();
    renderAll();
    showToast('Original design restored');
  });

  checklistPage.addEventListener('touchstart', (event) => {
    if (editMode || event.touches.length !== 1 || event.target.closest('.variant-row,button,a,input')) return;
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

  renderAll();
  switchRarity(activeRarity, { historyMode:'replace' });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
})();
