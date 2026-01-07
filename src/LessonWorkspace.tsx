// src/LessonWorkspace.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from './api/client';
import { ZestCanvas } from './ZestCanvas';

export function LessonWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const lessonId = Number(id);

  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 1. Încărcăm lecția (și desenul existent)
  useEffect(() => {
    apiClient.get(`/lessons/${lessonId}`)
      .then(res => setLesson(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [lessonId]);

  // 2. Funcția care trimite desenul la Backend
  const saveContent = async (drawingData: string) => {
    try {
      await apiClient.patch(`/lessons/${lessonId}/content`, { content: drawingData });
      alert("Lecție salvată cu succes!");
    } catch (error) {
      console.error(error);
      alert("Eroare la salvare.");
    }
  };

  if (loading) return <div className="p-10 text-center">Se pregătește tabla...</div>;
  if (!lesson) return <div className="p-10 text-center text-red-500">Lecția nu există.</div>;

  return (
    <div className="min-h-screen bg-gray-200 flex flex-col items-center py-8">
      {/* Header simplu */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-6 px-4">
        <button onClick={() => navigate(-1)} className="text-gray-600 font-bold hover:text-black">
          &larr; Înapoi
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold">{lesson.title}</h1>
          <span className="text-xs uppercase bg-gray-300 px-2 py-1 rounded text-gray-700">
            {lesson.type === 'theory' ? 'Predare la Tablă' : 'Temă Individuală'}
          </span>
        </div>
        <div className="w-16"></div> {/* Spacer */}
      </div>

      {/* AICI ESTE TABLA */}
      <ZestCanvas 
        initialData={lesson.content} // Încărcăm ce s-a desenat înainte
        onSave={saveContent}         // Când apeși Save, se duce la server
      />
      
      <p className="mt-4 text-gray-500 text-xs">
        Sfat: Poți folosi mouse-ul sau o tabletă grafică.
      </p>
    </div>
  );
}