import React, { useState } from 'react';
import { Brush, Eraser, Undo2, Redo2, Save, Menu, X } from 'lucide-react';

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(maskUrl);
      alert('Mask URL copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy URL');
    }
  };

  const MobileMenu = () => (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50">
      <div className="bg-gray-800 h-full w-64 p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white text-lg">Tools</h2>
          <button onClick={() => setIsMenuOpen(false)}>
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {/* Tool buttons */}
          <ToolButtons />
          {/* Brush size control */}
          <BrushSizeControl />
          {/* Save button */}
          <SaveButton />
        </div>
      </div>
    </div>
  );

  const ToolButtons = () => (
    <>
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
    </>
  );

  const BrushSizeControl = () => (
    <div className="flex flex-col gap-2 text-white">
      <span>Brush Size: {brushSize}px</span>
      <input
        type="range"
        min="1"
        max="100"
        value={brushSize}
        onChange={(e) => onBrushSizeChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );

  const SaveButton = () => (
    showSaveSuccess && maskUrl ? (
      <div className="flex flex-col gap-2">
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
    ) : (
      <button
        onClick={onSave}
        disabled={isSaving}
        className={`px-4 py-2 rounded-lg ${
          isSaving 
            ? 'bg-gray-500 cursor-not-allowed' 
            : 'bg-green-600 hover:bg-green-700'
        } text-white`}
      >
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    )
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMenuOpen(true)}
          className="p-2 bg-gray-800 rounded-lg"
        >
          <Menu className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && <MobileMenu />}

      {/* Desktop toolbar */}
      <div className="hidden md:flex items-center gap-4 p-4 bg-gray-800">
        <ToolButtons />
        <BrushSizeControl />
        <div className="flex-grow" />
        <SaveButton />
      </div>
    </>
  );
};

export default Toolbar;