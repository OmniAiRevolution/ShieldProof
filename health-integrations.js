// SHIELDPROOF Santé: public, non-secret integration metadata.
// No credentials or real identity flows are implemented in this static PWA.
const SHIELDPROOF_HEALTH_INTEGRATIONS = Object.freeze({
  psc: Object.freeze({
    status: 'awaiting-ans-approval-and-backend',
    protocol: 'OpenID Connect Authorization Code (confidential server)',
    sandboxDiscovery: 'https://auth.bas.psc.esante.gouv.fr/auth/realms/esante-wallet/.well-known/wallet-openid-configuration',
    productionDiscovery: 'https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/.well-known/wallet-openid-configuration',
    backendRequired: true,
    directBrowserTokenExchangeAllowed: false
  }),
  mssante: Object.freeze({
    status: 'awaiting-mssante-operator-and-api-lps-access',
    protocol: 'MSSanté API LPS through authorized operator',
    backendRequired: true,
    enabled: false
  })
});
