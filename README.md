# utools - IP Information Webapp


start this tool with compose.yml: 
```yml
services:
  backend:
    image: ghcr.io/mrunknownde/utools-backend
    container_name: utools_backend 
    restart: unless-stopped
    environment:
      NODE_ENV: production 
      PORT: 3000
      LOG_LEVEL: info 
      PING_COUNT: 4
    ports:
      - "3000:3000"
    dns:
      - 1.1.1.1    # Cloudflare DNS
      - 1.0.0.1    # Cloudflare DNS
      - 8.8.8.8    # Google DNS
      - 8.8.4.4    # Google DNS
    networks:
      - utools_network

  frontend:
    image: ghcr.io/mrunknownde/utools-frontend
    container_name: utools_frontend
    restart: unless-stopped
    ports:
      - "8080:80"
    depends_on:
      - backend
    networks:
      - utools_network

networks:
  utools_network:
    driver: bridge
    
    ```