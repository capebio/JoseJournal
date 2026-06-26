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
.bx-head { display:flex; flex-wrap:wrap; align-items:center; gap:11px; padding:13px 26px; border-bottom:1px solid var(--rule); position:sticky; top:0; background:var(--paper); z-index:30; }
.bx-title-in { font-family:var(--body); font-weight:600; font-size:19px; border:0; background:transparent; color:var(--ink); min-width:150px; flex:1; }
.bx-title-in::placeholder { color:var(--structure); }
.bx-modeseg { display:inline-flex; border:1px solid var(--rule); border-radius:7px; overflow:hidden; }
.bx-modeseg button { border:0; background:#fff; padding:6px 14px; font-size:12.5px; color:var(--sub); font-family:var(--ui); }
.bx-modeseg button[aria-pressed="true"] { background:var(--ink); color:var(--paper); }
.bx-pill { position:relative; }
.bx-pillbtn { font-family:var(--ui); font-size:12px; border:1px solid var(--rule); background:#fff; border-radius:6px; padding:6px 10px; color:var(--sub); display:inline-flex; gap:7px; align-items:center; }
.bx-pillbtn .d { width:7px; height:7px; border-radius:50%; background:var(--structure); }
.bx-pillbtn.commons .d { background:var(--verified); }
.bx-menu { position:absolute; top:36px; right:0; background:#fff; border:1px solid var(--rule); border-radius:8px; box-shadow:0 12px 30px rgba(24,32,27,.14); padding:6px; min-width:170px; z-index:40; }
.bx-menu button { width:100%; text-align:left; border:0; background:transparent; font-family:var(--ui); font-size:12.5px; color:var(--ink); padding:8px 10px; border-radius:6px; }
.bx-menu button:hover { background:var(--haze); }
.bx-menu .sub { font-size:10px; color:var(--structure); padding:6px 10px 4px; letter-spacing:.08em; text-transform:uppercase; }
.bx-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:7px; padding:8px 26px; border-bottom:1px solid var(--rule); position:sticky; top:50px; background:var(--paper); z-index:25; }
.bx-tb { font-family:var(--ui); font-size:12.5px; border:1px solid var(--rule); background:#fff; border-radius:6px; padding:6px 11px; color:var(--ink); display:inline-flex; gap:6px; align-items:center; }
.bx-tb.cite { border-color:#d8b4ad; color:var(--type-red); }
.bx-tb.ai { border-color:#9cc1d6; color:#1c4a63; }
.bx-tb .ital { font-family:var(--body); font-style:italic; font-weight:600; }
.bx-tb .sp { color:var(--type-red); }
.bx-div { width:1px; height:20px; background:var(--rule); margin:0 3px; }
.bx-body { display:grid; grid-template-columns:minmax(0,1fr) 332px; }
.bx-main { padding:24px 38px 70px; border-right:1px solid var(--rule); min-height:64vh; }
.bx-doc { max-width:700px; }
.bx-doc-title { font-family:var(--body); font-weight:600; font-size:27px; line-height:1.2; border:0; background:transparent; width:100%; color:var(--ink); resize:none; padding:0; display:block; overflow:hidden; }
.bx-authors { font-family:var(--ui); font-size:13px; color:var(--sub); border:0; background:transparent; width:100%; margin:9px 0 20px; }
.bx-absbox { border-left:3px solid var(--rule); padding-left:14px; margin-bottom:20px; }
.bx-abslab { font-family:var(--ui); font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--structure); margin-bottom:4px; }
.bx-block { position:relative; margin:0 0 3px; }
.bx-para { width:100%; font-family:var(--body); font-size:16.5px; line-height:1.6; color:var(--ink); border:0; background:transparent; resize:none; padding:7px 9px; border-radius:6px; display:block; overflow:hidden; }
.bx-para:focus { background:#fff; box-shadow:0 0 0 1px var(--rule); outline:none; }
.bx-block.v-ai .bx-para { background:#eef4f8; }
.bx-block.v-aih .bx-para { background:#eef5ef; }
.bx-block.claim .bx-para { border-left:3px solid var(--type-red); background:#fdf6f5; }
.bx-heading-in { width:100%; font-family:var(--ui); font-weight:600; font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--structure); border:0; background:transparent; padding:16px 9px 4px; }
.bx-figure { border:1px dashed var(--rule); border-radius:8px; padding:11px; margin:7px 0; background:#fcfdfb; }
.bx-figbox { height:84px; border-radius:6px; background:repeating-linear-gradient(135deg,#eef1ec,#eef1ec 9px,#e7ebe5 9px,#e7ebe5 18px); display:flex; align-items:center; justify-content:center; font-family:var(--ui); font-size:11px; color:var(--structure); margin-bottom:8px; }
.bx-figcap { width:100%; font-family:var(--ui); font-size:12.5px; color:var(--sub); border:0; background:transparent; resize:none; overflow:hidden; display:block; }
.bx-blocktools { position:absolute; right:6px; top:-8px; display:flex; gap:5px; opacity:0; transition:opacity .12s; z-index:3; }
.bx-block:hover .bx-blocktools, .bx-block:focus-within .bx-blocktools { opacity:1; }
.bx-blocktools button { font-family:var(--ui); font-size:10.5px; color:var(--sub); border:1px solid var(--rule); background:#fff; border-radius:5px; padding:2px 7px; }
.bx-blocktools button.ai { color:#1c4a63; }
.bx-segtag { position:absolute; left:9px; top:-7px; font-family:var(--ui); font-size:9px; letter-spacing:.05em; text-transform:uppercase; padding:1px 6px; border-radius:4px; z-index:2; }
.bx-segtag.ai { background:var(--ai); color:#1c4a63; }
.bx-segtag.aih { background:var(--aih); color:#1f5440; }
.bx-addrow { display:flex; flex-wrap:wrap; gap:7px; margin-top:14px; padding-top:14px; border-top:1px solid var(--rule); }
.bx-addbtn { font-family:var(--ui); font-size:12.5px; border:1px solid var(--rule); background:#fff; border-radius:7px; padding:7px 11px; color:var(--ink); position:relative; }
.bx-addbtn.ai { border-color:#9cc1d6; color:#1c4a63; }
/* preview */
.bx-prev { max-width:700px; font-family:var(--body); }
.bx-prev h1 { font-size:27px; font-weight:600; line-height:1.22; margin:0 0 8px; color:var(--ink); }
.bx-prev h1 i { font-style:italic; }
.bx-prev .by { font-family:var(--ui); font-size:13px; color:var(--sub); margin-bottom:20px; }
.bx-prev .abs { font-size:15.5px; color:#2a322c; border-left:3px solid var(--rule); padding-left:14px; margin-bottom:22px; }
.bx-prev .abs .lab { font-family:var(--ui); font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--structure); display:block; margin-bottom:4px; }
.bx-prev h2 { font-family:var(--ui); font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--structure); margin:26px 0 10px; border-bottom:1px solid var(--rule); padding-bottom:6px; }
.bx-prev p { font-size:16.5px; line-height:1.62; margin:0 0 14px; }
.bx-prev p i, .bx-prev .abs i { font-style:italic; }
.bx-prev .claim { border-left:3px solid var(--type-red); background:#fdf6f5; padding:9px 13px; border-radius:0 5px 5px 0; margin:0 0 14px; }
.bx-prev .claim b { color:var(--type-red); font-weight:600; font-family:var(--ui); font-size:11px; letter-spacing:.05em; text-transform:uppercase; }
.bx-cite { color:var(--type-red); cursor:pointer; font-variant-numeric:tabular-nums; }
.bx-cite:hover { text-decoration:underline; }
.bx-cite-bad { color:var(--structure); }
.bx-living { font-size:.74em; vertical-align:super; color:var(--verified); margin-left:1px; }
.bx-refs { margin-top:32px; }
.bx-refitem { display:grid; grid-template-columns:32px 1fr; gap:4px; font-size:14px; line-height:1.5; margin-bottom:11px; color:#2a322c; scroll-margin-top:120px; padding:4px 6px; border-radius:5px; }
.bx-refitem.ad { grid-template-columns:1fr; }
.bx-refitem .rn { font-family:var(--mono); font-size:12px; color:var(--structure); }
.bx-refitem.hl { background:#fdf6f5; }
.bx-refitem i { font-style:italic; }
.bx-refdoi { font-family:var(--mono); font-size:11px; color:var(--sage); }
.bx-refliving { font-family:var(--ui); font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--verified); border:1px solid #bcd9cd; border-radius:4px; padding:0 5px; margin-left:6px; }
/* rail */
.bx-railtabs { display:flex; border-bottom:1px solid var(--rule); position:sticky; top:0; background:var(--paper); z-index:5; }
.bx-railtabs button { flex:1; font-family:var(--ui); font-size:12px; padding:13px 8px; border:0; background:transparent; color:var(--sub); border-bottom:2px solid transparent; }
.bx-railtabs button[aria-pressed="true"] { color:var(--ink); border-bottom-color:var(--type-red); font-weight:500; }
.bx-railbody { padding:20px 20px 50px; font-family:var(--ui); }
.bx-rh { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--structure); margin:0 0 6px; }
.bx-rsub { font-size:11px; color:var(--sub); margin-bottom:14px; line-height:1.5; }
.bx-cov { display:inline-flex; align-items:center; gap:6px; font-size:11px; color:var(--verified); font-weight:600; margin-bottom:13px; }
.bx-cov::before { content:""; width:6px; height:6px; border-radius:50%; background:var(--verified); }
.bx-bar { display:flex; height:13px; border-radius:7px; overflow:hidden; border:1px solid var(--rule); margin:4px 0 9px; }
.bx-bar .h { background:var(--haze); } .bx-bar .a { background:var(--ai); } .bx-bar .ah { background:var(--aih); }
.bx-leg { display:flex; flex-direction:column; gap:5px; font-size:11.5px; color:var(--sub); margin-bottom:18px; }
.bx-leg .lr { display:flex; align-items:center; gap:8px; } .bx-leg .sw { width:11px; height:11px; border-radius:3px; } .bx-leg b { margin-left:auto; font-family:var(--mono); font-size:11px; color:var(--ink); font-weight:500; }
.bx-drow { display:flex; gap:9px; font-size:12px; padding:7px 0; border-top:1px solid var(--rule); }
.bx-drow .k { color:var(--structure); width:84px; font-size:10.5px; letter-spacing:.05em; text-transform:uppercase; padding-top:2px; }
.bx-drow .v { color:var(--ink); flex:1; }
.bx-rolechip { display:inline-block; font-size:11px; background:var(--haze); color:var(--sub); border-radius:5px; padding:2px 8px; margin:0 5px 5px 0; }
.bx-model { font-family:var(--mono); font-size:11.5px; color:var(--ink); }
.bx-stylewrap { display:flex; align-items:center; gap:9px; margin-bottom:14px; }
.bx-stylewrap .lab { font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--structure); }
.bx-stoggle { display:inline-flex; border:1px solid var(--rule); border-radius:6px; overflow:hidden; }
.bx-stoggle button { border:0; background:#fff; font-family:var(--ui); font-size:11px; padding:5px 10px; color:var(--sub); }
.bx-stoggle button[aria-pressed="true"] { background:var(--ink); color:var(--paper); }
.bx-addref { width:100%; font-family:var(--ui); font-size:12.5px; border:1px dashed var(--rule); background:#fff; border-radius:8px; padding:10px; color:var(--ink); margin-bottom:14px; }
.bx-refcard { border:1px solid var(--rule); border-radius:8px; padding:11px 12px; margin-bottom:9px; background:#fff; }
.bx-refcard .rtop { display:flex; align-items:center; gap:7px; }
.bx-refcard .rt { font-size:9px; letter-spacing:.08em; text-transform:uppercase; color:#fff; background:var(--structure); border-radius:4px; padding:1px 6px; }
.bx-refcard .rt.jose { background:var(--verified); }
.bx-refcard .rkey { font-family:var(--mono); font-size:10.5px; color:var(--sage); margin-left:auto; }
.bx-refcard .rmeta { font-size:12.5px; color:var(--ink); margin:7px 0 0; line-height:1.4; }
.bx-refcard .rmeta i { font-style:italic; }
.bx-refcard .ver { font-family:var(--mono); font-size:10px; color:var(--sage); margin-top:4px; }
.bx-refcard .rfoot { display:flex; align-items:center; gap:10px; margin-top:9px; }
.bx-refcard .used { font-family:var(--mono); font-size:10.5px; color:var(--structure); }
.bx-refcard .used.zero { color:#C8772A; }
.bx-refcard .ins { margin-left:auto; font-family:var(--ui); font-size:11px; border:1px solid var(--rule); background:#fff; border-radius:5px; padding:4px 10px; color:var(--type-red); font-weight:500; }
/* picker modal */
.bx-pick-back { position:fixed; inset:0; background:rgba(20,28,22,.34); z-index:80; display:flex; align-items:flex-start; justify-content:center; padding-top:8vh; }
.bx-pick { width:min(560px,94vw); max-height:82vh; overflow:auto; background:#fff; border:1px solid var(--rule); border-radius:12px; box-shadow:0 24px 64px rgba(20,28,22,.32); }
.bx-pick-h { display:flex; align-items:center; gap:10px; padding:15px 18px; border-bottom:1px solid var(--rule); position:sticky; top:0; background:#fff; z-index:2; }
.bx-pick-h h4 { font-family:var(--ui); font-size:14px; margin:0; flex:1; }
.bx-pick-h .x { border:0; background:transparent; font-size:20px; line-height:1; color:var(--structure); cursor:pointer; }
.bx-pick-sec { padding:14px 18px; }
.bx-search { width:100%; font-family:var(--ui); font-size:13.5px; padding:10px 12px; border:1px solid var(--rule); border-radius:8px; }
.bx-search:focus { outline:none; box-shadow:0 0 0 1px var(--type-red); border-color:var(--type-red); }
.bx-pickitem { width:100%; text-align:left; border:0; background:transparent; border-radius:7px; padding:9px 10px; display:block; }
.bx-pickitem:hover { background:var(--haze); }
.bx-pickitem .pt { font-family:var(--body); font-size:14px; color:var(--ink); }
.bx-pickitem .pt i { font-style:italic; }
.bx-pickitem .pm { font-family:var(--ui); font-size:11.5px; color:var(--sub); margin-top:1px; }
.bx-pickitem .pm .jose { color:var(--verified); font-weight:600; }
.bx-empty { font-family:var(--ui); font-size:12.5px; color:var(--structure); padding:8px 10px; }
.bx-methods { display:flex; gap:7px; flex-wrap:wrap; padding:14px 18px 4px; border-top:1px solid var(--rule); }
.bx-methlab { width:100%; font-family:var(--ui); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--structure); margin-bottom:2px; }
.bx-method { font-family:var(--ui); font-size:12px; border:1px solid var(--rule); background:#fff; border-radius:7px; padding:7px 11px; color:var(--ink); }
.bx-method[aria-pressed="true"] { background:var(--ink); color:var(--paper); border-color:var(--ink); }
.bx-form { padding:14px 18px 18px; display:flex; flex-direction:column; gap:9px; }
.bx-form input, .bx-form select { font-family:var(--ui); font-size:13px; padding:9px 10px; border:1px solid var(--rule); border-radius:7px; width:100%; background:#fff; color:var(--ink); }
.bx-form input:focus, .bx-form select:focus { outline:none; box-shadow:0 0 0 1px var(--type-red); border-color:var(--type-red); }
.bx-form .row2 { display:flex; gap:9px; }
.bx-form .go { font-family:var(--ui); font-size:13px; font-weight:600; background:var(--ink); color:var(--paper); border:0; border-radius:8px; padding:11px; cursor:pointer; }
.bx-form .hint { font-family:var(--ui); font-size:11px; color:var(--structure); line-height:1.5; }
.bx-josecard { border:1px solid var(--rule); border-radius:8px; padding:11px; }
.bx-josecard .jt { font-family:var(--body); font-size:13.5px; color:var(--ink); }
.bx-josecard .jt i { font-style:italic; }
.bx-josecard .jv { display:flex; gap:7px; margin-top:8px; }
.bx-josecard .jv button { font-family:var(--ui); font-size:11.5px; border:1px solid var(--rule); background:#fff; border-radius:6px; padding:5px 10px; color:var(--ink); }
.bx-josecard .jv button.vor { border-color:#bcd9cd; color:var(--verified); }
.bx-foot { position:sticky; bottom:0; background:var(--paper); border-top:1px solid var(--rule); padding:13px 26px; display:flex; gap:10px; align-items:center; z-index:20; }
.bx-foot button { font-family:var(--ui); font-size:13px; border-radius:8px; padding:9px 16px; border:1px solid var(--rule); background:#fff; color:var(--ink); font-weight:500; }
.bx-foot button.primary { background:var(--ink); color:var(--paper); border-color:var(--ink); }
.bx-foot .spacer { margin-left:auto; }
@media (max-width:880px){ .bx-body { grid-template-columns:1fr; } .bx-main { border-right:0; border-bottom:1px solid var(--rule); } }


/* ---- Stub ---- */
.stub { max-width:560px; margin:90px auto; text-align:center; font-family:var(--ui); color:var(--sub); }
.stub h2 { font-family:var(--body); font-weight:600; font-size:26px; color:var(--ink); margin:0 0 10px; }
.stub .pill { display:inline-block; font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--type-red); border:1px solid var(--rule); border-radius:20px; padding:4px 12px; margin-bottom:18px; }

/* ---- Review ---- */
.rv-head { display:flex; flex-wrap:wrap; align-items:center; gap:12px; padding:15px 26px; border-bottom:1px solid var(--rule); position:sticky; top:0; background:var(--paper); z-index:20; }
.rv-h-title { font-family:var(--body); font-weight:600; font-size:20px; }
.rv-h-title i { font-style:italic; }
.rv-status { font-family:var(--ui); font-size:11px; color:var(--verified); border:1px solid #bcd9cd; background:#eef5f2; border-radius:20px; padding:4px 11px; display:inline-flex; align-items:center; gap:6px; }
.rv-status::before { content:""; width:6px; height:6px; border-radius:50%; background:var(--verified); }
.rv-body { display:grid; grid-template-columns:minmax(0,1fr) 312px; }
.rv-main { padding:26px 34px 60px; border-right:1px solid var(--rule); }
.rv-railc { padding:26px 22px; }
.rv-sec { font-family:var(--ui); font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--structure); margin:0 0 14px; padding-bottom:7px; border-bottom:1px solid var(--rule); }
.rv-sec.mt { margin-top:34px; }
.rv-card { border:1px solid var(--rule); border-radius:10px; padding:14px 15px; margin-bottom:12px; background:#fff; border-left:4px solid var(--structure); }
.rv-card.green { border-left-color:var(--verified); } .rv-card.yellow { border-left-color:#C9A23A; }
.rv-card.orange { border-left-color:#C8772A; } .rv-card.red { border-left-color:var(--type-red); }
.rv-top { display:flex; align-items:flex-start; gap:11px; }
.rv-av { width:30px; height:30px; border-radius:50%; background:var(--haze); flex:none; display:flex; align-items:center; justify-content:center; font-family:var(--ui); font-size:12px; color:var(--sub); font-weight:600; }
.rv-name { font-family:var(--ui); font-size:14px; color:var(--ink); font-weight:500; }
.rv-orcid { font-family:var(--mono); font-size:10.5px; color:var(--sub); font-weight:400; margin-left:6px; }
.rv-cred { font-family:var(--ui); font-size:11.5px; color:var(--sub); margin-top:2px; }
.rv-rel { font-family:var(--mono); font-size:10.5px; color:var(--structure); }
.rv-disp { margin-left:auto; font-family:var(--ui); font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; padding:3px 9px; border-radius:5px; color:#fff; white-space:nowrap; flex:none; }
.rv-disp.green { background:var(--verified); } .rv-disp.yellow { background:#C9A23A; }
.rv-disp.orange { background:#C8772A; } .rv-disp.red { background:var(--type-red); }
.rv-comment { font-family:var(--body); font-size:15px; color:var(--ink); margin:11px 0 0; padding-left:41px; }
.rv-reply { margin:10px 0 0 41px; font-family:var(--ui); font-size:12.5px; color:var(--sub); border-left:2px solid var(--rule); padding-left:11px; }
.rv-reply b { color:var(--ink); font-weight:500; }
.rv-addressed { color:var(--verified); font-weight:600; margin-left:8px; }
.rv-replybox { margin:11px 0 0 41px; }
.rv-replybox textarea { width:100%; font-family:var(--ui); font-size:13px; color:var(--ink); border:1px solid var(--rule); border-radius:7px; padding:9px 10px; resize:vertical; min-height:46px; }
.rv-replybox textarea:focus { outline:none; box-shadow:0 0 0 1px var(--type-red); border-color:var(--type-red); }
.rv-replybox .need { font-family:var(--ui); font-size:11px; color:#C8772A; margin:6px 0 8px; }
.rv-replybox button { font-family:var(--ui); font-size:12px; font-weight:600; background:var(--ink); color:var(--paper); border:0; border-radius:7px; padding:7px 13px; margin-top:8px; }
.rv-replybox button:disabled { background:var(--haze); color:var(--structure); }
.rv-nominate { font-family:var(--ui); font-size:12.5px; color:var(--sub); border:1px dashed var(--rule); background:transparent; border-radius:8px; padding:9px 13px; width:100%; }
.ca-row { display:flex; align-items:center; gap:11px; padding:11px 2px; border-top:1px solid var(--rule); font-family:var(--ui); }
.ca-dot { width:9px; height:9px; border-radius:50%; flex:none; }
.ca-dot.confirmed { background:var(--verified); } .ca-dot.unconfirmed { background:#C9A23A; }
.ca-dot.negotiating { background:#C8772A; } .ca-dot.declined { background:var(--type-red); }
.ca-name { font-size:13.5px; color:var(--ink); }
.ca-state { font-size:11.5px; color:var(--sub); margin-left:auto; font-family:var(--mono); }
.ca-remind { font-family:var(--ui); font-size:11px; border:1px solid var(--rule); background:#fff; border-radius:5px; padding:4px 9px; color:var(--sub); }
.rr-card { position:sticky; top:84px; border:1px solid var(--rule); border-radius:12px; padding:16px; background:#fff; }
.rr-h { font-family:var(--ui); font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--structure); margin:0 0 13px; }
.rr-check { display:flex; gap:9px; align-items:flex-start; font-family:var(--ui); font-size:12.5px; color:var(--ink); padding:8px 0; border-top:1px solid var(--haze); }
.rr-check .mk { flex:none; width:16px; font-weight:700; }
.rr-check.ok .mk { color:var(--verified); } .rr-check.no .mk { color:#C8772A; } .rr-check.warn .mk { color:#C9A23A; }
.rr-btn { width:100%; font-family:var(--ui); font-size:13.5px; font-weight:600; border:0; border-radius:9px; padding:12px; margin-top:14px; background:var(--verified); color:#fff; }
.rr-btn:disabled { background:var(--haze); color:var(--structure); cursor:not-allowed; }
.rr-note { font-family:var(--ui); font-size:11px; color:var(--structure); text-align:center; margin-top:8px; }
.rr-done { margin-top:14px; border:1px solid #bcd9cd; background:#eef5f2; border-radius:9px; padding:12px; font-family:var(--ui); font-size:12.5px; color:var(--verified); text-align:center; }
.rr-done .doi { font-family:var(--mono); font-size:12px; color:var(--ink); display:block; margin-top:5px; }
.rr-done button { margin-top:10px; font-family:var(--ui); font-size:12px; border:1px solid var(--verified); background:transparent; color:var(--verified); border-radius:7px; padding:6px 12px; font-weight:600; }

@media (max-width:880px){
  .rv-body { grid-template-columns:1fr; } .rv-main { border-right:0; border-bottom:1px solid var(--rule); }
  .rr-card { position:static; }
}

/* ---- Map ---- */
.mp-head { display:flex; flex-wrap:wrap; align-items:center; gap:12px; padding:15px 26px; border-bottom:1px solid var(--rule); position:sticky; top:0; background:var(--paper); z-index:20; }
.mp-h-title { font-family:var(--body); font-weight:600; font-size:20px; } .mp-h-title i { font-style:italic; }
.mp-prec { display:inline-flex; align-items:center; gap:9px; font-family:var(--ui); font-size:11px; color:var(--structure); }
.mp-seg { display:inline-flex; border:1px solid var(--rule); border-radius:6px; overflow:hidden; }
.mp-seg button { border:0; background:#fff; padding:5px 11px; font-size:12px; color:var(--sub); display:inline-flex; align-items:center; gap:5px; }
.mp-seg button[aria-pressed="true"] { background:var(--ink); color:var(--paper); }
.mp-seg button.locked { color:var(--structure); }
.mp-grant { margin-left:auto; font-family:var(--ui); font-size:11.5px; color:var(--type-red); border:1px solid #e3b7af; background:#fdf3f1; border-radius:20px; padding:4px 12px; display:inline-flex; align-items:center; gap:8px; }
.mp-grant button { border:0; background:transparent; color:var(--type-red); font-weight:600; font-size:11px; text-decoration:underline; }
.mp-body { display:grid; grid-template-columns:minmax(0,1fr) 312px; }
.mp-stage { padding:24px 30px 50px; border-right:1px solid var(--rule); }
.mp-svgwrap { border:1px solid var(--rule); border-radius:10px; background:#fbfcfa; display:inline-block; max-width:100%; overflow:hidden; }
.mp-cell { cursor:pointer; }
.mp-readout { font-family:var(--mono); font-size:12px; color:var(--ink); background:var(--haze); border-radius:7px; padding:9px 12px; margin-top:12px; display:flex; gap:14px; flex-wrap:wrap; align-items:center; }
.mp-readout .lbl { font-family:var(--ui); font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--structure); }
.mp-readout .red { color:var(--type-red); }
.mp-legend { display:flex; gap:16px; flex-wrap:wrap; font-family:var(--ui); font-size:11.5px; color:var(--sub); margin-top:12px; }
.mp-legend i { width:12px; height:12px; border-radius:3px; display:inline-block; margin-right:6px; vertical-align:-2px; }
.mp-about { font-family:var(--ui); font-size:11.5px; color:var(--structure); margin-top:14px; max-width:540px; line-height:1.5; border-top:1px dashed var(--rule); padding-top:12px; }
.mp-about b { color:var(--sub); font-weight:600; } .mp-about code { font-family:var(--mono); color:var(--ink); background:var(--haze); padding:1px 5px; border-radius:4px; }
.mp-rail { padding:24px 22px; font-family:var(--ui); }
.mp-rh { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--structure); margin:0 0 6px; }
.mp-rsub { font-size:11px; color:var(--sub); margin-bottom:16px; }
.po-card { border:1px solid var(--rule); border-radius:9px; padding:12px; margin-bottom:11px; background:#fff; }
.po-top { display:flex; align-items:baseline; gap:8px; }
.po-id { font-family:var(--mono); font-size:12px; color:var(--ink); }
.po-src { font-size:10.5px; color:#fff; background:var(--structure); border-radius:4px; padding:1px 6px; letter-spacing:.03em; margin-left:auto; }
.po-meta { font-size:11px; color:var(--sub); margin:6px 0 9px; }
.po-meta .coord { font-family:var(--mono); }
.po-acts { display:flex; gap:7px; }
.po-acts button { font-family:var(--ui); font-size:12px; font-weight:500; border-radius:6px; padding:6px 12px; border:1px solid var(--rule); background:#fff; }
.po-acts .acc { background:var(--verified); color:#fff; border-color:var(--verified); }
.po-acts .rej { color:var(--type-red); border-color:#e3b7af; }
.po-reject textarea { width:100%; font-family:var(--ui); font-size:12.5px; border:1px solid var(--rule); border-radius:7px; padding:8px; margin-top:9px; resize:vertical; min-height:42px; }
.po-reject textarea:focus { outline:none; box-shadow:0 0 0 1px var(--type-red); border-color:var(--type-red); }
.po-reject .need { font-size:10.5px; color:var(--type-red); margin:6px 0; }
.po-reject .row { display:flex; gap:7px; }
.po-reject .row button { flex:1; font-size:12px; border-radius:6px; padding:7px; border:1px solid var(--rule); background:#fff; }
.po-reject .row button.confirm { background:var(--type-red); color:#fff; border-color:var(--type-red); }
.po-reject .row button:disabled { opacity:.5; }
.po-done { font-family:var(--ui); font-size:11.5px; color:var(--sub); padding:9px 2px; border-bottom:1px solid var(--haze); display:flex; gap:8px; align-items:center; }
.po-done .mk { color:var(--verified); } .po-done .mk.x { color:var(--type-red); }
.mp-reqcard { border:1px solid #9cc1d6; background:#f3f8fb; border-radius:10px; padding:14px; margin-top:8px; }
.mp-reqcard h4 { font-family:var(--ui); font-size:12px; color:#1c4a63; margin:0 0 4px; }
.mp-reqcard p { font-family:var(--ui); font-size:11px; color:var(--sub); margin:0 0 10px; line-height:1.5; }
.mp-reqcard select { width:100%; font-family:var(--ui); font-size:12.5px; padding:7px; border:1px solid var(--rule); border-radius:6px; margin-bottom:10px; }
.mp-reqcard .row { display:flex; gap:7px; }
.mp-reqcard .row button { flex:1; font-family:var(--ui); font-size:12px; font-weight:600; border-radius:7px; padding:8px; border:1px solid var(--rule); background:#fff; }
.mp-reqcard .row button.grant { background:#1c4a63; color:#fff; border-color:#1c4a63; }
@media (max-width:880px){ .mp-body { grid-template-columns:1fr; } .mp-stage { border-right:0; border-bottom:1px solid var(--rule); } }

@media (max-width:880px){
  .shell { grid-template-columns:1fr; }
  .shell-nav { position:static; height:auto; flex-direction:row; flex-wrap:wrap; align-items:center; gap:4px; }
  .shell-mark { padding:4px 8px; } .shell-acct { margin-top:0; border-top:0; }
  .jose-frame { grid-template-columns:1fr; } .jose-gutter { display:none; }
  .jose-rail { border-left:0; border-top:1px solid var(--rule); }
  .bx-body { grid-template-columns:1fr; } .bx-main { border-right:0; border-bottom:1px solid var(--rule); }
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
  { id:"map", label:"Distribution", ic:"◰" },
  { id:"review", label:"Review", ic:"◷" },
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
          {view==="builder" && <BuilderScreen onOpenReader={()=>setView("reader")} onGoReview={()=>setView("review")} />}
          {view==="review" && <ReviewScreen onOpenReader={()=>setView("reader")} />}
          {view==="map" && <MapScreen onOpenReader={()=>setView("reader")} />}
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
  "Anthesis is concentrated in the early afternoon, with flowers closing by dusk and reopening over several successive days.",
  "Populations are patchily distributed across quartz gravel, where reduced competition and a cooler root zone appear to favour establishment.",
];
let aiCursor = 0;
const pickAI = () => { const t = AI_POOL[aiCursor % AI_POOL.length]; aiCursor++; return t; };
const uid = () => "b" + Math.random().toString(36).slice(2, 8);

const REF_SEED = [
  { id:"r1", key:"klak2012", type:"article", short:"Klak & Bruyns", authors:"Klak, C. & Bruyns, P. V.", year:"2012", title:"A phylogeny and new classification of the Mesembryanthemoideae (Aizoaceae)", source:"Taxon 61", doi:"10.1002/tax.612009" },
  { id:"r2", key:"hartmann2001", type:"book", short:"Hartmann", authors:"Hartmann, H. E. K. (ed.)", year:"2001", title:"Illustrated Handbook of Succulent Plants: Aizoaceae", source:"Springer, Berlin" },
  { id:"r3", key:"tdwg2017", type:"web", short:"TDWG", authors:"Biodiversity Information Standards (TDWG)", year:"2017", title:"Darwin Core quick reference guide", source:"tdwg.org" },
  { id:"r4", key:"botha2026", type:"jose", short:"Botha", authors:"Botha, R.", year:"2026", title:"Mesembryanthemum aureum Botha — a living treatment", source:"JOSE", jose:{ concept:"10.59321/jose.aizo.0142", version:"v2", isVoR:true, tip:"v3", section:"§description", hash:"9f2ac1e7" } },
];
const DOI_DB = {
  "10.1111/jbi.13889": { type:"article", short:"Born et al.", authors:"Born, J., Linder, H. P. & Desmet, P.", year:"2007", title:"The Greater Cape Floristic Region", source:"Journal of Biogeography 34", doi:"10.1111/jbi.13889" },
  "10.1554/05-528.1": { type:"article", short:"Ellis et al.", authors:"Ellis, A. G., Weis, A. E. & Gaut, B. S.", year:"2006", title:"Evolutionary radiation of stone plants (Aizoaceae)", source:"Evolution 60", doi:"10.1554/05-528.1" },
};
const WEB_RESULTS = [
  { type:"article", short:"Schmiedel & Jürgens", authors:"Schmiedel, U. & Jürgens, N.", year:"1999", title:"Community structure on quartz fields in the Knersvlakte", source:"Plant Ecology 142", doi:"10.1023/A:1009856025887" },
  { type:"article", short:"Ellis et al.", authors:"Ellis, A. G., Weis, A. E. & Gaut, B. S.", year:"2006", title:"Evolutionary radiation of stone plants (Aizoaceae)", source:"Evolution 60", doi:"10.1554/05-528.1" },
  { type:"book", short:"Snijman", authors:"Snijman, D. A. (ed.)", year:"2013", title:"Plants of the Greater Cape Floristic Region 2: the Extra Cape Flora", source:"SANBI", doi:"" },
];
const JOSE_OBJECTS = [
  { concept:"10.59321/jose.aizo.0142", short:"Botha", authors:"Botha, R.", year:"2026", title:"Mesembryanthemum aureum Botha — a living treatment", vor:"v2", tip:"v3", section:"§description", hash:"9f2ac1e7" },
  { concept:"10.59321/jose.poll.0210", short:"ShareNat contributors", authors:"ShareNat contributors", year:"2026", title:"Pollination micro-observations of the Knersvlakte", vor:null, tip:"v4", section:"§observations", hash:"c71d40a2" },
];

function AutoText({ value, onChange, onFocusReg, regId, className, placeholder }) {
  const ref = useRef(null);
  const grow = () => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } };
  useEffect(() => { grow(); }, [value]);
  return <textarea ref={ref} className={className} value={value} placeholder={placeholder} rows={1}
    onChange={(e)=>onChange(e.target.value)} onInput={grow}
    onFocus={onFocusReg ? ()=>onFocusReg(regId, ref.current) : undefined} />;
}

// ---- citation/text helpers ----
function buildCites(texts, refs) {
  const byKey = {}; refs.forEach(r => byKey[r.key] = r);
  const order = []; const counts = {};
  const re = /\[@([^\]]+)\]/g;
  texts.forEach(t => { let m; const rr = new RegExp(re); while ((m = rr.exec(t || "")) !== null) {
    m[1].split(/[;,]/).forEach(s => { const key = s.trim().replace(/^@/, ""); if (!key) return;
      counts[key] = (counts[key] || 0) + 1; if (byKey[key] && order.indexOf(key) < 0) order.push(key); });
  }});
  const citeMap = {}; order.forEach((key, i) => { citeMap[key] = { num: i + 1, ref: byKey[key] }; });
  return { citeMap, order, counts, byKey };
}
function renderCite(keysRaw, citeMap, style, k) {
  const keys = keysRaw.split(/[;,]/).map(s => s.trim().replace(/^@/, "")).filter(Boolean);
  const items = keys.map(key => citeMap[key]).filter(Boolean);
  if (!items.length) return <span key={"c"+k} className="bx-cite bx-cite-bad">[?]</span>;
  const living = items.some(x => x.ref.type === "jose");
  const label = style === "numbered"
    ? "[" + items.map(x => x.num).join(", ") + "]"
    : "(" + items.map(x => x.ref.short + ", " + x.ref.year).join("; ") + ")";
  const href = "#ref-" + items[0].ref.key;
  return <a key={"c"+k} className="bx-cite" href={href}>{label}{living && <span className="bx-living" title="living object">‡</span>}</a>;
}
function renderInline(text, citeMap, style) {
  if (!text) return null;
  const out = []; const re = /\[@([^\]]+)\]|\*([^*]+)\*/g; let m, last = 0, k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] != null) out.push(renderCite(m[1], citeMap, style, k++));
    else out.push(<i key={"i"+k++}>{m[2]}</i>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function fmtRef(r) {
  if (r.type === "book") return <>{r.authors} ({r.year}). <i>{r.title}</i>. {r.source}.</>;
  if (r.type === "web") return <>{r.authors} ({r.year}). {r.title}. {r.source}.</>;
  if (r.type === "jose") return <>{r.authors} ({r.year}). {r.title}. <i>JOSE</i> {r.jose.version}{r.jose.isVoR ? " (Version of Record)" : " (living tip)"}. <span className="bx-refdoi">{r.jose.concept} [{r.jose.section}; ver:sha256-{r.jose.hash}…]</span><span className="bx-refliving">living</span></>;
  return <>{r.authors} ({r.year}). {r.title}. <i>{r.source}</i>.{r.doi ? <> <span className="bx-refdoi">https://doi.org/{r.doi}</span></> : null}</>;
}
function plainRef(r) {
  if (r.type === "book") return r.authors + " (" + r.year + "). " + r.title + ". " + r.source + ".";
  if (r.type === "web") return r.authors + " (" + r.year + "). " + r.title + ". " + r.source + ".";
  if (r.type === "jose") return r.authors + " (" + r.year + "). " + r.title + ". JOSE " + r.jose.version + (r.jose.isVoR ? " (Version of Record)" : " (living tip)") + ". " + r.jose.concept + " [" + r.jose.section + "; ver:sha256-" + r.jose.hash + "…].";
  return r.authors + " (" + r.year + "). " + r.title + ". " + r.source + "." + (r.doi ? " https://doi.org/" + r.doi : "");
}
function genKey(r, refs) {
  const base = ((r.short || r.authors || "ref").toLowerCase().replace(/[^a-z]/g, "").slice(0, 12) || "ref") + (r.year || "");
  let key = base, i = 2; while (refs.some(x => x.key === key)) key = base + "_" + (i++); return key;
}

function BuilderScreen({ onOpenReader, onGoReview }) {
  const [title, setTitle] = useState("A first pollinator record for Mesembryanthemum aureum (Aizoaceae)");
  const [authors, setAuthors] = useState("R. Botha · D. Gwynne-Evans");
  const [abstract, setAbstract] = useState("We report the first timed pollinator visit to *Mesembryanthemum aureum*, a narrow Knersvlakte endemic, and place it within mesemb pollination ecology [@klak2012].");
  const [blocks, setBlocks] = useState([
    { id: uid(), type:"heading", text:"Introduction" },
    { id: uid(), type:"para", origin:"human", text:"The Mesembryanthemoideae are a largely southern African radiation of leaf-succulents [@klak2012]. *Mesembryanthemum aureum* is restricted to the quartz fields of the Knersvlakte, where it has recently been treated as a living object [@botha2026]." },
    { id: uid(), type:"heading", text:"Observations" },
    { id: uid(), type:"para", origin:"human", text:"On 14 March 2026, a single female *Anthophora* sp. was recorded visiting flowers at 13h40. Visits lasted under five seconds; the bee contacted both anthers and stigma." },
  ]);
  const [refs, setRefs] = useState(REF_SEED);
  const [style, setStyle] = useState("numbered");
  const [mode, setMode] = useState("write");
  const [railTab, setRailTab] = useState("references");
  const [visibility, setVisibility] = useState("private");
  const [tier, setTier] = useState("draft");
  const [roles, setRoles] = useState([]);
  const [aiAccount, setAiAccount] = useState("generic");
  const [menu, setMenu] = useState(null);
  const [pick, setPick] = useState(null);      // {method, query, doi, manual{}, }
  const [toast, setToast] = useState(null);
  const focused = useRef(null);                 // {id, node} of last-focused editable
  const flash = (m) => { setToast(m); setTimeout(()=>setToast(null), 1800); };
  const addRole = (r) => setRoles(rs => rs.includes(r) ? rs : [...rs, r]);
  const regFocus = (id, node) => { focused.current = { id, node }; };

  const allTexts = [title, abstract, ...blocks.map(b => b.text)];
  const { citeMap, order, counts, byKey } = buildCites(allTexts, refs);

  // ---- text application + provenance ----
  const applyText = (id, text) => {
    if (id === "abstract") { setAbstract(text); return; }
    if (id === "title") { setTitle(text); return; }
    setBlocks(prev => prev.map(b => {
      if (b.id !== id) return b;
      if (b.origin === "ai" && text !== b.aiOriginal) { addRole("editing"); return { ...b, text, origin:"ai-human" }; }
      return { ...b, text };
    }));
  };
  const insertToken = (tok) => {
    const f = focused.current;
    if (!f || !f.node) {
      setBlocks(prev => { const i = prev.map(b=>b.type).lastIndexOf("para"); if (i<0) return prev; const c=[...prev]; c[i] = { ...c[i], text:(c[i].text + " " + tok).trim() }; return c; });
      flash("Citation added to last paragraph"); return;
    }
    const node = f.node; const s = node.selectionStart ?? node.value.length; const e = node.selectionEnd ?? s;
    const val = node.value; const next = val.slice(0, s) + tok + val.slice(e);
    applyText(f.id, next);
    requestAnimationFrame(() => { try { node.focus(); const p = s + tok.length; node.selectionStart = node.selectionEnd = p; } catch (_) {} });
  };
  const wrapItalic = () => {
    const f = focused.current; if (!f || !f.node) { flash("Select text in a paragraph first"); return; }
    const node = f.node; const s = node.selectionStart, e = node.selectionEnd; const val = node.value;
    if (s === e) { insertToken("**"); requestAnimationFrame(()=>{ try{ node.focus(); node.selectionStart=node.selectionEnd=s+1; }catch(_){} }); return; }
    const next = val.slice(0, s) + "*" + val.slice(s, e) + "*" + val.slice(e);
    applyText(f.id, next);
    requestAnimationFrame(() => { try { node.focus(); node.selectionStart = s; node.selectionEnd = e + 2; } catch (_) {} });
  };

  // ---- blocks ----
  const updateBlockType = (id, t) => setBlocks(bs => bs.map(b => b.id===id ? { ...b, type:t } : b));
  const addBlock = (t) => setBlocks(bs => [...bs, t==="heading" ? { id:uid(), type:"heading", text:"New section" } : t==="figure" ? { id:uid(), type:"figure", text:"" } : t==="claim" ? { id:uid(), type:"claim", origin:"human", text:"State the claim, then attach evidence." } : { id:uid(), type:"para", origin:"human", text:"" }]);
  const removeBlock = (id) => setBlocks(bs => bs.filter(b => b.id!==id));
  const aiDraft = () => { const t = pickAI(); setBlocks(bs => [...bs, { id:uid(), type:"para", origin:"ai", text:t, aiOriginal:t }]); addRole("drafting"); flash("AI paragraph drafted — tagged AI"); };
  const aiExpand = (afterId) => { const t = pickAI(); setBlocks(bs => { const i = bs.findIndex(b=>b.id===afterId); const c=[...bs]; c.splice(i+1,0,{ id:uid(), type:"para", origin:"ai", text:t, aiOriginal:t }); return c; }); addRole("expansion"); };

  // ---- references ----
  const addAndInsert = (r) => {
    let existing = refs.find(x => (r.doi && x.doi && x.doi===r.doi) || (r.jose && x.jose && x.jose.concept===r.jose.concept && x.jose.version===r.jose.version) || (r.key && x.key===r.key));
    let key;
    if (existing) key = existing.key;
    else { key = genKey(r, refs); const nr = { ...r, key, id:uid() }; setRefs(rs => [...rs, nr]); }
    insertToken("[@" + key + "]");
    setPick(null); flash("Citation inserted");
  };
  const resolveDoi = () => { const d = (pick.doi||"").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//,""); if (!d) return; const hit = DOI_DB[d]; const r = hit ? { ...hit } : { type:"article", short:(d.split("/")[1]||"source").slice(0,16), authors:"[author — resolved from DOI]", year:"n.d.", title:"Work at " + d, source:"", doi:d }; addAndInsert(r); };
  const addJose = (obj, ver) => { const isVoR = !!obj.vor && ver===obj.vor; addAndInsert({ type:"jose", short:obj.short, authors:obj.authors, year:obj.year, title:obj.title, source:"JOSE", jose:{ concept:obj.concept, version:ver, isVoR, tip:obj.tip, section:obj.section, hash:obj.hash } }); };
  const addManual = () => { const m = pick.manual || {}; if (!m.title) { flash("A title is needed"); return; } addAndInsert({ type:m.type||"article", short:(m.authors||"Anon").split(/[ ,]/)[0], authors:m.authors||"Anon.", year:m.year||"n.d.", title:m.title, source:m.source||"", doi:m.doi||"" }); };

  // ---- composition (provenance) ----
  let h=0, a=0, ah=0;
  blocks.forEach(b => { if (b.type!=="para" && b.type!=="claim") return; const n=b.text.length; if (b.origin==="ai") a+=n; else if (b.origin==="ai-human") ah+=n; else h+=n; });
  const tot = h+a+ah || 1; const pct = (x)=>Math.round((x/tot)*100);

  // ---- export ----
  const exportMd = () => {
    let md = "# " + title + "\n\n";
    if (authors) md += "*" + authors + "*\n\n";
    if (abstract) md += "**Abstract.** " + abstract + "\n\n";
    blocks.forEach(b => { md += b.type==="heading" ? "## "+b.text+"\n\n" : b.type==="figure" ? "![]("+(b.text||"figure")+")\n\n" : b.type==="claim" ? "> **Claim.** "+b.text+"\n\n" : b.text+"\n\n"; });
    if (order.length) { md += "## References\n\n"; order.forEach((key,i) => { md += (style==="numbered" ? "["+(i+1)+"] " : "- ") + plainRef(byKey[key]) + "\n\n"; }); }
    md += "---\n\n*AI provenance (recorded)* — roles: " + (roles.join(", ")||"none") + "; model: " + (aiAccount==="generic"?"claude-sonnet-4-6 (generic)":"linked account") + "; accountable: R. Botha.\n*Composition* — human " + pct(h) + "% · AI " + pct(a) + "% · AI-edited " + pct(ah) + "%.\n";
    try { const blob = new Blob([md], { type:"text/markdown" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href=url; link.download=(title||"manuscript").replace(/[^\w]+/g,"_").slice(0,40)+".md"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); flash("Exported — Pandoc-style Markdown + bibliography"); }
    catch { flash("Export blocked by sandbox"); }
  };

  const closeMenus = () => setMenu(null);
  const listKeys = style==="numbered" ? order.slice() : order.slice().sort((x,y)=>(byKey[x].short+byKey[x].year).localeCompare(byKey[y].short+byKey[y].year));

  return (
    <div onMouseDown={closeMenus}>
      <div className="bx-head" onMouseDown={(e)=>e.stopPropagation()}>
        <input className="bx-title-in" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Manuscript title" />
        <div className="bx-modeseg" role="group">
          <button aria-pressed={mode==="write"} onClick={()=>setMode("write")}>Write</button>
          <button aria-pressed={mode==="preview"} onClick={()=>setMode("preview")}>Preview</button>
        </div>
        <div className="bx-pill">
          <button className={`bx-pillbtn ${tier==="commons"?"commons":""}`} onClick={()=>setMenu(menu==="vis"?null:"vis")}><span className="d"/>{tier==="commons"?"Commons":"Draft"} · {visibility} ▾</button>
          {menu==="vis" && (<div className="bx-menu"><div className="sub">Visibility</div>{["private","collaborators","public"].map(v=>(<button key={v} onClick={()=>{setVisibility(v);setMenu(null);}}>{v}</button>))}</div>)}
        </div>
      </div>

      {mode==="write" && (
        <div className="bx-toolbar" onMouseDown={(e)=>e.stopPropagation()}>
          <button className="bx-tb" onMouseDown={(e)=>e.preventDefault()} onClick={wrapItalic} title="Italicise selection (scientific names)"><span className="ital">I</span> Italic</button>
          <button className="bx-tb cite" onMouseDown={(e)=>e.preventDefault()} onClick={()=>setPick({ method:null, query:"", doi:"", manual:{} })}><span className="sp">❝</span> Cite</button>
          <span className="bx-div" />
          <button className="bx-tb" onClick={()=>addBlock("para")}>＋ Paragraph</button>
          <button className="bx-tb" onClick={()=>addBlock("heading")}>＋ Section</button>
          <button className="bx-tb" onClick={()=>addBlock("figure")}>＋ Figure</button>
          <button className="bx-tb" onClick={()=>addBlock("claim")}>＋ Claim</button>
          <span className="bx-div" />
          <button className="bx-tb ai" onClick={aiDraft}><span className="sp">✦</span> AI draft</button>
        </div>
      )}

      <div className="bx-body">
        <div className="bx-main">
          {mode==="write" ? (
            <div className="bx-doc">
              <AutoText className="bx-doc-title" value={title} onChange={setTitle} onFocusReg={regFocus} regId="title" placeholder="Title" />
              <input className="bx-authors" value={authors} onChange={(e)=>setAuthors(e.target.value)} placeholder="Authors" />
              <div className="bx-absbox">
                <div className="bx-abslab">Abstract</div>
                <AutoText className="bx-figcap" value={abstract} onChange={setAbstract} onFocusReg={regFocus} regId="abstract" placeholder="Abstract…" />
              </div>
              {blocks.map(b => (
                <div key={b.id} className={`bx-block ${b.type==="claim"?"claim":""} ${b.origin==="ai"?"v-ai":b.origin==="ai-human"?"v-aih":""}`}>
                  {(b.origin==="ai"||b.origin==="ai-human") && <span className={`bx-segtag ${b.origin==="ai"?"ai":"aih"}`}>{b.origin==="ai"?"AI":"AI → human"}</span>}
                  <div className="bx-blocktools">
                    {(b.type==="para"||b.type==="claim") && <button className="ai" onMouseDown={(e)=>e.preventDefault()} onClick={()=>aiExpand(b.id)}>✦ expand</button>}
                    {b.type==="para" && <button onClick={()=>updateBlockType(b.id,"heading")}>heading</button>}
                    {b.type==="heading" && <button onClick={()=>updateBlockType(b.id,"para")}>text</button>}
                    <button onClick={()=>removeBlock(b.id)}>remove</button>
                  </div>
                  {b.type==="heading" ? (
                    <input className="bx-heading-in" value={b.text} onChange={(e)=>applyText(b.id, e.target.value)} placeholder="Section heading" />
                  ) : b.type==="figure" ? (
                    <div className="bx-figure"><div className="bx-figbox">figure — drop image (JXL)</div>
                      <AutoText className="bx-figcap" value={b.text} onChange={(t)=>applyText(b.id,t)} onFocusReg={regFocus} regId={b.id} placeholder="Figure caption…" /></div>
                  ) : (
                    <AutoText className="bx-para" value={b.text} onChange={(t)=>applyText(b.id,t)} onFocusReg={regFocus} regId={b.id} placeholder="Write…  ( *italic*  ·  Cite inserts [@key] )" />
                  )}
                </div>
              ))}
              <div className="bx-addrow">
                <button className="bx-addbtn" onClick={()=>addBlock("para")}>＋ Paragraph</button>
                <button className="bx-addbtn" onClick={()=>addBlock("heading")}>＋ Section</button>
                <button className="bx-addbtn ai" onClick={aiDraft}>✦ AI draft</button>
              </div>
            </div>
          ) : (
            <div className="bx-prev">
              <h1>{renderInline(title, citeMap, style)}</h1>
              <div className="by">{authors}</div>
              {abstract && <div className="abs"><span className="lab">Abstract</span>{renderInline(abstract, citeMap, style)}</div>}
              {blocks.map(b => b.type==="heading" ? <h2 key={b.id}>{b.text}</h2>
                : b.type==="figure" ? <div key={b.id} className="bx-figure"><div className="bx-figbox">figure</div><div style={{fontFamily:"var(--ui)",fontSize:12.5,color:"var(--sub)",marginTop:6}}>{renderInline(b.text,citeMap,style)}</div></div>
                : b.type==="claim" ? <p key={b.id} className="claim"><b>Claim.</b> {renderInline(b.text,citeMap,style)}</p>
                : <p key={b.id}>{renderInline(b.text, citeMap, style)}</p>)}
              <div className="bx-refs">
                <h2>References</h2>
                {listKeys.length===0 && <div className="bx-rsub">No citations yet. Use <b>Cite</b> while writing.</div>}
                {listKeys.map((key, i) => { const r = byKey[key]; return (
                  <div className={`bx-refitem ${style==="numbered"?"":"ad"}`} id={"ref-"+key} key={key}>
                    {style==="numbered" && <span className="rn">{order.indexOf(key)+1}.</span>}
                    <span>{fmtRef(r)}</span>
                  </div>); })}
              </div>
            </div>
          )}
        </div>

        <div className="bx-rail" onMouseDown={(e)=>e.stopPropagation()}>
          <div className="bx-railtabs">
            <button aria-pressed={railTab==="references"} onClick={()=>setRailTab("references")}>References</button>
            <button aria-pressed={railTab==="authorship"} onClick={()=>setRailTab("authorship")}>Authorship</button>
          </div>
          <div className="bx-railbody">
            {railTab==="references" ? (<>
              <h3 className="bx-rh">Bibliography</h3>
              <div className="bx-rsub">Cite while writing — the in-text marker and this list stay in sync.</div>
              <div className="bx-stylewrap"><span className="lab">style</span>
                <div className="bx-stoggle"><button aria-pressed={style==="numbered"} onClick={()=>setStyle("numbered")}>[1]</button><button aria-pressed={style==="authordate"} onClick={()=>setStyle("authordate")}>Author–date</button></div>
              </div>
              <button className="bx-addref" onClick={()=>setPick({ method:null, query:"", doi:"", manual:{} })}>＋ Add reference</button>
              {refs.map(r => { const used = counts[r.key]||0; return (
                <div className="bx-refcard" key={r.id}>
                  <div className="rtop"><span className={`rt ${r.type==="jose"?"jose":""}`}>{r.type==="jose"?"JOSE":r.type}</span><span className="rkey">@{r.key}</span></div>
                  <div className="rmeta">{fmtRef(r)}</div>
                  {r.type==="jose" && <div className="ver">cited at {r.jose.version}{r.jose.isVoR?" · VoR":""} · tip {r.jose.tip}</div>}
                  <div className="rfoot"><span className={`used ${used===0?"zero":""}`}>{used? "cited "+used+"×" : "not cited"}</span><button className="ins" onClick={()=>insertToken("[@"+r.key+"]")}>Insert</button></div>
                </div>); })}
            </>) : (<>
              <h3 className="bx-rh">Authorship</h3>
              <div className="bx-rsub">Provenance is recorded as you write, not detected after.</div>
              <div className="bx-cov">coverage: recorded</div>
              <div className="bx-bar"><div className="h" style={{width:pct(h)+"%"}}/><div className="a" style={{width:pct(a)+"%"}}/><div className="ah" style={{width:pct(ah)+"%"}}/></div>
              <div className="bx-leg">
                <div className="lr"><span className="sw" style={{background:"var(--haze)"}}/>human <b>{pct(h)}%</b></div>
                <div className="lr"><span className="sw" style={{background:"var(--ai)"}}/>AI <b>{pct(a)}%</b></div>
                <div className="lr"><span className="sw" style={{background:"var(--aih)"}}/>AI → human <b>{pct(ah)}%</b></div>
              </div>
              <div className="bx-drow"><div className="k">roles</div><div className="v">{roles.length? roles.map(r=><span key={r} className="bx-rolechip">{r}</span>) : <span style={{color:"var(--structure)"}}>none yet</span>}</div></div>
              <div className="bx-drow"><div className="k">model</div><div className="v bx-model">{aiAccount==="generic"?"claude-sonnet-4-6 (generic)":"linked account"}</div></div>
              <div className="bx-drow"><div className="k">accountable</div><div className="v">R. Botha · ORCID 0000-0002-…</div></div>
            </>)}
          </div>
        </div>
      </div>

      <div className="bx-foot" onMouseDown={(e)=>e.stopPropagation()}>
        <button onClick={()=>flash("Draft saved")}>Save draft</button>
        <button onClick={()=>{ flash("Review requested — opening review"); onGoReview && onGoReview(); }}>Request review</button>
        <button onClick={exportMd}>Export</button>
        <button className="primary" onClick={()=>{ setTier("commons"); setVisibility("public"); flash("Published to Commons"); }}>Publish to Commons</button>
        <span className="spacer" />
        <button onClick={onOpenReader}>Open in Reader →</button>
      </div>

      {pick && <CitePicker pick={pick} setPick={setPick} refs={refs} insertExisting={(key)=>{ insertToken("[@"+key+"]"); setPick(null); flash("Citation inserted"); }} resolveDoi={resolveDoi} addJose={addJose} addManual={addManual} addAndInsert={addAndInsert} />}
      {toast && <div className="jose-toast">{toast}</div>}
    </div>
  );
}

function CitePicker({ pick, setPick, refs, insertExisting, resolveDoi, addJose, addManual, addAndInsert }) {
  const q = (pick.query||"").toLowerCase();
  const matches = refs.filter(r => !q || (r.title+" "+r.authors+" "+r.key+" "+r.year).toLowerCase().includes(q));
  const set = (patch) => setPick({ ...pick, ...patch });
  const setM = (patch) => setPick({ ...pick, manual:{ ...(pick.manual||{}), ...patch } });
  return (
    <div className="bx-pick-back" onMouseDown={()=>setPick(null)}>
      <div className="bx-pick" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="bx-pick-h"><h4>Insert citation</h4><button className="x" onClick={()=>setPick(null)}>×</button></div>
        <div className="bx-pick-sec">
          <input className="bx-search" autoFocus placeholder="Search your bibliography…" value={pick.query||""} onChange={(e)=>set({ query:e.target.value })} />
          <div style={{marginTop:8}}>
            {matches.map(r => (
              <button key={r.id} className="bx-pickitem" onClick={()=>insertExisting(r.key)}>
                <div className="pt">{fmtRef(r)}</div>
                <div className="pm">@{r.key} · {r.type==="jose" ? <span className="jose">JOSE living object</span> : r.type}</div>
              </button>
            ))}
            {matches.length===0 && <div className="bx-empty">No match in your library — add it below.</div>}
          </div>
        </div>
        <div className="bx-methods">
          <span className="bx-methlab">Add a new reference</span>
          {["doi","web","jose","manual"].map(mth => (
            <button key={mth} className="bx-method" aria-pressed={pick.method===mth} onClick={()=>set({ method: pick.method===mth?null:mth })}>
              {mth==="doi"?"By DOI":mth==="web"?"Search":mth==="jose"?"JOSE object":"Manual"}
            </button>
          ))}
        </div>
        {pick.method==="doi" && (
          <div className="bx-form">
            <input placeholder="10.1111/jbi.13889" value={pick.doi||""} onChange={(e)=>set({ doi:e.target.value })} />
            <button className="go" onClick={resolveDoi}>Resolve &amp; insert</button>
            <div className="hint">Try <b>10.1111/jbi.13889</b> or <b>10.1554/05-528.1</b> — resolves to a formatted reference. (Unknown DOIs insert a stub you can edit.)</div>
          </div>
        )}
        {pick.method==="web" && (
          <div className="bx-pick-sec">
            {WEB_RESULTS.map((r,i) => (
              <button key={i} className="bx-pickitem" onClick={()=>addAndInsert(r)}>
                <div className="pt">{fmtRef(r)}</div><div className="pm">{r.doi||"no DOI"} · click to add &amp; cite</div>
              </button>
            ))}
          </div>
        )}
        {pick.method==="jose" && (
          <div className="bx-form">
            {JOSE_OBJECTS.map((o,i) => (
              <div className="bx-josecard" key={i}>
                <div className="jt">{o.authors} ({o.year}). <i>{o.title}</i></div>
                <div style={{fontFamily:"var(--mono)",fontSize:10.5,color:"var(--sage)",marginTop:4}}>{o.concept} · tip {o.tip}</div>
                <div className="jv">
                  {o.vor && <button className="vor" onClick={()=>addJose(o,o.vor)}>cite VoR ({o.vor})</button>}
                  <button onClick={()=>addJose(o,o.tip)}>cite tip ({o.tip})</button>
                </div>
              </div>
            ))}
            <div className="hint">Citing a living object pins a version. The VoR is frozen and citable; the tip moves — JOSE records exactly which you cited.</div>
          </div>
        )}
        {pick.method==="manual" && (
          <div className="bx-form">
            <input placeholder="Authors (e.g. Klak, C. & Bruyns, P. V.)" value={(pick.manual||{}).authors||""} onChange={(e)=>setM({ authors:e.target.value })} />
            <input placeholder="Title" value={(pick.manual||{}).title||""} onChange={(e)=>setM({ title:e.target.value })} />
            <div className="row2">
              <input placeholder="Year" value={(pick.manual||{}).year||""} onChange={(e)=>setM({ year:e.target.value })} />
              <input placeholder="Source / journal" value={(pick.manual||{}).source||""} onChange={(e)=>setM({ source:e.target.value })} />
            </div>
            <input placeholder="DOI (optional)" value={(pick.manual||{}).doi||""} onChange={(e)=>setM({ doi:e.target.value })} />
            <button className="go" onClick={addManual}>Add &amp; insert</button>
          </div>
        )}
      </div>
    </div>
  );
}


/* ============================= REVIEW ============================= */
const DISP_LABEL = {
  green:  "green · seen & incorporated",
  yellow: "yellow · not seen yet",
  orange: "orange · seen, not incorporated",
  red:    "red · disagrees",
};
const initials = (n) => n.split(/[\s.]+/).filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();

function ReviewScreen({ onOpenReader }) {
  const [reviewers, setReviewers] = useState([
    { id:"r1", name:"A. Klak", orcid:"0000-0002-1140-…", cred:"Aizoaceae systematics · 40+ papers", relevance:0.86, disposition:"green", comment:"Diagnosis is clear and the bladder-cell character is well supported.", reply:null, draft:"" },
    { id:"r2", name:"J. Smith", orcid:"0000-0003-0987-…", cred:"Herbarium curation · type specimens", relevance:0.74, disposition:"orange", comment:"Holotype barcode not cited in the type statement.", reply:null, draft:"" },
    { id:"r3", name:"P. Naudé", orcid:"0000-0001-5521-…", cred:"Molecular phylogenetics · Aizoaceae", relevance:0.69, disposition:"red", comment:"I disagree with retaining the segregate genus; the molecular data favour a broader circumscription.", reply:null, draft:"" },
    { id:"r4", name:"T. Adams", orcid:"0000-0002-7788-…", cred:"Pollination ecology", relevance:0.58, disposition:"yellow", comment:"Has accepted; review not yet submitted.", reply:null, draft:"" },
  ]);
  const [coauthors] = useState([
    { id:"c1", name:"L. Roux", state:"confirmed", note:"confirmed" },
    { id:"c2", name:"M. Dlamini", state:"unconfirmed", note:"named-unconfirmed · ⏳ 5 days" },
  ]);
  const [released, setReleased] = useState(false);
  const [toast, setToast] = useState(null);
  const flash = (m) => { setToast(m); setTimeout(()=>setToast(null), 1800); };

  const setDraft = (id, v) => setReviewers(rs => rs.map(r => r.id===id ? { ...r, draft:v } : r));
  const submitReply = (id) => setReviewers(rs => rs.map(r => r.id===id ? { ...r, reply:r.draft.trim(), draft:"" } : r));

  const blocking = reviewers.filter(r => (r.disposition==="orange" || r.disposition==="red") && !r.reply);
  const unconfirmed = coauthors.filter(c => c.state==="unconfirmed");
  const canRelease = blocking.length===0 && !released;

  const release = () => { setReleased(true); flash("Released as v4 · DOI minted"); };

  return (
    <div>
      <div className="rv-head">
        <div className="rv-h-title">Review · <i>Mesembryanthemum aureum</i></div>
        <span className="rv-status">Continuous · open</span>
        <span style={{marginLeft:"auto",fontFamily:"var(--mono)",fontSize:11,color:"var(--sub)"}}>tip v3 · 2026-06-23</span>
      </div>

      <div className="rv-body">
        <div className="rv-main">
          <div className="rv-sec">Reviewers · {reviewers.length}</div>
          {reviewers.map(r => (
            <div key={r.id} className={`rv-card ${r.disposition}`}>
              <div className="rv-top">
                <span className="rv-av">{initials(r.name)}</span>
                <div>
                  <div className="rv-name">{r.name}<span className="rv-orcid">ORCID {r.orcid}</span></div>
                  <div className="rv-cred">{r.cred} · <span className="rv-rel">relevance {r.relevance.toFixed(2)}</span></div>
                </div>
                <span className={`rv-disp ${r.disposition}`}>{DISP_LABEL[r.disposition]}</span>
              </div>
              <p className="rv-comment">“{r.comment}”</p>
              {(r.disposition==="orange" || r.disposition==="red") && (
                r.reply
                  ? <div className="rv-reply"><b>Your reply:</b> {r.reply}<span className="rv-addressed">✓ addressed</span></div>
                  : <div className="rv-replybox">
                      <div className="need">⚠ A reply is required before you can release.</div>
                      <textarea value={r.draft} onChange={e=>setDraft(r.id, e.target.value)} placeholder="Respond with reasons — incorporated, or why not…" />
                      <br/><button disabled={!r.draft.trim()} onClick={()=>submitReply(r.id)}>Submit reply</button>
                    </div>
              )}
            </div>
          ))}
          <button className="rv-nominate" onClick={()=>flash("Nominate reviewer — picker wired in backend")}>＋ Nominate reviewer</button>

          <div className="rv-sec mt">Co-authors · {coauthors.length}</div>
          {coauthors.map(c => (
            <div key={c.id} className="ca-row">
              <span className={`ca-dot ${c.state}`} />
              <span className="ca-name">{c.name}</span>
              <span className="ca-state">{c.note}</span>
              {c.state==="unconfirmed" && <button className="ca-remind" onClick={()=>flash("Reminder sent")}>Remind</button>}
            </div>
          ))}
        </div>

        <div className="rv-railc">
          <div className="rr-card">
            <div className="rr-h">Release readiness</div>
            <div className={`rr-check ${blocking.length===0?"ok":"no"}`}>
              <span className="mk">{blocking.length===0?"✓":"✗"}</span>
              <span>{blocking.length===0 ? "All reviewer comments addressed" : `${blocking.length} reviewer ${blocking.length===1?"comment needs":"comments need"} your reply`}</span>
            </div>
            {unconfirmed.length>0 && (
              <div className="rr-check warn">
                <span className="mk">⚠</span>
                <span>{unconfirmed.length} co-author {unconfirmed.length===1?"is":"are"} named-unconfirmed — will be flagged on the record, not blocked.</span>
              </div>
            )}
            <button className="rr-btn" disabled={!canRelease} onClick={release}>
              {released ? "Released" : "Release as Version of Record"}
            </button>
            <div className="rr-note">Mints a DOI · freezes a citable snapshot</div>
            {released && (
              <div className="rr-done">
                Released as <b>v4</b> · 2026-06-24
                <span className="doi">DOI 10.59321/jose.aizo.0143</span>
                <button onClick={onOpenReader}>Open the VoR in Reader →</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <div className="jose-toast">{toast}</div>}
    </div>
  );
}


/* ============================= DISTRIBUTION MAP ============================= */
/* Casabio QDS — hemisphere-aware recursive quad-tree.
   A=NW  B=NE
   C=SW  D=SE   ...each letter subdivides the same way, to any depth.
   Code: {S|N}{deg2}{E|W}{deg3}{letters}  e.g. S31E018CA */
function qdsCell(lat, lon, depth) {
  const latHemi = lat < 0 ? "S" : "N";
  const lonHemi = lon < 0 ? "W" : "E";
  let latLo = Math.floor(lat), latHi = latLo + 1;   // signed degree cell [lo,hi)
  let lonLo = Math.floor(lon), lonHi = lonLo + 1;
  let letters = "";
  for (let d = 0; d < depth; d++) {
    const latMid = (latLo + latHi) / 2, lonMid = (lonLo + lonHi) / 2;
    const north = lat >= latMid, east = lon >= lonMid;   // true N/E regardless of hemisphere
    letters += north ? (east ? "B" : "A") : (east ? "D" : "C");
    if (north) latLo = latMid; else latHi = latMid;
    if (east) lonLo = lonMid; else lonHi = lonMid;
  }
  const deg = `${latHemi}${String(Math.floor(Math.abs(lat))).padStart(2,"0")}${lonHemi}${String(Math.floor(Math.abs(lon))).padStart(3,"0")}`;
  return { code: letters ? `${deg}${letters}` : deg, latLo, latHi, lonLo, lonHi, letters };
}

const OBS0 = [
  { id:"obs:441", lat:-31.32, lon:18.61, src:"Casabio", who:"R. Botha",     date:"2026-05-02", status:"accepted" },
  { id:"obs:512", lat:-31.45, lon:18.40, src:"iNaturalist", who:"hgilbert",  date:"2026-04-18", status:"accepted" },
  { id:"obs:233", lat:-31.28, lon:18.72, src:"GBIF", who:"SANBI",            date:"2025-11-30", status:"accepted" },
  { id:"obs:618", lat:-31.61, lon:18.55, src:"Casabio", who:"M. Dlamini",    date:"2026-03-12", status:"accepted" },
  { id:"obs:701", lat:-31.34, lon:18.59, src:"Casabio", who:"R. Botha",      date:"2026-05-20", status:"accepted" },
  { id:"obs:744", lat:-31.50, lon:18.66, src:"iNaturalist", who:"quartzfan", date:"2026-06-10", status:"pending" },
  { id:"obs:777", lat:-31.38, lon:18.49, src:"GBIF", who:"obs-import",       date:"2026-06-12", status:"pending" },
  { id:"obs:802", lat:-31.71, lon:18.83, src:"iNaturalist", who:"karoo_walk",date:"2026-06-15", status:"pending" },
];

// fixed viewport = the degree cell S31E018  (lat -32..-31, lon 18..19)
const VB = { latHi:-31, latLo:-32, lonLo:18, lonHi:19, W:380, H:380 };
const projX = (lon) => (lon - VB.lonLo) / (VB.lonHi - VB.lonLo) * VB.W;
const projY = (lat) => (VB.latHi - lat) / (VB.latHi - VB.latLo) * VB.H;

function MapScreen({ onOpenReader }) {
  const [obs, setObs] = useState(OBS0);
  const [precision, setPrecision] = useState("qds");   // half | qds | precise
  const [granted, setGranted] = useState(false);
  const [grantLeft, setGrantLeft] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [purpose, setPurpose] = useState("Range assessment for Red List");
  const [rejectId, setRejectId] = useState(null);
  const [rejectText, setRejectText] = useState("");
  const [hover, setHover] = useState(null);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);
  const svgRef = useRef(null);
  const flash = (m) => { setToast(m); setTimeout(()=>setToast(null), 1900); };

  useEffect(() => {
    if (!granted) return;
    const t = setInterval(() => setGrantLeft(s => {
      if (s <= 1) { clearInterval(t); setGranted(false); setPrecision("qds"); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [granted]);

  const depth = precision === "half" ? 1 : 2;
  const exact = precision === "precise" && granted;
  const accepted = obs.filter(o => o.status === "accepted");
  const pending = obs.filter(o => o.status === "pending");
  const resolved = obs.filter(o => o.status === "rejected");

  // aggregate accepted into obfuscation cells
  const cellMap = {};
  accepted.forEach(o => { const c = qdsCell(o.lat, o.lon, depth); (cellMap[c.code] ||= { ...c, n:0, obs:[] }); cellMap[c.code].n++; cellMap[c.code].obs.push(o); });
  const cells = Object.values(cellMap);

  const gridLines = [];
  const div = 2 ** depth;
  for (let i = 0; i <= div; i++) {
    gridLines.push(<line key={"v"+i} x1={i/div*VB.W} y1="0" x2={i/div*VB.W} y2={VB.H} stroke="#D9DED6" strokeWidth={i%2?0.5:1} />);
    gridLines.push(<line key={"h"+i} x1="0" y1={i/div*VB.H} x2={VB.W} y2={i/div*VB.H} stroke="#D9DED6" strokeWidth={i%2?0.5:1} />);
  }
  const quad = [["A",18.25,-31.25],["B",18.75,-31.25],["C",18.25,-31.75],["D",18.75,-31.75]];

  const onMove = (e) => {
    const el = svgRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    if (px < 0 || px > 1 || py < 0 || py > 1) { setHover(null); return; }
    const lon = VB.lonLo + px, lat = VB.latHi - py;
    const c = qdsCell(lat, lon, exact ? 6 : depth);
    setHover(exact ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : c.code);
  };

  const accept = (id) => { setObs(os => os.map(o => o.id===id ? { ...o, status:"accepted" } : o)); flash("Observation accepted"); };
  const doReject = (id) => { setObs(os => os.map(o => o.id===id ? { ...o, status:"rejected", comment:rejectText.trim() } : o)); setRejectId(null); setRejectText(""); flash("Observation rejected"); };

  const tryPrecise = () => { if (granted) setPrecision("precise"); else setRequesting(true); };
  const grant = () => { setGranted(true); setGrantLeft(600); setPrecision("precise"); setRequesting(false); flash("Precise access granted · 10 min"); };
  const mmss = `${Math.floor(grantLeft/60)}:${String(grantLeft%60).padStart(2,"0")}`;

  return (
    <div>
      <div className="mp-head">
        <div className="mp-h-title">Distribution · <i>Mesembryanthemum aureum</i></div>
        <span className="mp-prec">precision
          <span className="mp-seg" role="group">
            <button aria-pressed={precision==="half"} onClick={()=>setPrecision("half")}>Half°</button>
            <button aria-pressed={precision==="qds"} onClick={()=>setPrecision("qds")}>QDS</button>
            <button className={!granted?"locked":""} aria-pressed={precision==="precise"} onClick={tryPrecise}>{granted?"Precise":"🔒 Precise"}</button>
          </span>
        </span>
        {granted && <span className="mp-grant">precise · in-session · expires {mmss} · not saved to device <button onClick={()=>{setGranted(false);setPrecision("qds");}}>revoke</button></span>}
      </div>

      <div className="mp-body">
        <div className="mp-stage">
          <div className="mp-svgwrap">
            <svg ref={svgRef} width={VB.W} height={VB.H} viewBox={`0 0 ${VB.W} ${VB.H}`} onMouseMove={onMove} onMouseLeave={()=>setHover(null)} style={{display:"block",maxWidth:"100%"}}>
              <rect x="0" y="0" width={VB.W} height={VB.H} fill="#fbfcfa" />
              {quad.map(([L,lon,lat]) => <text key={L} x={projX(lon)} y={projY(lat)} fontFamily="Inter Tight, sans-serif" fontSize="42" fill="#ECEFE9" fontWeight="700" textAnchor="middle" dominantBaseline="middle">{L}</text>)}
              {gridLines}
              {/* obfuscation cells (accepted) */}
              {!exact && cells.map(c => {
                const x = projX(c.lonLo), y = projY(c.latHi), w = projX(c.lonHi)-projX(c.lonLo), h = projY(c.latLo)-projY(c.latHi);
                const on = sel && sel.code === c.code;
                return (
                  <g key={c.code} className="mp-cell" onClick={()=>setSel(c)}>
                    <rect x={x} y={y} width={w} height={h} fill="#2E6E5E" fillOpacity={on?0.34:0.2} stroke="#2E6E5E" strokeOpacity={on?0.9:0.5} />
                    <text x={x+w/2} y={y+h/2} fontFamily="IBM Plex Mono, monospace" fontSize="12" fill="#2E6E5E" textAnchor="middle" dominantBaseline="middle">{c.n}</text>
                  </g>
                );
              })}
              {/* exact points (granted) */}
              {exact && accepted.map(o => (
                <g key={o.id}><circle cx={projX(o.lon)} cy={projY(o.lat)} r="4.5" fill="#A83A2C" />
                  <circle cx={projX(o.lon)} cy={projY(o.lat)} r="9" fill="none" stroke="#A83A2C" strokeOpacity="0.4" /></g>
              ))}
              {/* pending markers (rough cell centre) */}
              {pending.map(o => { const c = qdsCell(o.lat,o.lon,depth); const cx = projX((c.lonLo+c.lonHi)/2), cy = projY((c.latLo+c.latHi)/2);
                return <rect key={o.id} x={cx-5} y={cy-5} width="10" height="10" fill="none" stroke="#C9A23A" strokeWidth="2" transform={`rotate(45 ${cx} ${cy})`} />; })}
            </svg>
          </div>

          <div className="mp-readout">
            <span><span className="lbl">cursor</span> {hover || "—"}</span>
            {sel && <span><span className="lbl">cell</span> {sel.code} · {sel.n} obs · ≈25 km</span>}
            {exact && <span className="red">⚠ exact coordinates — served in-session, never written to the offline store</span>}
          </div>

          <div className="mp-legend">
            <span><i style={{background:"#2E6E5E",opacity:0.4}}/>accepted (obfuscated cell)</span>
            <span><i style={{background:"transparent",border:"2px solid #C9A23A",borderRadius:0,transform:"rotate(45deg)"}}/>pending</span>
            <span><i style={{background:"#A83A2C"}}/>exact point (granted)</span>
          </div>

          <div className="mp-about">
            <b>Casabio QDS</b> — a hemisphere-aware recursive quad-tree. Each cell splits <code>A</code>=NW <code>B</code>=NE <code>C</code>=SW <code>D</code>=SE, repeating to any depth, so it works in all four hemispheres (S/N, E/W) unlike the Southern-Africa-only original. The whole frame above is one degree cell <code>S31E018</code>; <b>Half°</b> shows its four quadrants, <b>QDS</b> the ~25 km quarter-degree squares (two letters), and each extra level appends another letter. Public users are capped at QDS; precise coordinates require a granted, expiring, in-session capability.
          </div>
        </div>

        <div className="mp-rail">
          <h3 className="mp-rh">Pending · {pending.length}</h3>
          <div className="mp-rsub">Accept to add to the distribution. Rejection requires a reason.</div>
          {pending.map(o => (
            <div key={o.id} className="po-card">
              <div className="po-top"><span className="po-id">{o.id}</span><span className="po-src">{o.src}</span></div>
              <div className="po-meta">{o.who} · {o.date} · <span className="coord">{qdsCell(o.lat,o.lon,2).code}</span></div>
              {rejectId === o.id ? (
                <div className="po-reject">
                  <textarea value={rejectText} onChange={e=>setRejectText(e.target.value)} placeholder="Why is this being rejected? (required)" />
                  <div className="need">A reason is required and is kept on the record.</div>
                  <div className="row"><button onClick={()=>{setRejectId(null);setRejectText("");}}>Cancel</button><button className="confirm" disabled={!rejectText.trim()} onClick={()=>doReject(o.id)}>Confirm reject</button></div>
                </div>
              ) : (
                <div className="po-acts">
                  <button className="acc" onClick={()=>accept(o.id)}>Accept</button>
                  <button className="rej" onClick={()=>{setRejectId(o.id);setRejectText("");}}>Reject</button>
                </div>
              )}
            </div>
          ))}
          {pending.length===0 && <div className="mp-rsub">No pending observations.</div>}

          {resolved.length>0 && (<>
            <h3 className="mp-rh" style={{marginTop:24}}>Resolved</h3>
            {resolved.map(o => <div key={o.id} className="po-done"><span className="mk x">✕</span>{o.id} rejected — “{o.comment}”</div>)}
          </>)}

          <h3 className="mp-rh" style={{marginTop:24}}>Precise access</h3>
          {!granted && !requesting && <div className="mp-rsub">Localities are shown at QDS. Precise coordinates need a per-object, purpose-bound, expiring grant.</div>}
          {requesting && (
            <div className="mp-reqcard">
              <h4>Request precise access</h4>
              <p>Object-specific, time-limited (10 min), logged, and revocable. Served in-session only — never written to your device.</p>
              <select value={purpose} onChange={e=>setPurpose(e.target.value)}>
                <option>Range assessment for Red List</option>
                <option>Field re-collection (permitted)</option>
                <option>Taxonomic revision</option>
              </select>
              <div className="row"><button onClick={()=>setRequesting(false)}>Cancel</button><button className="grant" onClick={grant}>Grant</button></div>
            </div>
          )}
          {granted && <div className="mp-rsub" style={{color:"var(--type-red)"}}>Active grant · {purpose} · expires {mmss}.</div>}

          <button className="rv-nominate" style={{marginTop:18}} onClick={onOpenReader}>Open treatment in Reader →</button>
        </div>
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
