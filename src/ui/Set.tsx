import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Track } from '../model/types';
import { FAMILY_COLOR, FAMILY_INK } from '../model/types';
import { deriveTag } from '../model/camelot';
import { envoyerCue, envoyerPlay, envoyerTake, moteurUrl, oublierMoteurUrl, setMoteurUrl, type Reponse } from '../model/moteur';
import { Cover } from './Cover';

// UN SET ENREGISTRE NE VEUT PAS DE SURPRISE. L'ecran Live classe des suites possibles ;
// ici l'ordre est decide d'avance et le crate ne fait que suivre ce que le DJ dit : le
// disque suivant est cale au casque (cue), puis il passe en salle (take). Rien n'est
// calcule, rien n'est propose. C'est l'ecran du studio.
//
// Le set est l'ensemble des morceaux dont les notes commencent par son nom, dans l'ordre
// de la playlist (plIndex) : c'est ce que l'import de la playlist ecrit.

const CLE_NOM = 'crate:set:nom';
const CLE_POS = 'crate:set:position';

function lire(cle: string, defaut: string): string {
  try { return localStorage.getItem(cle) ?? defaut; } catch { return defaut; }
}
function garder(cle: string, v: string): void {
  try { localStorage.setItem(cle, v); } catch { /* rien */ }
}

function Etiquette({ t }: { t: Track }) {
  const tag = deriveTag(t.key, t.bpm, t.anchorBpm);
  return (
    <span
      className="tag"
      style={
        t.family
          ? { background: FAMILY_COLOR[t.family], color: FAMILY_INK[t.family] }
          : { border: '1px dashed var(--line)', color: 'var(--muted)' }
      }
    >
      {tag ? tag.text : '?'}
    </span>
  );
}

export function SetScreen() {
  const [nom, setNom] = useState(() => lire(CLE_NOM, 'Mix 2'));
  const [url, setUrl] = useState(moteurUrl());
  // -1 : rien n'a encore ete lance ; n : le morceau n joue, n+1 est le suivant.
  const [position, setPosition] = useState(() => Number(lire(CLE_POS, '-1')));
  const [cale, setCale] = useState(false);
  const [journal, setJournal] = useState<Reponse[]>([]);

  useEffect(() => { garder(CLE_NOM, nom); }, [nom]);
  useEffect(() => { garder(CLE_POS, String(position)); }, [position]);
  // Un autre set, une autre position : on ne reprend pas « 3 / 15 » d'un essai d'hier.
  const [nomVu, setNomVu] = useState(nom);
  useEffect(() => { if (nom !== nomVu) { setNomVu(nom); setPosition(-1); setCale(false); } }, [nom, nomVu]);

  const tous = useLiveQuery(() => db.tracks.toArray(), [], [] as Track[]);
  const set = useMemo(
    () => tous
      // « mix2 » ou « Mix 2 » : les espaces et la casse ne comptent pas.
      .filter((t) => (t.notes ?? '').toLowerCase().replace(/\s+/g, '').startsWith(nom.toLowerCase().replace(/\s+/g, '')))
      .sort((a, b) => (a.plIndex ?? 0) - (b.plIndex ?? 0)),
    [tous, nom],
  );

  const courant = position >= 0 ? set[position] : undefined;
  const suivant = set[position + 1];

  const noter = (r: Reponse) => setJournal((j) => [r, ...j].slice(0, 8));

  // L'ETAT D'ABORD, LE RESEAU ENSUITE. Le geste est fait aux platines ; l'ecran le montre
  // tout de suite, et le moteur est prevenu en arriere-plan. Un moteur qui ne repond pas
  // se lit dans le journal, il ne fige pas l'ecran. Un second tap dans la seconde est
  // ignore : deux « take » de suite feraient repartir le master de zero.
  const dernierGeste = useRef(0);
  const unGeste = () => { const t = Date.now(); if (t - dernierGeste.current < 800) return false; dernierGeste.current = t; return true; };

  const demarrer = () => {
    if (!set[0] || !unGeste()) return;
    setPosition(0);
    setCale(false);
    void envoyerPlay(set[0]).then(noter);
  };
  const caler = () => {
    if (!suivant || !unGeste()) return;
    setCale(true);
    void envoyerCue(suivant).then(noter);
  };
  const passer = () => {
    if (!suivant || !unGeste()) return;
    // Il passe sans avoir ete cale : le moteur recoit quand meme la fiche, puis le passage.
    const promesse = cale ? Promise.resolve() : envoyerCue(suivant).then(noter);
    setPosition(position + 1);
    setCale(false);
    void promesse.then(envoyerTake).then(noter);
  };

  return (
    <div className="pad">
      <div className="set-reglages">
        <label className="set-champ">
          <span>set</span>
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Mix 2" />
        </label>
        <label className="set-champ">
          <span>moteur</span>
          <span className="set-url">
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setMoteurUrl(e.target.value); }}
              onBlur={() => setUrl(moteurUrl())}
              placeholder="http://192.168.1.111:5099"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <button className="ghost" type="button" title="l'hote de cette page"
              onClick={() => { oublierMoteurUrl(); setUrl(moteurUrl()); }}>↺</button>
          </span>
        </label>
      </div>

      {set.length === 0 ? (
        <p className="set-vide">Aucun morceau dont les notes commencent par « {nom} ».</p>
      ) : (
        <>
          <div className="now">
            {courant ? (
              <>
                <Cover track={courant} size={72} />
                <div className="now-id">
                  <span className="now-code">{position + 1} / {set.length}</span>
                  <Etiquette t={courant} />
                  <span className="now-title">{courant.title}</span>
                </div>
              </>
            ) : (
              <div className="now-id">
                <span className="now-code">—</span>
                <span className="now-title">rien ne joue encore</span>
              </div>
            )}
            <div className="now-actions">
              {!courant && (
                <button className="ghost" onClick={demarrer}>demarrer</button>
              )}
              {courant && (
                <button className="ghost" onClick={() => { setPosition(-1); setCale(false); }}>
                  recommencer
                </button>
              )}
            </div>
          </div>

          {courant && suivant && (
            <div className="set-suivant">
              <article className="row">
                <div className="row-main">
                  <Cover track={suivant} size={56} />
                  <span className="code">{position + 2}</span>
                  <span className="row-id">
                    <Etiquette t={suivant} />
                    <span className="row-title">{suivant.title}</span>
                    <span className="row-why">{suivant.artist} · {suivant.anchorBpm ?? suivant.bpm ?? '?'} BPM</span>
                  </span>
                </div>
              </article>
              <div className="set-gestes">
                <button className={cale ? 'ghost' : 'ghost ghost-on'} onClick={caler} disabled={cale}>
                  {cale ? 'cale au casque ✓' : 'je le cale au casque'}
                </button>
                <button className={cale ? 'ghost ghost-on' : 'ghost'} onClick={passer}>
                  il passe en salle
                </button>
              </div>
            </div>
          )}
          {courant && !suivant && <p className="set-vide">Dernier morceau du set.</p>}

          <div className="list set-liste">
            {set.map((t, i) => (
              <article key={t.id} className={`row${i === position ? ' row-on' : i < position ? ' row-off' : ''}`}>
                <div className="row-main">
                  <Cover track={t} size={40} />
                  <span className="code">{i + 1}</span>
                  <span className="row-id">
                    <span className="row-title">{t.title}</span>
                    <span className="row-why">
                      {t.artist}{t.bpm ? ` · ${t.bpm} BPM` : ' · pas de fiche'}{t.key ? ` · ${t.key}` : ''}
                    </span>
                  </span>
                  <Etiquette t={t} />
                </div>
              </article>
            ))}
          </div>

          {journal.length > 0 && (
            <ul className="set-journal">
              {journal.map((r, i) => (
                <li key={i} className={r.ok ? '' : 'set-erreur'}>
                  {r.at} {r.quoi} → {r.status || 'injoignable'}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
