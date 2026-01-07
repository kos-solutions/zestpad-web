// src/ClassDetails.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from './api/client';
import { jwtDecode } from 'jwt-decode';

interface Topic {
  id: number;
  title: string;
}

export function ClassDetails() {
  const { id } = useParams(); // ID-ul clasei din URL (string)
  const navigate = useNavigate();
  const classId = Number(id);

  // Stări
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('');

  // Stări pentru Modal (Adăugare Folder)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');

  useEffect(() => {
    // 1. Aflăm cine e utilizatorul (pt. a arăta butonul de adăugare)
    const token = localStorage.getItem('zest_token');
    if (token) {
      const decoded: any = jwtDecode(token);
      setUserRole(decoded.role);
    }
    
    // 2. Încărcăm folderele
    fetchTopics();
  }, [classId]);

  const fetchTopics = async () => {
    try {
      setLoading(true);
      // Backend: GET /topics/class/5
      const res = await apiClient.get(`/topics/class/${classId}`);
      setTopics(res.data);
    } catch (error) {
      console.error("Nu am putut încărca folderele", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicTitle.trim()) return;

    try {
      // Backend: POST /topics { title: "Algebră", classId: 5 }
      await apiClient.post('/topics', { 
        title: newTopicTitle, 
        classId: classId 
      });
      
      setIsModalOpen(false);
      setNewTopicTitle('');
      fetchTopics(); // Reîmprospătăm lista
    } catch (error) {
      alert("Eroare la crearea folderului.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* --- HEADER --- */}
      <header className="bg-white shadow p-4 flex justify-between items-center px-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')} 
            className="text-gray-500 hover:text-blue-600 font-bold flex items-center gap-1"
          >
            &larr; Înapoi
          </button>
          <div className="h-6 w-px bg-gray-300"></div>
          <h1 className="text-xl font-bold text-gray-800">
            Clasa #{classId} {/* Vom pune numele real mai târziu */}
          </h1>
        </div>

        {/* Buton vizibil doar profesorilor */}
        {userRole === 'teacher' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow flex items-center gap-2"
          >
            <span>+</span> Folder Nou
          </button>
        )}
      </header>

      {/* --- CONTENT --- */}
      <main className="p-8 max-w-6xl mx-auto w-full">
        {loading ? <p className="text-gray-500">Se încarcă bibliorafturile...</p> : (
          topics.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-6xl mb-4">📂</div>
              <h3 className="text-xl font-bold text-gray-700">Această clasă este goală.</h3>
              <p className="text-gray-500 mb-4">Adaugă capitole sau materii pentru a organiza lecțiile.</p>
              {userRole === 'teacher' && (
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Creează primul folder
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {/* LISTA DE FOLDERE */}
              {topics.map((topic) => (
                <div 
                  key={topic.id} 
                  className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer border-t-4 border-yellow-400 group"
                  onClick={() => alert(`Ai dat click pe ${topic.title}. Urmează să facem lecțiile!`)}
				  onClick={() => navigate(`/topic/${topic.id}`)} // <--- NAVIGARE REALĂ
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-4xl">📁</span>
                    <button className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                      ⋮
                    </button>
                  </div>
                  <h3 className="font-bold text-lg text-gray-800 truncate">{topic.title}</h3>
                  <p className="text-xs text-gray-400 mt-1">0 Lecții</p>
                </div>
              ))}
            </div>
          )
        )}
      </main>

      {/* --- MODAL ADĂUGARE FOLDER --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-4">Folder Nou (Capitol/Materie)</h2>
            <form onSubmit={handleCreateTopic}>
              <input 
                autoFocus
                type="text" 
                placeholder="Ex: Algebră, Geometrie, Teze..."
                value={newTopicTitle}
                onChange={e => setNewTopicTitle(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded mb-4 focus:outline-none focus:border-blue-500"
              />
              <div className="flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Anulează
                </button>
                <button 
                  type="submit" 
                  disabled={!newTopicTitle}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded"
                >
                  Creează
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}