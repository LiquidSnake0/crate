# Crate

Outil perso pour le crate vinyle de Selim (barber beats / vaporwave). Deux usages,
dans cet ordre :

1. **Corriger** le crate morceau par morceau : une face manquante, un BPM faux,
   une famille absente, une cle erronee. C'est le travail principal, fait a la main.
2. **Ecouter** sur iPhone pendant qu'on corrige.

Le moteur de suggestion d'enchainements (graphe, scoring bayesien) viendra plus tard.
Il n'a aucun sens tant que les donnees ne sont pas propres, et les coefficients ne
seront calibrables qu'avec de vrais jugements.

## Stack

Vite + React + TypeScript, Dexie (IndexedDB), zero backend. Vitest pour les tests.

## Regles du domaine

- **Le tag Camelot n'est pas une donnee, c'est une vue** sur (cle, bpm, bpm joue).
  Le stocker, c'est le desynchroniser des la premiere correction de bpm.
  `src/model/camelot.ts` derive le tag ; `camelot.test.ts` verifie qu'il reproduit
  les 245 tags du Sheet a l'identique.
- **Un demi-ton = +7 positions sur la roue Camelot**, la lettre ne bouge pas.
- **La fleche du tag designe le palier, pas le sens du pitch.** Les `↓` du Sheet ont
  un pitch positif : ce sont des morceaux lents remontes a 82.
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
- **Safari peut evincer le stockage sous pression disque.** D'ou la separation stricte :
  `tracks` est le travail (quelques dizaines de Ko, precieux, exporte en JSON),
  `audio` est le contenu (1 a 2 Go, jetable, reimportable). Perdre `audio` doit etre
  un non-evenement.
- **L'enchainement part de l'evenement `ended`, jamais d'un timer.** Safari suspend le
  JS quand l'ecran se verrouille mais laisse passer les evenements media. Corollaire :
  juger un enchainement ne peut pas se faire ecran verrouille.

## D'ou vient le son

`AudioSource` (`src/audio/source.ts`) est une interface, injectee par contexte.
L'app ne sait pas jouer de la musique, elle sait demander une URL a une source.

- `MockAudioSource` : WAV synthetise a la volee, hauteur suivant la cle et clics
  suivant le bpm joue. Permet de travailler la boucle de jugement sans un seul
  fichier. **Source par defaut.**
- `LocalFileSource` : fichiers importes dans IndexedDB. Autonome, hors ligne, 1 a 2 Go.
- `BandcampLinkSource` : ouvre le morceau dans Bandcamp, sans le lire. Voir le
  commentaire du fichier pour pourquoi la lecture n'est pas branchable.

## Etat des donnees au 6 septembre 2026

249 morceaux, 24 albums. Cle, BPM, BPM joue et tag viennent de
`Crate_Barberbeats_82_92_97.xlsx` ; **les familles viennent des couleurs de
remplissage de sa colonne Tag**, 245 sur 249 recuperees. Restent a remplir a la
main : 114 faces, 4 couleurs, 4 cles et 4 BPM.

## Facon de travailler

Questions ciblees avant de partir sur une solution. Pas de refactor non demande.
Pas de nouvelle dependance sans le dire. Commits petits, nommes par fonctionnalite.
