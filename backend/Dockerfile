# Use an official lightweight Python image
FROM python:3.12-slim

# Prevent Python from writing pyc files and keep stdout/stderr unbuffered
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set the working directory inside the container
WORKDIR /app

# Install system dependencies required for MySQL and building Python packages
RUN apt-get update \
    && apt-get install -y pkg-config default-libmysqlclient-dev build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install them
COPY requirements.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy the rest of the Django project
COPY . /app/