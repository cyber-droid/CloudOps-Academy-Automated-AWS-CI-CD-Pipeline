# AWS DevOps Deployment Guide: EduTracker Application

This document provides a comprehensive, step-by-step walkthrough and line-by-line explanation of the Dockerized multi-container **EduTracker** application, provisioned on AWS using Terraform, configured with Ansible, and deployed automatically via GitHub Actions CI/CD.

---

## 1. Architecture Overview

The **EduTracker** application is an educational course progress tracker and project portfolio. It uses a modern 4-tier microservice architecture:
1. **Frontend**: React (Vite) client providing a dashboard UI.
2. **Backend**: Node.js Express REST API connecting to PostgreSQL.
3. **Database**: PostgreSQL 16 (for robust relational data persistence).
4. **Reverse Proxy**: Nginx (routing external web traffic on port 80 to frontend and backend).

```
   [ Client Browser ] 
          │ (Port 80)
          ▼
    [ Nginx Proxy ] 
     ├── /api ────► [ Express API ] (Port 3000) ───► [ PostgreSQL DB ] (Port 5432)
     └── / ───────► [ React App ] (Port 5173)
```

---

## 2. Line-by-Line Code Explanations

### A. Backend Dockerfile (`backend/Dockerfile`)
The backend Dockerfile containerizes the Node.js Express server.
```dockerfile
FROM node:20-alpine     # 1. Use the official lightweight Node.js 20 Alpine Linux base image.
WORKDIR /app            # 2. Set the working directory inside the container to /app.
COPY package*.json ./   # 3. Copy package.json and package-lock.json first (to leverage Docker layer caching).
RUN npm install         # 4. Install production & development dependencies inside the container.
COPY . .                # 5. Copy the remaining backend source code files into the container.
EXPOSE 3000             # 6. Document that the container listens on port 3000.
CMD ["node", "server.js"] # 7. Specify the default command to start the Express application.
```

### B. Frontend Dockerfile (`frontend/Dockerfile`)
The frontend Dockerfile containerizes the React (Vite) client development/dev-preview mode.
```dockerfile
FROM node:20            # 1. Use Node 20 base image.
WORKDIR /app            # 2. Set working directory to /app.
COPY package*.json ./   # 3. Copy package manager configs.
RUN npm install         # 4. Install Vite, React, and frontend dependencies.
COPY . .                # 5. Copy the React source files into the container.
EXPOSE 5173             # 6. Inform Docker that Vite dev server exposes port 5173.
CMD ["npm", "run", "dev", "--", "--host"] # 7. Run Vite dev server, binding to host 0.0.0.0 for Docker routing.
```

### C. Nginx Dockerfile (`nginx/Dockerfile`)
The Nginx container handles reverse proxying.
```dockerfile
FROM nginx:alpine       # 1. Use the lightweight Nginx Alpine base image.
RUN rm /etc/nginx/nginx.conf # 2. Remove Nginx's default placeholder configuration file.
COPY nginx.conf /etc/nginx/nginx.conf # 3. Copy our custom nginx.conf configuration file.
EXPOSE 80               # 4. Expose standard HTTP port 80 to route external web requests.
CMD ["nginx", "-g", "daemon off;"] # 5. Start Nginx in the foreground (required to keep the container running).
```

### D. Nginx Configuration (`nginx/nginx.conf`)
This configures Nginx as a gateway on port `80` to route traffic to the appropriate container.
* **`upstream` blocks**: Define logical service groups (`backend_server` at `backend:3000` and `frontend_server` at `frontend:5173`).
* **`location /api`**: Intercepts request paths starting with `/api` and proxies them to the Express Backend.
* **`location /`**: Routes all other UI/page assets traffic to the React Frontend.
* **`Upgrade` & `Connection` headers**: Configured to support WebSocket requests (needed for Vite hot module reloading).

### E. Orchestration (`docker-compose.yaml`)
Let's break down the central configuration file:
* **`postgres` service**: Spin up a database container using `postgres:16-alpine`. Environment variables define DB credentials (`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`). It mounts a named volume (`postgres_data`) mapping data from `/var/lib/postgresql/data` to ensure data persists.
* **`backend` service**: Builds the source code from `./backend` and tags it with `${DOCKER_HUB_USER:-local}/edutracker-backend:latest`. Maps port `3000:3000`. Configures the `DATABASE_URL` matching the credentials set in Postgres.
* **`frontend` service**: Builds the source code from `./frontend` and tags it with `${DOCKER_HUB_USER:-local}/edutracker-frontend:latest`. Exposes Vite server on port `5173:5173`.
* **`nginx` service**: Builds from `./nginx`, mapping port `80` on the host to port `80` in the container.
* **`volumes`**: Defines `postgres_data` as a named volume managed by Docker, guaranteeing database entries remain safe even if containers are destroyed (`docker compose down`).

---

## 3. Infrastructure as Code (Terraform)

Terraform provisions the virtual machine (EC2 instance) on AWS.

1. **AMI Lookup (`data "aws_ami" "ubuntu"`)**: Automatically queries AWS to fetch the ID of the latest official Ubuntu 22.04 LTS image.
2. **Key Generation (`tls_private_key` & `aws_key_pair`)**: Generates a secure RSA 4096-bit SSH key pair. Uploads the public key to AWS and writes the private key locally as `terraform/devops-key.pem` so you can connect.
3. **Security Group (`aws_security_group`)**: Opens incoming network access to:
   - **Port 22**: SSH management (needed for Ansible and debug connection).
   - **Port 80**: HTTP access for public web traffic.
   - **Ports 3000 & 5173**: Development access ports.
4. **EC2 Instance (`aws_instance`)**: Spins up a free-tier eligible `t2.micro` virtual server utilizing the Ubuntu AMI and SG group.

---

## 4. Configuration Management (Ansible)

Ansible configures the raw virtual server, installing dependencies and running the app.

* **`hosts: web`**: Targets hosts listed in the inventory.
* **Docker Installation**: Automates APT updates, imports GPG keys, sets up the Docker repository, and installs Docker, Docker Compose, and dependencies.
* **Configuration Transfer**: Creates the directory `/home/ubuntu/app` on the server and transfers `docker-compose.yaml` and Nginx configurations.
* **Deployment Execution**: Logins to Docker Hub (if secrets are supplied), pulls the latest images built by CI/CD, and starts the container stack (`docker compose up -d`).

---

## 5. CI/CD Pipeline (GitHub Actions)

The GitHub Actions workflow automates the deployment cycle on every push to the `main` branch.

```
 [ Git Push ] ──► [ Build & Cache Docker Images ] ──► [ Push to Docker Hub ] ──► [ Run Ansible to Deploy ]
```

1. **`build-and-push` Job**:
   - Logs into your Docker Hub profile.
   - Builds `backend`, `frontend`, and `nginx` images.
   - Pushes them to Docker Hub tagged with `:latest` and the commit SHA (`:${{ github.sha }}`).
2. **`deploy` Job**:
   - Runs immediately after a successful build.
   - Installs Ansible on the GitHub Actions agent.
   - Restores the AWS private key from secret values.
   - Runs the Ansible playbook to pull images from Docker Hub and start them on the EC2 server.

---

## 6. Step-by-Step Setup Guide: Local to AWS Cloud

Follow these instructions to run the application locally, upload it to GitHub, provision infrastructure, and execute deployments.

### Step 1: Run and Verify Locally

Before deploying to the cloud, verify that the application works locally.

1. Start the application stack:
   ```bash
   docker compose up --build
   ```
2. Verify local access:
   - **Frontend UI**: Open [http://localhost:5173](http://localhost:5173) in your browser.
   - **Backend API**: Open [http://localhost:3000/api/courses](http://localhost:3000/api/courses).
   - **Nginx Reverse Proxy Gateway**: Open [http://localhost](http://localhost).
3. Test functionality: Add a course, modify progress slider, check if statistics calculate, stop containers (`Ctrl + C`), and start them again to ensure data persists.

---

### Step 2: Push Your Project to GitHub

1. Initialize git and create a repository:
   ```bash
   git init
   git add .
   git commit -m "feat: initial edu tracker configuration"
   ```
2. Add your GitHub remote and push code:
   ```bash
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

---

### Step 3: Provision AWS Cloud Infrastructure using Terraform

1. Ensure you have the AWS CLI configured on your computer with your AWS Access Keys:
   ```bash
   aws configure
   ```
2. Open terminal in the `terraform` directory:
   ```bash
   cd terraform
   ```
3. Initialize Terraform (downloads AWS providers):
   ```bash
   terraform init
   ```
4. Preview the provisioning plan:
   ```bash
   terraform plan
   ```
5. Apply changes to create the EC2 instance and Security Groups:
   ```bash
   terraform apply -auto-approve
   ```
6. Take note of the printed outputs:
   - **`instance_public_ip`**: The IP of your new EC2 server.
   - **`devops-key.pem`**: The private key generated inside the `terraform/` directory.

---

### Step 4: Configure GitHub Secrets

To allow GitHub Actions to securely build and deploy your app, add these secrets under **Settings > Secrets and variables > Actions** in your GitHub repository:

| Secret Name | Description / Format |
| :--- | :--- |
| `DOCKER_HUB_USERNAME` | Your username for login on Docker Hub |
| `DOCKER_HUB_ACCESS_TOKEN` | An Access Token generated on Docker Hub (Account Settings > Security) |
| `EC2_PUBLIC_IP` | The public IP of the EC2 instance outputted by Terraform |
| `EC2_SSH_KEY` | The contents of the generated private key file `terraform/devops-key.pem` |

To view the key contents on Windows PowerShell:
```powershell
Get-Content .\terraform\devops-key.pem
```

---

### Step 5: Deploy & Verify Production App

1. Commit any local changes and push to GitHub:
   ```bash
   git add .
   git commit -m "deploy: setup AWS infrastructure"
   git push origin main
   ```
2. Go to the **Actions** tab on your GitHub repository. You will see the workflow running.
3. Once completed:
   - Paste the `instance_public_ip` in your browser: `http://YOUR_EC2_PUBLIC_IP`.
   - The Nginx proxy will load the React interface, query the backend database container, and showcase your application!
