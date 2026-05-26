// components/stripebutton.tsx   ← FULL UPDATED COMPONENT (if you still use it separately)
'use client';

import { useState } from 'react';

interface StripeButtonProps {
  initialText?: string;
  initialLink?: string;
  onSave: (link: string) => void;
}

export default function StripeButton({ initialText = "Buy Now", initialLink = "", onSave }: StripeButtonProps) {
  const [text, setText] = useState(initialText);
  const [link, setLink] = useState(initialLink);
  const [modalOpen, setModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAISave = async () => {
    setIsGenerating(true);
    const prompt = `Return ONLY 2-4 words. Create a short, powerful, high-converting call-to-action for a buy button. 
Examples: "Buy Now", "Get Started", "Claim Offer", "Start Today", "Secure Access", "Purchase Now", "Get Instant Access".
No explanations. No full sentences. Just the button text.`;

    const res = await fetch('/api/generate-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (data.success) {
      let cleanText = data.text.replace(/['"]/g, '').trim();
      if (cleanText.split(' ').length > 4) {
        cleanText = cleanText.split(' ').slice(0, 3).join(' ');
      }
      setText(cleanText);
    }
    setIsGenerating(false);
  };

  return (
    <>
      <button 
        onClick={() => setModalOpen(true)}
        style={{
          background: "#059669", 
          padding: "22px 48px", 
          color: "white", 
          borderRadius: "16px", 
          border: "none", 
          fontSize: "22px", 
          fontWeight: "bold", 
          cursor: "pointer",
          boxShadow: "0 10px 15px -3px rgb(5 150 105)",
          transition: "all 0.2s"
        }}
      >
        {text}
      </button>

      {modalOpen && (
        <div style={{
          position: "fixed", 
          inset: 0, 
          background: "rgba(0,0,0,0.8)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          zIndex: 9999
        }}>
          <div style={{
            background: "#18181b", 
            padding: "32px", 
            borderRadius: "24px", 
            width: "400px", 
            border: "1px solid #3f3f46"
          }}>
            <h2 style={{fontSize: "20px", marginBottom: "16px"}}>Configure Payment Button</h2>
            
            <input 
              placeholder="Button Text" 
              value={text} 
              onChange={(e) => setText(e.target.value)} 
              style={{
                width: "100%", 
                padding: "12px", 
                marginBottom: "10px", 
                background: "black", 
                borderRadius: "8px",
                color: "white"
              }} 
            />
            
            <input 
              placeholder="Stripe Payment Link[](https://buy.stripe.com/...)" 
              value={link} 
              onChange={(e) => setLink(e.target.value)} 
              style={{
                width: "100%", 
                padding: "12px", 
                marginBottom: "20px", 
                background: "black", 
                borderRadius: "8px",
                color: "white"
              }} 
            />

            <div style={{display: "flex", gap: "10px"}}>
              <button 
                onClick={() => setModalOpen(false)} 
                style={{flex: 1, padding: "10px", borderRadius: "8px", background: "#27272a"}}
              >
                Cancel
              </button>
              <button 
                onClick={handleAISave} 
                style={{flex: 1, padding: "10px", borderRadius: "8px", background: "#7e22ce", fontWeight: "bold"}}
              >
                {isGenerating ? "..." : "✨ AI Rewrite"}
              </button>
              <button 
                onClick={() => { onSave(link); setModalOpen(false); }} 
                style={{flex: 1, padding: "10px", borderRadius: "8px", background: "#3f3f46"}}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}