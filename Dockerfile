# Use Bun runtime as a parent image
FROM oven/bun:latest

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install project dependencies
RUN bun install

# Create scripts and public directories
RUN mkdir -p scripts public

# Bundle app source
COPY . .

# Make port 8080 available to the world outside this container
EXPOSE 8080

# Define the command to run your app
CMD [ "bun", "start" ]