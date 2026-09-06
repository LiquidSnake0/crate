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

## Grammaire des tags, relevee dans le Sheet

| Prefixe | Sens | Occurrences |
|---|---|---|
| `↓` | palier bas, 82 BPM | 81 |
| `•` | palier median, 85 a 91, ou BPM natif | 102 |
| `↑` | palier haut, 97 BPM | 35 |
| `!` | pitch superieur a 8 % | 18 |
| `⚠` | trop lent pour tout palier, joue natif | 20 |
| `★` | jungle, 134 a 147, crate separe | 7 |

## Familles

`R`, `M-`, `M`, `M+`, `B-`, `B`, `B+`, `S-`, `S`, `S+`, `V`. Codes tels qu'ils sont
ecrits dans le Sheet. Les couleurs de `FAMILY_COLOR` sont celles des stickers
physiques : ne pas les changer.

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

## Etat des donnees au 6 septembre 2026

249 morceaux, 24 albums, importes de `Crate_Barberbeats_82_92_97.xlsx` et de la
`Feuille 2` de `Finale_Barberbeats_85_5.xlsx`. Restent a remplir a la main :
114 faces, 179 familles, 4 cles et 4 BPM.

## Facon de travailler

Questions ciblees avant de partir sur une solution. Pas de refactor non demande.
Pas de nouvelle dependance sans le dire. Commits petits, nommes par fonctionnalite.
