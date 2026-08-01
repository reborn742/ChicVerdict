
import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Save, X, RotateCw, ZoomIn, FlipHorizontal, FlipVertical } from 'lucide-react';
import { getCroppedImg } from '../utils/imageUtils';

interface ImageEditorProps {
  image: string;
  onSave: (base64: string, url: string) => void;
  onCancel: () => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ image, onSave, onCancel }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [flip, setFlip] = useState({ horizontal: false, vertical: false });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    try {
      setIsProcessing(true);
      const { base64, blob } = await getCroppedImg(image, croppedAreaPixels, rotation, flip);
      const url = URL.createObjectURL(blob);
      onSave(base64, url);
    } catch (e) {
      console.error(e);
      alert('Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleFlipHorizontal = () => setFlip(prev => ({ ...prev, horizontal: !prev.horizontal }));
  const toggleFlipVertical = () => setFlip(prev => ({ ...prev, vertical: !prev.vertical }));

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col p-4 md:p-8 animate-in fade-in">
      <div className="flex justify-between items-center mb-6 text-white max-w-4xl mx-auto w-full">
        <div>
          <h2 className="text-xl font-serif">Adjust Your Piece</h2>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Center and frame the garment</p>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 relative w-full bg-black rounded-3xl overflow-hidden shadow-2xl">
        <Cropper
          image={image}
          crop={crop}
          rotation={rotation}
          zoom={zoom}
          aspect={3 / 4}
          onCropChange={setCrop}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          transform={`scale(${flip.horizontal ? -1 : 1}, ${flip.vertical ? -1 : 1})`}
          classes={{
            containerClassName: "bg-black",
            mediaClassName: "max-w-none",
            cropAreaClassName: "border-2 border-white/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]"
          }}
        />
      </div>

      <div className="max-w-4xl mx-auto w-full mt-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white/5 p-6 rounded-3xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-white text-xs font-bold uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <ZoomIn className="w-4 h-4" />
                Zoom
              </div>
              <span>{zoom.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-white text-xs font-bold uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <RotateCw className="w-4 h-4" />
                Rotation
              </div>
              <span>{rotation}°</span>
            </div>
            <input
              type="range"
              value={rotation}
              min={0}
              max={360}
              step={1}
              aria-labelledby="Rotation"
              onChange={(e) => setRotation(Number(e.target.value))}
              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={toggleFlipHorizontal}
            className={`flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all ${
              flip.horizontal 
                ? 'bg-white text-black border-white' 
                : 'bg-transparent text-white border-white/20 hover:bg-white/10'
            }`}
          >
            <FlipHorizontal className="w-4 h-4" />
            <span className="text-sm font-bold uppercase tracking-widest">Flip H</span>
          </button>
          <button
            onClick={toggleFlipVertical}
            className={`flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all ${
              flip.vertical 
                ? 'bg-white text-black border-white' 
                : 'bg-transparent text-white border-white/20 hover:bg-white/10'
            }`}
          >
            <FlipVertical className="w-4 h-4" />
            <span className="text-sm font-bold uppercase tracking-widest">Flip V</span>
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={isProcessing}
          className="w-full py-4 bg-white text-black rounded-2xl font-bold text-lg hover:bg-gray-100 transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-50"
        >
          {isProcessing ? 'Processing...' : (
            <>
              <Save className="w-5 h-5" />
              Save Piece
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ImageEditor;
