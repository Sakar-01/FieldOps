# Local development image; production runs on Vercel.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: the husky "prepare" hook needs git, which isn't in this image.
RUN npm ci --ignore-scripts
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
