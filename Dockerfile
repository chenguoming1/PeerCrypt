# Use official Node.js 22 LTS Alpine image as base
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package configuration files
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build the frontend and the compiled Express server bundle
RUN npm run build

# --- Production Image Stage ---
FROM node:22-alpine AS runner

WORKDIR /app

# Set Node environment to production
ENV NODE_ENV=production

# Copy package configurations and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built artifacts from the builder stage
COPY --from=builder /app/dist ./dist

# Expose port 3000
EXPOSE 3000

# Start the application using the production script
CMD ["npm", "run", "start"]
