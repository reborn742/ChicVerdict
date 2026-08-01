import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, RotateCcw, Check, RefreshCw, CameraOff, Sparkles } from 'lucide-react';

interface CameraModalProps {
  onCapture: (base64: string, url: string) => void;
  onClose: () => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ onCapture, onClose }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize and check devices
  useEffect(() => {
    // Check if multiple camera devices exist to show "Switch Camera" option
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          setHasMultipleCameras(videoDevices.length > 1);
        })
        .catch(err => {
          console.warn("Could not enumerate devices:", err);
        });
    }
  }, []);

  // Set up video stream
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    // Stop existing stream tracks
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(mediaStream => {
        if (!active) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Camera access failed:", err);
        if (active) {
          setError("Could not access your camera. Please ensure camera permissions are allowed.");
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (!videoWidth || !videoHeight) return;

    // We target a 3:4 aspect ratio for our wardrobe images
    const targetAspect = 3 / 4;
    let sWidth = videoWidth;
    let sHeight = videoHeight;
    let sx = 0;
    let sy = 0;

    if (videoWidth / videoHeight > targetAspect) {
      // Video is too wide - crop horizontal edges
      sWidth = videoHeight * targetAspect;
      sx = (videoWidth - sWidth) / 2;
    } else {
      // Video is too tall - crop vertical edges
      sHeight = videoWidth / targetAspect;
      sy = (videoHeight - sHeight) / 2;
    }

    const canvas = document.createElement('canvas');
    // High-resolution standard for wardrobe items
    canvas.width = 768;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Flip the frame horizontally if using front-facing camera to match natural mirrored view
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setCapturedImage(dataUrl);
    }
  };

  const handleUsePhoto = () => {
    if (!capturedImage) return;

    // Convert the data URL to a clean base64 string
    const base64Content = capturedImage.split(',')[1];
    onCapture(base64Content, capturedImage);
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  // Clean up tracks when component unmounts
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl flex flex-col p-4 md:p-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 text-white max-w-xl mx-auto w-full">
        <div>
          <h2 className="text-xl font-serif">Capture Wardrobe Piece</h2>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">
            {capturedImage ? "Review your photo" : "Position clothing in the frame"}
          </p>
        </div>
        <button 
          onClick={onClose} 
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          title="Close Camera"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Viewfinder Box */}
      <div className="flex-1 relative w-full max-w-xl mx-auto bg-black rounded-[2rem] overflow-hidden shadow-2xl flex items-center justify-center border border-white/5">
        {isLoading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            <p className="text-xs uppercase tracking-widest font-semibold text-gray-400">Initializing Camera...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-4 text-white">
            <div className="p-4 bg-red-500/10 text-red-400 rounded-full">
              <CameraOff className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-lg text-red-400">Access Denied</h3>
              <p className="text-sm text-gray-400 max-w-xs">{error}</p>
            </div>
            <button 
              onClick={onClose}
              className="px-6 py-2 bg-white text-black font-semibold rounded-full text-xs uppercase tracking-widest hover:bg-gray-100 transition-all mt-2"
            >
              Go Back
            </button>
          </div>
        )}

        {/* Live Camera Feed */}
        {!capturedImage && !error && (
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
            
            {/* 3:4 Framing Grid Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Outer boundary guidelines */}
              <div className="w-[85%] aspect-[3/4] border border-white/25 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                {/* Vintage viewfinder corners */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-lg"></div>
                
                {/* Centered crosshair */}
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <div className="w-3 h-[1px] bg-white"></div>
                  <div className="h-3 w-[1px] bg-white"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Captured Preview Screen */}
        {capturedImage && (
          <div className="relative w-full h-full bg-black">
            <img 
              src={capturedImage} 
              alt="Captured garment preview" 
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Controls Container */}
      <div className="max-w-xl mx-auto w-full mt-6 flex flex-col items-center">
        {!capturedImage ? (
          /* Live Stream Controls */
          <div className="flex items-center justify-between w-full px-6">
            {/* Left side spacer or camera toggle */}
            {hasMultipleCameras || true ? ( // Show facing mode switch regardless for general mobile compatibility
              <button
                onClick={toggleCamera}
                disabled={isLoading}
                className="p-4 bg-white/5 hover:bg-white/10 active:scale-95 disabled:opacity-30 rounded-full text-white transition-all border border-white/10"
                title="Switch Camera"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-[52px]"></div>
            )}

            {/* Shutter Button */}
            <button
              onClick={capturePhoto}
              disabled={isLoading || !!error}
              className="w-20 h-20 bg-white hover:scale-105 active:scale-90 disabled:opacity-40 rounded-full flex items-center justify-center transition-all p-1.5 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              title="Capture Photo"
            >
              <div className="w-full h-full rounded-full border-[3px] border-black bg-white flex items-center justify-center">
                <Camera className="w-8 h-8 text-black" />
              </div>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-4 bg-white/5 hover:bg-white/10 active:scale-95 rounded-full text-white transition-all border border-white/10"
              title="Cancel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          /* Capture Review Controls */
          <div className="grid grid-cols-2 gap-4 w-full px-4">
            <button
              onClick={handleRetake}
              className="flex items-center justify-center gap-2 py-4 bg-white/5 border border-white/15 text-white hover:bg-white/10 rounded-2xl transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-widest">Retake</span>
            </button>
            
            <button
              onClick={handleUsePhoto}
              className="flex items-center justify-center gap-2 py-4 bg-white text-black hover:bg-gray-100 rounded-2xl transition-all font-bold shadow-lg"
            >
              <Check className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-widest">Use Photo</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraModal;
