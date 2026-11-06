DEFTAR — دفتر الزبناء

Cette branche utilise Supabase Auth et PostgreSQL. L'interface reste en
darija et en français, avec les mêmes fiches, visites et filtres.

Développement et prévisualisation
- npm ci, puis npm run dev ou npm run build.
- VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY sont les deux
  variables publiques attendues au moment de la compilation.
- Appliquer le fichier de supabase/migrations sur le projet désigné.
- Créer les comptes autorisés dans Supabase Auth et désactiver
  l'inscription publique. L'application affiche uniquement la connexion.
- Sur Vercel, configurer d'abord les variables pour la branche Preview.
  N'activer le déploiement Production qu'après validation.

Migration des anciennes données
- Utiliser « Importer une sauvegarde » depuis le compte destinataire.
- Les données de l'ancienne version restent dans le stockage du
  navigateur sur leur adresse d'origine. La version cloud ouverte sur
  cette même adresse peut télécharger une copie JSON et l'importer.
- Le formulaire accepte aussi un fichier JSON déjà sauvegardé. Ne pas
  transmettre de vraies données au déploiement Preview.
- Vérifier les compteurs et l'historique après import. Les identifiants
  sources empêchent de répéter le même import et les numéros identiques
  rapprochent les visites de la fiche existante. Les homonymes sans
  numéro restent distincts. Une fiche existante conserve ses champs.
- L'import ne modifie pas et ne supprime pas la copie locale.

La branche de travail utilise un déploiement Preview dédié sur Vercel.
