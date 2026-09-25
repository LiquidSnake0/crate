import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedIfEmpty, saveLiveState } from './db/db';
import { AudioSourceProvider } from './audio/context';
import { Library } from './ui/Library';
import { Live } from './ui/Live';
import { SetScreen } from './ui/Set';
import './App.css';

type Tab = 'crate' | 'live' | 'set';

export default function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('crate');
  const saved = useLiveQuery(() => db.state.where('id').equals('live').toArray(), [], undefined);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    void seedIfEmpty().then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (restored || saved === undefined) return;
    if (saved[0]?.tab) setTab(saved[0].tab);
    setRestored(true);
  }, [saved, restored]);

  const go = (t: Tab) => {
    setTab(t);
    void saveLiveState({ tab: t });
  };

  if (!ready) return <p className="loading">Ouverture du crate...</p>;

  return (
    <AudioSourceProvider>
      {/* Un seul element colle a l'ecran, et il est en bas : deux barres sticky
          empilees en haut se chevauchaient et mangeaient la moitie du telephone. */}
      <main className="screen">{tab === 'crate' ? <Library /> : tab === 'set' ? <SetScreen /> : <Live />}</main>
      <nav className="tabs">
        <button
          className={tab === 'crate' ? 'tab tab-on' : 'tab'}
          onClick={() => go('crate')}
        >
          Crate
        </button>
        <button
          className={tab === 'live' ? 'tab tab-on' : 'tab'}
          onClick={() => go('live')}
        >
          Live
        </button>
        {/* Le set enregistre : l'ordre est decide, le crate suit et previent le moteur. */}
        <button
          className={tab === 'set' ? 'tab tab-on' : 'tab'}
          onClick={() => go('set')}
        >
          Set
        </button>
      </nav>
    </AudioSourceProvider>
  );
}
