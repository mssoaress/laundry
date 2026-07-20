import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, ROLES } from './lib/firebase';
import { useFirestore } from './hooks/useFirestore';
import Loading from './components/Loading';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Fichas from './pages/Fichas';
import Pendentes from './pages/Pendentes';
import Relatorio from './pages/Relatorio';
import Lavados from './pages/Lavados';
import Funcionario from './pages/Funcionario';
import { IconGrid, IconUsers, IconFile, IconAlert, IconBar, IconWasher, IconUser } from './components/Icons';

const PAGES = [
  { id: 'dashboard',  label: 'Painel',    Icon: IconGrid },
  { id: 'clientes',   label: 'Clientes',  Icon: IconUsers },
  { id: 'lancamentos',label: 'Fichas',    Icon: IconFile },
  { id: 'pendentes',  label: 'Pendentes', Icon: IconAlert },
  { id: 'relatorio',  label: 'Relatorio', Icon: IconBar },
  { id: 'lavados',    label: 'Lavados',   Icon: IconWasher },
];

export default function App() {
  const [authState, setAuthState] = useState('loading'); // 'loading' | 'login' | 'admin' | 'funcionario'
  const [userInfo, setUserInfo]   = useState(null);
  const [page, setPage]           = useState('dashboard');
  const { clientes, lancamentos, pagamentos, lavados, ready, salvarDoc } = useFirestore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { setAuthState('login'); return; }
      const info = ROLES[user.email];
      if (!info) { signOut(auth); setAuthState('login'); return; }
      setUserInfo(info);
      setAuthState(info.role);
    });
    return unsub;
  }, []);

  if (authState === 'loading') return <Loading msg="Conectando..." />;
  if (authState === 'login')   return <Login />;
  if (!ready)                  return <Loading msg="Carregando dados..." />;

  if (authState === 'funcionario') return (
    <Funcionario clientes={clientes} lancamentos={lancamentos} lavados={lavados} salvarDoc={salvarDoc} />
  );

  const renderPage = () => {
    const props = { clientes, lancamentos, pagamentos, lavados, salvarDoc };
    switch (page) {
      case 'dashboard':   return <Dashboard {...props} />;
      case 'clientes':    return <Clientes {...props} />;
      case 'lancamentos': return <Fichas {...props} />;
      case 'pendentes':   return <Pendentes {...props} />;
      case 'relatorio':   return <Relatorio {...props} />;
      case 'lavados':     return <Lavados {...props} />;
      default:            return <Dashboard {...props} />;
    }
  };

  return (
    <div className="app-shell">
      {/* SIDEBAR DESKTOP */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/img/logo-nova-lavanderia.png" alt="Lavanderia Emanoel" className="sidebar-logo" />
        </div>
        <nav className="sidebar-nav">
          {PAGES.map(({ id, label, Icon }) => (
            <button key={id} className={`sidebar-btn ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>
              <Icon /> {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user"><IconUser /><span>{userInfo?.nome}</span></div>
          <button className="btn-sair" onClick={() => { if(confirm('Deseja sair do sistema?')) signOut(auth); }}>Sair</button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main-area">
        {/* HEADER MOBILE */}
        <header className="mobile-header">
          <img src="/img/logo-nova-lavanderia.png" alt="Lavanderia Emanoel" className="mobile-header-logo" />
          <button className="btn-sair-mobile" onClick={() => { if(confirm('Deseja sair?')) signOut(auth); }}>Sair</button>
        </header>

        <div className="main-content">
          {renderPage()}
        </div>

        {/* BOTTOM NAV MOBILE */}
        <nav className="bottom-nav">
          {PAGES.map(({ id, label, Icon }) => (
            <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>
              <Icon /><span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
