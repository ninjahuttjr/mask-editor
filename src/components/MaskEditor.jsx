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

  // Use layout effect to initialize canvas after DOM updates
  useLayoutEffect(() => {
    if (!sessionData || !containerRef.current || !dimensions.width || !dimensions.height) {
      console.log('Waiting for all required data...');
      return;
    }

    console.log('Initializing canvas with dimensions:', dimensions);
    
    const canvasEl = document.createElement('canvas');
    canvasEl.width = dimensions.width;
    canvasEl.height = dimensions.height;
    canvasEl.style.width = `${dimensions.width}px`;
    canvasEl.style.height = `${dimensions.height}px`;
    canvasEl.className = 'rounded-lg';
    
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(canvasEl);
    canvasRef.current = canvasEl;

    const fabricCanvas = new fabric.Canvas(canvasEl, {
      isDrawingMode: true,
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: '#000000'
    });

    // Configure brush for binary masking with full opacity
    const brush = new fabric.PencilBrush(fabricCanvas);
    brush.color = mode === 'eraser' ? '#000000' : '#ffffff';
    brush.width = brushSize;
    brush.opacity = 1; // Ensure full opacity for binary mask
    fabricCanvas.freeDrawingBrush = brush;

    // Ensure paths are created with correct colors and full opacity
    fabricCanvas.on('path:created', (e) => {
      const path = e.path;
      path.set({
        opacity: 1,
        strokeWidth: brushSize,
        stroke: mode === 'eraser' ? '#000000' : '#ffffff'
      });
      fabricCanvas.renderAll();
      const canvasState = JSON.stringify(fabricCanvas.toJSON());
      addToHistory(canvasState);
    });

    // Handle undo/redo state
    const handleHistoryChange = () => {
      const canvasState = JSON.stringify(fabricCanvas.toJSON());
      addToHistory(canvasState);
    };

    fabricCanvas.on('object:added', handleHistoryChange);
    fabricCanvas.on('object:modified', handleHistoryChange);
    fabricCanvas.on('object:removed', handleHistoryChange);

    // Load image as a template but make it invisible in final output
    fabric.Image.fromURL(
      sessionData.imageUrl,
      (img) => {
        if (!img) {
          console.error('Failed to load image');
          setError('Failed to load image');
          setLoading(false);
          return;
        }

        const scaleX = dimensions.width / img.width;
        const scaleY = dimensions.height / img.height;
        const scale = Math.min(scaleX, scaleY);
        
        img.set({
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
          left: (dimensions.width - (img.width * scale)) / 2,
          top: (dimensions.height - (img.height * scale)) / 2,
          opacity: 0.3  // Make the image semi-transparent as a guide
        });

        fabricCanvas.add(img);
        fabricCanvas.renderAll();

        // Add event handler for saving mask
        const handleSave = async () => {
          // Temporarily hide the template image
          img.opacity = 0;
          fabricCanvas.renderAll();
          
          // Get the mask data
          const maskData = fabricCanvas.toDataURL();
          
          // Restore the template image opacity for continued editing
          img.opacity = 0.3;
          fabricCanvas.renderAll();
          
          return maskData;
        };

        // Attach the handleSave function to your save button/logic
        // ... your existing save logic ...
      },
      { crossOrigin: 'anonymous' }
    );

    setCanvas(fabricCanvas);

    return () => {
      fabricCanvas.dispose();
    };
  }, [sessionData, dimensions, brushSize, mode]);

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

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (canvas) {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = newMode === 'eraser' ? '#000000' : '#ffffff';
      canvas.freeDrawingBrush.opacity = 1;
      canvas.renderAll();
    }
  };

  // Save functionality.
  const handleSave = async () => {
    if (isSaving) return;
    
    try {
      setIsSaving(true);
      setError(null);

      // Temporarily hide the template image before saving
      const templateImage = canvas.getObjects('image')[0];
      if (templateImage) {
        templateImage.opacity = 0;
        canvas.renderAll();
      }

      // Get canvas data
      const maskDataUrl = canvasRef.current.toDataURL('image/png');

      // Restore template image visibility
      if (templateImage) {
        templateImage.opacity = 0.3;
        canvas.renderAll();
      }

      // Prepare save data with all parameters
      const saveData = {
        sessionId: sessionData.id,
        maskData: maskDataUrl,
        prompt,
        parameters: {
          denoise,
          steps,
          guidance,
          scheduler
        },
        metadata: sessionData.metadata
      };

      console.log('Saving mask with parameters:', saveData.parameters);

      const response = await fetch(`${WORKER_URL}/api/save-mask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saveData)
      });

      if (!response.ok) {
        throw new Error(`Failed to save mask: ${response.statusText}`);
      }

      const result = await response.json();
      setMaskUrl(result.maskUrl);
      setShowSaveSuccess(true);
      setSuccessMessage('Mask saved successfully! Processing will begin shortly...');

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
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto space-y-4">
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
              className="w-full aspect-square bg-gray-800 rounded-lg"
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
