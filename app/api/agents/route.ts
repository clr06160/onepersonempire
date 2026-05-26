// app/api/agents/route.ts   ← ORIGINAL VERSION (hardcoded)
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { idea } = await req.json();
    const html = `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-zinc-950 text-white font-sans">
  <div class="max-w-5xl mx-auto p-10">
    <h1 data-ai-text-id="main-title" class="text-6xl font-bold text-center mb-6 cursor-pointer hover:text-purple-400 transition-colors">
      Your OnePerson Empire
    </h1>
    <p data-ai-text-id="subtitle" class="text-center text-gray-400 mb-12 cursor-pointer hover:text-purple-400 transition-colors">
      ${idea}
    </p>
    <img data-ai-editable="true" data-image-index="0" src="https://picsum.photos/1200/630?random=1" class="w-full rounded-3xl mb-12 cursor-pointer hover:opacity-80 transition-opacity" />
    <img data-ai-editable="true" data-image-index="1" src="https://picsum.photos/1200/630?random=2" class="w-full rounded-3xl mb-12 cursor-pointer hover:opacity-80 transition-opacity" />

    <script>
      document.addEventListener('DOMContentLoaded', () => {
        // Image listener
        document.querySelectorAll('img[data-ai-editable]').forEach(img => {
          img.addEventListener('click', e => {
            e.stopImmediatePropagation();
            const instruction = prompt('✏️ What should this image show?');
            if (instruction) {
              window.parent.postMessage({ type: 'EDIT_IMAGE', imageIndex: parseInt(img.getAttribute('data-image-index')), instruction }, '*');
            }
          });
        });
        // Text listener (Opens Modal)
        document.querySelectorAll('[data-ai-text-id]').forEach(el => {
          el.addEventListener('click', e => {
            e.stopImmediatePropagation();
            window.parent.postMessage({ 
              type: 'OPEN_TEXT_MODAL', 
              textId: el.getAttribute('data-ai-text-id'), 
              currentText: el.innerText 
            }, '*');
          });
        });
      });
    </script>
  </div>
</body>
</html>`;
    return NextResponse.json({ agent3: html });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}