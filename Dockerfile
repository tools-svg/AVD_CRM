
# Build frontend
FROM node:20-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .
RUN npm run build


# Combined application
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ .

# Copy built frontend
COPY --from=frontend-build /frontend/dist /usr/share/nginx/html

# Configure Nginx and Supervisor
RUN rm -f /etc/nginx/sites-enabled/default

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/supervisord.conf /etc/supervisor/conf.d/app.conf

EXPOSE 10000

CMD ["/usr/bin/supervisord", "-n"]
