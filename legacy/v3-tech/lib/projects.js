// Project data — sourced from resume. `colors` drive the placeholder artwork until you add images.
export const projects = [
  {
    slug: "crowdlense",
    name: "CrowdLense",
    subtitle: "Privacy-Preserving Edge AI Traffic Monitoring",
    category: "Research · Edge AI",
    tags: "YOLO11 · React · Flask",
    colors: ["#ff8a5c", "#ff4a1c", "#3b0d00"],
    github: "https://github.com/Argha2004/CrowdLense",
    paper: "https://doi.org/10.1109/COMSNETS67989.2026.11418200",
    summary: "A crowd-sourced traffic monitoring platform where edge devices detect vehicles on-device and a web dashboard shows live analytics. Published at IEEE COMSNETS 2026.",
    stats: [["7", "road-user classes detected on-device"], ["11", "REST API endpoints"], ["0", "raw images leave the device"]],
    stack: ["YOLO11-s", "Raspberry Pi", "Python", "OpenCV", "Flask 3", "JWT", "React 18", "TypeScript", "Vite", "Tailwind CSS v4", "shadcn/ui", "Leaflet", "Recharts"],
    problem: "Cloud video analytics for traffic is bandwidth-heavy, slow, and exposes raw footage of the public. CrowdLense detects vehicles on low-cost edge devices so only anonymous counts — never images — leave the device.",
    sections: [
      { title: "System Design & Edge Intelligence", points: [
        "Raspberry Pi camera nodes run YOLO11-s, trained on the Indian Driving Dataset (IDD), to detect and classify 7 road-user classes (cars, motorcycles, auto-rickshaws, trucks, buses, bicycles, pedestrians) entirely on-device.",
        "Privacy by design: devices transmit only aggregated, timestamped vehicle-count telemetry to a serverless edge-to-cloud pipeline, removing the need to stream or store raw video.",
      ] },
      { title: "My Contributions — Full-Stack Platform & Vision Integration", points: [
        "Built the React 18 + TypeScript web platform with role-based dual dashboards: Providers register devices, provision IoT credentials and track online/offline status; Viewers explore all live sensors on an interactive Leaflet map.",
        "Developed the Flask REST API with JWT authentication — 11 endpoints across auth, provider, viewer and device-ingestion routes — plus CSV export of historical traffic data.",
        "Integrated the edge vision model's output with the backend and built Recharts analytics (vehicle-type distribution, device-level trends) with a client-side device cache, so field detections appear on the dashboard in near real time.",
      ] },
    ],
  },
  {
    slug: "chestx",
    name: "ChestX",
    subtitle: "AI-Powered Chest X-Ray Disease Detection",
    category: "Research · Medical AI",
    tags: "PyTorch · ONNX · Android",
    colors: ["#9fb0ff", "#2f4bff", "#050a33"],
    github: "https://github.com/Argha2004/ChestX",
    summary: "An end-to-end medical-imaging system that screens chest X-rays for 14 thoracic diseases and runs fully offline on an Android phone.",
    stats: [["112K", "training images (NIH ChestX-ray14)"], ["0.832", "macro-AUC (ensemble)"], ["14", "thoracic diseases screened"]],
    stack: ["Python", "PyTorch", "Torchvision", "Scikit-learn", "Pandas", "ONNX", "ONNX Runtime Mobile", "NNAPI", "Kotlin", "Jetpack Compose", "Material 3", "CameraX", "FastAPI"],
    sections: [
      { title: "Data & Training Pipeline", points: [
        "Trained multi-label classifiers on NIH ChestX-ray14 (112,120 images, 14 disease labels) using transfer learning, sigmoid outputs, data augmentation, LR scheduling and best-checkpoint saving.",
        "Benchmarked six model configurations across DenseNet121/201, ResNet34, EfficientNet-B0 and EfficientNetV2-S on Kaggle T4 GPUs, using gradient checkpointing and gradient accumulation to fit within 12-hour session limits.",
      ] },
      { title: "Results & Research Findings", points: [
        "Deployed model (EfficientNetV2-S) reaches 0.826 macro-AUC; a DenseNet201 + EfficientNetV2-S ensemble reaches 0.832 macro-AUC.",
        "Showed that all architectures plateau near 0.82 AUC with identical per-class difficulty rankings, attributing the ceiling to label noise in NLP-extracted labels rather than model capacity.",
        "Ran controlled loss-function studies: weighted BCE reduced macro-AUC (0.816 → 0.804), and Asymmetric Loss required per-class decision thresholds to avoid false-positive flooding.",
      ] },
      { title: "On-Device Android Deployment", points: [
        "Exported the model to ONNX (opset 17) with INT8 quantization, running offline through ONNX Runtime Mobile + NNAPI; chose ONNX over TFLite because EfficientNetV2-S's SiLU layers did not convert cleanly to TFLite.",
        "Built a Kotlin / Jetpack Compose app with gallery upload and CameraX capture, per-disease confidence scores, Grad-CAM heatmaps, prediction history, PDF report export, and support for loading custom-trained models.",
      ] },
    ],
  },
  {
    slug: "train-assistant",
    name: "Train-Assistant AI",
    subtitle: "AI-Powered ML Training Analysis Platform",
    category: "LLM Agents",
    tags: "Gemini · MCP · FastAPI",
    colors: ["#d9ff6b", "#4f8f1e", "#0c1f05"],
    github: "https://github.com/Argha2004/Train-Assistant",
    summary: "A conversational assistant that reads ML training logs, diagnoses problems, and recommends fixes — built on Google Gemini and the Model Context Protocol.",
    stats: [["18", "MCP diagnostic tools"], ["6", "validated REST endpoints"], ["SSE", "streaming responses"]],
    stack: ["Python", "FastAPI", "Uvicorn", "Pydantic", "Pandas", "NumPy", "Matplotlib", "Gemini 2.5 Flash / Pro", "MCP Python SDK", "React", "TypeScript", "Vite", "Tailwind CSS", "shadcn/ui", "Framer Motion"],
    sections: [
      { title: "Agentic Architecture", points: [
        "Designed a React → FastAPI → Gemini + MCP architecture in which Gemini reasons over structured results from a dedicated MCP server exposing 18 diagnostic tools — e.g. overfitting detection, run comparison and scheduler recommendation.",
        "Implemented multi-turn, context-aware chat with automatic tool invocation and streaming responses over Server-Sent Events (SSE).",
      ] },
      { title: "Diagnostics & Recommendations", points: [
        "Parses CSV training logs to find the best epoch, best validation score and convergence point, and detects overfitting, underfitting, plateaus, stagnation and validation instability.",
        "Recommends learning rate, optimizer, scheduler, batch size and dropout changes, and compares multiple runs side by side to pick the best configuration.",
      ] },
      { title: "Tooling & Reporting", points: [
        "Added a dataset analyzer (duplicates, corrupted images, missing labels, class imbalance), GPU telemetry (VRAM, batch-capacity estimate), auto-generated loss / AUC / LR charts and downloadable Markdown reports, served through 6 validated REST endpoints.",
      ] },
    ],
  },
  {
    slug: "aira",
    name: "Aira",
    subtitle: "Sensor-Based Personal Weather Diary",
    category: "Android",
    tags: "Kotlin · Compose · Sensors",
    colors: ["#ffd6f0", "#c03fa0", "#2a0520"],
    github: "https://github.com/Argha2004/Aira",
    role: "Team of 4 — my role: UI, sensors and core logic",
    summary: "An Android app that records the weather a person actually experienced by fusing phone-sensor readings with live weather data.",
    stats: [["6", "sensors fused"], ["15–60m", "background snapshots"], ["~1 km", "max location precision shared"]],
    stack: ["Kotlin", "Jetpack Compose", "Material 3", "MVVM", "Hilt", "Coroutines & Flow", "Room", "DataStore", "WorkManager", "Retrofit", "OkHttp", "Play Services Location", "Vico Charts", "Open-Meteo API", "JUnit4", "MockK"],
    sections: [
      { title: "Sensor Fusion & Context Engine", points: [
        "Fused 6 sensors (light, proximity, step counter, accelerometer, barometer, location) into a rule-based context engine that infers indoor/outdoor, still/walking/in-vehicle states and sun, heat and rain exposure.",
        "Kept all rules in a pure-Kotlin domain layer with no Android dependencies, so every threshold is unit-tested on the JVM in seconds; missing sensors degrade gracefully instead of crashing.",
      ] },
      { title: "Features & Background Processing", points: [
        "WorkManager snapshots every 15–60 minutes (paused at night and on low battery, offline-tolerant) feed a daily timeline, weather calendar, weekly/monthly insight charts and automatic commute detection.",
        "Smart alerts (rain, heat, strong sun, falling pressure) with linked to-do tasks, and outdoor plans re-checked against the forecast 3 hours ahead.",
      ] },
      { title: "Privacy & Release", points: [
        "Privacy-first: no login, ads or analytics; data stays on the phone and only location rounded to ~1 km reaches Open-Meteo.",
        "Shipped a signed, R8-shrunk v1.0.0 release with Room migrations and on-device database tests.",
      ] },
    ],
  },
  {
    slug: "timeless-trade",
    name: "Timeless Trade",
    subtitle: "Artisan E-Commerce Platform for Cultural Sustainability",
    category: "Full-Stack Web",
    tags: "Flask · SQL · REST",
    colors: ["#f5d7a1", "#b57a2a", "#2b1704"],
    summary: "A web marketplace that helps local artisans list and sell handcrafted products directly to buyers.",
    stats: [["2", "role-separated user types"], ["3", "API domains: products, orders, inventory"], ["SQL", "relational data model"]],
    stack: ["Python", "Flask", "SQL", "HTML5", "CSS3", "JavaScript", "REST APIs"],
    sections: [
      { title: "What I Built", points: [
        "Platform: a full-stack marketplace with artisan product listings, catalog browsing and buyer–seller interaction flows.",
        "Authentication: user registration and login with role-separated access for artisans and buyers.",
        "API Layer: REST APIs for product, order and inventory management.",
        "Data Layer: products, orders and users modelled in a relational SQL schema to support search and filtering.",
      ] },
    ],
  },
];

export const gradient = ([a, b, c]) => `radial-gradient(circle at 35% 30%, ${a}, ${b} 48%, ${c})`;
