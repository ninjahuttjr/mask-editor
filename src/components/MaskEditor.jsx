import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { fabric } from 'fabric';
import Toolbar from './Toolbar';
import { WORKER_URL } from '../config';
import InpaintingControls from './InpaintingControls';

// Log when the component loads
console.log('MaskEditor component loaded');

const MaskEditor = () => {
  console.log('MaskEditor component rendering');

  const [canvas, setCanvas] = useState(null);
  const [mode, setMode] = useState('brush');
  const [brushSize, setBrushSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const sessionId = window.location.pathname.split('/').pop();
  const [sessionData, setSessionData] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 512, height: 512 });
  const [maskUrl, setMaskUrl] = useState(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [canvasState, setCanvasState] = useState(null);
  
  // Inpainting parameters state
  const [prompt, setPrompt] = useState('');
  const [denoise, setDenoise] = useState(0.75);
  const [steps, setSteps] = useState(30);
  const [guidance, setGuidance] = useState(7.5);
  const [scheduler, setScheduler] = useState('karras');

  // Log parameter changes
  useEffect(() => {
    console.log('Parameters updated:', { 
      prompt,
      denoise, 
      steps, 
      guidance, 
      scheduler 
    });
  }, [prompt, denoise, steps, guidance, scheduler]);

  // First effect: Fetch session data
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        console.log('Fetching session data for:', sessionId);
        const response = await fetch(`${WORKER_URL}/api/session/${sessionId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch session: ${await response.text()}`);
        }
        
        const data = await response.json();
        console.log('Session data received:', data);

        // First set the session data
        setSessionData(data);

        // Then get the actual image dimensions
        const imageDimensions = await getImageDimensions(data.imageUrl);
        console.log('Actual image dimensions:', imageDimensions);

        // Calculate new dimensions based on actual image size
        const scaledDimensions = calculateScaledDimensions(
          imageDimensions.width,
          imageDimensions.height
        );
        
        console.log('Setting final dimensions:', scaledDimensions);
        setDimensions(scaledDimensions);
        setLoading(false);
      } catch (error) {
        console.error('Session fetch failed:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchSessionData();
  }, [sessionId]);

  // Calculate scaled dimensions to fit within max size while maintaining aspect ratio
  const calculateScaledDimensions = (width, height, maxSize = 512) => {
    console.log('Input dimensions:', { width, height, maxSize });
    
    // Force dimensions to be numbers
    width = Number(width);
    height = Number(height);
    
    const aspectRatio = width / height;
    let newWidth, newHeight;

    // For portrait images (taller than wide)
    if (height > width) {
      // Start with max height
      newHeight = maxSize;
      newWidth = Math.round(maxSize * aspectRatio);
      
      // If width is too large, scale down proportionally
      if (newWidth > maxSize) {
        newWidth = maxSize;
        newHeight = Math.round(maxSize / aspectRatio);
      }
    } else {
      // For landscape, start with max width
      newWidth = maxSize;
      newHeight = Math.round(maxSize / aspectRatio);
      
      // If height is too large, scale down proportionally
      if (newHeight > maxSize) {
        newHeight = maxSize;
        newWidth = Math.round(maxSize * aspectRatio);
      }
    }

    console.log('New calculated dimensions:', { 
      newWidth, 
      newHeight, 
      aspectRatio,
      originalAspectRatio: width/height 
    });
    
    return { width: newWidth, height: newHeight };
  };

  // Initialize canvas
  useEffect(() => {
    if (!sessionData || !containerRef.current) return;

    // Create new canvas element with specific dimensions
    const canvasEl = document.createElement('canvas');
    canvasEl.width = dimensions.width;
    canvasEl.height = dimensions.height;
    
    // Set the ref
    canvasRef.current = canvasEl;
    
    // Clear container and add new canvas
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(canvasEl);

    // Initialize Fabric canvas with black background
    const fabricCanvas = new fabric.Canvas(canvasEl, {
      isDrawingMode: true,
      backgroundColor: '#000000',
      width: dimensions.width,
      height: dimensions.height,
      preserveObjectStacking: true,
      enableRetinaScaling: true,
      renderOnAddRemove: true,
      selection: false
    });

    // Configure brush for better precision
    const brush = new fabric.PencilBrush(fabricCanvas);
    brush.color = mode === 'eraser' ? '#000000' : '#ffffff';
    brush.width = brushSize;
    brush.opacity = 1;
    brush.strokeLineCap = 'round';
    brush.strokeLineJoin = 'round';
    brush.strokeMiterLimit = 4;
    brush.decimate = 2;

    fabricCanvas.freeDrawingBrush = brush;

    // Add this event listener for better brush responsiveness
    fabricCanvas.on('mouse:move', (event) => {
      if (fabricCanvas.isDrawing) {
        fabricCanvas.renderAll();
      }
    });

    // Improve path creation handling
    fabricCanvas.on('path:created', (e) => {
      const path = e.path;
      path.set({
        opacity: 1,
        strokeWidth: brushSize,
        stroke: mode === 'eraser' ? '#000000' : '#ffffff',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        strokeMiterLimit: 4,
        selectable: false,
        evented: false
      });
      fabricCanvas.renderAll();
    });

    // Load template image with proper positioning
    fabric.Image.fromURL(sessionData.imageUrl, (img) => {
      if (!img) return;

      const scale = Math.min(
        dimensions.width / img.width,
        dimensions.height / img.height
      );

      img.set({
        scaleX: scale,
        scaleY: scale,
        left: (dimensions.width - (img.width * scale)) / 2,
        top: (dimensions.height - (img.height * scale)) / 2,
        selectable: false,
        evented: false,
        opacity: 0.3, // Reduced opacity for better mask visibility
        objectCaching: false // Important for proper rendering
      });

      fabricCanvas.add(img);
      fabricCanvas.renderAll();
    }, { crossOrigin: 'anonymous' });

    setCanvas(fabricCanvas);

    return () => fabricCanvas.dispose();
  }, [sessionData, dimensions]);

  // Utility function to get image dimensions
  const getImageDimensions = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        console.log('Actual image dimensions:', {
          width: img.naturalWidth,
          height: img.naturalHeight
        });
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
      img.crossOrigin = 'anonymous';
    });
  };

  // History management.
  const addToHistory = (canvasState) => {
    setHistory(prev => {
      const newHistory = [...prev.slice(0, historyIndex + 1), canvasState];
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  };

  const undo = () => {
    if (historyIndex > 0 && canvas) {
      setHistoryIndex(prev => prev - 1);
      canvas.loadFromJSON(history[historyIndex - 1], () => {
        canvas.renderAll();
      });
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1 && canvas) {
      setHistoryIndex(prev => prev + 1);
      canvas.loadFromJSON(history[historyIndex + 1], () => {
        canvas.renderAll();
      });
    }
  };

  // Modify brush size without reloading canvas state
  useEffect(() => {
    if (canvas && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = brushSize;
      canvas.freeDrawingBrush.color = mode === 'eraser' ? '#000000' : '#ffffff';
    }
  }, [brushSize, canvas, mode]);

  // Handle mode changes with proper binary settings
  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (canvas) {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = newMode === 'eraser' ? '#000000' : '#ffffff';
      canvas.freeDrawingBrush.opacity = 1; // Maintain binary nature
      canvas.renderAll();
    }
  };

  // Save functionality.
  const handleSave = async () => {
    if (!canvas) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      // Get the canvas data as PNG
      const maskData = canvas.toDataURL({
        format: 'png',
        quality: 1
      });

      // Prepare the parameters object
      const parameters = {
        prompt: prompt,
        denoise: denoise,
        steps: steps,
        guidance: guidance,
        scheduler: scheduler,
        brushSize: brushSize
      };

      console.log('Sending parameters:', parameters);

      // Send to worker
      const response = await fetch(`${WORKER_URL}/api/save-mask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          maskData: maskData,
          parameters: parameters  // Include parameters in request
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save mask: ${await response.text()}`);
      }

      const data = await response.json();
      setMaskUrl(data.maskUrl);
      setShowSaveSuccess(true);
      setSuccessMessage('Mask saved successfully! Processing your edit...');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setShowSaveSuccess(false);
        setSuccessMessage(null);
      }, 3000);

    } catch (err) {
      console.error('Error saving mask:', err);
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-red-500 p-4 bg-gray-800 rounded-lg">
          Error: {error}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 discord-embed">
      <div className="max-w-6xl mx-auto space-y-2">
        {error && (
          <div className="bg-red-500 text-white p-4 rounded-lg">
            {error}
          </div>
        )}
        
        {showSaveSuccess && (
          <div className="bg-green-500 text-white p-4 rounded-lg">
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div 
              ref={containerRef}
              className="relative w-full h-full flex items-center justify-center bg-gray-800 rounded-lg overflow-hidden"
              style={{
                aspectRatio: dimensions.width / dimensions.height,
                maxHeight: '70vh'  // Slightly smaller for better mobile fit
              }}
            />
            
            <Toolbar
              mode={mode}
              setMode={setMode}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              onSave={handleSave}
              onUndo={undo}
              onRedo={redo}
              canUndo={historyIndex > 0}
              canRedo={historyIndex < history.length - 1}
              isSaving={isSaving}
            />
          </div>

          <div className="space-y-4">
            <InpaintingControls
              prompt={prompt}
              setPrompt={setPrompt}
              denoise={denoise}
              setDenoise={setDenoise}
              steps={steps}
              setSteps={setSteps}
              guidance={guidance}
              setGuidance={setGuidance}
              scheduler={scheduler}
              setScheduler={setScheduler}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaskEditor;
