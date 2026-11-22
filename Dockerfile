# Middagsplanlegger – app (Vite-bygg) og liten server (tilbud live fra Tjek).
# Bygg:  docker build -t middagsplanlegger .
# Kjør:  se docs/hosting.md (avsnitt «Kjøre med Docker»).
# Ingen hemmeligheter i imaget: nøkler og andre innstillinger sendes inn som miljøvariabler ved start.
#
# Node-versjon: synk-serveren bruker `node:sqlite`, som er EKSPERIMENTELL i Node 22 (skriver «ExperimentalWarning» ved
# start, og grensesnittet kan endres mellom versjoner). Versjonen er derfor festet til den som er prøvd. Bytt den bare
# med en ny kjøring av synk-testene og en gjenopprettingsøvelse (docs/hosting.md, avsnitt «node:sqlite»).
# Eldre Node 22 enn 22.13 trenger etter min kunnskap flagget --experimental-sqlite og er ikke støttet her.
ARG NODE_VERSION=22.23.5

# ---- 1. Bygg appen --------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY server ./server
# Samme som `npm run build`: typesjekk + vite build -> dist/
RUN npm run build

# ---- 2. Kjøremiljø --------------------------------------------------------
# Serveren er TypeScript og startes med tsx (en devDependency) og importerer fra src/.
# Derfor tar vi med node_modules, src og server. Når serveren får et eget byggesteg
# kan dette trinnet bli mindre (bare dist + kompilert server).
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/dist ./dist
# Datakatalog for synk-databasen (SQLite: /data/middag.sqlite, pluss middag.sqlite-wal og -shm mens serveren kjører).
# Monter et volum her, ellers forsvinner husstandene når containeren byttes. Prosessen kjører som uid/gid 1000 (node):
# et vertskatalog-volum («bind mount») må eies av 1000:1000, et navngitt Docker-volum arver eierskapet herfra.
# Sett SYNC_SECRET (se docs/synk.md, docs/hosting.md).
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8787
# Helsesjekk: GET /healthz kjører SELECT 1 mot synk-databasen (200, ellers 503) uten innhold eller autentisering,
# og GET / må gi 200 (appen er bygget). Bruker ikke /api/offers: den starter et oppslag mot Tjek.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const b='http://127.0.0.1:'+(process.env.PORT||8787);fetch(b+'/healthz').then(r=>{if(!r.ok)throw 1;return fetch(b+'/')}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "server"]
