import React from 'react';
import { Brush, Eraser, Undo2, Redo2, Save } from 'lucide-react';

const Toolbar = ({
  mode,
  onModeChange,
  brushSize,
  onBrushSizeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  isSaving,
  maskUrl,
  showSaveSuccess
}) => {
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(maskUrl);
      alert('Mask URL copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy URL');
    }
  };

  const SaveButton = () => {
    if (isSaving) {
      return (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg">
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Saving mask...</span>
        </div>
      );
    }

    if (showSaveSuccess && maskUrl) {
      return (
        <div className="flex flex-col gap-2">
          <div className="text-green-400 text-sm mb-2">
            Mask saved successfully!
          </div>
          <input
            type="text"
            value={maskUrl}
            readOnly
            className="bg-gray-700 text-white px-3 py-2 rounded-lg w-full text-sm"
          />
          <button
            onClick={copyToClipboard}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Copy URL
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={onSave}
        className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white"
      >
        Save Mask
      </button>
    );
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-800">
      <button
        className={`p-2 rounded ${mode === 'brush' ? 'bg-blue-500' : 'bg-gray-700'}`}
        onClick={() => onModeChange('brush')}
      >
        <Brush className="w-6 h-6" />
      </button>
      
      <button
        className={`p-2 rounded ${mode === 'eraser' ? 'bg-blue-500' : 'bg-gray-700'}`}
        onClick={() => onModeChange('eraser')}
      >
        <Eraser className="w-6 h-6" />
      </button>

      <div className="flex items-center gap-2 text-white">
        <span>Brush Size:</span>
        <input
          type="range"
          min="1"
          max="100"
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          className="w-32"
        />
        <span>{brushSize}px</span>
      </div>

      <button
        className={`p-2 rounded ${canUndo ? 'bg-gray-700' : 'bg-gray-900 opacity-50'}`}
        onClick={onUndo}
        disabled={!canUndo}
      >
        <Undo2 className="w-6 h-6" />
      </button>

      <button
        className={`p-2 rounded ${canRedo ? 'bg-gray-700' : 'bg-gray-900 opacity-50'}`}
        onClick={onRedo}
        disabled={!canRedo}
      >
        <Redo2 className="w-6 h-6" />
      </button>

      <div className="flex-grow"></div>

      <SaveButton />
    </div>
  );
};

export default Toolbar;