import React, { useState, useRef, useCallback, useEffect } from "react";

/**
 * JOSE — prototype app shell (FE0) + Reader (FE1) + Builder (FE4)
 * One routed shell; screens link up. Sample/demo content.
 * The Builder records AI provenance live: provenance is observed, not detected.
 */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Spectral:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=IBM+Plex+Mono:wght@400;500&display=swap');

.jose * { box-sizing:border-box; }
.jose {
  --paper:#F6F8F5; --ink:#18201B; --sub:#4A5650; --structure:#6E7C70;
  --rule:#D9DED6; --type-red:#A83A2C; --verified:#2E6E5E; --haze:#ECEFE9;
  --ai:#bcd4e2; --aih:#cfe0d6;
  --ui:'Inter Tight',system-ui,sans-serif; --body:'Spectral',Georgia,serif; --mono:'IBM Plex Mono',ui-monospace,monospace;
  background:var(--paper); color:var(--ink); font-family:var(--body); min-height:100vh; -webkit-font-smoothing:antialiased;
}
.jose button { font-family:var(--ui); cursor:pointer; }
.jose :focus-visible { outline:2px solid var(--type-red); outline-offset:2px; border-radius:2px; }

/* ---- Shell ---- */
.shell { display:grid; grid-template-columns:202px 1fr; min-height:100vh; }
.shell-nav { border-right:1px solid var(--rule); display:flex; flex-direction:column; padding:18px 14px; position:sticky; top:0; height:100vh; background:var(--paper); }
.shell-mark { font-family:var(--ui); font-weight:700; letter-spacing:.14em; font-size:15px; padding:4px 8px 22px; }
.shell-mark .dot { color:var(--type-red); }
.shell-navitem { display:flex; align-items:center; gap:11px; font-family:var(--ui); font-size:13px; color:var(--sub); border:0; background:transparent; text-align:left; padding:10px; border-radius:8px; width:100%; }
.shell-navitem:hover { background:var(--haze); }
.shell-navitem.active { background:var(--ink); color:var(--paper); }
.shell-navitem.stub { color:var(--structure); }
.shell-navitem .ni { width:16px; text-align:center; }
.shell-navitem .soon { margin-left:auto; font-size:8.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--structure); }
.shell-acct { margin-top:auto; font-family:var(--ui); font-size:12px; color:var(--sub); padding:11px 8px; border-top:1px solid var(--rule); }
.shell-acct .cert { color:var(--verified); font-weight:600; display:inline-flex; align-items:center; gap:5px; }
.shell-acct .cert::before { content:""; width:6px; height:6px; border-radius:50%; background:var(--verified); display:inline-block; }
.shell-main { min-width:0; }

/* ---- Lens bar ---- */
.jose-lensbar { font-family:var(--ui); border-bottom:1px solid var(--rule); background:linear-gradient(180deg,var(--paper),#fff); position:sticky; top:0; z-index:20; }
.jose-lensbar-inner { display:flex; flex-wrap:wrap; align-items:center; gap:7px 18px; padding:11px 22px; }
.jose-lens { display:flex; align-items:center; gap:9px; }
.jose-lens-label { font-size:10.5px; letter-spacing:.11em; text-transform:uppercase; color:var(--structure); }
.jose-seg { display:inline-flex; border:1px solid var(--rule); border-radius:6px; overflow:hidden; }
.jose-seg button { border:0; background:transparent; padding:5px 11px; font-size:12px; color:var(--sub); }
.jose-seg button[aria-pressed="true"] { background:var(--ink); color:var(--paper); }
.jose-chip { border:1px solid var(--rule); background:#fff; border-radius:6px; padding:5px 10px; font-size:12px; color:var(--ink); display:inline-flex; align-items:center; gap:8px; }
.jose-chip .mono { font-family:var(--mono); font-size:11px; color:var(--sub); }
.jose-toggle { border:1px solid var(--rule); background:#fff; border-radius:6px; padding:5px 10px; font-size:12px; color:var(--sub); display:inline-flex; align-items:center; gap:7px; }
.jose-toggle[aria-pressed="true"] { border-color:var(--type-red); color:var(--type-red); background:#fdf3f1; }
.jose-toggle .box { width:12px; height:12px; border:1.5px solid currentColor; border-radius:3px; display:inline-block; position:relative; }
.jose-toggle[aria-pressed="true"] .box::after { content:""; position:absolute; inset:2px; background:currentColor; border-radius:1px; }
.jose-slider { display:flex; align-items:center; gap:9px; }
.jose-slider input { accent-color:var(--ink); width:96px; }
.jose-slider .ends { font-size:10.5px; color:var(--structure); }
.jose-verbtn { position:relative; }
.jose-pop { position:absolute; top:36px; left:0; background:#fff; border:1px solid var(--rule); border-radius:8px; box-shadow:0 12px 34px rgba(24,32,27,.13); padding:8px; width:262px; z-index:40; }
.jose-pop h4 { font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--structure); margin:4px 6px 8px; }
.jose-vrow { display:flex; align-items:center; gap:10px; width:100%; text-align:left; border:0; background:transparent; padding:8px; border-radius:6px; }
.jose-vrow:hover, .jose-vrow[aria-current="true"] { background:var(--haze); }
.jose-vrow .node { width:9px; height:9px; border-radius:50%; border:2px solid var(--structure); flex:none; }
.jose-vrow.tip .node { background:var(--ink); border-color:var(--ink); }
.jose-vrow.vor .node { background:var(--verified); border-color:var(--verified); }
.jose-vrow .vlabel { font-size:12.5px; } .jose-vrow .vdate { font-family:var(--mono); font-size:10.5px; color:var(--sub); }
.jose-vrow .tag { margin-left:auto; font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; padding:2px 6px; border-radius:4px; }
.jose-vrow .tag.tip { background:var(--ink); color:var(--paper); } .jose-vrow .tag.vor { background:var(--verified); color:#fff; }
.jose-ailegend { font-family:var(--ui); font-size:11px; color:var(--sub); display:flex; gap:14px; align-items:center; padding:7px 22px; border-bottom:1px dashed var(--rule); background:#fff; }
.jose-ailegend i { width:13px; height:13px; border-radius:3px; display:inline-block; margin-right:5px; vertical-align:-2px; }

/* ---- Reading frame ---- */
.jose-frame { display:grid; grid-template-columns:34px minmax(0,1fr) 320px; max-width:1180px; margin:0 auto; }
.jose-gutter { border-right:1px solid var(--rule); position:relative; }
.jose-strata { position:sticky; top:92px; display:flex; flex-direction:column; gap:5px; padding:18px 0 0; align-items:center; }
.jose-strata span { width:5px; border-radius:3px; height:38px; background:var(--haze); }
.jose-strata span.on-rev { background:var(--type-red); opacity:.55; }
.jose-strata span.on-prov { background:var(--type-red); opacity:.32; }
.jose-strata span.on-ai { background:var(--structure); opacity:.45; }
.jose-strata .lbl { writing-mode:vertical-rl; font-family:var(--ui); font-size:9px; letter-spacing:.18em; text-transform:uppercase; color:var(--structure); margin-top:6px; }
.jose-col { padding:30px 40px 90px; min-width:0; }
.jose-meta { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:14px; }
.jose-badge { font-family:var(--ui); font-size:10.5px; letter-spacing:.06em; padding:3px 9px; border-radius:5px; border:1px solid var(--rule); color:var(--sub); }
.jose-badge.journal { border-color:var(--verified); color:var(--verified); }
.jose-doi { font-family:var(--mono); font-size:11.5px; color:var(--sub); background:var(--haze); border:0; padding:4px 9px; border-radius:5px; }
.jose-demo { font-family:var(--ui); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--structure); margin-left:auto; }
.jose-title { font-family:var(--body); font-weight:600; font-size:29px; line-height:1.18; margin:2px 0 4px; letter-spacing:-.01em; }
.jose-title i { font-style:italic; }
.jose-sec { font-family:var(--ui); font-size:12px; color:var(--sub); margin-bottom:26px; }
.jose-sec b { color:var(--ink); font-weight:500; }
.jose-h { font-family:var(--ui); font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--structure); margin:30px 0 12px; padding-bottom:7px; border-bottom:1px solid var(--rule); }
.jose-p { font-size:17px; margin:0 0 15px; max-width:62ch; line-height:1.55; }
.jose-p i { font-style:italic; }
.jose-block { position:relative; }
.jose-block.ai-on { background:#f3f6f8; box-shadow:-12px 0 0 #f3f6f8,12px 0 0 #f3f6f8; border-radius:2px; }
.jose-aitag { font-family:var(--ui); font-size:10px; letter-spacing:.05em; color:#3a6b86; display:inline-flex; align-items:center; gap:6px; margin-bottom:5px; }
.jose-aitag i { width:11px; height:11px; border-radius:3px; background:#bcd4e2; display:inline-block; }
.jose-prov { font-family:var(--mono); font-size:10.5px; color:var(--type-red); display:inline-flex; align-items:center; gap:6px; margin:-4px 0 12px; }
.jose-prov::before { content:""; width:6px; height:6px; background:var(--type-red); border-radius:50%; }
.jose-claim-marker { display:inline-flex; align-items:center; gap:6px; border:0; background:transparent; color:var(--type-red); font-family:var(--ui); font-size:12px; padding:0 0 0 6px; }
.jose-claim-marker .c { width:9px; height:9px; border-radius:50%; background:var(--type-red); display:inline-block; }
.jose-evidence { margin:6px 0 16px; border-left:2px solid var(--type-red); padding:9px 0 9px 14px; background:#fdf6f5; border-radius:0 4px 4px 0; }
.jose-evidence .et { font-family:var(--ui); font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--type-red); margin-bottom:7px; }
.jose-ev { display:flex; align-items:center; gap:9px; font-family:var(--mono); font-size:12px; color:var(--sub); padding:3px 0; }
.jose-ev .k { font-family:var(--ui); font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:var(--structure); width:62px; }
.jose-ev a { color:var(--ink); text-decoration:none; border-bottom:1px solid var(--rule); }
.jose-conf { font-family:var(--ui); font-size:11px; color:var(--structure); margin-top:6px; }
.jose-rev { margin:8px 0 16px; border-left:3px solid; padding:9px 13px; border-radius:0 5px 5px 0; font-family:var(--ui); }
.jose-rev.green { border-color:var(--verified); background:#eef5f2; }
.jose-rev.orange { border-color:#C8772A; background:#fbf2e8; }
.jose-rev .who { font-size:11px; color:var(--sub); display:flex; align-items:center; gap:8px; margin-bottom:4px; }
.jose-rev .disp { font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; padding:2px 7px; border-radius:4px; color:#fff; }
.jose-rev.green .disp { background:var(--verified); } .jose-rev.orange .disp { background:#C8772A; }
.jose-rev .note { font-size:13.5px; color:var(--ink); }
.jose-rev .reply { font-size:12.5px; color:var(--sub); margin-top:7px; padding-left:12px; border-left:2px solid var(--rule); }
.jose-rev .reply b { font-weight:500; color:var(--ink); }
.jose-dc { margin:6px 0 16px; border:1px dashed var(--structure); border-radius:6px; padding:12px 14px; background:#fcfcfb; }
.jose-dc .dch { font-family:var(--ui); font-size:10px; letter-spacing:.09em; text-transform:uppercase; color:var(--structure); margin-bottom:6px; display:flex; gap:8px; align-items:center; }
.jose-dc .un { color:#C8772A; } .jose-dc p { font-size:15px; font-style:italic; margin:0; color:var(--sub); }
.jose-fig { margin:14px 0 20px; }
.jose-figbox { height:150px; border:1px solid var(--rule); border-radius:6px; background:repeating-linear-gradient(135deg,#eef1ec,#eef1ec 9px,#e7ebe5 9px,#e7ebe5 18px); display:flex; align-items:center; justify-content:center; font-family:var(--ui); font-size:11px; color:var(--structure); }
.jose-cap { font-family:var(--ui); font-size:12.5px; color:var(--sub); margin-top:8px; }
.jose-cap .vb { color:var(--ink); } .jose-cap .more { font-size:10px; color:var(--type-red); letter-spacing:.06em; text-transform:uppercase; margin-left:7px; }
.jose-pop-lead { font-size:17px; }
.jose-news { border:1px solid var(--rule); border-radius:8px; padding:13px; margin:16px 0; background:#fff; }
.jose-news h5 { font-family:var(--ui); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--structure); margin:0 0 9px; }
.jose-news a { display:block; font-family:var(--ui); font-size:13px; color:var(--ink); text-decoration:none; padding:5px 0; border-bottom:1px solid var(--haze); }
.jose-news a span { color:var(--structure); font-size:11px; }
.jose-rail { border-left:1px solid var(--rule); padding:30px 22px 90px; font-family:var(--ui); }
.jose-rail h3 { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--structure); margin:0 0 14px; }
.jose-railitem { width:100%; text-align:left; border:0; background:transparent; border-top:1px solid var(--rule); padding:13px 2px; display:flex; align-items:flex-start; gap:11px; }
.jose-railitem:hover { background:var(--haze); }
.jose-railitem .ic { width:18px; color:var(--structure); flex:none; font-size:13px; }
.jose-railitem .t { font-size:13px; color:var(--ink); }
.jose-railitem .s { font-size:11px; color:var(--sub); font-family:var(--mono); margin-top:2px; }
.jose-railitem.active, .jose-railitem.active .ic, .jose-railitem.active .t { color:var(--type-red); }
.jose-vdag { display:flex; align-items:center; margin-top:8px; }
.jose-vdag .vn { width:11px; height:11px; border-radius:50%; border:2px solid var(--structure); background:#fff; }
.jose-vdag .vn.vor { background:var(--verified); border-color:var(--verified); } .jose-vdag .vn.tip { background:var(--ink); border-color:var(--ink); }
.jose-vdag .ed { height:2px; width:26px; background:var(--rule); }
.jose-banner { position:sticky; bottom:0; z-index:25; font-family:var(--ui); background:#fbf2e8; border-top:1px solid #e6c79e; padding:11px 22px; display:flex; align-items:center; gap:14px; font-size:13px; color:#7a521f; }
.jose-banner.vor { background:#eef5f2; border-top-color:#bcd9cd; color:var(--verified); }
.jose-banner button { margin-left:auto; border:1px solid currentColor; background:transparent; color:inherit; border-radius:6px; padding:6px 13px; font-size:12px; font-weight:600; }
.jose-citebtn { position:fixed; z-index:60; font-family:var(--ui); font-size:12px; font-weight:600; background:var(--ink); color:var(--paper); border:0; border-radius:7px; padding:8px 13px; box-shadow:0 8px 22px rgba(24,32,27,.25); display:inline-flex; align-items:center; gap:8px; }
.jose-citebtn .c { width:8px; height:8px; border-radius:50%; background:var(--type-red); }
.jose-citecard { position:fixed; z-index:61; width:320px; background:#fff; border:1px solid var(--rule); border-radius:10px; box-shadow:0 16px 44px rgba(24,32,27,.22); padding:15px; font-family:var(--ui); }
.jose-citecard h4 { font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--structure); margin:0 0 10px; }
.jose-anchor { font-family:var(--mono); font-size:11px; color:var(--sub); line-height:1.7; background:var(--haze); border-radius:6px; padding:9px 10px; margin-bottom:11px; word-break:break-all; }
.jose-anchor b { color:var(--ink); font-weight:500; }
.jose-quote { font-family:var(--body); font-style:italic; font-size:13px; color:var(--ink); border-left:2px solid var(--type-red); padding-left:10px; margin-bottom:12px; }
.jose-citecard .row { display:flex; gap:8px; }
.jose-citecard .row button { flex:1; border-radius:7px; padding:8px; font-size:12px; font-weight:600; border:1px solid var(--rule); background:#fff; color:var(--ink); }
.jose-citecard .row button.primary { background:var(--ink); color:var(--paper); border-color:var(--ink); }
.jose-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:70; font-family:var(--ui); font-size:13px; background:var(--ink); color:var(--paper); padding:10px 16px; border-radius:8px; box-shadow:0 10px 28px rgba(24,32,27,.3); }

/* ---- Builder ---- */
.bld-head { display:flex; flex-wrap:wrap; align-items:center; gap:12px; padding:15px 26px; border-bottom:1px solid var(--rule); position:sticky; top:0; background:var(--paper); z-index:20; }
.bld-title { font-family:var(--body); font-weight:600; font-size:20px; border:0; background:transparent; color:var(--ink); min-width:200px; flex:1; }
.bld-title::placeholder { color:var(--structure); }
.bld-pill { position:relative; }
.bld-pillbtn { font-family:var(--ui); font-size:12px; border:1px solid var(--rule); background:#fff; border-radius:6px; padding:6px 10px; color:var(--sub); display:inline-flex; gap:7px; align-items:center; }
.bld-pillbtn .d { width:7px; height:7px; border-radius:50%; background:var(--structure); }
.bld-pillbtn.commons .d { background:var(--verified); }
.bld-pillbtn.ai { color:#1c4a63; border-color:#9cc1d6; }
.bld-menu { position:absolute; top:36px; right:0; background:#fff; border:1px solid var(--rule); border-radius:8px; box-shadow:0 12px 30px rgba(24,32,27,.14); padding:6px; min-width:180px; z-index:40; }
.bld-menu button { width:100%; text-align:left; border:0; background:transparent; font-family:var(--ui); font-size:12.5px; color:var(--ink); padding:8px 10px; border-radius:6px; }
.bld-menu button:hover { background:var(--haze); }
.bld-menu .sub { font-size:10px; color:var(--structure); padding:6px 10px 4px; letter-spacing:.08em; text-transform:uppercase; }
.bld-body { display:grid; grid-template-columns:minmax(0,1fr) 322px; }
.bld-editor { padding:24px 34px 40px; border-right:1px solid var(--rule); min-height:62vh; }
.bld-seg { position:relative; margin:0 0 4px; border-radius:7px; }
.bld-seg textarea { width:100%; font-family:var(--body); font-size:17px; line-height:1.55; color:var(--ink); border:0; background:transparent; resize:none; padding:9px 11px; border-radius:7px; overflow:hidden; display:block; }
.bld-seg textarea:focus { background:#fff; box-shadow:0 0 0 1px var(--rule); outline:none; }
.bld-seg.v-ai textarea { background:#eef4f8; }
.bld-seg.v-aih textarea { background:#eef5ef; }
.bld-seg.claim textarea { border-left:3px solid var(--type-red); background:#fdf6f5; }
.bld-seg.obs textarea { border-left:3px solid var(--structure); font-family:var(--mono); font-size:13px; }
.bld-segtag { font-family:var(--ui); font-size:9px; letter-spacing:.06em; text-transform:uppercase; padding:2px 7px; border-radius:4px; position:absolute; right:10px; top:-8px; z-index:2; }
.bld-segtag.ai { background:var(--ai); color:#1c4a63; }
.bld-segtag.aih { background:var(--aih); color:#1f5440; }
.bld-segtag.human { background:var(--haze); color:var(--sub); }
.bld-segtools { display:flex; gap:6px; padding:1px 11px 6px; opacity:0; transition:opacity .12s; }
.bld-seg:hover .bld-segtools, .bld-seg:focus-within .bld-segtools { opacity:1; }
.bld-segtools button { font-family:var(--ui); font-size:11px; color:var(--sub); border:1px solid var(--rule); background:#fff; border-radius:5px; padding:3px 8px; }
.bld-segtools button.ai { color:#1c4a63; } .bld-segtools button .sp { color:var(--type-red); }
.bld-toolbar { display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; padding-top:16px; border-top:1px solid var(--rule); }
.bld-tbtn { font-family:var(--ui); font-size:12.5px; border:1px solid var(--rule); background:#fff; border-radius:7px; padding:7px 12px; color:var(--ink); display:inline-flex; gap:7px; align-items:center; position:relative; }
.bld-tbtn.ai { border-color:#9cc1d6; color:#1c4a63; }
.bld-tbtn .sp { color:var(--type-red); }
.bld-rail { padding:24px 22px; font-family:var(--ui); }
.bld-rh { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--structure); margin:0 0 6px; }
.bld-rsub { font-size:11px; color:var(--sub); margin-bottom:16px; }
.bld-cov { display:inline-flex; align-items:center; gap:6px; font-size:11px; color:var(--verified); font-weight:600; margin-bottom:14px; }
.bld-cov::before { content:""; width:6px; height:6px; border-radius:50%; background:var(--verified); }
.bld-bar { display:flex; height:13px; border-radius:7px; overflow:hidden; border:1px solid var(--rule); margin:4px 0 9px; }
.bld-bar .h { background:var(--haze); } .bld-bar .a { background:var(--ai); } .bld-bar .ah { background:var(--aih); }
.bld-leg { display:flex; flex-direction:column; gap:5px; font-size:11.5px; color:var(--sub); margin-bottom:18px; }
.bld-leg .lr { display:flex; align-items:center; gap:8px; }
.bld-leg .sw { width:11px; height:11px; border-radius:3px; }
.bld-leg b { margin-left:auto; font-family:var(--mono); font-size:11px; color:var(--ink); font-weight:500; }
.bld-drow { display:flex; gap:9px; font-size:12px; padding:7px 0; border-top:1px solid var(--rule); }
.bld-drow .k { color:var(--structure); width:88px; font-size:10.5px; letter-spacing:.05em; text-transform:uppercase; padding-top:2px; }
.bld-drow .v { color:var(--ink); flex:1; }
.bld-rolechip { display:inline-block; font-size:11px; background:var(--haze); color:var(--sub); border-radius:5px; padding:2px 8px; margin:0 5px 5px 0; }
.bld-model { font-family:var(--mono); font-size:11.5px; color:var(--ink); }
.bld-export { display:flex; flex-wrap:wrap; gap:7px; margin-top:6px; }
.bld-export button { font-family:var(--ui); font-size:11.5px; border:1px solid var(--rule); background:#fff; border-radius:6px; padding:6px 11px; color:var(--ink); }
.bld-foot { position:sticky; bottom:0; background:var(--paper); border-top:1px solid var(--rule); padding:13px 26px; display:flex; gap:10px; align-items:center; }
.bld-foot button { font-family:var(--ui); font-size:13px; border-radius:8px; padding:9px 16px; border:1px solid var(--rule); background:#fff; color:var(--ink); font-weight:500; }
.bld-foot button.primary { background:var(--ink); color:var(--paper); border-color:var(--ink); }
.bld-foot .spacer { margin-left:auto; }

/* ---- Stub ---- */
.stub { max-width:560px; margin:90px auto; text-align:center; font-family:var(--ui); color:var(--sub); }
.stub h2 { font-family:var(--body); font-weight:600; font-size:26px; color:var(--ink); margin:0 0 10px; }
.stub .pill { display:inline-block; font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--type-red); border:1px solid var(--rule); border-radius:20px; padding:4px 12px; margin-bottom:18px; }

@media (max-width:880px){
  .shell { grid-template-columns:1fr; }
  .shell-nav { position:static; height:auto; flex-direction:row; flex-wrap:wrap; align-items:center; gap:4px; }
  .shell-mark { padding:4px 8px; } .shell-acct { margin-top:0; border-top:0; }
  .jose-frame { grid-template-columns:1fr; } .jose-gutter { display:none; }
  .jose-rail { border-left:0; border-top:1px solid var(--rule); }
  .bld-body { grid-template-columns:1fr; } .bld-editor { border-right:0; border-bottom:1px solid var(--rule); }
}
@media (prefers-reduced-motion:reduce){ .jose *, .jose *::before, .jose *::after { transition:none!important; animation:none!important; } }
`;

const VERSIONS = [
  { id:"v1", label:"v1", date:"2026-05-10", kind:"old" },
  { id:"v2", label:"v2", date:"2026-06-02", kind:"vor", doi:"10.59321/jose.aizo.0142" },
  { id:"v3", label:"v3", date:"2026-06-23", kind:"tip" },
];
const TIP = 2, VOR = 1;
const fakeHash = (s) => { let h=0x811c9dc5; for (let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193);} return ("0000000"+(h>>>0).toString(16)).slice(-8); };

const NAV = [
  { id:"reader", label:"Reader", ic:"❑" },
  { id:"builder", label:"Builder", ic:"✎" },
  { id:"map", label:"Distribution", ic:"◰", stub:"FE2" },
  { id:"review", label:"Review", ic:"◷", stub:"FE5" },
];

export default function App() {
  const [view, setView] = useState("reader");
  return (
    <div className="jose">
      <style>{CSS}</style>
      <div className="shell">
        <nav className="shell-nav">
          <div className="shell-mark">JOSE<span className="dot">.</span></div>
          {NAV.map(n => (
            <button key={n.id} className={`shell-navitem ${view===n.id?"active":""} ${n.stub?"stub":""}`} onClick={()=>setView(n.id)}>
              <span className="ni">{n.ic}</span>{n.label}{n.stub && <span className="soon">{n.stub}</span>}
            </button>
          ))}
          <div className="shell-acct">R. Botha<br/><span className="cert">certified</span></div>
        </nav>
        <main className="shell-main">
          {view==="reader" && <ReaderScreen />}
          {view==="builder" && <BuilderScreen onOpenReader={()=>setView("reader")} />}
          {(view==="map" || view==="review") && <Stub n={NAV.find(x=>x.id===view)} />}
        </main>
      </div>
    </div>
  );
}

function Stub({ n }) {
  return (
    <div className="stub">
      <div className="pill">next · {n.stub}</div>
      <h2>{n.label}</h2>
      <p>This screen is next in the build sequence. The Reader and Builder are live — pick either from the nav to explore them.</p>
    </div>
  );
}

/* ============================= READER ============================= */
function ReaderScreen() {
  const [vIdx, setVIdx] = useState(TIP);
  const [verOpen, setVerOpen] = useState(false);
  const [depth, setDepth] = useState(0);
  const [register, setRegister] = useState("academic");
  const [ann, setAnn] = useState({ reviewer:true, provenance:false, ai:false });
  const [claims, setClaims] = useState({});
  const [citer, setCiter] = useState(null);
  const [card, setCard] = useState(null);
  const [toast, setToast] = useState(null);
  const bodyRef = useRef(null);

  const verbose = depth > 50;
  const ver = VERSIONS[vIdx];
  const vno = vIdx + 1;
  const { reviewer:showRev, provenance:showProv, ai:showAi } = ann;
  const pop = register === "popular";

  const flash = (m) => { setToast(m); setTimeout(()=>setToast(null), 1800); };
  const toggleAnn = (k) => setAnn(a => ({ ...a, [k]: !a[k] }));
  const toggleClaim = (id) => setClaims(c => ({ ...c, [id]: !c[id] }));

  const onMouseUp = useCallback(() => {
    try {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !bodyRef.current) { setCiter(null); return; }
      const txt = sel.toString().trim();
      if (txt.length < 4) { setCiter(null); return; }
      let node = sel.anchorNode;
      if (!bodyRef.current.contains(node)) { setCiter(null); return; }
      let el = node.nodeType === 3 ? node.parentElement : node;
      while (el && !el.getAttribute?.("data-block") && el !== bodyRef.current) el = el.parentElement;
      const block = el?.getAttribute?.("data-block") || "body";
      const r = sel.getRangeAt(0).getBoundingClientRect();
      setCard(null);
      setCiter({ x: Math.min(r.left + r.width/2, window.innerWidth-90), y: Math.max(r.top - 44, 8), text: txt, block });
    } catch { setCiter(null); }
  }, []);

  const openCard = () => { if (!citer) return; setCard({ ...citer, x: Math.min(citer.x, window.innerWidth-340), y: Math.min(citer.y+48, window.innerHeight-260) }); setCiter(null); };
  const copyCite = () => { const c=card; const cite=`Botha 2026, §description (JOSE ${ver.label}, ${ver.date}; ver:sha256-${fakeHash(c.text)}…#${c.block})`; try{navigator.clipboard?.writeText(cite);}catch{} setCard(null); flash("Citation copied"); };
  const Prov = ({ text }) => showProv ? <div className="jose-prov">{text}</div> : null;

  return (
    <div onMouseDown={() => setVerOpen(false)}>
      <div className="jose-lensbar" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="jose-lensbar-inner">
          <div className="jose-lens">
            <span className="jose-lens-label">⟲ Version</span>
            <div className="jose-verbtn">
              <button className="jose-chip" onClick={()=>setVerOpen(o=>!o)} aria-expanded={verOpen}>
                {ver.label} · <span className="mono">{ver.date}</span> ▾
                {vIdx===VOR && <span style={{color:"var(--verified)",fontWeight:600,fontSize:11}}>⚐ VoR</span>}
                {vIdx===TIP && <span style={{color:"var(--ink)",fontWeight:600,fontSize:11}}>tip</span>}
              </button>
              {verOpen && (
                <div className="jose-pop">
                  <h4>Version history</h4>
                  {VERSIONS.map((v,i)=>(
                    <button key={v.id} className={`jose-vrow ${v.kind==="tip"?"tip":""} ${v.kind==="vor"?"vor":""}`} aria-current={i===vIdx} onClick={()=>{setVIdx(i); setVerOpen(false);}}>
                      <span className="node" />
                      <span><span className="vlabel">{v.label}</span> · <span className="vdate">{v.date}</span></span>
                      {v.kind==="tip" && <span className="tag tip">tip</span>}
                      {v.kind==="vor" && <span className="tag vor">VoR · DOI</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="jose-lens"><span className="jose-lens-label">🌐 Lang</span><span className="jose-chip">en <span style={{color:"var(--structure)"}}>▾</span></span></div>
          <div className="jose-lens">
            <span className="jose-lens-label">◑ Depth</span>
            <div className="jose-slider"><span className="ends">surface</span>
              <input type="range" min="0" max="100" value={depth} onChange={e=>setDepth(+e.target.value)} aria-label="Depth lens" />
              <span className="ends">verbose</span></div>
          </div>
          <div className="jose-lens">
            <span className="jose-lens-label">Aa Register</span>
            <div className="jose-seg" role="group">
              <button aria-pressed={register==="academic"} onClick={()=>setRegister("academic")}>Academic</button>
              <button aria-pressed={register==="popular"} onClick={()=>setRegister("popular")}>Popular</button>
            </div>
          </div>
          <div className="jose-lens">
            <span className="jose-lens-label">◫ Annotations</span>
            <button className="jose-toggle" aria-pressed={ann.reviewer} onClick={()=>toggleAnn("reviewer")}><span className="box"/>Reviewer</button>
            <button className="jose-toggle" aria-pressed={ann.provenance} onClick={()=>toggleAnn("provenance")}><span className="box"/>Provenance</button>
            <button className="jose-toggle" aria-pressed={ann.ai} onClick={()=>toggleAnn("ai")}><span className="box"/>AI</button>
          </div>
        </div>
      </div>

      {showAi && (
        <div className="jose-ailegend"><span>AI content view:</span>
          <span><i style={{background:"#dfe7e2"}}/>human</span><span><i style={{background:"#bcd4e2"}}/>AI</span><span><i style={{background:"#cfe0d6"}}/>AI → human</span>
        </div>
      )}

      <div className="jose-frame">
        <div className="jose-gutter">
          <div className="jose-strata" title="Active lens strata">
            <span className={showRev?"on-rev":""} /><span className={showProv?"on-prov":""} /><span className={showAi?"on-ai":""} /><span className={verbose?"on-prov":""} />
            <span className="lbl">lenses</span>
          </div>
        </div>

        <div className="jose-col" ref={bodyRef} onMouseUp={onMouseUp}>
          <div className="jose-meta">
            <span className="jose-badge">Commons</span>
            <span className="jose-badge journal">Journal · VoR</span>
            <button className="jose-doi" onClick={()=>flash("DOI citation copied")}>{VERSIONS[VOR].doi}</button>
            <span className="jose-demo">demo content</span>
          </div>
          <h1 className="jose-title"><i>Mesembryanthemum aureum</i> Botha</h1>
          <div className="jose-sec">sec. <b>Botha 2026</b> · Aizoaceae · a living treatment</div>

          <div className="jose-h">Description</div>
          {pop ? (
            <div className="jose-block" data-block="blk:pop"><p className="jose-p jose-pop-lead">A small, frost-sheened succulent from South Africa's Knersvlakte. Its leaves are studded with tiny water-filled cells that catch the light, and its flowers open in the afternoon for visiting bees.</p></div>
          ) : (
            <>
              <div className="jose-block" data-block="blk:d1">
                <Prov text="added v1 · R. Botha" />
                <p className="jose-p">Compact, mat-forming leaf-succulent; leaves opposite, terete to semi-terete, 8–20&nbsp;mm long, densely covered in glistening bladder cells (papillae) that lend the plant a frosted appearance.
                  <button className="jose-claim-marker" onClick={()=>toggleClaim("c1")}><span className="c"/>claim</button></p>
                {claims.c1 && (<div className="jose-evidence"><div className="et">Evidence</div>
                  <div className="jose-ev"><span className="k">specimen</span><a href="#">Botha 1142 (NBG)</a></div>
                  <div className="jose-ev"><span className="k">figure</span><a href="#">Fig 1 · habit</a></div>
                  <div className="jose-conf">confidence: author-asserted</div></div>)}
                {showRev && (<div className="jose-rev green"><div className="who"><span className="disp">green · incorporated</span> A. Klak · ORCID 0000-0002-…</div><div className="note">Diagnosis is clear and well supported by the bladder-cell character.</div></div>)}
              </div>
              <div className={`jose-block ${showAi?"ai-on":""}`} data-block="blk:d2">
                {showAi && <div className="jose-aitag"><i/>AI-drafted · human-reviewed</div>}
                <Prov text="added v1 · AI → R. Botha" />
                <p className="jose-p">The bladder cells are most conspicuous on young growth and along the leaf margins, where they form a dense, water-storing epidermal layer that reduces transpiration in the open quartz fields.</p>
              </div>
              <div className="jose-block" data-block="blk:d3">
                <Prov text={vno>=3 ? "amended v3 · R. Botha" : "added v2 · R. Botha"} />
                <p className="jose-p">{vno>=3 ? "Flowers solitary, terminal, opening in the early afternoon and closing by dusk." : "Flowers solitary, terminal, opening near midday."}</p>
              </div>
              {vno>=3 && (<div className="jose-block" data-block="blk:d4">
                <Prov text="added v3 · from micro-observation" />
                <p className="jose-p">Visited by solitary bees (<i>Anthophora</i> sp.); a single timed visit was recorded at the type locality.
                  <button className="jose-claim-marker" onClick={()=>toggleClaim("c2")}><span className="c"/>claim</button></p>
                {claims.c2 && (<div className="jose-evidence"><div className="et">Evidence</div>
                  <div className="jose-ev"><span className="k">micro-obs</span><a href="#">obs:441 · Casabio</a></div>
                  <div className="jose-ev"><span className="k">figure</span><a href="#">Fig 2 · visitor</a></div>
                  <div className="jose-conf">confidence: author-asserted · single observation</div></div>)}
              </div>)}
            </>
          )}

          <div className="jose-fig" data-block="blk:fig1">
            <div className="jose-figbox">image — Fig 1 (JXL)</div>
            <div className="jose-cap">{verbose ? <span className="vb">Fig 1. Habit, in cultivation; note the frosted bladder cells dense along the leaf margins and the solitary terminal flower in early afternoon.</span> : <>Fig 1. Habit, in cultivation.<span className="more">+ verbose</span></>}</div>
          </div>

          <div className="jose-h">Nomenclature &amp; Type</div>
          <div className="jose-block" data-block="blk:n1">
            <Prov text={vno>=3 ? "amended v3 · barcode added" : "added v1 · R. Botha"} />
            <p className="jose-p">Type: SOUTH AFRICA, Western Cape, Knersvlakte [locality generalised to QDS 3118], <i>Botha 1142</i> (holo-: NBG{vno>=3 ? <span style={{fontFamily:"var(--mono)",fontSize:13}}> 0123456</span> : ""}).</p>
            {showRev && (<div className="jose-rev orange"><div className="who"><span className="disp">orange · seen, not incorporated</span> J. Smith · ORCID 0000-0003-…</div><div className="note">Holotype barcode not cited.</div><div className="reply"><b>Author reply:</b> {vno>=3 ? "Barcode NBG0123456 added in v3." : "Will add the barcode in the next version."}</div></div>)}
          </div>

          {vno>=2 && (<>
            <div className="jose-h">Distribution</div>
            <div className="jose-block" data-block="blk:dist1">
              <Prov text="added v2 · R. Botha" />
              <p className="jose-p">Recorded from the Knersvlakte and adjacent quartz patches; 38 accepted observations span seven quarter-degree squares. Localities are shown at QDS resolution (~20×20&nbsp;km).</p>
              {verbose && (<div className="jose-dc"><div className="dch">Director's cut · <span className="un">unreviewed</span></div><p>The apparent gap east of the type locality likely reflects under-collecting rather than true absence; two unverified sight records from 2019 await voucher confirmation.</p></div>)}
            </div>
          </>)}

          {pop && (<div className="jose-news"><h5>In the news</h5>
            <a href="#">Quartz-field succulents and the poaching crisis <span>· Daily Maverick</span></a>
            <a href="#">New treatments from the Knersvlakte <span>· SANBI blog</span></a></div>)}
        </div>

        <div className="jose-rail">
          <h3>Evidence</h3>
          <button className="jose-railitem"><span className="ic">◰</span><span><span className="t">Distribution (QDS)</span><span className="s">{vno>=2?"38 obs · 7 QDS":"—"}</span><div style={{marginTop:6}}><QDSMini/></div></span></button>
          <button className="jose-railitem"><span className="ic">▤</span><span><span className="t">Specimens</span><span className="s">12 vouchers</span></span></button>
          <button className="jose-railitem"><span className="ic">⛓</span><span><span className="t">Sequences</span><span className="s">GenBank MN9921 · MN9922</span></span></button>
          <button className={`jose-railitem ${showProv?"active":""}`} onClick={()=>toggleAnn("provenance")}><span className="ic">●</span><span><span className="t">Provenance overlay</span><span className="s">{showProv?"on":"off"}</span></span></button>
          <button className="jose-railitem" onClick={()=>setVerOpen(true)}><span className="ic">⟲</span><span><span className="t">Versions</span><div className="jose-vdag"><span className="vn"/><span className="ed"/><span className="vn vor"/><span className="ed"/><span className="vn tip"/></div><span className="s">v1 · v2 (VoR) · v3 (tip)</span></span></button>
        </div>
      </div>

      {vIdx < TIP && (<div className={`jose-banner ${vIdx===VOR?"vor":""}`}>{vIdx===VOR ? <>⚐ This is the Version of Record — frozen and citable. The living treatment has advanced since.</> : <>⚠ You opened {ver.label}. A newer version exists.</>}<button onClick={()=>setVIdx(TIP)}>View latest (v3)</button></div>)}

      {citer && (<button className="jose-citebtn" style={{ left:citer.x-58, top:citer.y }} onMouseDown={(e)=>e.preventDefault()} onClick={openCard}><span className="c"/> Cite this passage</button>)}
      {card && (<div className="jose-citecard" style={{ left:card.x, top:card.y }} onMouseDown={(e)=>e.stopPropagation()}>
        <h4>Snippet anchor</h4>
        <div className="jose-anchor">version <b>{ver.label}</b> · {ver.date}<br/>section <b>§description</b><br/>block <b>{card.block}</b><br/>hash <b>sha256-{fakeHash(card.text)}…</b></div>
        <div className="jose-quote">“{card.text.length>120?card.text.slice(0,120)+"…":card.text}”</div>
        <div className="row"><button onClick={()=>setCard(null)}>Cancel</button><button className="primary" onClick={copyCite}>Copy citation</button></div>
      </div>)}
      {toast && <div className="jose-toast">{toast}</div>}
    </div>
  );
}

/* ============================= BUILDER ============================= */
const AI_POOL = [
  "The capsule is hygrochastic, opening when wetted to release seeds in response to rain — a dispersal strategy common among arid-adapted Aizoaceae.",
  "Bladder cells on the epidermis store water and scatter excess light, buffering the plant against the high irradiance of open quartz fields.",
  "Populations are patchily distributed across quartz gravel, where reduced competition and a cooler root zone appear to favour establishment.",
  "Anthesis is concentrated in the early afternoon, with flowers closing by dusk and reopening over several successive days.",
  "Seeds are small and D-shaped, retained within the locular cavity until sufficient moisture prompts the keels to separate the valves.",
  "Vegetative growth is slow; individuals may persist for years as compact cushions barely raised above the gravel surface.",
];
let aiCursor = 0;
const pickAI = () => { const t = AI_POOL[aiCursor % AI_POOL.length]; aiCursor++; return t; };
const uid = () => "s" + Math.random().toString(36).slice(2, 8);

function AutoTextarea({ value, onChange, className, placeholder }) {
  const ref = useRef(null);
  const grow = () => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } };
  useEffect(() => { grow(); }, [value]);
  return <textarea ref={ref} className={className} value={value} placeholder={placeholder} rows={1} onChange={(e)=>onChange(e.target.value)} onInput={grow} />;
}

function BuilderScreen({ onOpenReader }) {
  const [title, setTitle] = useState("Mesembryanthemum aureum");
  const [tier, setTier] = useState("draft");          // draft | commons
  const [visibility, setVisibility] = useState("private");
  const [aiAccount, setAiAccount] = useState("generic");
  const [aiView, setAiView] = useState(true);
  const [roles, setRoles] = useState([]);
  const [menu, setMenu] = useState(null);              // 'vis' | 'ai' | 'insert' | 'export'
  const [toast, setToast] = useState(null);
  const [segments, setSegments] = useState([
    { id: uid(), origin: "human", text: "Compact, mat-forming leaf-succulent; leaves opposite, terete to semi-terete, densely covered in glistening bladder cells (papillae) that lend the plant a frosted appearance." },
  ]);

  const flash = (m) => { setToast(m); setTimeout(()=>setToast(null), 1800); };
  const addRole = (r) => setRoles((rs)=> rs.includes(r) ? rs : [...rs, r]);

  const updateSeg = (id, text) => {
    const seg = segments.find((g)=>g.id===id);
    const flip = seg && seg.origin === "ai" && text !== seg.aiOriginal;
    setSegments((prev)=> prev.map((g)=> g.id===id ? { ...g, text, origin: flip ? "ai-human" : g.origin } : g));
    if (flip) addRole("editing");
  };
  const aiDraft = () => { const t = pickAI(); setSegments((s)=> [...s, { id: uid(), origin: "ai", text: t, aiOriginal: t }]); addRole("drafting"); };
  const aiExpand = (afterId) => {
    const t = pickAI();
    setSegments((s)=> { const i = s.findIndex((g)=>g.id===afterId); const next=[...s]; next.splice(i+1, 0, { id: uid(), origin: "ai", text: t, aiOriginal: t }); return next; });
    addRole("expansion");
  };
  const addHuman = () => setSegments((s)=> [...s, { id: uid(), origin: "human", text: "" }]);
  const insertClaim = () => { setSegments((s)=> [...s, { id: uid(), origin: "human", type: "claim", text: "New claim — state it, then attach evidence." }]); setMenu(null); };
  const insertObs = () => { setSegments((s)=> [...s, { id: uid(), origin: "human", type: "obs", text: "obs:____ — link a Casabio observation" }]); setMenu(null); };
  const removeSeg = (id) => setSegments((s)=> s.filter((g)=>g.id!==id));

  // composition (by characters)
  let h=0, a=0, ah=0;
  segments.forEach((g)=>{ const n=g.text.length; if (g.origin==="ai") a+=n; else if (g.origin==="ai-human") ah+=n; else h+=n; });
  const tot = h+a+ah || 1;
  const pct = (x)=> Math.round((x/tot)*100);

  const exportMd = () => {
    const lines = segments.map((g)=> g.type==="claim" ? `> **Claim.** ${g.text}` : g.type==="obs" ? `- ${g.text}` : g.text);
    const md = `# ${title}\n\n${lines.join("\n\n")}\n\n---\n\n*AI provenance (recorded on-platform)* — roles: ${roles.join(", ")||"none"}; model: ${aiAccount==="generic"?"claude-sonnet-4-6 (generic)":"linked account"}; accountable: R. Botha.\n*Recorded composition* — human ${pct(h)}% · AI ${pct(a)}% · AI-edited ${pct(ah)}%.\n`;
    try {
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = (title||"treatment").replace(/\s+/g,"_") + ".md";
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      flash("Exported as Markdown");
    } catch { flash("Export blocked by sandbox — copy manually"); }
    setMenu(null);
  };

  const closeMenus = () => setMenu(null);

  return (
    <div onMouseDown={closeMenus}>
      <div className="bld-head" onMouseDown={(e)=>e.stopPropagation()}>
        <input className="bld-title" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Untitled treatment" />

        <div className="bld-pill">
          <button className={`bld-pillbtn ${tier==="commons"?"commons":""}`} onClick={()=> setMenu(menu==="vis"?null:"vis")}>
            <span className="d" />{tier==="commons" ? "Commons" : "Draft"} · {visibility} ▾
          </button>
          {menu==="vis" && (<div className="bld-menu"><div className="sub">Visibility</div>
            {["private","collaborators","public"].map(v=>(<button key={v} onClick={()=>{setVisibility(v); setMenu(null);}}>{v}</button>))}
          </div>)}
        </div>

        <div className="bld-pill">
          <button className="bld-pillbtn ai" onClick={()=> setMenu(menu==="ai"?null:"ai")}>✦ {aiAccount==="generic"?"generic AI":"linked AI"} ▾</button>
          {menu==="ai" && (<div className="bld-menu"><div className="sub">AI assistance</div>
            <button onClick={()=>{setAiAccount("generic"); setMenu(null);}}>Use generic AI</button>
            <button onClick={()=>{setAiAccount("linked"); setMenu(null); flash("BYO-AI — wired in backend");}}>Link your account…</button>
          </div>)}
        </div>

        <button className="jose-toggle" aria-pressed={aiView} onClick={()=>setAiView(v=>!v)}><span className="box"/>AI view</button>
      </div>

      <div className="bld-body">
        {/* editor */}
        <div className="bld-editor">
          {segments.map((g)=>{
            const vcls = aiView ? (g.origin==="ai" ? "v-ai" : g.origin==="ai-human" ? "v-aih" : "") : "";
            const tcls = g.type==="claim" ? "claim" : g.type==="obs" ? "obs" : "";
            return (
              <div key={g.id} className={`bld-seg ${vcls} ${tcls}`}>
                {aiView && (<span className={`bld-segtag ${g.origin==="ai"?"ai":g.origin==="ai-human"?"aih":"human"}`}>
                  {g.origin==="ai"?"AI":g.origin==="ai-human"?"AI → human":"human"}</span>)}
                <AutoTextarea className="" value={g.text} onChange={(t)=>updateSeg(g.id, t)} placeholder="Write…" />
                <div className="bld-segtools">
                  <button className="ai" onClick={()=>aiExpand(g.id)}><span className="sp">✦</span> AI expand</button>
                  {g.origin!=="human" && <button onClick={()=>flash("Edit the text to mark it AI → human")}>edit to claim</button>}
                  <button onClick={()=>removeSeg(g.id)}>remove</button>
                </div>
              </div>
            );
          })}

          <div className="bld-toolbar">
            <button className="bld-tbtn ai" onClick={aiDraft}><span className="sp">✦</span> AI draft paragraph</button>
            <button className="bld-tbtn" onClick={addHuman}>＋ Paragraph</button>
            <div className="bld-pill">
              <button className="bld-tbtn" onMouseDown={(e)=>e.stopPropagation()} onClick={()=> setMenu(menu==="insert"?null:"insert")}>Insert ▾</button>
              {menu==="insert" && (<div className="bld-menu" onMouseDown={(e)=>e.stopPropagation()}><div className="sub">Insert</div>
                <button onClick={insertClaim}>Claim</button>
                <button onClick={insertObs}>Observation</button>
                <button onClick={()=>{setMenu(null); flash("Figure & cite — wired in backend");}}>Figure</button>
                <button onClick={()=>{setMenu(null); flash("Figure & cite — wired in backend");}}>Citation</button>
              </div>)}
            </div>
          </div>
        </div>

        {/* provenance rail */}
        <div className="bld-rail">
          <h3 className="bld-rh">Authorship</h3>
          <div className="bld-rsub">Provenance is recorded as you write, not detected after.</div>
          <div className="bld-cov">coverage: recorded</div>

          <div className="bld-bar">
            <div className="h" style={{ width: pct(h)+"%" }} />
            <div className="a" style={{ width: pct(a)+"%" }} />
            <div className="ah" style={{ width: pct(ah)+"%" }} />
          </div>
          <div className="bld-leg">
            <div className="lr"><span className="sw" style={{background:"var(--haze)"}}/>human <b>{pct(h)}%</b></div>
            <div className="lr"><span className="sw" style={{background:"var(--ai)"}}/>AI <b>{pct(a)}%</b></div>
            <div className="lr"><span className="sw" style={{background:"var(--aih)"}}/>AI → human <b>{pct(ah)}%</b></div>
          </div>

          <div className="bld-drow"><div className="k">roles</div><div className="v">{roles.length ? roles.map(r=> <span key={r} className="bld-rolechip">{r}</span>) : <span style={{color:"var(--structure)"}}>none yet</span>}</div></div>
          <div className="bld-drow"><div className="k">model</div><div className="v bld-model">{aiAccount==="generic" ? "claude-sonnet-4-6 (generic)" : "your linked account"}</div></div>
          <div className="bld-drow"><div className="k">accountable</div><div className="v">R. Botha · ORCID 0000-0002-…</div></div>

          <div style={{height:18}} />
          <h3 className="bld-rh">Export</h3>
          <div className="bld-rsub">Walks out at any stage — no cage.</div>
          <div className="bld-export">
            <button onClick={exportMd}>Markdown</button>
            <button onClick={()=>flash("docx generated server-side")}>docx</button>
            <button onClick={()=>flash("JATS generated server-side")}>JATS</button>
            <button onClick={()=>flash("JSON generated server-side")}>JSON</button>
          </div>
        </div>
      </div>

      <div className="bld-foot" onMouseDown={(e)=>e.stopPropagation()}>
        <button onClick={()=>flash("Draft saved")}>Save draft</button>
        <button onClick={()=>flash("Review requested — reviewers nominated")}>Request review</button>
        <button className="primary" onClick={()=>{ setTier("commons"); setVisibility("public"); flash("Published to Commons"); }}>Publish to Commons</button>
        <span className="spacer" />
        <button onClick={onOpenReader}>Open in Reader →</button>
      </div>

      {toast && <div className="jose-toast">{toast}</div>}
    </div>
  );
}

function QDSMini() {
  const cells = [[1,0],[2,1],[0,2],[2,2],[3,1],[1,3],[3,3]];
  return (
    <svg width="150" height="92" viewBox="0 0 150 92">
      {[...Array(5)].map((_,i)=><line key={"v"+i} x1={i*30} y1="0" x2={i*30} y2="92" stroke="#D9DED6"/>)}
      {[...Array(4)].map((_,i)=><line key={"h"+i} x1="0" y1={i*23} x2="150" y2={i*23} stroke="#D9DED6"/>)}
      {cells.map(([x,y],i)=><rect key={i} x={x*30+3} y={y*23+3} width="24" height="17" fill="#2E6E5E" opacity="0.32"/>)}
      <circle cx="78" cy="40" r="4" fill="#A83A2C"/><circle cx="78" cy="40" r="8" fill="none" stroke="#A83A2C" opacity="0.5"/>
    </svg>
  );
}
