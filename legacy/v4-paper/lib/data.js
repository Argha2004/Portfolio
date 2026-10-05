// Personal data — sourced from resume. Edit here; every page reads from this file.
export const profile = {
  name: "Arghadeep Pakhira",
  role: "AI/ML & Edge AI Engineer",
  tagline: "Aspiring AI/ML & Edge AI engineer building deep learning, on-device AI and LLM-powered tools.",
  location: "Purba Medinipur, West Bengal, India",
  email: "arghadeeppakhira@gmail.com",
  focus: ["Deep Learning", "Edge AI", "LLM Systems", "Medical Imaging", "Android"],
  summary:
    "B.Tech (CSBS) undergraduate focused on deep learning, Edge AI, LLM-powered tools and on-device mobile AI — and co-author of an IEEE COMSNETS 2026 demo paper on privacy-preserving edge intelligence for traffic monitoring.",
  summaryLong:
    "I work across the full ML lifecycle: training multi-label CNNs on 100K+ medical images, quantizing and exporting models to ONNX for offline Android inference, building Gemini + MCP agentic tools, and shipping React / FastAPI / Flask dashboards and Kotlin / Jetpack Compose apps.",
};

export const socials = [
  { label: "GitHub", href: "https://github.com/Argha2004" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/arghadeep-pakhira/" },
  { label: "Kaggle", href: "https://www.kaggle.com/arghadeeppakhira" },
  { label: "ORCID", href: "https://orcid.org/0009-0008-7596-8573" },
];

export const pillars = [
  { title: "Deep Learning & Medical AI", items: "PyTorch, multi-label CNNs, ROC-AUC, Grad-CAM" },
  { title: "Edge & On-Device AI", items: "YOLO11, ONNX Runtime Mobile, INT8, Raspberry Pi" },
  { title: "LLM Agents & Full-Stack", items: "Gemini API, MCP, FastAPI, React, Kotlin" },
];

export const skills = [
  ["Languages", "Python, C, C++, Kotlin, TypeScript, JavaScript, SQL"],
  ["Machine & Deep Learning", "PyTorch, Torchvision, TensorFlow, Keras, Scikit-learn, Pandas, NumPy, Matplotlib, CNNs (DenseNet, EfficientNet, ResNet), Transformers, Transfer Learning, Multi-Label Classification, Weighted BCE & Asymmetric Loss, ROC-AUC Evaluation, Grad-CAM"],
  ["LLMs & Generative AI", "Google Gemini API (2.5 Flash / Pro), Model Context Protocol (MCP), Tool Calling, LLM Pre-training from Scratch (GPT-style), RAG, FAISS, Prompt Engineering"],
  ["Edge AI & Computer Vision", "YOLO11, OpenCV, ONNX Export, ONNX Runtime Mobile, INT8 Quantization, Android NNAPI, Raspberry Pi, On-Device Inference"],
  ["Android", "Kotlin, Jetpack Compose, Material 3, MVVM, Hilt, Coroutines & Flow, Room, DataStore, WorkManager, Retrofit, CameraX, Android Sensor Framework"],
  ["Web & Backend", "React, Vite, Tailwind CSS, shadcn/ui, FastAPI, Flask, Pydantic, REST APIs, JWT Authentication, Server-Sent Events, Leaflet, Recharts, HTML5, CSS3"],
  ["Cloud & Tools", "AWS (IoT Core, Lambda, DynamoDB), Google Cloud, Git, GitHub, Docker, Kaggle & Google Colab, Android Studio, LaTeX / Overleaf"],
];

export const education = [
  { school: "Sister Nivedita University", place: "New Town, Kolkata", degree: "B.Tech in Computer Science & Business Systems (CSBS)", score: "CGPA 7.2 / 10", period: "2023 — 2027 (Expected)" },
  { school: "Deulia Hiraram High School", place: "Purba Medinipur, West Bengal", degree: "Higher Secondary (Class XII)", score: "73%", period: "2023" },
  { school: "K.T.P.P. High School (H.S.)", place: "Purba Medinipur, West Bengal", degree: "Secondary (Class X)", score: "75%", period: "2020" },
];

export const coursework = ["Machine Learning", "Data Structures & Algorithms", "DBMS", "Operating Systems", "Computer Networks", "Mobile Computing"];

export const publication = {
  title: "CrowdLense: A Serverless, Privacy-Preserving Edge AI Framework for Sustainable Crowd-Sourced Real-Time Traffic Monitoring",
  authors: "Shubham Bhunia, Arghadeep Pakhira, Ankita Chanda, Deep Das, Bidyut Saha",
  venue: "18th Intl. Conference on Communication Systems & Networks (IEEE COMSNETS 2026) — Demos & Exhibits Track",
  date: "Jan 2026",
  href: "https://doi.org/10.1109/COMSNETS67989.2026.11418200",
};

export const awards = [
  { title: "IEEE COMSNETS 2026", detail: "Co-authored demo paper on privacy-preserving Edge AI traffic monitoring, published in IEEE Xplore (Demos & Exhibits Track)", year: "2026" },
  { title: "Smart India Hackathon", detail: "Top 10 team in the Sister Nivedita University internal round", year: "2025" },
];

export const certifications = [
  { title: "Design Thinking for Innovation", issuer: "Univ. of Virginia (Coursera)", date: "Mar 2025", href: "https://coursera.org/verify/ZOKITDUZLDOG" },
  { title: "Innovation Management", issuer: "Erasmus Univ. Rotterdam (Coursera)", date: "May 2025", href: "https://coursera.org/verify/HN6J3TTPWHVY" },
  { title: "XPro Digital Transformation Project", issuer: "Employability.life × Federation Univ.", date: "Feb 2026" },
];

export const interests = ["Edge AI & TinyML", "Medical Image Analysis", "LLMs & Agentic AI", "On-Device Mobile AI", "Model Compression", "Privacy-Preserving AI"];

// Bibliography for the paper-style home page. Numbers are referenced by <Cite n={…} />.
export const references = [
  { n: 1, text: "S. Bhunia, A. Pakhira, A. Chanda, D. Das, B. Saha. “CrowdLense: A Serverless, Privacy-Preserving Edge AI Framework for Sustainable Crowd-Sourced Real-Time Traffic Monitoring.” IEEE COMSNETS 2026, Demos & Exhibits Track.", href: "https://doi.org/10.1109/COMSNETS67989.2026.11418200" },
  { n: 2, text: "A. Pakhira et al. CrowdLense — source code. GitHub.", href: "https://github.com/Argha2004/CrowdLense" },
  { n: 3, text: "A. Pakhira. ChestX — chest X-ray disease detection, training + Android app. GitHub.", href: "https://github.com/Argha2004/ChestX" },
  { n: 4, text: "A. Pakhira. Train-Assistant AI — Gemini + MCP training analysis platform. GitHub.", href: "https://github.com/Argha2004/Train-Assistant" },
  { n: 5, text: "A. Pakhira et al. Aira — sensor-based personal weather diary for Android. GitHub.", href: "https://github.com/Argha2004/Aira" },
  { n: 6, text: "X. Wang, Y. Peng, L. Lu, Z. Lu, M. Bagheri, R. M. Summers. “ChestX-ray8: Hospital-scale Chest X-ray Database and Benchmarks on Weakly-Supervised Classification and Localization of Common Thorax Diseases.” CVPR 2017." },
  { n: 7, text: "G. Varma, A. Subramanian, A. Namboodiri, M. Chandraker, C. V. Jawahar. “IDD: A Dataset for Exploring Problems of Autonomous Navigation in Unconstrained Environments.” WACV 2019." },
];
