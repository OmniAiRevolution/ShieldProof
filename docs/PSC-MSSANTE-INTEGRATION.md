# Raccordement Pro Santé Connect et MSSanté — préparation technique (non activée)

**Statut : préparation uniquement. Aucun raccordement ANS n'est actif, aucune donnée réelle ne doit être utilisée.**

## Pro Santé Connect (PSC)

- Protocole : OpenID Connect Authorization Code, **serveur confidentiel obligatoire** pour échange du code contre les jetons. Ne jamais placer client_secret, certificats, jetons ou identité patient dans GitHub Pages.
- Environnement de test : `https://auth.bas.psc.esante.gouv.fr/auth/realms/esante-wallet/.well-known/wallet-openid-configuration`
- Environnement production : `https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/.well-known/wallet-openid-configuration`
- Portail d'authentification BAS : `https://wallet.bas.psc.esante.gouv.fr/auth`
- Production : `https://wallet.esw.esante.gouv.fr/auth`
- Avant de coder le serveur : demander le raccordement et les identifiants officiels ANS, enregistrer redirect URI et logout URI. La validation de l'issuer, audience, signature, expiration, nonce/state et des droits métier est indispensable. Le champ `sub` a changé en 2026 : ne pas supposer qu'il s'agit du RPPS.
- Prévoir backend `GET /auth/psc/start`, `GET /auth/psc/callback`, `POST /auth/logout`, `GET /auth/me` ; cookie HttpOnly Secure SameSite, CSRF, journaux minimisés, aucune donnée médicale en journal.
- Pas de CORS direct navigateur vers PSC, pas d'iframe, pas d'authentification simulée. Pour la production, respecter le référentiel et exigences mTLS le cas échéant.

## MSSanté

- MSSanté n'est **pas** une API publique d'envoi libre de courriels : le logiciel métier doit être raccordé à un **opérateur MSSanté existant** via l'API LPS (référentiel MSSanté #2), ou devenir opérateur (référentiel #1).
- Choisir un opérateur et obtenir ses modalités, contrat et environnement de test. L'API LPS et les paramètres réels dépendent du raccordement.
- Prévoir backend `POST /mssante/messages` et `GET /mssante/messages` **uniquement après** intégration officielle, authentification PSC, contrôle des habilitations, consentement/base légale, chiffrement et audit. Aucun endpoint de ce type n'est implémenté ni exposé ici.
- Ne pas transmettre des documents médicaux via email ordinaire, liens publics, ou GitHub Pages. Pour patients, étudier le parcours Mon espace santé/INS avec l'opérateur.

## Sources ANS

- https://esante.gouv.fr/ens/offre/pro-sante-connect/documentation-technique
- https://esante.gouv.fr/ens/offre/pro-sante-connect/referentiel-psc
- https://esante.gouv.fr/produits-services/echange-donnees-sante/mssante/comment-integrer-la-mssante-ma-solution-logicielle
- https://esante.gouv.fr/produits-services/echange-donnees-sante/mssante/devenez-operateur-ou-integrez-la-mssante

## Tests à prévoir

1. Unitaires : nonce/state, rejet jeton expiré/signature invalide, permissions, faux RPPS.
2. Bac à sable ANS : authentification, annulation, expiration, déconnexion, droits.
3. Opérateur MSSanté : destinataire inconnu, pièces jointes, erreurs de livraison, réception, traçabilité.
4. Audit sécurité, AIPD/RGPD, HDS si hébergement concerné, tests de pénétration avant production.
