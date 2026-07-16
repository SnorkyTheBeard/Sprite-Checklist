(() => {
  'use strict';

  const PROGRESS_KEY = 'galaxy_sprite_tracker_progress_v1';
  const DESIGN_KEY = 'galaxy_sprite_tracker_design_v1';
  const REORDER_MIME = 'application/x-sprite-variant-order';
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

  const FONT_OPTIONS = {
    system:{ label:'System / clean', css:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif' },
    rounded:{ label:'Rounded', css:'"Trebuchet MS","Arial Rounded MT Bold",Arial,sans-serif' },
    storybook:{ label:'Storybook serif', css:'Georgia,"Times New Roman",serif' },
    playful:{ label:'Playful', css:'"Comic Sans MS","Trebuchet MS",cursive' },
    bold:{ label:'Bold display', css:'Impact,"Arial Black",sans-serif' },
    mono:{ label:'Monospace', css:'"Courier New",monospace' },
    custom:{ label:'My uploaded font', css:'"UserCustomFont",sans-serif' }
  };

  const DEFAULT_THEME = {
    bodyFont:'system', headingFont:'system', buttonFont:'system', customFontData:'', customFontName:'',
    baseSize:16, titleSize:48, pageTitleSize:34, groupTitleSize:20, spriteLabelSize:16, checklistButtonSize:16, textColor:'#ffffff', mutedColor:'#c8c3e5',
    bodyBgColor:'#080a24', bodyBgImage:'', bodyBgMode:'cover', useBuiltInBodyArt:true, showStars:true,
    headerBgColor:'#21184d', headerBgImage:'', headerBgMode:'cover', headerTextColor:'#ffffff', headerBorderColor:'#564d80', headerRadius:24, headerOpacity:90,
    collectionBgColor:'#f3dfb4', collectionBgImage:'', collectionBgMode:'cover', useBuiltInCollectionArt:true, collectionTextColor:'#2a2144', collectionBorderColor:'#ffe097', collectionRadius:24,
    cardBgColor:'#fffaf0', cardBgImage:'', cardBgMode:'cover', cardTextColor:'#33234e', cardBorderColor:'#bca8cf', cardRadius:20,
    wellBgColor:'#e7ddfa', wellBgImage:'', wellBgMode:'cover', useBuiltInWellArt:true, wellBorderColor:'#b9a8d5',
    tabBgColor:'#14133d', tabActiveColor:'#ffcf55', summaryBgColor:'#302b5c', buttonBgColor:'#ffffff', buttonTextColor:'#33234e', accentColor:'#59c8ff',
    leftArt:'', rightArt:'', artWidth:120,
    pageBackgrounds:Object.fromEntries(rarities.map((rarity) => [rarity,{ enabled:false, color:'#080a24', image:'', mode:'cover' }]))
  };

  let activeRarity = rarityFromHash() || defaultRarity;
  let state = loadJson(PROGRESS_KEY, {});
  let design = loadDesign();
  let editMode = false;
  let toastTimer;
  let touchStart = null;
  let pendingVariantImage;
  let previewObjectUrl;
  let studioDraft;
  let studioOriginal;
  let studioPageRarity;
  let studioCommitted = false;

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
    const storedTheme = stored.theme || {};
    return {
      header:{ ...DEFAULT_HEADER, ...(stored.header || {}) },
      pages:Object.fromEntries(rarities.map((rarity) => [rarity, { ...DEFAULT_PAGES[rarity], ...(stored.pages?.[rarity] || {}) }])),
      families:stored.families && typeof stored.families === 'object' ? stored.families : {},
      customFamilies:Array.isArray(stored.customFamilies) ? stored.customFamilies : [],
      theme:{
        ...DEFAULT_THEME,
        ...storedTheme,
        pageBackgrounds:Object.fromEntries(rarities.map((rarity) => [rarity,{ ...DEFAULT_THEME.pageBackgrounds[rarity], ...(storedTheme.pageBackgrounds?.[rarity] || {}) }]))
      }
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

  function allFamilies() {
    return [...baseData,...design.customFamilies];
  }

  function familyRarity(family) {
    return design.families[family.id]?.rarity || family.rarity;
  }

  function familyView(family) {
    const custom = design.families[family.id] || {};
    return {
      name:hasOwn(custom,'name') ? custom.name : family.name,
      visible:hasOwn(custom,'visible') ? custom.visible : true,
      deleted:Boolean(custom.deleted)
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

  function currentVariantOrder(family) {
    const validIds = family.variants.map((variant) => variant.id);
    const saved = Array.isArray(design.families[family.id]?.order) ? design.families[family.id].order : [];
    return [
      ...saved.filter((id,index) => validIds.includes(id) && saved.indexOf(id) === index),
      ...validIds.filter((id) => !saved.includes(id))
    ];
  }

  function orderedVariants(family) {
    const byId = new Map(family.variants.map((variant) => [variant.id,variant]));
    return currentVariantOrder(family).map((id) => byId.get(id)).filter(Boolean);
  }

  function saveVariantOrder(family, order) {
    familyCustom(family.id).order = order;
    if (!saveDesign()) return false;
    renderAll();
    showToast(`${familyView(family).name || 'Sprite'} order updated`);
    return true;
  }

  function moveVariant(family, variantId, offset) {
    const order = currentVariantOrder(family);
    const from = order.indexOf(variantId);
    const to = Math.max(0,Math.min(order.length - 1,from + offset));
    if (from < 0 || from === to) return;
    order.splice(to,0,...order.splice(from,1));
    saveVariantOrder(family,order);
  }

  function reorderVariant(family, sourceId, targetId, placeAfter) {
    const order = currentVariantOrder(family);
    const from = order.indexOf(sourceId);
    if (from < 0 || !order.includes(targetId) || sourceId === targetId) return;
    order.splice(from,1);
    const targetIndex = order.indexOf(targetId);
    order.splice(targetIndex + (placeAfter ? 1 : 0),0,sourceId);
    saveVariantOrder(family,order);
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

  function imageMode(mode) {
    if (mode === 'contain') return { size:'contain', repeat:'no-repeat' };
    if (mode === 'repeat') return { size:'auto', repeat:'repeat' };
    if (mode === 'stretch') return { size:'100% 100%', repeat:'no-repeat' };
    return { size:'cover', repeat:'no-repeat' };
  }

  function applyImageSurface(root, prefix, image, mode, useBuiltInWhenEmpty = false) {
    const property = `--theme-${prefix}-image`;
    if (image) root.style.setProperty(property, `url("${image}")`);
    else if (useBuiltInWhenEmpty) root.style.removeProperty(property);
    else root.style.setProperty(property,'none');
    const sizing = imageMode(mode);
    root.style.setProperty(`--theme-${prefix}-size`,sizing.size);
    root.style.setProperty(`--theme-${prefix}-repeat`,sizing.repeat);
  }

  function applyTheme() {
    const theme = design.theme || DEFAULT_THEME;
    const root = document.documentElement;
    const customFontStyle = document.getElementById('userCustomFontStyle') || document.head.appendChild(Object.assign(document.createElement('style'),{ id:'userCustomFontStyle' }));
    customFontStyle.textContent = theme.customFontData ? `@font-face{font-family:"UserCustomFont";src:url("${theme.customFontData}");font-display:swap;}` : '';
    root.style.setProperty('--font-body',FONT_OPTIONS[theme.bodyFont]?.css || FONT_OPTIONS.system.css);
    root.style.setProperty('--font-heading',FONT_OPTIONS[theme.headingFont]?.css || FONT_OPTIONS.system.css);
    root.style.setProperty('--font-button',FONT_OPTIONS[theme.buttonFont]?.css || FONT_OPTIONS.system.css);
    root.style.setProperty('--theme-base-size',`${theme.baseSize}px`);
    root.style.setProperty('--theme-title-size',`${theme.titleSize}px`);
    root.style.setProperty('--theme-page-title-size',`${theme.pageTitleSize}px`);
    root.style.setProperty('--theme-group-title-size',`${theme.groupTitleSize}px`);
    root.style.setProperty('--theme-sprite-label-size',`${theme.spriteLabelSize}px`);
    root.style.setProperty('--theme-checklist-button-size',`${theme.checklistButtonSize}px`);
    root.style.setProperty('--theme-text',theme.textColor);
    root.style.setProperty('--theme-muted',theme.mutedColor);
    root.style.setProperty('--theme-body-bg',theme.bodyBgColor);
    root.style.setProperty('--theme-header-bg',theme.headerBgColor);
    root.style.setProperty('--theme-header-text',theme.headerTextColor);
    root.style.setProperty('--theme-header-border',theme.headerBorderColor);
    root.style.setProperty('--theme-header-radius',`${theme.headerRadius}px`);
    root.style.setProperty('--theme-header-opacity',`${theme.headerOpacity}%`);
    root.style.setProperty('--theme-collection-bg',theme.collectionBgColor);
    root.style.setProperty('--theme-collection-text',theme.collectionTextColor);
    root.style.setProperty('--theme-collection-border',theme.collectionBorderColor);
    root.style.setProperty('--theme-collection-radius',`${theme.collectionRadius}px`);
    root.style.setProperty('--theme-card-bg',theme.cardBgColor);
    root.style.setProperty('--theme-card-text',theme.cardTextColor);
    root.style.setProperty('--theme-card-border',theme.cardBorderColor);
    root.style.setProperty('--theme-card-radius',`${theme.cardRadius}px`);
    root.style.setProperty('--theme-well-bg',theme.wellBgColor);
    root.style.setProperty('--theme-well-border',theme.wellBorderColor);
    root.style.setProperty('--theme-tab-bg',theme.tabBgColor);
    root.style.setProperty('--theme-tab-active',theme.tabActiveColor);
    root.style.setProperty('--theme-summary-bg',theme.summaryBgColor);
    root.style.setProperty('--theme-button-bg',theme.buttonBgColor);
    root.style.setProperty('--theme-button-text',theme.buttonTextColor);
    root.style.setProperty('--theme-accent',theme.accentColor);
    root.style.setProperty('--theme-art-width',`${theme.artWidth}px`);
    applyImageSurface(root,'body',theme.bodyBgImage,theme.bodyBgMode,theme.useBuiltInBodyArt);
    applyImageSurface(root,'header',theme.headerBgImage,theme.headerBgMode);
    applyImageSurface(root,'collection',theme.collectionBgImage,theme.collectionBgMode,theme.useBuiltInCollectionArt);
    applyImageSurface(root,'card',theme.cardBgImage,theme.cardBgMode);
    applyImageSurface(root,'well',theme.wellBgImage,theme.wellBgMode,theme.useBuiltInWellArt);
    const pageTheme = theme.pageBackgrounds?.[activeRarity] || DEFAULT_THEME.pageBackgrounds[activeRarity];
    root.style.setProperty('--theme-page-bg',pageTheme.enabled ? pageTheme.color : 'transparent');
    applyImageSurface(root,'page',pageTheme.enabled ? pageTheme.image : '',pageTheme.mode);
    document.body.classList.toggle('hide-stars',!theme.showStars);
    const leftArt = document.getElementById('leftCustomArt');
    const rightArt = document.getElementById('rightCustomArt');
    leftArt.src = theme.leftArt || '';
    rightArt.src = theme.rightArt || '';
    leftArt.hidden = !theme.leftArt;
    rightArt.hidden = !theme.rightArt;
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

    const order = currentVariantOrder(family);
    const orderIndex = order.indexOf(variant.id);
    card.innerHTML = `
      <button class="edit-chip editor-only edit-variant-btn" type="button">Edit sprite</button>
      <button class="crown-button" type="button" aria-pressed="false">${crownSvg()}</button>
      <div class="image-wrap">
        <button class="image-button" type="button" aria-pressed="false">
          ${imageMarkup}
          <span class="image-fallback">${view.image ? 'Image unavailable' : 'No image'}</span>
          <span class="check-badge" aria-hidden="true">✓</span>
        </button>
        <span class="drop-hint editor-only" aria-hidden="true">Drop image here</span>
      </div>
      <div class="variant-move-tools editor-only" aria-label="Reorder ${escapeHtml(displayName || 'sprite')} box">
        <button class="move-step move-left-btn" type="button" aria-label="Move ${escapeHtml(displayName || 'sprite')} left"${orderIndex === 0 ? ' disabled' : ''}>←</button>
        <button class="move-handle" type="button" draggable="true" aria-label="Drag ${escapeHtml(displayName || 'sprite')} to reorder">Move</button>
        <button class="move-step move-right-btn" type="button" aria-label="Move ${escapeHtml(displayName || 'sprite')} right"${orderIndex === order.length - 1 ? ' disabled' : ''}>→</button>
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
    card.querySelector('.move-left-btn').addEventListener('click', () => moveVariant(family,variant.id,-1));
    card.querySelector('.move-right-btn').addEventListener('click', () => moveVariant(family,variant.id,1));

    const moveHandle = card.querySelector('.move-handle');
    moveHandle.addEventListener('dragstart', (event) => {
      if (!editMode) return event.preventDefault();
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(REORDER_MIME,JSON.stringify({ familyId:family.id, variantId:variant.id }));
      card.classList.add('is-reordering');
    });
    moveHandle.addEventListener('dragend', () => {
      document.querySelectorAll('.card').forEach((item) => item.classList.remove('is-reordering','reorder-before','reorder-after'));
    });
    card.addEventListener('dragover', (event) => {
      if (!editMode || ![...event.dataTransfer.types].includes(REORDER_MIME)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const placeAfter = event.clientX > card.getBoundingClientRect().left + card.offsetWidth / 2;
      card.classList.toggle('reorder-before',!placeAfter);
      card.classList.toggle('reorder-after',placeAfter);
    });
    card.addEventListener('dragleave', (event) => {
      if (!card.contains(event.relatedTarget)) card.classList.remove('reorder-before','reorder-after');
    });
    card.addEventListener('drop', (event) => {
      if (!editMode || ![...event.dataTransfer.types].includes(REORDER_MIME)) return;
      event.preventDefault();
      card.classList.remove('reorder-before','reorder-after');
      try {
        const source = JSON.parse(event.dataTransfer.getData(REORDER_MIME));
        if (source.familyId !== family.id) return showToast('Boxes can only move within their own row.');
        const placeAfter = event.clientX > card.getBoundingClientRect().left + card.offsetWidth / 2;
        reorderVariant(family,source.variantId,variant.id,placeAfter);
      } catch {
        showToast('That box could not be moved.');
      }
    });

    const imageWrap = card.querySelector('.image-wrap');
    imageWrap.addEventListener('dragenter', (event) => {
      if (!editMode || !hasDroppedImage(event.dataTransfer)) return;
      event.preventDefault();
      imageWrap.classList.add('drop-ready');
    });
    imageWrap.addEventListener('dragover', (event) => {
      if (!editMode || !hasDroppedImage(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      imageWrap.classList.add('drop-ready');
    });
    imageWrap.addEventListener('dragleave', (event) => {
      if (!imageWrap.contains(event.relatedTarget)) imageWrap.classList.remove('drop-ready');
    });
    imageWrap.addEventListener('drop', async (event) => {
      if (!editMode) return;
      event.preventDefault();
      event.stopPropagation();
      imageWrap.classList.remove('drop-ready');
      imageWrap.classList.add('drop-saving');
      try {
        const file = await droppedImageFile(event.dataTransfer);
        if (!file) throw new Error('no-image');
        await applyDroppedSpriteImage(family.id,variant.id,file);
      } catch {
        imageWrap.classList.remove('drop-saving');
        showToast('Drop an image file such as PNG, JPG, or WebP.');
      }
    });

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
    return allFamilies().filter((family) => familyRarity(family) === rarity && !familyView(family).deleted).reduce((totals, family) => {
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
    applyTheme();
    collectionsEl.innerHTML = '';
    const page = design.pages[activeRarity] || DEFAULT_PAGES[activeRarity];
    renderText(pageEyebrowEl, page.eyebrow, '[No small heading]');
    renderText(pageTitleEl, page.title, '[No page title]');
    renderText(pageDescriptionEl, page.description, '[No description]');
    checklistPage.setAttribute('aria-labelledby', `tab-${activeRarity.toLowerCase()}`);

    allFamilies().filter((family) => familyRarity(family) === activeRarity && !familyView(family).deleted).forEach((family) => {
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
      orderedVariants(family).forEach((variant) => {
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
      const family = allFamilies().find((item) => item.id === section.dataset.familyId);
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
    applyTheme();
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

  const STUDIO_FIELD_MAP = {
    themeBodyFont:'bodyFont', themeHeadingFont:'headingFont', themeButtonFont:'buttonFont',
    themeBaseSize:'baseSize', themeTitleSize:'titleSize', themePageTitleSize:'pageTitleSize', themeGroupTitleSize:'groupTitleSize', themeSpriteLabelSize:'spriteLabelSize', themeChecklistButtonSize:'checklistButtonSize', themeTextColor:'textColor', themeMutedColor:'mutedColor',
    themeBodyBgColor:'bodyBgColor', themeBodyBgMode:'bodyBgMode', themeUseBuiltInBodyArt:'useBuiltInBodyArt', themeShowStars:'showStars',
    themeHeaderBgColor:'headerBgColor', themeHeaderTextColor:'headerTextColor', themeHeaderBorderColor:'headerBorderColor', themeHeaderRadius:'headerRadius', themeHeaderOpacity:'headerOpacity', themeHeaderBgMode:'headerBgMode',
    themeCollectionBgColor:'collectionBgColor', themeCollectionTextColor:'collectionTextColor', themeCollectionBorderColor:'collectionBorderColor', themeCollectionRadius:'collectionRadius', themeCollectionBgMode:'collectionBgMode', themeUseBuiltInCollectionArt:'useBuiltInCollectionArt',
    themeCardBgColor:'cardBgColor', themeCardTextColor:'cardTextColor', themeCardBorderColor:'cardBorderColor', themeCardRadius:'cardRadius', themeCardBgMode:'cardBgMode',
    themeWellBgColor:'wellBgColor', themeWellBorderColor:'wellBorderColor', themeWellBgMode:'wellBgMode', themeUseBuiltInWellArt:'useBuiltInWellArt',
    themeTabBgColor:'tabBgColor', themeTabActiveColor:'tabActiveColor', themeSummaryBgColor:'summaryBgColor', themeButtonBgColor:'buttonBgColor', themeButtonTextColor:'buttonTextColor', themeAccentColor:'accentColor',
    themeArtWidth:'artWidth'
  };

  const STUDIO_IMAGE_INPUTS = {
    themeBodyBgFile:'bodyBgImage', themeHeaderBgFile:'headerBgImage', themeCollectionBgFile:'collectionBgImage',
    themeCardBgFile:'cardBgImage', themeWellBgFile:'wellBgImage', themeLeftArtFile:'leftArt', themeRightArtFile:'rightArt'
  };

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function populateFontSelects() {
    document.querySelectorAll('[data-font-select]').forEach((select) => {
      select.innerHTML = '';
      Object.entries(FONT_OPTIONS).forEach(([value,option]) => {
        const element = document.createElement('option');
        element.value = value;
        element.textContent = option.label;
        select.appendChild(element);
      });
    });
  }

  function updateStudioOutputs() {
    const outputs = {
      themeBaseSizeOutput:`${document.getElementById('themeBaseSize').value}px`,
      themeTitleSizeOutput:`${document.getElementById('themeTitleSize').value}px`,
      themePageTitleSizeOutput:`${document.getElementById('themePageTitleSize').value}px`,
      themeGroupTitleSizeOutput:`${document.getElementById('themeGroupTitleSize').value}px`,
      themeSpriteLabelSizeOutput:`${document.getElementById('themeSpriteLabelSize').value}px`,
      themeChecklistButtonSizeOutput:`${document.getElementById('themeChecklistButtonSize').value}px`,
      themeHeaderRadiusOutput:`${document.getElementById('themeHeaderRadius').value}px`,
      themeHeaderOpacityOutput:`${document.getElementById('themeHeaderOpacity').value}%`,
      themeCollectionRadiusOutput:`${document.getElementById('themeCollectionRadius').value}px`,
      themeCardRadiusOutput:`${document.getElementById('themeCardRadius').value}px`,
      themeArtWidthOutput:`${document.getElementById('themeArtWidth').value}px`
    };
    Object.entries(outputs).forEach(([id,value]) => { document.getElementById(id).textContent = value; });
  }

  function fillStudioFields() {
    Object.entries(STUDIO_FIELD_MAP).forEach(([id,key]) => {
      const field = document.getElementById(id);
      if (field.type === 'checkbox') field.checked = Boolean(studioDraft[key]);
      else field.value = studioDraft[key];
    });
    const page = studioDraft.pageBackgrounds[studioPageRarity];
    document.getElementById('themePageBgEnabled').checked = page.enabled;
    document.getElementById('themePageBgColor').value = page.color;
    document.getElementById('themePageBgMode').value = page.mode;
    Object.keys(STUDIO_IMAGE_INPUTS).forEach((id) => { document.getElementById(id).value = ''; });
    document.getElementById('themePageBgFile').value = '';
    document.getElementById('themeCustomFontFile').value = '';
    updateStudioOutputs();
  }

  function previewStudioDraft() {
    design.theme = studioDraft;
    applyTheme();
    updateStudioOutputs();
  }

  function openDesignStudio() {
    studioPageRarity = activeRarity;
    studioOriginal = cloneJson(design.theme);
    studioDraft = cloneJson(design.theme);
    studioCommitted = false;
    fillStudioFields();
    document.getElementById('designStudioDialog').showModal();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
    const family = allFamilies().find((item) => item.id === familyId);
    if (!family) return;
    const view = familyView(family);
    document.getElementById('editFamilyId').value = familyId;
    document.getElementById('editFamilyName').value = view.name;
    document.getElementById('editFamilyRarity').value = familyRarity(family);
    document.getElementById('editFamilyVisible').checked = view.visible;
    document.getElementById('familyEditorDialog').showModal();
  }

  function openVariantEditor(familyId, variantId) {
    const family = allFamilies().find((item) => item.id === familyId);
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

  function isImageFile(file) {
    return Boolean(file && (file.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(file.name || '')));
  }

  function hasDroppedImage(dataTransfer) {
    if (!dataTransfer) return false;
    if ([...dataTransfer.files].some(isImageFile)) return true;
    if ([...dataTransfer.items].some((item) => item.kind === 'file' && item.type.startsWith('image/'))) return true;
    return [...dataTransfer.types].some((type) => ['text/uri-list','text/html'].includes(type));
  }

  async function droppedImageFile(dataTransfer) {
    const direct = [...dataTransfer.files].find(isImageFile) || [...dataTransfer.items].map((item) => item.kind === 'file' ? item.getAsFile() : null).find(isImageFile);
    if (direct) return direct;

    let source = dataTransfer.getData('text/uri-list').split('\n').find((line) => line && !line.startsWith('#')) || '';
    if (!source) {
      const html = dataTransfer.getData('text/html');
      if (html) source = new DOMParser().parseFromString(html,'text/html').querySelector('img')?.src || '';
    }
    if (!/^(data:image\/|blob:|https?:\/\/)/i.test(source)) return null;
    const response = await fetch(source);
    if (!response.ok) return null;
    const blob = await response.blob();
    return blob.type.startsWith('image/') ? blob : null;
  }

  async function applyDroppedSpriteImage(familyId,variantId,file) {
    const image = await resizeImage(file,900);
    const custom = familyCustom(familyId);
    custom.variants[variantId] ||= {};
    custom.variants[variantId].image = image;
    if (!saveDesign()) throw new Error('save-failed');
    renderAll();
    showToast('Sprite image replaced');
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
  document.getElementById('designStudioBtn').addEventListener('click', openDesignStudio);
  document.getElementById('addFamilyBtn').addEventListener('click', () => {
    document.getElementById('newFamilyName').value = '';
    document.getElementById('newFamilyRarity').value = activeRarity;
    document.getElementById('newFamilyVariants').value = 'Base, Gold, Gummy, Galaxy, Cube, Gem, Quack';
    document.getElementById('addFamilyDialog').showModal();
  });

  Object.entries(STUDIO_FIELD_MAP).forEach(([id,key]) => {
    document.getElementById(id).addEventListener('input', (event) => {
      if (!studioDraft) return;
      const field = event.currentTarget;
      studioDraft[key] = field.type === 'checkbox' ? field.checked : (field.type === 'range' ? Number(field.value) : field.value);
      previewStudioDraft();
    });
  });

  ['themePageBgEnabled','themePageBgColor','themePageBgMode'].forEach((id) => {
    document.getElementById(id).addEventListener('input', (event) => {
      if (!studioDraft) return;
      const page = studioDraft.pageBackgrounds[studioPageRarity];
      if (id === 'themePageBgEnabled') page.enabled = event.currentTarget.checked;
      if (id === 'themePageBgColor') page.color = event.currentTarget.value;
      if (id === 'themePageBgMode') page.mode = event.currentTarget.value;
      previewStudioDraft();
    });
  });

  Object.entries(STUDIO_IMAGE_INPUTS).forEach(([id,key]) => {
    document.getElementById(id).addEventListener('change', async (event) => {
      const file = event.currentTarget.files?.[0];
      if (!file || !studioDraft) return;
      try {
        studioDraft[key] = await resizeImage(file,1800);
        previewStudioDraft();
        showToast('Artwork loaded');
      } catch {
        alert('That artwork could not be read.');
      }
    });
  });

  document.getElementById('themePageBgFile').addEventListener('change', async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file || !studioDraft) return;
    try {
      const page = studioDraft.pageBackgrounds[studioPageRarity];
      page.image = await resizeImage(file,1800);
      page.enabled = true;
      document.getElementById('themePageBgEnabled').checked = true;
      previewStudioDraft();
      showToast('Page artwork loaded');
    } catch {
      alert('That page artwork could not be read.');
    }
  });

  document.querySelectorAll('[data-remove-theme-image]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!studioDraft) return;
      studioDraft[button.dataset.removeThemeImage] = '';
      previewStudioDraft();
      showToast('Artwork removed');
    });
  });

  document.getElementById('removePageBgBtn').addEventListener('click', () => {
    if (!studioDraft) return;
    studioDraft.pageBackgrounds[studioPageRarity].image = '';
    previewStudioDraft();
    showToast('Page artwork removed');
  });

  document.getElementById('themeCustomFontFile').addEventListener('change', async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file || !studioDraft) return;
    if (file.size > 1800000) {
      alert('That font is too large. Use a WOFF or WOFF2 font under 1.8 MB.');
      return;
    }
    try {
      studioDraft.customFontData = await readFileAsDataUrl(file);
      studioDraft.customFontName = file.name;
      studioDraft.bodyFont = 'custom';
      studioDraft.headingFont = 'custom';
      studioDraft.buttonFont = 'custom';
      fillStudioFields();
      previewStudioDraft();
      showToast('Custom font loaded');
    } catch {
      alert('That font could not be read.');
    }
  });

  document.getElementById('removeCustomFontBtn').addEventListener('click', () => {
    if (!studioDraft) return;
    studioDraft.customFontData = '';
    studioDraft.customFontName = '';
    ['bodyFont','headingFont','buttonFont'].forEach((key) => { if (studioDraft[key] === 'custom') studioDraft[key] = 'system'; });
    fillStudioFields();
    previewStudioDraft();
    showToast('Custom font removed');
  });

  document.getElementById('designStudioForm').addEventListener('submit', (event) => {
    event.preventDefault();
    design.theme = studioDraft;
    if (!saveDesign()) return;
    studioCommitted = true;
    document.getElementById('designStudioDialog').close();
    renderAll();
    showToast('Design applied');
  });

  document.getElementById('designStudioDialog').addEventListener('close', () => {
    if (!studioCommitted && studioOriginal) {
      design.theme = studioOriginal;
      applyTheme();
    }
    studioDraft = null;
    studioOriginal = null;
  });

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
    custom.rarity = document.getElementById('editFamilyRarity').value;
    custom.visible = document.getElementById('editFamilyVisible').checked;
    if (!saveDesign()) return;
    document.getElementById('familyEditorDialog').close();
    renderAll();
    showToast('Group updated');
  });

  document.getElementById('deleteFamilyBtn').addEventListener('click', () => {
    const id = document.getElementById('editFamilyId').value;
    const family = allFamilies().find((item) => item.id === id);
    if (!family || !confirm(`Delete the entire ${familyView(family).name || 'sprite'} group? Built-in groups can be restored by resetting the design.`)) return;
    const customIndex = design.customFamilies.findIndex((item) => item.id === id);
    if (customIndex >= 0) design.customFamilies.splice(customIndex,1);
    else familyCustom(id).deleted = true;
    delete state[id];
    if (!saveDesign()) return;
    saveProgress();
    document.getElementById('familyEditorDialog').close();
    renderAll();
    showToast('Group deleted');
  });

  document.getElementById('addFamilyForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('newFamilyName').value.trim();
    const names = document.getElementById('newFamilyVariants').value.split(',').map((item) => item.trim()).filter(Boolean);
    if (!name || !names.length) return alert('Enter a group title and at least one sprite box.');
    const idBase = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'custom-group';
    let id = `custom-${idBase}`;
    let suffix = 2;
    while (allFamilies().some((family) => family.id === id)) id = `custom-${idBase}-${suffix++}`;
    const used = new Set();
    const variants = names.map((variantName,index) => {
      let variantId = variantName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || `sprite-${index + 1}`;
      const baseId = variantId;
      let variantSuffix = 2;
      while (used.has(variantId)) variantId = `${baseId}-${variantSuffix++}`;
      used.add(variantId);
      return { id:variantId, name:variantName, image:'' };
    });
    const rarity = document.getElementById('newFamilyRarity').value;
    design.customFamilies.push({ id, name, rarity, variants });
    if (!saveDesign()) return;
    activeRarity = rarity;
    document.getElementById('addFamilyDialog').close();
    renderAll();
    showToast(`${name} group added`);
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
    const family = allFamilies().find((item) => item.id === document.getElementById('editVariantFamilyId').value);
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
    design = normalizeDesign({});
    saveDesign();
    renderAll();
    showToast('Original design restored');
  });

  checklistPage.addEventListener('touchstart', (event) => {
    if (editMode || event.touches.length !== 1 || event.target.closest('.variant-row,button,a,input')) return;
    const touch = event.touches[0];
    touchStart = { x:touch.clientX, y:touch.clientY };
  }, { passive:true });

  window.addEventListener('dragover', (event) => {
    if (editMode && hasDroppedImage(event.dataTransfer) && !event.target.closest?.('input[type="file"]')) event.preventDefault();
  });

  window.addEventListener('drop', (event) => {
    if (!editMode || !hasDroppedImage(event.dataTransfer) || event.target.closest?.('input[type="file"]')) return;
    event.preventDefault();
    showToast('Drop the image directly onto a sprite box.');
  });

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

  populateFontSelects();
  renderAll();
  switchRarity(activeRarity, { historyMode:'replace' });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
})();
