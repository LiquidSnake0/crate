# Crate

Outil perso pour le crate vinyle de Selim (barber beats / vaporwave). Trois usages :

1. **Corriger** le crate morceau par morceau : une face manquante, un BPM faux,
   une couleur absente, une cle erronee. Fait a la main, c'est le fond du travail.
2. **Juger en live** : on tape le morceau en cours, l'app classe les suites
   possibles, et chaque enchainement joue ou refuse est enregistre.
3. **Saisir** les nouveaux achats, puisque le classeur ne sert plus.

Deploye en PWA sur GitHub Pages, installee sur l'ecran d'accueil de l'iPhone.

## Stack

Vite + React + TypeScript, Dexie (IndexedDB), zero backend. Vitest pour les tests,
vite-plugin-pwa pour le service worker et le manifeste.

**`base` vaut `/crate/`, en dev comme en build**, pour que le local se comporte
comme GitHub Pages. En developpement l'app est donc sur `http://localhost:5173/crate/`.

## Le tempo est une rampe, pas une tranche

Sur un set d'une heure, **chaque morceau gagne environ 1 BPM**. A dix-sept morceaux
l'heure, cela mene de 82 a 99, c'est-a-dire de la tranche basse a la tranche haute.
Sur un set plus long le pas descend, jusqu'a 0,1 BPM.

Les trois tranches ne sont donc pas des categories exclusives : ce sont **trois
stations sur une montee**. Passer de `↓82` a `↑97` n'est pas un mur, c'est ce que
fait le set en entier. En revanche un enchainement isole doit rester proche de la
cible du moment, d'ou la cloche etroite de `tempoFactor`.

Consequence de conception : `tempoFactor` decroit continument et jamais par paliers.
Un palier plus large que le pas de rampe rendrait la rampe invisible, et a 0,1 BPM
ce serait pire.

## Le scoring, trois axes qui se multiplient

`p = tempo^wt × couleur^wc × camelot^wk`, zero si c'est le meme disque.

Ils se multiplient et ne s'additionnent pas : un axe a zero doit tuer le candidat,
pas se faire rattraper par les deux autres. **Un verdict rendu domine toujours le
calcul** : le calcul sert a ordonner ce qui n'a pas encore ete juge, jamais a
corriger un jugement.

Les coefficients sont provisoires et regles depuis l'interface. **Demander avant de
changer la formule.** L'appariement des couleurs en deux voies (`LANE` dans
`scoring.ts`) est une hypothese tiree de la forme de la palette, pas une regle
ecrite : a valider.

## Regles du domaine

- **Le tag Camelot n'est pas une donnee, c'est une vue** sur (cle, bpm, bpm joue).
  Le stocker, c'est le desynchroniser des la premiere correction de bpm.
  `src/model/camelot.ts` derive le tag ; `camelot.test.ts` verifie qu'il reproduit
  les 245 tags du Sheet a l'identique.
- **Un demi-ton = +7 positions sur la roue Camelot**, la lettre ne bouge pas.
- **`anchorBpm` est une decision de DJ, pas un calcul.** `suggestAnchor` ne sert qu'a
  pre-remplir un champ vide. Une valeur saisie gagne toujours.
- **`legacyTag` n'est jamais reecrit.** Il sert de temoin : quand le tag calcule en
  diverge, c'est qu'un des trois champs est faux, et l'app le signale.
- **Un fichier importe qui ne correspond a aucun morceau n'est pas ajoute au crate.**
  Le crate est la liste physique des disques, pas le contenu d'un dossier.

## Les trois tranches, arretees le 26 aout 2026

**La fleche designe la tranche, pas la direction du fader.** La direction se regle
a l'oreille au beatmatch ; la tranche est un etat porte toute la soiree, qu'il faut
relire d'un coup d'oeil sur l'etiquette. Ne pas re-proposer d'y mettre la direction.

| Prefixe | Tranche | BPM natif | BPM joue | n |
|---|---|---|---|---|
| `↓` | 82 | jusqu'a 82 | 82 | 81 |
| `•` | 92, transition | 82 a 92 | son tempo, 85 minimum | 102 |
| `↑` | 97 | 92 a 110 | 97 | 35 |
| `★` | special | 122 a 150 | inchange | 7 |
| `⚠` | hors fader | trop lent pour sa tranche | natif | 20 |

Le fader d'une PLX MK7 fait +-8 % par defaut et +-16 % en mode etendu :
- `!` = depasse 8 %, **passer la platine en +-16 avant de lancer** (18 morceaux) ;
- `⚠` = depasse 16 %, la platine ne suit pas, le morceau se joue natif (20 morceaux).

Frontiere mesuree sur le classeur : 71,27 BPM est le dernier morceau jouable en
tranche 82 (+15,1 %), 70,08 le premier hors fader (+17,0 %).

## Les couleurs

**Le genre n'a pas de colonne : il est porte par la couleur du tag**, dans le
classeur comme dans l'app. On classe par couleur, pas par code.

**Les pastilles ne portent aucun texte.** Ecrire `M+` a cote de la teinte reviendrait
a admettre que la teinte ne suffit pas, alors que la palette a justement ete mesuree
pour se passer d'etiquette. Le code reste en `title` et en `aria-label`.
Corollaire : `S+` est absent de `PICKABLE_FAMILIES`, car il partage le noir de `S` et
serait indistinguable sans texte. Il ne compte aucune piste.

Les valeurs de `FAMILY_COLOR` sont lues dans les remplissages de la colonne Tag du
classeur et validees le 27 aout 2026 par mesure d'ecart DeltaE sur planche imprimee
(`~/Downloads/planche-palettes.pdf`). **La teinte porte la famille, la clarte porte
la nuance, jamais l'inverse.** Ne pas les retoucher sans refaire la mesure.

| Famille | Couleur | n |
|---|---|---|
| `M-` / `M` / `M+` | `#7FB3D5` / `#2E86C1` / `#154360` | 46 / 75 / 52 |
| `B-` / `B` / `B+` | `#C0CA33` / `#689F38` / `#33691E` | 19 / 25 / 3 |
| `R` | `#EC407A` | 10 |
| `V` | `#6A1B9A` | 5 |
| `S-` (pont ~97, pas un special) | `#FFB74D` | 3 |
| `S` (130-140) | `#000000`, blanc sur noir | 7 |

Le B etait rouge dans le classeur historique, bascule en vert le 26 aout parce que
le rouge se confondait avec le rose et le violet a la lecture rapide. **Le `S` est
noir : un special est une rupture, pas une nuance de plus, donc il sort de la palette
au lieu d'y etre range.** `S+` n'a aucune piste et donc aucune couleur mesuree.

## Contraintes iOS, connues et assumees

- **Pas de File System Access API dans Safari iOS.** On ne peut pas pointer un dossier
  et le garder. Le seul chemin est le selecteur de fichiers, qui rend des `File` que
  l'on copie dans IndexedDB. Ajouter un album implique de reimporter.
- **Safari peut evincer le stockage sous pression disque.** D'ou le partage : ce qui
  est cher a refaire entre dans l'export, ce qui se retelecharge n'y entre pas.
  **L'export porte les morceaux, les jugements et les pochettes** (environ 2,8 Mo),
  **jamais l'audio** (1 a 2 Go). Les pochettes ont coute une peche disque par disque
  sur Bandcamp : sans elles dans le fichier, changer d'appareil voudrait dire tout
  recommencer, et c'est exactement ce que l'export doit eviter.
- **Chaque origine a sa propre base.** `localhost` et `liquidsnake0.github.io` ne
  partagent rien, l'iPhone non plus. Le fichier d'export est le seul pont.
- **L'enchainement part de l'evenement `ended`, jamais d'un timer.** Safari suspend le
  JS quand l'ecran se verrouille mais laisse passer les evenements media. Corollaire :
  juger un enchainement ne peut pas se faire ecran verrouille.

## D'ou vient le son

**Selim ecoute dans Bandcamp et revient saisir dans l'app.** C'est son choix, et
il evite de stocker 1 a 2 Go sur le telephone. Chaque ligne du mode live porte donc
un lien direct vers la recherche Bandcamp du morceau.

Consequence, et c'est la contrainte qui rend ce choix viable : **l'etat du set est
persiste** dans la table `state`, onglet actif compris. iOS peut decharger une
webapp mise en arriere-plan ; revenir sur un ecran vide ou sur le mauvais onglet
casserait la boucle a chaque ecoute.

Piege a ne pas refaire : `db.state.get('live')` rend `undefined` aussi bien pendant
le chargement que quand rien n'est enregistre. Les deux cas etaient confondus, la
restauration ne s'achevait jamais au premier lancement, et la sauvegarde ne partait
donc jamais. Interroger par `where(...).toArray()` leve l'ambiguite.

La lecture dans l'app reste possible, derriere `AudioSource` (`src/audio/source.ts`),
une interface injectee par contexte :

- `MockAudioSource` : WAV synthetise a la volee, hauteur suivant la cle et clics
  suivant le bpm joue. Permet de travailler sans un seul fichier. **Source par defaut.**
- `LocalFileSource` : fichiers importes dans IndexedDB, avec extraction de la
  pochette depuis la frame APIC. Autonome et hors ligne, mais 1 a 2 Go.
- `BandcampLinkSource` : ouvre le morceau dans Bandcamp sans le lire. Voir le
  commentaire du fichier pour pourquoi la lecture n'est pas branchable.

## Etat des donnees au 6 septembre 2026

249 morceaux, 24 albums. Cle, BPM, BPM joue et tag viennent de
`Crate_Barberbeats_82_92_97.xlsx` ; **les familles viennent des couleurs de
remplissage de sa colonne Tag**, 245 sur 249 recuperees. Restent a remplir a la
main : 114 faces, 4 couleurs, 4 cles et 4 BPM.

## Les pochettes

**Elles sont deja posees, les 24.** Recuperees le 6 septembre 2026 depuis les pages
d'album Bandcamp. Les originaux pleine resolution sont dans `~/Documents/crate-pochettes`,
hors du depot : ce sont des oeuvres sous droits, elles n'ont rien a faire dans un
depot public.

Deux pieges rencontres ce jour-la, a ne pas refaire :
- **La collection Bandcamp de Selim est vide** (`collection_count: 0`). Ses disques ne
  sont pas des achats rattaches a son compte, il n'y a rien a extraire de son profil.
  Les pages d'album publiques, elles, portent tout.
- **L'API `autocomplete_elastic` rend un champ `img` qui pointe sur une URL 404.**
  L'art d'album porte un prefixe `a` : `f4.bcbits.com/img/a<id>_10.jpg`. La source
  fiable est la balise `og:image` de la page de l'album, dont on remplace le suffixe
  de taille par `_10` pour la pleine resolution.

Trois chemins pour en poser de nouvelles, du plus large au plus fin :

1. **Un dossier entier** (`webkitdirectory`). Les images telechargees de Bandcamp
   s'appellent rarement d'apres l'album, souvent `cover.jpg` : **ce qui porte le nom
   de l'album, c'est le dossier**, d'ou la lecture de `webkitRelativePath` en priorite.
2. **Des images choisies une a une**, associees par leur nom de fichier.
3. **A la main**, dans la grille de l'ecran Pochettes ou sur la fiche d'un morceau.

`matchDisc` ne devine jamais : si le chemin vise zero ou plusieurs disques, l'image
est signalee et rien n'est ecrit. Un choix manuel n'est jamais ecrase par un import.

Les images sont reduites a 600 px avant stockage. Une pochette Bandcamp pese environ
500 Ko, soit 12 Mo pour le crate ; a 600 px, environ 10 Ko piece, soit 250 Ko.

Un import MP3 lit aussi la pochette dans la frame APIC, une seule fois par disque.

## La playlist Bandcamp "Physical"

**https://bandcamp.com/liquidsnake_/playlist/physical** (compte `liquidsnake_`, pas
`swave`, dont la collection est vide). 245 pistes, 24 albums, 19 h 18. C'est la
contrepartie numerique du crate physique et la source des durees et des pochettes.

245 + 4 = 249 : **les quatre pistes `?1` / `?2` du classeur n'ont pas de contrepartie
Bandcamp.** Elles sont sur le vinyle sans exister dans la playlist, d'ou l'absence de
cle, de bpm et de duree. Ce n'est pas un oubli de saisie.

Le rapprochement a mis au jour **deux fautes de frappe dans le classeur**, corrigees :
`甘い苦味w` sans le `w`, et `COSMOS- BEGINNER'S GUIDE` avec deux-points.
L'identifiant d'un morceau contenant son titre, corriger un titre creerait un doublon :
la table `RENAMED` de `db.ts` migre l'ancien identifiant vers le nouveau en gardant le
travail fait a la main, et reprend le titre du seed et non celui de l'ancien.

La page charge par lots de 50 au defilement, et seul un defilement reel declenche la
suite : regler `scrollTop` en JavaScript ne charge rien.

## Les faces ne sont pas deductibles

**Bandcamp ne connait pas les faces d'un vinyle**, et la duree ne permet pas de les
retrouver. Mesure sur les treize disques deja renseignes : **une face va de 4,9 a
32,4 minutes**, et le nombre de faces ne suit pas la duree totale (62 min en 2 faces,
48 min en 4). Le decoupage depend du pressage, pas d'une regle.

Ce qui est sur, en revanche : **l'ordre de la playlist suit exactement l'ordre
(face, position)**, verifie sur 13 disques sur 13 sans une divergence, et les onze
disques restants ont le meme ordre par numero de piste. Il ne manque donc que les
coupures.

D'ou l'ecran Faces : l'album s'affiche dans l'ordre, Selim pose une a trois coupures
par disque, l'app remplit A/B/C/D et renumerote a partir de 1 sur chaque face. Les
boutons "2 faces" et "4 faces" proposent un decoupage a durees egales comme point de
depart, jamais comme verdict.

**Ne pas ecrire de faces devinees.** Un `B4` faux tromperait Selim aux platines, ce
qui est pire qu'un sigle vide qui se voit.

## La rampe se calcule, elle ne se regle plus

Le curseur du mode live donne **la duree du set**, pas le pas. `rampPlan` en deduit
combien de BPM gagner par morceau, a partir des durees reelles et du chemin restant
jusqu'a 97.

Mesure sur le crate : 285 s de moyenne, donc 12,6 morceaux dans une heure, donc
**1,19 BPM par morceau pour mener 82 a 97**. La regle du "+1 BPM" que Selim appliquait
a l'oreille tombe juste. Le pas est recalcule a chaque morceau : prendre du retard le
fait monter.

Le temps ecoule est la somme des durees jouees, pas une horloge : poser le telephone
entre deux disques ne doit pas fausser le plan.

## Le classeur est de l'histoire

Les deux `.xlsx` sont des valeurs saisies avant l'existence de l'app. Ils ont servi
une fois, au depart. **Tout nouveau morceau entre par l'ecran de saisie**, plus par
le classeur.

## Facon de travailler

Questions ciblees avant de partir sur une solution. Pas de refactor non demande.
Pas de nouvelle dependance sans le dire. Commits petits, nommes par fonctionnalite.
