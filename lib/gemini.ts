import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const textModel = genAI.getGenerativeModel({ 
  model: 'gemini-3.5-flash',
  generationConfig: { temperature: 0.0 }
});

export const imageModel = genAI.getGenerativeModel({ 
  model: 'gemini-2.5-flash-image'
});