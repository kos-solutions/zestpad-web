import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from './api/client';

interface Topic {
  id: number;
  title: string;
  background: string; // 'white', 'math', 'dictando', 'music'
}

interface ClassDetails {
  id: number;
  name: string;
  code: string;
}

export function ClassDetails() {
  const { id } = useParams(); // Luăm ID-ul clasei din URL
  const navigate = useNavigate();

  const [classInfo, setClassInfo] = useState<ClassDetails | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State pentru Modalul de Creare Folder
  const [showModal, setShowModal] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicBg, setNewTopicBg] = useState('white'); // Default foaie albă

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      // 1. Luăm detaliile clasei (opțional, dacă ai endpoint pentru asta, altfel poți sări)
      // Momentan presupunem că avem un endpoint sau luăm doar topics
      
      // 2. Luăm folderele (topics)
      const resTopics = await apiClient.get(`/topics/class/${id}`);
      setTopics(resTopics.data);
      
      setLoading(false);
    } catch (error) {
      console.error("Eroare la încărcare:", error);
      setLoading(false);
    }
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicTitle.trim()) return;

    try {
      await apiClient.post('/topics', {
        title: newTopicTitle,
        classId: Number(id), // ID-ul clasei din URL
        background: newTopicBg // <--- TRIMITEM TIPUL DE FOAIE
      });

      // Reset și refresh
      setShowModal(false);
      setNewTopicTitle('');
      setNewTopicBg('white');
      fetchData();
    } catch (error) {
      console.error("Eroare creare folder:", error);
      alert("Nu am putut crea folderul.");
    }
  };

  // Funcție ajutătoare pentru a afișa iconița corectă la folder
  const getTopicIcon = (bg: string) => {
    switch(bg) {
      case 'math': return 'mb-1 text-blue-500 font-mono text-xs border border-blue-500 p-0.5 rounded';
      case 'dictando': return 'mb-1 text-green-500 font-serif text-xs border-b-2 border-green-500';
      case 'music': return 'mb-1 text-purple-500 text-xs';
      default: return 'hidden';
    }
  };

  const getTopicLabel = (bg: string) => {
     switch(bg) {
      case 'math': return '#';
      case 'dictando': return '=';
      case 'music': return '♫';
      default: return '';
    }
  };

  if (loading) return <div className="p-8">Se încarcă clasa...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-700 mb-2">← Înapoi la Panou</button>
          <h1 className="text-3xl font-bold text-gray-800">Foldere / Materii</h1>
          <p className="text-sm text-gray-500">Gestionează capitolele pentru această clasă</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 shadow flex items-center gap-2"
        >
          + Folder Nou
        </button>
      </header>

      {/* Lista de Foldere */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {topics.length === 0 && <p className="text-gray-500 col-span-4">Nu există niciun folder. Creează unul!</p>}

        {topics.map(topic => (
          <div 
            key={topic.id}
            onClick={() => navigate(`/folder/${topic.id}`)} // Vom crea pagina asta imediat
            className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition border-t-4 border-indigo-400 group relative"
          >
            {/* Iconiță vizuală pentru tipul de foaie */}
            <div className={`absolute top-2 right-2 ${getTopicIcon(topic.background)}`}>
              {getTopicLabel(topic.background)}
            </div>
            
            <div className="text-4xl mb-2 text-yellow-500 group-hover:scale-110 transition-transform">📁</div>
            <h3 className="font-bold text-lg text-gray-800">{topic.title}</h3>
            <p className="text-xs text-gray-400 mt-1 capitalize">Foaie: {topic.background === 'math' ? 'Matematică' : topic.background}</p>
          </div>
        ))}
      </div>

      {/* MODAL CREARE FOLDER */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Creează Folder Nou</h3>
            
            <form onSubmit={handleCreateTopic}>
              {/* 1. Nume Folder */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Titlu (ex: Algebră, Mecanică)</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Introduceți titlul..."
                />
              </div>

              {/* 2. Selector Tip Foaie */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Tip de Liniatură (pentru Lecții)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTopicBg('white')}
                    className={`p-2 border rounded text-sm flex items-center justify-center gap-2 ${newTopicBg === 'white' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className="w-4 h-4 bg-white border border-gray-300"></div> Albă
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewTopicBg('math')}
                    className={`p-2 border rounded text-sm flex items-center justify-center gap-2 ${newTopicBg === 'math' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className="w-4 h-4 bg-white border border-gray-300 grid grid-cols-2 grid-rows-2"><div className="border-r border-b border-gray-300"></div></div> Matematică
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewTopicBg('dictando')}
                    className={`p-2 border rounded text-sm flex items-center justify-center gap-2 ${newTopicBg === 'dictando' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                     <div className="w-4 h-4 bg-white border border-gray-300 flex flex-col justify-evenly"><div className="border-b border-gray-300"></div></div> Dictando
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewTopicBg('music')}
                    className={`p-2 border rounded text-sm flex items-center justify-center gap-2 ${newTopicBg === 'music' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    🎵 Muzică
                  </button>
                </div>
              </div>

              {/* Butoane Acțiune */}
              <div className="flex justify-end gap-3 border-t pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Anulează
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium"
                >
                  Creează Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}