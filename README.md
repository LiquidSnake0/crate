# Crate

Outil personnel pour un crate vinyle de barber beats et vaporwave. PWA, sans backend,
tout tourne dans le navigateur.

**En ligne : https://liquidsnake0.github.io/crate/**

## Ce que ça fait

- **Corriger le crate morceau par morceau** : face, couleur de genre, clé Camelot, BPM.
  Chaque champ est écrit dans IndexedDB dès la sortie du champ, sans bouton Enregistrer.
- **Signaler les erreurs de saisie.** Le tag Camelot pitché n'est pas stocké, il est
  dérivé de (clé, BPM, BPM joué). Le tag historique est gardé comme témoin : quand les
  deux divergent, un des trois champs est faux, et l'app le dit.
- **Classer les enchaînements en live.** On tape le morceau en cours, l'app ordonne les
  suites possibles selon le tempo, la couleur et la roue Camelot. Chaque enchaînement
  joué ou refusé est enregistré, et un jugement rendu écrase toujours le calcul.
- **Saisir les nouveaux achats**, avec le tag calculé pendant la frappe.

## Le tempo est une rampe

Sur un set d'une heure, chaque morceau gagne environ 1 BPM, ce qui mène de 82 à 97 en
dix-sept morceaux. Les trois tranches du système de tags ne sont donc pas des catégories
exclusives, ce sont trois stations sur une montée. Le classement des candidats vise le
tempo suivant sur cette rampe, dont le pas est réglable.

## Développement

```
npm install
npm run dev      # http://localhost:5173/crate/
npx vitest run
npm run build
```

`base` vaut `/crate/` en dev comme en build, pour que le local se comporte comme
GitHub Pages.

Les tests verrouillent la dérivation des tags sur des données réelles : la formule
doit reproduire les 245 tags du classeur d'origine à l'identique, préfixe et point
d'exclamation compris, et retrouver les 245 BPM joués.

Le détail du domaine est dans `CLAUDE.md`.
