# Retro Invaders

Jeu de type Space Invaders en HTML/CSS/JavaScript pur, sans dépendance, jouable sur ordinateur et smartphone.

## Fonctionnalités

- 2 modes visuels, tous deux avec scanlines :
  - **Mode 1** : monochrome bleu, style années 70
  - **Mode 2** : néon multicolore, style années 80
- 3 niveaux de difficulté (Facile, Normal, Difficile)
- Sons synthétisés (Web Audio) propres à chaque mode : tirs, explosions, marche des envahisseurs, soucoupe
- Boucliers destructibles, soucoupe bonus, niveaux progressifs, meilleur score sauvegardé par mode
- Affichage **Plein écran** (s'adapte à l'écran du smartphone) ou **Taille réelle** (360×480)

## Contrôles

| | Déplacer | Tirer | Pause | Menu |
|---|---|---|---|---|
| **PC** | ← → | ↑ ou Espace | P | Échap |
| **Mobile** | glisser ← → | glisser ↑ ou toucher l'écran | quitter l'app / onglet | — |

## Lancer en local

Ouvrir `index.html` dans un navigateur. Aucun build n'est nécessaire.

## Sur GitHub Pages

Le jeu sera accessible à https://byjpe.github.io/retro-invaders/.

Sur iPhone, Safari ne propose pas l'API plein écran : utiliser « Ajouter à l'écran d'accueil » pour jouer sans barre d'adresse.

## Structure

```
index.html   page et menu d'accueil
style.css    thèmes 70s / 80s, scanlines, menu
game.js      moteur, rendu canvas, contrôles, sons
```

## Licence

MIT, voir `LICENSE`.
