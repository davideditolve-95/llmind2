# Keycloak Setup per LLMind2

## 1. Importa il Realm

1. Vai su **https://keycloak-pw9ut4s1h3aodstrsw1gd84o.89.168.29.98.sslip.io/**
2. Accedi come amministratore
3. In alto a sinistra, clicca sul menu del realm → **Create realm**
4. Clicca su **Browse...** → seleziona `keycloak/llmind2-realm.json`
5. Clicca **Create**

## 2. Configura il Client Secret

Dopo l'importazione:

1. Vai su **Clients** → `llmind2`
2. Tab **Credentials**
3. Copia il `Client secret` generato automaticamente (oppure impostane uno manuale)
4. Aggiorna il file `.env`:

```env
KEYCLOAK_CLIENT_SECRET=<il-tuo-secret>
```

## 3. Aggiorna le Redirect URI (se in produzione)

1. Vai su **Clients** → `llmind2` → tab **Settings**
2. In **Valid redirect URIs** aggiungi l'URL pubblico del frontend:
   ```
   https://tuo-frontend.dominio.com/*
   ```
3. In **Web origins** aggiungi:
   ```
   https://tuo-frontend.dominio.com
   ```

## 4. Variabili d'ambiente finali

```env
# Keycloak OIDC Config
KEYCLOAK_ISSUER=https://keycloak-pw9ut4s1h3aodstrsw1gd84o.89.168.29.98.sslip.io/realms/llmind2
KEYCLOAK_CLIENT_ID=llmind2
KEYCLOAK_CLIENT_SECRET=<copiato-dal-passo-2>
```

## 5. JWKS URL (auto-derivato)

Il backend deriva automaticamente la JWKS URL dall'issuer:
```
<KEYCLOAK_ISSUER>/protocol/openid-connect/certs
```

Non serve configurarlo separatamente, a meno che non tu voglia sovrascriverlo:
```env
KEYCLOAK_JWKS_URL=https://keycloak.../realms/llmind2/protocol/openid-connect/certs
```

## 6. Self-registration

La registrazione autonoma degli utenti è **già abilitata** nel realm importato.
Gli utenti possono registrarsi dalla pagina di login Keycloak cliccando su **Register**.

Per abilitare/disabilitare:
**Realm settings** → tab **Login** → toggle **User registration**

## 7. Funzionalità abilitate nel Realm

| Feature | Stato |
|---------|-------|
| Self-registration | ✅ |
| Login con email | ✅ |
| Reset password | ✅ |
| Remember me | ✅ |
| Brute force protection | ✅ |
| Verifica email | ❌ (opzionale, abilitabile) |
| Ruoli: `user`, `admin` | ✅ |
| Lingua italiana default | ✅ |
