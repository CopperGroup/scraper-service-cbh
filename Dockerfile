# Stage 1: Build the application
FROM node:20-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build your application (if you have a build step, e.g., TypeScript compilation)
# RUN npm run build

# Stage 2: Create the production image
FROM node:20-alpine AS production

WORKDIR /app

# Copy only necessary files from the build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/package*.json ./

# Expose the port your application listens on
EXPOSE 3000

# Command to run the application
CMD ["node", "src/app.js"]