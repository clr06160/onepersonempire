'use client';

import { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default function Home() {
  const [idea, setIdea] = useState('');
  const [agent1, setAgent1] = useState('');
  const [agent2, setAgent2] = useState('');
  const [agent3, setAgent3] = useState('');
  const [agent4, setAgent4] = useState('');
  const [loading, setLoading] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  const handleLaunch = async () => {
    if (!idea.trim()) return;
    setLoading(true);
    setAgent1(''); setAgent2(''); setAgent3(''); setAgent4('');

    try {
      const genAI = new GoogleGenerativeAI(apiKey!);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });   // ← FIXED

      // AGENT 1
      const prompt1 = `You are Agent 1 (Idea Validator) in OnePerson Empire.
Respond IMMEDIATELY with ONLY a short, exciting validation (2-3 sentences max).
Do NOT introduce yourself. Just answer: Is this a good idea? Who is the customer? How could it make money?

User idea: "${idea}"`;

      const result1 = await model.generateContent(prompt1);
      setAgent1(result1.response.text());

      // AGENT 2
      const prompt2 = `You are Agent 2 (Business Builder) in OnePerson Empire.
Use the original idea and Agent 1's validation to create a complete micro-business plan.
Respond ONLY with the plan using clear headings. No extra talk.

Original idea: "${idea}"
Agent 1 validation: "${result1.response.text()}"`;

      const result2 = await model.generateContent(prompt2);
      setAgent2(result2.response.text());

      // AGENT 3
      const prompt3 = `You are Agent 3 (Landing Page Generator) in OnePerson Empire.
Create a complete, beautiful, single-file HTML + Tailwind landing page.
Respond with ONLY the full HTML code. No explanations.

Business idea: "${idea}"
Business plan: "${result2.response.text()}"`;

      const result3 = await model.generateContent(prompt3);
      setAgent3(result3.response.text());

      // AGENT 4
      const prompt4 = `You are Agent 4 (Revenue & Launch Agent) in OnePerson Empire.
Create a complete launch kit:
1. Stripe Checkout button code (test mode)
2. Email capture form
3. 5 ready-to-post social media posts (X + LinkedIn)
4. One-click deploy instructions

Respond ONLY with the launch kit clearly labeled.

Idea: "${idea}"
Business plan: "${result2.response.text()}"`;

      const result4 = await model.generateContent(prompt4);
      setAgent4(result4.response.text());

    } catch (err: any) {
      console.error(err);
      setAgent1('Error: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="max-w-5xl mx-auto text-center px-6 py-12">
        <h1 className="text-7xl font-bold mb-4">OnePerson Empire</h1>
        <p className="text-3xl text-gray-400 mb-8">AI Co-Founder in a Box • 4-Agent Swarm</p>
        
        <textarea 
          className="w-full h-40 bg-zinc-900 border border-zinc-700 rounded-3xl p-6 text-lg placeholder-gray-500 focus:outline-none focus:border-white resize-none"
          placeholder="Describe your business idea in plain English..."
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />
        
        <button 
          onClick={handleLaunch}
          disabled={loading}
          className="mt-8 bg-white text-black px-12 py-6 rounded-3xl text-2xl font-semibold hover:bg-gray-200 transition-all w-full disabled:opacity-50"
        >
          {loading ? '4 agents building your empire…' : 'Launch My Empire →'}
        </button>

        {agent1 && <div className="mt-12 bg-zinc-900 border border-emerald-500 rounded-3xl p-8 text-left"><p className="text-emerald-400 text-sm mb-3">✅ Agent 1 — Idea Validator</p><p className="text-lg leading-relaxed">{agent1}</p></div>}
        {agent2 && <div className="mt-8 bg-zinc-900 border border-blue-500 rounded-3xl p-8 text-left"><p className="text-blue-400 text-sm mb-3">✅ Agent 2 — Business Builder</p><div className="text-lg whitespace-pre-wrap">{agent2}</div></div>}
        {agent3 && <div className="mt-8 bg-zinc-900 border border-purple-500 rounded-3xl p-8 text-left"><p className="text-purple-400 text-sm mb-3">✅ Agent 3 — Landing Page</p><pre className="bg-black p-6 rounded-2xl text-sm overflow-auto max-h-96 text-gray-300 whitespace-pre-wrap">{agent3}</pre></div>}
        {agent4 && <div className="mt-8 bg-zinc-900 border border-amber-500 rounded-3xl p-8 text-left"><p className="text-amber-400 text-sm mb-3">✅ Agent 4 — Revenue & Launch Kit</p><div className="text-lg whitespace-pre-wrap">{agent4}</div></div>}

        <p className="text-sm text-gray-500 mt-20">
          Powered by Gemini • 4-agent swarm live • Build with Gemini XPRIZE 2026
        </p>
      </div>
    </main>
  );
}