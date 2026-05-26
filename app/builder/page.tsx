// app/builder/page.tsx   ← NEW BUILDER (original page.tsx stays untouched)
'use client';
import { useState, useEffect } from 'react';

export default function Builder() {
  const [idea, setIdea] = useState('');
  const [agent3, setAgent3] = useState('');
  const [loading, setLoading] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  // Choice bar state
  const [showChoiceBar, setShowChoiceBar] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [activeTextId, setActiveTextId] = useState('');
  const [modalText, setModalText] = useState('');
  const [stripeUrl, setStripeUrl] = useState('');
  const [isStripeModal, setIsStripeModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'EDIT_IMAGE') {
        const { imageIndex, instruction } = event.data;
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: instruction }),
        });
        const data = await res.json();
        if (data.success) {
          const regex = new RegExp('(data-image-index="' + imageIndex + '"[^>]*src=")([^"]*)(")');
          setAgent3(prev => prev.replace(regex, '$1' + data.dataUrl + '$3'));
          setRenderKey(prev => prev + 1);
        }
      }

      if (event.data?.type === 'OPEN_TEXT_MODAL') {
        setActiveTextId(event.data.textId);
        setModalText(event.data.currentText || '');
        if (event.data.textId === 'stripe-payment-button') {
          setIsStripeModal(true);
          setStripeUrl(event.data.currentLink || '');
        } else {
          setIsStripeModal(false);
        }
        setModalOpen(true);
      }

      if (event.data?.type === 'OPEN_STRIPE_MODAL') {
        setActiveTextId(event.data.textId);
        setModalText(event.data.currentText || 'Buy Now');
        setStripeUrl(event.data.currentLink || '');
        setIsStripeModal(true);
        setModalOpen(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleManualSave = () => {
    const isStripe = isStripeModal || activeTextId === 'stripe-payment-button';
    let updated = agent3;

    if (isStripe) {
      const textRegex = new RegExp(`(data-ai-text-id="${activeTextId}"[^>]*>)(.*?)(</button>)`, 'is');
      updated = updated.replace(textRegex, `$1${modalText}$3`);

      const linkAttrRegex = new RegExp(`(data-ai-text-id="${activeTextId}"[^>]*?)(data-stripe-link="[^"]*")?`, 'i');
      updated = updated.replace(linkAttrRegex, `$1data-stripe-link="${stripeUrl}"`);
    } else {
      const regex = new RegExp('(data-ai-text-id="' + activeTextId + '"[^>]*>)(.*?)(<\\/)', 'gs');
      updated = updated.replace(regex, '$1' + modalText + '$3');
    }

    setAgent3(updated);
    setRenderKey(prev => prev + 1);
    setModalOpen(false);
  };

  const handleAISave = async () => {
    setIsGenerating(true);
    const prompt = (isStripeModal || activeTextId === 'stripe-payment-button')
      ? `Return ONLY 2-4 words. Create a short, powerful, high-converting call-to-action for a buy button. 
Examples: "Buy Now", "Get Started", "Claim Offer", "Start Today", "Secure Access", "Purchase Now", "Get Instant Access".`
      : "Rewrite this text to be short, persuasive, and professional. Return ONLY the text: " + modalText;
      
    const res = await fetch('/api/generate-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (data.success) {
      let cleanText = data.text.replace(/['"]/g, '').trim();
      if (cleanText.split(' ').length > 4) cleanText = cleanText.split(' ').slice(0, 3).join(' ');
      setModalText(cleanText);
    }
    setIsGenerating(false);
  };

  const testPaymentLink = () => {
    let link = stripeUrl.trim();
    if (link && !link.startsWith('http')) link = 'https://' + link;
    if (link) window.open(link, '_blank');
  };

  const cleanHTML = (html: string) => {
    if (!html) return '';
    const backticks = String.fromCharCode(96, 96, 96);
    return html.split(backticks + 'html').join('').split(backticks).join('').trim();
  };

  // Generate single-page (first step)
  const handleGenerate = async () => {
    if (!idea.trim()) return;
    setLoading(true);
    setShowChoiceBar(false);

    const res = await fetch('/api/agents', { 
      method: 'POST', 
      body: JSON.stringify({ idea }), 
      headers: {'Content-Type': 'application/json'} 
    });
    const data = await res.json();

    setAgent3(data.agent3);
    setShowChoiceBar(true);
    setLoading(false);
  };

  // Expand to multi-page
  const handleExpandToMultiPage = async () => {
    setLoading(true);
    const res = await fetch('/api/agents', { 
      method: 'POST', 
      body: JSON.stringify({ 
        idea, 
        mode: 'expand',
        originalHtml: agent3 
      }), 
      headers: {'Content-Type': 'application/json'} 
    });
    const data = await res.json();

    setAgent3(data.agent3);
    setShowChoiceBar(false);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Premium header */}
      <div className="border-b border-zinc-800 bg-black">
        <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-x-3">
            <div className="w-9 h-9 bg-emerald-500 rounded-2xl flex items-center justify-center text-white font-bold text-2xl">👑</div>
            <h1 className="text-4xl font-bold tracking-tighter">OnePerson Empire Builder</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Beautiful input area */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-x-2 bg-zinc-900 border border-zinc-700 text-emerald-400 text-sm font-medium px-6 py-3 rounded-3xl mb-6">
            ✨ Industry-smart • One-page or full multi-page
          </div>
          <h2 className="text-6xl font-bold tracking-tighter leading-none mb-4">
            Turn your idea into a <span className="text-emerald-400">stunning website</span>
          </h2>
          <p className="text-xl text-zinc-400 max-w-md mx-auto">
            Describe your business once. Get a beautiful single-page site instantly — then expand to a full professional website with one click.
          </p>

          <textarea
            className="w-full h-40 mt-12 bg-zinc-900 border border-zinc-700 focus:border-emerald-400 rounded-3xl p-8 text-lg placeholder-zinc-500 resize-none shadow-2xl shadow-black/50"
            placeholder="Example: Premium coffee subscription box for busy professionals in Utah..."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />

          <button 
            onClick={handleGenerate}
            disabled={loading || !idea.trim()}
            className="mt-8 w-full max-w-md mx-auto bg-white text-black py-7 text-3xl font-semibold rounded-3xl hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-emerald-500/20 flex items-center justify-center gap-x-4 disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full"></span>
                Building your empire…
              </>
            ) : (
              <>Launch My Empire →</>
            )}
          </button>
        </div>

        {/* Preview + choice bar */}
        {agent3 && (
          <div className="mt-8 border border-zinc-700 bg-white rounded-3xl overflow-hidden shadow-2xl">
            {/* Exact choice bar you wanted */}
            {showChoiceBar && (
              <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 border-b border-zinc-700 px-8 py-6 flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-x-3 text-emerald-400">
                    <span className="text-3xl">🎉</span>
                    <p className="font-semibold text-xl">Great start!</p>
                  </div>
                  <p className="text-white text-2xl font-semibold mt-1">
                    This is a clean, high-converting single-page website.
                  </p>
                  <p className="text-zinc-400 mt-1">What would you like to do next?</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                  <button
                    onClick={() => setShowChoiceBar(false)}
                    className="px-10 py-5 bg-zinc-800 hover:bg-zinc-700 rounded-3xl font-semibold text-lg transition-all active:scale-95"
                  >
                    Keep as One-Page
                  </button>
                  <button
                    onClick={handleExpandToMultiPage}
                    disabled={loading}
                    className="px-10 py-5 bg-white text-black hover:bg-emerald-100 rounded-3xl font-semibold text-lg flex items-center gap-x-3 transition-all active:scale-95 shadow-xl"
                  >
                    {loading ? 'Expanding…' : 'Expand to Multi-Page Site →'}
                  </button>
                </div>
              </div>
            )}

            <iframe 
              key={renderKey} 
              srcDoc={cleanHTML(agent3)} 
              className="w-full h-[720px] border-0"
              title="Website Preview"
            />
          </div>
        )}

        {agent3 && !showChoiceBar && (
          <div className="mt-8 text-center text-zinc-500 text-sm flex items-center justify-center gap-x-2">
            <span className="bg-zinc-900 px-4 py-2 rounded-3xl border border-zinc-700">✓ Image editing • Text editing • Payment button still work</span>
          </div>
        )}
      </div>

      {/* Modal (exactly the same as before) */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-700 w-full max-w-lg shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">
              {(isStripeModal || activeTextId === 'stripe-payment-button') 
                ? "Configure Payment Button" 
                : "Edit Content"}
            </h2>
            
            {(isStripeModal || activeTextId === 'stripe-payment-button') ? (
              <div className="space-y-4">
                <input className="w-full p-4 bg-black rounded-xl border border-zinc-700" placeholder="Button Text" value={modalText} onChange={(e) => setModalText(e.target.value)} />
                <input className="w-full p-4 bg-black rounded-xl border border-zinc-700" placeholder="Stripe Payment Link" value={stripeUrl} onChange={(e) => setStripeUrl(e.target.value)} />
                <button onClick={testPaymentLink} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-white">🚀 Test Payment Link</button>
              </div>
            ) : (
              <textarea className="w-full h-32 bg-black p-4 rounded-xl border border-zinc-700 mb-6" value={modalText} onChange={(e) => setModalText(e.target.value)} />
            )}

            <div className="flex gap-4 mt-8">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-3 bg-zinc-800 rounded-xl">Cancel</button>
              <button onClick={handleManualSave} className="flex-1 py-3 bg-zinc-700 rounded-xl font-bold">Save</button>
              <button onClick={handleAISave} className="flex-1 py-3 bg-purple-600 rounded-xl font-bold">{isGenerating ? "..." : "✨ AI Rewrite"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}