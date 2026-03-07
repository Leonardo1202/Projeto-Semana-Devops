# Material do Aluno - Dia 5: Colocando no Ar — O Projeto Completo

**Bem-vindo(a) ao Dia 5!**
Você sobreviveu à semana inteira. Linux, Terraform, Containers, Kubernetes, Cloud, CI/CD — tudo foi estudado de forma isolada, como peças de um quebra-cabeça.

Hoje **acabou a teoria**. Nós vamos montar o Transformer. Você vai colocar no ar uma aplicação real, empacotada em container, rodando no Kubernetes (EKS na AWS), com pipeline CI/CD automatizada no GitHub Actions. E o melhor: **a galera da live vai interagir com a aplicação ao vivo**.

---

## Objetivo do Dia

Construir, containerizar, deployar e automatizar uma aplicação web completa — do `git push` ao Load Balancer público na AWS.

**O que vamos usar:**

| Ferramenta | Para quê |
|---|---|
| **Node.js** | Aplicação backend (API) |
| **Docker** | Empacotar a aplicação |
| **EKS (eksctl)** | Cluster Kubernetes na AWS |
| **kubectl** | Gerenciar o cluster |
| **GitHub Actions** | Pipeline CI/CD automatizada |
| **Docker Hub** | Registro de imagens |

---

## A Aplicação: Semana DevOps Map

Vamos criar o **Semana DevOps Map** — uma app interativa onde cada participante da live se cadastra com:
- **Nome**
- **Localização** (estado brasileiro ou país, para quem mora fora)
- **Cargo/Área** (DevOps, SRE, Backend, etc.)

A app mostra em tempo real:
- **Mapa interativo** com pontos nos estados (e países!) dos participantes
- **Painel de estatísticas** (total, distribuição por cargo)
- **Feed ao vivo** mostrando quem acabou de se cadastrar
- **Nome do Pod** que serviu cada requisição (pra provar o balanceamento de carga!)

---

## Pré-requisitos

Antes de começar, confirme que você tem instalado:

```bash
# Docker
docker --version

# kubectl
kubectl version --client

# eksctl
eksctl version

# AWS CLI (configurado com suas credenciais)
aws sts get-caller-identity

# Node.js (para rodar local)
node --version   # >= 20

# Git
git --version
```

Se algum não estiver instalado, peça ajuda ao instrutor ou consulte a documentação oficial.

---

## PARTE 1: Conhecendo a Aplicação (Código)

### 1.1 — Estrutura do Projeto

```
dia5/
├── app/                          # Aplicação
│   ├── server.js                 # Backend Express (API REST)
│   ├── package.json              # Dependências
│   ├── Dockerfile                # Container (multi-stage build)
│   ├── .dockerignore             # Arquivos ignorados no build
│   ├── public/
│   │   ├── index.html            # Frontend interativo
│   │   └── style.css             # Estilo dark-mode premium
│   └── test/
│       └── app.test.js           # Testes unitários
├── k8s/                          # Manifestos Kubernetes
│   ├── namespace.yaml
│   ├── deployment.yaml           # 3 réplicas, probes, resource limits
│   ├── service.yaml              # LoadBalancer (expõe na internet)
│   └── hpa.yaml                  # Auto-scaling (3 a 10 pods)
├── eks/
│   └── cluster.yaml              # Configuração do cluster EKS (eksctl)
└── .github/workflows/
    └── ci.yaml                   # Pipeline CI/CD (GitHub Actions)
```

### 1.2 — As Rotas da API

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/` | Serve o frontend (HTML) |
| `GET` | `/healthz` | Health check (usado pelo K8s) |
| `POST` | `/api/participante` | Cadastra um participante |
| `GET` | `/api/participantes` | Lista todos os participantes |
| `GET` | `/api/stats` | Estatísticas agregadas |
| `GET` | `/api/info` | Info do app (versão, pod, uptime) |

### 1.3 — Rodando Local (sem Docker)

```bash
# Entrar na pasta da app
cd dia5/app

# Instalar dependências
npm install

# Rodar os testes
npm test

# Iniciar a aplicação
npm start
```

Acesse [http://localhost:3000](http://localhost:3000) e teste! Cadastre-se e veja o mapa reagir.

> **Dica:** Use `npm run dev` para modo de desenvolvimento com hot-reload.

---

## PARTE 2: Dockerizando a Aplicação

### 2.1 — Entendendo o Dockerfile

Abra o arquivo `dia5/app/Dockerfile` e leia com atenção. Ele usa **Multi-Stage Build**:

```dockerfile
# Stage 1: Instalar dependências (imagem temporária)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Imagem final (só o necessário)
FROM node:20-alpine AS production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY server.js ./
COPY public/ ./public/
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1
CMD ["node", "server.js"]
```

**Conceitos importantes demonstrados:**
- **Multi-stage build:** imagem final não tem instaladores nem cache
- **Alpine:** imagem base leve (~5MB vs ~1GB do Ubuntu)
- **Non-root user:** nunca rode como root dentro do container!
- **HEALTHCHECK:** Docker sabe se a app está saudável
- **.dockerignore:** `node_modules` e `test/` não entram na imagem

### 2.2 — Build e Push Multi-Arquitetura

Hoje o mundo roda em várias arquiteturas. A nuvem AWS geralmente usa Intel/AMD (`linux/amd64`), mas muitos computadores (como os Macs M1/M2/M3 ou instâncias ARM na AWS) usam ARM (`linux/arm64`). 

Vamos fazer um build **Multi-Arquitetura**, que roda bem em qualquer lugar!

Primeiro, faça o login no Docker Hub (pois enviaremos a imagem direto pra lá):

```bash
docker login
```

Agora, crie um "builder" (um construtor especial do Docker) e faça o build:

```bash
cd dia5/app

# Cria e usa um construtor com suporte a multi-arquitetura
docker buildx create --name devops-builder --use

# ATENÇÃO: Troque SEU_USER pelo seu usuário do Docker Hub!
# O comando abaixo constrói a imagem para x86 (AMD64) e ARM (ARM64)
# e já empurra (push) direto para o Docker Hub!
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t SEU_USER/devops-map-brasil:v1 \
  -t SEU_USER/devops-map-brasil:latest \
  --push .
```

Pronto! Sua imagem agora é universal.

> **Observação sobre o buildx:** Como fizemos build para várias arquiteturas de uma vez, a imagem não fica salva localmente no seu `docker images`. Ela foi direto para o Docker Hub. Você pode ver lá no site!

### 2.3 — Rodando o Container Localmente

Como a imagem está no Docker Hub, basta apontar para ela. O Docker vai baixar automaticamente a versão certa para o seu computador:

```bash
# ATENÇÃO: Troque SEU_USER!
docker run -d \
  --name devops-map \
  -p 3000:3000 \
  SEU_USER/devops-map-brasil:v1

# Ver os logs
docker logs devops-map

# Testar o health check
curl http://localhost:3000/healthz

# Testar a API
curl -X POST http://localhost:3000/api/participante \
  -H "Content-Type: application/json" \
  -d '{"nome":"Jeferson","estado":"SP","cargo":"DevOps"}'

# Ver participantes
curl http://localhost:3000/api/participantes
```

Acesse [http://localhost:3000](http://localhost:3000) e confirme que está funcionando!

### 2.4 — Limpeza

```bash
docker stop devops-map && docker rm devops-map
```

---

## PARTE 3: Criando o Cluster EKS

### 3.1 — O Arquivo de Configuração

O arquivo `dia5/eks/cluster.yaml` declara nosso cluster:

```yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: semana-devops
  region: us-east-1
  version: "1.30"

managedNodeGroups:
  - name: workers
    instanceType: t3.medium
    desiredCapacity: 2
    minSize: 1
    maxSize: 4
    volumeSize: 20
```

### 3.2 — Criando o Cluster

```bash
# Criar o cluster (demora ~15-20 minutos)
eksctl create cluster -f dia5/eks/cluster.yaml

# Verificar que o kubeconfig foi configurado
kubectl get nodes
```

Quando os nodes aparecerem `Ready`, seu cluster está pronto!

```
NAME                             STATUS   ROLES    AGE   VERSION
ip-192-168-xx-xx.ec2.internal   Ready    <none>   3m    v1.31.x
ip-192-168-xx-xx.ec2.internal   Ready    <none>   3m    v1.31.x
```

> **Enquanto espera o cluster subir:** releia os manifestos K8s na pasta `dia5/k8s/`. Tente entender cada campo.

---

## PARTE 4: Deploy no Kubernetes

### 4.1 — Editando o deployment.yaml

Antes de aplicar, **edite o arquivo `dia5/k8s/deployment.yaml`** e troque `<SEU_DOCKERHUB_USER>` pelo seu usuário:

```yaml
image: SEU_USER/devops-map-brasil:latest
```

### 4.2 — Aplicando os Manifestos

```bash
# Criar o namespace
kubectl apply -f dia5/k8s/namespace.yaml

# Aplicar o deployment
kubectl apply -f dia5/k8s/deployment.yaml

# Aplicar o service (LoadBalancer)
kubectl apply -f dia5/k8s/service.yaml

# Aplicar o HPA (auto-scaling)
kubectl apply -f dia5/k8s/hpa.yaml
```

### 4.3 — Verificando o Deploy

```bash
# Ver os pods (3 réplicas!)
kubectl get pods -n semana-devops

# Ver o status detalhado
kubectl get pods -n semana-devops -o wide

# Ver o service e pegar o EXTERNAL-IP
kubectl get svc -n semana-devops

# Acompanhar em tempo real
kubectl get pods -n semana-devops -w
```

O output do Service mostrará algo como:

```
NAME                 TYPE           CLUSTER-IP     EXTERNAL-IP                              PORT(S)
devops-map-brasil    LoadBalancer   10.100.x.x     aXXXXX.us-east-1.elb.amazonaws.com       80:31234/TCP
```

> **Acesse o EXTERNAL-IP no navegador!** A app está no ar na AWS!

### 4.4 — Verificando os Logs

```bash
# Logs de um pod específico
kubectl logs -n semana-devops -l app=devops-map-brasil --tail=50

# Logs em tempo real (follow)
kubectl logs -n semana-devops -l app=devops-map-brasil -f

# Detalhes do deployment
kubectl describe deployment devops-map-brasil -n semana-devops
```

### 4.5 — Testando o Balanceamento de Carga

Faça vários cadastros na app e observe o campo **"Pod"** no feed. Cada requisição pode ser servida por um pod diferente — isso é o **balanceamento de carga do Kubernetes** em ação!

```bash
# Testando via curl em loop
for i in $(seq 1 10); do
  curl -s http://EXTERNAL_IP/api/info | jq .pod
done
```

---

## PARTE 5: CI/CD com GitHub Actions

### 5.1 — Entendendo o Pipeline

O arquivo `.github/workflows/ci.yaml` define 3 jobs:

```
┌──────────┐    ┌───────────────┐    ┌─────────────┐
│  Test  │───│  Build &   │───│  Deploy  │
│  & Lint  │    │    Push       │    │   no EKS    │
└──────────┘    └───────────────┘    └─────────────┘
```

1. **Test & Lint** — Roda os testes e verifica o código
2. **Build & Push** — Builda a imagem Docker e sobe pro Docker Hub
3. **Deploy** — Atualiza a imagem no cluster EKS

### 5.2 — Configurando os Secrets

No seu repositório GitHub, vá em **Settings → Secrets and variables → Actions** e adicione:

| Secret | Valor |
|---|---|
| `DOCKERHUB_USERNAME` | Seu usuário do Docker Hub |
| `DOCKERHUB_TOKEN` | Token de acesso do Docker Hub (não a senha!) |
| `AWS_ACCESS_KEY_ID` | Chave de acesso AWS |
| `AWS_SECRET_ACCESS_KEY` | Secret da chave AWS |

> **NUNCA** coloque credenciais direto no código. Use *Secrets* sempre!

### 5.3 — Fazendo o Primeiro Deploy Automatizado

```bash
# Fazer uma alteração na app (ex: versão)
# Edite dia5/app/server.js e mude APP_VERSION para "2.0.0"

# Commit e push
git add .
git commit -m "feat: deploy v2 do Semana DevOps Map"
git push origin main
```

Vá até a aba **Actions** do seu repositório e acompanhe o pipeline rodando!

---

## PARTE 6: Engenharia do Caos

Agora é a hora de **quebrar as coisas** propositalmente e ver o Kubernetes se curar sozinho.

### 6.1 — Deletando Pods

```bash
# Veja os pods rodando
kubectl get pods -n semana-devops

# Delete TODOS os pods de uma vez!
kubectl delete pods -n semana-devops -l app=devops-map-brasil

# Imediatamente veja o Kubernetes recriando:
kubectl get pods -n semana-devops -w
```

> **Observe:** Os pods novos sobem em SEGUNDOS. Isso é o **Loop de Reconciliação** — o Kubernetes viu que a realidade (0 pods) era diferente do estado desejado (3 pods) e agiu.

### 6.2 — Simulando Falha de Memória (OOMKill)

```bash
# Editar o deployment para dar muito pouca memória (forçar OOMKill)
kubectl set resources deployment/devops-map-brasil \
  -n semana-devops \
  --limits=memory=10Mi

# Acompanhar
kubectl get pods -n semana-devops -w

# Você verá: STATUS = OOMKilled → CrashLoopBackOff
# Isso é o KERNEL DO LINUX matando o processo que violou o cgroup!
```

**Para corrigir:**

```bash
# Voltar os recursos normais
kubectl set resources deployment/devops-map-brasil \
  -n semana-devops \
  --limits=memory=256Mi --requests=memory=128Mi
```

### 6.3 — Escalando Manualmente

```bash
# Escalar para 5 réplicas
kubectl scale deployment/devops-map-brasil -n semana-devops --replicas=5

# Ver os pods subindo
kubectl get pods -n semana-devops

# Voltar para 3
kubectl scale deployment/devops-map-brasil -n semana-devops --replicas=3
```

### 6.4 — Rolling Update (Atualizar sem downtime)

```bash
# Simular um update de versão
kubectl set image deployment/devops-map-brasil \
  devops-map-brasil=SEU_USER/devops-map-brasil:v2 \
  -n semana-devops

# Acompanhar o rollout
kubectl rollout status deployment/devops-map-brasil -n semana-devops

# Se deu ruim — ROLLBACK instantâneo!
kubectl rollout undo deployment/devops-map-brasil -n semana-devops
```

---

## PARTE 7: Comandos Úteis para Troubleshooting

### Pods & Deployments

```bash
# Listar pods com mais detalhes
kubectl get pods -n semana-devops -o wide

# Descrever um pod específico (eventos, erros)
kubectl describe pod <NOME_DO_POD> -n semana-devops

# Ver logs de um pod
kubectl logs <NOME_DO_POD> -n semana-devops

# Entrar dentro do container (shell)
kubectl exec -it <NOME_DO_POD> -n semana-devops -- sh

# Ver eventos do namespace
kubectl get events -n semana-devops --sort-by=.metadata.creationTimestamp

# Ver histórico de rollout
kubectl rollout history deployment/devops-map-brasil -n semana-devops
```

### Services & Networking

```bash
# Ver services
kubectl get svc -n semana-devops

# Ver endpoints (quais pods estão recebendo tráfego)
kubectl get endpoints -n semana-devops

# Testar DNS interno
kubectl run tmp --rm -it --image=busybox -- nslookup devops-map-brasil.semana-devops.svc.cluster.local
```

### Recursos & Auto-scaling

```bash
# Ver uso de recursos dos pods
kubectl top pods -n semana-devops

# Ver uso de recursos dos nodes
kubectl top nodes

# Ver HPA
kubectl get hpa -n semana-devops

# Descrever HPA (ver decisões de scaling)
kubectl describe hpa devops-map-brasil -n semana-devops
```

---

## PARTE 8: Limpeza (IMPORTANTE!)

> **Para não tomar um susto na fatura da AWS, delete o cluster após a aula!**

```bash
# Deletar os recursos K8s primeiro
kubectl delete -f dia5/k8s/

# Deletar o cluster EKS
eksctl delete cluster -f dia5/eks/cluster.yaml --disable-nodegroup-eviction

# Confirmar que tudo foi limpo
aws eks list-clusters --region us-east-1
```

---

## Desafios Extras (Para quem quer ir além)

1. **Persistência:** Adicione um banco de dados (PostgreSQL ou Redis) ao projeto. Crie os manifestos K8s para o banco e conecte com a app. Os dados sobrevivem ao restart dos pods?

2. **Ingress Controller:** Substitua o Service LoadBalancer por um Ingress com Nginx. Configure um domínio customizado.

3. **GitOps com ArgoCD:** Instale o ArgoCD no cluster e configure para deployar automaticamente ao detectar mudanças no repositório.

4. **Observabilidade:** Instale o Prometheus + Grafana e crie dashboards para monitorar a aplicação (requests/s, latência, uso de memória).

5. **Segurança:** Adicione um scan de vulnerabilidades (Trivy) na pipeline CI/CD.

---

### O que aprendemos hoje

Hoje você juntou **todas as peças** da Semana DevOps num projeto real:

- **Código** → Aplicação Node.js com API REST
- **Container** → Dockerfile com multi-stage build e boas práticas
- **Orquestração** → Kubernetes com Deployment, Service, HPA e Probes
- **Cloud** → Cluster EKS na AWS com eksctl
- **CI/CD** → Pipeline completa no GitHub Actions
- **Resiliência** → Self-healing, rolling updates, rollback

Isso é o fluxo completo de entrega de software na era Cloud Native. Do `git push` ao Load Balancer na internet.

---

**Tema do Dia 6 (Sábado Especial):** *Certificações e Programas de Formação LinuxTips.*
Amanhã mudamos a chave de *Máquina* para *Ser Humano*. Como planejar sua carreira, fugir dos cursos caça-clique e o que as empresas buscam nos profissionais Pleno/Sênior.

**#VAMODEPLOY**
