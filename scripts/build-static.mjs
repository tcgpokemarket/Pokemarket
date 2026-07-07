import { mkdir, writeFile, rm, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = new URL('../out/', import.meta.url);
const styles = `
:root{color-scheme:dark}
*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f1a;color:#fff;line-height:1.5}
a{color:inherit;text-decoration:none}img{max-width:100%;display:block}.wrap{max-width:1120px;margin:0 auto;padding:0 20px}.nav{position:sticky;top:0;z-index:20;background:rgba(15,15,26,.92);backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.1)}.nav-inner{height:64px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font-weight:900;font-size:20px;letter-spacing:-.02em;display:flex;align-items:center;gap:8px}.brand .accent{color:#ffab01}.nav-links{display:flex;gap:22px;flex-wrap:wrap;font-size:14px;color:#d1d5db}.btn{display:inline-flex;align-items:center;justify-content:center;border-radius:14px;padding:14px 22px;font-weight:800}.btn.primary{background:#ffab01;color:#111}.btn.secondary{border:1px solid rgba(255,255,255,.18);color:#fff}.hero{padding:72px 0 48px;text-align:center;position:relative;overflow:hidden}.eyebrow{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(255,171,1,.3);background:rgba(255,171,1,.1);color:#ffab01;border-radius:999px;padding:7px 16px;font-size:14px;font-weight:700}.hero h1{font-size:clamp(42px,7vw,82px);line-height:1.05;margin:18px auto;max-width:980px}.hero h1 .accent{color:#ffab01}.hero p{max-width:820px;margin:0 auto 28px;color:#d1d5db;font-size:20px}.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:24px}.card.dark{background:#13131f}.muted{color:#9ca3af}.section{padding:84px 0}.section.alt{background:rgba(255,255,255,.03);border-top:1px solid rgba(255,255,255,.1);border-bottom:1px solid rgba(255,255,255,.1)}.section h2{font-size:clamp(30px,4vw,44px);line-height:1.1;margin:10px 0 14px}.section .lead{max-width:780px;color:#9ca3af}.eyebrow-sm{font-size:12px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:#ffab01}.stack{display:grid;gap:14px}.pill{display:inline-flex;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);padding:4px 10px;font-size:12px;font-weight:700}.footer{padding:28px 0;border-top:1px solid rgba(255,255,255,.1);color:#9ca3af}.faq-item{padding:20px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}@media (max-width:900px){.grid-4,.grid-3,.grid-2{grid-template-columns:1fr 1fr}}@media (max-width:640px){.grid-4,.grid-3,.grid-2{grid-template-columns:1fr}.nav-links{display:none}.hero{padding-top:48px}}`;

const pages = [
  {
    path: 'index.html',
    title: 'TcgPoké Market',
    body: `
      <nav class="nav"><div class="wrap nav-inner"><a class="brand" href="/"><span>⚡</span><span>TCG</span><span class="accent">Poke</span><span>Market</span></a><div class="nav-links"><a href="/listings">Shop Singles</a><a href="/listings">Sealed</a><a href="/listings">Graded</a><a href="/sell">Sell With Us</a><a href="/live">Live Shows</a><a href="/#faq">FAQ</a></div><a class="btn primary" href="/listings">Shop Now</a></div></nav>
      <main>
        <section class="hero wrap">
          <div class="eyebrow">Trusted marketplace for collectors</div>
          <h1>Buy, sell, and bid on <span class="accent">Pokémon cards</span> with confidence.</h1>
          <p>TCG Poke Market is built for collectors who want clear listings, secure checkout, fast shipping, and a smooth way to sell their collection.</p>
          <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap"><a class="btn primary" href="/listings">Shop Now</a><a class="btn secondary" href="/sell">Sell Your Cards</a></div>
          <div class="grid-4" style="margin-top:48px">${['Fast','Trusted','Live','Easy'].map((v,i)=>`<div class="card"><div style="font-size:28px;font-weight:900;color:#ffab01">${v}</div><div class="muted">${['Secure dispatch','Collector-focused','Fresh inventory','Simple selling'][i]}</div></div>`).join('')}</div>
        </section>
        <section class="section alt"><div class="wrap"><div class="grid-4">${['Collector-focused marketplace','Clear product details and pricing','Secure checkout experience','Fast shipping and careful packing'].map((point)=>`<div class="card dark">${point}</div>`).join('')}</div></div></section>
        <section class="section wrap"><div class="eyebrow-sm">Shop by category</div><h2>Everything Pokémon TCG in one place</h2><p class="lead">Give visitors a clean path to the right product type so they can shop faster and convert sooner.</p><div class="grid-3" style="margin-top:28px">${[
          ['⚡','Pokémon Singles','Chase cards, modern hits, and everyday staples sorted by set, rarity, and condition.'],
          ['📦','Sealed Products','Booster boxes, ETBs, and collector boxes for opening, holding, or displaying.'],
          ['🏆','Graded Cards','Standout slabs with clear grading, strong presentation, and collector appeal.'],
          ['🔴','Live Shows','Join Whatnot-style live auctions, chat, and instant Buy Now drops in real time.'],
          ['🛡️','Accessories','Protective supplies, binders, sleeves, and storage essentials for every collection.'],
          ['🤝','Sell Your Collection','List cards and sealed products for collectors who want a clean, fast selling flow.']
        ].map(([icon,title,desc])=>`<a class="card" href="/listings"><div style="font-size:38px">${icon}</div><h3>${title}</h3><p class="muted">${desc}</p><div style="color:#ffab01;font-weight:700">Explore →</div></a>`).join('')}</div></div></section>
        <section class="section alt"><div class="wrap"><div style="display:flex;align-items:end;justify-content:space-between;gap:16px;flex-wrap:wrap"><div><div class="eyebrow-sm">Featured items</div><h2>High-interest listings that drive clicks</h2></div><a href="/listings" style="color:#ffab01;font-weight:700">Browse all listings →</a></div><div class="grid-3" style="margin-top:24px">${[
          ['Charizard ex','Obsidian Flames','125/197','Hot Listing','Near Mint','$189.99'],
          ['Umbreon V','Evolving Skies','188/203','Collector Favorite','Near Mint','$124.50'],
          ['Charizard','Base Set','4/102','Graded','PSA 9','$549.00']
        ].map(([name,set,number,badge,condition,price])=>`<a class="card dark" href="/listings"><div class="card" style="height:144px;display:flex;align-items:center;justify-content:center;font-size:52px">🃏</div><div style="display:flex;justify-content:space-between;gap:12px;margin-top:14px"><h3 style="margin:0">${name}</h3><span class="pill" style="color:#ffab01;border-color:rgba(255,171,1,.2);background:rgba(255,171,1,.1)">${badge}</span></div><div class="muted" style="font-size:12px;margin-top:4px">${set} · ${number}</div><div class="muted" style="font-size:12px;margin-top:4px">${condition}</div><div style="font-size:28px;font-weight:900;margin-top:14px">${price}</div></a>`).join('')}</div></div></section>
        <section class="section wrap"><div class="grid-2" style="align-items:center"><div><div class="eyebrow-sm">Sell with us</div><h2>Turn your collection into cash</h2><p class="lead">Make selling feel simple. Use a clean intake flow, reach collectors, and get your inventory in front of buyers who already know what they want.</p><div class="stack" style="margin-top:28px">${[['Submit your cards','Send in singles, sealed products, or a full collection with simple intake.'],['Get reviewed','We check condition, pricing, and listing readiness before items go live.'],['Sell with confidence','Reach collectors ready to buy, bid, and complete checkout quickly.']].map(([title,desc],i)=>`<div class="card"><div style="display:flex;gap:14px"><div class="pill" style="min-width:40px;justify-content:center;color:#ffab01">0${i+1}</div><div><div style="font-weight:800">${title}</div><div class="muted">${desc}</div></div></div></div>`).join('')}</div><div class="card" style="margin-top:20px;background:linear-gradient(135deg, rgba(255,171,1,.12), rgba(147,51,234,.12));text-align:center"><div style="font-size:56px">🎯</div><h3>Built for buyer intent</h3><p class="muted">Showcase the right products, remove friction, and keep every page focused on getting visitors to the next click.</p><a class="btn secondary" href="/dashboard">Go to Dashboard</a></div></div></div></section>
        <section class="section alt"><div class="wrap"><div class="eyebrow-sm">Social proof</div><h2>Trusted by collectors and sellers</h2><div class="grid-3" style="margin-top:24px">${[
          ['“The layout makes it easy to find what I want fast, and the listings feel collector-first.”','Jordan M.','Collector'],
          ['“Selling was simple and the process felt clear from the start.”','Alex R.','Seller'],
          ['“Great place to browse sealed and graded cards without feeling overwhelmed.”','Sam T.','Collector']
        ].map(([quote,author,role])=>`<div class="card dark"><div style="color:#ffab01;font-size:24px;margin-bottom:10px">★★★★★</div><p style="font-style:italic;color:#d1d5db">${quote}</p><div style="font-weight:800;margin-top:14px">${author}</div><div class="muted" style="font-size:12px">${role}</div></div>`).join('')}</div></div></section>
        <section class="section wrap" id="faq"><div class="eyebrow-sm">FAQ</div><h2>Answer the questions that stop people from buying</h2><div class="stack" style="margin-top:24px">${[
          ['What do you sell?','We focus on Pokémon singles, sealed products, graded cards, and collector accessories.'],
          ['How do I find the right product?','Use the category pages to browse by product type, then filter by set, condition, and price.'],
          ['Can I sell my cards here?','Yes — use the sell page to start the process and submit your collection.'],
          ['How do auctions work?','Live auctions show the current bid, timing, and listing details so buyers can act fast.']
        ].map(([q,a])=>`<div class="faq-item"><div style="font-weight:800">${q}</div><div class="muted" style="margin-top:8px">${a}</div></div>`).join('')}</div></div></section>
      </main>
      <footer class="footer"><div class="wrap" style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center"><div class="brand"><span>⚡</span><span>TCG</span><span class="accent">Poke</span><span>Market</span></div><div>© 2026 TCG Poke Market. All rights reserved.</div></div></footer>
    `,
  },
  { path: 'listings/index.html', title: 'Listings | TcgPoké Market', body: `<div class="wrap" style="padding:90px 20px"><div class="eyebrow-sm">Listings</div><h1>Browse current inventory</h1><p class="lead">This publish-safe preview keeps the storefront live while the full marketplace continues running in the app.</p><div class="grid-3" style="margin-top:28px">${['Charizard ex','Umbreon V','PSA 9 Charizard'].map((name)=>`<div class="card dark"><div class="card" style="height:160px;display:flex;align-items:center;justify-content:center;font-size:48px">🃏</div><h3>${name}</h3><p class="muted">Collector item · Secure checkout available in the app</p></div>`).join('')}</div><p style="margin-top:24px"><a class="btn primary" href="/">Back home</a></p></div>` },
  { path: 'sell/index.html', title: 'Sell | TcgPoké Market', body: `<div class="wrap" style="padding:90px 20px"><div class="eyebrow-sm">Sell</div><h1>Start a selling request</h1><p class="lead">Submit your collection through the live app for full intake, pricing, and fulfillment.</p><p style="margin-top:24px"><a class="btn primary" href="/">Back home</a></p></div>` },
  { path: 'live/index.html', title: 'Live Shows | TcgPoké Market', body: `<div class="wrap" style="padding:90px 20px"><div class="eyebrow-sm">Live shows</div><h1>Live auctions are available in the app experience</h1><p class="lead">This published version includes a lightweight landing page so the site can go live while the full live commerce tools keep running behind the scenes.</p><p style="margin-top:24px"><a class="btn primary" href="/">Back home</a></p></div>` },
  { path: 'dashboard/index.html', title: 'Dashboard | TcgPoké Market', body: `<div class="wrap" style="padding:90px 20px"><div class="eyebrow-sm">Dashboard</div><h1>Dashboard access</h1><p class="lead">The full seller and admin experience remains in the app build.</p><p style="margin-top:24px"><a class="btn primary" href="/">Back home</a></p></div>` },
  { path: 'auth/index.html', title: 'Sign In | TcgPoké Market', body: `<div class="wrap" style="padding:90px 20px"><div class="eyebrow-sm">Sign in</div><h1>Sign in to continue</h1><p class="lead">Authentication remains available in the full app experience.</p><p style="margin-top:24px"><a class="btn primary" href="/">Back home</a></p></div>` },
];

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await mkdir(new URL('./listings/', outDir), { recursive: true });
  await mkdir(new URL('./sell/', outDir), { recursive: true });
  await mkdir(new URL('./live/', outDir), { recursive: true });
  await mkdir(new URL('./dashboard/', outDir), { recursive: true });
  await mkdir(new URL('./auth/', outDir), { recursive: true });

  const logoSrc = new URL('../public/placeholder-logo.png', import.meta.url);
  try {
    await copyFile(logoSrc, new URL('./logo.png', outDir));
  } catch {}

  for (const page of pages) {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${page.title}</title><meta name="description" content="TcgPoké Market"/><style>${styles}</style></head><body>${page.body}</body></html>`;
    await writeFile(new URL(`./${page.path}`, outDir), html, 'utf8');
  }

  await writeFile(new URL('./404.html', outDir), `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Not Found</title><style>${styles}</style></head><body><div class="wrap" style="padding:90px 20px"><h1>Page not found</h1><p class="lead">The page you asked for doesn’t exist in the published version.</p><p><a class="btn primary" href="/">Go home</a></p></div></body></html>`, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
