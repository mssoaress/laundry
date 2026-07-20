import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { IconEye, IconEyeOff } from '../components/Icons';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha]     = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [erro, setErro]       = useState('');
  const [loading, setLoading] = useState(false);

  const entrar = async () => {
    setErro('');
    if (!usuario.trim() || !senha) { setErro('Preencha usuario e senha.'); return; }
    const email = usuario.trim().toLowerCase().includes('@')
      ? usuario.trim().toLowerCase()
      : `${usuario.trim().toLowerCase()}@lavanderia.com`;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch {
      setErro('Usuario ou senha incorretos.');
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src="/img/logo-nova-lavanderia.png" alt="Lavanderia Emanoel" className="login-logo" />
        <h1 className="login-title">Acesso ao sistema</h1>
        <p className="login-subtitle">Lavanderia Emanoel</p>
        <div className="form-group">
          <label>Usuario</label>
          <input
            value={usuario} onChange={e => setUsuario(e.target.value)}
            placeholder="Digite seu usuario"
            autoComplete="username" autoCorrect="off" autoCapitalize="none"
            onKeyDown={e => e.key === 'Enter' && document.getElementById('pw-input').focus()}
          />
        </div>
        <div className="form-group">
          <label>Senha</label>
          <div className="input-eye-wrap">
            <input
              id="pw-input"
              type={showPw ? 'text' : 'password'}
              value={senha} onChange={e => setSenha(e.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && entrar()}
            />
            <button className="btn-eye" type="button" onClick={() => setShowPw(v => !v)}>
              {showPw ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
        </div>
        {erro && <div className="login-erro">{erro}</div>}
        <button className="btn-login" onClick={entrar} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </div>
    </div>
  );
}
