FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV REDIS_URL=redis://0.0.0.0:6379

CMD ["npm", "start"]