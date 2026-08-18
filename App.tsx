import { supabase } from './lib/supabaseClient'
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Sparkles, Wand2, RefreshCw, ChevronLeft, Bookmark, BookmarkCheck, History, X, Crop, Zap, Camera, Check, Tag, Filter } from 'lucide-react';
import { WardrobeItem, StylistRecommendation, AppState, SavedOutfit, WardrobeCategory } from './types';
import { analyzeOutfits, upscaleImage } from './services/geminiService';
import ImageEditor from './components/ImageEditor';
import Logo from './components/Logo';
import CameraModal from './components/CameraModal';





const IntroScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onComplete, 800); // Wait for fade out animation
    }, 2800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[1000] bg-white flex flex-col items-center justify-center transition-opacity duration-700 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
      <div className="flex flex-col items-center gap-8">
        <div className="animate-logo-reveal">
          <Logo size={120} className="text-black shadow-2xl rounded-full" />
        </div>
        
        <div className="flex flex-col items-center gap-3">
          <h1 className="font-serif text-5xl tracking-[0.05em] text-black animate-text-reveal">
            ChicVerdict
          </h1>
          <div className="h-[1px] bg-black animate-line-reveal"></div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-400 font-medium animate-text-reveal" style={{ animationDelay: '0.8s' }}>
            The AI Fashion House
          </p>
        </div>
      </div>
      
      <div className="absolute bottom-12 flex flex-col items-center gap-2">
         <p className="text-[9px] text-gray-300 uppercase tracking-widest font-bold">Refined Judgment</p>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [showIntro, setShowIntro] = useState(true);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [verdictionIds, setVerdictionIds] = useState<Set<string>>(new Set());
  const [analyzedItems, setAnalyzedItems] = useState<WardrobeItem[]>([]);
  const [upscalingIds, setUpscalingIds] = useState<Set<string>>(new Set());
  const [occasion, setOccasion] = useState('');
  const [age, setAge] = useState<string>('');
  const [status, setStatus] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<StylistRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [viewingSavedOutfit, setViewingSavedOutfit] = useState<SavedOutfit | null>(null);

  // State for individual item editing
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [pendingItems, setPendingItems] = useState<WardrobeItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredWardrobe = wardrobe.filter(item => {
    if (categoryFilter === 'All') return !item.category || item.category === 'Uncategorized';
    if (categoryFilter === 'Uncategorized') return !item.category || item.category === 'Uncategorized';
    return item.category === categoryFilter;
  });

  const categoriesList: { name: string; label: string }[] = [
    { name: 'All', label: 'All' },
    { name: 'Tops', label: 'Tops' },
    { name: 'Bottoms', label: 'Bottoms' },
    { name: 'Footwear', label: 'Footwear' },
    { name: 'Dresses', label: 'Dresses' },
    { name: 'Bags', label: 'Bags' },
    { name: 'Accessories', label: 'Accessories' },
    { name: 'Uncategorized', label: 'Uncategorized' }
  ];

  const getCategoryCount = (catName: string) => {
    if (catName === 'All') {
      return wardrobe.filter(item => !item.category || item.category === 'Uncategorized').length;
    }
    if (catName === 'Uncategorized') {
      return wardrobe.filter(item => !item.category || item.category === 'Uncategorized').length;
    }
    return wardrobe.filter(item => item.category === catName).length;
  };

  // Load saved outfits and wardrobe from localStorage on mount
  useEffect(() => {
    const storedArchive = localStorage.getItem('chic_verdict_archive');
    if (storedArchive) {
      try {
        setSavedOutfits(JSON.parse(storedArchive));
      } catch (e) {
        console.error("Failed to load archive", e);
      }
    }

    const storedWardrobe = localStorage.getItem('chic_verdict_wardrobe');
    if (storedWardrobe) {
      try {
        const parsed = JSON.parse(storedWardrobe) as WardrobeItem[];
        const updated = parsed.map(item => {
          if (item.base64 && !item.url) {
            try {
              const byteString = atob(item.base64);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              const blob = new Blob([ab], { type: item.mimeType || 'image/jpeg' });
              const url = URL.createObjectURL(blob);
              return { ...item, url };
            } catch (err) {
              console.error("Failed to restore image blob URL", err);
              return item;
            }
          }
          return item;
        });
        setWardrobe(updated);
        setVerdictionIds(new Set(updated.map(item => item.id)));
      } catch (e) {
        console.error("Failed to load wardrobe", e);
      }
    }
  }, []);

  
  useEffect(() => {
    async function loadWardrobe() {
      const { data, error } = await supabase.from('wardrobe_items').select('*');
      if (error) {
        console.error(error);
        return;
      }
      if (data) {
        const withUrls = data.map((item: any) => {
          if (item.base64) {
            try {
              const byteString = atob(item.base64);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              const blob = new Blob([ab], { type: item.mime_type || 'image/jpeg' });
              const url = URL.createObjectURL(blob);
              return { ...item, mimeType: item.mime_type, url };
            } catch (err) {
              console.error("Failed to build image URL", err);
              return item;
            }
          }
          return item;
        });
        setWardrobe(withUrls);
        setVerdictionIds(new Set(withUrls.map((item: any) => item.id)));
      }
    }
    loadWardrobe();
  }, []);

  useEffect(() => {
    async function loadSavedOutfits() {
      const { data, error } = await supabase.from('saved_outfits').select('*');
      if (error) {
        console.error('Failed to load saved outfits:', error);
        return;
      }
      if (data) {
        const formatted = data.map((row: any) => ({
          id: row.id,
          occasion: row.occasion,
          recommendation: row.recommendation,
          images: row.images,
          timestamp: new Date(row.created_at).getTime()
        }));
        setSavedOutfits(formatted);
      }
    }
    loadSavedOutfits();
  }, []);

  

  // Save to localStorage whenever savedOutfits changes
  useEffect(() => {
  try {
    localStorage.setItem('chic_verdict_archive', JSON.stringify(savedOutfits));
  } catch (e) {
    console.warn('localStorage quota hit, skipping archive cache', e);
  }
}, [savedOutfits]);

// Save to localStorage whenever wardrobe changes (metadata only — Supabase holds the images)
useEffect(() => {
  try {
    const toStore = wardrobe.map(({ id, category }) => ({ id, category }));
    localStorage.setItem('chic_verdict_wardrobe', JSON.stringify(toStore));
  } catch (e) {
    console.warn('localStorage quota hit, skipping wardrobe cache', e);
  }
}, [wardrobe]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileList = Array.from(files) as File[];
    
    const newItems: WardrobeItem[] = await Promise.all(
      fileList.map(async (file) => {
        const base64 = await fileToBase64(file);
        const url = URL.createObjectURL(file);
        return {
          id: Math.random().toString(36).substr(2, 9),
          url,
          base64,
          mimeType: file.type,
          category: 'Uncategorized'
        };
      })
    );

    setPendingItems(newItems);
    e.target.value = '';
  };

  const handleUpscale = async (item: WardrobeItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (upscalingIds.has(item.id)) return;

    setUpscalingIds(prev => new Set(prev).add(item.id));
    try {
      const upscaledBase64 = await upscaleImage(item);
      const byteString = atob(upscaledBase64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);

      setWardrobe(prev => prev.map(w => 
        w.id === item.id ? { ...w, base64: upscaledBase64, url } : w
      ));
    } catch (err) {
      console.error("Upscale failed", err);
      setError("Upscaling failed for one item.");
    } finally {
      setUpscalingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const onEditSave = (base64: string, url: string) => {
    if (!editingItem) return;

    const inWardrobe = wardrobe.some(item => item.id === editingItem.id);
    if (inWardrobe) {
      setWardrobe(prev => prev.map(item => 
        item.id === editingItem.id ? { ...item, base64, url } : item
      ));
    } else {
      setPendingItems(prev => prev.map(item =>
        item.id === editingItem.id ? { ...item, base64, url } : item
      ));
    }
    setEditingItem(null);
  };

  const onEditCancel = () => {
    setEditingItem(null);
  };

  const handleCameraCapture = (base64: string, url: string) => {
    const newItem: WardrobeItem = {
      id: Math.random().toString(36).substr(2, 9),
      url,
      base64,
      mimeType: 'image/jpeg',
      category: 'Uncategorized'
    };
    setPendingItems([newItem]);
    setIsCameraOpen(false);
  };

  const savePendingToWardrobe = async () => {
    setWardrobe(prev => [...prev, ...pendingItems]);
    setVerdictionIds(prev => {
      const next = new Set(prev);
      pendingItems.forEach(item => next.add(item.id));
      return next;
    });

    for (const item of pendingItems) {
      const { error } = await supabase.from('wardrobe_items').insert({
        id: item.id,
        category: item.category,
        base64: item.base64,
        mime_type: item.mimeType
      });
      if (error) console.error('Wardrobe insert failed:', error);
    }

    setPendingItems([]);
  };

  const cancelPending = () => {
    setPendingItems([]);
  };

  const removeItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWardrobe(prev => prev.filter(item => item.id !== id));
    setVerdictionIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const getStylistOpinion = async () => {
    if (wardrobe.length === 0) {
      setError("Please upload at least one piece of clothing first.");
      return;
    }
    const itemsToAnalyze = wardrobe.filter(item => verdictionIds.has(item.id));
    if (itemsToAnalyze.length === 0) {
      setError("Please select/add at least one item for your verdict.");
      return;
    }
     if (!occasion.trim()) {
      setError("Tell me where you're going!");
      return;
    }
    if (!age || Number(age) <= 0) {
      setError("Please enter your age!");
      return;
    }

    setError(null);
    setStatus(AppState.ANALYZING);
    setIsSaved(false);

    try {
      const recommendation = await analyzeOutfits(itemsToAnalyze, occasion, age);
      setAnalyzedItems(itemsToAnalyze);
      setResult(recommendation);
      setStatus(AppState.RESULT);
    } catch (err: any) {
      setError(err.message || "Something went wrong. The stylist is on a break.");
      setStatus(AppState.IDLE);
    }
  };

  const saveCurrentOutfit = async () => {
    if (!result || isSaved) return;

    const selectedImages = result.selectedIndices
      .map(index => {
        const item = analyzedItems[index];
        if (!item) return null;
        if (item.base64) {
          return `data:${item.mimeType || 'image/jpeg'};base64,${item.base64}`;
        }
        return item.url;
      })
      .filter(Boolean) as string[];

    const finalImages = selectedImages.length > 0 ? selectedImages : analyzedItems.slice(0, result.selectedItems.length).map(item => {
      if (item.base64) {
        return `data:${item.mimeType || 'image/jpeg'};base64,${item.base64}`;
      }
      return item.url;
    });

    const newSave: SavedOutfit = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      occasion: occasion,
      recommendation: result,
      images: finalImages
    };

    setSavedOutfits(prev => [newSave, ...prev]);
    setViewingSavedOutfit(newSave);
    setIsSaved(true);

    await supabase.from('saved_outfits').insert({
      id: newSave.id,
      occasion: newSave.occasion,
      recommendation: newSave.recommendation,
      images: newSave.images,
      created_at: new Date(newSave.timestamp).toISOString()
    });
  };

  const deleteSavedOutfit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedOutfits(prev => prev.filter(o => o.id !== id));

    const { error } = await supabase.from('saved_outfits').delete().eq('id', id);
    if (error) console.error('Failed to delete outfit:', error);
  };

  const openArchiveItem = (item: SavedOutfit) => {
    setResult(item.recommendation);
    setOccasion(item.occasion);
    setViewingSavedOutfit(item);
    setStatus(AppState.RESULT);
    setIsSaved(true);
  };

  const reset = () => {
    setStatus(AppState.IDLE);
    setResult(null);
    setViewingSavedOutfit(null);
    setError(null);
    setIsSaved(false);
  };

  return (
    <div className="min-h-screen pb-20 bg-[#fafafa]">
      {showIntro && <IntroScreen onComplete={() => setShowIntro(false)} />}
      
      {/* Image Editor Modal for Individual Item Editing */}
      {editingItem && (
        <ImageEditor
          image={editingItem.url}
          onSave={onEditSave}
          onCancel={onEditCancel}
        />
      )}

      {/* Camera Capture Modal */}
      {isCameraOpen && (
        <CameraModal
          onCapture={handleCameraCapture}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {/* Save to Wardrobe Pending Confirmation Modal */}
      {pendingItems.length > 0 && (
        <div className="fixed inset-0 z-[115] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="px-8 pt-8 pb-4 flex justify-between items-start">
              <div>
                <h3 className="font-serif text-2xl tracking-tight text-gray-950">Add to Wardrobe</h3>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mt-1 font-semibold">
                  Review {pendingItems.length === 1 ? 'Garment' : `${pendingItems.length} Garments`}
                </p>
              </div>
              <button 
                onClick={cancelPending} 
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Discard"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Body / Preview */}
            <div className="px-8 py-4 overflow-y-auto max-h-[50vh]">
              <div className="grid grid-cols-2 gap-4">
                {pendingItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 p-2 bg-gray-50 border border-gray-100 rounded-2xl shadow-sm">
                    <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-white">
                      <img src={item.url} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setEditingItem(item)}
                        className="absolute bottom-2 right-2 p-1.5 bg-white/90 backdrop-blur-md text-black hover:bg-white active:scale-95 rounded-full shadow-md transition-all"
                        title="Adjust / Crop garment"
                      >
                        <Crop className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Category Selector */}
                    <div className="space-y-1">
                      <label className="block text-[9px] uppercase tracking-wider text-gray-400 font-bold px-1">Category</label>
                      <select
                        value={item.category || 'Uncategorized'}
                        onChange={(e) => {
                          const cat = e.target.value as WardrobeCategory;
                          setPendingItems(prev => prev.map(p => p.id === item.id ? { ...p, category: cat } : p));
                        }}
                        className="w-full bg-white border border-gray-200 rounded-lg py-1 px-2 text-[11px] text-gray-700 font-medium focus:ring-1 focus:ring-black outline-none transition-all cursor-pointer"
                      >
                        <option value="Uncategorized">Uncategorized</option>
                        <option value="Tops">Tops</option>
                        <option value="Bottoms">Bottoms</option>
                        <option value="Footwear">Footwear</option>
                        <option value="Dresses">Dresses</option>
                        <option value="Bags">Bags / Purses</option>
                        <option value="Accessories">Accessories</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="p-8 bg-gray-50 border-t border-gray-100 flex flex-col gap-3">
              <button
                onClick={savePendingToWardrobe}
                className="w-full py-4 bg-black text-white hover:bg-gray-800 active:scale-[0.99] rounded-2xl font-bold text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Check className="w-4 h-4" />
                Save to Wardrobe
              </button>
              <button
                onClick={cancelPending}
                className="w-full py-3 bg-transparent text-gray-500 hover:text-black hover:bg-gray-100 rounded-2xl font-semibold text-xs uppercase tracking-widest transition-all text-center"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={reset}>
            <Logo size={34} className="text-black transition-transform group-hover:scale-110" />
            <h1 className="font-serif text-xl tracking-tight">ChicVerdict</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setStatus(status === AppState.WARDROBE ? AppState.IDLE : AppState.WARDROBE)}
              className={`text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 transition-colors py-1 ${
                status === AppState.WARDROBE 
                  ? 'text-black border-b-2 border-black font-extrabold' 
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Wardrobe
            </button>

            {savedOutfits.length > 0 && (
              <button 
                onClick={() => setStatus(status === AppState.ARCHIVE ? AppState.IDLE : AppState.ARCHIVE)}
                className={`text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 transition-colors py-1 ${
                  status === AppState.ARCHIVE 
                    ? 'text-black border-b-2 border-black font-extrabold' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Archive
              </button>
            )}
            <span className="text-[10px] uppercase tracking-widest text-gray-300 font-bold hidden md:block">AI Stylist Engine</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {status === AppState.IDLE && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-serif">What's the occasion?</h2>
                <p className="text-gray-500 text-sm italic">"Fashion is what you're offered four times a year by designers. Style is what you choose."</p>
              </div>

              {/* Occasion Input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. A first date at a rooftop bar, Quarterly Board Meeting..."
                  className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 text-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all shadow-sm"
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Wand2 className="text-gray-300 w-5 h-5" />
                </div>
              </div>

              {/* Age Input */}
              <div className="relative">
                <input
                  type="number"
                  placeholder="Your age"
                  className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 text-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all shadow-sm"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
             

              {/* Wardrobe Grid */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">Your Wardrobe Selection ({wardrobe.length})</h3>
                  <div className="flex items-center gap-4 text-sm font-medium">
                    <button 
                      onClick={() => setIsCameraOpen(true)}
                      className="group flex items-center gap-2 text-black hover:text-gray-600 transition-colors"
                    >
                      <Camera className="w-4 h-4 text-black" />
                      Take Photo
                    </button>
                    <span className="text-gray-200">|</span>
                    <label className="cursor-pointer group flex items-center gap-2 text-black hover:text-gray-600 transition-colors">
                      <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                      Upload Files
                      <input type="file" ref={fileInputRef} multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                </div>

                {wardrobe.length === 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div 
                      className="aspect-[16/9] border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-gray-400 gap-3 bg-white/50 hover:bg-white hover:border-black/20 transition-all cursor-pointer group"
                      onClick={() => setIsCameraOpen(true)}
                    >
                      <Camera className="w-8 h-8 group-hover:scale-110 transition-transform text-black/60" />
                      <p className="text-sm font-medium text-gray-700">Take Photo with Camera</p>
                    </div>
                    <div 
                      className="aspect-[16/9] border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-gray-400 gap-3 bg-white/50 hover:bg-white hover:border-black/20 transition-all cursor-pointer group"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform text-black/60" />
                      <p className="text-sm font-medium text-gray-700">Upload Photos of Clothes</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {wardrobe.map((item) => (
                      <div 
                        key={item.id} 
                        className="relative aspect-[3/4] group overflow-hidden rounded-2xl shadow-sm bg-white border border-gray-100"
                      >
                        <img src={item.url} alt="Wardrobe piece" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        
                        {/* Verdiction toggle badge */}
                        <button
                          onClick={() => {
                            setVerdictionIds(prev => {
                              const next = new Set(prev);
                              if (next.has(item.id)) {
                                next.delete(item.id);
                              } else {
                                next.add(item.id);
                              }
                              return next;
                            });
                          }}
                          className={`absolute bottom-2 right-2 px-2 py-1 rounded-full shadow-sm z-20 flex items-center gap-1 border transition-all ${
                            verdictionIds.has(item.id)
                              ? 'bg-black text-white border-black hover:bg-gray-800'
                              : 'bg-white/90 backdrop-blur-md text-black border-gray-100 hover:bg-white'
                          }`}
                        >
                          {verdictionIds.has(item.id) ? (
                            <>
                              <Check className="w-3 h-3 text-white" />
                              <span className="text-[9px] font-bold uppercase tracking-wider">In Verdict</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 text-black/60" />
                              <span className="text-[9px] font-bold uppercase tracking-wider">Add Verdict</span>
                            </>
                          )}
                        </button>

                        {/* Action Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button 
                            onClick={() => setEditingItem(item)}
                            className="bg-white/90 p-2 rounded-full text-black hover:bg-white transition-colors"
                            title="Edit"
                          >
                            <Crop className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => handleUpscale(item, e)}
                            className="bg-white/90 p-2 rounded-full text-blue-600 hover:bg-white transition-colors"
                            title="Upscale & Enhance"
                          >
                            <Zap className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => removeItem(item.id, e)}
                            className="bg-white/90 p-2 rounded-full text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Upscaling Overlay */}
                        {upscalingIds.has(item.id) && (
                          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 animate-pulse">
                            <div className="relative">
                              <RefreshCw className="w-6 h-6 text-black animate-spin" />
                              <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 text-black" />
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-black">Refining...</span>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Inline Quick Action Grid Card */}
                    <div className="aspect-[3/4] border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-4 bg-white/50 text-gray-400">
                      <button 
                        onClick={() => setIsCameraOpen(true)}
                        className="flex flex-col items-center gap-1 hover:text-black transition-colors"
                        title="Take Photo"
                      >
                        <Camera className="w-5 h-5 text-black/60" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Photo</span>
                      </button>
                      <div className="w-8 h-[1px] bg-gray-200"></div>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-1 hover:text-black transition-colors" 
                        title="Upload Files"
                      >
                        <Plus className="w-5 h-5 text-black/60" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Upload</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium animate-pulse text-center">
                  {error}
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={getStylistOpinion}
                disabled={wardrobe.length === 0 || !occasion.trim() || editingItem !== null || upscalingIds.size > 0}
                className="w-full py-4 bg-black text-white rounded-2xl font-semibold text-lg hover:bg-gray-800 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Get Verdict
              </button>
            </div>

            
            
          </div>
        )}

        {status === AppState.ARCHIVE && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <button 
              onClick={() => setStatus(AppState.IDLE)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to stylist
            </button>
            
            <div className="space-y-2">
              <h2 className="text-4xl font-serif">The Archive</h2>
              <p className="text-gray-500">Your history of curated stylistic choices.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {savedOutfits.map((outfit) => (
                <div 
                  key={outfit.id} 
                  onClick={() => openArchiveItem(outfit)}
                  className="group relative cursor-pointer bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm hover:shadow-2xl transition-all"
                >
                  <button 
                    onClick={(e) => deleteSavedOutfit(outfit.id, e)}
                    className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex gap-2 mb-6 h-32 overflow-hidden rounded-2xl bg-gray-50">
                    {outfit.images.map((img, i) => (
                      <img key={i} src={img} className="flex-1 object-cover" />
                    ))}
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                        outfit.recommendation.verdict === 'Perfect Match' ? 'bg-green-50 text-green-600' : 
                        outfit.recommendation.verdict === 'Fashion Faux Pas' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {outfit.recommendation.verdict}
                      </span>
                      <span className="text-xs text-gray-400">{new Date(outfit.timestamp).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-xl font-serif">{outfit.occasion}</h3>
                    <p className="text-gray-600 italic leading-relaxed">"{outfit.recommendation.stylistNote}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {status === AppState.WARDROBE && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <button 
              onClick={() => setStatus(AppState.IDLE)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to stylist
            </button>
            
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2">
                <h2 className="text-4xl font-serif">My Wardrobe</h2>
                <p className="text-gray-500">
                  {wardrobe.length === 0 
                    ? "Start building your stylish collection." 
                    : `You have ${wardrobe.length} saved ${wardrobe.length === 1 ? 'garment' : 'garments'} in your collection.`}
                </p>
              </div>

              {/* Add buttons inside Wardrobe View */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsCameraOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 bg-black text-white hover:bg-gray-800 active:scale-95 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-md"
                >
                  <Camera className="w-4 h-4" />
                  Take Photo
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 hover:bg-gray-50 active:scale-95 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all text-black shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Upload Files
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            {wardrobe.length > 0 && (
              <div className="flex items-center gap-3 border-b border-gray-100 pb-6 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                <div className="flex items-center gap-1 text-gray-400 flex-shrink-0 mr-2">
                  <Filter className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Filter:</span>
                </div>
                <div className="flex gap-2 border-none">
                  {categoriesList.map((cat) => {
                    const count = getCategoryCount(cat.name);
                    const isActive = categoryFilter === cat.name;
                    return (
                      <button
                        key={cat.name}
                        onClick={() => setCategoryFilter(cat.name)}
                        className={`px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                          isActive 
                            ? 'bg-black text-white shadow-md' 
                            : 'bg-white border border-gray-200 text-gray-500 hover:text-black hover:border-gray-300 shadow-sm'
                        }`}
                      >
                        <span>{cat.label}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                          isActive ? 'bg-white/20 text-white font-extrabold' : 'bg-gray-100 text-gray-400 font-medium'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Wardrobe Grid inside Manager */}
            {wardrobe.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  className="aspect-[16/9] border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-gray-400 gap-3 bg-white/50 hover:bg-white hover:border-black/20 transition-all cursor-pointer group"
                  onClick={() => setIsCameraOpen(true)}
                >
                  <Camera className="w-8 h-8 group-hover:scale-110 transition-transform text-black/60" />
                  <p className="text-sm font-medium text-gray-700">Take Photo with Camera</p>
                </div>
                <div 
                  className="aspect-[16/9] border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-gray-400 gap-3 bg-white/50 hover:bg-white hover:border-black/20 transition-all cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform text-black/60" />
                  <p className="text-sm font-medium text-gray-700">Upload Photos of Clothes</p>
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                {filteredWardrobe.length === 0 ? (
                  <div className="py-20 text-center border border-dashed border-gray-200 rounded-[2rem] bg-white/50 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-200">
                    <Tag className="w-8 h-8 text-gray-300 animate-bounce" />
                    <div>
                      <p className="text-gray-500 font-semibold text-sm">No items in "{categoryFilter}" category.</p>
                      <p className="text-gray-400 text-xs mt-1">Change your category filter or tag items to see them here.</p>
                    </div>
                    <button
                      onClick={() => setCategoryFilter('All')}
                      className="px-5 py-2.5 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-800 transition-all shadow-md active:scale-95"
                    >
                      Show All Items
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {filteredWardrobe.map((item) => (
                      <div 
                        key={item.id} 
                        className="relative aspect-[3/4] group overflow-hidden rounded-[2rem] shadow-md bg-white border border-gray-100"
                      >
                        <img src={item.url} alt="Wardrobe piece" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        
                        {/* Category tag badge with select dropdown */}
                        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow-md z-20 flex items-center gap-1 border border-gray-100 focus-within:ring-1 focus-within:ring-black">
                          <Tag className="w-3 h-3 text-black/60" />
                          <select
                            value={item.category || 'Uncategorized'}
                            onChange={async (e) => {
                              const cat = e.target.value as WardrobeCategory;
                              setWardrobe(prev => prev.map(w => w.id === item.id ? { ...w, category: cat } : w));

                              const { error } = await supabase
                                .from('wardrobe_items')
                                .update({ category: cat })
                                .eq('id', item.id);
                              if (error) console.error('Category update failed:', error);
                            }}
                            className="bg-transparent text-[9px] font-bold uppercase tracking-wider text-black outline-none border-none cursor-pointer pr-1"
                          >
                            <option value="Uncategorized">Uncategorized</option>
                            <option value="Tops">Tops</option>
                            <option value="Bottoms">Bottoms</option>
                            <option value="Footwear">Footwear</option>
                            <option value="Dresses">Dresses</option>
                            <option value="Bags">Bags</option>
                            <option value="Accessories">Accessories</option>
                          </select>
                        </div>

                        {/* Verdiction toggle badge */}
                        <button
                          onClick={() => {
                            setVerdictionIds(prev => {
                              const next = new Set(prev);
                              if (next.has(item.id)) {
                                next.delete(item.id);
                              } else {
                                next.add(item.id);
                              }
                              return next;
                            });
                          }}
                          className={`absolute bottom-3 right-3 px-2.5 py-1 rounded-full shadow-md z-20 flex items-center gap-1 border transition-all ${
                            verdictionIds.has(item.id)
                              ? 'bg-black text-white border-black hover:bg-gray-800'
                              : 'bg-white/90 backdrop-blur-md text-black border-gray-100 hover:bg-white'
                          }`}
                        >
                          {verdictionIds.has(item.id) ? (
                            <>
                              <Check className="w-3 h-3 text-white" />
                              <span className="text-[9px] font-bold uppercase tracking-wider">In Verdict</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 text-black/60" />
                              <span className="text-[9px] font-bold uppercase tracking-wider">Add Verdict</span>
                            </>
                          )}
                        </button>

                        {/* Action Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                          <button 
                            onClick={() => setEditingItem(item)}
                            className="bg-white/90 p-2.5 rounded-full text-black hover:bg-white active:scale-90 transition-all"
                            title="Edit / Crop"
                          >
                            <Crop className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => handleUpscale(item, e)}
                            className="bg-white/90 p-2.5 rounded-full text-blue-600 hover:bg-white active:scale-90 transition-all"
                            title="Upscale & Enhance"
                          >
                            <Zap className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => removeItem(item.id, e)}
                            className="bg-white/90 p-2.5 rounded-full text-red-500 hover:bg-red-50 transition-all active:scale-90"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Upscaling Overlay */}
                        {upscalingIds.has(item.id) && (
                          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 animate-pulse z-20">
                            <div className="relative">
                              <RefreshCw className="w-6 h-6 text-black animate-spin" />
                              <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 text-black" />
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-black">Refining...</span>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Inline quick insert card inside grid */}
                    <div className="aspect-[3/4] border-2 border-dashed border-gray-200 rounded-[2rem] flex flex-col items-center justify-center gap-4 bg-white/50 text-gray-400">
                      <button 
                        onClick={() => setIsCameraOpen(true)}
                        className="flex flex-col items-center gap-1 hover:text-black transition-colors"
                        title="Take Photo"
                      >
                        <Camera className="w-5 h-5 text-black/60" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Photo</span>
                      </button>
                      <div className="w-8 h-[1px] bg-gray-200"></div>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-1 hover:text-black transition-colors" 
                        title="Upload Files"
                      >
                        <Plus className="w-5 h-5 text-black/60" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Upload</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Get Verdict Later form inside Wardrobe */}
                <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-xl space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-xl font-serif">Get Verdict Later</h3>
                    <p className="text-sm text-gray-500">Where are you headed? Ask our AI Fashion House for a brutal style critique on your wardrobe combination.</p>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">Occasion</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. A first date at a rooftop bar, Quarterly Board Meeting..."
                        className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 text-base focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all shadow-sm"
                        value={occasion}
                        onChange={(e) => setOccasion(e.target.value)}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Wand2 className="text-gray-300 w-5 h-5" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">Age</label>
                    <input
                      type="number"
                      placeholder="Your age"
                      className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 text-base focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all shadow-sm"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                    />
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium animate-pulse text-center">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={getStylistOpinion}
                    disabled={
                      wardrobe.length === 0 || 
                      wardrobe.filter(item => verdictionIds.has(item.id)).length === 0 ||
                      !occasion.trim() || 
                      editingItem !== null || 
                      upscalingIds.size > 0
                    }
                    className="w-full py-4 bg-black text-white rounded-2xl font-semibold text-lg hover:bg-gray-800 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 animate-in fade-in"
                  >
                    <Sparkles className="w-5 h-5" />
                    Get Outfit Verdict
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {status === AppState.ANALYZING && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6 text-center animate-in fade-in zoom-in-95">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-gray-100 border-t-black rounded-full animate-spin"></div>
              <Logo className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-black animate-pulse" size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-serif italic">Analyzing your style...</h2>
              <p className="text-gray-400 text-sm max-w-xs mx-auto">Our stylist is currently judging your choices. Please wait for the honest truth.</p>
            </div>
          </div>
        )}

        {status === AppState.RESULT && result && (
          <div className="space-y-8 animate-in slide-in-from-bottom-10 fade-in duration-700">
            <div className="flex items-center justify-between">
              <button 
                onClick={reset}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to wardrobe
              </button>
              
              <button 
                onClick={saveCurrentOutfit}
                disabled={isSaved}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  isSaved 
                    ? 'bg-green-50 text-green-600 cursor-default' 
                    : 'bg-white border border-gray-200 text-black hover:bg-gray-50'
                }`}
              >
                {isSaved ? (
                  <>
                    <BookmarkCheck className="w-4 h-4" />
                    Saved to Archive
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4" />
                    Save Outfit
                  </>
                )}
              </button>
            </div>

            <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl border border-gray-100">
              <div className="p-8 md:p-12 space-y-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div className="space-y-3">
                    <div className="inline-flex items-center px-3 py-1 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                      The Verdict
                    </div>
                    <h2 className={`text-4xl md:text-5xl font-serif ${
                      result.verdict === 'Fashion Faux Pas' ? 'text-red-600' : 
                      result.verdict === 'Perfect Match' ? 'text-green-600' : 'text-gray-900'
                    }`}>
                      {result.verdict}
                    </h2>
                    {result.ageAppropriateness && (
                      <span className={`inline-flex items-center px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full ${
                        result.ageAppropriateness === 'Reads Too Young/Old' ? 'bg-red-50 text-red-600' :
                        result.ageAppropriateness === 'Borderline' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
                      }`}>
                        Age fit: {result.ageAppropriateness}
                      </span>
                    )}
                    <p className="text-xl text-gray-600 italic leading-relaxed">"{result.stylistNote}"</p>
                  </div>

                  <div className="flex flex-col items-center p-6 bg-gray-50 rounded-3xl min-w-[140px]">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Honesty Score</span>
                    <span className="text-4xl font-serif text-black">{result.honestyScore}%</span>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full mt-3 overflow-hidden">
                      <div className="h-full bg-black transition-all duration-1000" style={{ width: `${result.honestyScore}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-gray-100"></div>

                <div className="grid md:grid-cols-3 gap-12">
                  <div className="md:col-span-2 space-y-6">
                    <h3 className="text-lg font-bold uppercase tracking-wider text-gray-400">Stylist's Breakdown</h3>
                    <div className="prose prose-sm text-gray-700 leading-relaxed text-lg">
                      {result.reasoning}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-lg font-bold uppercase tracking-wider text-gray-400">Recommended Pieces</h3>
                    <div className="space-y-4">
                      {viewingSavedOutfit ? (
                        viewingSavedOutfit.images.map((img, idx) => {
                          const desc = result.selectedItems[idx] || "Selected Piece";
                          return (
                            <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                              <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-gray-100 flex-shrink-0">
                                <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                              <span className="text-gray-800 font-medium text-sm leading-snug">{desc}</span>
                            </div>
                          );
                        })
                      ) : (
                        result.selectedIndices && result.selectedIndices.length > 0 ? (
                          result.selectedIndices.map((wardrobeIdx, idx) => {
                            const item = analyzedItems[wardrobeIdx];
                            const desc = result.selectedItems[idx] || "Selected Piece";
                            return (
                              <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                {item ? (
                                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-gray-100 flex-shrink-0">
                                    <img src={item.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  </div>
                                ) : (
                                  <div className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
                                    {idx + 1}
                                  </div>
                                )}
                                <span className="text-gray-800 font-medium text-sm leading-snug">{desc}</span>
                              </div>
                            );
                          })
                        ) : (
                          result.selectedItems.map((desc, idx) => (
                            <div key={idx} className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                              <div className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
                                {idx + 1}
                              </div>
                              <span className="text-gray-800 font-medium text-sm leading-snug">{desc}</span>
                            </div>
                          ))
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-100 flex flex-col items-center gap-4">
                <button
                  onClick={reset}
                  className="px-8 py-3 bg-white border border-gray-200 text-black rounded-full font-semibold hover:bg-gray-100 transition-all flex items-center gap-2 shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Another Look
                </button>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest text-center">Truly honest advice powered by ChicVerdict AI</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {status === AppState.IDLE && wardrobe.filter(item => verdictionIds.has(item.id)).length > 0 && occasion && (
        <div className="fixed bottom-6 right-6 md:hidden">
          <button
            onClick={getStylistOpinion}
            className="w-16 h-16 bg-black text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
          >
            <Sparkles className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
