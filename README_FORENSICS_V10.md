# SHIELDPROOF V10 — module forensique (branche de test)

Cette branche ajoute `forensics.html`, un module autonome d'analyse d'indices et de scellement SHA-256, sans remplacer l'application principale.

## Utilisation
Après publication de cette branche sur GitHub Pages, ouvrir :
`https://<utilisateur>.github.io/ShieldProof/forensics.html`

## Fonctionnalités
- Calcul SHA-256 du fichier image original.
- Détection du format, dimensions et taille.
- Recherche locale de chaînes de métadonnées associées à des générateurs IA, logiciels de retouche, appareils photo et C2PA.
- Certificat JSON local.
- Conservation locale de l'original dans IndexedDB.
- Vérification ultérieure par comparaison SHA-256.
- Dossiers de constat immobilier, automobile, sinistre et colis.
- Service worker mis à jour pour mettre en cache le module.

## Limites importantes
- Les chaînes trouvées dans un fichier sont des indices seulement ; elles ne constituent pas une validation cryptographique.
- Ce module ne contient pas de modèle de classification IA entraîné sur les pixels. Il ne fournit donc aucun pourcentage « image IA ».
- L'absence de marqueur IA, EXIF ou caméra ne prouve pas qu'une image est authentique.
- L'horodatage est l'heure déclarée par l'appareil, non un horodatage tiers.
- SHA-256 établit uniquement que les octets correspondent à l'empreinte attendue. Il ne prouve ni la scène photographiée, ni la propriété d'un bien, ni l'identité du déposant.
- Le stockage IndexedDB est local à ce navigateur/appareil. Exporter le certificat et conserver une copie de l'original.
- Les signatures C2PA et les identités des signataires ne sont pas encore vérifiées cryptographiquement dans ce module.

## Validation avant fusion
Tester sur Android et ordinateur avec :
1. JPEG original de téléphone avec EXIF.
2. JPEG recompressé et capture d'écran.
3. PNG et WebP.
4. Image générée par plusieurs services IA, avec et sans métadonnées.
5. Fichier modifié après scellement.
6. Certificat JSON altéré.
7. Mode hors ligne après première visite.

Ne pas fusionner dans `main` avant revue, tests et validation du parcours utilisateur.
