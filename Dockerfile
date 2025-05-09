# Use Bun runtime as a parent image
FROM oven/bun:latest

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./
COPY bun.lock ./

# Install project dependencies
RUN bun install

# Create necessary directories
RUN mkdir -p scripts public/icons

# Copy the public directory first (for better layer caching)
COPY public ./public/

# Bundle the rest of the app source
COPY . .

# Ensure proper permissions
RUN chmod +x public/icons/create_icons.sh

# Create default configuration files if they don't exist
RUN touch scriptstore.json usage.json settings.json current_main_script.json

# Make port 8080 available to the world outside this container
EXPOSE 8080

# Define environment variables
ENV NODE_ENV=production

# Define the command to run your app
CMD [ "bun", "start" ]