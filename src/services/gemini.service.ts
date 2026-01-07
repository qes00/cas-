import { Injectable } from '@angular/core';
import { GoogleGenAI } from "@google/genai";

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  
  async generateProductDescription(name: string, attributes: string): Promise<string> {
    const apiKey = process.env['API_KEY'];
    if (!apiKey) return "API Key missing. Enter manually.";

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const prompt = `Write a short, catchy, professional retail product description (max 2 sentences) for a product named "${name}" with these attributes: ${attributes}. Do not include markdown.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      return response.text.trim();
    } catch (error) {
      console.error('Gemini Error', error);
      return "Could not generate description.";
    }
  }
}