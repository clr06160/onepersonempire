// app/page.tsx   ← UPDATED VERSION (with your exact desired flow + premium builder UI)
'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { BuilderBrandHeader } from '@/components/builder/BuilderBrandHeader';
import { FeedbackOverlays, type AppToast, type ConfirmAction } from '@/components/builder/FeedbackOverlays';
import { GeneratedSitePreview } from '@/components/builder/GeneratedSitePreview';
import { LevelUpPanel, type BuilderAddon } from '@/components/builder/LevelUpPanel';
import { VectorAvatarBuilder } from '@/components/builder/VectorAvatarBuilder';
import { addAvatarSectionToHtml, type AvatarConfig } from '@/lib/builder/avatar-html';
import { SPRITE_AVATAR_ROADMAP } from '@/lib/builder/avatar-roadmap';
import { addCouponToHtml } from '@/lib/builder/coupon-transforms';
import { setPreviewModeHtml } from '@/lib/builder/html-transforms';
import { escapeHtmlContent, escapeRegExp, makeSlug } from '@/lib/builder/html-utils';
import { findImageTagByIndex, replaceImageSrcByIndex } from '@/lib/builder/image-transforms';
import { addPageLikeSectionToHtml, removeAddedPageFromHtml } from '@/lib/builder/page-templates';
import {
  buildVenmoPayment,
  updatePaymentButtonHtml,
  extractVenmoPhoneNumber,
  formatVenmoPhoneNumber,
  normalizePaymentAmount,
  normalizeCheckoutUrl,
  inferCheckoutProvider,
  parseVenmoPaymentInstructions,
} from '@/lib/builder/payment-transforms';

type BuilderMode = 'normal' | 'expand' | 'onepage' | 'rewrite';

type IdeaValidation = {
  verdict: string;
  score: number;
  buyer: string;
  whyItMightWork: string[];
  whyItMightFail: string[];
  sharperOffer: string;
  firstCustomer: string;
  nextMove: string;
};

type BusinessPlan = {
  summary: string;
  offer: string;
  targetCustomer: string;
  pricing: string;
  earningEstimate: {
    label: string;
    monthlyRevenueRange: string;
    likelyTakeHomeRange: string;
    assumptions: string[];
    confidence: string;
  };
  salesChannels: string[];
  sevenDayPlan: string[];
  websiteBrief: string;
  firstOutreachMessage: string;
};

type PricingEstimate = {
  summary: string;
  recommendedPrice: string;
  priceTiers: {
    name: string;
    price: string;
    includes: string;
  }[];
  localFactors: string[];
  assumptions: string[];
  confidence: string;
};

type HuntedIdea = {
  idea: string;
  validation: IdeaValidation;
};

type ActiveImageEdit = {
  imageIndex: number | string;
  currentSrc: string;
  altText: string;
  imageBrief: string;
  sectionText: string;
};

type BusinessMemory = {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  serviceArea: string;
  services: string;
  pricingNotes: string;
  paymentInfo: string;
  themeStyle: string;
  tone: string;
  notes: string;
};

type CleanBusinessBrief = {
  summary: string;
  businessType: string;
  location: string;
  primaryOffer: string;
  targetCustomer: string;
  toneStyle: string;
  paymentContact: string;
  mustInclude: string[];
  ignoreForFirstVersion: string[];
};

const AI_COPY_REWRITE_LIMIT = 5;
const AI_SITE_REWRITE_LIMIT = 3;
const AI_IMAGE_GENERATION_LIMIT = 3;
const SHOW_EXPERIMENTAL_TOOLS = false;
const SHOW_BIGGER_WEBSITE_OPTION = false;
const PAGE_SECTION_OPTIONS = [
  'Menu / Prices',
  'Services',
  'Gallery / Before & After',
  'Reviews',
  'About',
  'Contact / Booking',
  'Coupons / Specials',
  'FAQ',
  'Service Area',
  'Financing / Warranty',
  'Custom',
];

const FUN_AGENT_CARDS = [
  {
    name: 'Industry Joke Bot',
    tagline: 'One tiny joke for whatever business you are building.',
    prompt: 'Tell me a clean, short joke for this business. Make it specific to the industry, not generic.',
  },
  {
    name: 'Mascot Maker',
    tagline: 'Invents a goofy mascot for the business.',
    prompt: 'Invent a funny mascot for this business. Give it a name, look, and catchphrase.',
  },
  {
    name: 'Meme Captioner',
    tagline: 'Turns the business into a meme caption.',
    prompt: 'Write three funny meme captions about this business or its customers.',
  },
  {
    name: 'Roast My Website',
    tagline: 'A gentle roast that still helps.',
    prompt: 'Gently roast this website idea in a funny way, then give one useful improvement.',
  },
  {
    name: 'Fortune Cookie',
    tagline: 'A strange little business fortune.',
    prompt: 'Write a fortune-cookie style prediction for this business. Keep it funny and oddly encouraging.',
  },
  {
    name: 'Neighbor Pitch',
    tagline: 'A casual text someone would actually send a friend.',
    prompt: 'Write a funny, friendly one-sentence text someone could send a neighbor about this business.',
  },
];

const NEIGHBOR_PITCH_PEOPLE = [
  {
    name: 'Maya',
    role: 'Busy neighbor',
    imageUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
  },
  {
    name: 'Ron',
    role: 'Helpful dad down the street',
    imageUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
  },
  {
    name: 'Tasha',
    role: 'Friend who knows everybody',
    imageUrl: 'https://randomuser.me/api/portraits/women/68.jpg',
  },
  {
    name: 'Eli',
    role: 'Guy from the group chat',
    imageUrl: 'https://randomuser.me/api/portraits/men/75.jpg',
  },
];

type NeighborPitchPerson = typeof NEIGHBOR_PITCH_PEOPLE[number];

const AVATAR_TRADES = [
  'Auto from site',
  'Chef',
  'Painter',
  'Barista',
  'Slime shop owner',
  'Landscaper',
  'Cleaner',
  'Mechanic',
  'Contractor',
  'Baker',
  'Detailer',
  'Barber',
  'Tutor',
  'Custom',
];

const AVATAR_GENDERS = ['No preference', 'Female', 'Male'];
const AVATAR_STYLES = ['Polished cartoon', '3D game character', 'Sticker mascot', 'Anime-inspired'];
const AVATAR_MOODS = ['Friendly', 'Confident', 'Goofy', 'Cool', 'Premium'];
const AVATAR_POSES = ['Waving', 'Holding tool', 'Thumbs up', 'Arms crossed', 'Pointing at offer'];
const AVATAR_HAIR_COLORS = ['Auto', 'Black', 'Brown', 'Blonde', 'Red', 'Pink', 'Blue', 'Green', 'Silver'];
const AVATAR_EYE_COLORS = ['Auto', 'Brown', 'Blue', 'Green', 'Hazel', 'Gray'];
const AVATAR_FACE_FEATURES = [
  'Auto',
  'Big smile',
  'Freckles',
  'Glasses',
  'Dimples',
  'Confident eyebrows',
  'Round face',
  'Sharp jaw',
];

const inferAvatarTradeFromContext = (context: string) => {
  const text = context.toLowerCase();
  if (/\b(coffee|espresso|latte|cafe|café|barista)\b/.test(text)) return 'Barista';
  if (/\b(restaurant|food|pizza|taco|burger|menu|catering|chef|meal|kitchen)\b/.test(text)) return 'Chef';
  if (/\b(paint|painter|painting|drywall)\b/.test(text)) return 'Painter';
  if (/\b(lawn|landscape|mowing|yard|garden|snow removal)\b/.test(text)) return 'Landscaper';
  if (/\b(clean|cleaning|maid|housekeeping|janitor)\b/.test(text)) return 'Cleaner';
  if (/\b(mechanic|auto repair|garage|oil change|brake)\b/.test(text)) return 'Mechanic';
  if (/\b(detail|detailing|car wash|mobile wash)\b/.test(text)) return 'Detailer';
  if (/\b(bake|bakery|cookie|cupcake|bread|cake)\b/.test(text)) return 'Baker';
  if (/\b(barber|haircut|salon|fade)\b/.test(text)) return 'Barber';
  if (/\b(tutor|lesson|homework|math|reading)\b/.test(text)) return 'Tutor';
  if (/\b(slime|craft|sticker|bracelet|handmade)\b/.test(text)) return 'Slime shop owner';
  if (/\b(contractor|repair|remodel|handyman|roof|plumb|electric)\b/.test(text)) return 'Contractor';
  return 'Business creator';
};

const CUSTOMER_LISTS = {
  good: {
    title: 'A Customer List',
    intro: 'The private contractor ranking system: who gets taken care of first, who gets scheduled normally, and who is never getting another Saturday.',
    badge: 'Priority board',
    items: [
      {
        name: 'A - Do whatever they ask right away',
        sign: 'Pays on time, communicates clearly, respects the work, and sends good referrals.',
        move: 'Answer fast. Protect this relationship. These customers are the business.',
      },
      {
        name: 'B - Schedule when we can',
        sign: 'Good customer, normal job, no drama. Worth keeping, just not a fire drill.',
        move: 'Give them the next clean opening and make it easy to book.',
      },
      {
        name: 'C - If I have nothing else to do',
        sign: 'Small job, slow payer, unclear scope, or not enough upside to rearrange the week.',
        move: 'Only take it when the schedule is light, and keep the scope tight.',
      },
      {
        name: 'D - Not working for you again',
        sign: 'Cheapskate energy, moving goalposts, late payment, disrespect, or “while you are here...” forever.',
        move: 'Politely be unavailable. Future-you deserves peace.',
      },
    ],
  },
  bad: {
    title: 'Pet Peeve List',
    intro: 'A place for the irrational-but-earned contractor instincts. Not official truth. Just scars with bullet points.',
    badge: 'Never again vibes',
    items: [
      {
        name: 'The “quick question” collector',
        sign: 'Asks 14 questions before sharing the address, budget, or actual problem.',
        move: 'Use a short intake form or require photos before quoting.',
      },
      {
        name: 'The discount-first shopper',
        sign: 'Starts with “what is your cheapest price?” before understanding the offer.',
        move: 'Show a starter price and one premium option. Do not chase.',
      },
      {
        name: 'The moving-target customer',
        sign: 'Keeps changing the job after you quote it.',
        move: 'Write exactly what is included and charge for add-ons.',
      },
      {
        name: 'The emergency-but-not-ready lead',
        sign: 'Says it is urgent, then disappears when it is time to schedule or pay.',
        move: 'Hold slots only after confirmation or deposit.',
      },
      {
        name: 'The oddly specific personal pattern',
        sign: 'Every contractor has one: “people with this kind of car,” “that neighborhood,” “that phrase,” because one bad job burned it into memory.',
        move: 'Treat it as a reminder to tighten process, not as proof. Deposits, written scope, and clear payment links beat superstition.',
      },
    ],
  },
};

type CustomerListKind = keyof typeof CUSTOMER_LISTS;

const COLLECTION_STARTER_ITEMS = [
  {
    name: 'Neon Shop Sign',
    kind: 'Shop decor',
    rarity: 'Starter',
    use: 'Makes the top of the shop feel more like a real little world.',
  },
  {
    name: 'Slime Drop Sticker',
    kind: 'Offer sticker',
    rarity: 'Common',
    use: 'Put it on a coupon or product drop card.',
  },
  {
    name: 'Coffee Counter Background',
    kind: 'Shop skin',
    rarity: 'Common',
    use: 'Good for baristas, bakeries, and snack shops.',
  },
  {
    name: 'Painter Tool Belt',
    kind: 'Avatar item',
    rarity: 'Common',
    use: 'Avatar outfit piece for painter/contractor shops.',
  },
  {
    name: 'Tiny Shop Cat',
    kind: 'Pet helper',
    rarity: 'Rare',
    use: 'A fun pet that can sit on the site and make it feel alive.',
  },
  {
    name: 'Golden First Sale Badge',
    kind: 'Achievement',
    rarity: 'Rare',
    use: 'Unlocked later when a shop gets paid for the first time.',
  },
];

const FOLLOW_SHOP_IDEAS = [
  {
    name: 'Public or link-only',
    use: 'Shop owner chooses whether the shop can be discovered or only opened by link.',
  },
  {
    name: 'Follow shop',
    use: 'Visitors can follow for drops, coupons, new products, avatars, and updates.',
  },
  {
    name: 'No open messaging yet',
    use: 'Keeps the first version safer and less spammy, especially for younger users.',
  },
  {
    name: 'Shop feed later',
    use: 'Followers could see new drops from shops they like, without needing a full social network.',
  },
];

const LEVEL_UP_FEATURES = [
  {
    name: 'Custom domain',
    level: 'Level 1',
    status: 'MVP ready',
    description: 'Connect a real domain with simple GoDaddy support instructions and exact DNS records.',
    payoff: 'Makes the site feel like a real business, not a demo link.',
  },
  {
    name: 'Customer CRM',
    level: 'Level 2',
    status: 'Next',
    description: 'Private owner-only customer list with A/B/C/D priority, notes, phone, email, address, and do-not-work-again flags.',
    payoff: 'Helps contractors remember who to take care of and who to avoid.',
  },
  {
    name: 'Project / job board',
    level: 'Level 2',
    status: 'Next',
    description: 'Track leads, quoted jobs, scheduled jobs, completed jobs, and unpaid invoices.',
    payoff: 'Stops jobs from living in random texts, notebooks, and memory.',
  },
  {
    name: 'Recurring billing',
    level: 'Level 3',
    status: 'Big win',
    description: 'Weekly or monthly billing for lawn care, cleaning, pool service, maintenance, and other repeat work.',
    payoff: 'Set it once, get paid without chasing checks every week.',
  },
  {
    name: 'Autopay',
    level: 'Level 3',
    status: 'Stripe',
    description: 'Customer enters card once, then recurring charges happen automatically with receipts and failed-payment handling.',
    payoff: 'Turns repeat service into predictable cash flow.',
  },
  {
    name: 'Follow-up reminders',
    level: 'Level 2',
    status: 'Simple',
    description: 'Remind the owner to follow up after quotes, unpaid invoices, seasonal jobs, and repeat service windows.',
    payoff: 'More money from the same leads without being annoying.',
  },
];

type ActiveAddon = BuilderAddon;

const BUSINESS_MEMORY_STORAGE_KEY = 'ope-business-memory-v1';

const EMPTY_BUSINESS_MEMORY: BusinessMemory = {
  businessName: '',
  ownerName: '',
  phone: '',
  email: '',
  serviceArea: '',
  services: '',
  pricingNotes: '',
  paymentInfo: '',
  themeStyle: '',
  tone: '',
  notes: '',
};

const loadStoredBusinessMemory = () => {
  if (typeof window === 'undefined') return EMPTY_BUSINESS_MEMORY;
  try {
    const saved = window.localStorage.getItem(BUSINESS_MEMORY_STORAGE_KEY);
    return saved ? { ...EMPTY_BUSINESS_MEMORY, ...JSON.parse(saved) } as BusinessMemory : EMPTY_BUSINESS_MEMORY;
  } catch (error) {
    console.warn('[business-memory] could not load', error);
    return EMPTY_BUSINESS_MEMORY;
  }
};

const formatBusinessMemoryContext = (memory: BusinessMemory) => {
  const entries = [
    ['Business name', memory.businessName],
    ['Owner name', memory.ownerName],
    ['Phone', memory.phone],
    ['Email', memory.email],
    ['Service area', memory.serviceArea],
    ['Services/products', memory.services],
    ['Pricing notes', memory.pricingNotes],
    ['Payment info', memory.paymentInfo],
    ['Website theme/style', memory.themeStyle],
    ['Preferred tone', memory.tone],
    ['Business notes', memory.notes],
  ].filter(([, value]) => value.trim());

  if (!entries.length) return '';
  return `Saved business memory:\n${entries.map(([label, value]) => `- ${label}: ${value}`).join('\n')}`;
};

const formatIdeaWithBusinessMemory = (baseIdea: string, memory: BusinessMemory) => {
  const memoryContext = formatBusinessMemoryContext(memory);
  return memoryContext ? `${baseIdea || 'Use the saved business memory.'}\n\n${memoryContext}` : baseIdea;
};

const SAMPLE_SITE_HTML = `<!doctype html>
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

const readApiResponse = async (res: Response) => {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const readable = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(readable.slice(0, 500) || `Request failed with status ${res.status}`);
  }
};

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
};

const openSmsComposer = (message: string) => {
  window.location.href = `sms:?&body=${encodeURIComponent(message)}`;
};

export default function Home() {
  const [idea, setIdea] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [agent3, setAgent3] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [huntingIdeas, setHuntingIdeas] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [pricing, setPricing] = useState(false);
  const [buildStatus, setBuildStatus] = useState('');
  const [renderKey, setRenderKey] = useState(0);
  const [isEditingPreview, setIsEditingPreview] = useState(false);
  const [showEditHint, setShowEditHint] = useState(false);
  const ideaRef = useRef(idea);
  const agent3Ref = useRef(agent3);
  const neighborPitchIndexRef = useRef(0);

  // New state for the post-generation choice bar
  const [showChoiceBar, setShowChoiceBar] = useState(false);
  const [siteFeedback, setSiteFeedback] = useState('');
  const [pageSectionToAdd, setPageSectionToAdd] = useState('Services');
  const [customPageSectionName, setCustomPageSectionName] = useState('');
  const [activeAddon, setActiveAddon] = useState<ActiveAddon>('none');
  const [businessMemory, setBusinessMemory] = useState<BusinessMemory>(EMPTY_BUSINESS_MEMORY);
  const businessMemoryRef = useRef(businessMemory);
  const [validation, setValidation] = useState<IdeaValidation | null>(null);
  const [huntedIdeas, setHuntedIdeas] = useState<HuntedIdea[]>([]);
  const [businessPlan, setBusinessPlan] = useState<BusinessPlan | null>(null);
  const [pricingRequest, setPricingRequest] = useState('');
  const [pricingZipCode, setPricingZipCode] = useState('');
  const [pricingEstimate, setPricingEstimate] = useState<PricingEstimate | null>(null);
  const [cleanBrief, setCleanBrief] = useState<CleanBusinessBrief | null>(null);
  const [publishSlug, setPublishSlug] = useState('');
  const [publishedUrl, setPublishedUrl] = useState('');
  const [publishStatus, setPublishStatus] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [invoiceCustomerName, setInvoiceCustomerName] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [showDomainDns, setShowDomainDns] = useState(false);
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [connectedDomain, setConnectedDomain] = useState('');
  const [customDomainHosting, setCustomDomainHosting] = useState<{
    status?: string;
    message?: string;
  } | null>(null);
  const [isSavingCustomDomain, setIsSavingCustomDomain] = useState(false);
  const [aiCopyRewriteCount, setAiCopyRewriteCount] = useState(0);
  const [aiSiteRewriteCount, setAiSiteRewriteCount] = useState(0);
  const [aiImageGenerationCount, setAiImageGenerationCount] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [activeTextId, setActiveTextId] = useState('');
  const [modalText, setModalText] = useState('');
  const [activeDeletableSection, setActiveDeletableSection] = useState<{ id: string; label: string } | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [venmoPaymentAmount, setVenmoPaymentAmount] = useState('');
  const [venmoPaymentItem, setVenmoPaymentItem] = useState('');
  const [paymentMode, setPaymentMode] = useState<'venmo' | 'checkout'>('venmo');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [checkoutProvider, setCheckoutProvider] = useState('');
  const [isStripeModal, setIsStripeModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [activeImage, setActiveImage] = useState<ActiveImageEdit | null>(null);
  const [imageInstruction, setImageInstruction] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [activeFunAgentName, setActiveFunAgentName] = useState('');
  const [funAgentOutput, setFunAgentOutput] = useState('');
  const [funAgentImageUrl, setFunAgentImageUrl] = useState('');
  const [funAgentPerson, setFunAgentPerson] = useState<NeighborPitchPerson | null>(null);
  const [funCustomerListKind, setFunCustomerListKind] = useState<CustomerListKind | null>(null);
  const [funConceptPanel, setFunConceptPanel] = useState<'collection' | 'follow' | null>(null);
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState('');
  const [couponDetails, setCouponDetails] = useState('');
  const [avatarGender, setAvatarGender] = useState('No preference');
  const [avatarTrade, setAvatarTrade] = useState('Auto from site');
  const [customAvatarTrade, setCustomAvatarTrade] = useState('');
  const [avatarStyle, setAvatarStyle] = useState('Polished cartoon');
  const [avatarOutfit, setAvatarOutfit] = useState('match the business with a stylish, memorable outfit');
  const [avatarMood, setAvatarMood] = useState('Friendly');
  const [avatarPose, setAvatarPose] = useState('Waving');
  const [avatarHairColor, setAvatarHairColor] = useState('Auto');
  const [avatarEyeColor, setAvatarEyeColor] = useState('Auto');
  const [avatarFaceFeatures, setAvatarFaceFeatures] = useState('Auto');
  const [avatarImageUrl, setAvatarImageUrl] = useState('');
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [isRunningFunAgent, setIsRunningFunAgent] = useState(false);
  const [screenPetVisible, setScreenPetVisible] = useState(false);
  const [startOverConfirmOpen, setStartOverConfirmOpen] = useState(false);
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const toastIdRef = useRef(0);
  const backGuardPushedRef = useRef(false);

  useEffect(() => {
    ideaRef.current = idea;
  }, [idea]);

  useEffect(() => {
    agent3Ref.current = agent3;
  }, [agent3]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setBusinessMemory(loadStoredBusinessMemory());
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const showToast = (title: string, message = '', tone: AppToast['tone'] = 'info') => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    setToasts((current) => [...current.slice(-2), { id, title, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  };

  const openConfirm = (action: NonNullable<ConfirmAction>) => {
    setConfirmAction(action);
  };

  useEffect(() => {
    businessMemoryRef.current = businessMemory;
    window.localStorage.setItem(BUSINESS_MEMORY_STORAGE_KEY, JSON.stringify(businessMemory));
  }, [businessMemory]);

  useEffect(() => {
    if (!agent3.trim() || backGuardPushedRef.current) return;
    window.history.pushState({ onePersonEmpireBackGuard: true }, '', window.location.href);
    backGuardPushedRef.current = true;
  }, [agent3]);

  useEffect(() => {
    const handlePopState = () => {
      if (!agent3Ref.current.trim()) return;
      window.history.pushState({ onePersonEmpireBackGuard: true }, '', window.location.href);
      setStartOverConfirmOpen(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const slug = publishSlug || (publishedUrl ? publishedUrl.split('/').filter(Boolean).pop() || '' : '');
    if (!slug) return;

    let cancelled = false;
    const id = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/custom-domain?slug=${encodeURIComponent(slug)}`);
          const data = await res.json();
          if (cancelled) return;
          const domain = typeof data.domain === 'string' ? data.domain : '';
          setConnectedDomain(domain);
          if (domain) setCustomDomainInput(domain);
          setCustomDomainHosting(data.hosting && typeof data.hosting === 'object' ? data.hosting : null);
        } catch {
          if (!cancelled) setConnectedDomain('');
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [publishSlug, publishedUrl]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'EDIT_IMAGE') {
        const { imageIndex, instruction, altText, imageBrief, sectionText } = event.data;

        const currentHTML = agent3Ref.current;
        const imageTag = findImageTagByIndex(currentHTML, imageIndex);
        const currentSrc = imageTag.match(/\ssrc=(["'])(.*?)\1/i)?.[2] || '';

        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: instruction,
            idea: formatIdeaWithBusinessMemory(ideaRef.current, businessMemoryRef.current),
            imageIndex,
            currentSrc,
            altText,
            imageBrief,
            sectionText,
          }),
        });
        const data = await readApiResponse(res);
        if (data.success) {
          setAgent3(prev => replaceImageSrcByIndex(prev, imageIndex, String(data.dataUrl || '')));
          setRenderKey(prev => prev + 1);
        }
      }

      if (event.data?.type === 'OPEN_IMAGE_MODAL') {
        const nextImage = {
          imageIndex: event.data.imageIndex,
          currentSrc: event.data.currentSrc || '',
          altText: event.data.altText || '',
          imageBrief: event.data.imageBrief || '',
          sectionText: event.data.sectionText || '',
        };
        setActiveImage(nextImage);
        setImageInstruction(nextImage.imageBrief || nextImage.altText || '');
        setImageModalOpen(true);
      }

      if (event.data?.type === 'OPEN_TEXT_MODAL') {
        setActiveTextId(event.data.textId);
        setModalText(event.data.currentText || '');
        setActiveDeletableSection(event.data.canDeleteSection && event.data.sectionId
          ? {
            id: String(event.data.sectionId),
            label: String(event.data.sectionLabel || event.data.sectionId),
          }
          : null);
        if (event.data.textId?.startsWith('stripe-payment-button')) {
          const payment = parseVenmoPaymentInstructions(event.data.currentInstructions || '', event.data.currentLink || '');
          const mode = event.data.currentPaymentMode === 'checkout' || event.data.currentLink ? 'checkout' : 'venmo';
          setIsStripeModal(true);
          setPaymentMode(mode);
          setCheckoutUrl(event.data.currentLink || '');
          setCheckoutProvider(event.data.currentCheckoutProvider || inferCheckoutProvider(event.data.currentLink || ''));
          setPaymentInstructions(formatVenmoPhoneNumber(event.data.currentVenmoPhone || payment.phoneNumber));
          setVenmoPaymentAmount(event.data.currentProductPrice || payment.amount);
          setVenmoPaymentItem(event.data.currentProductName || payment.item);
        } else {
          setIsStripeModal(false);
        }
        setModalOpen(true);
      }

      if (event.data?.type === 'OPEN_PAYMENT_MODAL' || event.data?.type === 'OPEN_STRIPE_MODAL') {
        const payment = parseVenmoPaymentInstructions(event.data.currentInstructions || '', event.data.currentLink || '');
        const mode = event.data.currentPaymentMode === 'checkout' || event.data.currentLink ? 'checkout' : 'venmo';
        setActiveTextId(event.data.textId);
        setModalText(event.data.currentText || 'Pay Owner');
        setActiveDeletableSection(null);
        setPaymentMode(mode);
        setCheckoutUrl(event.data.currentLink || '');
        setCheckoutProvider(event.data.currentCheckoutProvider || inferCheckoutProvider(event.data.currentLink || ''));
        setPaymentInstructions(formatVenmoPhoneNumber(event.data.currentVenmoPhone || payment.phoneNumber));
        setVenmoPaymentAmount(event.data.currentProductPrice || payment.amount);
        setVenmoPaymentItem(event.data.currentProductName || payment.item);
        setIsStripeModal(true);
        setModalOpen(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleManualSave = () => {
    const isStripe = isStripeModal || activeTextId.startsWith('stripe-payment-button');

    if (isStripe) {
      if (paymentMode === 'checkout') {
        const safeCheckoutUrl = normalizeCheckoutUrl(checkoutUrl);
        if (!safeCheckoutUrl) {
          showToast('Checkout link needed', 'Paste a valid Stripe or PayPal checkout link.', 'error');
          return;
        }
        const provider = checkoutProvider.trim() || inferCheckoutProvider(safeCheckoutUrl);
        const buttonLabel = modalText.trim() && ['Pay Now', 'Buy Now', 'Pay Owner'].includes(modalText.trim()) === false
          ? modalText
          : provider === 'PayPal'
            ? 'Pay with PayPal'
            : provider === 'Stripe'
              ? 'Pay with Card'
              : 'Checkout';
        setAgent3(prev => updatePaymentButtonHtml(prev, activeTextId, buttonLabel, safeCheckoutUrl, '', {
          venmoPhone: '',
          productName: venmoPaymentItem,
          productPrice: normalizePaymentAmount(venmoPaymentAmount),
          paymentMode: 'checkout',
          checkoutProvider: provider,
        }));
        setRenderKey(prev => prev + 1);
        setModalOpen(false);
        setActiveDeletableSection(null);
        return;
      }

      if (!extractVenmoPhoneNumber(paymentInstructions)) {
        showToast('Venmo phone needed', 'Please enter your Venmo phone number to receive payments.', 'error');
        return;
      }
      if (!normalizePaymentAmount(venmoPaymentAmount)) {
        showToast('Price needed', 'Enter the fixed price customers should pay.', 'error');
        return;
      }
      const venmoPayment = buildVenmoPayment(paymentInstructions, venmoPaymentAmount, venmoPaymentItem);
      if (!venmoPayment) {
        showToast('Payment setup failed', 'Could not set up the Venmo payment button.', 'error');
        return;
      }
      const buttonLabel = ['Pay Now', 'Buy Now', 'Pay Owner'].includes(modalText.trim())
        ? `${venmoPaymentItem.trim() ? `Pay for ${venmoPaymentItem.trim()} ` : 'Pay Owner '}${normalizePaymentAmount(venmoPaymentAmount)}`
        : modalText;
      setAgent3(prev => updatePaymentButtonHtml(prev, activeTextId, buttonLabel, '', venmoPayment.fallbackText, {
        venmoPhone: venmoPayment.phoneNumber,
        productName: venmoPayment.item,
        productPrice: venmoPayment.amount,
        paymentMode: 'venmo',
        checkoutProvider: '',
      }));
    } else {
      const safeTextId = escapeRegExp(activeTextId);
      const safeModalText = escapeHtmlContent(modalText);
      const regex = new RegExp(`(data-ai-text-id="${safeTextId}"[^>]*>)(.*?)(<\\/)`, 'gs');
      setAgent3(prev => prev.replace(regex, (_match, open: string, _oldText: string, close: string) => `${open}${safeModalText}${close}`));
    }
    setRenderKey(prev => prev + 1);
    setModalOpen(false);
    setActiveDeletableSection(null);
  };

  const deleteActiveAddedPage = () => {
    if (!activeDeletableSection) return;
    const label = activeDeletableSection.label || activeDeletableSection.id;
    openConfirm({
      title: `Delete ${label}?`,
      message: 'This removes the page-style section and its More pages link from the website.',
      confirmLabel: 'Delete Page',
      tone: 'danger',
      onConfirm: () => {
        const nextHtml = removeAddedPageFromHtml(agent3Ref.current, activeDeletableSection.id);
        setAgent3(nextHtml);
        agent3Ref.current = nextHtml;
        setRenderKey(prev => prev + 1);
        setModalOpen(false);
        setActiveDeletableSection(null);
        showToast('Page deleted', `${label} was removed from the website.`, 'success');
      },
    });
  };

  const updateBusinessMemory = (key: keyof BusinessMemory, value: string) => {
    setBusinessMemory((current) => ({ ...current, [key]: value }));
  };

  const handleAISave = async () => {
    if (aiCopyRewriteCount >= AI_COPY_REWRITE_LIMIT) {
      showToast('AI rewrite limit reached', `AI copy rewrites are limited to ${AI_COPY_REWRITE_LIMIT} per site. Manual edits are still unlimited.`, 'info');
      return;
    }

    setIsGenerating(true);
    const isStripe = isStripeModal || activeTextId.startsWith('stripe-payment-button');
    const prompt = isStripe
      ? `Return ONLY 2-4 words. Create a short, clear call-to-action for a local business customer payment button.
Examples: "Pay Owner", "Pay Deposit", "Pay Invoice", "Reserve Spot", "Book Now", "Claim Offer".
No explanations. No full sentences. Just the button text.` 
      : `Rewrite this website copy so it sounds polished, specific, and persuasive.
Keep the same subject and important details.
Keep roughly the same length: if it is a paragraph, return a paragraph; if it is a heading, return a heading.
Do not shorten it into a vague slogan.
Return ONLY the rewritten copy.

Original copy:
${modalText}`;
      
    const res = await fetch('/api/generate-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await readApiResponse(res);
    if (data.success) {
      let cleanText = String(data.text || '').replace(/['"]/g, '').trim();
      if (isStripe && cleanText.split(' ').length > 4) {
        cleanText = cleanText.split(' ').slice(0, 3).join(' ');
      }
      setModalText(cleanText);
      setAiCopyRewriteCount(prev => prev + 1);
    }
    setIsGenerating(false);
  };

  const generateActiveImage = async () => {
    if (!activeImage || !imageInstruction.trim()) return;
    if (aiImageGenerationCount >= AI_IMAGE_GENERATION_LIMIT) {
      showToast('Image limit reached', `AI image generation is limited to ${AI_IMAGE_GENERATION_LIMIT} per site. Uploading real photos is still unlimited.`, 'info');
      return;
    }

    setIsGeneratingImage(true);
    try {
      const currentHTML = agent3Ref.current;
      const imageTag = findImageTagByIndex(currentHTML, activeImage.imageIndex);
      const currentSrc = imageTag.match(/\ssrc=(["'])(.*?)\1/i)?.[2] || activeImage.currentSrc;

      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imageInstruction,
          idea: formatIdeaWithBusinessMemory(ideaRef.current, businessMemory),
          imageIndex: activeImage.imageIndex,
          currentSrc,
          altText: activeImage.altText,
          imageBrief: activeImage.imageBrief,
          sectionText: activeImage.sectionText,
        }),
      });
      const data = await readApiResponse(res);
      if (data.success) {
        setAgent3(prev => replaceImageSrcByIndex(prev, activeImage.imageIndex, String(data.dataUrl || '')));
        setRenderKey(prev => prev + 1);
        setAiImageGenerationCount(prev => prev + 1);
        setImageModalOpen(false);
      } else {
        showToast('Image generation failed', String(data.error || 'Image generation failed'), 'error');
      }
    } catch (error) {
      showToast('Image generation failed', error instanceof Error ? error.message : 'Image generation failed', 'error');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const uploadActiveImage = async (file: File | null) => {
    if (!activeImage || !file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Choose an image file', 'The selected file is not an image.', 'error');
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read image file.'));
      reader.readAsDataURL(file);
    });

    setAgent3(prev => replaceImageSrcByIndex(prev, activeImage.imageIndex, dataUrl));
    setRenderKey(prev => prev + 1);
    setImageModalOpen(false);
  };

  const testPaymentLink = () => {
    if (paymentMode === 'checkout') {
      const safeCheckoutUrl = normalizeCheckoutUrl(checkoutUrl);
      if (!safeCheckoutUrl) {
        showToast('Checkout link needed', 'Paste a valid Stripe or PayPal checkout link.', 'error');
        return;
      }
      window.open(safeCheckoutUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!extractVenmoPhoneNumber(paymentInstructions)) {
      showToast('Venmo phone needed', 'Please enter your Venmo phone number to receive payments.', 'error');
      return;
    }
    if (!normalizePaymentAmount(venmoPaymentAmount)) {
      showToast('Price needed', 'Enter the fixed price customers should pay.', 'error');
      return;
    }
    const venmoPayment = buildVenmoPayment(paymentInstructions, venmoPaymentAmount, venmoPaymentItem);
    if (venmoPayment) {
      showToast('Venmo payment preview', venmoPayment.fallbackText, 'info');
      return;
    }
    showToast('Payment preview failed', 'Could not preview Venmo payment info.', 'error');
  };

  const startOverWithNewWebsite = () => {
    setAgent3('');
    agent3Ref.current = '';
    setShowChoiceBar(false);
    setActiveAddon('none');
    setPublishedUrl('');
    setPublishStatus('');
    setPublishSlug('');
    setInvoiceUrl('');
    setCleanBrief(null);
    setIsEditingPreview(false);
    setShowEditHint(false);
    setBuildStatus('');
    setStartOverConfirmOpen(false);
    backGuardPushedRef.current = false;
  };

  const cleanHTML = (html: string) => {
    if (!html) return '';
    const backticks = String.fromCharCode(96, 96, 96);
    return html.split(backticks + 'html').join('').split(backticks).join('').trim();
  };

  const downloadSiteHtml = () => {
    const html = cleanHTML(agent3);
    if (!html) return;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `onepersonempire-site-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const copySiteHtml = async () => {
    const html = cleanHTML(agent3);
    if (!html) return;

    await navigator.clipboard.writeText(html);
    showToast('HTML copied', 'Generated HTML copied to clipboard.', 'success');
  };

  const domainTarget = process.env.NEXT_PUBLIC_DOMAIN_CNAME_TARGET || 'onepersonempire.web.app';
  const domainExample = connectedDomain || customDomainInput.trim() || 'yourdomain.com';
  const domainSetupInstructions = [
    'Use your own domain with your OnePerson Empire website:',
    '',
    '1. Publish your site.',
    '2. Enter your domain and click Save domain.',
    '3. Open Show DNS records and give those records to GoDaddy.',
    '4. After GoDaddy updates DNS, wait a little while, then open your site at www.' + domainExample.replace(/^www\./, ''),
    '',
    `Domain: ${domainExample.replace(/^www\./, '')}`,
    '',
    'DNS record for www:',
    'Type: CNAME',
    'Name: www',
    `Value: ${domainTarget}`,
    '',
    'Root domain forwarding:',
    `Forward ${domainExample.replace(/^www\./, '')} to https://www.${domainExample.replace(/^www\./, '')}`,
    '',
    'You keep control of your domain. No second website builder or hosting plan needed.',
  ].join('\n');
  const paymentSetupScript = [
    'Quick payment setup question for your website:',
    '',
    'For the first tester version, the easiest option is your Venmo phone number. Customers click the payment button and see where to send payment.',
    '',
    'If you already use Stripe or PayPal, send me your Stripe Payment Link or PayPal checkout/pay link instead, and I can make the button open that checkout page.',
    '',
    'Please send one of these:',
    '1. Venmo phone number, plus the product/service name and price',
    '2. Stripe Payment Link',
    '3. PayPal checkout/pay link',
  ].join('\n');

  const copyText = async (text: string, title: string, message: string) => {
    await navigator.clipboard.writeText(text);
    showToast(title, message, 'success');
  };

  const saveCustomDomain = async () => {
    const slug = publishSlug || (publishedUrl ? publishedUrl.split('/').filter(Boolean).pop() || '' : '');
    if (!slug) {
      showToast('Publish first', 'Publish the site before connecting a custom domain.', 'info');
      return;
    }

    setIsSavingCustomDomain(true);
    try {
      const res = await fetch('/api/custom-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          domain: customDomainInput,
        }),
      });
      const data = await readApiResponse(res);
      if (!res.ok || data.error) {
        showToast('Domain not saved', String(data.error || 'Could not save custom domain.'), 'error');
        return;
      }

      const domain = String(data.domain || customDomainInput).replace(/^www\./, '');
      const hosting = data.hosting && typeof data.hosting === 'object'
        ? data.hosting as { status?: string; message?: string }
        : null;
      setConnectedDomain(domain);
      setCustomDomainInput(domain);
      setCustomDomainHosting(hosting);
      setShowDomainDns(true);
      const hostingMessage = hosting?.message ? ` ${hosting.message}` : '';
      showToast('Domain saved', `We registered ${domain} and saved your DNS steps.${hostingMessage}`, 'success');
    } catch (error) {
      showToast('Domain not saved', error instanceof Error ? error.message : 'Could not save custom domain.', 'error');
    } finally {
      setIsSavingCustomDomain(false);
    }
  };

  const publishCurrentSite = async () => {
    const html = cleanHTML(agent3Ref.current);
    const slug = makeSlug(publishSlug || ideaRef.current);
    if (!html) return;

    setIsPublishing(true);
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          html,
          idea: ideaRef.current,
        }),
      });
      const data = await readApiResponse(res);
      if (!res.ok || data.error || !data.url) {
        showToast('Publish failed', String(data.error || 'Publish failed'), 'error');
        return;
      }

      setPublishSlug(String(data.slug || slug));
      setPublishedUrl(String(data.url));
      const reviewStatus =
        (data.safetyReview as { status?: string } | undefined)?.status === 'needs_review'
          ? ' Safety review needs human follow-up.'
          : '';
      setPublishStatus(`Published. Uploaded ${data.assetCount || 0} image asset(s), saved ${data.chunkCount || 0} HTML chunk(s).${reviewStatus}`);
      showToast('Published', `Your live site is ready at ${String(data.url)}`, 'success');
    } catch (error) {
      showToast('Publish failed', error instanceof Error ? error.message : 'Publish failed', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const createManualInvoice = async () => {
    const slug = publishSlug || (publishedUrl ? publishedUrl.split('/').filter(Boolean).pop() || '' : '');
    if (!slug) {
      showToast('Publish first', 'Publish the site first so the invoice can attach to the right business.', 'info');
      return;
    }

    setIsCreatingInvoice(true);
    setInvoiceUrl('');
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          customerName: invoiceCustomerName,
          amount: invoiceAmount,
          description: invoiceDescription,
        }),
      });
      const data = await readApiResponse(res);
      if (!res.ok || data.error || !data.invoiceUrl) {
        showToast('Invoice failed', String(data.error || 'Could not create invoice.'), 'error');
        return;
      }

      setInvoiceUrl(String(data.invoiceUrl));
      const invoiceMessage = `Invoice for ${invoiceDescription.trim()}: ${String(data.invoiceUrl)}`;
      await navigator.clipboard.writeText(invoiceMessage);
      showToast('Invoice ready', 'The invoice link was copied and your SMS app is opening.', 'success');
      openSmsComposer(invoiceMessage);
    } catch (error) {
      showToast('Invoice failed', error instanceof Error ? error.message : 'Could not create invoice.', 'error');
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const invoiceLinksPanel = (
    <div className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-4">
      <p className="text-sm font-semibold text-emerald-300">Invoice links</p>
      <p className="mt-2 text-sm text-zinc-300">
        Create a pay-ready invoice link and send it by text, email, or however you already talk to customers.
        {!publishedUrl && ' Publish the site first so the invoice attaches to the right business.'}
      </p>
      <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/50 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-400"
            placeholder="Customer name optional"
            value={invoiceCustomerName}
            onChange={(e) => setInvoiceCustomerName(e.target.value)}
          />
          <input
            className="rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-400"
            placeholder="Amount, example 250"
            value={invoiceAmount}
            onChange={(e) => setInvoiceAmount(e.target.value)}
          />
          <input
            className="rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-400"
            placeholder="For, example gutter cleaning"
            value={invoiceDescription}
            onChange={(e) => setInvoiceDescription(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={createManualInvoice}
            disabled={isCreatingInvoice || !invoiceAmount.trim() || !invoiceDescription.trim()}
            className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {isCreatingInvoice ? 'Creating...' : 'Create Invoice Link'}
          </button>
          {invoiceUrl && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => openSmsComposer(`Invoice for ${invoiceDescription.trim()}: ${invoiceUrl}`)}
                className="rounded-xl border border-zinc-700 bg-black px-4 py-3 text-sm font-bold text-zinc-200 hover:border-emerald-500 hover:text-white"
              >
                Text Invoice Link
              </button>
              <a
                href={invoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm font-semibold text-emerald-300 hover:text-emerald-200"
              >
                Open invoice
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const validateIdea = async () => {
    if (!idea.trim()) return;

    setValidating(true);
    setValidation(null);
    setBusinessPlan(null);
    try {
      const res = await fetch('/api/validate-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: formatIdeaWithBusinessMemory(idea, businessMemory) }),
      });
      const data = await readApiResponse(res);
      if (!res.ok || data.error || !data.validation) {
        showToast('Idea validation failed', String(data.error || 'Idea validation failed'), 'error');
        return;
      }
      setValidation(data.validation as IdeaValidation);
    } catch (error) {
      showToast('Idea validation failed', error instanceof Error ? error.message : 'Idea validation failed', 'error');
    } finally {
      setValidating(false);
    }
  };

  const huntForIdeas = async () => {
    setHuntingIdeas(true);
    setHuntedIdeas([]);
    setValidation(null);
    setBusinessPlan(null);
    try {
      const res = await fetch('/api/hunt-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: formatIdeaWithBusinessMemory(idea, businessMemory),
          baselineScore: validation?.score,
        }),
      });
      const data = await readApiResponse(res);
      if (!res.ok || data.error || !Array.isArray(data.ideas)) {
        showToast('Idea hunt failed', String(data.error || 'Idea hunt failed'), 'error');
        return;
      }
      setHuntedIdeas(data.ideas as HuntedIdea[]);
    } catch (error) {
      showToast('Idea hunt failed', error instanceof Error ? error.message : 'Idea hunt failed', 'error');
    } finally {
      setHuntingIdeas(false);
    }
  };

  const handleUseHuntedIdea = (candidate: HuntedIdea) => {
    setIdea(candidate.idea);
    ideaRef.current = candidate.idea;
    setValidation(candidate.validation);
    setBusinessPlan(null);
  };

  const createBusinessPlan = async () => {
    if (!idea.trim()) return;

    setPlanning(true);
    setBusinessPlan(null);
    try {
      const res = await fetch('/api/business-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: formatIdeaWithBusinessMemory(idea, businessMemory), validation, zipCode }),
      });
      const data = await readApiResponse(res);
      if (!res.ok || data.error || !data.plan) {
        showToast('Business plan failed', String(data.error || 'Business plan failed'), 'error');
        return;
      }
      setBusinessPlan(data.plan as BusinessPlan);
    } catch (error) {
      showToast('Business plan failed', error instanceof Error ? error.message : 'Business plan failed', 'error');
    } finally {
      setPlanning(false);
    }
  };

  const runPricingAgent = async () => {
    const service = pricingRequest.trim() || idea.trim();
    const zip = pricingZipCode.trim() || zipCode.trim();
    if (!service.trim()) {
      showToast('Service needed', 'Enter what product or service you want priced.', 'error');
      return;
    }
    if (!zip.trim()) {
      showToast('ZIP needed', 'Enter a ZIP code for local pricing.', 'error');
      return;
    }

    setPricing(true);
    setPricingEstimate(null);
    setActiveFunAgentName('Pricing Agent');
    setFunAgentOutput('');
    setFunAgentImageUrl('');
    setFunAgentPerson(null);
    setFunCustomerListKind(null);
    setFunConceptPanel(null);
    try {
      const res = await fetch('/api/pricing-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: formatIdeaWithBusinessMemory(ideaRef.current, businessMemory),
          service,
          zipCode: zip,
        }),
      });
      const data = await readApiResponse(res);
      if (!res.ok || data.error || !data.pricing) {
        showToast('Pricing failed', String(data.error || 'Pricing agent failed'), 'error');
        return;
      }
      setPricingEstimate(data.pricing as PricingEstimate);
    } catch (error) {
      showToast('Pricing failed', error instanceof Error ? error.message : 'Pricing agent failed', 'error');
    } finally {
      setPricing(false);
    }
  };

  const runBuilder = async (mode: BuilderMode, feedbackInstruction = '') => {
    if (mode === 'rewrite') {
      if (!agent3Ref.current.trim() || !feedbackInstruction.trim()) return;
      if (aiSiteRewriteCount >= AI_SITE_REWRITE_LIMIT) {
        showToast('Full-site rewrite limit reached', `Full-site AI rewrites are limited to ${AI_SITE_REWRITE_LIMIT} per site. You can still edit text, upload photos, and adjust payments manually.`, 'info');
        return;
      }
    } else if (!idea.trim()) {
      return;
    }

    setLoading(true);
    setBuildStatus(
      mode === 'expand'
        ? 'Expanding into a fuller industry-style website…'
        : mode === 'onepage'
          ? 'Turning this into a focused one-page site…'
          : mode === 'rewrite'
            ? 'Rewriting site from your feedback…'
            : 'Building the website… (usually 30–90 seconds)',
    );

    try {
      const res = await fetchWithTimeout('/api/builder', {
        method: 'POST',
        body: JSON.stringify({
          idea: formatIdeaWithBusinessMemory(ideaRef.current, businessMemory),
          mode,
          currentHtml: mode === 'rewrite' ? cleanHTML(agent3Ref.current) : undefined,
          feedback: mode === 'rewrite' ? feedbackInstruction : undefined,
        }),
        headers: { 'Content-Type': 'application/json' },
      }, 210_000);
      const data = await readApiResponse(res);

      if (!res.ok || data.error) {
        showToast('Builder failed', String(data.error || 'Builder failed'), 'error');
        return;
      }
      if (!data.agent3) {
        showToast('Builder returned empty HTML', 'Check the terminal for errors.', 'error');
        return;
      }

      setAgent3(String(data.agent3));
      setCleanBrief(mode === 'rewrite' ? cleanBrief : data.cleanBrief as CleanBusinessBrief | null);
      setRenderKey((k) => k + 1);
      setIsEditingPreview(false);
      setShowEditHint(false);
      setShowChoiceBar(false);
      if (mode !== 'rewrite') {
        setAiCopyRewriteCount(0);
        setAiSiteRewriteCount(0);
        setAiImageGenerationCount(0);
      } else {
        setAiSiteRewriteCount(prev => prev + 1);
      }
      if (mode === 'rewrite') setSiteFeedback('');
    } catch (e) {
      const message = e instanceof Error && e.name === 'AbortError'
        ? 'Builder timed out after 210 seconds. Try a shorter business description or restart the dev server.'
        : e instanceof Error ? e.message : 'Network error — is npm run dev still running?';
      showToast('Builder failed', message, 'error');
    } finally {
      setLoading(false);
      setBuildStatus('');
    }
  };

  const loadSampleSite = () => {
    const sampleIdea = 'Sunny Street Detailing in Phoenix - no-AI demo site for testing the builder UI.';
    setIdea(sampleIdea);
    ideaRef.current = sampleIdea;
    setAgent3(SAMPLE_SITE_HTML);
    setCleanBrief({
      summary: 'Mobile auto detailing in Phoenix with clear pricing and Venmo payment instructions.',
      businessType: 'Mobile auto detailing',
      location: 'Phoenix',
      primaryOffer: 'Driveway car detailing packages',
      targetCustomer: 'Busy local drivers and families',
      toneStyle: 'Clean, trustworthy, practical',
      paymentContact: 'Venmo payment instructions and phone-friendly booking',
      mustInclude: ['services', 'pricing', 'reviews', 'payment instructions'],
      ignoreForFirstVersion: [],
    });
    setRenderKey((key) => key + 1);
    setIsEditingPreview(false);
    setShowChoiceBar(false);
    setActiveAddon('none');
    setPublishedUrl('');
    setPublishStatus('');
    setInvoiceUrl('');
    setFunAgentOutput('');
    setFunAgentImageUrl('');
    setFunAgentPerson(null);
    setFunCustomerListKind(null);
    setFunConceptPanel(null);
    setPricingEstimate(null);
    setAiCopyRewriteCount(0);
    setAiSiteRewriteCount(0);
    setAiImageGenerationCount(0);
  };

  const handleMakeOnePageSite = () => runBuilder('onepage');
  const handleExpandToMultiPage = () => runBuilder('expand');
  const handleRewriteSite = () => runBuilder('rewrite', siteFeedback);
  const handleAddPageSection = () => {
    const section = pageSectionToAdd === 'Custom'
      ? customPageSectionName.trim()
      : pageSectionToAdd.trim();
    if (!section) {
      showToast('Page name needed', 'Type a custom page name first.', 'error');
      return;
    }
    if (!agent3Ref.current.trim()) {
      showToast('Build a site first', 'Generate or load a site first, then add a page section.', 'info');
      return;
    }
    const result = addPageLikeSectionToHtml(agent3Ref.current, section);
    if (result.alreadyExists) {
      showToast('Page already exists', `${section} is already on this site.`, 'info');
      return;
    }
    setAgent3(result.html);
    agent3Ref.current = result.html;
    setRenderKey((key) => key + 1);
    setIsEditingPreview(false);
  };

  const createCouponSection = () => {
    const discount = couponDiscount.trim();
    if (!discount) {
      showToast('Discount needed', 'Enter the discount first, like 10%, $25, or Free estimate.', 'error');
      return;
    }
    if (!agent3Ref.current.trim()) {
      showToast('Build a site first', 'Generate or load a site first, then create a coupon.', 'info');
      return;
    }

    const updatedHtml = addCouponToHtml(agent3Ref.current, discount, couponDetails.trim());
    setAgent3(updatedHtml);
    agent3Ref.current = updatedHtml;
    setRenderKey((key) => key + 1);
    setIsEditingPreview(false);
    setCouponModalOpen(false);
    setActiveFunAgentName('Coupon Agent');
    setFunAgentOutput(`Coupon added: ${discount} off. Customers should mention the coupon code before paying or booking.`);
    setFunAgentImageUrl('');
    setFunAgentPerson(null);
    setFunCustomerListKind(null);
    setFunConceptPanel(null);
  };

  const showCustomerList = (kind: CustomerListKind) => {
    setActiveFunAgentName(CUSTOMER_LISTS[kind].title);
    setFunCustomerListKind(kind);
    setFunConceptPanel(null);
    setFunAgentOutput('');
    setFunAgentImageUrl('');
    setFunAgentPerson(null);
    setIsRunningFunAgent(false);
  };

  const showCollectionLocker = () => {
    setActiveFunAgentName('Collection Locker');
    setFunConceptPanel('collection');
    setFunCustomerListKind(null);
    setFunAgentOutput('');
    setFunAgentImageUrl('');
    setFunAgentPerson(null);
    setIsRunningFunAgent(false);
  };

  const showFollowShops = () => {
    setActiveFunAgentName('Follow Shops');
    setFunConceptPanel('follow');
    setFunCustomerListKind(null);
    setFunAgentOutput('');
    setFunAgentImageUrl('');
    setFunAgentPerson(null);
    setIsRunningFunAgent(false);
  };

  const currentAvatarTrade = () => (
    avatarTrade === 'Auto from site'
      ? inferAvatarTradeFromContext(`${idea}\n${formatBusinessMemoryContext(businessMemory)}\n${agent3.replace(/<[^>]*>/g, ' ')}`)
      : avatarTrade === 'Custom'
        ? customAvatarTrade.trim() || 'Business creator'
        : avatarTrade
  );

  const currentAvatarConfig = (): AvatarConfig => ({
    trade: currentAvatarTrade(),
    gender: avatarGender,
    style: avatarStyle,
    outfit: avatarOutfit.trim() || 'match the business with a stylish, memorable outfit',
    mood: avatarMood,
    pose: avatarPose,
    hairColor: avatarHairColor,
    eyeColor: avatarEyeColor,
    faceFeatures: avatarFaceFeatures,
  });

  const generateAvatar = async () => {
    if (aiImageGenerationCount >= AI_IMAGE_GENERATION_LIMIT) {
      showToast('Image limit reached', `AI image generation is limited to ${AI_IMAGE_GENERATION_LIMIT} per site.`, 'info');
      return;
    }

    const config = currentAvatarConfig();
    const businessContext = formatIdeaWithBusinessMemory(ideaRef.current, businessMemory).trim() || 'a young creator business';
    const prompt = `Create one polished, fun business avatar character.

Style: ${config.style}. Make it look like a high-quality creator-game avatar or sticker character, not corporate stock art.
Gender/person style: ${config.gender}.
Business role: ${config.trade}.
Outfit: ${config.outfit}.
Hair color: ${config.hairColor}.
Eye color: ${config.eyeColor}.
Facial features: ${config.faceFeatures}.
Mood: ${config.mood}.
Pose: ${config.pose}.
Business context: ${businessContext}.

Important: clean background, full character visible, good-looking, friendly, brand-safe, expressive, modern, suitable for a website hero or social share card. No text, no watermark, no logos.`;

    setIsGeneratingAvatar(true);
    setActiveFunAgentName('Avatar Studio');
    setFunCustomerListKind(null);
    setFunConceptPanel(null);
    setFunAgentPerson(null);
    setFunAgentImageUrl('');
    setFunAgentOutput('Generating a better avatar...');
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          idea: businessContext,
          imageIndex: 'avatar-studio',
          altText: `${config.trade} avatar`,
          imageBrief: 'A fun cartoon creator-game business avatar.',
          sectionText: businessContext,
        }),
      });
      const data = await readApiResponse(res);
      if (!res.ok || !data.success || !data.dataUrl) {
        throw new Error(String(data.error || 'Avatar generation failed.'));
      }
      const dataUrl = String(data.dataUrl);
      setAvatarImageUrl(dataUrl);
      setFunAgentImageUrl(dataUrl);
      setFunAgentOutput(`${config.trade} avatar generated. If you like it, add it to the site.`);
      setAiImageGenerationCount((count) => count + 1);
    } catch (error) {
      setFunAgentOutput(error instanceof Error ? error.message : 'Avatar generation failed.');
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const addAvatarToSite = () => {
    if (!agent3Ref.current.trim()) {
      showToast('Build a site first', 'Generate or load a site first, then add an avatar.', 'info');
      return;
    }
    if (!avatarImageUrl) {
      showToast('Avatar needed', 'Generate an avatar first.', 'info');
      return;
    }

    const config = currentAvatarConfig();
    const updatedHtml = addAvatarSectionToHtml(agent3Ref.current, config, businessMemory.businessName || ideaRef.current, avatarImageUrl);
    setAgent3(updatedHtml);
    agent3Ref.current = updatedHtml;
    setRenderKey((key) => key + 1);
    setIsEditingPreview(false);
    setActiveFunAgentName('Avatar Studio');
    setFunCustomerListKind(null);
    setFunConceptPanel(null);
    setFunAgentPerson(null);
    setFunAgentImageUrl(avatarImageUrl);
    setFunAgentOutput(`${config.trade} avatar added to the website. You can edit the avatar section copy in Edit mode.`);
  };

  const addVectorAvatarToSite = (imageUrl: string, outfitSummary: string) => {
    if (!agent3Ref.current.trim()) {
      showToast('Build a site first', 'Generate or load a site first, then add an avatar.', 'info');
      return;
    }

    const config: AvatarConfig = {
      ...currentAvatarConfig(),
      style: 'Aligned vector avatar',
      outfit: outfitSummary || 'custom vector avatar parts',
      mood: avatarMood,
    };
    const updatedHtml = addAvatarSectionToHtml(agent3Ref.current, config, businessMemory.businessName || ideaRef.current, imageUrl);
    setAgent3(updatedHtml);
    agent3Ref.current = updatedHtml;
    setRenderKey((key) => key + 1);
    setIsEditingPreview(false);
    setAvatarImageUrl(imageUrl);
    setActiveFunAgentName('Avatar Studio');
    setFunCustomerListKind(null);
    setFunConceptPanel(null);
    setFunAgentPerson(null);
    setFunAgentImageUrl(imageUrl);
    setFunAgentOutput(`${config.trade} vector avatar added to the website.`);
    showToast('Avatar added', 'The aligned vector avatar was added to the website.', 'success');
  };

  const runFunAgent = async (agent: typeof FUN_AGENT_CARDS[number]) => {
    const isMascotMaker = agent.name === 'Mascot Maker';
    const isFortuneCookie = agent.name === 'Fortune Cookie';
    const isNeighborPitch = agent.name === 'Neighbor Pitch';
    if (isMascotMaker && aiImageGenerationCount >= AI_IMAGE_GENERATION_LIMIT) {
      showToast('Image limit reached', `AI image generation is limited to ${AI_IMAGE_GENERATION_LIMIT} per site. Try the sheep or another text-only fun agent.`, 'info');
      return;
    }

    const businessContext = formatIdeaWithBusinessMemory(ideaRef.current, businessMemory).trim() || 'this local business';
    const siteContext = cleanHTML(agent3Ref.current)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1200);

    setActiveFunAgentName(agent.name);
    setFunAgentOutput('');
    setFunAgentImageUrl('');
    setFunCustomerListKind(null);
    setFunConceptPanel(null);
    setPricingEstimate(null);
    const selectedNeighbor = isNeighborPitch
      ? NEIGHBOR_PITCH_PEOPLE[neighborPitchIndexRef.current % NEIGHBOR_PITCH_PEOPLE.length]
      : null;
    if (isNeighborPitch) neighborPitchIndexRef.current += 1;
    setFunAgentPerson(selectedNeighbor);
    setIsRunningFunAgent(true);
    try {
      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${agent.prompt}

Business idea:
${businessContext}

Current website context:
${siteContext || 'No site generated yet.'}

${selectedNeighbor ? `Write it as ${selectedNeighbor.name}, a ${selectedNeighbor.role}. It should sound like a real casual text, not an ad.` : ''}

Keep it punchy, clean, and useful enough to make the builder feel fun.`,
        }),
      });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(String(data.error || 'Could not run that fun agent.'));
      const textOutput = String(data.text || data.output || 'This agent got shy. Try another one.');
      setFunAgentOutput(textOutput);

      if (isFortuneCookie) {
        setFunAgentImageUrl('/fortune-cookie-reusable.png');
      }

      if (isMascotMaker) {
        setFunAgentOutput(`${textOutput}\n\nDrawing the mascot now...`);
        const imageRes = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `Create a cheerful, brand-safe mascot character based on this description:
${textOutput}

Business:
${businessContext}

Style: playful sticker mascot, clean background, expressive, friendly, not scary, useful for a local business website.`,
            idea: businessContext,
            imageIndex: 'fun-mascot',
            altText: `${businessContext} mascot`,
            imageBrief: 'A fun mascot generated from the Mascot Maker agent.',
            sectionText: siteContext,
          }),
        });
        const imageData = await readApiResponse(imageRes);
        if (!imageRes.ok) throw new Error(String(imageData.error || 'Mascot image generation failed.'));
        setFunAgentImageUrl(String(imageData.dataUrl || ''));
        setFunAgentOutput(textOutput);
        setAiImageGenerationCount((count) => count + 1);
      }
    } catch (error) {
      setFunAgentOutput(error instanceof Error ? error.message : 'Could not run that fun agent.');
    } finally {
      setIsRunningFunAgent(false);
    }
  };
  const handleBuildFromValidatedOffer = () => {
    if (!validation?.sharperOffer) return;
    setIdea(validation.sharperOffer);
    ideaRef.current = validation.sharperOffer;
    setShowChoiceBar(false);
    runBuilder('normal');
  };
  const handleBuildFromBusinessPlan = () => {
    if (!businessPlan) return;
    const planContext = `Business idea: ${ideaRef.current}

Validated offer: ${validation?.sharperOffer || businessPlan.offer}

Agent 2 launch plan:
Summary: ${businessPlan.summary}
Target customer: ${businessPlan.targetCustomer}
Offer: ${businessPlan.offer}
Pricing: ${businessPlan.pricing}
Earning estimate: ${businessPlan.earningEstimate.monthlyRevenueRange} revenue, ${businessPlan.earningEstimate.likelyTakeHomeRange} likely take-home. Confidence: ${businessPlan.earningEstimate.confidence}
Sales channels: ${businessPlan.salesChannels.join(', ')}
Website brief: ${businessPlan.websiteBrief}
First outreach message: ${businessPlan.firstOutreachMessage}`;

    setIdea(planContext);
    ideaRef.current = planContext;
    setShowChoiceBar(false);
    runBuilder('normal');
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Premium header / builder landing UI */}
      <BuilderBrandHeader />

      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Input area – much more beautiful */}
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="inline-flex items-center gap-x-2 bg-zinc-900 border border-zinc-700 text-emerald-400 text-sm font-medium px-6 py-3 rounded-3xl mb-6">
            Local business website builder
          </div>
          <h2 className="text-6xl font-bold tracking-tighter leading-none mb-4">
            Build a simple site you can<span className="text-emerald-400"> publish today</span>
          </h2>
          <p className="text-xl text-zinc-400 max-w-md mx-auto">
            Describe the business, generate the site, edit the basics, set owner payment instructions, and publish a live tester link.
          </p>
          <p className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-3 text-sm text-zinc-300">
            Keep it simple: business, location, main offer, style, and how customers should contact or pay. Extra rambling gets simplified into a clean first version.
          </p>

          <div className="mt-12">
            <textarea
              className="w-full h-48 bg-zinc-900 border border-zinc-700 focus:border-emerald-400 rounded-3xl p-8 text-lg placeholder-zinc-500 resize-none shadow-2xl shadow-black/50"
              placeholder="Example: Dog walking service in San Francisco. Friendly and trustworthy. Blue and white. Customers text to book."
              value={idea}
              onChange={(e) => {
                setIdea(e.target.value);
                setCleanBrief(null);
              }}
            />
          </div>

          {buildStatus && (
            <p className="mt-6 text-emerald-400 text-sm font-medium animate-pulse">{buildStatus}</p>
          )}

          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => {
                setShowChoiceBar(false);
                runBuilder('normal');
              }}
              disabled={loading || !idea.trim()}
              className="w-full sm:w-auto px-10 py-5 bg-white text-black text-xl font-semibold rounded-3xl hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-emerald-500/20 flex items-center justify-center gap-x-4 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full"></span>
                  Building…
                </>
              ) : (
                <>Build My Site →</>
              )}
            </button>
            <button
              type="button"
              onClick={loadSampleSite}
              disabled={loading}
              className="w-full sm:w-auto px-8 py-5 bg-zinc-900 text-white text-lg font-semibold rounded-3xl border border-zinc-700 hover:border-emerald-400 hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50"
            >
              Load Demo Site (No AI)
            </button>
          </div>

          {cleanBrief && (
            <div className="mt-6 rounded-3xl border border-emerald-900 bg-emerald-950/20 p-5 text-left">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Building from this simple brief</p>
              <p className="mt-2 text-lg font-semibold text-white">{cleanBrief.summary}</p>
              <div className="mt-4 grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
                <p><span className="text-zinc-500">Business:</span> {cleanBrief.businessType}</p>
                <p><span className="text-zinc-500">Location:</span> {cleanBrief.location}</p>
                <p><span className="text-zinc-500">Offer:</span> {cleanBrief.primaryOffer}</p>
                <p><span className="text-zinc-500">Style:</span> {cleanBrief.toneStyle}</p>
                <p className="md:col-span-2"><span className="text-zinc-500">Contact/payment:</span> {cleanBrief.paymentContact}</p>
              </div>
              {cleanBrief.ignoreForFirstVersion.length > 0 && (
                <p className="mt-3 text-xs text-zinc-500">
                  Ignored for the first version: {cleanBrief.ignoreForFirstVersion.join(', ')}
                </p>
              )}
            </div>
          )}

          {activeAddon === 'agents' && (
            <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
              <p className="text-sm text-zinc-400 mb-4">
                Optional: use Agent 1 and Agent 2 if you want help sharpening the offer before building.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <input
                  className="w-full sm:w-48 bg-black border border-zinc-700 focus:border-emerald-400 rounded-2xl px-4 py-3 text-sm placeholder-zinc-500 outline-none"
                  placeholder="ZIP, optional"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
                />
                <button
                  onClick={validateIdea}
                  disabled={validating || huntingIdeas || loading || !idea.trim()}
                  className="px-5 py-3 bg-zinc-950 border border-zinc-700 hover:border-emerald-400 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {validating ? 'Checking…' : 'Agent 1: Check Offer'}
                </button>
                <button
                  onClick={huntForIdeas}
                  disabled={huntingIdeas || validating || loading}
                  className="px-5 py-3 bg-amber-500 text-black hover:bg-amber-400 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {huntingIdeas ? 'Finding…' : validation ? 'Find A Stronger Offer' : 'Find Local Business Ideas'}
                </button>
              </div>
            </div>
          )}

          {activeAddon === 'agents' && huntingIdeas && (
            <p className="mt-4 text-sm text-amber-300 animate-pulse">
              Looking for stronger local business ideas and sharper offers…
            </p>
          )}

          {activeAddon === 'agents' && huntedIdeas.length > 0 && (
            <div className="mt-8 text-left bg-zinc-900 border border-amber-700/60 rounded-3xl p-6 shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <p className="text-amber-300 text-sm font-semibold uppercase tracking-wide">Idea Hunter Results</p>
                  <h3 className="text-2xl font-bold mt-1">
                    Best score found: {huntedIdeas[0]?.validation.score || 0}/10
                  </h3>
                  {validation && (
                    <p className="text-zinc-400 mt-2">
                      Your current idea scored {validation.score}/10. The hunter is trying to beat that, not just brainstorm.
                    </p>
                  )}
                </div>
                <button
                  onClick={huntForIdeas}
                  disabled={huntingIdeas || loading}
                  className="rounded-2xl bg-black border border-amber-700 px-5 py-3 text-sm font-semibold text-amber-200 hover:bg-zinc-950 disabled:opacity-50"
                >
                  Try Another Batch
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {huntedIdeas.map((candidate, index) => (
                  <div key={`${candidate.validation.score}-${index}`} className="rounded-2xl bg-black/50 border border-zinc-800 p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <p className="text-xs text-zinc-500 uppercase">Candidate {index + 1}</p>
                        <p className="text-white font-semibold mt-1">{candidate.idea}</p>
                        <p className="text-zinc-400 text-sm mt-2">{candidate.validation.verdict}</p>
                      </div>
                      <div className="shrink-0 rounded-2xl bg-zinc-950 border border-zinc-700 px-4 py-3 text-center">
                        <p className="text-xs text-zinc-500 uppercase">Score</p>
                        <p className="text-3xl font-bold text-amber-300">{candidate.validation.score}/10</p>
                      </div>
                    </div>

                    <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
                      <p className="text-zinc-300"><span className="text-zinc-500">Buyer:</span> {candidate.validation.buyer}</p>
                      <p className="text-zinc-300"><span className="text-zinc-500">First customer:</span> {candidate.validation.firstCustomer}</p>
                    </div>

                    <div className="mt-3 rounded-xl bg-emerald-950/30 border border-emerald-900 p-3">
                      <p className="text-xs font-semibold text-emerald-300 uppercase">Sharper offer</p>
                      <p className="text-sm text-white mt-1">{candidate.validation.sharperOffer}</p>
                    </div>

                    {candidate.validation.whyItMightFail.length > 0 && (
                      <div className="mt-3 rounded-xl bg-zinc-950 border border-zinc-800 p-3">
                        <p className="text-xs font-semibold text-zinc-500 uppercase">Red flags</p>
                        <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                          {candidate.validation.whyItMightFail.map((risk, riskIndex) => <li key={riskIndex}>• {risk}</li>)}
                        </ul>
                      </div>
                    )}

                    <button
                      onClick={() => handleUseHuntedIdea(candidate)}
                      disabled={loading}
                      className="mt-4 w-full rounded-2xl bg-amber-500 hover:bg-amber-400 text-black py-3 font-bold disabled:opacity-50"
                    >
                      Use This Idea
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeAddon === 'agents' && validation && (
            <div className="mt-8 text-left bg-zinc-900 border border-zinc-700 rounded-3xl p-6 shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <p className="text-emerald-400 text-sm font-semibold uppercase tracking-wide">Agent 1 Offer Check</p>
                  <h3 className="text-2xl font-bold mt-1">{validation.verdict}</h3>
                  <p className="text-zinc-400 mt-2">Likely buyer: {validation.buyer}</p>
                </div>
                <div className="shrink-0 rounded-2xl bg-black border border-zinc-700 px-5 py-4 text-center">
                  <p className="text-xs text-zinc-500 uppercase">Score</p>
                  <p className="text-4xl font-bold text-emerald-400">{validation.score}/10</p>
                </div>
              </div>

              <div className="mt-6 grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-black/50 border border-zinc-800 p-4">
                  <p className="font-semibold text-white mb-2">Why it might work</p>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    {validation.whyItMightWork.map((reason, index) => <li key={index}>• {reason}</li>)}
                  </ul>
                </div>
                <div className="rounded-2xl bg-black/50 border border-zinc-800 p-4">
                  <p className="font-semibold text-white mb-2">Red flags</p>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    {validation.whyItMightFail.map((risk, index) => <li key={index}>• {risk}</li>)}
                  </ul>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-emerald-950/30 border border-emerald-900 p-4">
                <p className="text-sm font-semibold text-emerald-300">Sharper offer</p>
                <p className="text-white mt-1">{validation.sharperOffer}</p>
              </div>

              <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm text-zinc-300">
                <p><span className="text-zinc-500">First customer:</span> {validation.firstCustomer}</p>
                <p><span className="text-zinc-500">Next move:</span> {validation.nextMove}</p>
              </div>

              <button
                onClick={handleBuildFromValidatedOffer}
                disabled={loading}
                className="mt-6 w-full bg-emerald-600 hover:bg-emerald-500 rounded-2xl py-4 font-bold text-white disabled:opacity-50"
              >
                {loading ? 'Building…' : 'Build Site From Improved Offer'}
              </button>
              <button
                onClick={createBusinessPlan}
                disabled={planning || loading}
                className="mt-3 w-full bg-purple-600 hover:bg-purple-500 rounded-2xl py-4 font-bold text-white disabled:opacity-50"
              >
                {planning ? 'Planning…' : 'Agent 2: Create Launch Plan'}
              </button>
            </div>
          )}

          {activeAddon === 'agents' && businessPlan && (
            <div className="mt-8 text-left bg-zinc-900 border border-purple-900/60 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-purple-300 text-sm font-semibold uppercase tracking-wide">Agent 2 Launch Plan</p>
                  <h3 className="text-2xl font-bold mt-1">{businessPlan.summary}</h3>
                </div>
              </div>

              <div className="mt-5 grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-black/50 border border-zinc-800 p-4">
                  <p className="text-sm font-semibold text-zinc-500">Offer</p>
                  <p className="text-white mt-1">{businessPlan.offer}</p>
                </div>
                <div className="rounded-2xl bg-black/50 border border-zinc-800 p-4">
                  <p className="text-sm font-semibold text-zinc-500">Target customer</p>
                  <p className="text-white mt-1">{businessPlan.targetCustomer}</p>
                </div>
                <div className="rounded-2xl bg-black/50 border border-zinc-800 p-4">
                  <p className="text-sm font-semibold text-zinc-500">Pricing</p>
                  <p className="text-white mt-1">{businessPlan.pricing}</p>
                </div>
                <div className="rounded-2xl bg-black/50 border border-zinc-800 p-4">
                  <p className="text-sm font-semibold text-zinc-500">First channels</p>
                  <p className="text-white mt-1">{businessPlan.salesChannels.join(' • ')}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-amber-950/30 border border-amber-900 p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-300">What could this make?</p>
                    <p className="text-white mt-1">{businessPlan.earningEstimate.monthlyRevenueRange}</p>
                    <p className="text-zinc-300 text-sm mt-1">Likely take-home: {businessPlan.earningEstimate.likelyTakeHomeRange}</p>
                  </div>
                  <div className="rounded-xl bg-black/50 border border-amber-900 px-4 py-2 text-sm text-amber-200">
                    Confidence: {businessPlan.earningEstimate.confidence}
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-3">
                  Rough estimate, not a promise. It should be validated with real local buyers.
                </p>
                {businessPlan.earningEstimate.assumptions.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-zinc-300">
                    {businessPlan.earningEstimate.assumptions.map((assumption, index) => <li key={index}>• {assumption}</li>)}
                  </ul>
                )}
              </div>

              <div className="mt-4 rounded-2xl bg-black/50 border border-zinc-800 p-4">
                <p className="font-semibold text-white mb-2">7-day launch plan</p>
                <ol className="space-y-2 text-sm text-zinc-300 list-decimal list-inside">
                  {businessPlan.sevenDayPlan.map((step, index) => <li key={index}>{step}</li>)}
                </ol>
              </div>

              <div className="mt-4 rounded-2xl bg-purple-950/30 border border-purple-900 p-4">
                <p className="text-sm font-semibold text-purple-300">Website brief for Agent 3</p>
                <p className="text-white mt-1">{businessPlan.websiteBrief}</p>
              </div>

              <div className="mt-4 rounded-2xl bg-emerald-950/30 border border-emerald-900 p-4">
                <p className="text-sm font-semibold text-emerald-300">First outreach message</p>
                <p className="text-white mt-1">“{businessPlan.firstOutreachMessage}”</p>
              </div>

              <button
                onClick={handleBuildFromBusinessPlan}
                disabled={loading}
                className="mt-6 w-full bg-emerald-600 hover:bg-emerald-500 rounded-2xl py-4 font-bold text-white disabled:opacity-50"
              >
                {loading ? 'Building…' : 'Agent 3: Build Site From Launch Plan'}
              </button>
            </div>
          )}
        </div>

        {loading && !agent3 && (
          <div className="mt-12 max-w-2xl mx-auto text-center border border-zinc-700 rounded-3xl p-12 bg-zinc-900/50">
            <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg text-zinc-300">Generating your website…</p>
            <p className="text-sm text-zinc-500 mt-2">This usually takes 30-90 seconds.</p>
          </div>
        )}

        {/* Preview + choice bar area */}
        {agent3 && (
          <div className="mt-8 border border-zinc-700 bg-white rounded-3xl overflow-hidden shadow-2xl">
            {/* Choice bar – exactly the copy you loved */}
            {showChoiceBar && (
              <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 border-b border-zinc-700 px-8 py-6 flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-x-3 text-emerald-400">
                    <span className="text-xs font-bold uppercase tracking-[0.2em]">Site draft</span>
                  </div>
                  <p className="text-white text-2xl font-semibold mt-1">
                    Your site is ready to review.
                  </p>
                  <p className="text-zinc-400 mt-1">Edit the copy, replace photos, set owner payment info, then publish when it looks ready.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                  <button
                    onClick={() => setShowChoiceBar(false)}
                    className="px-10 py-5 bg-zinc-800 hover:bg-zinc-700 rounded-3xl font-semibold text-lg transition-all active:scale-95"
                  >
                    Keep Current Site
                  </button>
                  <button
                    onClick={handleMakeOnePageSite}
                    disabled={loading}
                    className="px-10 py-5 bg-emerald-600 hover:bg-emerald-500 rounded-3xl font-semibold text-lg transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loading ? 'Converting…' : 'Make One-Page Site'}
                  </button>
                  <button
                    onClick={handleExpandToMultiPage}
                    disabled={loading}
                    className="px-10 py-5 bg-white text-black hover:bg-emerald-100 rounded-3xl font-semibold text-lg flex items-center gap-x-3 transition-all active:scale-95 shadow-xl"
                  >
                    {loading ? 'Expanding…' : 'Bigger Website With Placeholders →'}
                  </button>
                </div>
              </div>
            )}

            {SHOW_EXPERIMENTAL_TOOLS && activeAddon === 'debug' && (
              <div className="bg-zinc-950 border-b border-zinc-800 px-6 py-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-400">
                Need help debugging the generated site? Download or copy the exact HTML.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={copySiteHtml}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold"
                >
                  Copy HTML
                </button>
                <button
                  onClick={downloadSiteHtml}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
                >
                  Download HTML
                </button>
              </div>
              </div>
            )}
            {activeAddon === 'memory' && (
              <div className="bg-gradient-to-br from-zinc-950 via-black to-emerald-950/30 border-b border-emerald-900/60 px-4 py-5 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Business memory</p>
                    <h3 className="mt-2 text-2xl font-bold text-white">Remember the basics so agents stop starting from scratch.</h3>
                    <p className="mt-2 max-w-2xl text-sm text-zinc-300">
                      This saves in your browser for now. Later this becomes the private business profile behind the owner link.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const memory = formatBusinessMemoryContext(businessMemory);
                      if (!memory) {
                        showToast('Memory is empty', 'Add some business memory first.', 'info');
                        return;
                      }
                      setIdea(memory);
                      ideaRef.current = memory;
                    }}
                    className="rounded-2xl border border-emerald-700 bg-emerald-950/30 px-4 py-3 text-sm font-bold text-emerald-100 hover:border-emerald-400"
                  >
                    Use memory as prompt
                  </button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <input className="rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500 outline-none focus:border-emerald-400" placeholder="Business name" value={businessMemory.businessName} onChange={(e) => updateBusinessMemory('businessName', e.target.value)} />
                  <input className="rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500 outline-none focus:border-emerald-400" placeholder="Owner name" value={businessMemory.ownerName} onChange={(e) => updateBusinessMemory('ownerName', e.target.value)} />
                  <input className="rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500 outline-none focus:border-emerald-400" placeholder="Phone" value={businessMemory.phone} onChange={(e) => updateBusinessMemory('phone', e.target.value)} />
                  <input className="rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500 outline-none focus:border-emerald-400" placeholder="Email" value={businessMemory.email} onChange={(e) => updateBusinessMemory('email', e.target.value)} />
                  <input className="rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500 outline-none focus:border-emerald-400" placeholder="Service area / ZIPs, example: Provo, Orem, 84604" value={businessMemory.serviceArea} onChange={(e) => updateBusinessMemory('serviceArea', e.target.value)} />
                  <input className="rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500 outline-none focus:border-emerald-400" placeholder="Payment info, example: Venmo phone or Stripe/PayPal link" value={businessMemory.paymentInfo} onChange={(e) => updateBusinessMemory('paymentInfo', e.target.value)} />
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <textarea className="h-28 rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500 outline-none focus:border-emerald-400" placeholder="Services/products offered" value={businessMemory.services} onChange={(e) => updateBusinessMemory('services', e.target.value)} />
                  <textarea className="h-28 rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500 outline-none focus:border-emerald-400" placeholder="Pricing notes, example: $45 weekly mow, $149 full detail, $25 trip charge" value={businessMemory.pricingNotes} onChange={(e) => updateBusinessMemory('pricingNotes', e.target.value)} />
                  <textarea className="h-28 rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500 outline-none focus:border-emerald-400" placeholder="Website theme/style, example: premium black/gold, friendly neighborhood, clean green/white" value={businessMemory.themeStyle} onChange={(e) => updateBusinessMemory('themeStyle', e.target.value)} />
                  <textarea className="h-28 rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500 outline-none focus:border-emerald-400" placeholder="Tone and notes, example: simple, no hype, contractor humor, wants residential customers" value={`${businessMemory.tone}${businessMemory.tone && businessMemory.notes ? '\n\n' : ''}${businessMemory.notes}`} onChange={(e) => {
                    const value = e.target.value;
                    updateBusinessMemory('tone', value);
                    updateBusinessMemory('notes', '');
                  }} />
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-zinc-800 bg-black/50 p-4">
                  <p className="text-sm text-zinc-400">
                    Saved automatically on this browser. Agents now use this memory for website generation, pricing, images, and fun tools.
                  </p>
                  <button
                    type="button"
                    onClick={() => setBusinessMemory(EMPTY_BUSINESS_MEMORY)}
                    className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300 hover:border-red-400 hover:text-white"
                  >
                    Clear memory
                  </button>
                </div>
              </div>
            )}
            {SHOW_EXPERIMENTAL_TOOLS && activeAddon === 'levelup' && (
              <LevelUpPanel
                features={LEVEL_UP_FEATURES}
                activeAddon={activeAddon}
                onSelectAddon={setActiveAddon}
              />
            )}
            {SHOW_EXPERIMENTAL_TOOLS && activeAddon === 'fun' && (
              <div className="bg-gradient-to-br from-purple-950 via-black to-zinc-950 border-b border-purple-900/60 px-4 py-5 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-300">Fun agents</p>
                    <h3 className="mt-2 text-2xl font-bold text-white">Tiny weirdos for when the serious stuff gets boring.</h3>
                    <p className="mt-2 max-w-2xl text-sm text-zinc-300">
                      Ranked fun first, interesting second, useful third. These are side quests, not the core MVP.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScreenPetVisible((visible) => !visible)}
                    className="rounded-2xl border border-purple-500/60 bg-purple-500/15 px-5 py-3 text-sm font-bold text-purple-100 hover:bg-purple-500/25"
                  >
                    {screenPetVisible ? 'Send Sheep Home' : 'Release Screen Sheep'}
                  </button>
                </div>

                <div className="mt-5 rounded-3xl border border-fuchsia-700 bg-fuchsia-950/25 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-fuchsia-300">AI avatar</p>
                      <p className="mt-1 text-2xl font-black text-white">Avatar Studio</p>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
                        Make a good-looking cartoon/game-style character for the shop. Think barista, painter, slime seller, baker, landscaper, or whatever weird business they invent.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-fuchsia-800 bg-black/50 px-4 py-3 text-xs font-bold text-fuchsia-100">
                      Uses 1 image credit
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-zinc-300">Person style</span>
                        <select
                          className="w-full rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white outline-none focus:border-fuchsia-400"
                          value={avatarGender}
                          onChange={(e) => setAvatarGender(e.target.value)}
                        >
                          {AVATAR_GENDERS.map((gender) => (
                            <option key={gender} value={gender}>{gender}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-zinc-300">Business role</span>
                        <select
                          className="w-full rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white outline-none focus:border-fuchsia-400"
                          value={avatarTrade}
                          onChange={(e) => setAvatarTrade(e.target.value)}
                        >
                          {AVATAR_TRADES.map((trade) => (
                            <option key={trade} value={trade}>{trade}</option>
                          ))}
                        </select>
                        {avatarTrade === 'Auto from site' && (
                          <span className="block text-xs font-semibold text-fuchsia-300">
                            Detected: {currentAvatarTrade()}
                          </span>
                        )}
                      </label>
                      {avatarTrade === 'Custom' && (
                        <label className="block space-y-2">
                          <span className="text-sm font-semibold text-zinc-300">Custom role</span>
                          <input
                            className="w-full rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-fuchsia-400"
                            placeholder="Example: Slime delivery founder"
                            value={customAvatarTrade}
                            onChange={(e) => setCustomAvatarTrade(e.target.value)}
                          />
                        </label>
                      )}
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-zinc-300">Art style</span>
                        <select
                          className="w-full rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white outline-none focus:border-fuchsia-400"
                          value={avatarStyle}
                          onChange={(e) => setAvatarStyle(e.target.value)}
                        >
                          {AVATAR_STYLES.map((style) => (
                            <option key={style} value={style}>{style}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-zinc-300">Vibe</span>
                        <select
                          className="w-full rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white outline-none focus:border-fuchsia-400"
                          value={avatarMood}
                          onChange={(e) => setAvatarMood(e.target.value)}
                        >
                          {AVATAR_MOODS.map((mood) => (
                            <option key={mood} value={mood}>{mood}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-zinc-300">Pose</span>
                        <select
                          className="w-full rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white outline-none focus:border-fuchsia-400"
                          value={avatarPose}
                          onChange={(e) => setAvatarPose(e.target.value)}
                        >
                          {AVATAR_POSES.map((pose) => (
                            <option key={pose} value={pose}>{pose}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-zinc-300">Hair color</span>
                        <select
                          className="w-full rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white outline-none focus:border-fuchsia-400"
                          value={avatarHairColor}
                          onChange={(e) => setAvatarHairColor(e.target.value)}
                        >
                          {AVATAR_HAIR_COLORS.map((color) => (
                            <option key={color} value={color}>{color}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-zinc-300">Eye color</span>
                        <select
                          className="w-full rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white outline-none focus:border-fuchsia-400"
                          value={avatarEyeColor}
                          onChange={(e) => setAvatarEyeColor(e.target.value)}
                        >
                          {AVATAR_EYE_COLORS.map((color) => (
                            <option key={color} value={color}>{color}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-zinc-300">Face details</span>
                        <select
                          className="w-full rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white outline-none focus:border-fuchsia-400"
                          value={avatarFaceFeatures}
                          onChange={(e) => setAvatarFaceFeatures(e.target.value)}
                        >
                          {AVATAR_FACE_FEATURES.map((feature) => (
                            <option key={feature} value={feature}>{feature}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-zinc-300">Outfit or changes</span>
                        <textarea
                          className="h-24 w-full rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-fuchsia-400"
                          placeholder="Example: black coffee apron, white sneakers, warm smile, holding an iced latte"
                          value={avatarOutfit}
                          onChange={(e) => setAvatarOutfit(e.target.value)}
                        />
                      </label>
                      <div className="flex flex-col gap-3 sm:flex-row md:col-span-2">
                        <button
                          type="button"
                          onClick={() => openConfirm({
                            title: 'Use 1 image credit?',
                            message: 'Avatar Studio calls AI image generation. Dropdown changes are free, but generating the final avatar uses one image credit.',
                            confirmLabel: 'Generate Avatar',
                            tone: 'cost',
                            onConfirm: generateAvatar,
                          })}
                          disabled={isGeneratingAvatar || aiImageGenerationCount >= AI_IMAGE_GENERATION_LIMIT}
                          className="flex-1 rounded-2xl bg-fuchsia-500 px-5 py-3 text-sm font-bold text-white hover:bg-fuchsia-400 disabled:opacity-50"
                        >
                          {isGeneratingAvatar ? 'Generating...' : aiImageGenerationCount >= AI_IMAGE_GENERATION_LIMIT ? 'Image Limit Hit' : 'Generate Avatar'}
                        </button>
                        <button
                          type="button"
                          onClick={addAvatarToSite}
                          disabled={!avatarImageUrl}
                          className="flex-1 rounded-2xl border border-fuchsia-700 bg-black px-5 py-3 text-sm font-bold text-fuchsia-100 hover:border-fuchsia-400 disabled:opacity-50"
                        >
                          Add To Website
                        </button>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-fuchsia-800 bg-black/70 p-4">
                      {avatarImageUrl ? (
                        <Image
                          src={avatarImageUrl}
                          alt="Generated avatar"
                          width={768}
                          height={768}
                          unoptimized
                          className="aspect-square w-full rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-dashed border-fuchsia-800 bg-fuchsia-950/20 p-6 text-center text-sm text-zinc-400">
                          Generate an avatar and it will show up here.
                        </div>
                      )}
                      <p className="mt-3 text-center text-sm font-bold text-white">
                        {currentAvatarTrade()} • {avatarStyle}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-3xl border border-fuchsia-800 bg-black/50 p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">Sprite roadmap</p>
                        <p className="mt-1 text-lg font-bold text-white">Next: instant, reusable avatar parts</p>
                      </div>
                      <span className="w-fit rounded-full bg-fuchsia-500/20 px-3 py-1 text-xs font-bold text-fuchsia-100">
                        Cost control
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {SPRITE_AVATAR_ROADMAP.map((item) => (
                        <div key={item.title} className="rounded-2xl border border-fuchsia-900 bg-zinc-950/70 p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-fuchsia-300">Phase {item.phase}</p>
                          <p className="mt-2 font-bold text-white">{item.title}</p>
                          <p className="mt-2 text-sm leading-6 text-zinc-300">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                    <VectorAvatarBuilder
                      defaultRole={currentAvatarTrade()}
                      onAddToSite={addVectorAvatarToSite}
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  <div className="rounded-3xl border border-fuchsia-900 bg-black/50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">Character</p>
                    <p className="mt-1 text-sm text-zinc-400">Make the shop feel like it has a face.</p>
                    <div className="mt-4 grid gap-3">
                      {FUN_AGENT_CARDS.filter((agent) => agent.name === 'Mascot Maker').map((agent) => (
                        <button
                          key={agent.name}
                          type="button"
                          onClick={() => runFunAgent(agent)}
                          disabled={isRunningFunAgent}
                          className="rounded-2xl border border-fuchsia-800 bg-fuchsia-950/20 p-4 text-left transition hover:border-fuchsia-400 disabled:opacity-60"
                        >
                          <p className="text-xs font-bold uppercase tracking-wide text-fuchsia-300">AI image</p>
                          <p className="mt-1 text-lg font-bold text-white">{agent.name}</p>
                          <p className="mt-3 text-sm text-zinc-300">{agent.tagline}</p>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setScreenPetVisible((visible) => !visible)}
                        className="rounded-2xl border border-purple-800 bg-purple-950/25 p-4 text-left transition hover:border-purple-400"
                      >
                        <p className="text-xs font-bold uppercase tracking-wide text-purple-300">Pet</p>
                        <p className="mt-1 text-lg font-bold text-white">{screenPetVisible ? 'Send Sheep Home' : 'Release Screen Sheep'}</p>
                        <p className="mt-3 text-sm text-zinc-300">A weird little shop pet that climbs around the screen.</p>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-indigo-900 bg-black/50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">Share</p>
                    <p className="mt-1 text-sm text-zinc-400">Make something easy to send around.</p>
                    <div className="mt-4 grid gap-3">
                      {FUN_AGENT_CARDS.filter((agent) => agent.name === 'Neighbor Pitch').map((agent) => (
                        <button
                          key={agent.name}
                          type="button"
                          onClick={() => runFunAgent(agent)}
                          disabled={isRunningFunAgent}
                          className="rounded-2xl border border-indigo-800 bg-indigo-950/20 p-4 text-left transition hover:border-indigo-400 disabled:opacity-60"
                        >
                          <p className="text-xs font-bold uppercase tracking-wide text-indigo-300">Text idea</p>
                          <p className="mt-1 text-lg font-bold text-white">{agent.name}</p>
                          <p className="mt-3 text-sm text-zinc-300">{agent.tagline}</p>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={showFollowShops}
                        className="rounded-2xl border border-indigo-800 bg-indigo-950/25 p-4 text-left transition hover:border-indigo-300"
                      >
                        <p className="text-xs font-bold uppercase tracking-wide text-indigo-300">Prototype</p>
                        <p className="mt-1 text-lg font-bold text-white">Follow Shops</p>
                        <p className="mt-3 text-sm text-zinc-300">Follow public shops for drops without open messaging.</p>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-rose-900 bg-black/50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-300">Silly</p>
                    <p className="mt-1 text-sm text-zinc-400">Dumb enough to remember, useful enough to keep.</p>
                    <div className="mt-4 grid gap-3">
                      {FUN_AGENT_CARDS.filter((agent) => agent.name !== 'Mascot Maker' && agent.name !== 'Neighbor Pitch').map((agent) => (
                        <button
                          key={agent.name}
                          type="button"
                          onClick={() => runFunAgent(agent)}
                          disabled={isRunningFunAgent}
                          className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-left transition hover:border-rose-400 disabled:opacity-60"
                        >
                          <p className="text-xs font-bold uppercase tracking-wide text-rose-300">{agent.name === 'Fortune Cookie' ? 'Image' : 'Fun'}</p>
                          <p className="mt-1 text-lg font-bold text-white">{agent.name}</p>
                          <p className="mt-3 text-sm text-zinc-300">{agent.tagline}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-cyan-900 bg-black/50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Shop Stuff</p>
                  <p className="mt-1 text-sm text-zinc-400">Collect, price, decorate, and drop offers.</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <button
                    type="button"
                    onClick={showCollectionLocker}
                    className="rounded-2xl border border-cyan-800 bg-cyan-950/25 p-4 text-left transition hover:border-cyan-300 hover:bg-cyan-950/40"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-cyan-300">Prototype</p>
                    <p className="mt-1 text-lg font-bold text-white">Collection Locker</p>
                    <p className="mt-3 text-sm text-zinc-300">Collect shop items, avatar parts, pets, badges, and decorations.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveAddon('expand')}
                    className="rounded-2xl border border-emerald-800 bg-emerald-950/25 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-950/40"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">No AI</p>
                    <p className="mt-1 text-lg font-bold text-white">Shop Pages</p>
                    <p className="mt-3 text-sm text-zinc-300">Add a menu, gallery, FAQ, service area, or custom page-style section.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFunAgentName('Pricing Agent');
                      setPricingRequest((current) => current || ideaRef.current);
                    }}
                    className="rounded-2xl border border-sky-900 bg-sky-950/20 p-4 text-left transition hover:border-sky-400"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-sky-300">Tool</p>
                    <p className="mt-1 text-lg font-bold text-white">Pricing Agent</p>
                    <p className="mt-3 text-sm text-zinc-300">Enter ZIP and service to get starter pricing.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCouponModalOpen(true)}
                    className="rounded-2xl border border-yellow-700 bg-yellow-950/25 p-4 text-left transition hover:border-yellow-300 hover:bg-yellow-950/40"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-yellow-300">No AI</p>
                    <p className="mt-1 text-lg font-bold text-white">Coupon Agent</p>
                    <p className="mt-3 text-sm text-zinc-300">Type a discount and add a good-looking coupon section to the website.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => showCustomerList('good')}
                    className="rounded-2xl border border-emerald-800 bg-emerald-950/30 p-4 text-left transition hover:border-emerald-400 hover:bg-emerald-950/50"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">No AI</p>
                    <p className="mt-1 text-lg font-bold text-white">A Customer List</p>
                    <p className="mt-3 text-sm text-zinc-300">Who gets instant care, normal scheduling, filler slots, or never again.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => showCustomerList('bad')}
                    className="rounded-2xl border border-rose-900 bg-rose-950/25 p-4 text-left transition hover:border-rose-400 hover:bg-rose-950/40"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-rose-300">No AI</p>
                    <p className="mt-1 text-lg font-bold text-white">Pet Peeve List</p>
                    <p className="mt-3 text-sm text-zinc-300">The funny little “never again” patterns contractors remember forever.</p>
                  </button>
                  </div>
                  {activeFunAgentName === 'Pricing Agent' && (
                    <div className="mt-4 rounded-2xl border border-sky-900 bg-sky-950/20 p-4">
                      <p className="text-sm font-bold text-sky-300">Price a product or service</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_140px_auto]">
                        <input
                          className="rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-sky-400"
                          placeholder="Example: slime jar, weekly lawn mowing, full car detail"
                          value={pricingRequest}
                          onChange={(e) => setPricingRequest(e.target.value)}
                        />
                        <input
                          className="rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-sky-400"
                          placeholder="ZIP"
                          inputMode="numeric"
                          value={pricingZipCode}
                          onChange={(e) => setPricingZipCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
                        />
                        <button
                          type="button"
                          onClick={runPricingAgent}
                          disabled={pricing || !((pricingRequest || idea).trim()) || !(pricingZipCode.trim())}
                          className="rounded-xl bg-sky-500 px-4 py-3 text-sm font-bold text-white hover:bg-sky-400 disabled:opacity-50"
                        >
                          {pricing ? 'Pricing...' : 'Get Price'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {(activeFunAgentName || isRunningFunAgent) && (
                  <div className="mt-5 rounded-2xl border border-purple-900 bg-black/70 p-5">
                    <p className="text-sm font-semibold text-purple-300">
                      {isRunningFunAgent ? `${activeFunAgentName} is thinking...` : activeFunAgentName}
                    </p>
                    {funConceptPanel === 'collection' && (
                      <div className="mt-4 rounded-2xl border border-cyan-900 bg-cyan-950/20 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xl font-bold text-white">Starter Collection</p>
                            <p className="mt-2 text-sm leading-6 text-zinc-300">
                              Basic version: collect items that make the shop, avatar, offers, and pets feel more personal. Later these can unlock from missions, publishing, drops, or paid packs.
                            </p>
                          </div>
                          <span className="w-fit rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-100">
                            Closet idea
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {COLLECTION_STARTER_ITEMS.map((item) => (
                            <div key={item.name} className="rounded-2xl border border-cyan-900/70 bg-black/60 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-bold text-white">{item.name}</p>
                                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-cyan-300">{item.kind}</p>
                                </div>
                                <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-200">{item.rarity}</span>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-zinc-300">{item.use}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {funConceptPanel === 'follow' && (
                      <div className="mt-4 rounded-2xl border border-indigo-900 bg-indigo-950/20 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xl font-bold text-white">Follow Shops</p>
                            <p className="mt-2 text-sm leading-6 text-zinc-300">
                              Basic version: a future public/link-only setting where people follow shops for drops and updates. No open chat yet, so it stays safer and easier.
                            </p>
                          </div>
                          <span className="w-fit rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-100">
                            Social seed
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {FOLLOW_SHOP_IDEAS.map((item) => (
                            <div key={item.name} className="rounded-2xl border border-indigo-900/70 bg-black/60 p-4">
                              <p className="font-bold text-white">{item.name}</p>
                              <p className="mt-2 text-sm leading-6 text-zinc-300">{item.use}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {funCustomerListKind && (
                      <div className="mt-4">
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-xl font-bold text-white">{CUSTOMER_LISTS[funCustomerListKind].title}</p>
                              <p className="mt-2 text-sm leading-6 text-zinc-300">{CUSTOMER_LISTS[funCustomerListKind].intro}</p>
                            </div>
                            <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                              funCustomerListKind === 'good'
                                ? 'bg-emerald-500/20 text-emerald-200'
                                : 'bg-rose-500/20 text-rose-200'
                            }`}>
                              {CUSTOMER_LISTS[funCustomerListKind].badge}
                            </span>
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {CUSTOMER_LISTS[funCustomerListKind].items.map((item) => (
                              <div key={item.name} className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
                                <p className="font-bold text-white">{item.name}</p>
                                <p className="mt-2 text-sm text-zinc-300">{item.sign}</p>
                                <p className="mt-3 rounded-xl bg-zinc-900 p-3 text-sm text-zinc-200">
                                  <span className="font-bold text-purple-300">Move:</span> {item.move}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {pricingEstimate && (
                      <div className="mt-4 rounded-2xl border border-sky-900 bg-sky-950/20 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xl font-bold text-white">Pricing Agent</p>
                            <p className="mt-2 text-sm leading-6 text-zinc-300">{pricingEstimate.summary}</p>
                          </div>
                          <div className="rounded-2xl bg-sky-500/20 px-4 py-3 text-sm font-bold text-sky-100">
                            {pricingEstimate.recommendedPrice}
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          {pricingEstimate.priceTiers.map((tier) => (
                            <div key={tier.name} className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
                              <p className="text-sm font-bold text-sky-300">{tier.name}</p>
                              <p className="mt-1 text-xl font-black text-white">{tier.price}</p>
                              <p className="mt-2 text-sm text-zinc-300">{tier.includes}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
                            <p className="font-bold text-white">Local factors</p>
                            <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                              {pricingEstimate.localFactors.map((factor) => <li key={factor}>• {factor}</li>)}
                            </ul>
                          </div>
                          <div className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
                            <p className="font-bold text-white">Assumptions</p>
                            <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                              {pricingEstimate.assumptions.map((assumption) => <li key={assumption}>• {assumption}</li>)}
                            </ul>
                            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-sky-300">
                              Confidence: {pricingEstimate.confidence}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {funAgentPerson && (
                      <div className="mt-4 flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                        <div
                          aria-label={`${funAgentPerson.name}, ${funAgentPerson.role}`}
                          role="img"
                          className="h-16 w-16 shrink-0 rounded-full bg-cover bg-center ring-2 ring-purple-400/50"
                          style={{ backgroundImage: `url(${funAgentPerson.imageUrl})` }}
                        />
                        <div>
                          <p className="text-base font-bold text-white">{funAgentPerson.name}</p>
                          <p className="text-sm text-zinc-400">{funAgentPerson.role}</p>
                        </div>
                      </div>
                    )}
                    {false && activeFunAgentName === 'Fortune Cookie' && (
                      <div className="mt-4 flex justify-center rounded-2xl border border-amber-900 bg-gradient-to-br from-amber-950/40 to-black p-4">
                        <div className="ope-fortune-photo">
                          <svg className="ope-fortune-photo-art" viewBox="0 0 720 420" role="img" aria-label="Original fortune cookie illustration">
                            <defs>
                              <linearGradient id="fortuneBackdrop" x1="88" y1="0" x2="690" y2="410" gradientUnits="userSpaceOnUse">
                                <stop offset="0" stopColor="#4b3528" />
                                <stop offset="0.48" stopColor="#251811" />
                                <stop offset="1" stopColor="#0f0a07" />
                              </linearGradient>
                              <linearGradient id="fortunePlate" x1="95" y1="116" x2="640" y2="374" gradientUnits="userSpaceOnUse">
                                <stop offset="0" stopColor="#fffaf0" />
                                <stop offset="0.48" stopColor="#f3ead9" />
                                <stop offset="1" stopColor="#d8c7aa" />
                              </linearGradient>
                              <linearGradient id="fortuneCookieGold" x1="190" y1="82" x2="528" y2="304" gradientUnits="userSpaceOnUse">
                                <stop offset="0" stopColor="#fbe2a0" />
                                <stop offset="0.42" stopColor="#d99432" />
                                <stop offset="0.78" stopColor="#a95f1c" />
                                <stop offset="1" stopColor="#704012" />
                              </linearGradient>
                              <filter id="softCookieShadow" x="-20%" y="-20%" width="140%" height="150%">
                                <feDropShadow dx="0" dy="18" stdDeviation="14" floodColor="#000000" floodOpacity="0.35" />
                              </filter>
                            </defs>
                            <rect width="720" height="420" rx="28" fill="url(#fortuneBackdrop)" />
                            <ellipse cx="360" cy="272" rx="292" ry="106" fill="url(#fortunePlate)" />
                            <ellipse cx="360" cy="272" rx="245" ry="76" fill="none" stroke="#cab89c" strokeWidth="5" opacity="0.55" />
                            <g filter="url(#softCookieShadow)">
                              <path d="M106 234 C126 152 190 122 255 148 C223 188 217 226 241 276 C181 306 129 289 106 234 Z" fill="url(#fortuneCookieGold)" />
                              <path d="M137 224 C156 174 194 153 234 163" fill="none" stroke="#ffe7ad" strokeWidth="16" strokeLinecap="round" opacity="0.55" />
                              <path d="M476 114 C552 92 606 132 621 204 C565 229 514 226 470 190 C493 162 496 139 476 114 Z" fill="url(#fortuneCookieGold)" />
                              <path d="M510 137 C548 128 581 151 596 190" fill="none" stroke="#ffe7ad" strokeWidth="14" strokeLinecap="round" opacity="0.5" />
                              <path d="M244 276 C255 210 310 176 368 188 C330 224 322 270 348 326 C298 335 261 318 244 276 Z" fill="url(#fortuneCookieGold)" />
                              <path d="M362 190 C432 170 497 202 522 276 C477 319 407 330 348 326 C380 280 382 233 362 190 Z" fill="url(#fortuneCookieGold)" />
                              <path d="M284 268 C300 223 329 204 363 205" fill="none" stroke="#ffe7ad" strokeWidth="13" strokeLinecap="round" opacity="0.5" />
                              <path d="M410 210 C455 210 489 236 505 270" fill="none" stroke="#ffe7ad" strokeWidth="12" strokeLinecap="round" opacity="0.45" />
                              <path d="M351 196 C342 230 344 270 361 320" fill="none" stroke="#7c3f10" strokeWidth="5" strokeLinecap="round" opacity="0.55" />
                            </g>
                            <g opacity="0.38">
                              <circle cx="297" cy="244" r="3" fill="#7c3f10" />
                              <circle cx="323" cy="222" r="2.5" fill="#7c3f10" />
                              <circle cx="448" cy="252" r="3" fill="#7c3f10" />
                              <circle cx="481" cy="274" r="2.5" fill="#7c3f10" />
                              <circle cx="181" cy="211" r="2.5" fill="#7c3f10" />
                              <circle cx="554" cy="166" r="2.5" fill="#7c3f10" />
                            </g>
                          </svg>
                          <div className="ope-fortune-photo-slip">
                            {isRunningFunAgent ? 'cracking open...' : funAgentOutput || 'your fortune is loading...'}
                          </div>
                        </div>
                      </div>
                    )}
                    {funAgentImageUrl && (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-purple-900 bg-zinc-950">
                        <Image
                          src={funAgentImageUrl}
                          alt="Generated business mascot"
                          width={768}
                          height={768}
                          unoptimized
                          className="max-h-[420px] w-full object-contain"
                        />
                      </div>
                    )}
                    {!funCustomerListKind && !funConceptPanel && (
                      <p className="mt-3 whitespace-pre-line text-base leading-7 text-zinc-100">
                        {isRunningFunAgent ? 'Cooking up something dumb in the best way.' : funAgentOutput}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            {(activeAddon === 'edit' || activeAddon === 'expand') && (
            <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-5">
              {activeAddon === 'edit' && (
              <>
              <p className="text-sm font-semibold text-white mb-3">
                Want a global change? Tell the builder how to rewrite the whole site.
              </p>
              <div className="flex flex-col lg:flex-row gap-3">
                <textarea
                  className="min-h-20 flex-1 rounded-2xl bg-black border border-zinc-700 p-4 text-white placeholder-zinc-500 resize-none focus:border-emerald-400 outline-none"
                  placeholder='Example: "make the background white", "make it two pages", "use lots of coffee images", "make it more luxury"'
                  value={siteFeedback}
                  onChange={(e) => setSiteFeedback(e.target.value)}
                />
                <button
                  onClick={handleRewriteSite}
                  disabled={loading || !siteFeedback.trim() || aiSiteRewriteCount >= AI_SITE_REWRITE_LIMIT}
                  className="lg:w-48 rounded-2xl bg-purple-600 hover:bg-purple-500 px-6 py-4 font-bold text-white disabled:opacity-50"
                >
                  {loading ? 'Rewriting…' : aiSiteRewriteCount >= AI_SITE_REWRITE_LIMIT ? 'Rewrite Limit Hit' : 'Rewrite Site'}
                </button>
              </div>
              <div className="mt-5">
                {invoiceLinksPanel}
              </div>
              </>
              )}
              {activeAddon === 'expand' && (
              <div className="mt-5 rounded-2xl border border-zinc-800 bg-black/40 p-4">
                {SHOW_BIGGER_WEBSITE_OPTION && (
                <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Want a bigger website?</p>
                    <p className="mt-1 text-sm text-zinc-400">Build a fuller industry-style site with editable placeholders instead of lots of generated images.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExpandToMultiPage}
                    disabled={loading}
                    className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {loading ? 'Expanding…' : 'Bigger Website With Placeholders'}
                  </button>
                </div>
                )}
                <p className="text-sm font-semibold text-white">Need one more page-style section?</p>
                <p className="mt-1 text-sm text-zinc-400">
                  Add a standalone-feeling menu, gallery, reviews, contact, FAQ, or custom page inside this site. It adds a clean More pages link row and does not spend AI credits.
                </p>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <select
                    className="flex-1 rounded-2xl bg-black border border-zinc-700 p-4 text-white outline-none focus:border-emerald-400"
                    value={pageSectionToAdd}
                    onChange={(e) => setPageSectionToAdd(e.target.value)}
                  >
                    {PAGE_SECTION_OPTIONS.map((section) => (
                      <option key={section} value={section}>{section}</option>
                    ))}
                  </select>
                  {pageSectionToAdd === 'Custom' && (
                    <input
                      className="flex-1 rounded-2xl bg-black border border-zinc-700 p-4 text-white placeholder-zinc-500 outline-none focus:border-emerald-400"
                      placeholder="Custom page name, example: Catering, Financing, Before / After"
                      value={customPageSectionName}
                      onChange={(e) => setCustomPageSectionName(e.target.value)}
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleAddPageSection}
                    disabled={loading}
                    className="sm:w-56 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-6 py-4 font-bold text-white disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : 'Add Page'}
                  </button>
                </div>
              </div>
              )}
            </div>
            )}

            {activeAddon === 'invoice' && (
            <div className="bg-black border-b border-zinc-800 px-6 py-5">
              {invoiceLinksPanel}
            </div>
            )}

            {activeAddon === 'launch' && (
            <div className="bg-black border-b border-zinc-800 px-6 py-5 space-y-4">
              {!publishedUrl ? (
                <>
                  <div>
                    <p className="text-sm font-semibold text-white">Ready to publish?</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Create a live link you can share today. Payment setup and custom domain are optional — you can do those before or after publish.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <p className="text-sm font-semibold text-white">Launch review</p>
                    <p className="mt-1 text-xs text-zinc-500">Optional quick checks. Nothing here is required to publish.</p>
                    <div className="mt-3 grid md:grid-cols-2 gap-2 text-xs text-zinc-300">
                      <p className="rounded-xl bg-black/60 border border-zinc-800 p-3"><span className="font-bold text-white">Site:</span> read the preview and fix obvious text or photo issues.</p>
                      <p className="rounded-xl bg-black/60 border border-zinc-800 p-3"><span className="font-bold text-white">Payment:</span> optional — set Venmo, Stripe, or PayPal on the site payment button in Edit mode.</p>
                      <p className="rounded-xl bg-black/60 border border-zinc-800 p-3"><span className="font-bold text-white">Publish:</span> create the live link below.</p>
                      <p className="rounded-xl bg-black/60 border border-zinc-800 p-3"><span className="font-bold text-white">Later:</span> custom domain is available after publish.</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-emerald-300">Payment review (optional)</p>
                        <p className="mt-2 text-sm text-zinc-300">
                          Pick one owner payment path in Edit mode: Venmo (default), Stripe Payment Link, or PayPal checkout link.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(paymentSetupScript, 'Payment request copied', 'Send this to the owner to collect payment info.')}
                        className="rounded-xl border border-emerald-700 bg-black px-4 py-3 text-sm font-bold text-emerald-100 hover:border-emerald-400"
                      >
                        Copy Payment Ask
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col lg:flex-row gap-3">
                    <div className="flex-1">
                      <div className="flex rounded-2xl border border-zinc-700 bg-zinc-950 overflow-hidden">
                        <span className="px-4 py-4 text-zinc-500 text-sm hidden md:inline">/s/</span>
                        <input
                          className="flex-1 bg-transparent p-4 text-white placeholder-zinc-500 outline-none"
                          placeholder={makeSlug(idea || 'my-site')}
                          value={publishSlug}
                          onChange={(e) => setPublishSlug(makeSlug(e.target.value))}
                        />
                      </div>
                    </div>
                    <button
                      onClick={publishCurrentSite}
                      disabled={isPublishing}
                      className="lg:w-48 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-6 py-4 font-bold text-white disabled:opacity-50"
                    >
                      {isPublishing ? 'Publishing…' : 'Publish Site'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-emerald-700 bg-emerald-950/30 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Launch complete</p>
                        <h3 className="mt-2 text-2xl font-black text-white">Your site is live.</h3>
                        <p className="mt-2 max-w-2xl text-sm text-zinc-300">
                          Copy the link and share it. Set up a custom domain below when you are ready.
                        </p>
                        <a
                          href={publishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block max-w-full break-all text-sm font-semibold text-emerald-200 hover:text-emerald-100"
                        >
                          {publishedUrl}
                        </a>
                        {publishStatus && <p className="mt-2 text-xs text-zinc-500">{publishStatus}</p>}
                      </div>
                      <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-64">
                        <button
                          type="button"
                          onClick={() => copyText(publishedUrl, 'Live link copied', 'Send this link to customers or testers.')}
                          className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-100"
                        >
                          Copy Live Link
                        </button>
                        <a
                          href={publishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-emerald-700 bg-black px-4 py-3 text-center text-sm font-bold text-emerald-100 hover:border-emerald-400"
                        >
                          Open Site
                        </a>
                        <button
                          type="button"
                          onClick={publishCurrentSite}
                          disabled={isPublishing}
                          className="col-span-2 rounded-xl border border-zinc-700 bg-black px-4 py-3 text-sm font-bold text-zinc-200 hover:border-emerald-400 disabled:opacity-50"
                        >
                          {isPublishing ? 'Republishing…' : 'Republish latest edits'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-sky-900 bg-sky-950/20 p-4">
                    <p className="text-sm font-semibold text-sky-300">Custom domain (optional upgrade)</p>
                    <p className="mt-2 text-sm text-zinc-300">
                      Use a domain you already own (like joespainting.com). Save it here — we connect it to your site automatically. Then give GoDaddy the DNS records.
                    </p>
                    <ol className="mt-3 space-y-1 text-sm text-zinc-400 list-decimal list-inside">
                      <li>Publish your site.</li>
                      <li>Enter your domain and click <span className="text-zinc-200">Save domain</span>.</li>
                      <li>Open <span className="text-zinc-200">Show DNS records</span> and give them to GoDaddy.</li>
                    </ol>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                      <label className="flex-1 text-sm text-zinc-300">
                        Your domain
                        <input
                          type="text"
                          value={customDomainInput}
                          onChange={(event) => setCustomDomainInput(event.target.value)}
                          placeholder="joespainting.com"
                          className="mt-2 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-sm text-white placeholder:text-zinc-600"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={saveCustomDomain}
                        disabled={isSavingCustomDomain || !customDomainInput.trim()}
                        className="rounded-xl border border-sky-700 bg-sky-950/40 px-4 py-3 text-sm font-bold text-sky-100 hover:border-sky-400 disabled:opacity-50"
                      >
                        {isSavingCustomDomain ? 'Saving…' : connectedDomain ? 'Update domain' : 'Save domain'}
                      </button>
                    </div>
                    {connectedDomain && (
                      <p className="mt-3 text-sm text-emerald-300">
                        Saved: <span className="font-semibold">{connectedDomain}</span>. Give GoDaddy the DNS records below — after they update, your site will be at https://www.{connectedDomain}.
                      </p>
                    )}
                    {customDomainHosting?.message && (
                      <p className={`mt-3 rounded-xl border p-3 text-sm ${
                        customDomainHosting.status === 'error'
                          ? 'border-amber-900 bg-amber-950/20 text-amber-100'
                          : customDomainHosting.status === 'active'
                            ? 'border-emerald-900 bg-emerald-950/20 text-emerald-100'
                            : 'border-sky-900 bg-sky-950/20 text-sky-100'
                      }`}>
                        {customDomainHosting.message}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowDomainDns((current) => !current)}
                        className="rounded-xl border border-sky-700 bg-black px-4 py-3 text-sm font-bold text-sky-100 hover:border-sky-400"
                      >
                        {showDomainDns ? 'Hide DNS records' : 'Show DNS records'}
                      </button>
                      <a
                        href="tel:+14803663549"
                        className="text-sm font-semibold text-sky-200 hover:text-sky-100"
                      >
                        GoDaddy: +1 480-366-3549
                      </a>
                      {showDomainDns && (
                        <button
                          type="button"
                          onClick={() => copyText(domainSetupInstructions, 'DNS records copied', 'Give these records to GoDaddy support.')}
                          className="rounded-xl border border-sky-700 bg-sky-950/40 px-4 py-3 text-sm font-bold text-sky-100 hover:border-sky-400"
                        >
                          Copy DNS records
                        </button>
                      )}
                    </div>
                    {showDomainDns && (
                      <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/60 p-4">
                        <p className="text-sm font-semibold text-white">Give these to GoDaddy</p>
                        <p className="mt-1 text-sm text-zinc-400">
                          Call +1 480-366-3549 or use GoDaddy chat. Paste or read the records below for {domainExample.replace(/^www\./, '')}.
                        </p>
                        <div className="mt-4 space-y-3">
                          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs">
                            <p className="text-zinc-500 uppercase tracking-wide">DNS record 1</p>
                            <p className="mt-2 text-white">Type: CNAME</p>
                            <p className="mt-1 text-white">Name: www</p>
                            <p className="mt-1 break-all text-sky-200">Value: {domainTarget}</p>
                          </div>
                          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs">
                            <p className="text-zinc-500 uppercase tracking-wide">DNS record 2</p>
                            <p className="mt-2 break-all text-white">
                              Forward {domainExample.replace(/^www\./, '')} to https://www.{domainExample.replace(/^www\./, '')}
                            </p>
                          </div>
                          <p className="text-xs text-zinc-500">DNS changes can take a little while. You only need to do this once.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            )}

            {/* Preview iframe */}
            <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-400">
                {isEditingPreview ? 'Edit mode: click text to rewrite, photos to replace, and payment buttons to set Venmo or checkout.' : 'Preview mode: click around like a customer.'}
              </p>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center">
                {publishedUrl && (
                  <div className="col-span-2 flex flex-col gap-2 rounded-2xl border border-emerald-900 bg-emerald-950/30 px-3 py-2 sm:flex-row sm:items-center">
                    <a
                      href={publishedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="max-w-xs truncate text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                      title={publishedUrl}
                    >
                      Live: {publishedUrl}
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(publishedUrl);
                        showToast('Link copied', 'Live site link copied.', 'success');
                      }}
                      className="rounded-xl bg-black/60 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-black"
                    >
                      Copy
                    </button>
                  </div>
                )}
                <div className="col-span-2 inline-flex rounded-2xl border border-zinc-700 bg-black p-1 sm:col-span-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingPreview(false);
                      setRenderKey((key) => key + 1);
                    }}
                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold ${!isEditingPreview ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingPreview(true);
                      setShowEditHint(true);
                      setRenderKey((key) => key + 1);
                    }}
                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold ${isEditingPreview ? 'bg-emerald-500 text-white' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Edit
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveAddon(activeAddon === 'edit' ? 'none' : 'edit')}
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                    activeAddon === 'edit'
                      ? 'border-purple-400 bg-purple-500/20 text-purple-100'
                      : 'border-zinc-700 bg-black text-zinc-200 hover:border-purple-500 hover:text-white'
                  }`}
                >
                  Edit Tools
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAddon(activeAddon === 'invoice' ? 'none' : 'invoice')}
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                    activeAddon === 'invoice'
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                      : 'border-zinc-700 bg-black text-zinc-200 hover:border-emerald-500 hover:text-white'
                  }`}
                >
                  Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAddon(activeAddon === 'expand' ? 'none' : 'expand')}
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                    activeAddon === 'expand'
                      ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                      : 'border-zinc-700 bg-black text-zinc-200 hover:border-sky-500 hover:text-white'
                  }`}
                >
                  Pages
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAddon(activeAddon === 'launch' ? 'none' : 'launch')}
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                    activeAddon === 'launch'
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                      : 'border-zinc-700 bg-black text-zinc-200 hover:border-emerald-500 hover:text-white'
                  }`}
                >
                  Launch
                </button>
                <button
                  type="button"
                  onClick={publishCurrentSite}
                  disabled={isPublishing}
                  className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isPublishing ? 'Publishing...' : publishedUrl ? 'Republish' : 'Publish'}
                </button>
              </div>
            </div>
            {isEditingPreview && showEditHint && (
              <div className="border-b border-emerald-900 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    Tip: click any photo to upload a real business photo or generate an AI image. Real photos usually build more trust.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowEditHint(false)}
                    className="rounded-xl border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-100 hover:border-emerald-400"
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}
            <GeneratedSitePreview
              html={agent3}
              renderKey={renderKey}
              isEditing={isEditingPreview}
              cleanHtml={cleanHTML}
              setPreviewModeHtml={setPreviewModeHtml}
            />
          </div>
        )}

      </div>

      {SHOW_EXPERIMENTAL_TOOLS && screenPetVisible && (
        <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
          <div className="ope-screen-pet">
            <div className="ope-screen-pet-speech">baa</div>
            <div className="ope-screen-pet-hook" />
            <div className="ope-screen-pet-rope" />
            <div className="ope-screen-pet-bob">
              <div className="ope-sheep">
                <div className="ope-sheep-wool wool-1" />
                <div className="ope-sheep-wool wool-2" />
                <div className="ope-sheep-wool wool-3" />
                <div className="ope-sheep-body" />
                <div className="ope-sheep-head">
                  <span className="ope-sheep-ear ear-left" />
                  <span className="ope-sheep-ear ear-right" />
                  <span className="ope-sheep-eye eye-left" />
                  <span className="ope-sheep-eye eye-right" />
                </div>
                <span className="ope-sheep-leg leg-one" />
                <span className="ope-sheep-leg leg-two" />
                <span className="ope-sheep-leg leg-three" />
                <span className="ope-sheep-leg leg-four" />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setScreenPetVisible(false)}
            className="pointer-events-auto fixed bottom-4 right-4 rounded-full border border-zinc-700 bg-black/80 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-purple-400 hover:text-white"
          >
            Hide sheep
          </button>
        </div>
      )}

      <style>{`
        @keyframes ope-pet-adventure {
          0% { transform: translate(2vw, calc(100vh - 116px)) rotate(0deg); }
          16% { transform: translate(42vw, calc(100vh - 116px)) rotate(0deg); }
          24% { transform: translate(62vw, calc(100vh - 116px)) rotate(0deg); }
          31% { transform: translate(78vw, calc(100vh - 116px)) rotate(0deg); }
          38% { transform: translate(calc(100vw - 118px), calc(100vh - 116px)) rotate(0deg); }
          52% { transform: translate(calc(100vw - 118px), 112px) rotate(-90deg); }
          62% { transform: translate(54vw, 82px) rotate(0deg); }
          72% { transform: translate(34vw, 82px) rotate(180deg); }
          82% { transform: translate(18vw, 46vh) rotate(180deg); }
          91% { transform: translate(52vw, calc(100vh - 116px)) rotate(0deg); }
          100% { transform: translate(2vw, calc(100vh - 116px)) rotate(0deg); }
        }

        @keyframes ope-pet-bob {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-7px) rotate(2deg); }
        }

        @keyframes ope-sheep-leg-walk {
          0%, 100% { transform: rotate(18deg); }
          50% { transform: rotate(-22deg); }
        }

        @keyframes ope-hook-toss {
          0%, 20%, 70%, 100% { opacity: 0; transform: translate(38px, -8px) rotate(-20deg) scale(0.5); }
          24%, 34% { opacity: 1; transform: translate(120px, -112px) rotate(26deg) scale(1); }
          38%, 57% { opacity: 1; transform: translate(104px, -170px) rotate(12deg) scale(1); }
          62% { opacity: 0; transform: translate(12px, -32px) rotate(-40deg) scale(0.5); }
        }

        @keyframes ope-rope-show {
          0%, 22%, 68%, 100% { opacity: 0; height: 0; }
          27%, 58% { opacity: 1; height: 178px; }
        }

        @keyframes ope-speech-cycle {
          0%, 12%, 35%, 78%, 100% { opacity: 0; transform: translateY(8px) scale(0.9); }
          18%, 28% { opacity: 1; transform: translateY(0) scale(1); }
          83%, 90% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes ope-svg-cookie-hide {
          0%, 24% { opacity: 1; transform: scale(1); }
          36%, 100% { opacity: 0; transform: scale(0.98); }
        }

        @keyframes ope-svg-crack {
          0%, 8% { opacity: 0; stroke-dashoffset: 90; }
          16%, 30% { opacity: 1; stroke-dashoffset: 0; }
          42%, 100% { opacity: 0; stroke-dashoffset: 0; }
        }

        @keyframes ope-svg-left-open {
          0%, 26% { opacity: 0; transform: translate(0, 0) rotate(0deg); }
          30% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
          50%, 100% { opacity: 1; transform: translate(-38px, 13px) rotate(-16deg); }
        }

        @keyframes ope-svg-right-open {
          0%, 26% { opacity: 0; transform: translate(0, 0) rotate(0deg); }
          30% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
          50%, 100% { opacity: 1; transform: translate(38px, 13px) rotate(16deg); }
        }

        @keyframes ope-svg-slip-out {
          0%, 38% { opacity: 0; transform: translate(-50%, 34px) scale(0.72); }
          58%, 100% { opacity: 1; transform: translate(-50%, -10px) scale(1); }
        }

        @keyframes ope-svg-spark {
          0%, 32% { opacity: 0; transform: translate(0, 0) scale(0.4); }
          44%, 72% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--spark-x), var(--spark-y)) scale(1); }
        }

        @keyframes ope-cookie-left-open {
          0%, 24% { opacity: 0; transform: translateX(0) rotate(0deg); }
          25% { opacity: 1; transform: translateX(0) rotate(0deg); }
          48%, 100% { opacity: 1; transform: translateX(-34px) rotate(-14deg); }
        }

        @keyframes ope-cookie-right-open {
          0%, 24% { opacity: 0; transform: translateX(0) rotate(0deg); }
          25% { opacity: 1; transform: translateX(0) rotate(0deg); }
          48%, 100% { opacity: 1; transform: translateX(34px) rotate(14deg); }
        }

        @keyframes ope-fortune-slide {
          0%, 38% { opacity: 0; transform: translate(-50%, 16px) scale(0.72); max-height: 22px; }
          58%, 100% { opacity: 1; transform: translate(-50%, -32px) scale(1); max-height: 160px; }
        }

        @keyframes ope-cookie-crumb-pop {
          0%, 32% { opacity: 0; transform: translate(0, 0) scale(0.5); }
          48%, 78% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--crumb-x), var(--crumb-y)) scale(1); }
        }

        @keyframes ope-cookie-base-hide {
          0%, 24% { opacity: 1; transform: scale(1); }
          38%, 100% { opacity: 0; transform: scale(0.96); }
        }

        @keyframes ope-cookie-crack-show {
          0%, 10% { opacity: 0; transform: scaleY(0); }
          16%, 28% { opacity: 1; transform: scaleY(1); }
          42%, 100% { opacity: 0; transform: scaleY(1); }
        }

        .ope-screen-pet {
          animation: ope-pet-adventure 32s linear infinite;
          height: 84px;
          position: absolute;
          width: 104px;
        }

        .ope-fortune-stage {
          height: 250px;
          max-width: 360px;
          position: relative;
          width: 100%;
        }

        .ope-cookie-svg {
          display: block;
          height: 220px;
          overflow: visible;
          width: 100%;
        }

        .ope-cookie-closed {
          animation: ope-svg-cookie-hide 4.2s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }

        .ope-cookie-crack-line {
          animation: ope-svg-crack 4.2s ease-in-out infinite;
          stroke-dasharray: 90;
        }

        .ope-cookie-left-piece,
        .ope-cookie-right-piece {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
        }

        .ope-cookie-left-piece {
          animation: ope-svg-left-open 4.2s cubic-bezier(.2, .9, .2, 1) infinite;
        }

        .ope-cookie-right-piece {
          animation: ope-svg-right-open 4.2s cubic-bezier(.2, .9, .2, 1) infinite;
        }

        .ope-fortune-slip {
          animation: ope-svg-slip-out 4.2s cubic-bezier(.2, .9, .2, 1) infinite;
          background: linear-gradient(180deg, #fffdf5, #ffedd5);
          border: 2px solid #fed7aa;
          border-radius: 14px;
          bottom: 52px;
          box-shadow: 0 12px 26px rgba(0,0,0,.28);
          color: #7c2d12;
          font-size: 13px;
          font-weight: 900;
          left: 50%;
          line-height: 1.35;
          max-height: 106px;
          overflow: auto;
          padding: 12px 16px;
          position: absolute;
          text-align: center;
          width: min(280px, 82%);
          z-index: 5;
        }

        .ope-cookie-spark {
          animation: ope-svg-spark 4.2s ease-out infinite;
          background: #facc15;
          border-radius: 999px;
          height: 8px;
          left: 50%;
          position: absolute;
          top: 116px;
          width: 8px;
          z-index: 6;
        }

        .spark-one { --spark-x: -78px; --spark-y: -46px; animation-delay: .05s; }
        .spark-two { --spark-x: 78px; --spark-y: -38px; animation-delay: .14s; }
        .spark-three { --spark-x: 2px; --spark-y: -68px; animation-delay: .22s; }

        .ope-fortune-photo {
          border-radius: 24px;
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.38);
          max-width: 640px;
          overflow: hidden;
          position: relative;
          width: 100%;
        }

        .ope-fortune-photo-art {
          display: block;
          height: auto;
          width: 100%;
        }

        .ope-fortune-photo-slip {
          background: linear-gradient(180deg, #fffdf7, #f3eadb);
          box-shadow: 0 10px 22px rgba(0,0,0,.28);
          color: #334155;
          font-family: "Courier New", monospace;
          font-size: clamp(12px, 2.2vw, 20px);
          font-weight: 900;
          left: 47%;
          letter-spacing: 0.04em;
          line-height: 1.2;
          max-height: 68px;
          max-width: 360px;
          overflow: hidden;
          padding: 12px 18px;
          position: absolute;
          text-align: center;
          text-transform: uppercase;
          top: 56%;
          transform: translate(-50%, -50%) rotate(-5deg);
          width: 48%;
          z-index: 2;
        }

        .ope-fortune-cookie {
          height: 190px;
          position: relative;
          width: 310px;
        }

        .ope-cookie-shadow {
          background: radial-gradient(ellipse, rgba(0,0,0,.35), rgba(0,0,0,0) 70%);
          bottom: 12px;
          height: 28px;
          left: 58px;
          position: absolute;
          width: 190px;
        }

        .ope-cookie-base,
        .ope-cookie-half {
          background:
            radial-gradient(circle at 38% 30%, rgba(255,255,255,.42), transparent 18%),
            radial-gradient(circle at 66% 70%, rgba(146,64,14,.34), transparent 28%),
            linear-gradient(135deg, #fde68a 0%, #f59e0b 52%, #b45309 100%);
          border: 3px solid #78350f;
          box-shadow: inset -12px -14px 22px rgba(120, 53, 15, 0.3), inset 8px 8px 18px rgba(255,255,255,.26), 0 18px 28px rgba(0,0,0,.28);
          position: absolute;
        }

        .ope-cookie-base {
          animation: ope-cookie-base-hide 3.4s ease-in-out infinite;
          border-radius: 50% 50% 44% 44% / 42% 42% 58% 58%;
          height: 92px;
          left: 64px;
          overflow: hidden;
          top: 72px;
          width: 180px;
          z-index: 3;
        }

        .ope-cookie-base::before {
          background: rgba(120, 53, 15, .18);
          border: 3px solid rgba(120, 53, 15, .35);
          border-radius: 50%;
          content: "";
          height: 84px;
          left: 34px;
          position: absolute;
          top: -48px;
          width: 108px;
        }

        .ope-cookie-base::after {
          background: rgba(253, 230, 138, .78);
          border-radius: 50%;
          bottom: -36px;
          content: "";
          height: 86px;
          left: 42px;
          position: absolute;
          width: 92px;
        }

        .ope-cookie-crack {
          animation: ope-cookie-crack-show 3.4s ease-in-out infinite;
          background: #78350f;
          clip-path: polygon(44% 0, 57% 0, 52% 30%, 63% 30%, 46% 100%, 51% 44%, 38% 44%);
          height: 74px;
          left: 149px;
          position: absolute;
          top: 78px;
          transform-origin: top center;
          width: 22px;
          z-index: 4;
        }

        .ope-cookie-half {
          animation-duration: 3.4s;
          animation-iteration-count: infinite;
          animation-timing-function: cubic-bezier(.2, .9, .2, 1);
          height: 84px;
          opacity: 0;
          top: 82px;
          width: 104px;
          z-index: 2;
        }

        .left-cookie {
          animation-name: ope-cookie-left-open;
          border-radius: 60% 35% 58% 42% / 40% 48% 58% 60%;
          left: 72px;
          transform-origin: 96px 46px;
        }

        .right-cookie {
          animation-name: ope-cookie-right-open;
          border-radius: 35% 60% 42% 58% / 48% 40% 60% 58%;
          right: 72px;
          transform-origin: 8px 46px;
        }

        .ope-fortune-paper {
          animation: ope-fortune-slide 3.4s cubic-bezier(.2, .9, .2, 1) infinite;
          background: #fff7ed;
          border: 2px solid #fed7aa;
          border-radius: 14px;
          bottom: 22px;
          box-shadow: 0 10px 24px rgba(0,0,0,.22);
          color: #9a3412;
          font-size: 12px;
          font-weight: 900;
          left: 50%;
          line-height: 1.35;
          max-width: 230px;
          overflow: hidden;
          padding: 10px 14px;
          position: absolute;
          transform-origin: center;
          width: max-content;
          z-index: 1;
        }

        .ope-cookie-crumb {
          animation: ope-cookie-crumb-pop 3.4s ease-out infinite;
          background: #f59e0b;
          border-radius: 999px;
          height: 8px;
          left: 50%;
          position: absolute;
          top: 112px;
          width: 8px;
          z-index: 3;
        }

        .crumb-one { --crumb-x: -58px; --crumb-y: -34px; animation-delay: .05s; }
        .crumb-two { --crumb-x: 54px; --crumb-y: -26px; animation-delay: .12s; }
        .crumb-three { --crumb-x: 8px; --crumb-y: -48px; animation-delay: .2s; }

        .ope-screen-pet-bob {
          animation: ope-pet-bob 0.7s ease-in-out infinite;
          height: 84px;
          position: relative;
          width: 104px;
        }

        .ope-screen-pet-speech {
          animation: ope-speech-cycle 32s ease-in-out infinite;
          background: rgba(0, 0, 0, 0.88);
          border: 1px solid rgba(168, 85, 247, 0.55);
          border-radius: 999px;
          color: white;
          font-size: 12px;
          font-weight: 900;
          left: 28px;
          padding: 4px 10px;
          position: absolute;
          top: -28px;
          z-index: 3;
        }

        .ope-screen-pet-hook {
          animation: ope-hook-toss 32s linear infinite;
          border: 5px solid #d8b4fe;
          border-left-color: transparent;
          border-radius: 999px;
          left: 24px;
          height: 30px;
          position: absolute;
          text-shadow: 0 6px 16px rgba(0, 0, 0, 0.7);
          top: 5px;
          width: 30px;
          z-index: 2;
        }

        .ope-screen-pet-hook::after {
          background: #d8b4fe;
          border-radius: 999px;
          content: "";
          height: 20px;
          left: 20px;
          position: absolute;
          top: 18px;
          transform: rotate(42deg);
          width: 5px;
        }

        .ope-screen-pet-rope {
          animation: ope-rope-show 32s linear infinite;
          background: repeating-linear-gradient(to bottom, #d8b4fe 0 8px, #7c3aed 8px 13px);
          border-radius: 999px;
          left: 95px;
          position: absolute;
          top: -158px;
          transform: rotate(31deg);
          transform-origin: bottom center;
          width: 4px;
          z-index: 1;
        }

        .ope-sheep {
          filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.55));
          height: 78px;
          position: relative;
          width: 104px;
        }

        .ope-sheep-body,
        .ope-sheep-wool {
          background: #f8fafc;
          border: 3px solid #cbd5e1;
          position: absolute;
        }

        .ope-sheep-body {
          border-radius: 44px;
          height: 46px;
          left: 18px;
          top: 19px;
          width: 68px;
        }

        .ope-sheep-wool {
          border-radius: 999px;
          height: 32px;
          width: 32px;
        }

        .wool-1 { left: 19px; top: 6px; }
        .wool-2 { left: 43px; top: 2px; }
        .wool-3 { left: 64px; top: 12px; }

        .ope-sheep-head {
          background: #111827;
          border: 3px solid #020617;
          border-radius: 45% 55% 50% 50%;
          height: 34px;
          left: 70px;
          position: absolute;
          top: 24px;
          width: 30px;
          z-index: 2;
        }

        .ope-sheep-ear {
          background: #111827;
          border-radius: 999px;
          height: 14px;
          position: absolute;
          top: -8px;
          width: 10px;
        }

        .ear-left { left: 1px; transform: rotate(-28deg); }
        .ear-right { right: 1px; transform: rotate(28deg); }

        .ope-sheep-eye {
          background: white;
          border-radius: 999px;
          height: 5px;
          position: absolute;
          top: 11px;
          width: 5px;
        }

        .eye-left { left: 7px; }
        .eye-right { right: 7px; }

        .ope-sheep-leg {
          animation: ope-sheep-leg-walk 0.35s ease-in-out infinite;
          background: #111827;
          border-radius: 999px;
          height: 23px;
          position: absolute;
          top: 55px;
          transform-origin: top center;
          width: 7px;
        }

        .leg-one { animation-delay: 0s; left: 30px; }
        .leg-two { animation-delay: 0.17s; left: 45px; }
        .leg-three { animation-delay: 0.08s; left: 62px; }
        .leg-four { animation-delay: 0.24s; left: 76px; }

        @media (prefers-reduced-motion: reduce) {
          .ope-screen-pet,
          .ope-screen-pet-bob,
          .ope-screen-pet-hook,
          .ope-screen-pet-rope,
          .ope-screen-pet-speech,
          .ope-sheep-leg {
            animation-duration: 0.01ms;
            animation-iteration-count: 1;
          }
        }
      `}</style>

      {startOverConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-3xl border border-amber-700/60 bg-zinc-900 p-7 shadow-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">Start over?</p>
            <h2 className="mt-3 text-2xl font-bold text-white">This will start over with a new website.</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Your current generated website will be cleared from this screen. Cancel if you want to keep editing it.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setStartOverConfirmOpen(false)}
                className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 font-bold text-white hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startOverWithNewWebsite}
                className="flex-1 rounded-xl bg-amber-400 px-4 py-3 font-bold text-black hover:bg-amber-300"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {couponModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 p-8 rounded-3xl border border-yellow-700/60 w-full max-w-lg shadow-2xl">
            <h2 className="text-2xl font-bold mb-2">Coupon Agent</h2>
            <p className="text-sm text-zinc-400 mb-6">
              Add a coupon section to the website. For Venmo, this works as a code/instruction the customer mentions before paying, not an automatic checkout discount.
            </p>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-zinc-300">Discount amount</span>
              <input
                className="w-full rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500 outline-none focus:border-yellow-400"
                placeholder="Example: 10%, $25, Free estimate"
                value={couponDiscount}
                onChange={(e) => setCouponDiscount(e.target.value)}
              />
            </label>
            <label className="mt-4 block space-y-2">
              <span className="text-sm font-semibold text-zinc-300">Coupon details optional</span>
              <textarea
                className="h-28 w-full rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500 outline-none focus:border-yellow-400"
                placeholder="Example: Valid for first-time customers this month. Mention the coupon before booking."
                value={couponDetails}
                onChange={(e) => setCouponDetails(e.target.value)}
              />
            </label>
            <div className="mt-6 rounded-2xl border border-yellow-800 bg-yellow-950/20 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-yellow-300">MVP payment note</p>
              <p className="mt-2 text-sm text-zinc-300">
                Venmo phone-number payment cannot reliably auto-apply a coupon. This creates a visible coupon code and instruction for the owner/customer.
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setCouponModalOpen(false)}
                className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 font-bold text-white hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createCouponSection}
                className="flex-1 rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-300"
              >
                Create Coupon
              </button>
            </div>
          </div>
        </div>
      )}

      {imageModalOpen && activeImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-700 w-full max-w-xl shadow-2xl">
            <h2 className="text-2xl font-bold mb-2">Replace Photo</h2>
            <p className="text-sm text-zinc-400 mb-6">
              Real business photos usually build the most trust. Upload one if you have it, or generate an AI image if you do not.
            </p>

            {activeImage.currentSrc && (
              <div className="mb-5 overflow-hidden rounded-2xl border border-zinc-700 bg-black">
                <Image
                  src={activeImage.currentSrc}
                  alt="Current selected website image"
                  width={900}
                  height={315}
                  unoptimized
                  className="max-h-56 w-full object-cover"
                />
              </div>
            )}

            <label className="block mb-5 rounded-2xl border border-dashed border-emerald-600 bg-emerald-950/20 p-5 text-center cursor-pointer hover:border-emerald-400">
              <span className="block font-semibold text-white">Upload Real Photo</span>
              <span className="block mt-1 text-sm text-emerald-100">Best choice: real job photo, product, storefront, logo, team photo, or before/after image.</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => uploadActiveImage(e.target.files?.[0] || null)}
              />
            </label>

            <div className="mb-6 rounded-2xl border border-purple-900 bg-purple-950/20 p-4">
              <p className="text-sm font-bold text-purple-200">No real photo yet?</p>
              <p className="mt-1 text-sm text-zinc-400">
                Use AI to generate an image. You can replace it with a real owner photo later if you want.
              </p>
              <textarea
                className="mt-3 h-28 w-full rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500"
                placeholder="Describe a simple, believable placeholder image..."
                value={imageInstruction}
                onChange={(e) => setImageInstruction(e.target.value)}
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setImageModalOpen(false)}
                className="flex-1 py-3 bg-zinc-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={generateActiveImage}
                disabled={isGeneratingImage || !imageInstruction.trim() || aiImageGenerationCount >= AI_IMAGE_GENERATION_LIMIT}
                className="flex-1 py-3 bg-purple-600 rounded-xl font-bold disabled:opacity-50"
              >
                {isGeneratingImage ? 'Generating…' : aiImageGenerationCount >= AI_IMAGE_GENERATION_LIMIT ? 'Image Limit Hit' : 'Generate AI Image'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal stays exactly the same */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-700 w-full max-w-lg shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">
              {(isStripeModal || activeTextId.startsWith('stripe-payment-button')) 
                ? "Set Up Owner Payment Button" 
                : "Edit Content"}
            </h2>
            
            {(isStripeModal || activeTextId.startsWith('stripe-payment-button')) ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-800 bg-black/50 p-4">
                  <p className="text-sm font-bold text-white">Payment setup</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Start simple with Venmo. Upgrade later by pasting a Stripe Payment Link or PayPal checkout link. No API keys needed.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('venmo')}
                      className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                        paymentMode === 'venmo'
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-emerald-600'
                      }`}
                    >
                      Venmo / Manual
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMode('checkout');
                        setCheckoutProvider((current) => current || inferCheckoutProvider(checkoutUrl));
                      }}
                      className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                        paymentMode === 'checkout'
                          ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-sky-600'
                      }`}
                    >
                      Stripe / PayPal Link
                    </button>
                  </div>
                </div>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-zinc-300">Button text</span>
                  <input
                    className="w-full p-4 bg-black rounded-xl border border-zinc-700"
                    placeholder="Pay Owner"
                    value={modalText}
                    onChange={(e) => setModalText(e.target.value)}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-zinc-300">Owner&apos;s product or service</span>
                    <input
                      className="w-full p-4 bg-black rounded-xl border border-zinc-700"
                      placeholder="Example: Full detail"
                      value={venmoPaymentItem}
                      onChange={(e) => setVenmoPaymentItem(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-zinc-300">Customer price</span>
                    <input
                      className="w-full p-4 bg-black rounded-xl border border-zinc-700"
                      placeholder="Example: $149"
                      value={venmoPaymentAmount}
                      onChange={(e) => setVenmoPaymentAmount(e.target.value)}
                    />
                  </label>
                </div>
                {paymentMode === 'venmo' ? (
                  <>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-zinc-300">Owner&apos;s Venmo phone number</span>
                      <input
                        className="w-full p-4 bg-black rounded-xl border border-zinc-700"
                        placeholder="555-555-5555"
                        value={paymentInstructions}
                        onChange={(e) => setPaymentInstructions(formatVenmoPhoneNumber(e.target.value))}
                      />
                    </label>
                    {buildVenmoPayment(paymentInstructions, venmoPaymentAmount, venmoPaymentItem) && (
                      <p className="rounded-2xl border border-zinc-800 bg-black/50 p-4 text-sm text-zinc-300">
                        Venmo is ready. Customers click the button and see exactly where to send payment.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-3 rounded-2xl border border-sky-900 bg-sky-950/20 p-4">
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-sky-100">Stripe or PayPal checkout link</span>
                      <input
                        className="w-full rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500"
                        placeholder="https://buy.stripe.com/... or https://paypal.me/..."
                        value={checkoutUrl}
                        onChange={(e) => {
                          setCheckoutUrl(e.target.value);
                          setCheckoutProvider(inferCheckoutProvider(e.target.value));
                        }}
                      />
                    </label>
                    <p className="text-sm text-zinc-300">
                      Use a Stripe Payment Link or PayPal checkout/pay link owned by the business. OnePerson Empire does not store card data or API keys in this lite setup.
                    </p>
                    {normalizeCheckoutUrl(checkoutUrl) && (
                      <p className="rounded-xl border border-sky-800 bg-black/50 p-3 text-sm text-sky-100">
                        Checkout link detected: {checkoutProvider || inferCheckoutProvider(checkoutUrl)}
                      </p>
                    )}
                  </div>
                )}
                <button 
                  onClick={testPaymentLink}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
                >
                  {paymentMode === 'checkout' ? 'Open Checkout Link' : 'Preview Customer Payment Info'}
                </button>
              </div>
            ) : (
              <>
                <textarea 
                  className="w-full h-32 bg-black p-4 rounded-xl border border-zinc-700 mb-4" 
                  value={modalText} 
                  onChange={(e) => setModalText(e.target.value)} 
                />
                {activeDeletableSection && (
                  <div className="mb-6 rounded-2xl border border-red-900 bg-red-950/20 p-4">
                    <p className="text-sm font-bold text-red-200">Added page: {activeDeletableSection.label}</p>
                    <p className="mt-1 text-xs leading-5 text-red-100/80">
                      Changed your mind? Delete this page-style section and its More pages link.
                    </p>
                    <button
                      type="button"
                      onClick={deleteActiveAddedPage}
                      className="mt-3 rounded-xl border border-red-700 px-4 py-2 text-sm font-bold text-red-100 hover:border-red-400 hover:bg-red-950"
                    >
                      Delete Page
                    </button>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => {
                  setModalOpen(false);
                  setActiveDeletableSection(null);
                }} 
                className="flex-1 py-3 bg-zinc-800 rounded-xl"
              >
                Cancel
              </button>
              <button 
                onClick={handleManualSave} 
                className="flex-1 py-3 bg-zinc-700 rounded-xl font-bold"
              >
                Save
              </button>
              <button 
                onClick={handleAISave} 
                disabled={isGenerating || aiCopyRewriteCount >= AI_COPY_REWRITE_LIMIT}
                className="flex-1 py-3 bg-purple-600 rounded-xl font-bold disabled:opacity-50"
              >
                {isGenerating ? "..." : aiCopyRewriteCount >= AI_COPY_REWRITE_LIMIT ? "Limit Hit" : "✨ AI Rewrite"}
              </button>
            </div>
          </div>
        </div>
      )}

      <FeedbackOverlays
        toasts={toasts}
        confirmAction={confirmAction}
        onDismissToast={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}
        onCancelConfirm={() => setConfirmAction(null)}
        onRunConfirm={() => {
          if (!confirmAction) return;
          const action = confirmAction.onConfirm;
          setConfirmAction(null);
          action();
        }}
      />
    </main>
  );
}