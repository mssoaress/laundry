export default function Loading({ msg = 'Carregando...' }) {
  return (
    <div className="loading-overlay">
      <div className="loading-inner">
        <img src="/img/logo-nova-lavanderia.png" alt="Logo" className="loading-logo" />
        <div className="loading-spinner" />
        <p>{msg}</p>
      </div>
    </div>
  );
}
