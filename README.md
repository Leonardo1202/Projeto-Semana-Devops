# Semana DevOps Map

Este repositório contém a aplicação **Semana DevOps Map**, desenvolvida durante a **Semana DevOps** da LINUXtips.

A aplicação consiste em um mapa interativo em tempo real onde profissionais e estudantes podem registrar sua presença, informando nome, localização e cargo/área de atuação.

## Arquitetura do Projeto

O projeto foi desenhado para demonstrar um fluxo completo de engenharia de software Cloud Native. As tecnologias aplicadas englobam:

- **Código base:** Aplicação Node.js com Express e frontend vanilla (HTML/CSS com Dark Mode).
- **Containerização:** Docker com *Multi-Stage Build* (`node:20-alpine`) usando `buildx` para gerar imagens multi-arquitetura (AMD64 e ARM64).
- **Orquestração K8s:** Kubernetes rodando na nuvem com Deployments, Services (LoadBalancer), manifestos HPA (Horizontal Pod Autoscaler) e liveness/readiness probes para garantir *Self-Healing*.
- **Cloud AWS (EKS):** Provisionamento de infraestrutura gerenciada usando manifesto declarativo do `eksctl` (nós `t3.medium`).
- **CI/CD Pipeline:** GitHub Actions automatizando os testes (`npm test`), Lint, Build Multi-Arch com o Docker Hub e o Continuous Deployment conectando diretamente com o cluster remoto EKS.

## Estrutura de Pastas

```text
.
├── .github/workflows/   # Pipeline de CI/CD (GitHub Actions)
├── app/                 # Código-fonte da aplicação Node.js e frontend
├── eks/                 # Manifesto do eksctl para provisionamento do cluster AWS
├── k8s/                 # Manifestos do Kubernetes (Deployment, Service, HPA, Namespace)
└── material_aluno_dia5.md # Guia prático de estudo e deploy para os alunos
```

## Como Rodar Localmente (Desenvolvimento)

Para rodar o projeto Node.js diretamente na sua máquina:

```bash
cd app
npm install
npm test
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.

## Como Fazer o Build via Docker Localmente

Para garantir compatibilidade com qualquer arquitetura na nuvem, preferencialmente crie um builder com suporte multiplataforma:

```bash
cd app
docker buildx create --name meu-builder --use
docker buildx build --platform linux/amd64,linux/arm64 -t SEU_USUARIO/devops-map-brasil:v1 --push .
```

## Setup do Cluster Kubernetes

1. Tenha credenciais da AWS configuradas localmente (`aws configure`).
2. Provisione o cluster via `eksctl`:
   ```bash
   eksctl create cluster -f eks/cluster.yaml
   ```
3. Atualize o arquivo `k8s/deployment.yaml` apontando para sua imagem no Docker Hub.
4. Aplique os manifestos do Kubernetes:
   ```bash
   kubectl apply -f k8s/namespace.yaml
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/service.yaml
   kubectl apply -f k8s/hpa.yaml
   ```

A aplicação providenciará um Endpoint LoadBalancer disponível na AWS para acesso externo.

---

Feito com dedicação na **Semana DevOps** — [LINUXtips](https://linuxtips.io).
**#VAMODEPLOY**
