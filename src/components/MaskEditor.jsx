import React, { useEffect, useState, useRef } from 'react';
import { fabric } from 'fabric';
import Toolbar from './Toolbar';

// Add immediate console log
console.log('MaskEditor component loaded');

const WORKER_URL = 'https://proud-sky-f006.2qzyhk4jvk.workers.dev';
console.log('Worker URL:', WORKER_URL);

const MaskEditor = () => {
  console.log('MaskEditor component rendering');

  const [canvas, setCanvas] = useState(null);
  const [mode, setMode] = useState('brush');
  const [brushSize, setBrushSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const sessionId = window.location.pathname.split('/').pop();
    console.log('Session ID:', sessionId);
    
    const initializeCanvas = async () => {
      try {
        // Fetch session data
        console.log('Fetching session data...');
        const sessionUrl = `${WORKER_URL}/api/session/${sessionId}`;
        console.log('Session URL:', sessionUrl);
        
        const response = await fetch(sessionUrl);
        console.log('Session response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Session fetch error:', errorText);
          throw new Error('Failed to fetch session data');
        }
        
        const data = await response.json();
        console.log('Session data:', data);
        
        // Create Fabric canvas
        const fabricCanvas = new fabric.Canvas(canvasRef.current, {
          isDrawingMode: true,
          width: data.width,
          height: data.height,
          backgroundColor: '#2d3748'
        });

        // Load original image using the correct property from the API response
        const imageUrl = data.imageUrl;
        console.log('Loading image from:', imageUrl);
        
        fabric.Image.fromURL(
          imageUrl,
          (img) => {
            console.log('Image loaded:', img ? 'success' : 'failed');
            if (!img) {
              console.error('Failed to load image');
              return;
            }
            
            img.set({
              selectable: false,
              evented: false,
              scaleX: fabricCanvas.width / img.width,
              scaleY: fabricCanvas.height / img.height,
            });
            fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
            setLoading(false);
          },
          (err) => {
            // Error callback
            console.error('Error loading image:', err);
            setLoading(false);
          }
        );

        // Configure brush
        const brush = new fabric.PencilBrush(fabricCanvas);
        brush.color = 'rgba(255,255,255,0.5)';
        brush.width = brushSize;
        fabricCanvas.freeDrawingBrush = brush;

        // Set up event listeners to record history
        fabricCanvas.on('path:created', () => {
          addToHistory(fabricCanvas.toJSON());
        });

        setCanvas(fabricCanvas);
        addToHistory(fabricCanvas.toJSON());
      } catch (error) {
        console.error('Error initializing editor:', error);
        console.error('Full error details:', {
          message: error.message,
          stack: error.stack,
        });
        setLoading(false);
      }
    };

    initializeCanvas();

    return () => {
      if (canvas) {
        canvas.dispose();
      }
    };
  }, []);

  // History management
  const addToHistory = (canvasState) => {
    setHistory((prev) => {
      const newHistory = [...prev.slice(0, historyIndex + 1), canvasState];
      if (newHistory.length > 50) newHistory.shift(); // Limit history size
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      canvas.loadFromJSON(history[historyIndex - 1], canvas.renderAll.bind(canvas));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      canvas.loadFromJSON(history[historyIndex + 1], canvas.renderAll.bind(canvas));
    }
  };

  // Mode and brush size management
  useEffect(() => {
    if (canvas) {
      canvas.freeDrawingBrush.width = brushSize;
    }
  }, [brushSize, canvas]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (!canvas) return;

    if (newMode === 'eraser') {
      canvas.freeDrawingBrush.color = 'rgba(0,0,0,0)';
    } else {
      canvas.freeDrawingBrush.color = 'rgba(255,255,255,0.5)';
    }
  };

  // Save functionality
  const handleSave = async () => {
    if (!canvas) return;

    try {
      const sessionId = window.location.pathname.split('/').pop();
      
      // Convert canvas to mask
      const maskData = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1,
      });

      // Send to worker
      const response = await fetch(`${WORKER_URL}/api/save-mask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          maskData,
        }),
      });

      if (!response.ok) throw new Error('Failed to save mask');

      // Close editor window after saving
      window.close();
    } catch (error) {
      console.error('Error saving mask:', error);
      alert('Failed to save mask. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-xl text-white">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
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
      />
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex items-center justify-center"
      >
        <canvas ref={canvasRef} className="shadow-lg" />
      </div>
    </div>
  );
};

export default MaskEditor;
