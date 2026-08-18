
export type WardrobeCategory = 'Tops' | 'Bottoms' | 'Footwear' | 'Dresses' | 'Accessories' | 'Bags' | 'Uncategorized';

export interface WardrobeItem {
  id: string;
  url: string;
  base64: string;
  mimeType: string;
  category?: WardrobeCategory;
}

export interface StylistRecommendation {
  selectedItems: string[]; // descriptions
  selectedIndices: number[]; // 0-based indices of the items in the input array
  verdict: 'Perfect Match' | 'Safe Choice' | 'Better Options Needed' | 'Fashion Faux Pas';
  ageAppropriateness: 'Age-Appropriate' | 'Borderline' | 'Reads Too Young/Old';
  stylistNote: string;
  reasoning: string;
  honestyScore: number; // 1-100
}

export interface SavedOutfit {
  id: string;
  timestamp: number;
  occasion: string;
  recommendation: StylistRecommendation;
  images: string[]; // URLs or base64 thumbnails
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT',
  ARCHIVE = 'ARCHIVE',
  WARDROBE = 'WARDROBE'
}
