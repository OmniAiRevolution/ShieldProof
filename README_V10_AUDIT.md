# SHIELDPROOF V10 — audit fixes

Cette branche restaure une version complète de l'application depuis l'historique Git (commit de base `58921e37e0092f5685886c7b650d3221bd511184`) puis applique des corrections V10. Elle ne remplace pas `main`.

## Changements intégrés

- `index.html` complet restauré (structure HTML entière, UI et parcours existants conservés).
- `processFileScan()` réécrite : type image contrôlé, limite 25 Mo, timeout de lecture/hash/miniature, timeout de 6 s sur l'analyse heuristique, timeout de 15 s sur OCR, `try/catch/finally` et réinitialisation de l'interface.
- Détection heuristique existante conservée : signatures textuelles, statistiques de pixels, bruit, saturation et score indicatif. Ce n'est PAS un modèle ML et cela ne peut pas garantir qu'une image est réelle ou générée.
- Score heuristique conservé dans les preuves, la liste, le texte de partage et le PDF.
- IndexedDB migrée en version 2 avec magasin de clés ECDSA P-256.
- Signature ECDSA locale du certificat et bouton de vérification. La clé est propre à cet appareil : elle prouve seulement l'intégrité de ce certificat, pas l'identité juridique de son auteur.
- Demande d'horodatage OpenTimestamps sur le SHA-256 uniquement (aucune photo envoyée). Les reçus sont conservés et exportables en `.ots`. L'état initial est en attente : l'ancrage Bitcoin peut prendre du temps. Une réponse calendrier n'est pas encore une preuve Bitcoin confirmée.
- Bouton de lecture C2PA dans le parcours principal. Il tente d'abord le SDK local dans `vendor/c2pa-web/`, puis un chargement réseau de secours de `@contentauth/c2pa-web@0.15.4`.
- CSP meta de base, mises à jour de langue/RTL, version 10.0.0.
- Service worker versionné et script V10 ajouté au shell hors-ligne.

## Dépendances facultatives

Le dépôt ne contenait pas de bundles Tesseract, jsPDF, qrcode-generator ni du SDK C2PA. Le code garde donc les vérifications de disponibilité et les solutions de repli (OCR ignoré si absent, impression navigateur si jsPDF absent, QR omis si qrcode absent). Pour un déploiement sans CDN, les bundles doivent être récupérés depuis leurs distributions officielles, vérifiés, puis ajoutés dans un dossier `vendor/` et les chemins doivent être adaptés. Ne téléverse pas de fichiers dont la provenance/licence n'est pas claire.

Pour C2PA local, placer le bundle navigateur du paquet officiel `@contentauth/c2pa-web@0.15.4` dans `vendor/c2pa-web/` avec son WASM sous `vendor/c2pa-web/c2pa_bg.wasm`. Le chargement local est essayé en premier. Le secours réseau est autorisé par la CSP et nécessite Internet.

## Modèle de détection IA ML

Aucun poids ML n'est inclus dans cette livraison. Le modèle ONNX public `onnx-community/ai-image-detection-ONNX` est basé sur ViT/CIFAKE et son dépôt annonce environ 935 Mo ; c'est trop lourd pour l'intégrer raisonnablement dans le dépôt ou le proposer par défaut sur un téléphone Android ancien. Ses auteurs indiquent aussi des limites face aux générateurs récents et aux images compressées. Ne pas annoncer une précision de 95 % sans benchmark sur un jeu d'essai représentatif. La détection actuellement exécutée reste une heuristique locale, avec faux positifs et faux négatifs possibles.

## Limites de sécurité et preuve

- Une empreinte SHA-256 prouve que le fichier comparé a les mêmes octets que le fichier scellé. Elle ne prouve pas que la scène photographiée est vraie, ni que l'image n'a pas été modifiée avant le premier scellement.
- La signature est auto-générée sur l'appareil. Sans autorité de certification ou serveur de confiance, elle n'identifie pas une personne ou une société.
- OpenTimestamps contacte des calendriers publics gratuits et transmet uniquement le digest. Le reçu peut rester en attente jusqu'à son ancrage sur Bitcoin. La validation complète d'un reçu .ots doit être faite avec un vérificateur OpenTimestamps indépendant.
- C2PA valide la présence et les données de provenance disponibles dans le fichier. L'absence de manifeste n'est pas une preuve de falsification ; la confiance des certificats doit être interprétée selon la configuration de confiance utilisée.
- Une CSP définie par `meta` ne remplace pas les en-têtes HTTP de sécurité. `frame-ancestors` doit être défini côté hébergeur, pas dans une balise meta. Cette page utilise encore des scripts et styles inline, ce qui impose temporairement `unsafe-inline` et limite la force de la CSP.

## Vérifications à effectuer sur Android

1. Ouvrir la page en HTTPS et vérifier que la version affichée est 10.0.0.
2. Scanner une image JPEG de moins de 25 Mo.
3. Scanner un fichier non-image et un fichier de plus de 25 Mo : le scan doit être refusé proprement.
4. Couper le réseau puis scanner : SHA-256 et heuristique doivent fonctionner ; OCR dépend de la disponibilité locale de Tesseract.
5. Créer une preuve puis vérifier la signature locale.
6. Vérifier l'état OpenTimestamps : il peut être indisponible si les calendriers refusent CORS ou sont hors ligne ; si accepté, télécharger le reçu .ots et le vérifier séparément.
7. Tester C2PA sur une image avec Content Credentials et une image sans manifeste.
8. Tester les quatre langues, RTL arabe, export JSON, PDF, partage et mode hors ligne.

## Important

Cette branche n'a pas été testée sur un Huawei P30 ni sur un appareil Android réel par l'auteur de ce commit. Les tests de navigateur automatisés et les tests de conformité juridique restent à effectuer.
