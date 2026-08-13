'use client';

import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import type { ShowToast } from '@/lib/builder/hooks/useBuilderToasts';
import { makeSlug } from '@/lib/builder/html-utils';
import { addPageLikeSectionToHtml } from '@/lib/builder/page-templates';
import {
  fetchWithTimeout,
  formatIdeaWithBusinessMemory,
  readApiResponse,
  type BusinessMemory,
} from '@/lib/builder/home-storage-and-network';
import {
  AI_SITE_REWRITE_LIMIT,
} from '@/lib/builder/home-page-config';
import type {
  ActiveAddon,
  BuilderMode,
  BusinessPlan,
  CleanBusinessBrief,
  HuntedIdea,
  IdeaValidation,
  PricingEstimate,
} from '@/lib/builder/home-page-types';
import type { CustomerListKind, NeighborPitchPerson } from '@/lib/builder/home-page-config';
import { SAMPLE_SITE_HTML } from '@/lib/builder/sample-site-html';
import { downloadHtmlFile, stripMarkdownHtmlFences } from '@/lib/builder/site-html-utils';

type FunAgentDisplayReset = {
  setActiveFunAgentName: Dispatch<SetStateAction<string>>;
  setFunAgentOutput: Dispatch<SetStateAction<string>>;
  setFunAgentImageUrl: Dispatch<SetStateAction<string>>;
  setFunAgentPerson: Dispatch<SetStateAction<NeighborPitchPerson | null>>;
  setFunCustomerListKind: Dispatch<SetStateAction<CustomerListKind | null>>;
  setFunConceptPanel: Dispatch<SetStateAction<'collection' | 'follow' | null>>;
};

type UseSiteGenerationOptions = {
  businessMemory: BusinessMemory;
  businessMemoryRef: MutableRefObject<BusinessMemory>;
  showToast: ShowToast;
  funAgentDisplay: FunAgentDisplayReset;
  clearPublishState: () => void;
  setInvoiceUrl: Dispatch<SetStateAction<string>>;
  setPublishSlug: Dispatch<SetStateAction<string>>;
  setPublishedUrl: Dispatch<SetStateAction<string>>;
  setPublishStatus: Dispatch<SetStateAction<string>>;
  setSiteEditUrl: Dispatch<SetStateAction<string>>;
  setActiveAddon: Dispatch<SetStateAction<ActiveAddon>>;
};

export function useSiteGeneration({
  businessMemory,
  businessMemoryRef,
  showToast,
  funAgentDisplay,
  clearPublishState,
  setInvoiceUrl,
  setPublishSlug,
  setPublishedUrl,
  setPublishStatus,
  setSiteEditUrl,
  setActiveAddon,
}: UseSiteGenerationOptions) {
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
  const [showChoiceBar, setShowChoiceBar] = useState(false);
  const [siteFeedback, setSiteFeedback] = useState('');
  const [pageSectionToAdd, setPageSectionToAdd] = useState('Services');
  const [customPageSectionName, setCustomPageSectionName] = useState('');
  const [validation, setValidation] = useState<IdeaValidation | null>(null);
  const [huntedIdeas, setHuntedIdeas] = useState<HuntedIdea[]>([]);
  const [businessPlan, setBusinessPlan] = useState<BusinessPlan | null>(null);
  const [pricingRequest, setPricingRequest] = useState('');
  const [pricingZipCode, setPricingZipCode] = useState('');
  const [pricingEstimate, setPricingEstimate] = useState<PricingEstimate | null>(null);
  const [cleanBrief, setCleanBrief] = useState<CleanBusinessBrief | null>(null);
  const [aiCopyRewriteCount, setAiCopyRewriteCount] = useState(0);
  const [aiSiteRewriteCount, setAiSiteRewriteCount] = useState(0);
  const [aiImageGenerationCount, setAiImageGenerationCount] = useState(0);
  const [startOverConfirmOpen, setStartOverConfirmOpen] = useState(false);

  const ideaRef = useRef(idea);
  const agent3Ref = useRef(agent3);
  const backGuardPushedRef = useRef(false);

  useEffect(() => {
    ideaRef.current = idea;
  }, [idea]);

  useEffect(() => {
    agent3Ref.current = agent3;
  }, [agent3]);

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

  const resetFunAgentDisplay = () => {
    funAgentDisplay.setActiveFunAgentName('');
    funAgentDisplay.setFunAgentOutput('');
    funAgentDisplay.setFunAgentImageUrl('');
    funAgentDisplay.setFunAgentPerson(null);
    funAgentDisplay.setFunCustomerListKind(null);
    funAgentDisplay.setFunConceptPanel(null);
  };

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
    funAgentDisplay.setActiveFunAgentName('Pricing Agent');
    funAgentDisplay.setFunAgentOutput('');
    funAgentDisplay.setFunAgentImageUrl('');
    funAgentDisplay.setFunAgentPerson(null);
    funAgentDisplay.setFunCustomerListKind(null);
    funAgentDisplay.setFunConceptPanel(null);
    try {
      const res = await fetch('/api/pricing-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: formatIdeaWithBusinessMemory(ideaRef.current, businessMemoryRef.current),
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
          idea: formatIdeaWithBusinessMemory(ideaRef.current, businessMemoryRef.current),
          mode,
          currentHtml: mode === 'rewrite' ? stripMarkdownHtmlFences(agent3Ref.current) : undefined,
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
        setPublishedUrl('');
        setPublishStatus('');
        setSiteEditUrl('');
        setInvoiceUrl('');
        setPublishSlug(makeSlug(ideaRef.current));
        setAiCopyRewriteCount(0);
        setAiSiteRewriteCount(0);
        setAiImageGenerationCount(0);
      } else {
        setAiSiteRewriteCount((prev) => prev + 1);
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
    clearPublishState();
    resetFunAgentDisplay();
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

  const startOverWithNewWebsite = () => {
    setAgent3('');
    agent3Ref.current = '';
    setShowChoiceBar(false);
    setActiveAddon('none');
    clearPublishState();
    setCleanBrief(null);
    setIsEditingPreview(false);
    setShowEditHint(false);
    setBuildStatus('');
    setStartOverConfirmOpen(false);
    backGuardPushedRef.current = false;
  };

  const downloadSiteHtml = () => {
    downloadHtmlFile(agent3);
  };

  const copySiteHtml = async () => {
    const html = stripMarkdownHtmlFences(agent3);
    if (!html) return;

    await navigator.clipboard.writeText(html);
    showToast('HTML copied', 'Generated HTML copied to clipboard.', 'success');
  };

  return {
    idea,
    setIdea,
    zipCode,
    setZipCode,
    agent3,
    setAgent3,
    agent3Ref,
    ideaRef,
    loading,
    validating,
    huntingIdeas,
    planning,
    pricing,
    buildStatus,
    renderKey,
    setRenderKey,
    isEditingPreview,
    setIsEditingPreview,
    showEditHint,
    setShowEditHint,
    showChoiceBar,
    setShowChoiceBar,
    siteFeedback,
    setSiteFeedback,
    pageSectionToAdd,
    setPageSectionToAdd,
    customPageSectionName,
    setCustomPageSectionName,
    validation,
    setValidation,
    huntedIdeas,
    businessPlan,
    setBusinessPlan,
    pricingRequest,
    setPricingRequest,
    pricingZipCode,
    setPricingZipCode,
    pricingEstimate,
    setPricingEstimate,
    cleanBrief,
    setCleanBrief,
    aiCopyRewriteCount,
    setAiCopyRewriteCount,
    aiSiteRewriteCount,
    setAiSiteRewriteCount,
    aiImageGenerationCount,
    setAiImageGenerationCount,
    startOverConfirmOpen,
    setStartOverConfirmOpen,
    backGuardPushedRef,
    validateIdea,
    huntForIdeas,
    handleUseHuntedIdea,
    createBusinessPlan,
    runPricingAgent,
    runBuilder,
    loadSampleSite,
    handleMakeOnePageSite,
    handleExpandToMultiPage,
    handleRewriteSite,
    handleAddPageSection,
    handleBuildFromValidatedOffer,
    handleBuildFromBusinessPlan,
    startOverWithNewWebsite,
    downloadSiteHtml,
    copySiteHtml,
  };
}
