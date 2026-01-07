// src/App.tsx
import { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { apiClient } from './api/client';
import { Dashboard } from './Dashboard';
import { ClassDetails } from './ClassDetails';
import { TopicDetails } from './TopicDetails';
import { LessonWorkspace } from './LessonWorkspace';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('zest_token'));
  const navigate = useNavigate();

  // --- LOGIN / REGISTER STATE ---
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = () => {
    localStorage.removeItem('zest_token');
    setToken(null);
    navigate('/');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    
    try {
      let response;
      if (isRegistering) {
        await apiClient.post('/auth/register', { email, password, name, role });
        response = await apiClient.post('/auth/login', { email, password });
      } else {
        response = await apiClient.post('/auth/login', { email, password });
      }

      const receivedToken = response.data.access_token;
      if (receivedToken) {
        localStorage.setItem('zest_token', receivedToken);
        setToken(receivedToken);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Autentificare eșuată.');
    } finally {
      setLoading(false);
    }
  };

  // --- FORMULARUL DE LOGIN/REGISTER (Mutat direct în variabilă pt a evita rerandarea) ---
  const authForm = (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <form onSubmit={handleAuth} className="bg-white p-8 rounded shadow-lg w-96">
        <h1 className="text-2xl font-bold mb-4 text-center text-blue-900">
          {isRegistering ? 'Creează Cont ZestPad' : 'Autentificare ZestPad'}
        </h1>
        
        {error && <div className="bg-red-50 text-red-500 text-sm p-2 mb-4 rounded border border-red-200">{error}</div>}
        
        {isRegistering && (
          <div className="mb-4">
            <input 
              type="text" placeholder="Nume Complet" value={name} required
              onChange={e => setName(e.target.value)}
              className="w-full border p-2 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        <div className="mb-4">
          <input 
            type="email" placeholder="Email" value={email} required
            onChange={e => setEmail(e.target.value)}
            className="w-full border p-2 rounded focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="mb-4">
          <input 
            type="password" placeholder="Parolă" value={password} required
            onChange={e => setPassword(e.target.value)}
            className="w-full border p-2 rounded focus:outline-none focus:border-blue-500"
          />
        </div>

        {isRegistering && (
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">Rol:</label>
            <select 
              value={role} onChange={e => setRole(e.target.value)}
              className="w-full border p-2 rounded bg-white"
            >
              <option value="student">Elev</option>
              <option value="teacher">Profesor</option>
              <option value="parent">Părinte</option>
            </select>
          </div>
        )}

        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 font-bold mb-4">
          {loading ? 'Se procesează...' : (isRegistering ? 'Înregistrează-te' : 'Intră în cont')}
        </button>

        <div className="text-center text-sm">
          <button 
            type="button"
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
            className="text-blue-600 hover:underline"
          >
            {isRegistering ? 'Ai deja cont? Loghează-te' : 'Nu ai cont? Înregistrează-te'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={token ? <Dashboard onLogout={handleLogout} /> : authForm} />
      <Route path="/class/:id" element={token ? <ClassDetails /> : <Navigate to="/" />} />
      <Route path="/topic/:id" element={token ? <TopicDetails /> : <Navigate to="/" />} />
      <Route path="/lesson/:id" element={token ? <LessonWorkspace /> : <Navigate to="/" />} />
    </Routes>
  );
}

export default App;