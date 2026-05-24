'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [idea, setIdea] = useState('');
  const [agent3, setAgent3] = useState('');
  const [loading, setLoading] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTextId, setActiveTextId] = useState('');
  const [modalText, setModalText] = useState('');
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
        setModalText(event.data.currentText);
        setModalOpen(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleManualSave = () => {
    const regex = new RegExp('(data-ai-text-id="' + activeTextId + '"[^>]*>)(.*?)(<\\/)', 'gs');
    setAgent3(prev => prev.replace(regex, '$1' + modalText + '$3'));
    setRenderKey(prev => prev + 1);
    setModalOpen(false);
  };

  const handleAISave = async () => {
    setIsGenerating(true);
    const res = await fetch('/api/generate-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: modalText }),
    });
    const data = await res.json();
    if (data.success) {
      const regex = new RegExp('(data-ai-text-id="' + activeTextId + '"[^>]*>)(.*?)(<\\/)', 'gs');
      setAgent3(prev => prev.replace(regex, '$1' + data.text + '$3'));
      setRenderKey(prev => prev + 1);
      setModalOpen(false);
    }
    setIsGenerating(false);
  };

  const cleanHTML = (html: string) => {
    if (!html) return '';
    const backticks = String.fromCharCode(96, 96, 96);
    return html.split(backticks + 'html').join('').split(backticks).join('').trim();
  };

  return (
    <main className="min-h-screen bg-black text-white py-12">
      <div className="max-w-5xl mx-auto px-6">
        <h1 className="text-7xl font-bold text-center mb-2">OnePerson Empire</h1>
        <textarea
          className="w-full h-32 bg-zinc-900 border border-zinc-700 rounded-3xl p-8 mb-4 focus:outline-none focus:border-purple-500"
          placeholder="Describe your business idea..."
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />
        <button onClick={async () => {
          setLoading(true);
          const res = await fetch('/api/agents', { method: 'POST', body: JSON.stringify({ idea }), headers: {'Content-Type': 'application/json'} });
          const data = await res.json();
          setAgent3(data.agent3);
          setLoading(false);
        }} className="w-full bg-white text-black py-7 text-2xl font-semibold rounded-3xl">
          {loading ? "Building..." : "Launch My Empire →"}
        </button>

        {agent3 && (
          <div className="mt-12 border border-zinc-800 rounded-3xl overflow-hidden bg-white">
            <iframe key={renderKey} srcDoc={cleanHTML(agent3)} className="w-full h-[700px] border-0" />
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-700 w-full max-w-lg shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">Edit Content</h2>
            <textarea className="w-full h-32 bg-black p-4 rounded-xl border border-zinc-700 mb-6" value={modalText} onChange={(e) => setModalText(e.target.value)} />
            <div className="flex gap-4">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-3 bg-zinc-800 rounded-xl">Cancel</button>
              <button onClick={handleManualSave} className="flex-1 py-3 bg-zinc-700 rounded-xl">Save</button>
              <button onClick={handleAISave} className="flex-1 py-3 bg-purple-600 rounded-xl font-bold">
                {isGenerating ? "Generating..." : "✨ AI Rewrite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}