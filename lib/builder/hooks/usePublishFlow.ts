'use client';

import { useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import type { ShowToast } from '@/lib/builder/hooks/useBuilderToasts';
import { preparePublishedHtmlForEditor } from '@/lib/cms-html';
import { makeSlug } from '@/lib/builder/html-utils';
import {
  buildEditUrl,
  loadSavedPublishedEdits,
  openEmailComposer,
  openSmsComposer,
  parsePublishedSiteSlug,
  readApiResponse,
  savePublishedEditAccess,
  type BusinessMemory,
  type SavedPublishedEdit,
} from '@/lib/builder/home-storage-and-network';
import {
  buildDomainSetupInstructions,
  buildEditLinkBackupMessage,
  formatPublishedSiteLoadedStatus,
  formatPublishSuccessStatus,
  parseEditLinkCredentials,
  PAYMENT_SETUP_SCRIPT,
} from '@/lib/builder/home-publish-utils';
import type {
  ActiveAddon,
  CleanBusinessBrief,
  CustomDomainHosting,
  PublishedSitePayload,
} from '@/lib/builder/home-page-types';
import { stripMarkdownHtmlFences } from '@/lib/builder/site-html-utils';

type UsePublishFlowOptions = {
  agent3Ref: MutableRefObject<string>;
  ideaRef: MutableRefObject<string>;
  businessMemoryRef: MutableRefObject<BusinessMemory>;
  setAgent3: Dispatch<SetStateAction<string>>;
  setIdea: Dispatch<SetStateAction<string>>;
  setRenderKey: Dispatch<SetStateAction<number>>;
  setIsEditingPreview: Dispatch<SetStateAction<boolean>>;
  setShowEditHint: Dispatch<SetStateAction<boolean>>;
  setShowChoiceBar: Dispatch<SetStateAction<boolean>>;
  setCleanBrief: Dispatch<SetStateAction<CleanBusinessBrief | null>>;
  setActiveAddon: Dispatch<SetStateAction<ActiveAddon>>;
  setAiCopyRewriteCount: Dispatch<SetStateAction<number>>;
  setAiSiteRewriteCount: Dispatch<SetStateAction<number>>;
  setAiImageGenerationCount: Dispatch<SetStateAction<number>>;
  showToast: ShowToast;
  copyText: (text: string, title: string, message: string) => Promise<void>;
};

export function usePublishFlow({
  agent3Ref,
  ideaRef,
  businessMemoryRef,
  setAgent3,
  setIdea,
  setRenderKey,
  setIsEditingPreview,
  setShowEditHint,
  setShowChoiceBar,
  setCleanBrief,
  setActiveAddon,
  setAiCopyRewriteCount,
  setAiSiteRewriteCount,
  setAiImageGenerationCount,
  showToast,
  copyText,
}: UsePublishFlowOptions) {
  const [publishSlug, setPublishSlug] = useState('');
  const [publishedUrl, setPublishedUrl] = useState('');
  const [publishStatus, setPublishStatus] = useState('');
  const [siteEditUrl, setSiteEditUrl] = useState('');
  const [editLinkBackupPhone, setEditLinkBackupPhone] = useState('');
  const [editLinkBackupEmail, setEditLinkBackupEmail] = useState('');
  const [isSendingEditLinkBackup, setIsSendingEditLinkBackup] = useState(false);
  const [editSiteSlugInput, setEditSiteSlugInput] = useState('');
  const [editSiteKeyInput, setEditSiteKeyInput] = useState('');
  const [savedPublishedEdits, setSavedPublishedEdits] = useState<SavedPublishedEdit[]>([]);
  const [isLoadingPublishedSite, setIsLoadingPublishedSite] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [invoiceCustomerName, setInvoiceCustomerName] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [showDomainDns, setShowDomainDns] = useState(false);
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [connectedDomain, setConnectedDomain] = useState('');
  const [customDomainHosting, setCustomDomainHosting] = useState<CustomDomainHosting | null>(null);
  const [isSavingCustomDomain, setIsSavingCustomDomain] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSavedPublishedEdits(loadSavedPublishedEdits());
    }, 0);
    return () => window.clearTimeout(id);
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

  const domainTarget = process.env.NEXT_PUBLIC_DOMAIN_CNAME_TARGET || 'onepersonempire.web.app';
  const domainExample = connectedDomain || customDomainInput.trim() || 'yourdomain.com';
  const domainSetupInstructions = buildDomainSetupInstructions(domainExample, domainTarget);
  const paymentSetupScript = PAYMENT_SETUP_SCRIPT;

  const buildEditLinkBackupMessageForSite = () => buildEditLinkBackupMessage({
    slug: publishSlug,
    publishedUrl,
    siteEditUrl,
  });

  const parseEditLinkCredentialsForSite = () => parseEditLinkCredentials(siteEditUrl, publishSlug);

  const prefillEditLinkBackupContacts = () => {
    const memory = businessMemoryRef.current;
    if (memory.phone.trim()) setEditLinkBackupPhone(memory.phone);
    if (memory.email.trim()) setEditLinkBackupEmail(memory.email);
  };

  const applyPublishedSiteToBuilder = (data: PublishedSitePayload) => {
    const prepared = preparePublishedHtmlForEditor(data.html);
    setAgent3(prepared);
    agent3Ref.current = prepared;

    if (data.idea?.trim()) {
      setIdea(data.idea);
      ideaRef.current = data.idea;
    }

    setPublishSlug(data.slug);
    setPublishedUrl(data.url);
    setSiteEditUrl(buildEditUrl(data.slug, data.editToken));
    prefillEditLinkBackupContacts();
    setPublishStatus(formatPublishedSiteLoadedStatus(data.updatedAt));
    savePublishedEditAccess({
      slug: data.slug,
      editToken: data.editToken,
      publishedUrl: data.url,
      savedAt: new Date().toISOString(),
    });
    setSavedPublishedEdits(loadSavedPublishedEdits());
    setRenderKey((key) => key + 1);
    setIsEditingPreview(true);
    setShowEditHint(true);
    setShowChoiceBar(false);
    setCleanBrief(null);
    setActiveAddon('none');
    setAiCopyRewriteCount(0);
    setAiSiteRewriteCount(0);
    setAiImageGenerationCount(0);
  };

  const loadPublishedSiteForEditing = async (slugInput: string, keyInput: string) => {
    const slug = parsePublishedSiteSlug(slugInput);
    const key = keyInput.trim();
    if (!slug || !key) {
      showToast('Missing info', 'Enter your site name or live link, plus your private edit key.', 'error');
      return;
    }

    setIsLoadingPublishedSite(true);
    try {
      const res = await fetch(`/api/published-site?slug=${encodeURIComponent(slug)}&key=${encodeURIComponent(key)}`);
      const data = await readApiResponse(res);
      if (!res.ok || data.error || !data.html) {
        showToast('Could not load site', String(data.error || 'Published site not found.'), 'error');
        return;
      }

      applyPublishedSiteToBuilder({
        slug: String(data.slug || slug),
        html: String(data.html),
        idea: typeof data.idea === 'string' ? data.idea : undefined,
        url: String(data.url || ''),
        editToken: key,
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
      });
      setActiveAddon('launch');
      showToast(
        'Site loaded',
        `Opened "${String(data.slug || slug)}" for editing. This replaces whatever you were building. Republish when you are done.`,
        'success',
      );
    } catch (error) {
      showToast('Could not load site', error instanceof Error ? error.message : 'Could not load published site.', 'error');
    } finally {
      setIsLoadingPublishedSite(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('edit');
    const key = params.get('key');
    if (!slug || !key) return;

    const timeoutId = window.setTimeout(() => {
      void loadPublishedSiteForEditing(slug, key);
      window.history.replaceState({}, '', window.location.pathname);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publishCurrentSite = async () => {
    const html = stripMarkdownHtmlFences(agent3Ref.current);
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
      if (data.editToken) {
        const token = String(data.editToken);
        setSiteEditUrl(String(data.editUrl || buildEditUrl(String(data.slug || slug), token)));
        savePublishedEditAccess({
          slug: String(data.slug || slug),
          editToken: token,
          publishedUrl: String(data.url),
          savedAt: new Date().toISOString(),
        });
        setSavedPublishedEdits(loadSavedPublishedEdits());
        prefillEditLinkBackupContacts();
      }
      setPublishStatus(formatPublishSuccessStatus({
        assetCount: Number(data.assetCount) || 0,
        chunkCount: Number(data.chunkCount) || 0,
        needsSafetyReview: (data.safetyReview as { status?: string } | undefined)?.status === 'needs_review',
      }));
      setActiveAddon('launch');
      if (data.editToken) {
        const editLink = String(data.editUrl || buildEditUrl(String(data.slug || slug), String(data.editToken)));
        await copyText(
          editLink,
          'Published — edit link copied',
          `Live site: ${String(data.url)}. Your private edit link is also on the Launch tab and above the preview.`,
        );
      } else {
        showToast('Published', `Your live site is ready at ${String(data.url)}`, 'success');
      }
    } catch (error) {
      showToast('Publish failed', error instanceof Error ? error.message : 'Publish failed', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const textEditLinkToSelf = async () => {
    if (!siteEditUrl) return;
    const phone = editLinkBackupPhone.trim();
    if (!phone) {
      showToast('Phone needed', 'Enter the phone number where you want the edit link texted.', 'error');
      return;
    }

    const credentials = parseEditLinkCredentialsForSite();
    const message = buildEditLinkBackupMessageForSite();
    setIsSendingEditLinkBackup(true);

    try {
      if (credentials) {
        const res = await fetch('/api/send-edit-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: credentials.slug,
            key: credentials.key,
            phone,
            editUrl: siteEditUrl,
          }),
        });
        const data = await readApiResponse(res);
        if (res.ok && data.sent) {
          showToast('Edit link texted', 'Check your phone for the private edit link backup.', 'success');
          return;
        }
      }

      openSmsComposer(message);
      showToast('Messages app opening', 'Your phone will draft a text with the edit link. Tap send to back it up.', 'success');
    } catch (error) {
      openSmsComposer(message);
      showToast('Messages app opening', error instanceof Error ? error.message : 'Opened your messages app with the edit link.', 'info');
    } finally {
      setIsSendingEditLinkBackup(false);
    }
  };

  const emailEditLinkToSelf = () => {
    if (!siteEditUrl) return;
    const email = editLinkBackupEmail.trim();
    if (!email) {
      showToast('Email needed', 'Enter the email where you want the edit link sent.', 'error');
      return;
    }

    const slug = publishSlug || parsePublishedSiteSlug(publishedUrl) || 'your site';
    openEmailComposer(email, `Edit link for ${slug}`, buildEditLinkBackupMessageForSite());
    showToast('Email app opening', 'Your email app will open with the private edit link ready to send to yourself.', 'success');
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
        ? data.hosting as CustomDomainHosting
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

  const clearPublishState = () => {
    setPublishedUrl('');
    setPublishStatus('');
    setPublishSlug('');
    setSiteEditUrl('');
    setInvoiceUrl('');
  };

  return {
    publishSlug,
    setPublishSlug,
    publishedUrl,
    setPublishedUrl,
    publishStatus,
    setPublishStatus,
    siteEditUrl,
    setSiteEditUrl,
    editLinkBackupPhone,
    setEditLinkBackupPhone,
    editLinkBackupEmail,
    setEditLinkBackupEmail,
    isSendingEditLinkBackup,
    editSiteSlugInput,
    setEditSiteSlugInput,
    editSiteKeyInput,
    setEditSiteKeyInput,
    savedPublishedEdits,
    setSavedPublishedEdits,
    isLoadingPublishedSite,
    isPublishing,
    invoiceCustomerName,
    setInvoiceCustomerName,
    invoiceAmount,
    setInvoiceAmount,
    invoiceDescription,
    setInvoiceDescription,
    invoiceUrl,
    setInvoiceUrl,
    isCreatingInvoice,
    showDomainDns,
    setShowDomainDns,
    customDomainInput,
    setCustomDomainInput,
    connectedDomain,
    customDomainHosting,
    isSavingCustomDomain,
    domainTarget,
    domainExample,
    domainSetupInstructions,
    paymentSetupScript,
    loadPublishedSiteForEditing,
    publishCurrentSite,
    textEditLinkToSelf,
    emailEditLinkToSelf,
    saveCustomDomain,
    createManualInvoice,
    clearPublishState,
    prefillEditLinkBackupContacts,
  };
}
