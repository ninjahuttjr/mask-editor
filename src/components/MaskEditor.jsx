import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { fabric } from 'fabric';
import Toolbar from './Toolbar';
import { WORKER_URL } from '../config';

const MaskEditor = () => {
  const [canvas, setCanvas] = useState(null);
  const [mode, setMode] = useState('brush');
  const [brushSize, setBrushSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [prompt, setPrompt] = useState('');
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const sessionId = window.location.pathname.split('/').pop();
  const [sessionData, setSessionData] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 512, height: 512 });

  // First effect: Fetch session data
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        console.log('Fetching session data for:', sessionId);
        const response = await fetch(`${WORKER_URL}/api/session/${sessionId}`);
        if (!response.ok) throw new Error('Failed to fetch session');
        const data = await response.json();
        console.log('Session data received:', data);
        setSessionData(data);
        
        // Get actual image dimensions
        const imageDimensions = await getImageDimensions(data.imageUrl);
        console.log('Actual image dimensions:', imageDimensions);
        
        // Calculate scaled dimensions
        const scaledDimensions = calculateScaledDimensions(
          imageDimensions.width,
          imageDimensions.height
        );
        
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

  // Initialize canvas
  useLayoutEffect(() => {
    if (!sessionData || !containerRef.current) return;

    console.log('Initializing canvas with dimensions:', dimensions);
    
    const canvasEl = document.createElement('canvas');
    canvasEl.width = dimensions.width;
    canvasEl.height = dimensions.height;
    
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(canvasEl);
    canvasRef.current = canvasEl;

    const fabricCanvas = new fabric.Canvas(canvasEl, {
      isDrawingMode: true,
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: '#2d3748'
    });

    // Initial brush setup
    const brush = new fabric.PencilBrush(fabricCanvas);
    brush.color = mode === 'eraser' ? '#2d3748' : '#ffffff';
    brush.width = brushSize;
    fabricCanvas.freeDrawingBrush = brush;

    // Load background image
    fabric.Image.fromURL(
      sessionData.imageUrl,
      (img) => {
        if (!img) {
          setError('Failed to load image');
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
          top: (dimensions.height - (img.height * scale)) / 2
        });

        fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
      },
      { crossOrigin: 'anonymous' }
    );

    // Setup path creation handler
    fabricCanvas.on('path:created', () => {
      const canvasState = JSON.stringify(fabricCanvas.toJSON());
      addToHistory(canvasState);
    });

    setCanvas(fabricCanvas);

    return () => {
      fabricCanvas.dispose();
    };
  }, [sessionData, dimensions]);

  // Handle brush size changes
  useEffect(() => {
    if (!canvas) return;
    
    const brush = canvas.freeDrawingBrush;
    if (brush) {
      brush.width = brushSize;
      canvas.renderAll();
    }
  }, [brushSize, canvas]);

  // Handle mode changes
  const handleModeChange = (newMode) => {
    if (!canvas) return;
    
    setMode(newMode);
    const brush = canvas.freeDrawingBrush;
    if (brush) {
      brush.color = newMode === 'eraser' ? '#2d3748' : '#ffffff';
      canvas.renderAll();
    }
  };

  // History management
  const addToHistory = (state) => {
    setHistory(prev => {
      const newHistory = [...prev.slice(0, historyIndex + 1), state];
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex(prev => prev + 1);
  };

  const undo = () => {
    if (historyIndex > 0 && canvas) {
      setHistoryIndex(prev => prev - 1);
      canvas.loadFromJSON(history[historyIndex - 1], canvas.renderAll.bind(canvas));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1 && canvas) {
      setHistoryIndex(prev => prev + 1);
      canvas.loadFromJSON(history[historyIndex + 1], canvas.renderAll.bind(canvas));
    }
  };

  // Save functionality
  const handleSave = async () => {
    if (!canvas || isSaving) return;
    
    try {
      setIsSaving(true);
      setError(null);
      
      // Create mask data
      const maskData = canvas.toDataURL({
        format: 'png',
        quality: 1
      });
      
      const response = await fetch(`${WORKER_URL}/api/save-mask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          maskData,
          prompt
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save mask');
      }

      // Show success message
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 left-4 bg-green-500 text-white p-4 rounded-lg text-center';
      notification.innerHTML = `
        <div class="flex flex-col gap-2">
          <div>Mask saved successfully! Processing will continue in Discord...</div>
          <div class="text-sm">This window will close in 3 seconds</div>
        </div>
      `;
      document.body.appendChild(notification);

      // Close window after delay if shouldClose is true
      if (data.shouldClose) {
        setTimeout(() => {
          window.close();
        }, 3000);
      }

    } catch (error) {
      console.error('Save error:', error);
      setError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white">Loading editor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-red-500 p-4 bg-gray-800 rounded-lg">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <div className="bg-gray-800 p-4">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter prompt for inpainting..."
          className="w-full p-2 rounded bg-gray-700 text-white"
        />
      </div>
      <Toolbar
        mode={mode}
        onModeChange={handleModeChange}
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={undo}
        onRedo={redo}
        onSave={handleSave}
        isSaving={isSaving}
      />
      <div className="flex-1 p-4 flex items-center justify-center">
        <div 
          ref={containerRef}
          className="bg-gray-800 rounded-lg shadow-lg"
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`
          }}
        />
      </div>
    </div>
  );
};

export default MaskEditor;