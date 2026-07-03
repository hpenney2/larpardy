# CREDIT :: adapted from https://pnpm.io/docker#minimizing-docker-image-size-and-build-time

FROM node:26 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME/bin:$PATH"
ENV NODE_ENV=production
ARG CI=true
RUN npm install -g corepack@latest && corepack enable pnpm

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run -r build

# these link workspace dependencies WRONG! that means we have to do this manually... ugh
# RUN pnpm deploy --filter=@larpardy/server --prod /prod/server
RUN pnpm deploy --filter=@larpardy/client --prod /prod/client

FROM base AS server
COPY --from=build /usr/src/app/node_modules /prod/server/node_modules
COPY --from=build /usr/src/app/pnpm-lock.yaml /usr/src/app/pnpm-workspace.yaml /prod/server/

COPY --from=build /usr/src/app/server /prod/server/server
COPY --from=build /usr/src/app/shared /prod/server/shared
COPY --from=build /usr/src/app/client/dist /prod/server/server/public
WORKDIR /prod/server/server

RUN pnpm prune --prod

EXPOSE 3001
CMD ["pnpm", "start"]
