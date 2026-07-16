(() => {
  'use strict';

  const PROGRESS_KEY = 'galaxy_sprite_tracker_progress_v1';
  const DESIGN_KEY = 'galaxy_sprite_tracker_design_v1';
  const OWNER_UNLOCK_KEY = 'galaxy_sprite_tracker_owner_unlocked_v1';
  const CLOUD_SYNC_KEY = 'galaxy_sprite_tracker_cloud_sync_v1';
  const OWNER_KEY_HASH = '1b5b7aba986560cfabe2c05862867822f83970debec9b8bd17afa1e52f779caa';
  const REORDER_MIME = 'application/x-sprite-variant-order';
  const baseData = Array.isArray(window.SPRITE_DATA) ? window.SPRITE_DATA : [];
  const rarities = ['Rare','Epic','Legendary','Mythic'].filter((rarity) => baseData.some((family) => family.rarity === rarity));
  const defaultRarity = rarities[0] || 'Rare';

  const DEFAULT_SUMMARY_POSITIONS = {
    mode:'flow',
    collected:{ x:28, y:72 },
    mastered:{ x:72, y:72 }
  };

  const DEFAULT_HEADER = {
    kicker:'Fortnite Collection Tracker',
    title:'Galaxy Sprite Checklist',
    subtitle:'Tap a sprite to mark it collected. Tap its crown when it is mastered.',
    collectedLabel:'Collected',
    masteredLabel:'Mastered',
    masterPrompt:'Tap crown to master',
    footerNote:'Progress is saved on this device.',
    showSummary:true,
    summaryPositions:DEFAULT_SUMMARY_POSITIONS
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
    playful:{ label:'Playful', css:'"Sprite Playful","Trebuchet MS",cursive' },
    bold:{ label:'Bold display', css:'Impact,"Arial Black",sans-serif' },
    mono:{ label:'Monospace', css:'"Courier New",monospace' },
    custom:{ label:'My uploaded font', css:'"UserCustomFont",sans-serif' }
  };

  const DEFAULT_THEME = {
    bodyFont:'system', headingFont:'system', buttonFont:'system', customFontData:'', customFontName:'',
    baseSize:16, titleSize:48, pageTitleSize:34, groupTitleSize:20, spriteLabelSize:16, checklistButtonSize:16, textColor:'#ffffff', mutedColor:'#c8c3e5',
    bodyBgColor:'#080a24', bodyBgImage:'', bodyBgMode:'cover', useBuiltInBodyArt:true, showStars:true,
    headerBgColor:'#21184d', headerBgImage:'', headerBgMode:'cover', headerTextColor:'#ffffff', headerBorderColor:'#564d80', headerRadius:24, headerOpacity:90, headerHeight:0,
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
  let cloudSyncSettings = { owner:'SnorkyTheBeard', repo:'Sprite-Checklist', branch:'main', path:'published-design.js', token:'', enabled:false, ...loadJson(CLOUD_SYNC_KEY,{}) };
  let editMode = false;
  let ownerUnlocked = false;
  let toastTimer;
  let touchStart = null;
  let pendingVariantImage;
  let pendingVariantCardImage;
  let pendingFamilyBgImage;
  let pendingPageBgImage;
  let pendingHeaderBgImage;
  let publishedDesignFile;
  let publishedDesignContents = '';
  let publishedDesignUrl;
  let previewObjectUrl;
  let studioDraft;
  let studioOriginal;
  let studioPageRarity;
  let studioCommitted = false;
  let cloudSyncTimer;
  let cloudSyncInFlight = false;
  let cloudSyncQueued = false;
  let lastPublicDesignCheck = 0;
  let summaryDrag = null;

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
  const spriteSearchForm = document.getElementById('spriteSearchForm');
  const spriteSearchInput = document.getElementById('spriteSearchInput');
  const spriteSearchResults = document.getElementById('spriteSearchResults');
  const spriteSearchStatus = document.getElementById('spriteSearchStatus');
  const clearSpriteSearchBtn = document.getElementById('clearSpriteSearchBtn');
  const cloudSyncBtn = document.getElementById('cloudSyncBtn');
  const cloudSyncStatus = document.getElementById('cloudSyncStatus');
  const cloudSyncDialogStatus = document.getElementById('cloudSyncDialogStatus');

  try { ownerUnlocked = localStorage.getItem(OWNER_UNLOCK_KEY) === 'yes'; } catch {}

  function loadJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum,Math.min(maximum,value));
  }

  function normalizeSummaryPositions(stored = {}) {
    const point = (value, fallback) => ({
      x:clamp(Number.isFinite(Number(value?.x)) ? Number(value.x) : fallback.x,0,100),
      y:clamp(Number.isFinite(Number(value?.y)) ? Number(value.y) : fallback.y,0,100)
    });
    return {
      mode:stored?.mode === 'free' ? 'free' : 'flow',
      collected:point(stored?.collected,DEFAULT_SUMMARY_POSITIONS.collected),
      mastered:point(stored?.mastered,DEFAULT_SUMMARY_POSITIONS.mastered)
    };
  }

  function normalizeDesign(stored = {}) {
    const storedTheme = stored.theme || {};
    const storedHeader = stored.header || {};
    return {
      _meta:stored._meta && typeof stored._meta === 'object' ? { ...stored._meta } : {},
      header:{ ...DEFAULT_HEADER, ...storedHeader, summaryPositions:normalizeSummaryPositions(storedHeader.summaryPositions) },
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
    const saved = loadJson(DESIGN_KEY, null);
    const published = window.PUBLISHED_DESIGN && typeof window.PUBLISHED_DESIGN === 'object' ? window.PUBLISHED_DESIGN : null;
    if (!saved) return normalizeDesign(published || {});
    if (!published || !Object.keys(published).length) return normalizeDesign(saved);
    const localUpdatedAt = Number(saved._meta?.localUpdatedAt || 0);
    const publishedAt = Number(published._meta?.publishedAt || 0);
    if (!saved._meta || publishedAt > localUpdatedAt) return normalizeDesign(published);
    return normalizeDesign(saved);
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object,key);
  }

  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(state)); }
    catch { showToast('Progress could not be saved on this device.'); }
  }

  async function hashOwnerKey(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2,'0')).join('');
  }

  function updateOwnerUi() {
    document.getElementById('editModeBtn').hidden = !ownerUnlocked;
    document.getElementById('ownerAccessBtn').hidden = ownerUnlocked;
    if (!ownerUnlocked && editMode) editMode = false;
    updateCloudSyncUi();
  }

  function saveDesign() {
    try {
      design._meta ||= {};
      design._meta.localUpdatedAt = Date.now();
      localStorage.setItem(DESIGN_KEY, JSON.stringify(design));
      scheduleCloudSync();
      return true;
    } catch {
      showSaveFailure('This design could not be saved because the browser is out of storage. Remove an unused image or try a smaller one.');
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
      deleted:Boolean(custom.deleted),
      customBg:Boolean(custom.customBg),
      bgColor:custom.bgColor || design.theme.collectionBgColor,
      bgImage:hasOwn(custom,'bgImage') ? custom.bgImage : '',
      bgMode:custom.bgMode || 'cover'
    };
  }

  function variantView(family, variant) {
    const custom = design.families[family.id]?.variants?.[variant.id] || {};
    return {
      name:hasOwn(custom,'name') ? custom.name : variant.name,
      image:hasOwn(custom,'image') ? custom.image : variant.image,
      visible:hasOwn(custom,'visible') ? custom.visible : true,
      deleted:Boolean(custom.deleted),
      customCard:Boolean(custom.customCard),
      cardColor:custom.cardColor || design.theme.cardBgColor,
      cardImage:hasOwn(custom,'cardImage') ? custom.cardImage : '',
      cardMode:custom.cardMode || 'cover'
    };
  }

  function familyVariants(family) {
    const added = Array.isArray(design.families[family.id]?.addedVariants) ? design.families[family.id].addedVariants : [];
    return [...family.variants,...added].filter((variant) => !variantView(family,variant).deleted);
  }

  function currentVariantOrder(family) {
    const validIds = familyVariants(family).map((variant) => variant.id);
    const saved = Array.isArray(design.families[family.id]?.order) ? design.families[family.id].order : [];
    return [
      ...saved.filter((id,index) => validIds.includes(id) && saved.indexOf(id) === index),
      ...validIds.filter((id) => !saved.includes(id))
    ];
  }

  function orderedVariants(family) {
    const byId = new Map(familyVariants(family).map((variant) => [variant.id,variant]));
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

  function colorWithOpacity(color,percentage) {
    const value = String(color || '').trim();
    const short = value.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    const full = value.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    const parts = full ? full.slice(1) : (short ? short.slice(1).map((part) => part + part) : null);
    if (!parts) return value;
    const [red,green,blue] = parts.map((part) => parseInt(part,16));
    return `rgba(${red},${green},${blue},${Math.max(0,Math.min(100,Number(percentage))) / 100})`;
  }

  function applyCustomBackground(element, color, image, mode) {
    element.style.backgroundColor = color;
    element.style.backgroundImage = image ? `url("${image}")` : 'none';
    const sizing = imageMode(mode);
    element.style.backgroundSize = sizing.size;
    element.style.backgroundRepeat = sizing.repeat;
    element.style.backgroundPosition = 'center';
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
    root.style.setProperty('--theme-header-surface',colorWithOpacity(theme.headerBgColor,theme.headerOpacity));
    root.style.setProperty('--theme-header-text',theme.headerTextColor);
    root.style.setProperty('--theme-header-border',theme.headerBorderColor);
    root.style.setProperty('--theme-header-radius',`${theme.headerRadius}px`);
    root.style.setProperty('--theme-header-opacity',`${theme.headerOpacity}%`);
    root.style.setProperty('--theme-header-height',`${theme.headerHeight}px`);
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
    applySummaryPositions();
    document.querySelector('[data-summary-box="collected"] .summary-move-handle').setAttribute('aria-label',`Move ${design.header.collectedLabel || 'collected'} box`);
    document.querySelector('[data-summary-box="mastered"] .summary-move-handle').setAttribute('aria-label',`Move ${design.header.masteredLabel || 'mastered'} box`);
    document.title = design.header.title || 'Sprite Checklist';
  }

  function summaryBox(key) {
    return document.querySelector(`[data-summary-box="${key}"]`);
  }

  function setSummaryBoxPoint(key, point) {
    const box = summaryBox(key);
    if (!box) return;
    box.style.setProperty('--summary-x',`${point.x}%`);
    box.style.setProperty('--summary-y',`${point.y}%`);
  }

  function boundedSummaryPoint(key, x, y) {
    const hero = document.getElementById('hero');
    const box = summaryBox(key);
    const heroRect = hero.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    if (!heroRect.width || !heroRect.height) return { x:clamp(x,0,100), y:clamp(y,0,100) };
    const halfWidth = Math.min(49,(boxRect.width / 2 + 10) / heroRect.width * 100);
    const halfHeight = Math.min(49,(boxRect.height / 2 + 10) / heroRect.height * 100);
    return {
      x:clamp(x,halfWidth,100 - halfWidth),
      y:clamp(y,halfHeight,100 - halfHeight)
    };
  }

  function applySummaryPositions() {
    const hero = document.getElementById('hero');
    const positions = normalizeSummaryPositions(design.header.summaryPositions);
    design.header.summaryPositions = positions;
    const free = positions.mode === 'free' && (design.header.showSummary || editMode);
    hero.classList.toggle('summary-free-positioning',free);
    ['collected','mastered'].forEach((key) => {
      const box = summaryBox(key);
      if (!free) {
        box.style.removeProperty('--summary-x');
        box.style.removeProperty('--summary-y');
        return;
      }
      setSummaryBoxPoint(key,positions[key]);
    });
    if (!free) return;
    requestAnimationFrame(() => {
      ['collected','mastered'].forEach((key) => setSummaryBoxPoint(key,boundedSummaryPoint(key,positions[key].x,positions[key].y)));
    });
  }

  function activateSummaryFreePositioning() {
    if (design.header.summaryPositions?.mode === 'free') return;
    const hero = document.getElementById('hero');
    const heroRect = hero.getBoundingClientRect();
    const centers = Object.fromEntries(['collected','mastered'].map((key) => {
      const rect = summaryBox(key).getBoundingClientRect();
      return [key,{ x:rect.left + rect.width / 2, y:rect.top + rect.height / 2 }];
    }));
    design.header.summaryPositions = normalizeSummaryPositions({
      mode:'free',
      collected:{ x:(centers.collected.x - heroRect.left) / heroRect.width * 100, y:(centers.collected.y - heroRect.top) / heroRect.height * 100 },
      mastered:{ x:(centers.mastered.x - heroRect.left) / heroRect.width * 100, y:(centers.mastered.y - heroRect.top) / heroRect.height * 100 }
    });
    applySummaryPositions();
    const resizedHeroRect = hero.getBoundingClientRect();
    ['collected','mastered'].forEach((key) => {
      const point = boundedSummaryPoint(
        key,
        (centers[key].x - resizedHeroRect.left) / resizedHeroRect.width * 100,
        (centers[key].y - resizedHeroRect.top) / resizedHeroRect.height * 100
      );
      design.header.summaryPositions[key] = point;
      setSummaryBoxPoint(key,point);
    });
  }

  function startSummaryDrag(event) {
    if (!editMode || (event.button !== undefined && event.button !== 0)) return;
    const handle = event.currentTarget;
    const box = handle.closest('[data-summary-box]');
    const key = box.dataset.summaryBox;
    activateSummaryFreePositioning();
    const rect = box.getBoundingClientRect();
    summaryDrag = {
      key,
      handle,
      pointerId:event.pointerId,
      offsetX:event.clientX - (rect.left + rect.width / 2),
      offsetY:event.clientY - (rect.top + rect.height / 2)
    };
    box.classList.add('is-summary-moving');
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function moveSummaryDrag(event) {
    if (!summaryDrag || event.pointerId !== summaryDrag.pointerId) return;
    const heroRect = document.getElementById('hero').getBoundingClientRect();
    const x = (event.clientX - summaryDrag.offsetX - heroRect.left) / heroRect.width * 100;
    const y = (event.clientY - summaryDrag.offsetY - heroRect.top) / heroRect.height * 100;
    const point = boundedSummaryPoint(summaryDrag.key,x,y);
    design.header.summaryPositions[summaryDrag.key] = point;
    setSummaryBoxPoint(summaryDrag.key,point);
    event.preventDefault();
  }

  function finishSummaryDrag(event) {
    if (!summaryDrag || event.pointerId !== summaryDrag.pointerId) return;
    const { key, handle, pointerId } = summaryDrag;
    summaryBox(key).classList.remove('is-summary-moving');
    if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
    summaryDrag = null;
    if (!saveDesign()) return;
    const label = key === 'collected' ? (design.header.collectedLabel || 'Collected') : (design.header.masteredLabel || 'Mastered');
    showToast(`${label} box position saved`);
  }

  function nudgeSummaryBox(event) {
    if (!editMode || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    activateSummaryFreePositioning();
    const key = event.currentTarget.closest('[data-summary-box]').dataset.summaryBox;
    const heroRect = document.getElementById('hero').getBoundingClientRect();
    const point = design.header.summaryPositions[key];
    const pixels = event.shiftKey ? 12 : 4;
    const dx = (event.key === 'ArrowLeft' ? -pixels : event.key === 'ArrowRight' ? pixels : 0) / heroRect.width * 100;
    const dy = (event.key === 'ArrowUp' ? -pixels : event.key === 'ArrowDown' ? pixels : 0) / heroRect.height * 100;
    design.header.summaryPositions[key] = boundedSummaryPoint(key,point.x + dx,point.y + dy);
    setSummaryBoxPoint(key,design.header.summaryPositions[key]);
    saveDesign();
  }

  function makeCard(family, variant) {
    const current = variantState(family.id, variant.id);
    const view = variantView(family, variant);
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.familyId = family.id;
    card.dataset.variantId = variant.id;
    card.classList.toggle('is-hidden-editor', !view.visible);
    if (view.customCard) applyCustomBackground(card,view.cardColor,view.cardImage,view.cardMode);
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
      <div class="master-label">${escapeHtml(design.header.masterPrompt)}</div>`;

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
    const masterLabel = card.querySelector('.master-label');
    const masterText = current.mastered ? design.header.masteredLabel : design.header.masterPrompt;
    masterLabel.textContent = masterText || '';
    masterLabel.hidden = !masterText;
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
    return familyVariants(family).reduce((totals, variant) => {
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
      if (familyInfo.customBg) applyCustomBackground(section,familyInfo.bgColor,familyInfo.bgImage,familyInfo.bgMode);
      const title = familyInfo.name || (editMode ? '[No group title]' : '');
      section.innerHTML = `
        <div class="collection-tools editor-only"><button class="edit-chip edit-family-btn" type="button">Edit group</button><button class="edit-chip add-variant-btn" type="button">Add box</button></div>
        <div class="collection-head">
          <h3${title ? '' : ' hidden'}>${escapeHtml(title)}</h3>
          <div class="collection-meta">
            <span class="collection-count">${stats.collected} / ${stats.total} collected</span>
            <span class="row-hint" aria-hidden="true">Swipe variants →</span>
          </div>
        </div>
        <div class="variant-row" aria-label="${escapeHtml(title || 'Sprite')} variants"></div>`;
      section.querySelector('.edit-family-btn').addEventListener('click', () => openFamilyEditor(family.id));
      section.querySelector('.add-variant-btn').addEventListener('click', () => {
        document.getElementById('newVariantFamilyId').value = family.id;
        document.getElementById('newVariantName').value = '';
        document.getElementById('addVariantDialog').showModal();
      });
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
    updateOwnerUi();
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

  function normalizeSearchText(value) {
    return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  }

  function searchableSprites() {
    return allFamilies().flatMap((family) => {
      const group = familyView(family);
      if (group.deleted || !group.visible) return [];
      const rarity = familyRarity(family);
      return orderedVariants(family).flatMap((variant) => {
        const view = variantView(family,variant);
        if (view.deleted || !view.visible) return [];
        const groupName = group.name || 'Unnamed sprite';
        const variantName = view.name || 'Unnamed variant';
        return [{
          familyId:family.id,
          variantId:variant.id,
          rarity,
          groupName,
          variantName,
          searchText:normalizeSearchText(`${groupName} ${variantName} ${rarity}`)
        }];
      });
    });
  }

  function findSpriteMatches(query) {
    const normalized = normalizeSearchText(query);
    if (!normalized) return [];
    const tokens = normalized.split(' ');
    return searchableSprites().filter((entry) => tokens.every((token) => entry.searchText.includes(token))).map((entry) => {
      const group = normalizeSearchText(entry.groupName);
      const variant = normalizeSearchText(entry.variantName);
      const combined = `${group} ${variant}`;
      const score = variant === normalized ? 0 : (group === normalized ? 1 : (combined.startsWith(normalized) ? 2 : 3));
      return { ...entry, score };
    }).sort((a,b) => a.score - b.score || a.groupName.localeCompare(b.groupName) || a.variantName.localeCompare(b.variantName)).slice(0,12);
  }

  function spriteSearchState(entry) {
    const current = state[entry.familyId]?.[entry.variantId] || {};
    if (current.mastered) return design.header.masteredLabel || 'Mastered';
    if (current.collected) return design.header.collectedLabel || 'In collection';
    return 'Not collected';
  }

  function closeSpriteSearchResults() {
    spriteSearchResults.hidden = true;
    spriteSearchInput.setAttribute('aria-expanded','false');
  }

  function openSpriteSearchResult(entry) {
    closeSpriteSearchResults();
    spriteSearchInput.blur();
    switchRarity(entry.rarity,{ historyMode:'push' });
    requestAnimationFrame(() => {
      const card = [...document.querySelectorAll('.card')].find((item) => item.dataset.familyId === entry.familyId && item.dataset.variantId === entry.variantId);
      if (!card) return showToast('That sprite is currently hidden.');
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      card.scrollIntoView({ behavior:reducedMotion ? 'auto' : 'smooth', block:'center', inline:'center' });
      card.classList.add('search-target');
      setTimeout(() => card.classList.remove('search-target'),2600);
      card.querySelector('.collect-button')?.focus({ preventScroll:true });
      const message = `${entry.groupName} — ${entry.variantName} on the ${entry.rarity} page`;
      spriteSearchStatus.textContent = message;
      showToast(message);
    });
  }

  function renderSpriteSearchResults() {
    const query = spriteSearchInput.value.trim();
    clearSpriteSearchBtn.hidden = !query;
    spriteSearchResults.replaceChildren();
    if (!query) return closeSpriteSearchResults();
    const matches = findSpriteMatches(query);
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'sprite-search-empty';
      empty.textContent = 'No matching sprites';
      spriteSearchResults.appendChild(empty);
    } else {
      matches.forEach((entry) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sprite-search-result';
        button.setAttribute('role','option');
        const text = document.createElement('span');
        const title = document.createElement('strong');
        title.textContent = `${entry.groupName} — ${entry.variantName}`;
        const detail = document.createElement('small');
        detail.textContent = `${entry.rarity} sprite`;
        text.append(title,detail);
        const status = document.createElement('span');
        status.className = 'sprite-search-result-status';
        status.textContent = spriteSearchState(entry);
        button.append(text,status);
        button.addEventListener('click', () => openSpriteSearchResult(entry));
        spriteSearchResults.appendChild(button);
      });
    }
    spriteSearchResults.hidden = false;
    spriteSearchInput.setAttribute('aria-expanded','true');
    spriteSearchStatus.textContent = `${matches.length} matching sprite${matches.length === 1 ? '' : 's'}`;
    return matches;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    statusToast.textContent = message;
    statusToast.classList.add('show');
    toastTimer = setTimeout(() => statusToast.classList.remove('show'), 2400);
  }

  function editorStatusElement(form) {
    let status = form?.querySelector('[data-editor-save-status]');
    if (!status && form) {
      status = document.createElement('p');
      status.className = 'editor-save-status';
      status.dataset.editorSaveStatus = '';
      status.setAttribute('role','status');
      status.setAttribute('aria-live','polite');
      const actions = form.querySelector('.dialog-actions:last-of-type');
      (actions?.parentElement || form).insertBefore(status,actions || null);
    }
    return status;
  }

  function setEditorStatus(form, message = '', stateName = '') {
    const status = editorStatusElement(form);
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-working',stateName === 'working');
    status.classList.toggle('is-ready',stateName === 'ready');
    status.classList.toggle('is-error',stateName === 'error');
  }

  function resetEditorStatus(form) {
    if (!form) return;
    form.dataset.imageJobs = '0';
    form.removeAttribute('aria-busy');
    form.querySelectorAll('button').forEach((button) => {
      if (button.dataset.processingDisabled === 'yes') button.disabled = false;
      delete button.dataset.processingDisabled;
    });
    setEditorStatus(form);
  }

  function setEditorProcessing(form, delta, label) {
    if (!form) return 0;
    const count = Math.max(0,Number(form.dataset.imageJobs || 0) + delta);
    form.dataset.imageJobs = String(count);
    form.toggleAttribute('aria-busy',count > 0);
    form.querySelectorAll('button[type="submit"],[data-close-dialog]').forEach((button) => {
      if (count > 0 && !button.disabled) {
        button.disabled = true;
        button.dataset.processingDisabled = 'yes';
      } else if (!count && button.dataset.processingDisabled === 'yes') {
        button.disabled = false;
        delete button.dataset.processingDisabled;
      }
    });
    if (count > 0) setEditorStatus(form,`${label} is being resized and optimized…`,'working');
    return count;
  }

  async function processEditorImage(input, label, processor) {
    const file = input.files?.[0];
    if (!file) return false;
    const form = input.closest('form');
    setEditorProcessing(form,1,label);
    input.disabled = true;
    try {
      await processor(file);
      const saveLabel = form?.querySelector('button[type="submit"]')?.textContent.trim() || 'Save changes';
      setEditorStatus(form,`${label} is ready. Tap ${saveLabel} to finish.`,'ready');
      return true;
    } catch {
      setEditorStatus(form,`${label} could not be prepared. Try a PNG, JPG, or WebP image.`,'error');
      return false;
    } finally {
      input.disabled = false;
      setEditorProcessing(form,-1,label);
    }
  }

  function editorReadyToSave(form) {
    if (!Number(form?.dataset.imageJobs || 0)) return true;
    setEditorStatus(form,'Please wait until the image finishes processing.','working');
    return false;
  }

  function showSaveFailure(message) {
    const openDialogs = [...document.querySelectorAll('dialog[open]')];
    const activeForm = openDialogs[openDialogs.length - 1]?.querySelector('form');
    if (activeForm) setEditorStatus(activeForm,message,'error');
    else showToast(message);
  }

  function finishEditorSave(dialogId, message) {
    document.getElementById(dialogId).close();
    renderAll();
    requestAnimationFrame(() => showToast(message));
  }

  const STUDIO_FIELD_MAP = {
    themeBodyFont:'bodyFont', themeHeadingFont:'headingFont', themeButtonFont:'buttonFont',
    themeBaseSize:'baseSize', themeTitleSize:'titleSize', themePageTitleSize:'pageTitleSize', themeGroupTitleSize:'groupTitleSize', themeSpriteLabelSize:'spriteLabelSize', themeChecklistButtonSize:'checklistButtonSize', themeTextColor:'textColor', themeMutedColor:'mutedColor',
    themeBodyBgColor:'bodyBgColor', themeBodyBgMode:'bodyBgMode', themeUseBuiltInBodyArt:'useBuiltInBodyArt', themeShowStars:'showStars',
    themeHeaderBgColor:'headerBgColor', themeHeaderTextColor:'headerTextColor', themeHeaderBorderColor:'headerBorderColor', themeHeaderRadius:'headerRadius', themeHeaderOpacity:'headerOpacity', themeHeaderHeight:'headerHeight', themeHeaderBgMode:'headerBgMode',
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
      themeHeaderHeightOutput:Number(document.getElementById('themeHeaderHeight').value) ? `${document.getElementById('themeHeaderHeight').value}px` : 'Auto',
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
    resetEditorStatus(document.getElementById('designStudioForm'));
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

  function updateHeaderImagePreview() {
    const preview = document.getElementById('editHeaderImagePreview');
    const source = pendingHeaderBgImage === undefined ? design.theme.headerBgImage : pendingHeaderBgImage;
    const sizing = imageMode(document.getElementById('editHeaderBgMode').value);
    preview.style.backgroundImage = source ? `url("${source}")` : 'none';
    preview.style.backgroundSize = sizing.size;
    preview.style.backgroundRepeat = sizing.repeat;
    preview.querySelector('span').hidden = Boolean(source);
  }

  function openHeaderEditor() {
    pendingHeaderBgImage = undefined;
    document.getElementById('editKicker').value = design.header.kicker;
    document.getElementById('editTitle').value = design.header.title;
    document.getElementById('editSubtitle').value = design.header.subtitle;
    document.getElementById('editCollectedLabel').value = design.header.collectedLabel;
    document.getElementById('editMasteredLabel').value = design.header.masteredLabel;
    document.getElementById('editMasterPrompt').value = design.header.masterPrompt;
    document.getElementById('editFooterNote').value = design.header.footerNote;
    document.getElementById('editShowSummary').checked = design.header.showSummary;
    document.getElementById('editSummaryPositionMode').value = design.header.summaryPositions?.mode === 'free' ? 'free' : 'flow';
    document.getElementById('editHeaderBgFile').value = '';
    document.getElementById('editHeaderBgMode').value = design.theme.headerBgMode;
    document.getElementById('editHeaderBgColor').value = design.theme.headerBgColor;
    document.getElementById('editHeaderTextColor').value = design.theme.headerTextColor;
    document.getElementById('editHeaderBorderColor').value = design.theme.headerBorderColor;
    document.getElementById('editHeaderRadius').value = design.theme.headerRadius;
    document.getElementById('editHeaderOpacity').value = design.theme.headerOpacity;
    document.getElementById('editHeaderHeight').value = design.theme.headerHeight;
    document.getElementById('editHeaderRadiusOutput').textContent = `${design.theme.headerRadius}px`;
    document.getElementById('editHeaderOpacityOutput').textContent = `${design.theme.headerOpacity}%`;
    document.getElementById('editHeaderHeightOutput').textContent = design.theme.headerHeight ? `${design.theme.headerHeight}px` : 'Auto';
    updateHeaderImagePreview();
    resetEditorStatus(document.getElementById('headerEditorForm'));
    document.getElementById('headerEditorDialog').showModal();
  }

  function openPageEditor() {
    const page = design.pages[activeRarity];
    const background = design.theme.pageBackgrounds[activeRarity];
    pendingPageBgImage = undefined;
    document.getElementById('editPageEyebrow').value = page.eyebrow;
    document.getElementById('editPageTitle').value = page.title;
    document.getElementById('editPageDescription').value = page.description;
    document.getElementById('editPageBgEnabled').checked = background.enabled;
    document.getElementById('editPageBgColor').value = background.color;
    document.getElementById('editPageBgMode').value = background.mode;
    document.getElementById('editPageBgFile').value = '';
    resetEditorStatus(document.getElementById('pageEditorForm'));
    document.getElementById('pageEditorDialog').showModal();
  }

  function openFamilyEditor(familyId) {
    const family = allFamilies().find((item) => item.id === familyId);
    if (!family) return;
    const view = familyView(family);
    pendingFamilyBgImage = undefined;
    document.getElementById('editFamilyId').value = familyId;
    document.getElementById('editFamilyName').value = view.name;
    document.getElementById('editFamilyRarity').value = familyRarity(family);
    document.getElementById('editFamilyCustomBg').checked = view.customBg;
    document.getElementById('editFamilyBgColor').value = view.bgColor;
    document.getElementById('editFamilyBgMode').value = view.bgMode;
    document.getElementById('editFamilyBgFile').value = '';
    document.getElementById('editFamilyVisible').checked = view.visible;
    resetEditorStatus(document.getElementById('familyEditorForm'));
    document.getElementById('familyEditorDialog').showModal();
  }

  function openVariantEditor(familyId, variantId) {
    const family = allFamilies().find((item) => item.id === familyId);
    const variant = family ? familyVariants(family).find((item) => item.id === variantId) : null;
    if (!family || !variant) return;
    const view = variantView(family,variant);
    pendingVariantImage = undefined;
    pendingVariantCardImage = undefined;
    clearPreviewObjectUrl();
    document.getElementById('editVariantFamilyId').value = familyId;
    document.getElementById('editVariantId').value = variantId;
    document.getElementById('editVariantName').value = view.name;
    document.getElementById('editVariantImage').value = '';
    document.getElementById('editVariantVisible').checked = view.visible;
    document.getElementById('editVariantCustomCard').checked = view.customCard;
    document.getElementById('editVariantCardColor').value = view.cardColor;
    document.getElementById('editVariantCardMode').value = view.cardMode;
    document.getElementById('editVariantCardFile').value = '';
    setVariantPreview(view.image);
    resetEditorStatus(document.getElementById('variantEditorForm'));
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

  async function resizeImage(file, bounds = 900) {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve,reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('invalid-image');
      const settings = typeof bounds === 'number' ? { width:bounds, height:bounds, maxBytes:260000 } : bounds;
      const maxWidth = settings.width;
      const maxHeight = settings.height;
      const targetBytes = settings.maxBytes || 260000;
      let scale = Math.min(1,maxWidth / image.naturalWidth,maxHeight / image.naturalHeight);
      let quality = .84;
      let bestResult = '';
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas-unavailable');
      for (let attempt = 0; attempt < 8; attempt += 1) {
        canvas.width = Math.max(1,Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1,Math.round(image.naturalHeight * scale));
        context.clearRect(0,0,canvas.width,canvas.height);
        context.drawImage(image,0,0,canvas.width,canvas.height);
        bestResult = canvas.toDataURL('image/webp',quality);
        const encodedLength = Math.max(0,bestResult.length - bestResult.indexOf(',') - 1);
        const estimatedBytes = Math.ceil(encodedLength * .75);
        if (estimatedBytes <= targetBytes) return bestResult;
        if (quality > .58) quality = Math.max(.58,quality - .13);
        else {
          const shrink = Math.max(.68,Math.min(.88,Math.sqrt(targetBytes / estimatedBytes) * .94));
          scale *= shrink;
          quality = .72;
        }
      }
      return bestResult;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function artworkBounds(area) {
    const sizes = {
      bodyBgImage:{ width:1920, height:1440, maxBytes:420000 },
      headerBgImage:{ width:1600, height:700, maxBytes:300000 },
      collectionBgImage:{ width:1600, height:900, maxBytes:320000 },
      cardBgImage:{ width:900, height:1100, maxBytes:220000 },
      wellBgImage:{ width:900, height:900, maxBytes:220000 },
      leftArt:{ width:800, height:1800, maxBytes:320000 },
      rightArt:{ width:800, height:1800, maxBytes:320000 },
      page:{ width:1920, height:1440, maxBytes:420000 },
      group:{ width:1600, height:900, maxBytes:320000 },
      card:{ width:900, height:1100, maxBytes:220000 },
      sprite:{ width:900, height:900, maxBytes:220000 }
    };
    return sizes[area] || { width:1200, height:1200, maxBytes:260000 };
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
    const image = await resizeImage(file,artworkBounds('sprite'));
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

  function buildPublishedDesignContents(publishedAt = Date.now() + 1) {
    const publicDesign = cloneJson(design);
    publicDesign._meta ||= {};
    publicDesign._meta.publishedAt = publishedAt;
    delete publicDesign._meta.localUpdatedAt;
    const safeJson = JSON.stringify(publicDesign).replace(/</g,'\\u003c');
    return `// Generated by Sprite Checklist. Replace this file in your GitHub repository.\nwindow.PUBLISHED_DESIGN = ${safeJson};\n`;
  }

  function exportPublishedDesign() {
    if (!saveDesign()) return;
    publishedDesignContents = buildPublishedDesignContents();
    publishedDesignFile = new File([publishedDesignContents],'published-design.js',{ type:'text/javascript' });
    if (publishedDesignUrl) URL.revokeObjectURL(publishedDesignUrl);
    publishedDesignUrl = URL.createObjectURL(publishedDesignFile);
    const link = document.getElementById('publishDownloadLink');
    link.href = publishedDesignUrl;
    const size = publishedDesignFile.size < 1048576 ? `${Math.max(1,Math.round(publishedDesignFile.size / 1024))} KB` : `${(publishedDesignFile.size / 1048576).toFixed(1)} MB`;
    const imageCount = (publishedDesignContents.match(/data:image\//g) || []).length;
    document.getElementById('publishDesignDetails').textContent = `${size} prepared • ${imageCount} embedded custom image${imageCount === 1 ? '' : 's'} • ${design.customFamilies.length} custom group${design.customFamilies.length === 1 ? '' : 's'}`;
    const shareButton = document.getElementById('sharePublishedDesignBtn');
    shareButton.hidden = !(navigator.canShare && navigator.canShare({ files:[publishedDesignFile] }));
    document.getElementById('publishDesignDialog').showModal();
    showToast('Public design prepared');
  }

  function persistCloudSyncSettings() {
    try { localStorage.setItem(CLOUD_SYNC_KEY,JSON.stringify(cloudSyncSettings)); }
    catch { showToast('Automatic sync settings could not be saved.'); }
  }

  function updateCloudSyncUi(message = '',stateName = '') {
    const connected = Boolean(cloudSyncSettings.enabled && cloudSyncSettings.token);
    cloudSyncBtn.textContent = `Automatic sync: ${connected ? 'On' : 'Off'}`;
    cloudSyncStatus.classList.toggle('is-synced',stateName === 'synced' || (connected && !stateName));
    cloudSyncStatus.classList.toggle('is-error',stateName === 'error');
    cloudSyncStatus.textContent = message || (connected
      ? 'Saved design changes publish automatically for every browser.'
      : 'Design changes are saved only in this browser.');
  }

  function openCloudSyncDialog() {
    document.getElementById('syncRepoOwner').value = cloudSyncSettings.owner || 'SnorkyTheBeard';
    document.getElementById('syncRepoName').value = cloudSyncSettings.repo || 'Sprite-Checklist';
    document.getElementById('syncRepoBranch').value = cloudSyncSettings.branch || 'main';
    document.getElementById('syncRepoPath').value = cloudSyncSettings.path || 'published-design.js';
    document.getElementById('syncGithubToken').value = '';
    document.getElementById('syncEnabled').checked = cloudSyncSettings.token ? cloudSyncSettings.enabled !== false : true;
    document.getElementById('syncStoredTokenNote').hidden = !cloudSyncSettings.token;
    document.getElementById('disconnectCloudSyncBtn').hidden = !cloudSyncSettings.token;
    cloudSyncDialogStatus.textContent = '';
    document.getElementById('cloudSyncDialog').showModal();
  }

  function utf8ToBase64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index,index + 32768));
    return btoa(binary);
  }

  async function githubErrorMessage(response) {
    try {
      const payload = await response.json();
      return payload.message || `GitHub returned ${response.status}`;
    } catch {
      return `GitHub returned ${response.status}`;
    }
  }

  async function publishDesignToGitHub(settings) {
    const owner = encodeURIComponent(settings.owner.trim());
    const repo = encodeURIComponent(settings.repo.trim());
    const branch = settings.branch.trim();
    const path = settings.path.trim().split('/').filter(Boolean).map(encodeURIComponent).join('/');
    const endpoint = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const headers = {
      Accept:'application/vnd.github.object+json',
      Authorization:`Bearer ${settings.token}`,
      'X-GitHub-Api-Version':'2022-11-28'
    };
    const currentResponse = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`,{ headers, cache:'no-store' });
    let sha = '';
    if (currentResponse.ok) sha = (await currentResponse.json()).sha || '';
    else if (currentResponse.status !== 404) throw new Error(await githubErrorMessage(currentResponse));

    const publishedAt = Date.now() + 1;
    const body = {
      message:`Publish Sprite Checklist design ${new Date(publishedAt).toISOString()}`,
      content:utf8ToBase64(buildPublishedDesignContents(publishedAt)),
      branch
    };
    if (sha) body.sha = sha;
    const updateResponse = await fetch(endpoint,{
      method:'PUT',
      headers:{ ...headers, 'Content-Type':'application/json' },
      body:JSON.stringify(body)
    });
    if (!updateResponse.ok) throw new Error(await githubErrorMessage(updateResponse));
    return { publishedAt, result:await updateResponse.json() };
  }

  function scheduleCloudSync() {
    if (!ownerUnlocked || !cloudSyncSettings.enabled || !cloudSyncSettings.token) return;
    clearTimeout(cloudSyncTimer);
    updateCloudSyncUi('Change saved locally; preparing automatic publish…');
    cloudSyncTimer = setTimeout(runCloudSync,1800);
  }

  async function runCloudSync() {
    if (!ownerUnlocked || !cloudSyncSettings.enabled || !cloudSyncSettings.token) return;
    if (cloudSyncInFlight) {
      cloudSyncQueued = true;
      return;
    }
    cloudSyncInFlight = true;
    cloudSyncQueued = false;
    updateCloudSyncUi('Publishing design for every browser…');
    try {
      const publication = await publishDesignToGitHub({ ...cloudSyncSettings });
      cloudSyncSettings.lastPublishedAt = publication.publishedAt;
      persistCloudSyncSettings();
      updateCloudSyncUi('Published successfully. Other browsers will update after GitHub Pages deploys.','synced');
      showToast('Public design synced');
    } catch (error) {
      updateCloudSyncUi(`Automatic publish failed: ${error.message}`,'error');
      showToast('Automatic sync needs attention');
    } finally {
      cloudSyncInFlight = false;
      if (cloudSyncQueued) {
        cloudSyncQueued = false;
        clearTimeout(cloudSyncTimer);
        cloudSyncTimer = setTimeout(runCloudSync,700);
      }
    }
  }

  function parsePublishedDesignText(text) {
    const marker = text.indexOf('window.PUBLISHED_DESIGN');
    const start = text.indexOf('{',marker);
    const end = text.lastIndexOf('}');
    if (marker < 0 || start < 0 || end <= start) throw new Error('Invalid public design');
    return JSON.parse(text.slice(start,end + 1));
  }

  async function checkForPublishedDesignUpdate() {
    if (document.hidden || Date.now() - lastPublicDesignCheck < 10000) return;
    lastPublicDesignCheck = Date.now();
    try {
      const response = await fetch('./published-design.js',{ cache:'no-cache' });
      if (!response.ok) return;
      const remote = parsePublishedDesignText(await response.text());
      const remoteAt = Number(remote._meta?.publishedAt || 0);
      const currentAt = Math.max(Number(design._meta?.publishedAt || 0),Number(design._meta?.localUpdatedAt || 0));
      if (!remoteAt || remoteAt <= currentAt) return;
      window.PUBLISHED_DESIGN = remote;
      design = normalizeDesign(remote);
      try { localStorage.setItem(DESIGN_KEY,JSON.stringify(design)); } catch {}
      renderAll();
      showToast('The public design was updated');
    } catch {}
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
    if (!ownerUnlocked) return;
    editMode = !editMode;
    if (!editMode) {
      document.getElementById('editorTools').hidden = true;
      document.getElementById('editorMenuBtn').setAttribute('aria-expanded','false');
    }
    renderAll();
    showToast(editMode ? 'Edit Mode on' : 'Editing finished');
  });
  document.getElementById('ownerAccessBtn').addEventListener('click', () => {
    document.getElementById('ownerKeyInput').value = '';
    document.getElementById('ownerKeyError').hidden = true;
    document.getElementById('ownerAccessDialog').showModal();
    setTimeout(() => document.getElementById('ownerKeyInput').focus(),0);
  });
  document.getElementById('ownerAccessForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = document.getElementById('ownerKeyInput');
    const matches = await hashOwnerKey(input.value);
    if (matches !== OWNER_KEY_HASH) {
      document.getElementById('ownerKeyError').hidden = false;
      input.select();
      return;
    }
    ownerUnlocked = true;
    try { localStorage.setItem(OWNER_UNLOCK_KEY,'yes'); } catch {}
    document.getElementById('ownerAccessDialog').close();
    renderAll();
    showToast('Owner editing unlocked');
  });
  document.getElementById('lockOwnerBtn').addEventListener('click', () => {
    ownerUnlocked = false;
    editMode = false;
    try { localStorage.removeItem(OWNER_UNLOCK_KEY); } catch {}
    document.getElementById('editorTools').hidden = true;
    document.getElementById('editorMenuBtn').setAttribute('aria-expanded','false');
    renderAll();
    showToast('Owner editing locked');
  });
  document.getElementById('editorMenuBtn').addEventListener('click', () => {
    const tools = document.getElementById('editorTools');
    tools.hidden = !tools.hidden;
    document.getElementById('editorMenuBtn').setAttribute('aria-expanded',String(!tools.hidden));
  });
  document.getElementById('editHeaderBtn').addEventListener('click', openHeaderEditor);
  document.getElementById('editPageBtn').addEventListener('click', openPageEditor);
  document.getElementById('designStudioBtn').addEventListener('click', openDesignStudio);
  document.getElementById('saveChangesBtn').addEventListener('click', () => {
    const designSaved = saveDesign();
    saveProgress();
    if (designSaved) showToast('All changes saved');
  });
  cloudSyncBtn.addEventListener('click',openCloudSyncDialog);
  document.getElementById('cloudSyncForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const tokenInput = document.getElementById('syncGithubToken');
    const candidate = {
      owner:document.getElementById('syncRepoOwner').value.trim(),
      repo:document.getElementById('syncRepoName').value.trim(),
      branch:document.getElementById('syncRepoBranch').value.trim(),
      path:document.getElementById('syncRepoPath').value.trim(),
      token:tokenInput.value.trim() || cloudSyncSettings.token,
      enabled:document.getElementById('syncEnabled').checked
    };
    if (!candidate.token) {
      cloudSyncDialogStatus.textContent = 'Paste a fine-grained GitHub token first.';
      return tokenInput.focus();
    }
    const button = document.getElementById('connectCloudSyncBtn');
    button.disabled = true;
    cloudSyncDialogStatus.textContent = 'Checking the connection and publishing the current design…';
    try {
      const publication = await publishDesignToGitHub(candidate);
      cloudSyncSettings = { ...candidate, lastPublishedAt:publication.publishedAt };
      persistCloudSyncSettings();
      updateCloudSyncUi(candidate.enabled ? 'Connected. Future saved changes will publish automatically.' : 'Connected; automatic publishing is paused.','synced');
      document.getElementById('cloudSyncDialog').close();
      showToast('Automatic browser sync connected');
    } catch (error) {
      cloudSyncDialogStatus.textContent = `Connection failed: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  });
  document.getElementById('disconnectCloudSyncBtn').addEventListener('click', () => {
    if (!confirm('Remove the saved GitHub connection from this browser?')) return;
    clearTimeout(cloudSyncTimer);
    cloudSyncSettings = { owner:'SnorkyTheBeard', repo:'Sprite-Checklist', branch:'main', path:'published-design.js', token:'', enabled:false };
    try { localStorage.removeItem(CLOUD_SYNC_KEY); } catch {}
    document.getElementById('cloudSyncDialog').close();
    updateCloudSyncUi('Automatic sync connection removed.');
    showToast('Automatic sync disconnected');
  });
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
      const input = event.currentTarget;
      if (!studioDraft) return;
      await processEditorImage(input,'Artwork',async (file) => {
        const image = await resizeImage(file,artworkBounds(key));
        if (!studioDraft) throw new Error('editor-closed');
        studioDraft[key] = image;
        if (key === 'headerBgImage' && !studioDraft.headerHeight) {
          studioDraft.headerHeight = 220;
          document.getElementById('themeHeaderHeight').value = '220';
        }
        previewStudioDraft();
      });
    });
  });

  document.getElementById('themePageBgFile').addEventListener('change', async (event) => {
    const input = event.currentTarget;
    if (!studioDraft) return;
    await processEditorImage(input,'Page background',async (file) => {
      const image = await resizeImage(file,artworkBounds('page'));
      if (!studioDraft) throw new Error('editor-closed');
      const page = studioDraft.pageBackgrounds[studioPageRarity];
      page.image = image;
      page.enabled = true;
      document.getElementById('themePageBgEnabled').checked = true;
      previewStudioDraft();
    });
  });

  document.querySelectorAll('[data-remove-theme-image]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!studioDraft) return;
      studioDraft[button.dataset.removeThemeImage] = '';
      previewStudioDraft();
      setEditorStatus(button.closest('form'),'Artwork will be removed. Tap Apply design to save.','ready');
    });
  });

  document.getElementById('removePageBgBtn').addEventListener('click', () => {
    if (!studioDraft) return;
    studioDraft.pageBackgrounds[studioPageRarity].image = '';
    previewStudioDraft();
    setEditorStatus(document.getElementById('designStudioForm'),'Page artwork will be removed. Tap Apply design to save.','ready');
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
    if (!editorReadyToSave(event.currentTarget)) return;
    design.theme = studioDraft;
    if (!saveDesign()) return;
    studioCommitted = true;
    finishEditorSave('designStudioDialog','Design changes saved');
  });

  document.getElementById('designStudioDialog').addEventListener('close', () => {
    if (!studioCommitted && studioOriginal) {
      design.theme = studioOriginal;
      applyTheme();
    }
    studioDraft = null;
    studioOriginal = null;
  });

  document.getElementById('editHeaderBgFile').addEventListener('change', async (event) => {
    const input = event.currentTarget;
    await processEditorImage(input,'Header image',async (file) => {
      pendingHeaderBgImage = await resizeImage(file,artworkBounds('headerBgImage'));
      if (!Number(document.getElementById('editHeaderHeight').value)) {
        document.getElementById('editHeaderHeight').value = '220';
        document.getElementById('editHeaderHeightOutput').textContent = '220px';
      }
      updateHeaderImagePreview();
    });
  });
  document.getElementById('removeEditHeaderBgBtn').addEventListener('click', () => {
    pendingHeaderBgImage = '';
    document.getElementById('editHeaderBgFile').value = '';
    updateHeaderImagePreview();
    setEditorStatus(document.getElementById('headerEditorForm'),'Header image will be removed. Tap Save header to finish.','ready');
  });
  document.getElementById('editHeaderBgMode').addEventListener('input',updateHeaderImagePreview);
  document.getElementById('editHeaderRadius').addEventListener('input', (event) => {
    document.getElementById('editHeaderRadiusOutput').textContent = `${event.currentTarget.value}px`;
  });
  document.getElementById('editHeaderOpacity').addEventListener('input', (event) => {
    document.getElementById('editHeaderOpacityOutput').textContent = `${event.currentTarget.value}%`;
  });
  document.getElementById('editHeaderHeight').addEventListener('input', (event) => {
    document.getElementById('editHeaderHeightOutput').textContent = Number(event.currentTarget.value) ? `${event.currentTarget.value}px` : 'Auto';
  });

  document.getElementById('headerEditorForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!editorReadyToSave(event.currentTarget)) return;
    const requestedPositionMode = document.getElementById('editSummaryPositionMode').value;
    const summaryPositions = requestedPositionMode === 'free'
      ? normalizeSummaryPositions(design.header.summaryPositions?.mode === 'free' ? design.header.summaryPositions : { ...DEFAULT_SUMMARY_POSITIONS, mode:'free' })
      : normalizeSummaryPositions(DEFAULT_SUMMARY_POSITIONS);
    design.header = {
      ...design.header,
      kicker:document.getElementById('editKicker').value,
      title:document.getElementById('editTitle').value,
      subtitle:document.getElementById('editSubtitle').value,
      collectedLabel:document.getElementById('editCollectedLabel').value,
      masteredLabel:document.getElementById('editMasteredLabel').value,
      masterPrompt:document.getElementById('editMasterPrompt').value,
      footerNote:document.getElementById('editFooterNote').value,
      showSummary:document.getElementById('editShowSummary').checked,
      summaryPositions
    };
    design.theme.headerBgMode = document.getElementById('editHeaderBgMode').value;
    design.theme.headerBgColor = document.getElementById('editHeaderBgColor').value;
    design.theme.headerTextColor = document.getElementById('editHeaderTextColor').value;
    design.theme.headerBorderColor = document.getElementById('editHeaderBorderColor').value;
    design.theme.headerRadius = Number(document.getElementById('editHeaderRadius').value);
    design.theme.headerOpacity = Number(document.getElementById('editHeaderOpacity').value);
    design.theme.headerHeight = Number(document.getElementById('editHeaderHeight').value);
    if (pendingHeaderBgImage !== undefined) design.theme.headerBgImage = pendingHeaderBgImage;
    if (!saveDesign()) return;
    finishEditorSave('headerEditorDialog','Header changes saved');
  });

  document.getElementById('editPageBgFile').addEventListener('change', async (event) => {
    const input = event.currentTarget;
    await processEditorImage(input,'Page background',async (file) => {
      pendingPageBgImage = await resizeImage(file,artworkBounds('page'));
      document.getElementById('editPageBgEnabled').checked = true;
    });
  });
  document.getElementById('removeEditPageBgBtn').addEventListener('click', () => {
    pendingPageBgImage = '';
    setEditorStatus(document.getElementById('pageEditorForm'),'Page background will be removed. Tap Save changes to finish.','ready');
  });

  document.getElementById('pageEditorForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!editorReadyToSave(event.currentTarget)) return;
    design.pages[activeRarity] = {
      eyebrow:document.getElementById('editPageEyebrow').value,
      title:document.getElementById('editPageTitle').value,
      description:document.getElementById('editPageDescription').value
    };
    const pageBackground = design.theme.pageBackgrounds[activeRarity];
    pageBackground.enabled = document.getElementById('editPageBgEnabled').checked;
    pageBackground.color = document.getElementById('editPageBgColor').value;
    pageBackground.mode = document.getElementById('editPageBgMode').value;
    if (pendingPageBgImage !== undefined) pageBackground.image = pendingPageBgImage;
    if (!saveDesign()) return;
    finishEditorSave('pageEditorDialog',`${design.pages[activeRarity].title || activeRarity} page changes saved`);
  });

  document.getElementById('editFamilyBgFile').addEventListener('change', async (event) => {
    const input = event.currentTarget;
    await processEditorImage(input,'Group background',async (file) => {
      pendingFamilyBgImage = await resizeImage(file,artworkBounds('group'));
      document.getElementById('editFamilyCustomBg').checked = true;
    });
  });
  document.getElementById('removeFamilyBgBtn').addEventListener('click', () => {
    pendingFamilyBgImage = '';
    document.getElementById('editFamilyCustomBg').checked = true;
    setEditorStatus(document.getElementById('familyEditorForm'),'Group background will be removed. Tap Save changes to finish.','ready');
  });
  document.getElementById('restoreFamilyBgBtn').addEventListener('click', () => {
    pendingFamilyBgImage = undefined;
    document.getElementById('editFamilyCustomBg').checked = false;
    setEditorStatus(document.getElementById('familyEditorForm'),'Main group-box design selected. Tap Save changes to finish.','ready');
  });

  document.getElementById('familyEditorForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!editorReadyToSave(event.currentTarget)) return;
    const id = document.getElementById('editFamilyId').value;
    const custom = familyCustom(id);
    custom.name = document.getElementById('editFamilyName').value;
    custom.rarity = document.getElementById('editFamilyRarity').value;
    custom.visible = document.getElementById('editFamilyVisible').checked;
    custom.customBg = document.getElementById('editFamilyCustomBg').checked;
    custom.bgColor = document.getElementById('editFamilyBgColor').value;
    custom.bgMode = document.getElementById('editFamilyBgMode').value;
    if (pendingFamilyBgImage !== undefined) custom.bgImage = pendingFamilyBgImage;
    if (!saveDesign()) return;
    finishEditorSave('familyEditorDialog',`${custom.name || 'Sprite group'} changes saved`);
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
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    previewObjectUrl = URL.createObjectURL(file);
    setVariantPreview(previewObjectUrl);
    const prepared = await processEditorImage(input,'Sprite image',async (selectedFile) => {
      pendingVariantImage = await resizeImage(selectedFile,artworkBounds('sprite'));
      setVariantPreview(pendingVariantImage);
      clearPreviewObjectUrl();
    });
    if (!prepared) {
      pendingVariantImage = undefined;
      clearPreviewObjectUrl();
    }
  });

  document.getElementById('editVariantCardFile').addEventListener('change', async (event) => {
    const input = event.currentTarget;
    await processEditorImage(input,'Card background',async (file) => {
      pendingVariantCardImage = await resizeImage(file,artworkBounds('card'));
      document.getElementById('editVariantCustomCard').checked = true;
    });
  });
  document.getElementById('removeVariantCardBgBtn').addEventListener('click', () => {
    pendingVariantCardImage = '';
    document.getElementById('editVariantCustomCard').checked = true;
    setEditorStatus(document.getElementById('variantEditorForm'),'Card background will be removed. Tap Save changes to finish.','ready');
  });
  document.getElementById('restoreVariantCardBgBtn').addEventListener('click', () => {
    pendingVariantCardImage = undefined;
    document.getElementById('editVariantCustomCard').checked = false;
    setEditorStatus(document.getElementById('variantEditorForm'),'Main card design selected. Tap Save changes to finish.','ready');
  });

  document.getElementById('removeVariantImageBtn').addEventListener('click', () => {
    pendingVariantImage = '';
    setVariantPreview('');
  });

  document.getElementById('restoreVariantBtn').addEventListener('click', () => {
    const family = allFamilies().find((item) => item.id === document.getElementById('editVariantFamilyId').value);
    const variant = family ? familyVariants(family).find((item) => item.id === document.getElementById('editVariantId').value) : null;
    if (!variant) return;
    document.getElementById('editVariantName').value = variant.name;
    document.getElementById('editVariantVisible').checked = true;
    pendingVariantImage = variant.image;
    setVariantPreview(variant.image);
  });

  document.getElementById('deleteVariantBtn').addEventListener('click', () => {
    const familyId = document.getElementById('editVariantFamilyId').value;
    const variantId = document.getElementById('editVariantId').value;
    const family = allFamilies().find((item) => item.id === familyId);
    const variant = family ? familyVariants(family).find((item) => item.id === variantId) : null;
    if (!family || !variant || !confirm(`Delete the ${variantView(family,variant).name || 'selected'} box from this group?`)) return;
    const custom = familyCustom(familyId);
    const addedIndex = custom.addedVariants?.findIndex((item) => item.id === variantId) ?? -1;
    if (addedIndex >= 0) custom.addedVariants.splice(addedIndex,1);
    else {
      custom.variants[variantId] ||= {};
      custom.variants[variantId].deleted = true;
    }
    if (Array.isArray(custom.order)) custom.order = custom.order.filter((id) => id !== variantId);
    if (state[familyId]) delete state[familyId][variantId];
    if (!saveDesign()) return;
    saveProgress();
    document.getElementById('variantEditorDialog').close();
    renderAll();
    showToast('Box deleted');
  });

  document.getElementById('addVariantForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const familyId = document.getElementById('newVariantFamilyId').value;
    const family = allFamilies().find((item) => item.id === familyId);
    const name = document.getElementById('newVariantName').value.trim();
    if (!family || !name) return;
    const custom = familyCustom(familyId);
    custom.addedVariants ||= [];
    const allIds = [...family.variants,...custom.addedVariants].map((variant) => variant.id);
    const idBase = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'new-box';
    let id = idBase;
    let suffix = 2;
    while (allIds.includes(id)) id = `${idBase}-${suffix++}`;
    custom.addedVariants.push({ id, name, image:'' });
    custom.order = currentVariantOrder(family);
    if (!saveDesign()) return;
    document.getElementById('addVariantDialog').close();
    renderAll();
    showToast(`${name} box added`);
  });

  document.getElementById('variantEditorForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!editorReadyToSave(event.currentTarget)) return;
    const familyId = document.getElementById('editVariantFamilyId').value;
    const variantId = document.getElementById('editVariantId').value;
    const custom = familyCustom(familyId);
    custom.variants[variantId] ||= {};
    custom.variants[variantId].name = document.getElementById('editVariantName').value;
    custom.variants[variantId].visible = document.getElementById('editVariantVisible').checked;
    custom.variants[variantId].customCard = document.getElementById('editVariantCustomCard').checked;
    custom.variants[variantId].cardColor = document.getElementById('editVariantCardColor').value;
    custom.variants[variantId].cardMode = document.getElementById('editVariantCardMode').value;
    if (pendingVariantCardImage !== undefined) custom.variants[variantId].cardImage = pendingVariantCardImage;
    if (pendingVariantImage !== undefined) custom.variants[variantId].image = pendingVariantImage;
    if (!saveDesign()) return;
    clearPreviewObjectUrl();
    finishEditorSave('variantEditorDialog',`${custom.variants[variantId].name || 'Sprite'} changes saved`);
  });

  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => button.closest('dialog').close());
  });

  document.querySelectorAll('.summary-move-handle').forEach((handle) => {
    handle.addEventListener('pointerdown',startSummaryDrag);
    handle.addEventListener('pointermove',moveSummaryDrag);
    handle.addEventListener('pointerup',finishSummaryDrag);
    handle.addEventListener('pointercancel',finishSummaryDrag);
    handle.addEventListener('keydown',nudgeSummaryBox);
  });

  document.getElementById('exportBtn').addEventListener('click', exportBackup);
  document.getElementById('publishDesignBtn').addEventListener('click', exportPublishedDesign);
  document.getElementById('publishDownloadLink').addEventListener('click', () => showToast('Design file download started'));
  document.getElementById('sharePublishedDesignBtn').addEventListener('click', async () => {
    if (!publishedDesignFile) return;
    try {
      await navigator.share({ files:[publishedDesignFile], title:'Sprite Checklist public design' });
      showToast('Design file shared');
    } catch (error) {
      if (error.name !== 'AbortError') alert('The file could not be shared. Use Download published-design.js instead.');
    }
  });
  document.getElementById('copyPublishedDesignBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(publishedDesignContents);
      showToast('Design file contents copied');
    } catch {
      alert('The design is too large to copy here. Use Download or Share/Save to Files instead.');
    }
  });
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) importBackup(file);
    event.target.value = '';
  });
  document.getElementById('resetDesignBtn').addEventListener('click', () => {
    if (!confirm('Reset all local text, images, and layout changes to the currently published design? Checklist progress will stay.')) return;
    design = normalizeDesign(window.PUBLISHED_DESIGN || {});
    saveDesign();
    renderAll();
    showToast('Published design restored');
  });

  spriteSearchInput.addEventListener('input',renderSpriteSearchResults);
  spriteSearchInput.addEventListener('focus', () => {
    if (spriteSearchInput.value.trim()) renderSpriteSearchResults();
  });
  spriteSearchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSpriteSearchResults();
      spriteSearchInput.blur();
    }
    if (event.key === 'ArrowDown' && !spriteSearchResults.hidden) {
      const first = spriteSearchResults.querySelector('.sprite-search-result');
      if (first) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  spriteSearchResults.addEventListener('keydown', (event) => {
    if (!['ArrowDown','ArrowUp','Escape'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') {
      closeSpriteSearchResults();
      return spriteSearchInput.focus();
    }
    const options = [...spriteSearchResults.querySelectorAll('.sprite-search-result')];
    const current = options.indexOf(document.activeElement);
    const offset = event.key === 'ArrowDown' ? 1 : -1;
    options[(current + offset + options.length) % options.length]?.focus();
  });
  spriteSearchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const matches = findSpriteMatches(spriteSearchInput.value);
    if (matches[0]) openSpriteSearchResult(matches[0]);
    else {
      renderSpriteSearchResults();
      spriteSearchStatus.textContent = 'No matching sprites';
    }
  });
  clearSpriteSearchBtn.addEventListener('click', () => {
    spriteSearchInput.value = '';
    clearSpriteSearchBtn.hidden = true;
    closeSpriteSearchResults();
    spriteSearchStatus.textContent = 'Search cleared';
    spriteSearchInput.focus();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.sprite-search')) closeSpriteSearchResults();
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
  setTimeout(checkForPublishedDesignUpdate,7000);
  setInterval(checkForPublishedDesignUpdate,45000);
  window.addEventListener('online',checkForPublishedDesignUpdate);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForPublishedDesignUpdate(); });
})();
