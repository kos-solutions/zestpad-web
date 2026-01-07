// src/Dashboard.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from './api/client';
import { jwtDecode } from 'jwt-decode';

interface DashboardProps {
  onLogout: () => void;
}

export function Dashboard({ onLogout }: DashboardProps) {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  // State pentru Join Class (Elev)
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('zest_token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        setUserRole(decoded.role || 'student');
        setUserName(decoded.name || 'Utilizator');
      } catch (e) {
        console.error("Token invalid");
      }
    }
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const res = await apiClient.get('/classes');
      setClasses(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/classes', { name: newClassName });
      setIsModalOpen(false);
      setNewClassName('');
      fetchClasses();
    } catch (error) {
      alert('Eroare la crearea clasei.');
    }
  };

  // Funcție placeholder pentru când vom face Enroll
  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode || joinCode.length < 4) {
        alert("Te rog introdu un cod valid.");
        return;
    }

    try {
      // Backend: POST /classes/join
      await apiClient.post('/classes/join', { code: joinCode });
      
      alert("Te-ai înscris cu succes!");
      setIsModalOpen(false);
      setJoinCode('');
      fetchClasses(); // Reîmprospătăm lista să apară noua clasă
    } catch (error: any) {
      console.error(error);
      // Afișăm eroarea venită de la server (ex: "Cod invalid")
      alert(error.response?.data?.message || 'Eroare la înscriere.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      
      {/* --- SIDEBAR (Stânga) --- */}
      <aside className="w-full md:w-64 bg-white shadow-md flex flex-col z-10">
        <div className="p-6 border-b flex items-center gap-2">
           <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">Z</div>
           <h1 className="text-xl font-bold text-gray-800">ZestPad</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg font-bold">
            <span>📂</span> Clasele Tale
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg">
            <span>⚙️</span> Setări Profil
          </button>
          {/* Aici putem pune buton de teme, calendar etc */}
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                {userName.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
                <p className="text-sm font-bold truncate">{userName}</p>
                <p className="text-xs text-gray-500 uppercase">{userRole === 'teacher' ? 'Profesor' : 'Elev'}</p>
            </div>
          </div>
          <button onClick={onLogout} className="w-full text-left text-sm text-red-500 hover:text-red-700 font-bold px-2">
            Ieșire Cont
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT (Dreapta) --- */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800">Panou de Control</h2>
          
          {/* BUTON DE ACȚIUNE PRINCIPAL */}
          {userRole === 'teacher' ? (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-lg font-bold flex items-center gap-2 transition transform hover:scale-105"
            >
              <span>+</span> Creează Clasă
            </button>
          ) : (
             <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg shadow-lg font-bold flex items-center gap-2 transition transform hover:scale-105"
            >
              <span>🔑</span> Înscrie-te la Curs
            </button>
          )}
        </header>

        {/* LISTA DE CLASE */}
        {classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-4xl mb-4">📭</p>
            <p className="text-xl font-medium">Nu ai nicio clasă activă.</p>
            <p className="text-sm mt-2">
                {userRole === 'teacher' ? 'Creează una nouă pentru a începe.' : 'Folosește un cod de la profesor pentru a te înscrie.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {classes.map((cls) => (
              <div key={cls.id} className="bg-white p-0 rounded-xl shadow-sm hover:shadow-lg transition duration-300 flex flex-col justify-between overflow-hidden group border border-gray-100">
                <div className="h-2 bg-blue-500 w-full"></div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-xl text-gray-800 group-hover:text-blue-600 transition">{cls.name}</h3>
                    
                    {/* ETICHETA GALBENĂ CU CODUL */}
                    {userRole === 'teacher' && (
                       <div className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded border border-yellow-300 font-mono shadow-sm" title="Codul clasei">
                         {cls.code}
                       </div>
                    )}

                  </div>
                  
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                     <span className="bg-gray-100 p-1 rounded">👨‍🏫</span> 
                     <span>{cls.teacher?.name || 'Profesor'}</span>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-end">
                  <button 
                    onClick={() => navigate(`/class/${cls.id}`)}
                    className="text-sm text-blue-600 font-bold hover:text-blue-800 flex items-center gap-1"
                  >
                    Deschide <span className="text-lg">&rarr;</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL UNIVERSAL (Folosit pt Creare sau Join) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
                {userRole === 'teacher' ? 'Creează Clasă Nouă' : 'Înscrie-te la Curs'}
            </h2>
            
            <form onSubmit={userRole === 'teacher' ? handleCreateClass : handleJoinClass}>
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                    {userRole === 'teacher' ? 'Numele Materiei' : 'Codul Primit de la Profesor'}
                </label>
                
                {userRole === 'teacher' ? (
                    <input 
                      type="text" autoFocus
                      value={newClassName} onChange={e => setNewClassName(e.target.value)}
                      className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-blue-500 transition"
                      placeholder="Ex: Fizică 7C"
                    />
                ) : (
                    <input 
                      type="text" autoFocus
                      value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                      className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-green-500 transition uppercase tracking-widest font-mono text-center text-xl"
                      placeholder="XXXXXX"
                      maxLength={6}
                    />
                )}

                <p className="text-xs text-gray-400 mt-2">
                  {userRole === 'teacher' 
                    ? 'Se va genera automat un cod unic de acces.' 
                    : 'Introdu cele 6 caractere de pe tablă.'}
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-800 font-medium">Anulează</button>
                <button 
                    type="submit" 
                    className={`px-6 py-2 text-white rounded-lg font-bold shadow-md transition transform hover:-translate-y-0.5 ${userRole === 'teacher' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    {userRole === 'teacher' ? 'Creează' : 'Înscrie-te'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}