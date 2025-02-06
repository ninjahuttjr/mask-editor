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
  prompt,
  onPromptChange
}) => {
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

      <div className="flex-grow">
        <input
          type="text"
          placeholder="Enter inpainting prompt (leave empty to keep original)"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg"
          disabled={isSaving}
        />
      </div>

      <button
        onClick={onSave}
        disabled={isSaving}
        className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
          isSaving ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'
        } text-white`}
      >
        <Save className="w-5 h-5" />
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
};

export default Toolbar;