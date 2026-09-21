# Lecteur d’histoires

Route permanente : `/app/histoires/lire?id=ID_POCKETBASE`. Le catalogue utilise cette route, qui existe même pour une histoire créée après le build. Les anciennes URL `/app/histoires/ID` générées restent compatibles.

## Structure constatée

« Jardin magique » (`1a844mjzqx1uigg`) est accessible sans terminer l’histoire précédente, dans le catalogue comme dans le lecteur. Son statut Premium reste contrôlé par PocketBase. Ses 24 pages sont chargées à chaque ouverture depuis `pages_histoires`, filtrées par la relation `histoire` et triées par `ordre` ; leurs illustrations utilisent les fichiers PocketBase, sans copie locale ni ordre codé en dur.

- `histoires` : `titre`, `couverture`, `ordre`, `premium`, `description`, `difficulte`.
- `pages_histoires` : `histoire`, `ordre`, `image` (fichier), `texte`, `signe_associe` (relation multiple).
- `signes` : `mot`, `video`, `image`, `categorie`, `premium`.
- Fin de lecture : `users.histoires_terminees`, déjà utilisé par la progression.

Les 17 enregistrements de la rentrée existent. Le dernier est la récompense. La page `7h9kn076zdk77dk` avait un ordre de `-5` lors de l’audit. L’auteur a ensuite précisé que cette illustration du ballon doit être la page 16. `src/data/storyOrderCorrections.json` corrige ce cas précis à la lecture tant que cet ordre vaut `-5` : les anciennes pages 12 à 16 passent en 11 à 15 et le ballon devient la page 16. Un ordre corrigé dans PocketBase reste prioritaire. Le script applique la même réparation dans la base.

## Configuration à appliquer une fois

Le dépôt ne contient pas d’accès administrateur. Le script prépare une évolution additive, sans supprimer les anciens fichiers, champs ou relations :

```powershell
node --env-file=.env scripts/configure-stories.mjs
# Après avoir défini POCKETBASE_SUPERUSER_TOKEN dans l’environnement du terminal :
node --env-file=.env scripts/configure-stories.mjs --apply
```

Ne jamais ajouter ce jeton à une variable `PUBLIC_*`, au code client ou au dépôt. Le premier appel est un audit sans écriture. Le second inspecte les schémas puis ajoute :

- `pages_histoires.image_chemin` : texte facultatif, chemin local ou URL. Prioritaire sur `image`.
- `pages_histoires.type_page` : select simple `narration` / `recompense`.
- `signes_pages_histoires` : relations simples `page` et `signe`, nombres `ordre`, `x`, `y`, `width`, `height`.

Il renseigne les chemins des originaux, les sept placements et la récompense, et corrige uniquement l’ordre erroné connu. Il conserve les placements déjà présents et peut être relancé après une interruption. Les règles existantes ne sont pas changées ; la nouvelle collection autorise la lecture aux utilisateurs connectés selon le statut premium de l’histoire, et réserve l’écriture aux superusers.

## Ajouter une histoire sans modifier Astro

1. Créer l’histoire dans `histoires` avec son titre, sa couverture et son ordre.
2. Créer ses pages dans `pages_histoires`, relation `histoire`, ordres positifs distincts, `type_page = narration`. Télécharger l’illustration dans `image` ou renseigner `image_chemin` (laisser ce dernier vide pour utiliser le fichier).
3. Pour chaque vidéo, créer une entrée dans `signes_pages_histoires`, choisir la page et un signe existant. `ordre` règle l’ordre des vidéos. `x` / `y` sont les distances depuis le bord gauche / haut de **l’image entière**, en pourcentage ; `width` / `height` sont également des pourcentages. Les placements hors de l’image sont ignorés. Exemple : `x=70`, `y=55`, `width=25`, `height=40`.
4. Ajouter éventuellement une page `type_page = recompense`. Elle n’entre pas dans le compteur ; sans elle, l’image de récompense commune est utilisée.

Les relations sont récupérées en une requête de pages avec `expand=signe_associe,signes_pages_histoires_via_page.signe`. Les vidéos proviennent directement des fichiers des signes et ne sont jamais dupliquées.

## Compatibilité avant configuration

`src/data/storyIllustrations.json` fournit les originaux et les coordonnées des enregistrements existants uniquement, car les AVIF hébergés ne correspondent pas tous aux maquettes fournies. Il ne définit pas l’ordre de lecture. Les placements de compatibilité ne sont affichés que si la relation `signe_associe` est présente et développée par PocketBase. Aucune association n’est déduite du nom de fichier.

Dès que `type_page` est renseigné, le lecteur utilise exclusivement les champs et placements PocketBase. Pour les nouvelles histoires, appliquer la structure ci-dessus suffit. Les illustrations originales sont copiées sans retouche dans `public/images/histoires/rentree/`.

## Vérifications

Le lecteur gère les histoires vides/introuvables/verrouillées, les erreurs de réseau et de média, le refus d’autoplay via les contrôles vidéo, la réduction des animations et l’échec d’enregistrement avec un bouton Réessayer. La récompense reste visible après la fin. Relire ne rajoute pas une deuxième complétion.
