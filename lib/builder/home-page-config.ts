export const AI_COPY_REWRITE_LIMIT = 5;
export const AI_SITE_REWRITE_LIMIT = 3;
export const AI_IMAGE_GENERATION_LIMIT = 3;
export const SHOW_EXPERIMENTAL_TOOLS = false;
export const SHOW_BIGGER_WEBSITE_OPTION = false;

export const PAGE_SECTION_OPTIONS = [
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
] ;

export const FUN_AGENT_CARDS = [
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
] ;

export const NEIGHBOR_PITCH_PEOPLE = [
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

export type NeighborPitchPerson = (typeof NEIGHBOR_PITCH_PEOPLE)[number];
export type FunAgentCard = (typeof FUN_AGENT_CARDS)[number];

export const AVATAR_TRADES = [
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
] ;

export const AVATAR_GENDERS = ['No preference', 'Female', 'Male'] ;
export const AVATAR_STYLES = ['Polished cartoon', '3D game character', 'Sticker mascot', 'Anime-inspired'] ;
export const AVATAR_MOODS = ['Friendly', 'Confident', 'Goofy', 'Cool', 'Premium'] ;
export const AVATAR_POSES = ['Waving', 'Holding tool', 'Thumbs up', 'Arms crossed', 'Pointing at offer'] ;
export const AVATAR_HAIR_COLORS = ['Auto', 'Black', 'Brown', 'Blonde', 'Red', 'Pink', 'Blue', 'Green', 'Silver'] ;
export const AVATAR_EYE_COLORS = ['Auto', 'Brown', 'Blue', 'Green', 'Hazel', 'Gray'] ;
export const AVATAR_FACE_FEATURES = [
  'Auto',
  'Big smile',
  'Freckles',
  'Glasses',
  'Dimples',
  'Confident eyebrows',
  'Round face',
  'Sharp jaw',
] ;

export const inferAvatarTradeFromContext = (context: string) => {
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

export const CUSTOMER_LISTS = {
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

export type CustomerListKind = keyof typeof CUSTOMER_LISTS;

export const COLLECTION_STARTER_ITEMS = [
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
] ;

export const FOLLOW_SHOP_IDEAS = [
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
] ;

export const LEVEL_UP_FEATURES = [
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
] ;
