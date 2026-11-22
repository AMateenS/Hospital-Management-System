FROM node:22-alpine AS build
WORKDIR /app
# API_URL is baked into the Next.js rewrite at build time (internal address of the backend)
ARG API_URL=http://backend:5000
ENV API_URL=$API_URL
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
USER node
EXPOSE 3000
CMD ["npm", "start"]
