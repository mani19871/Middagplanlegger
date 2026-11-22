# Middagsplanlegger – app (Vite-bygg) og liten server (tilbud live fra Tjek).
# Bygg:  docker build -t middagsplanlegger .
# Kjør:  se docs/hosting.md (avsnitt «Kjøre med Docker»).
# Ingen hemmeligheter i imaget: nøkler og andre innstillinger sendes inn som miljøvariabler ved start.

# ---- 1. Bygg appen --------------------------------------------------------
FROM node:22-alpine AS build
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
FROM node:22-alpine AS runtime
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
# Datakatalog for varig lagring (tas i bruk når synk-serveren kommer; monter et volum her).
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8787
# Sjekker at serveren svarer og at appen er bygget (/ gir 404 hvis dist mangler).
# Bruker ikke /api/offers: den starter et oppslag mot Tjek.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "server"]
