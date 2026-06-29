/** Demo detailing site loaded by the no-AI test-site builder path. */
export const SAMPLE_SITE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sunny Street Detailing</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; color: #172033; background: #f8fafc; }
    header { background: linear-gradient(135deg, #0f172a, #155e75); color: white; padding: 28px 6vw 80px; }
    nav { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 70px; }
    nav a { color: #c7f9ff; margin-left: 18px; text-decoration: none; font-weight: 700; }
    .hero { max-width: 860px; }
    .eyebrow { color: #67e8f9; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    h1 { font-size: clamp(42px, 8vw, 82px); line-height: .9; margin: 14px 0 22px; }
    p { font-size: 18px; line-height: 1.7; }
    .cta-row { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 30px; }
    button, .button { border: 0; border-radius: 999px; padding: 16px 24px; font-weight: 900; cursor: pointer; text-decoration: none; display: inline-flex; }
    .primary { background: #22c55e; color: #04130a; }
    .secondary { background: white; color: #0f172a; }
    main { padding: 54px 6vw; }
    section { max-width: 1120px; margin: 0 auto 42px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 18px; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 28px; padding: 24px; box-shadow: 0 18px 60px rgba(15,23,42,.08); }
    .photo { width: 100%; min-height: 260px; object-fit: cover; border-radius: 28px; background: #e2e8f0; }
    footer { padding: 32px 6vw; background: #0f172a; color: #cbd5e1; text-align: center; }
  </style>
</head>
<body>
  <header>
    <nav>
      <strong data-ai-text-id="demo-brand">Sunny Street Detailing</strong>
      <div>
        <a href="#services">Services</a>
        <a href="#reviews">Reviews</a>
        <a href="#contact">Contact</a>
      </div>
    </nav>
    <div class="hero">
      <div class="eyebrow" data-ai-text-id="demo-eyebrow">Mobile car detailing in Phoenix</div>
      <h1 data-ai-text-id="demo-headline">A cleaner car without losing your Saturday.</h1>
      <p data-ai-text-id="demo-subhead">We come to your driveway with pro tools, clear pricing, and simple Venmo payment instructions. Perfect for busy families, rideshare drivers, and weekend cars that deserve better.</p>
      <div class="cta-row">
        <button id="stripe-payment-button-demo" class="primary" data-venmo-phone="801-555-1212" data-product-name="Full detail" data-product-price="$149">Pay for Full Detail $149</button>
        <a class="button secondary" href="#contact">Get a quote</a>
      </div>
    </div>
  </header>
  <main>
    <section id="services">
      <h2 data-ai-text-id="demo-services-heading">Services that look premium, not complicated.</h2>
      <div class="grid">
        <div class="card"><h3 data-ai-text-id="demo-card-one-title">Quick Wash</h3><p data-ai-text-id="demo-card-one-copy">Exterior wash, wheels, windows, and a clean finish for cars that need a fast reset.</p></div>
        <div class="card"><h3 data-ai-text-id="demo-card-two-title">Interior Reset</h3><p data-ai-text-id="demo-card-two-copy">Vacuum, wipe-down, cupholders, mats, and all the little places crumbs love to hide.</p></div>
        <div class="card"><h3 data-ai-text-id="demo-card-three-title">Full Detail</h3><p data-ai-text-id="demo-card-three-copy">The whole package for sellers, busy parents, date night, or just feeling proud of your car again.</p></div>
      </div>
    </section>
    <section>
      <img class="photo" data-image-index="demo-hero-photo" alt="Clean detailed car" src="https://placehold.co/1200x520/e0f2fe/0f172a?text=Upload+a+real+job+photo" />
    </section>
    <section id="reviews">
      <div class="card">
        <h2 data-ai-text-id="demo-review-heading">Neighbors notice the difference.</h2>
        <p data-ai-text-id="demo-review-copy">"Booked from my phone, paid by Venmo, and my truck looked better than when I bought it."</p>
      </div>
    </section>
    <section id="contact">
      <div class="card">
        <h2 data-ai-text-id="demo-contact-heading">Ready when your driveway is.</h2>
        <p data-ai-text-id="demo-contact-copy">Text us your car type, neighborhood, and which service you want. We will send the next open times.</p>
      </div>
    </section>
  </main>
  <footer data-ai-text-id="demo-footer">Sunny Street Detailing - Built as a no-AI test site inside OnePerson Empire.</footer>
</body>
</html>`;
