
import { GoogleGenAI, Type } from "@google/genai";
import { WardrobeItem, StylistRecommendation } from "../types";

// Always use a named parameter for apiKey and assume process.env.API_KEY is pre-configured.
console.log(import.meta.env.VITE_GEMINI_API_KEY)
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export const analyzeOutfits = async (
  items: WardrobeItem[],
  occasion: string,
  age: string
): Promise<StylistRecommendation> => {
  // Use gemini-3.5-flash for complex styling and multi-modal reasoning tasks.
  const model = 'gemini-3.5-flash';

  const imageParts = items.map(item => ({
    inlineData: {
      data: item.base64,
      mimeType: item.mimeType
    }
  }));

  const systemInstruction = `You are a world-class, brutally honest personal stylist. 
  Your job is to look at a user's uploaded wardrobe items and construct the absolute best complete outfit combination for a specific occasion. 
  
  CRITICAL RULES:
  1. Be TRULY honest. If the clothes are mismatched, outdated, or inappropriate for the occasion, say so.
  2. Don't just be nice. Be professional but direct.
  3. Explain WHY a choice works or doesn't work (color theory, silhouette, occasion etiquette).
  4. SUGGEST FULL OUTFITS: If the user has uploaded different categories of items (such as shirts/tops, pants/bottoms, dresses, shoes/footwear, vanity bags/handbags, and other accessories):
     - You MUST build a full, comprehensive coordinate.
     - Do not just pick a shirt or a dress alone. Combine them!
     - Select the top, bottom, shoes, vanity bag, and appropriate accessories together as a single full look.
     - If both male/female or different styles of items are present, select a cohesive outfit matching the requested occasion.
  5. IMPORTANT: You must return the 0-based indices of ALL the items you selected for this full coordinate from the provided list in the 'selectedIndices' field. 
     For example, if you pick the shirt (index 0), pants (index 2), shoes (index 3), and vanity bag (index 5), return [0, 2, 3, 5] so they can all be saved and archived together.
  6. Return the response in JSON format.`;

  const prompt = `Occasion: ${occasion}. User age: ${age}. 
  I have uploaded ${items.length} wardrobe items, which may include pants, shirts, dresses, footwear/shoes, vanity bags, or other accessories. 
  Please examine all these items and suggest a full, complete outfit ensemble (including shoes, bags, and accessories where available) that works best for this occasion. 
  Be brutally honest about how they look together, explain the coordination, and make sure to include the indices of ALL the selected items in the 'selectedIndices' array.`;

  // Use ai.models.generateContent with a content object containing parts when sending text and images.
  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [
        ...imageParts,
        { text: prompt }
      ]
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          selectedItems: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of descriptions of selected items"
          },
          selectedIndices: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: "The 0-based indices of the selected items from the input wardrobe list"
          },
          verdict: {
            type: Type.STRING,
            description: "One of: 'Perfect Match', 'Safe Choice', 'Better Options Needed', 'Fashion Faux Pas'"
          },
          stylistNote: {
            type: Type.STRING,
            description: "A punchy, honest summary note"
          },
          reasoning: {
            type: Type.STRING,
            description: "Detailed explanation of the choice"
          },
          honestyScore: {
            type: Type.NUMBER,
            description: "How brutally honest this recommendation is (1-100)"
          }
        },
        required: ["selectedItems", "selectedIndices", "verdict", "stylistNote", "reasoning", "honestyScore"]
      }
    }
  });

  try {
    // Access the generated text directly from the response.text property.
    const result = JSON.parse(response.text || '{}');
    return result as StylistRecommendation;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("The stylist is speechless. Please try again.");
  }
};

/**
 * Upscales and enhances a single wardrobe item image using gemini-2.5-flash-image.
 */
export const upscaleImage = async (item: WardrobeItem): Promise<string> => {
  const model = 'gemini-2.5-flash-image';
  
  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [
        {
          inlineData: {
            data: item.base64,
            mimeType: item.mimeType,
          },
        },
        {
          text: "Upscale and enhance this clothing item. Maintain the exact color, pattern, and shape, but make it look professional, sharp, and high-resolution (1024x1024). Remove any cluttered background to focus only on the garment.",
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "3:4",
      }
    }
  });

  // Find the image part in the response
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return part.inlineData.data; // Return base64 string
    }
  }

  throw new Error("Failed to upscale image. No image data returned.");
};
