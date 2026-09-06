import { useEffect, useState } from 'react';
import { seedIfEmpty } from './db/db';
import { AudioSourceProvider } from './audio/context';
import { Library } from './ui/Library';
import { Live } from './ui/Live';
import './App.css';

type Tab = 'crate' | 'live';

export default function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('crate');

  useEffect(() => {
    void seedIfEmpty().then(() => setReady(true));
  }, []);

  if (!ready) return <p className="loading">Ouverture du crate...</p>;

  return (
    <AudioSourceProvider>
      <nav className="tabs">
        <button className={tab === 'crate' ? 'tab tab-on' : 'tab'} onClick={() => setTab('crate')}>
          Crate
        </button>
        <button className={tab === 'live' ? 'tab tab-on' : 'tab'} onClick={() => setTab('live')}>
          Live
        </button>
      </nav>
      {tab === 'crate' ? <Library /> : <Live />}
    </AudioSourceProvider>
  );
}
