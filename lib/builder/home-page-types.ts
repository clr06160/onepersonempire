import type { BuilderAddon } from '@/components/builder/LevelUpPanel';

export type BuilderMode = 'normal' | 'expand' | 'onepage' | 'rewrite';

export type IdeaValidation = {
  verdict: string;
  score: number;
  buyer: string;
  whyItMightWork: string[];
  whyItMightFail: string[];
  sharperOffer: string;
  firstCustomer: string;
  nextMove: string;
};

export type BusinessPlan = {
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

export type PricingEstimate = {
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

export type HuntedIdea = {
  idea: string;
  validation: IdeaValidation;
};

export type ActiveImageEdit = {
  imageIndex: number | string;
  currentSrc: string;
  altText: string;
  imageBrief: string;
  sectionText: string;
};

export type CleanBusinessBrief = {
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

export type ActiveAddon = BuilderAddon;

export type PublishedSitePayload = {
  slug: string;
  html: string;
  idea?: string;
  url: string;
  editToken: string;
  updatedAt?: string;
};

export type PublishedSiteCredentials = {
  slug: string;
  key: string;
};

export type CustomDomainHosting = {
  status?: string;
  message?: string;
};
