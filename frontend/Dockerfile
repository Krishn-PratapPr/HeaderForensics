# Build Stage
FROM node:18-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy configuration and source
COPY . .

# Set dynamic production API endpoint (can be overridden by Docker Compose build arg)
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build production bundles
RUN npm run build

# Production Stage
FROM nginx:stable-alpine

# Copy custom nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts to nginx public path
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
