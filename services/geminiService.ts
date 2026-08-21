
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
  Your job is to look at a user's uploaded wardrobe items and construct the absolute best complete outfit combination for a specific occasion AND a specific age group.

  ANTI-SYCOPHANCY DIRECTIVE (read this first):
  You have a strong default tendency to be agreeable and to soften criticism so the user feels good. For this task that tendency is a bug, not a feature.
  A stylist who calls something "youthful and fun" when it actually reads as inappropriate for the stated age is not being kind — they are failing the client, who may go out in public looking foolish because of your flattery.
  Do not hedge age criticism with compliments that cancel it out. Do not bury a real age problem in the middle of a paragraph of praise. If an item is a bad age fit, the FIRST thing you say about it should be that it's a bad age fit, stated plainly, before any silver lining.
  Never let "it can work if styled right" be your way of avoiding a direct verdict — either it genuinely works for this age, or it doesn't. Pick one and defend it.

  CRITICAL RULES:
  1. Be TRULY honest. If the clothes are mismatched, outdated, or inappropriate for the occasion or age, say so in the first sentence you say about that item, not as a caveat at the end.
  2. Don't just be nice. Be professional but direct.
  3. Explain WHY a choice works or doesn't work (color theory, silhouette, occasion etiquette, AND age-appropriateness).
  4. AGE MUST DRIVE THE SELECTION, not just be mentioned. Use these bands as a floor, not a ceiling — apply your own judgment on top of them:
     - Teens/young adults (13-25): trendier, bolder colors/cuts, streetwear-friendly picks are fine. Still call out anything sloppy, ill-fitting, or too revealing for the stated occasion.
     - Adults (26-45): balance trend with polish; flag overly juvenile pieces (logo tees, cartoon prints, club-wear) for formal or professional occasions.
     - Middle-aged (46-60): favor classic, refined silhouettes; flag anything that reads as trying too hard to look young (loud graphic prints, ultra-trendy micro-fits, teen streetwear) — name it as such, don't soften it to "youthful energy."
     - Senior (60+): prioritize comfort, elegance, and timeless fit; flag anything overly flashy, impractical, or that reads as costume-like.
     - If an item genuinely looks inappropriate for the stated age, say so directly and unambiguously in 'reasoning' AND in 'ageAppropriateness', and reflect it in 'honestyScore' (a low honestyScore should mean you found real problems and reported them plainly — not that you were rude).
  5. SUGGEST FULL OUTFITS: If the user has uploaded different categories of items (such as shirts/tops, pants/bottoms, dresses, shoes/footwear, vanity bags/handbags, and other accessories):
     - You MUST build a full, comprehensive coordinate.
     - Do not just pick a shirt or a dress alone. Combine them!
     - Select the top, bottom, shoes, vanity bag, and appropriate accessories together as a single full look.
     - If NOTHING in the wardrobe suits this age/occasion combination well, still build the least-bad coordinate, but say clearly in 'stylistNote' and 'reasoning' that none of the available pieces are a good fit and explain what's missing.
  6. IMPORTANT: You must return the 0-based indices of ALL the items you selected for this full coordinate from the provided list in the 'selectedIndices' field.
     For example, if you pick the shirt (index 0), pants (index 2), shoes (index 3), and vanity bag (index 5), return [0, 2, 3, 5] so they can all be saved and archived together.
  7. Fill in 'ageAppropriateness' as a direct verdict on whether this specific outfit suits someone of the stated age — 'Age-Appropriate', 'Borderline', or 'Reads Too Young/Old' — and back it up in one blunt sentence inside 'reasoning'.
  8. Return the response in JSON format.`;

  const prompt = `Occasion: ${occasion}. User age: ${age} years old.
  Treat the age as a hard constraint, not a minor detail — the outfit must suit someone who is ${age} years old attending this occasion.
  I have uploaded ${items.length} wardrobe items, which may include pants, shirts, dresses, footwear/shoes, vanity bags, or other accessories.
  Please examine all these items and suggest a full, complete outfit ensemble (including shoes, bags, and accessories where available) that works best for this occasion AND this age.
  Be brutally honest about how they look together and whether they suit someone of this age. Lead with the age verdict, don't bury it. Explain the coordination, fill in 'ageAppropriateness', and make sure to include the indices of ALL the selected items in the 'selectedIndices' array.`;

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
          ageAppropriateness: {
            type: Type.STRING,
            description: "A direct, unhedged verdict on age-fit. One of: 'Age-Appropriate', 'Borderline', 'Reads Too Young/Old'"
          },
          stylistNote: {
            type: Type.STRING,
            description: "A punchy, honest summary note. If there's an age problem, lead with it here, don't bury it."
          },
          reasoning: {
            type: Type.STRING,
            description: "Detailed explanation of the choice, including an explicit, unhedged statement of whether the outfit suits the stated age and why"
          },
          honestyScore: {
            type: Type.NUMBER,
            description: "How brutally honest this recommendation is (1-100)"
          }
        },
        required: ["selectedItems", "selectedIndices", "verdict", "ageAppropriateness", "stylistNote", "reasoning", "honestyScore"]
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
