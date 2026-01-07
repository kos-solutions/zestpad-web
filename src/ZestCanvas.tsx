// src/ZestCanvas.tsx
import { useRef, useState, useEffect } from 'react';
import CanvasDraw from 'react-canvas-draw';

interface ZestCanvasProps {
  initialData?: string; // Desenul vechi (dacă există)
  readOnly?: boolean;   // Dacă e true, nu putem desena (doar privim)
  onSave?: (data: string) => void; // Funcția care trimite datele "sus"
}

export function ZestCanvas({ initialData, readOnly = false, onSave }: ZestCanvasProps) {
  const canvasRef = useRef<any>(null);
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushRadius, setBrushRadius] = useState(2);

  // Când primim date (desenul salvat), le încărcăm pe tablă
  useEffect(() => {
    // Folosim un mic delay pentru a lăsa React să termine randarea
    const timer = setTimeout(() => {
      if (canvasRef.current && initialData && initialData !== "" && initialData !== "{}") {
        try {
          // Încărcăm datele DOAR dacă avem ceva valid
          canvasRef.current.loadSaveData(initialData, true);
        } catch (err) {
          console.error("Eroare la desenarea datelor:", err);
        }
      }
    }, 100); // 100ms întârziere este insesizabilă pt ochi, dar imensă pt procesor

    return () => clearTimeout(timer);
  }, [initialData]);

  const handleSave = () => {
    if (canvasRef.current && onSave) {
      // Transformăm desenul în TEXT (JSON string)
      const drawingData = canvasRef.current.getSaveData();
      onSave(drawingData);
    }
  };

  const clearCanvas = () => {
    if (canvasRef.current) canvasRef.current.clear();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* TOOLBAR (Doar dacă nu e readOnly) */}
      {!readOnly && (
        <div className="bg-white p-2 rounded shadow flex gap-4 items-center border border-gray-200">
          <div className="flex gap-2">
            {/* Culori */}
            {['#000000', '#EF4444', '#3B82F6', '#10B981'].map(color => (
              <button
                key={color}
                onClick={() => setBrushColor(color)}
                className={`w-6 h-6 rounded-full border-2 ${brushColor === color ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <div className="h-6 w-px bg-gray-300"></div>

          {/* Grosime */}
          <input 
            type="range" min="1" max="10" 
            value={brushRadius} onChange={(e) => setBrushRadius(Number(e.target.value))}
            className="w-20"
          />

          <div className="h-6 w-px bg-gray-300"></div>

          {/* Acțiuni */}
          <button onClick={() => canvasRef.current.undo()} className="text-gray-600 text-sm hover:text-black">↩ Undo</button>
          <button onClick={clearCanvas} className="text-red-500 text-sm hover:text-red-700">🗑️ Șterge Tot</button>
          
          <div className="h-6 w-px bg-gray-300"></div>

          <button 
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-1 rounded text-sm font-bold hover:bg-blue-700 shadow-md"
          >
            💾 Salvează Desenul
          </button>
        </div>
      )}

      {/* FOAIA PROPRIU-ZISĂ */}
      <div className="border shadow-2xl bg-white cursor-crosshair overflow-hidden rounded-sm">
        <CanvasDraw
          ref={canvasRef}
          brushColor={brushColor}
          brushRadius={brushRadius}
          lazyRadius={0} // 0 = răspuns instant la mouse (fără întârziere "artistică")
          canvasWidth={800}
          canvasHeight={600}
          disabled={readOnly}
          gridColor="#e5e7eb" // Pătrățele de matematică discrete
        />
      </div>
    </div>
  );
}