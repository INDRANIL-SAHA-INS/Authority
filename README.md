<div align="center">

# 🏛️ AUTHORITY
### *The Intelligent Neural Core for Modern Campus Governance*

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.109-05998b?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2d3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Python](https://img.shields.io/badge/Python-v3.11-3776ab?style=for-the-badge&logo=python)](https://www.python.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agentic-blue?style=for-the-badge&logo=langchain)](https://github.com/langchain-ai/langgraph)

---

**Authority** is not just a management system; it is a distributed, high-performance ecosystem engineered to redefine academic administration through **Computer Vision**, **Agentic AI**, and **Distributed System Architectures**.

[**Explore the Vision**](#-architectural-pillars) • [**Core Features**](#-engineered-excellence) • [**System Architecture**](#-the-neural-map)

</div>

---

## 🏛️ The Neural Map: System Architecture

Authority is built on a **Three-Tier Microservice Topology**, ensuring that compute-intensive AI tasks never bottleneck the mission-critical core management logic.

![Detailed System Architecture](authority/all_md_folders/system_architecture_detailed.png)

> [!NOTE]
> The system orchestrates requests across a **Next.js Gateway**, a **FastAPI Compute Node**, and an **Agentic Utility Microservice**, communicating via low-latency REST and secure webhooks.

---

## 🚀 Architectural Pillars

### 1. The Gateway (`authority`)
The central orchestrator built with **Next.js 15**. It handles the "Business Brain" of the system.
- **State Management**: Prisma ORM with PostgreSQL for complex relational integrity.
- **Edge Security**: JWT-based session management and Middleware-level protection.
- **Orchestration**: Directing traffic to specialized AI nodes via secure handshakes.

### 2. The Vision Node (`authority_ai_service_backend`)
A high-performance **FastAPI** environment dedicated to spatial compute.
- **Face ID Pipeline**: Uses **RetinaFace** for detection and **ArcFace** for generating 512-dimensional facial embeddings.
- **Real-time Verification**: Sub-second matching of students for automated attendance.
- **Normalization Engine**: Validates and aligns face samples across Front, Left, and Right angles.

### 3. The Agentic Worker (`authority_microservices`)
The "Smart Utility" layer powered by **LangGraph** and Local LLMs.
- **Intelligent Mail Agent**: A goal-oriented agent that processes natural language (e.g., *"Notify all parents of low-attendance students"*) autonomously.
- **Marks Extraction**: OCR-based pipeline with AI schema discovery to parse grading sheets from PDF/Excel/CSV.

---

## 💎 Engineered Excellence

As a backend-first ecosystem, Authority implements industry-standard patterns to ensure robustness:

### ❄️ Snowflake ID Generation
We avoid predictable auto-incrementing IDs. Every record in Authority is assigned a **64-bit Snowflake ID**, ensuring globally unique, time-ordered identifiers across distributed services.

### 🛡️ Type-Safe API Boundaries
- **Zod (Frontend/Gateway)**: Strict runtime schema validation for every incoming request.
- **Pydantic (Python Microservices)**: Data modeling with strict type enforcement and validation.

### 🔄 Transactional Atomic Operations
Using **Prisma Transactions**, we ensure that complex operations—like simultaneous face enrollment across three angles or multi-student attendance processing—either succeed entirely or fail gracefully without data corruption.

---

## 🖼️ Feature Spotlights

### 🎭 AI Face Enrollment Workflow
Ensuring identity integrity starts with a robust enrollment. Our pipeline processes multi-angle captures to build a comprehensive biometric profile.

![Face Enrollment Workflow](authority/all_md_folders/face_enrollment_architecture.png)

### ✉️ Agentic Institutional Communication
The **Mail Agent** uses a local **Gemma 3:4b** model via Ollama, integrated into a LangGraph workflow to handle complex institutional messaging tasks with human-like understanding.

---

## 🛠️ Tech Stack & Methods

<table align="center">
  <tr>
    <td align="center" width="33%">
      <b>Core Backend</b><br>
      Next.js 15 (App Router)<br>
      Prisma ORM<br>
      PostgreSQL<br>
      Auth.js / JWT
    </td>
    <td align="center" width="33%">
      <b>AI & Computer Vision</b><br>
      FastAPI / Python<br>
      DeepFace / ArcFace<br>
      RetinaFace Detector<br>
      PyTorch
    </td>
    <td align="center" width="33%">
      <b>Agentic AI</b><br>
      LangGraph / LangChain<br>
      Ollama (Gemma 3:4b)<br>
      Google Gmail OAuth<br>
      Tesseract OCR
    </td>
  </tr>
</table>

---

## 📜 Development & Setup

To explore the backend logic or deploy the services, refer to the individual service directories:

1. **`authority/`**: The Next.js 15 Gateway.
2. **`authority_ai_service_backend/`**: The FastAPI Face ID service.
3. **`authority_microservices/`**: The Agentic Mail & Marks service.

---

<div align="center">

**Developed with 💻 & ☕ by a Performance-Driven Backend Engineer**

</div>
