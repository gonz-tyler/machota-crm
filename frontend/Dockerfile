# Use an official lightweight Node image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files first to cache the npm install step
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy the rest of the React project
COPY . ./