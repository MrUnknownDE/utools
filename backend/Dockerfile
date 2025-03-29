# Stage 1: Build Dependencies
# Use an official Node.js runtime as a parent image
FROM node:18-alpine AS builder

WORKDIR /app

# Install OS dependencies needed for ping/traceroute
# Using apk add --no-cache reduces layer size
RUN apk add --no-cache iputils-ping traceroute

# Copy package.json and package-lock.json (or yarn.lock)
# Ensure these files include 'oui' as a dependency before building!
COPY package*.json ./

# Install app dependencies using npm ci for faster, reliable builds
# --only=production installs only production dependencies (including 'oui')
RUN npm ci --only=production
# REMOVED: RUN npm i oui (should be installed by npm ci now)

# Stage 2: Production Image
FROM node:18-alpine

WORKDIR /app

# Install only necessary OS dependencies again for the final image
RUN apk add --no-cache iputils-ping traceroute

# Copy dependencies from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY . .

# Copy MaxMind data (assuming it's in ./data)
# Ensure the 'data' directory exists in your project root
COPY ./data ./data

# Create a non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# Optional: Change ownership of app files to the new user
# RUN chown -R appuser:appgroup /app

# Switch to the non-root user
USER appuser

# Make port specified in environment variable available to the world outside this container
# Default to 3000 if not specified
ARG PORT=3000
ENV PORT=${PORT}
EXPOSE ${PORT}

# Define environment variable for Node environment (important for Pino, Express etc.)
ENV NODE_ENV=production
# Define default Log Level if not set externally
ENV LOG_LEVEL=info
# Define default Ping Count if not set externally
ENV PING_COUNT=4
# Define paths to GeoIP DBs (can be overridden by external .env or docker run -e)
ENV GEOIP_CITY_DB=./data/GeoLite2-City.mmdb
ENV GEOIP_ASN_DB=./data/GeoLite2-ASN.mmdb

# Define build argument and environment variable for Git commit SHA
ARG GIT_COMMIT_SHA=unknown
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}


# Run the app when the container launches
CMD ["node", "server.js"]