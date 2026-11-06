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

V2 — inscription et récupération
- Vérifier en prévisualisation avec un projet Supabase séparé et des comptes
  fictifs. Les deux variables VITE_SUPABASE_* doivent viser ce projet.
- Ajouter l'URL exacte de prévisualisation dans Auth > URL Configuration.
  Pour la mise en production, utiliser https://deftar-steel.vercel.app/
  comme Site URL et autoriser exactement cette URL. Pas de wildcard.
- Conserver la confirmation des e-mails, désactiver les connexions anonymes,
  et configurer une longueur minimale de 12 caractères dans Supabase.
- Configurer et tester un SMTP personnalisé avant d'ouvrir les inscriptions.
  Le SMTP intégré est réservé aux adresses de l'équipe, avec 2 envois/h.
- Configurer Cloudflare Turnstile dans Supabase Auth. Ajouter seulement la
  clé publique VITE_TURNSTILE_SITE_KEY à Vercel pour l'environnement voulu.
  Garder le secret du widget dans Supabase et les secrets SMTP côté serveur.
  Vérifier le widget côté navigateur avant d'activer sa vérification côté
  Supabase, qui s'applique aussi à la connexion et à la récupération.
- Les liens de confirmation et de récupération utilisent PKCE et doivent
  être ouverts dans le navigateur qui a demandé le lien.
- Avant ouverture, tester le refus avant confirmation et l'envoi réel de
  confirmation et récupération, ainsi que le refus d'accès entre comptes.
  Activer l'inscription publique de production seulement après autorisation.

La branche feature/public-registration utilise le projet indépendant
 deftar-v2-preview. Les clés de test Turnstile sont réservées à Preview.
