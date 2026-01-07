// src/TopicDetails.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from './api/client';
import { jwtDecode } from 'jwt-decode';

interface Lesson {
  id: number;
  title: string;
  type: 'theory' | 'homework';
}

export function TopicDetails() {
  const { id } = useParams(); // ID-ul Topic-ului (Folderului)
  const navigate = useNavigate();
  const topicId = Number(id);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonType, setNewLessonType] = useState('theory');

  useEffect(() => {
    const token = localStorage.getItem('zest_token');
    if (token) {
      const decoded: any = jwtDecode(token);
      setUserRole(decoded.role);
    }
    fetchLessons();
  }, [topicId]);

  const fetchLessons = async () => {
    try {
      setLoading(true);
      // Backend: GET /lessons/topic/5
      const res = await apiClient.get(`/lessons/topic/${topicId}`);
      setLessons(res.data);
    } catch (error) {
      console.error("Eroare la încărcarea lecțiilor", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLessonTitle.trim()) return;

    try {
      // Backend: POST /lessons
      await apiClient.post('/lessons', {
        title: newLessonTitle,
        topicId: topicId,
        type: newLessonType
      });
      
      setIsModalOpen(false);
      setNewLessonTitle('');
      fetchLessons();
    } catch (error) {
      alert("Nu am putut crea lecția.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* HEADER */}
      <header className="bg-white shadow p-4 flex justify-between items-center px-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-blue-600 font-bold">
            &larr; Înapoi la Clasă
          </button>
          <div className="h-6 w-px bg-gray-300"></div>
          <h1 className="text-xl font-bold text-gray-800">Conținut Folder #{topicId}</h1>
        </div>
        
        {userRole === 'teacher' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow flex items-center gap-2"
          >
            <span>+</span> Lecție Nouă
          </button>
        )}
      </header>

      {/* LISTA DE LECȚII */}
      <main className="p-8 max-w-4xl mx-auto w-full">
        {loading ? <p>Se încarcă...</p> : (
          lessons.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p>Acest folder este gol.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lessons.map((lesson) => (
                <div 
                  key={lesson.id} 
                  className="bg-white p-4 rounded shadow-sm hover:shadow-md transition flex items-center justify-between border-l-4 cursor-pointer group"
                  style={{ borderColor: lesson.type === 'theory' ? '#3B82F6' : '#10B981' }} // Albastru pt teorie, Verde pt temă
                  
				  onClick={() => navigate(`/lesson/${lesson.id}`)} // <--- AICI MODIFICI
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${lesson.type === 'theory' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                      {lesson.type === 'theory' ? '📖' : '📝'}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">{lesson.title}</h3>
                      <p className="text-xs text-gray-500 uppercase">{lesson.type === 'theory' ? 'Lecție / Predare' : 'Temă / Exercițiu'}</p>
                    </div>
                  </div>
                  <button className="text-gray-300 group-hover:text-blue-600">Deschide &rarr;</button>
                </div>
              ))}
            </div>
          )
        )}
      </main>

      {/* MODAL CREARE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-4">Adaugă Conținut</h2>
            <form onSubmit={handleCreateLesson}>
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">Titlu</label>
                <input 
                  type="text" autoFocus
                  value={newLessonTitle} onChange={e => setNewLessonTitle(e.target.value)}
                  className="w-full border p-2 rounded"
                  placeholder="Ex: Introducere, Exerciții..."
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">Tip</label>
                <select 
                  value={newLessonType} onChange={e => setNewLessonType(e.target.value)}
                  className="w-full border p-2 rounded bg-white"
                >
                  <option value="theory">📖 Lecție (Teorie)</option>
                  <option value="homework">📝 Temă (Exerciții)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-3 py-1 text-gray-500">Anulează</button>
                <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded">Salvează</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}