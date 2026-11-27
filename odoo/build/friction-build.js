/*
 * Friction Clothing Barbados on Odoo: browser build kit (Tech Nova, 2 Nov 2026)
 *
 * Runs inside a logged-in Odoo tab (https://friction.odoo.com/odoo) and talks to Odoo over JSON-RPC
 * (/web/dataset/call_kw) with the session cookie. No API keys, no passwords.
 * Loading this file only defines window.FRB. Nothing runs until you call a step:
 *
 *   await FRB.run('introspect')        // always first
 *   await FRB.run('products', 0, 8)    // chunked steps take (offset, limit) and return {next}
 *   await FRB.all()                    // every step in order (about 2-3 minutes)
 *
 * Every step is idempotent. Records this script creates are tagged with external ids
 * 'friction_demo.<name>' (ir.model.data) and views with keys 'website.friction_<name>'.
 * Prices stay at 0 and are shown as "Price on request": Friction has not supplied prices, SKUs, stock or sizes.
 * Outbound calls go only to FRB.BASE (the kit on technovabb.com) and to this Odoo site.
 */
(() => {
  'use strict';
  const W = window;
  const prev = W.FRB || {};
  const FRB = (W.FRB = {});
  FRB.VERSION = '1.2.0 (2026-11-26, online ordering)';
  FRB.BASE = prev.BASE || W.FRB_BASE || 'https://technovabb.com/friction-demo/odoo/';
  const MOD = 'friction_demo';

  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  FRB.cfg = Object.assign({}, LS.get('FRB.cfg', {}), prev.cfg || {});
  const save = () => LS.set('FRB.cfg', FRB.cfg);

  // ------------------------------------------------------------------ business facts (verified, from the brief)
  const BIZ = {
    site: 'Friction Clothing Barbados', phone: '(246) 622-1748', wa: 'https://wa.me/12466221748',
    insta: 'https://www.instagram.com/frictionclothingbarbados/', footwear: 'https://www.instagram.com/frictionfootwear/',
  };
  FRB.text = Object.assign({
    // Online ordering since 26 Nov 2026: click and collect at the store, pay when collecting (card online to follow)
    carrierName: 'Collect at Friction, The Dome Mall',
    carrierDesc: 'Collect your order from Friction at The Dome Mall, Warrens, St. Michael. Friction will contact you when it is ready.',
    payOnSiteName: 'Pay when you collect',
    // A step's main_button_label is the text of the button that leads TO that step.
    // free_order_label only shows on $0 carts, which can't happen now (unpriced looks can't be added to the cart).
    freeOrderLabel: 'Confirm Order',
    shopTitle: 'Men’s Streetwear in Barbados | Friction Clothing',
    shopDesc: 'Shop men’s streetwear, graphic tees, denim, statement sets and footwear from Friction Clothing at The Dome Mall in Warrens, Barbados.',
    steps: {
      '/shop/cart': { name: 'Cart', main_button_label: 'Continue' },
      '/shop/address': { name: 'Your details', main_button_label: false },
      '/shop/checkout': { name: 'Collection', main_button_label: 'Checkout' },
      '/shop/payment': { name: 'Payment', main_button_label: 'Continue' },
    },
  }, W.FRB_TEXT || {}); // wording overrides only from window.FRB_TEXT, so reloading the kit always picks up new defaults

  // ------------------------------------------------------------------ helpers
  const idOf = (v) => (Array.isArray(v) ? v[0] : v) || false;
  const short = (e) => String((e && e.message) || e).slice(0, 400);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let seq = 0;
  async function post(url, params) {
    const r = await fetch(url, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: ++seq, params }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
    const j = await r.json();
    if (j.error) {
      const d = j.error.data || {};
      throw new Error(((d.name ? d.name.split('.').pop() + ': ' : '') + (d.message || j.error.message)).slice(0, 900));
    }
    return j.result;
  }
  const rpc = (model, method, args = [], kwargs = {}) => post('/web/dataset/call_kw', { model, method, args, kwargs });
  const kitUrl = (p) => FRB.BASE.replace(/\/?$/, '/') + String(p).replace(/^\/+/, '');
  async function kitFetch(p) {
    const r = await fetch(kitUrl(p) + '?v=' + Date.now(), { credentials: 'omit', cache: 'no-store' });
    if (!r.ok) throw new Error(`Kit file ${p}: HTTP ${r.status}`);
    return r;
  }
  const fetchJSON = async (p) => (await kitFetch(p)).json();
  const fetchText = async (p) => (await kitFetch(p)).text();
  async function fetchB64(p) {
    const blob = await (await kitFetch(p)).blob();
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(',')[1]);
      fr.onerror = () => rej(new Error('FileReader failed for ' + p));
      fr.readAsDataURL(blob);
    });
  }
  Object.assign(FRB, { rpc, post, fetchJSON, fetchText });
  const catalogue = async () => (FRB._cat = FRB._cat || await fetchJSON('catalogue.json'));
  const pagesJson = async () => (FRB._pages = FRB._pages || await fetchJSON('pages/pages.json'));

  const has = (model, field) => !!(FRB.cfg.f && FRB.cfg.f[model] && FRB.cfg.f[model].includes(field));
  function pick(model, vals, skipped) {
    const out = {};
    for (const [k, v] of Object.entries(vals)) { if (has(model, k)) out[k] = v; else if (skipped) skipped.push(model + '.' + k); }
    return out;
  }
  function need() { if (!FRB.cfg.websiteId || !FRB.cfg.f) throw new Error('Run FRB.run("introspect") first.'); }
  const wid = () => FRB.cfg.websiteId;
  const wctx = (x) => Object.assign({ website_id: wid() }, x || {});
  async function writeSafe(model, ids, vals, ctx) {
    const kw = ctx ? { context: ctx } : {};
    try { await rpc(model, 'write', [ids, vals], kw); return []; } catch (e) {
      const errs = [];
      for (const [k, v] of Object.entries(vals)) {
        try { await rpc(model, 'write', [ids, { [k]: v }], kw); } catch (e2) { errs.push(`${k}: ${short(e2)}`); }
      }
      return errs;
    }
  }
  // external ids: friction_demo.<name> -> res_id
  async function xid(name, model) {
    const r = await rpc('ir.model.data', 'search_read', [[['module', '=', MOD], ['name', '=', name]]], { fields: ['res_id', 'model'] });
    if (!r.length || r[0].model !== model) return null;
    const ok = await rpc(model, 'search', [[['id', '=', r[0].res_id]]], { context: { active_test: false } });
    return ok.length ? r[0].res_id : null;
  }
  async function setXid(name, model, resId) {
    const r = await rpc('ir.model.data', 'search', [[['module', '=', MOD], ['name', '=', name]]]);
    if (r.length) await rpc('ir.model.data', 'write', [r, { model, res_id: resId }]);
    else await rpc('ir.model.data', 'create', [{ module: MOD, name, model, res_id: resId, noupdate: true }]);
  }
  async function upsert(name, model, vals, ctx) {
    const kw = ctx ? { context: ctx } : {};
    let id = await xid(name, model);
    if (id) { await rpc(model, 'write', [[id], vals], kw); return { id, created: false }; }
    id = idOf(await rpc(model, 'create', [vals], kw));
    await setXid(name, model, id);
    return { id, created: true };
  }
  function replaceById(arch, id, innerXml) {
    const doc = new DOMParser().parseFromString(arch, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Could not parse the existing view arch');
    const el = [...doc.getElementsByTagName('*')].find((e) => e.getAttribute('id') === id);
    if (!el) return null;
    const frag = new DOMParser().parseFromString('<fr-wrap>' + innerXml + '</fr-wrap>', 'text/xml');
    const perr = frag.getElementsByTagName('parsererror')[0];
    if (perr) throw new Error('Kit XML is not well-formed: ' + perr.textContent.slice(0, 240));
    while (el.firstChild) el.removeChild(el.firstChild);
    for (const n of [...frag.documentElement.childNodes]) el.appendChild(doc.importNode(n, true));
    return new XMLSerializer().serializeToString(doc);
  }
  function checkXml(xml, label) {
    const frag = new DOMParser().parseFromString('<fr-wrap>' + xml + '</fr-wrap>', 'text/xml');
    const perr = frag.getElementsByTagName('parsererror')[0];
    if (perr) throw new Error(`${label} is not well-formed XML: ` + perr.textContent.slice(0, 240));
  }
  async function themeOption(enable, disable) {
    await post('/website/theme_customize_data', { is_view_data: true, enable, disable });
  }
  async function viewFor(key) {
    // Odoo renders this website's own copy of a template when one exists
    const v = await rpc('ir.ui.view', 'search_read', [[['key', '=', key], ['website_id', 'in', [wid(), false]]]],
      { fields: ['id', 'website_id', 'active', 'arch_db'], context: { active_test: false } });
    // an archived website copy is skipped by Odoo (it renders the generic one), so only an active copy wins
    return v.find((x) => idOf(x.website_id) === wid() && x.active) || v.find((x) => !x.website_id) ||
      v.find((x) => idOf(x.website_id) === wid()) || null;
  }

  // ------------------------------------------------------------------ introspect
  const MODELS = ['product.template', 'product.public.category', 'product.ribbon', 'product.attribute', 'website',
    'website.page', 'website.menu', 'website.checkout.step', 'delivery.carrier', 'payment.provider', 'res.groups',
    'res.company', 'mail.template'];
  FRB.introspect = async () => {
    const cfg = FRB.cfg;
    const vi = await post('/web/webclient/version_info', {});
    cfg.version = vi.server_version;
    const si = await post('/web/session/get_session_info', {}).catch(() => null);
    cfg.uid = si && si.uid;
    if (!cfg.uid) throw new Error('Not logged in on this tab.');
    cfg.companyId = idOf(si.user_companies && si.user_companies.current_company) ||
      idOf((await rpc('res.users', 'read', [[cfg.uid]], { fields: ['company_id'] }))[0].company_id);
    const sites = await rpc('website', 'search_read', [[]], { fields: ['name', 'domain', 'company_id'] });
    const site = sites.find((s) => s.domain && s.domain.includes(location.host)) ||
      sites.find((s) => idOf(s.company_id) === cfg.companyId) || sites[0];
    if (!site) throw new Error('No website record. Install eCommerce first.');
    cfg.websiteId = site.id;
    const co = (await rpc('res.company', 'read', [[cfg.companyId]], { fields: ['currency_id'] }))[0];
    cfg.currency = co.currency_id && co.currency_id[1];
    cfg.f = {};
    for (const m of MODELS) {
      try { cfg.f[m] = Object.keys(await rpc(m, 'fields_get', [], { attributes: ['type'] })); } catch (e) { cfg.f[m] = null; }
    }
    cfg.addDataRoute = '/html_editor/attachment/add_data';
    save();
    return { version: cfg.version, websiteId: cfg.websiteId, website: site.name, currency: cfg.currency,
      missingModels: MODELS.filter((m) => !cfg.f[m]) };
  };

  // ------------------------------------------------------------------ settings: variants group + website record
  FRB.settings = async () => {
    need();
    const out = { variants: null, website: null, skipped: [] };
    // Show the Attributes tab in the back office (direct group write: never touch res.config.settings, it can reset the currency)
    try {
      const g = await rpc('ir.model.data', 'search_read', [[['module', '=', 'product'], ['name', '=', 'group_product_variant']]], { fields: ['res_id'] });
      const u = await rpc('ir.model.data', 'search_read', [[['module', '=', 'base'], ['name', '=', 'group_user']]], { fields: ['res_id'] });
      if (g.length && u.length) {
        const field = has('res.groups', 'implied_ids') ? 'implied_ids' : null;
        if (field) { await rpc('res.groups', 'write', [[u[0].res_id], { [field]: [[4, g[0].res_id]] }]); out.variants = 'on'; }
        else out.variants = 'skipped: res.groups.implied_ids missing';
      }
    } catch (e) { out.variants = 'skipped: ' + short(e); }
    const site = (await rpc('website', 'read', [[wid()]], { fields: ['shop_opt_products_design_classes'].filter((f) => has('website', f)) }))[0] || {};
    let classes = String(site.shop_opt_products_design_classes || '');
    if (classes) {
      classes = classes.replace(/\bo_wsale_products_opt_thumb_cover\b/, 'o_wsale_products_opt_thumb_contain');
      if (!/o_wsale_products_opt_thumb_contain/.test(classes)) classes += ' o_wsale_products_opt_thumb_contain';
      // enquiry-only: no wishlist or compare controls on the cards
      classes = classes.replace(/\bo_wsale_products_opt_(has_wishlist|wishlist_fixed|wishlist_inline|has_comparison)\b/g, '').replace(/\s+/g, ' ');
    }
    const share = await fetchB64('images/share-1200x630.jpg');
    // Online ordering (since 26 Nov 2026): everything with a price can be bought; "Hide Add To Cart" only for
    // 0-price products, i.e. the styled looks, which stay WhatsApp enquiries until they have prices
    const vals = pick('website', {
      name: BIZ.site, tz: 'America/Barbados', configurator_done: true, cookies_bar: false,
      shop_ppg: 20, shop_ppr: 4, shop_default_sort: 'website_sequence asc', account_on_checkout: 'optional',
      ecommerce_access: 'everyone', prevent_sale: true, prevent_sale_for: 'zero_price',
      prevent_sale_for_categories: [[5, 0, 0]], contact_us_link_url: '/visit-us',
      auth_signup_uninvited: 'b2b', // accounts by invitation only: no "Don't have an account?" on the sign-in page
      product_page_image_ratio: 'auto', product_page_image_ratio_mobile: 'auto', product_page_image_width: '50_pc',
      social_default_image: share, robots_txt: 'User-agent: *\nDisallow: /',
    }, out.skipped);
    if (classes) vals.shop_opt_products_design_classes = classes.trim();
    const errs = await writeSafe('website', [wid()], vals, wctx());
    out.website = errs.length ? errs : 'ok';
    return out;
  };

  // ------------------------------------------------------------------ theme: palette, fonts, header/footer colours
  FRB.theme = async (opts = {}) => {
    need();
    const colors = '/website/static/src/scss/options/colors/user_color_palette.scss';
    const values = '/website/static/src/scss/options/user_values.scss';
    if (opts.reset) {
      const out = {};
      for (const u of [colors, values]) {
        try { await rpc('website.assets', 'reset_asset', [u, 'web.assets_frontend'], { context: wctx() }); out[u] = 'reset'; } catch (e) { out[u] = short(e); }
      }
      return out;
    }
    const out = {};
    try {
      await rpc('website.assets', 'make_scss_customization', [colors,
        { 'o-color-1': '#E21B2D', 'o-color-2': '#262626', 'o-color-3': '#F4F1EB', 'o-color-4': '#FFFFFF', 'o-color-5': '#080808' }], { context: wctx() });
      out.palette = 'ok';
    } catch (e) { out.palette = 'skipped: ' + short(e); }
    try {
      await rpc('website.assets', 'make_scss_customization', [values,
        { font: "'Inter'", 'headings-font': "'Anton'", 'navbar-font': "'Inter'", 'buttons-font': "'Inter'",
          'google-fonts': "('Anton', 'Inter')", 'btn-border-radius': '0', 'btn-border-radius-sm': '0', 'btn-border-radius-lg': '0',
          'input-border-radius': '0', menu: '5', footer: '5', copyright: '5' }], { context: wctx() });
      out.fonts = 'ok';
    } catch (e) { out.fonts = 'skipped: ' + short(e); }
    out.note = 'The first page load after this recompiles the CSS (10-20 s). Undo with FRB.run("theme", {reset:true}).';
    return out;
  };

  // ------------------------------------------------------------------ catalogue
  FRB.categories = async () => {
    need();
    const C = await catalogue(), PC = 'product.public.category', out = { created: [], updated: [] };
    FRB.cfg.cat = FRB.cfg.cat || {}; FRB.cfg.catUrl = FRB.cfg.catUrl || {};
    for (const c of C.categories) {
      const name = 'cat_' + c.key.replace(/-/g, '_');
      let id = await xid(name, PC);
      if (!id) { // adopt a same-name category made by hand
        const ex = await rpc(PC, 'search', [[['name', '=', c.name]]]);
        if (ex.length) { id = ex[0]; await setXid(name, PC, id); }
      }
      // Parents come first in catalogue.json (Styled Looks > New Arrivals ...); Footwear holds the real Loyverse shoes
      const vals = pick(PC, { name: c.name, sequence: c.sequence, parent_id: (c.parent && FRB.cfg.cat[c.parent]) || false,
        website_meta_title: `${c.name} | Friction Clothing Barbados`,
        website_meta_description: c.meta || `${c.name} at Friction Clothing Barbados, The Dome Mall, Warrens. Prices and sizes on request.` });
      if (id) { await rpc(PC, 'write', [[id], vals]); out.updated.push(c.key); }
      else { id = idOf(await rpc(PC, 'create', [vals])); await setXid(name, PC, id); out.created.push(c.key); }
      FRB.cfg.cat[c.key] = id;
    }
    const rows = await rpc(PC, 'read', [Object.values(FRB.cfg.cat)], { fields: ['id', 'name'].concat(has(PC, 'website_url') ? ['website_url'] : []) });
    for (const [k, id] of Object.entries(FRB.cfg.cat)) {
      const r = rows.find((x) => x.id === id);
      FRB.cfg.catUrl[k] = (r && r.website_url) || `/shop/category/${id}`;
    }
    save();
    return out;
  };

  FRB.ribbons = async () => {
    need();
    const C = await catalogue(), RB = 'product.ribbon', out = {};
    FRB.cfg.ribbon = FRB.cfg.ribbon || {};
    for (const r of C.ribbons) {
      const vals = pick(RB, { name: r.name, bg_color: r.bg, text_color: r.text, position: 'left', style: 'tag', assign: 'manual' });
      const res = await upsert('ribbon_' + r.key, RB, vals);
      FRB.cfg.ribbon[r.key] = res.id; out[r.key] = res.created ? 'created' : 'updated';
    }
    save();
    return out;
  };

  FRB.sizeAttr = async () => {
    need();
    const C = await catalogue(), A = 'product.attribute', V = 'product.attribute.value', S = C.sizeAttribute;
    const vals = pick(A, { name: S.name, create_variant: 'no_variant', display_type: 'pills', visibility: 'hidden' });
    const res = await upsert('attr_size', A, vals);
    const ex = await rpc(V, 'search_read', [[['attribute_id', '=', res.id]]], { fields: ['id', 'name'] });
    const ids = [];
    for (const [i, n] of S.values.entries()) {
      let v = ex.find((x) => x.name === n);
      if (!v) v = { id: idOf(await rpc(V, 'create', [{ attribute_id: res.id, name: n, sequence: i + 1 }])) };
      ids.push(v.id);
    }
    FRB.cfg.sizeAttr = res.id; FRB.cfg.sizeVals = ids; save();
    return { attribute: res.id, created: res.created, values: S.values };
  };

  FRB.products = async (offset = 0, limit = 8) => {
    need();
    if (!FRB.cfg.cat || !FRB.cfg.ribbon) throw new Error('Run categories and ribbons first.');
    const sizeAttr = await xid('attr_size', 'product.attribute');
    const C = await catalogue(), T = 'product.template', out = { created: [], updated: [], errors: [] };
    FRB.cfg.prod = FRB.cfg.prod || {};
    const list = C.looks.slice(offset, offset + limit);
    for (const L of list) {
      try {
        const img = await fetchB64(`images/look-${L.n}.jpg`);
        const descHtml = `<p>${esc(L.desc)}</p>`;
        const base = {
          name: L.name, sale_ok: true, purchase_ok: false, type: 'consu', is_storable: false, list_price: 0,
          description_sale: L.note, description_ecommerce: descHtml,
          public_categ_ids: [[6, 0, L.cats.map((k) => FRB.cfg.cat[k]).filter(Boolean)]],
          website_ribbon_id: FRB.cfg.ribbon[L.badge] || false, website_sequence: parseInt(L.n, 10) * 10,
          is_published: true, image_1920: img, allow_out_of_stock_order: true, show_availability: false,
          website_meta_title: `${L.name} | Friction Clothing Barbados`,
          website_meta_description: `${L.desc} Price on request. Ask Friction at The Dome Mall, Warrens, Barbados.`,
        };
        const vals = pick(T, base);
        const name = 'look_' + L.n;
        let id = await xid(name, T);
        if (id) { await rpc(T, 'write', [[id], vals]); out.updated.push(L.n); }
        else { id = idOf(await rpc(T, 'create', [vals])); await setXid(name, T, id); out.created.push(L.n); }
        // No size attribute on the product: Odoo would preselect a size. The optional size enquiry lives in views/cta_enquiry.xml.
        if (sizeAttr) {
          const lines = await rpc('product.template.attribute.line', 'search', [[['product_tmpl_id', '=', id], ['attribute_id', '=', sizeAttr]]]);
          if (lines.length) await rpc(T, 'write', [[id], { attribute_line_ids: lines.map((l) => [2, l]) }]);
        }
        FRB.cfg.prod[L.n] = id;
      } catch (e) { out.errors.push(L.n + ': ' + short(e)); }
    }
    save();
    out.next = offset + limit < C.looks.length ? offset + limit : null;
    return out;
  };

  // ------------------------------------------------------------------ enquiry flow: delivery method, checkout wording, options
  // Click and collect (since 26 Nov 2026): Odoo's Click & Collect app gives "pick up in store" delivery and "pay on site".
  // Card payment online needs Friction's own payment account (they sign up and connect it themselves); add it as a second provider then.
  FRB.delivery = async () => {
    need();
    const D = 'delivery.carrier', P = 'payment.provider', M = 'ir.module.module', out = {};
    const mod = (await rpc(M, 'search_read', [[['name', '=', 'website_sale_collect']]], { fields: ['state'] }))[0];
    if (!mod) throw new Error('Click & Collect (website_sale_collect) is not available on this database.');
    if (mod.state !== 'installed') {
      await rpc(M, 'button_immediate_install', [[mod.id]]);
      return { installed: 'website_sale_collect', next: 'Reload this tab, load the kit, run introspect, then run delivery again.' };
    }
    // The store address customers see at checkout is the warehouse's address (here the company's)
    const wh = (await rpc('stock.warehouse', 'search_read', [[['company_id', '=', FRB.cfg.companyId || 1]]], { fields: ['id', 'partner_id'], limit: 1 }))[0];
    if (!wh) throw new Error('No warehouse to collect from.');
    const bb = (await rpc('res.country', 'search', [[['code', '=', 'BB']]]))[0];
    out.storeAddress = await writeSafe('res.partner', [idOf(wh.partner_id)], { street: 'The Dome Mall', street2: 'Warrens', city: 'St. Michael', country_id: bb, phone: '+1 246-622-1748' });
    const pub = has(D, 'is_published') ? 'is_published' : 'website_published';
    const stores = await rpc(D, 'search_read', [[['delivery_type', '=', 'in_store']]], { fields: ['id', 'name'], context: { active_test: false } });
    if (!stores.length) throw new Error('No in-store pickup method found after installing Click & Collect.');
    const store = stores[0];
    const sv = pick(D, { name: FRB.text.carrierName, [pub]: true, active: true, sequence: 1, website_id: false,
      carrier_description: FRB.text.carrierDesc, website_description: FRB.text.carrierDesc });
    out.carrier = await writeSafe(D, [store.id], Object.assign(sv, { warehouse_ids: [[6, 0, [wh.id]]] }));
    const others = await rpc(D, 'search_read', [[['id', '!=', store.id], [pub, '=', true]]], { fields: ['name'] });
    if (others.length) await rpc(D, 'write', [others.map((o) => o.id), { [pub]: false }]);
    out.unpublished = others.map((o) => o.name);
    // Pay on site: the only payment method until card payment is connected
    const pf = await rpc(P, 'fields_get', [], { attributes: ['type', 'selection'] });
    const onSite = await rpc(P, 'search_read', [[['code', '=', 'custom'], ['custom_mode', '=', 'on_site']]], { fields: ['id', 'name'], context: { active_test: false } });
    if (!onSite.length) throw new Error('No "pay on site" payment provider found after installing Click & Collect.');
    const pv = { name: FRB.text.payOnSiteName, is_published: true };
    if (pf.state) pv.state = 'enabled';
    if (pf.active) pv.active = true;
    out.payOnSite = await writeSafe(P, [onSite[0].id], pv);
    // the checkout shows the payment METHOD's name (Odoo calls it 'Pay on site')
    const pms = (await rpc(P, 'read', [[onSite[0].id]], { fields: ['payment_method_ids'] }))[0].payment_method_ids;
    if (pms.length) out.payMethod = await writeSafe('payment.method', pms, { name: FRB.text.payOnSiteName });
    return out;
  };

  FRB.checkout = async () => {
    need();
    const out = { steps: [] };
    if (!FRB.cfg.f['website.checkout.step']) return { steps: 'website.checkout.step not on this version' };
    const rows = await rpc('website.checkout.step', 'search_read', [[['website_id', '=', wid()]]], { fields: ['id', 'step_href', 'name'] });
    for (const r of rows) {
      const v = FRB.text.steps[r.step_href]; if (!v) continue;
      const errs = await writeSafe('website.checkout.step', [r.id], pick('website.checkout.step', v), wctx());
      out.steps.push(r.step_href + (errs.length ? ' errors: ' + errs.join('; ') : ' ok'));
    }
    // Free carts get a plain submit button labelled with the company's free_order_label ("Confirm Order" by default)
    const co = idOf((await rpc('website', 'read', [[wid()]], { fields: ['company_id'] }))[0].company_id);
    if (co && has('res.company', 'free_order_label')) {
      const errs = await writeSafe('res.company', [co], { free_order_label: FRB.text.freeOrderLabel });
      out.button = errs.length ? errs : FRB.text.freeOrderLabel;
    } else out.button = 'skipped: res.company.free_order_label missing';
    return out;
  };

  // Odoo's "Sales: Order Confirmation" email, reworded as an enquiry receipt with no amounts.
  // Odoo's own Reset Template (or FRB.run('resetEmail')) puts the original back.
  async function confirmationTemplate() {
    const r = await rpc('ir.model.data', 'search_read', [[['module', '=', 'sale'], ['name', '=', 'mail_template_sale_confirmation']]], { fields: ['res_id'] });
    if (!r.length) throw new Error('sale.mail_template_sale_confirmation not found');
    return r[0].res_id;
  }
  // Real orders since 26 Nov 2026: customers get Odoo's own order confirmation email (the enquiry version is retired)
  FRB.email = async () => FRB.resetEmail();
  FRB.resetEmail = async () => {
    need();
    const id = await confirmationTemplate();
    await rpc('mail.template', 'reset_template', [[id]]);
    return { template: id, result: 'reset to Odoo default' };
  };

  FRB.options = async () => {
    need();
    const out = {};
    const tries = [
      [[], ['website_sale.product_buy_now', 'website_sale.product_buy_now_large']],
      [[], ['website_sale.product_attributes_body']],
      [['website_sale.products_categories_top'], []],
      [[], ['website.header_call_to_action']],
      // enquiry-only: no wishlist, compare, quantity or sign-in until accounts and checkout are wanted
      [[], ['website_sale.add_to_wishlist', 'website_sale.product_add_to_wishlist', 'website_sale.header_wishlist_link']],
      [[], ['website_sale.add_to_compare', 'website_sale.product_add_to_compare']],
      [[], ['website_sale.product_quantity']],
      [[], ['portal.user_sign_in']],
      [[], ['website.brand_promotion']],
    ];
    for (const [en, dis] of tries) {
      try { await themeOption(en, dis); out[(en.concat(dis)).join(',')] = 'ok'; } catch (e) { out[(en.concat(dis)).join(',')] = 'skipped: ' + short(e); }
    }
    return out;
  };

  // ------------------------------------------------------------------ QWeb inherits (website-specific, removable)
  FRB.views = async (only) => {
    need();
    const list = await fetchJSON('views/views.json'), out = { done: [], errors: [] };
    for (const v of list) {
      if (only && only !== v.key) continue;
      if (v.retired) { // switched off (archived, not deleted)
        const ids = await rpc('ir.ui.view', 'search', [[['key', '=', 'website.' + v.key], ['website_id', '=', wid()]]]);
        if (ids.length) { await rpc('ir.ui.view', 'write', [ids, { active: false }]); out.done.push(v.key + ' archived'); }
        continue;
      }
      try {
        const arch = (await fetchText('views/' + v.file)).trim();
        checkXml(arch, v.file);
        const base = await viewFor(v.inherit);
        if (!base) throw new Error(v.inherit + ' not found');
        const key = 'website.' + v.key;
        const ex = (await rpc('ir.ui.view', 'search_read', [[['key', '=', key], ['website_id', '=', wid()]]], { fields: ['id'], context: { active_test: false } }))[0];
        if (ex) await rpc('ir.ui.view', 'write', [[ex.id], { arch_db: arch, active: true, inherit_id: base.id, name: v.name }], { context: wctx() });
        else await rpc('ir.ui.view', 'create', [{ name: v.name, type: 'qweb', key, inherit_id: base.id, mode: 'extension', priority: 90, website_id: wid(), arch_db: arch }], { context: wctx() });
        out.done.push(v.key + (ex ? ' updated' : ' created') + ' on ' + v.inherit + ' #' + base.id);
      } catch (e) { out.errors.push(v.key + ': ' + short(e)); }
    }
    return out;
  };
  FRB.removeViews = async () => {
    need();
    const ids = await rpc('ir.ui.view', 'search', [[['key', '=like', 'website.friction_%'], ['website_id', '=', wid()], ['inherit_id', '!=', false]]], { context: { active_test: false } });
    if (ids.length) await rpc('ir.ui.view', 'write', [ids, { active: false }]);
    return { deactivated: ids.length, note: 'Archived, not deleted. Run FRB.run("views") to switch them back on.' };
  };

  // ------------------------------------------------------------------ pages, menus, custom code, footer
  async function fill(str, { xml = true } = {}) {
    const C = await catalogue(), pages = await pagesJson(), cfg = FRB.cfg;
    const toks = [...new Set(str.match(/__[A-Z]+(?::[A-Za-z0-9_-]+)?__/g) || [])];
    const purl = {};
    const pids = Object.values(cfg.prod || {});
    if (pids.length) for (const r of await rpc('product.template', 'read', [pids], { fields: ['id', 'website_url'] })) purl[r.id] = r.website_url;
    const missing = [];
    const val = (t) => {
      const [, kind, arg] = t.match(/^__([A-Z]+)(?::([A-Za-z0-9_-]+))?__$/);
      const pid = arg && cfg.prod && cfg.prod[arg];
      switch (kind) {
        case 'PIMG': return pid ? `/web/image/product.template/${pid}/image_1024` : null;
        case 'PIMGL': return pid ? `/web/image/product.template/${pid}/image_1920` : null;
        case 'PROD': return pid ? (purl[pid] || `/shop/${pid}`) : null;
        case 'CAT': return (cfg.catUrl && cfg.catUrl[arg]) || null;
        case 'PAGE': { const p = pages.find((x) => x.key === arg); return p ? p.url : null; }
        case 'LOOKCARD': {
          const L = C.looks.find((x) => x.n === arg);
          if (!L || !pid) return null;
          const ribbon = C.ribbons.find((r) => r.key === L.badge);
          // A div, not one big link, so the card can hold its own WhatsApp button (custom_code_footer.html fills in the link)
          const href = esc(purl[pid] || '/shop/' + pid);
          return `<div class="fr-card"><a class="fr-card-media" href="${href}">`
            + `<img src="/web/image/product.template/${pid}/image_1024" alt="${esc(L.name + ': ' + L.visible.replace(/;/g, ','))}" loading="lazy"/>`
            + (ribbon ? `<span class="fr-badge fr-badge-${L.badge}">${esc(ribbon.name)}</span>` : '')
            + `</a><div class="fr-card-meta"><span class="fr-look-tag">Styled Look</span><h3><a href="${href}">${esc(L.name)}</a></h3><p>${esc(L.note)}</p><p class="fr-por-s">Price on request</p>`
            + `<a class="fr-btn fr-btn-red fr-card-cta" href="${BIZ.wa}" target="_blank" rel="noopener" data-look="${esc(L.name)}">Check Price &amp; Availability</a></div></div>`;
        }
        default: return null;
      }
    };
    let s = str;
    for (const t of toks) {
      let v = val(t);
      if (v == null) { missing.push(t); continue; }
      if (xml && !t.startsWith('__LOOKCARD')) v = String(v).replace(/&(?!amp;|#\d+;)/g, '&amp;').replace(/"/g, '&quot;');
      s = s.split(t).join(v);
    }
    return { s, missing };
  }
  FRB.fill = fill;

  async function writeHomepage(inner, seo) {
    const v = await viewFor('website.homepage');
    if (!v) throw new Error('website.homepage view not found');
    const arch = replaceById(v.arch_db, 'wrap', inner);
    if (!arch) throw new Error('No id="wrap" in the homepage view');
    await rpc('ir.ui.view', 'write', [[v.id], { arch_db: arch }], { context: wctx() });
    const page = (await rpc('website.page', 'search_read', [[['url', '=', '/'], ['website_id', 'in', [wid(), false]]]], { fields: ['id'] }))[0];
    if (page && seo) await writeSafe('website.page', [page.id], pick('website.page', { website_meta_title: seo.title, website_meta_description: seo.description }), wctx());
    return { key: 'homepage', view: v.id, copyOnWrite: !v.website_id };
  }
  async function upsertPage(p, inner, out) {
    const key = 'website.friction_page_' + p.key.replace(/[^a-z0-9]/gi, '_');
    const arch = `<t t-name="${key}"><t t-call="website.layout"><div id="wrap" class="oe_structure oe_empty">${inner}</div></t></t>`;
    let view = (await rpc('ir.ui.view', 'search_read', [[['key', '=', key], ['website_id', '=', wid()]]], { fields: ['id'], context: { active_test: false } }))[0];
    if (view) await rpc('ir.ui.view', 'write', [[view.id], { arch_db: arch, name: p.name, active: true }], { context: wctx() });
    else view = { id: idOf(await rpc('ir.ui.view', 'create', [{ name: p.name, type: 'qweb', key, arch_db: arch, website_id: wid() }], { context: wctx() })) };
    const clash = await rpc('website.page', 'search_read', [[['url', '=', p.url], ['website_id', 'in', [wid(), false]], ['view_id', '!=', view.id]]], { fields: ['id', 'name'] });
    for (const c of clash) {
      await rpc('website.page', 'write', [[c.id], { url: p.url + '-odoo-default', is_published: false }], { context: wctx() });
      out.conflicts.push(`${c.name} moved from ${p.url} to ${p.url}-odoo-default (unpublished)`);
    }
    let page = (await rpc('website.page', 'search_read', [[['view_id', '=', view.id]]], { fields: ['id'] }))[0];
    const pvals = pick('website.page', { url: p.url, is_published: p.published !== false, name: p.name, website_id: wid(),
      website_meta_title: p.seo && p.seo.title, website_meta_description: p.seo && p.seo.description });
    if (page) await rpc('website.page', 'write', [[page.id], pvals], { context: wctx() });
    else page = { id: idOf(await rpc('website.page', 'create', [Object.assign({ view_id: view.id }, pvals)], { context: wctx() })) };
    return { key: p.key, url: p.url, view: view.id, page: page.id };
  }
  FRB.pages = async (only) => {
    need();
    if (!FRB.cfg.prod || Object.keys(FRB.cfg.prod).length < 16) throw new Error('Run products first (all 16).');
    const pages = await pagesJson(), out = { done: [], missingTokens: [], conflicts: [], errors: [] };
    for (const p of pages) {
      if (!p.file || (only && only !== p.key)) continue;
      try {
        const { s, missing } = await fill((await fetchText('pages/' + p.file)).split('__PAGENAME__').join(esc(p.name)));
        if (missing.length) out.missingTokens.push(p.key + ': ' + missing.join(' '));
        checkXml(s, p.file);
        out.done.push(p.url === '/' ? await writeHomepage(s, p.seo) : await upsertPage(p, s, out));
      } catch (e) { out.errors.push(p.key + ': ' + short(e)); }
    }
    return out;
  };

  FRB.menus = async () => {
    need();
    const pages = await pagesJson(), WM = 'website.menu';
    let top = idOf((await rpc('website', 'read', [[wid()]], { fields: ['menu_id'] }))[0].menu_id);
    if (!top) top = ((await rpc(WM, 'search_read', [[['website_id', '=', wid()], ['parent_id', '=', false]]], { fields: ['id'] }))[0] || {}).id;
    if (!top) throw new Error('No main menu for this website');
    const kids = await rpc(WM, 'search_read', [[['parent_id', '=', top]]], { fields: ['id', 'name', 'url'] });
    const norm = (u) => String(u || '').replace(/[?#].*$/, '').replace(/\/+$/, '') || '/';
    const urlOf = (p) => (p.cat ? FRB.cfg.catUrl[p.cat] : p.url);
    const desired = pages.filter((p) => p.menu && !p.parent).sort((a, b) => a.sequence - b.sequence)
      .map((p) => ({ key: p.key, name: p.name, url: urlOf(p), sequence: p.sequence }));
    const used = new Set(), idByKey = {}, out = { updated: [], created: [], children: [], removed: [] };
    for (const d of desired) {
      if (!d.url) throw new Error('No URL for menu ' + d.name + ' (run categories first)');
      const hit = kids.find((k) => !used.has(k.id) && norm(k.url) === norm(d.url)) ||
        kids.find((k) => !used.has(k.id) && k.name.trim().toLowerCase() === d.name.toLowerCase());
      if (hit) { idByKey[d.key] = hit.id; await rpc(WM, 'write', [[hit.id], { name: d.name, url: d.url, sequence: d.sequence }]); out.updated.push(d.name); }
      else { idByKey[d.key] = idOf(await rpc(WM, 'create', [{ name: d.name, url: d.url, parent_id: top, website_id: wid(), sequence: d.sequence }])); out.created.push(d.name); }
      used.add(idByKey[d.key]);
    }
    // Dropdowns: entries with "parent" become children (Shop > All Looks, New Arrivals ... Footwear)
    for (const parentKey of [...new Set(pages.filter((p) => p.menu && p.parent).map((p) => p.parent))]) {
      const pid = idByKey[parentKey];
      if (!pid) continue;
      const have = await rpc(WM, 'search_read', [[['parent_id', '=', pid]]], { fields: ['id', 'name'] });
      const keep = new Set();
      for (const c of pages.filter((p) => p.menu && p.parent === parentKey).sort((a, b) => a.sequence - b.sequence)) {
        const vals = { name: c.name, url: urlOf(c), sequence: c.sequence };
        if (!vals.url) throw new Error('No URL for menu ' + c.name + ' (run categories first)');
        const hit = have.find((k) => !keep.has(k.id) && k.name.trim().toLowerCase() === c.name.toLowerCase());
        if (hit) { keep.add(hit.id); await rpc(WM, 'write', [[hit.id], vals]); }
        else keep.add(idOf(await rpc(WM, 'create', [Object.assign({ parent_id: pid, website_id: wid() }, vals)])));
        out.children.push(c.name);
      }
      const extra = have.filter((k) => !keep.has(k.id));
      if (extra.length) await rpc(WM, 'unlink', [extra.map((k) => k.id)]);
    }
    // The menu above is the whole navigation for this demo: Home is the wordmark, Visit Us replaces Contact us,
    // and the trial's extra app pages (Appointments etc.) stay reachable by URL only. Menu items are removed, pages are not.
    const remove = kids.filter((k) => !used.has(k.id));
    if (remove.length) await rpc(WM, 'unlink', [remove.map((k) => k.id)]);
    out.removed = remove.map((k) => `${k.name} (${k.url})`);
    return out;
  };

  // /shop renders the website_sale.products view, so its title and description live on that view.
  // Odoo's sample /contactus and /privacy pages carry demo text, so they stay unpublished until Friction approves real ones.
  FRB.seo = async () => {
    need();
    const out = {};
    const v = await viewFor('website_sale.products');
    if (!v) throw new Error('website_sale.products view not found');
    await rpc('ir.ui.view', 'write', [[v.id], { website_meta_title: FRB.text.shopTitle, website_meta_description: FRB.text.shopDesc }], v.website_id ? { context: wctx() } : {});
    out.shop = 'view ' + v.id;
    const samples = await rpc('website.page', 'search_read', [[['url', 'in', ['/contactus', '/privacy']], ['website_id', 'in', [wid(), false]], ['is_published', '=', true]]], { fields: ['id', 'url'] });
    if (samples.length) await rpc('website.page', 'write', [samples.map((s) => s.id), { is_published: false }]);
    out.unpublishedSamples = samples.map((s) => s.url);
    return out;
  };

  FRB.customCode = async () => {
    need();
    const out = { head: null, footer: null, footerView: null, missingTokens: [] };
    const head = await fill(await fetchText('theme/custom_code_head.html'), { xml: false });
    const foot = await fill(await fetchText('theme/custom_code_footer.html'), { xml: false });
    out.missingTokens.push(...head.missing, ...foot.missing);
    const errs = await writeSafe('website', [wid()], pick('website', { custom_code_head: head.s, custom_code_footer: foot.s }), wctx());
    out.head = errs.length ? errs.join('; ') : 'ok ' + head.s.length + ' chars';
    out.footer = 'ok ' + foot.s.length + ' chars';
    try {
      const fx = await fill(await fetchText('theme/footer.xml'));
      out.missingTokens.push(...fx.missing);
      checkXml(fx.s, 'footer.xml');
      const v = await viewFor('website.footer_custom');
      if (!v) out.footerView = 'skipped: website.footer_custom not found';
      else if (!v.active) out.footerView = 'skipped: another footer template is active';
      else {
        const arch = replaceById(v.arch_db, 'footer', fx.s);
        if (!arch) out.footerView = 'skipped: no id="footer" in the footer view';
        else { await rpc('ir.ui.view', 'write', [[v.id], { arch_db: arch }], { context: wctx() }); out.footerView = 'ok (view ' + v.id + (v.website_id ? '' : ', copy-on-write') + ')'; }
      }
    } catch (e) { out.footerView = 'skipped: ' + short(e); }
    return out;
  };

  // Odoo's header and snippets ship a placeholder phone (+1 555-555-5556). Swap in Friction's real number.
  FRB.placeholders = async () => {
    need();
    const rx = [[/tel:\+1 555-555-5556/g, 'tel:+12466221748'], [/\+1 555-555-5556/g, BIZ.phone]];
    const dom = [['type', '=', 'qweb'], ['website_id', 'in', [wid(), false]], ['key', 'not like', 'website.friction_'], ['arch_db', 'ilike', '555-555-5556']];
    // website templates only; skip a generic view when this website already has its own copy (the copy is what renders)
    const views = (await rpc('ir.ui.view', 'search_read', [dom], { fields: ['id', 'key', 'website_id', 'arch_db'] })).filter((v) => /^website/.test(v.key || ''));
    const generic = [...new Set(views.filter((v) => !v.website_id).map((v) => v.key))];
    const specific = new Set(generic.length ? (await rpc('ir.ui.view', 'search_read', [[['key', 'in', generic], ['website_id', '=', wid()]]], { fields: ['key'], context: { active_test: false } })).map((v) => v.key) : []);
    const out = { changed: [], errors: [] };
    for (const v of views) {
      if (!v.website_id && specific.has(v.key)) continue;
      let a = v.arch_db;
      for (const [r, s] of rx) a = a.replace(r, s);
      if (a === v.arch_db) continue;
      try { await rpc('ir.ui.view', 'write', [[v.id], { arch_db: a }], { context: wctx() }); out.changed.push(v.key); } catch (e) { out.errors.push(v.key + ': ' + short(e)); }
    }
    return out;
  };

  // ------------------------------------------------------------------ placeholder browser-tab icon until the logo file arrives
  // A white italic "F" in the header wordmark's font (Anton) on Friction red, drawn in this tab and saved as the website favicon.
  FRB.favicon = async () => {
    need();
    const css = await (await fetch('https://fonts.googleapis.com/css2?family=Anton&display=block', { credentials: 'omit' })).text();
    // Google splits the font into language subsets; only the "latin" one has the letter F
    const src = (css.match(/\/\*\s*latin\s*\*\/[^}]*?url\((https:[^)]+)\)/) || css.match(/url\((https:[^)]+)\)/) || [])[1];
    if (!src) throw new Error('Could not find the Anton font file');
    const face = new FontFace('FrictionAntonLatin', `url(${src})`);
    await face.load(); document.fonts.add(face);
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = '230px FrictionAntonLatin'; const wA = probe.measureText('F').width;
    probe.font = '230px serif'; const wS = probe.measureText('F').width;
    if (Math.abs(wA - wS) < 1) throw new Error('Anton did not load; favicon not saved');
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#E21B2D'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    // no "italic" in the font string: Anton has only an upright face, so asking for italic falls back to a serif
    g.font = '230px FrictionAntonLatin';
    g.setTransform(1, 0, -0.14, 1, 28, 0); // slant like the wordmark instead
    g.fillText('F', 128, 227);
    const b64 = c.toDataURL('image/png').split(',')[1];
    const errs = await writeSafe('website', [wid()], { favicon: b64 }, wctx());
    return { favicon: errs.length ? errs : 'ok', bytes: Math.round(b64.length * 0.75) };
  };

  // ------------------------------------------------------------------ real store items from Friction's Loyverse (26 Nov 2026)
  // The item data is PRIVATE (it is read from Loyverse, kept in Tech Nova's private notes) and is passed in as an argument;
  // nothing from Loyverse is stored in this public kit. items: [[loyverseId, posName, loyverseCategory, priceBBD, [[size, sku, stockOnHand]], photoFile]]
  // Items with a photo (photos in loyverse-photos/<id>.jpg) are published in Footwear; the rest are loaded unpublished.
  // Since 26 Nov 2026 items are SOLD ONLINE (click and collect): each size is a real variant of Odoo's "Size" attribute
  // with its own stock count, so a sold-out size can't be ordered and shows the WhatsApp enquiry instead.
  const KEEP_CAPS = new Set(['GS', 'AAPE', 'BBC', 'EPTM', 'TRNCHS', 'KDNK', 'PSD', 'NY', 'LA', 'WKND', 'ASICS', 'DUA', 'TD', 'II', 'III']);
  const SMALL_WORDS = new Set(['and', 'with', 'of', 'the', 'in']);
  FRB.itemName = (pos) => {
    let s = String(pos || '').trim().replace(/\s+/g, ' ')
      .replace(/\bAIRFORCE\b/gi, 'AIR FORCE').replace(/\bAIRMAX\b/gi, 'AIR MAX')
      .replace(/([A-Za-z]{2,})&([A-Za-z]{2,})/g, '$1 & $2');
    let first = true;
    return s.replace(/[A-Za-z][A-Za-z']*/g, (w) => {
      const u = w.toUpperCase(), l = w.toLowerCase(), wasFirst = first; first = false;
      if (KEEP_CAPS.has(u)) return u;
      if (!wasFirst && SMALL_WORDS.has(l)) return l;
      return u[0] + l.slice(1);
    });
  };
  const sizeRank = (s) => {
    const letters = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
    if (letters.includes(s)) return [0, letters.indexOf(s)];
    const n = parseFloat(s);
    if (/Y$/.test(s)) return [1, n];
    if (/W\//.test(s)) return [3, n];
    if (!isNaN(n) && n < 20) return [2, n];
    if (!isNaN(n)) return [4, n];
    return [5, 0];
  };
  FRB.loyverse = async (items, opts = {}) => {
    need();
    if (!Array.isArray(items) || !items.length) throw new Error('Pass the items from the private Loyverse file.');
    const { checked = '26 Nov 2026', offset = 0, limit = 25 } = opts;
    const T = 'product.template', A = 'product.attribute', V = 'product.attribute.value', PCI = 'product.category';
    const out = { created: [], updated: [], published: [], stock: 0, errors: [] };
    // Sizes are real variants of Odoo's own "Size" attribute (product.pa_size), each with a stock count
    const sizeX = await rpc('ir.model.data', 'search_read', [[['module', '=', 'product'], ['name', '=', 'pa_size'], ['model', '=', A]]], { fields: ['res_id'] });
    let attr = sizeX.length ? { id: sizeX[0].res_id } : null;
    if (!attr) attr = await upsert('attr_size', A, pick(A, { name: 'Size', create_variant: 'always', display_type: 'pills' }));
    await rpc(A, 'write', [[attr.id], pick(A, { create_variant: 'always', display_type: 'pills', visibility: 'visible' })]);
    const stockLoc = (await rpc('stock.warehouse', 'search_read', [[['company_id', '=', FRB.cfg.companyId || 1]]], { fields: ['lot_stock_id'], limit: 1 }))[0];
    if (!stockLoc) throw new Error('No warehouse found for the stock counts.');
    const LOC = idOf(stockLoc.lot_stock_id);
    const allSizes = [...new Set(items.flatMap((it) => (it[4] || []).map((z) => z[0]).filter(Boolean)))]
      .sort((a, b) => { const x = sizeRank(a), y = sizeRank(b); return x[0] - y[0] || x[1] - y[1] || a.localeCompare(b); });
    const have = await rpc(V, 'search_read', [[['attribute_id', '=', attr.id]]], { fields: ['id', 'name'] });
    const valId = {};
    for (const [i, n] of allSizes.entries()) {
      let v = have.find((x) => x.name === n);
      if (v) await rpc(V, 'write', [[v.id], { sequence: i + 1 }]);
      else v = { id: idOf(await rpc(V, 'create', [{ attribute_id: attr.id, name: n, sequence: i + 1 }])) };
      valId[n] = v.id;
    }
    // Internal product categories mirror Loyverse's (back office only; no empty shop categories)
    const root = await upsert('pcat_loyverse', PCI, { name: 'Loyverse' });
    const pcat = {};
    for (const c of [...new Set(items.map((it) => it[2] || ''))]) {
      const nm = c ? (c === c.toUpperCase() ? c[0] + c.slice(1).toLowerCase() : c) : 'Uncategorised';
      pcat[c] = (await upsert('pcat_loyverse_' + (nm.toLowerCase().replace(/[^a-z0-9]+/g, '_')), PCI, { name: nm, parent_id: root.id })).id;
    }
    // "In stock on" date shown on the site
    await rpc('ir.config_parameter', 'set_param', ['friction.stock_checked', checked]);
    const foot = FRB.cfg.cat && FRB.cfg.cat.footwear;
    if (!foot) throw new Error('Run categories first (Footwear category missing).');
    // The looks leave Footwear: it now lists the real shoes
    const lookIds = Object.values(FRB.cfg.prod || {});
    if (lookIds.length && offset === 0) await rpc(T, 'write', [lookIds, { public_categ_ids: [[3, foot]] }]);
    // Newest Loyverse items first, after the 16 looks (website_sequence 10..160)
    const order = items.map((it) => it[0]).sort((a, b) => b - a);
    for (const it of items.slice(offset, offset + limit)) {
      const [lid, pos, lcat, price, sizes = [], photo] = it;
      try {
        const name = FRB.itemName(pos), live = !!photo;
        const skus = sizes.map((z) => (z[0] ? z[0] + ' = ' : '') + z[1]);
        const sizeVals = sizes.map((z) => valId[z[0]]).filter(Boolean);
        const base = {
          // No Internal Reference: Odoo would put it in the product's web address (/shop/10237-asics-...). SKUs stay in the internal note.
          name, default_code: false,
          list_price: Number(price) || 0, sale_ok: true, purchase_ok: false, type: 'consu', is_storable: true,
          taxes_id: [[6, 0, []]], categ_id: pcat[lcat || ''], website_ribbon_id: false,
          is_published: live, public_categ_ids: [[6, 0, live ? [foot] : []]], website_sequence: 1000 + order.indexOf(lid),
          // Sold out = can't be ordered online; the product page then shows the WhatsApp enquiry instead of Add to cart
          allow_out_of_stock_order: false, show_availability: false, description_sale: false,
          out_of_stock_message: '<p>Sold out online in this size. Message Friction on WhatsApp and the team will check the shelf for you.</p>',
          description: `<p>Loaded from Friction's Loyverse on ${esc(checked)} (Loyverse item ${lid}, POS name "${esc(pos)}", category "${esc(lcat || 'none')}"). SKUs in stock that day: ${esc(skus.join(', ') || 'none')}. Prices and stock do not update by themselves: re-run the Loyverse step to refresh them.</p>`,
          website_meta_title: `${name} | Friction Clothing Barbados`,
          website_meta_description: `${name} at Friction Clothing, The Dome Mall, Warrens, Barbados. BBD $${Number(price).toFixed(2)}. Order online and collect in store.`,
        };
        if (live) base.image_1920 = await fetchB64(`loyverse-photos/${photo}`);
        const vals = pick(T, base);
        const key = 'lv_item_' + lid;
        let id = await xid(key, T);
        if (id) { await rpc(T, 'write', [[id], vals]); out.updated.push(name); }
        else { id = idOf(await rpc(T, 'create', [vals])); await setXid(key, T, id); out.created.push(name); }
        // Size line: keep it when it already lists exactly these sizes (variants and their stock survive), else rebuild
        const L = 'product.template.attribute.line';
        const lines = await rpc(L, 'search_read', [[['product_tmpl_id', '=', id]]], { fields: ['attribute_id', 'value_ids'] });
        const same = (l) => idOf(l.attribute_id) === attr.id && l.value_ids.length === sizeVals.length && sizeVals.every((v) => l.value_ids.includes(v));
        const keep = lines.length === (sizeVals.length ? 1 : 0) && (!sizeVals.length || same(lines[0]));
        if (!keep) {
          const cmds = lines.map((l) => [2, l.id]);
          if (sizeVals.length) cmds.push([0, 0, { attribute_id: attr.id, value_ids: [[6, 0, sizeVals]] }]);
          await rpc(T, 'write', [[id], { attribute_line_ids: cmds }]);
        }
        // Stock on hand per size (an inventory adjustment in WH/Stock)
        const variants = await rpc('product.product', 'search_read', [[['product_tmpl_id', '=', id]]], { fields: ['product_template_attribute_value_ids'] });
        const ptavs = variants.flatMap((v) => v.product_template_attribute_value_ids);
        const ptavVal = {};
        if (ptavs.length) for (const p of await rpc('product.template.attribute.value', 'read', [ptavs], { fields: ['product_attribute_value_id'] })) ptavVal[p.id] = idOf(p.product_attribute_value_id);
        const qtyOf = (v) => {
          if (!sizeVals.length) return sizes.reduce((n, z) => n + (Number(z[2]) || 0), 0);
          const val = v.product_template_attribute_value_ids.map((p) => ptavVal[p]).find(Boolean);
          const z = sizes.find((s) => valId[s[0]] === val);
          return z ? Number(z[2]) || 0 : 0;
        };
        const quants = [];
        for (const v of variants) {
          quants.push(idOf(await rpc('stock.quant', 'create', [{ product_id: v.id, location_id: LOC, inventory_quantity: qtyOf(v) }], { context: { inventory_mode: true } })));
        }
        if (quants.length) { await rpc('stock.quant', 'action_apply_inventory', [quants], { context: { inventory_mode: true } }); out.stock += quants.length; }
        if (live) out.published.push(name);
      } catch (e) { out.errors.push(lid + ': ' + short(e)); }
    }
    out.next = offset + limit < items.length ? offset + limit : null;
    return out;
  };

  // ------------------------------------------------------------------ verify (read-only)
  FRB.verify = async () => {
    need();
    const T = 'product.template', out = {};
    const ids = Object.values(FRB.cfg.prod || {});
    const rows = ids.length ? await rpc(T, 'read', [ids], { fields: ['name', 'list_price', 'is_published', 'public_categ_ids', 'website_ribbon_id', 'default_code'] }) : [];
    out.products = rows.length;
    out.published = rows.filter((r) => r.is_published).length;
    out.nonZeroPrices = rows.filter((r) => r.list_price).map((r) => r.name);
    out.skus = rows.filter((r) => r.default_code).map((r) => r.name);
    // Public pages as a logged-out visitor sees them: one H1, no internal notes, noindex kept, no sign-in, no cart or checkout
    const pages = {}, problems = [];
    const firstProduct = ids.length ? (await rpc(T, 'read', [[ids[0]]], { fields: ['website_url'] }))[0].website_url : null;
    const internal = /Client note|remove before launch|Private concept|Catalogue note|Client demo|working (catalogue |look )?names?|Details to confirm|demo only|Powered by/i;
    for (const u of ['/', '/shop', '/our-story', '/visit-us', '/enquiry-bag', ...(Object.values(FRB.cfg.catUrl || {})), firstProduct].filter(Boolean)) {
      try {
        const r = await fetch(u, { credentials: 'omit' });
        const d = new DOMParser().parseFromString(await r.text(), 'text/html');
        d.querySelectorAll('script,style').forEach((n) => n.remove());
        const h1 = d.querySelectorAll('h1').length, text = d.body.textContent;
        pages[u] = r.status + ' h1:' + h1;
        if (h1 !== 1) problems.push(`${u}: ${h1} H1s`);
        if (internal.test(text)) problems.push(`${u}: internal text "${text.match(internal)[0]}"`);
        if (!/noindex/.test((d.querySelector('meta[name="robots"]') || {}).content || '')) problems.push(`${u}: noindex missing`);
        if (!(d.querySelector('meta[name="description"]') || {}).content) problems.push(`${u}: no meta description`);
        if (d.querySelector('a[href^="/web/login"]')) problems.push(`${u}: Sign in link`);
        if (d.querySelector('.o_add_wishlist, .o_add_compare')) problems.push(`${u}: wishlist or compare control`);
        // unpriced styled looks must never offer Add to cart
        if (u === firstProduct && d.querySelector('#add_to_cart_wrap:not(.d-none)')) problems.push(`${u}: Add to cart on a styled look`);
      } catch (e) { pages[u] = short(e); }
    }
    out.publicStatus = pages;
    out.problems = problems;
    try { const r = await fetch(`/web/image/product.template/${ids[0]}/image_512`, { credentials: 'omit' }); out.imagePublic = r.status + ' ' + r.headers.get('content-type'); } catch (e) { out.imagePublic = short(e); }
    return out;
  };

  // ------------------------------------------------------------------ runners
  FRB.run = async (step, ...args) => {
    const t0 = performance.now();
    if (typeof FRB[step] !== 'function' || ['run', 'all', 'rpc', 'post', 'fill', 'fetchJSON', 'fetchText'].includes(step)) return { step, ok: false, error: 'Unknown step. See FRB.help().' };
    try { const report = await FRB[step](...args); save(); return { step, ok: true, ms: Math.round(performance.now() - t0), report }; }
    catch (e) { save(); return { step, ok: false, ms: Math.round(performance.now() - t0), error: short(e) }; }
  };
  FRB.ORDER = ['introspect', 'settings', 'theme', 'categories', 'ribbons', 'products', 'delivery', 'checkout', 'email',
    'options', 'views', 'pages', 'menus', 'seo', 'customCode', 'placeholders', 'verify'];
  FRB.all = async (from) => {
    const res = [];
    for (const step of FRB.ORDER.slice(from ? FRB.ORDER.indexOf(from) : 0)) {
      if (step === 'products') {
        let off = 0;
        while (off !== null) { const r = await FRB.run('products', off, 4); res.push(r); if (!r.ok) return res; off = r.report.next; }
        continue;
      }
      const r = await FRB.run(step); res.push(r);
      if (!r.ok) break;
    }
    return res;
  };
  FRB.help = () => FRB.ORDER.concat(['removeViews', 'resetEmail', 'theme({reset:true})', 'sizeAttr (only once real sizes and stock exist)']);
  return 'FRB ' + FRB.VERSION + ' ready. Next: await FRB.run("introspect")';
})();
