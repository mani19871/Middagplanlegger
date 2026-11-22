# Middagsplanlegger – app (Vite-bygg) og liten server (synk, tilbud live fra Tjek).
# Bygg:  docker build -t middagsplanlegger .
# Kjør:  se docs/hosting.md (avsnitt «Kjøre med Docker»).
# Ingen hemmeligheter i imaget: nøkler og andre innstillinger sendes inn som miljøvariabler ved start.
#
# Tre trinn: (1) bygg appen og serveren, (2) hent bare `node` fra det offisielle Node-imaget, (3) et tomt alpine-image med
# node, den bygde serveren (dist-server/index.mjs, én fil uten npm-avhengigheter) og den bygde appen (dist/).
# Endelig image har ikke npm, yarn, node_modules, kildekode, tsx eller byggeverktøy.
#
# Node-versjon: synk-serveren bruker `node:sqlite`, som er EKSPERIMENTELL i Node 22 (skriver «ExperimentalWarning» ved
# start, og grensesnittet kan endres mellom versjoner). Versjonen er derfor festet til den som er prøvd. Bytt den bare
# med en ny kjøring av synk-testene og en gjenopprettingsøvelse (docs/hosting.md, avsnitt «node:sqlite»).
# Eldre Node 22 enn 22.13 trenger etter min kunnskap flagget --experimental-sqlite og er ikke støttet her.
# ALPINE_VERSION må være samme alpine-utgave som node-imaget bygger på (`docker run --rm node:<versjon>-alpine cat /etc/alpine-release`),
# fordi node-programmet er bygget mot musl og libstdc++ fra nettopp den utgaven.
ARG NODE_VERSION=22.23.5
ARG ALPINE_VERSION=3.24.4

# ---- 1. Bygg appen og serveren --------------------------------------------
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY server ./server
COPY scripts/build-server.mjs ./scripts/build-server.mjs
# `npm run build`: typesjekk + vite build -> dist/.  `npm run build:server`: esbuild -> dist-server/index.mjs.
RUN npm run build && npm run build:server

# ---- 2. Kjøremiljø --------------------------------------------------------
FROM alpine:${ALPINE_VERSION} AS runtime
ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data
# node + de to delte bibliotekene det trenger (musl er allerede med i alpine). Ingen `apk add`: bygget trenger ikke nett her.
COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY --from=build /usr/lib/libstdc++.so.6* /usr/lib/libgcc_s.so.1 /usr/lib/
# Bruker `node` med uid/gid 1000, som i det offisielle Node-imaget (docs/hosting.md, «Volum, filrettigheter»).
RUN addgroup -g 1000 node && adduser -u 1000 -G node -s /sbin/nologin -D node \
 && mkdir -p /data /app && chown node:node /data
WORKDIR /app
# Filene eies av root og kan ikke skrives av prosessen; bare /data er skrivbar.
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
# Datakatalog for synk-databasen (SQLite: /data/middag.sqlite, pluss middag.sqlite-wal og -shm mens serveren kjører).
# Monter et volum her, ellers forsvinner husstandene når containeren byttes. Prosessen kjører som uid/gid 1000 (node):
# et vertskatalog-volum («bind mount») må eies av 1000:1000, et navngitt Docker-volum arver eierskapet herfra.
# Sett SYNC_SECRET (se docs/synk.md, docs/hosting.md).
USER node
EXPOSE 8787
# Helsesjekk: GET /healthz kjører SELECT 1 mot synk-databasen (200, ellers 503) uten innhold eller autentisering,
# og GET / må gi 200 (appen er bygget). Bruker ikke /api/offers: den starter et oppslag mot Tjek.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const b='http://127.0.0.1:'+(process.env.PORT||8787);fetch(b+'/healthz').then(r=>{if(!r.ok)throw 1;return fetch(b+'/')}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Samme som `npm start`. (`npm run server` = tsx, bare for utvikling.)
CMD ["node", "dist-server/index.mjs"]
