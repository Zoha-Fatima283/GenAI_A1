# Generative AI Image Restoration & Face-to-Sketch System

A browser-based Generative AI application implementing four related deep learning tasks:

1. **Universal Multi-Corruption Image Restoration**
2. **Hard-Routed Mixture of Experts**
3. **Soft Mixture of Experts**
4. **Conditional Face-to-Sketch Generation**

The assigment combines deep learning, ONNX Runtime, FastAPI, React, Tailwind CSS, Optuna, experiment tracking, and Docker into a single web-based application.

---

## Project Overview

The project explores different approaches for image restoration and conditional image generation.

For Tasks 1–3, the system handles three types of image degradation:

* Salt-and-pepper noise
* Gaussian blur
* Rectangular occlusion

Corruptions are generated programmatically rather than stored as separate datasets. During inference, the user uploads a clean image, selects a corruption type and severity, and the backend generates the degraded image before passing it to the restoration pipeline.

For Task 4, the system performs paired facial photo-to-sketch generation using a conditional GAN.

### Overall Pipeline

```text
Clean Image
    |
    v
Corruption Generator
    |
    +------------------+------------------+
    |                  |                  |
    v                  v                  v
Salt & Pepper    Gaussian Blur       Occlusion
    |                  |                  |
    +------------------+------------------+
                       |
                       v
                Degraded Image
                       |
          +------------+------------+
          |            |            |
          v            v            v
        Task 1       Task 2       Task 3
      Universal     Hard Route    Soft MoE
          |            |            |
          v            v            v
       Restored     Restored     Restored
        Image        Image        Image
```

Task 4:

```text
Face Photo + Style
        |
        v
 U-Net Generator
        |
        v
 Generated Sketch
```

---

# Tasks

## Task 1 — Universal Multi-Corruption Restoration

Task 1 implements a convolutional autoencoder capable of restoring multiple types of image corruption using a single universal model.

### Architecture

```text
Corrupted Image
      |
      v
Convolutional Encoder
      |
      v
Compressed Latent Representation
      |
      v
Convolutional Decoder
      |
      v
Restored Image
```

The restoration model learns:

```text
x_hat = D(E(x_corrupted))
```

The training objective combines L1 reconstruction loss and SSIM:

```text
L = α L1(x, x_hat) + (1 - α)(1 - SSIM(x, x_hat))
```

The trained model is exported to:

```text
models/universal_ae.onnx
```

---

## Task 2 — Hard Routing

Task 2 uses a corruption classifier to determine which specialized restoration model should process the degraded image.

The classifier predicts four classes:

```text
0 → Clean
1 → Salt-and-Pepper
2 → Gaussian Blur
3 → Occlusion
```

The predicted class is used for hard routing.

```text
                 Degraded Image
                       |
                       v
              Corruption Classifier
                       |
          +------------+------------+
          |            |            |
          v            v            v
        Salt         Blur          Occlusion
       Expert       Expert          Expert
          |            |              |
          +------------+--------------+
                       |
                       v
                 Restored Image
```

If the classifier predicts a clean image, an identity bypass is used.

### Models

```text
models/classifier.onnx
models/specialist_salt_pepper.onnx
models/specialist_gaussian_blur.onnx
models/specialist_occlusion.onnx
```

The application displays:

* Class probabilities
* Predicted corruption
* Selected expert
* Classification confidence
* Restored image
* Inference time

The corruption selected by the user is only used to **generate the degraded input**. It is not directly used to select the expert.

---

## Task 3 — Soft Mixture of Experts

Task 3 replaces hard routing with a learned soft gating mechanism.

The gating network produces four expert weights:

```text
Clean
Salt-and-Pepper
Gaussian Blur
Occlusion
```

The weights are calculated using:

```text
w = softmax(G(x) / τ)
```

The final restoration is a weighted combination of the expert outputs:

```text
output =
    w_clean * clean_branch
  + w_salt * salt_expert
  + w_blur * blur_expert
  + w_occ * occlusion_expert
```

### Architecture

```text
                  Degraded Image
                        |
                        v
                     Gating
                     Network
                        |
              +---------+---------+
              |         |         |
              v         v         v
           Clean      Salt      Blur      Occlusion
           Branch    Expert    Expert      Expert
              |         |         |           |
              +---------+---------+-----------+
                        |
                        v
                Weighted Combination
                        |
                        v
                 Restored Image
```

The exported model is:

```text
models/soft_moe.onnx
```

The application displays the contribution of every expert as a percentage/weight.

---

# Task 4 — Conditional Face-to-Sketch Generation

Task 4 implements paired image-to-image generation using a conditional GAN.

The model accepts:

* A facial photograph
* A selected sketch style

and generates a corresponding facial sketch.

### Architecture

```text
                  Face Photo
                      |
                      |
                  Style ID
                      |
                      v
               U-Net Generator
                      |
                      v
                Generated Sketch
```

Training uses:

* U-Net generator
* PatchGAN discriminator
* Learned style embedding
* Adversarial loss
* L1 reconstruction loss

The generator is exported to:

```text
models/generator.onnx
```

Only the generator is required during inference.

---

# Datasets

## Tasks 1–3 — Oxford-IIIT Pet

Tasks 1–3 use the Oxford-IIIT Pet Dataset.

The dataset contains 37 categories. Category labels are not required for the restoration objective.

Images are resized to:

```text
128 × 128 RGB
```

The official training data is split into:

* 80% training
* 20% validation

using random seed `42`.

The official test set remains untouched for final evaluation.

### Runtime Corruptions

| Corruption    | Low        | Medium     | High       |
| ------------- | ---------- | ---------- | ---------- |
| Salt & Pepper | p = 0.03   | p = 0.08   | p = 0.15   |
| Gaussian Blur | k=3, σ=0.7 | k=5, σ=1.5 | k=7, σ=2.5 |
| Occlusion     | ~10%       | ~20%       | ~35%       |

---

## Task 4 — FS2K

Task 4 uses the FS2K Facial Sketch Synthesis Dataset containing paired facial photographs and sketches with multiple sketch styles.

Images are resized to:

```text
128 × 128
```

The official training/test separation is preserved.

A 15% validation subset is created from the official training set using random seed `42`.

---

# Hyperparameter Optimization

Optuna is used for hyperparameter optimization across all four tasks.

### Task 1

The following parameters are optimized:

* Learning rate
* Batch size
* Bottleneck size
* Encoder channels
* Dropout
* L1/SSIM weighting

### Task 2

Classifier parameters include:

* Learning rate
* Batch size
* Convolution channels
* Dropout
* Weight decay

Specialist models are also optimized independently.

### Task 3

The optimized parameters include:

* Joint learning rate
* Temperature `τ`
* Classification loss weight
* Balance regularization
* Reconstruction loss weighting

### Task 4

The optimized parameters include:

* Generator learning rate
* Discriminator learning rate
* Batch size
* Base channels
* Dropout
* Style embedding dimension
* Reconstruction loss weight

---

# Evaluation

## Image Restoration

The restoration models are evaluated using:

* PSNR
* SSIM
* L1 reconstruction error

Results are analyzed for each corruption type and severity level.

## Hard Routing

The classifier is evaluated using:

* Accuracy
* Precision
* Recall
* Macro F1-score
* Per-class metrics
* Confusion matrix

## Soft MoE

The following are analyzed:

* Average expert weights
* Expert weights for each corruption
* Expert weights for each severity
* Dominant experts
* Distributed expert contributions

## Runtime Performance

The deployed models are evaluated using:

* Inference time
* Latency
* FPS where applicable
* Memory usage

---

# Web Application

The project provides a browser-based interface for all four tasks.

## Universal Restoration

The user can:

1. Upload a clean image
2. Select a corruption
3. Select the severity
4. Generate the degraded image
5. Restore the image
6. Compare original, degraded, and restored images
7. Download the restored image

## Hard Routing

The interface displays:

* Original image
* Degraded image
* Restored image
* Class probabilities
* Predicted corruption
* Selected expert
* Confidence
* Inference time

## Soft MoE

The interface displays:

* Original image
* Degraded image
* Restored image
* Clean branch weight
* Salt-and-pepper weight
* Gaussian-blur weight
* Occlusion weight
* Inference time

## Face-to-Sketch

The user can:

1. Upload a face image
2. Select a sketch style
3. Generate the sketch
4. Compare the input and generated output
5. Download the generated sketch

---

# Technology Stack

### Machine Learning

* Python
* PyTorch
* ONNX
* ONNX Runtime
* Optuna
* MLflow / Weights & Biases

### Backend

* FastAPI
* Python
* ONNX Runtime

### Frontend

* React
* Vite
* Tailwind CSS

### Deployment

* Docker
* Docker Compose

---

# Project Structure

```text
project/
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── models/
│       ├── universal_ae.onnx
│       ├── classifier.onnx
│       ├── specialist_salt_pepper.onnx
│       ├── specialist_gaussian_blur.onnx
│       ├── specialist_occlusion.onnx
│       ├── soft_moe.onnx
│       └── generator.onnx
│
├── frontend/
│   ├── package.json
│   ├── src/
│   └── ...
│
├── training/
│   ├── task1/
│   ├── task2/
│   ├── task3/
│   └── task4/
│
├── experiments/
│   ├── optuna/
│   └── mlflow/
│
├── Dockerfile
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

# Installation

## 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <REPOSITORY_NAME>
```

---

# Backend Setup

Create a Python virtual environment:

```bash
python -m venv venv
```

### Windows

```bash
venv\Scripts\activate
```

### Linux/macOS

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r backend/requirements.txt
```

Start the FastAPI backend:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Backend:

```text
http://localhost:8000
```

Health check:

```text
http://localhost:8000/health
```

---

# Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

---

# Docker

The complete application can be started using Docker Compose:

```bash
docker compose up --build
```

This starts the frontend and backend services together.

To stop the application:

```bash
docker compose down
```

---

# ONNX Deployment

All inference models are exported to ONNX and loaded using ONNX Runtime.

The backend loads the models during startup and reuses the loaded sessions for subsequent requests.

The deployed models are:

```text
universal_ae.onnx
classifier.onnx
specialist_salt_pepper.onnx
specialist_gaussian_blur.onnx
specialist_occlusion.onnx
soft_moe.onnx
generator.onnx
```

ONNX outputs are verified against the corresponding original-framework models during the export and validation process.

---

# Experiment Tracking

MLflow / Weights & Biases is used to track important experiments.

Tracked information includes:

* Hyperparameters
* Training loss
* Validation loss
* PSNR
* SSIM
* Classification metrics
* Optuna trials
* Generated samples
* Model checkpoints

---

# Reproducibility

Random seeds are fixed where deterministic behavior is required.

The primary dataset splits use:

```text
Seed = 42
```

Validation and test corruption configurations can be recorded using manifests containing:

* Corruption type
* Severity
* Random seed
* Noise parameters
* Blur parameters
* Occlusion coordinates

---

# Design Decisions

### Universal Restoration

A single universal restoration model avoids maintaining a separate model for every corruption type.

### Hard Routing

Hard routing investigates whether explicitly identifying the degradation before restoration allows specialized models to perform better.

### Soft MoE

Soft routing allows multiple experts to contribute to restoration, which is useful when an image contains ambiguous or mixed degradation.

### Runtime Corruption

Runtime corruption generation avoids storing multiple corrupted copies of the dataset and allows controlled severity levels.

### ONNX

ONNX provides a portable inference representation and allows the trained models to be deployed using ONNX Runtime.

---

# Limitations

* Models currently operate at 128×128 resolution.
* CPU inference can be slower than GPU inference.
* Synthetic corruption does not represent every real-world camera degradation.
* Hard routing can fail if the corruption classifier predicts the wrong class.
* Soft MoE performance depends on the quality of both the gating network and restoration experts.
* Face-to-sketch quality depends on the diversity of the FS2K dataset and its available sketch styles.

---

# Repository Guidelines

Large datasets and generated files should not be committed directly to the repository.

The repository should contain:

* Source code
* Training scripts
* Evaluation scripts
* Configuration files
* Dependency files
* Docker configuration
* Documentation
* Experiment configuration

Large model files should be handled using Git LFS or documented model-download instructions where appropriate.

---

# AI Assistance

AI tools were used as development assistance for tasks including debugging, code structuring, technical explanations, and documentation.

Generated code and suggestions were reviewed, adapted, tested, and verified against the project's implementation and assignment requirements.

---

# Author

**Zoha Fatima**

BS Computer Science
FAST-NUCES Islamabad

---

# Project Status

| Component                      | Status      |
| ------------------------------ | ----------- |
| Task 1 — Universal Restoration | Implemented |
| Task 2 — Hard Routing          | Implemented |
| Task 3 — Soft MoE              | Implemented |
| Task 4 — Face-to-Sketch        | Implemented |
| ONNX Deployment                | Implemented |
| React Frontend                 | Implemented |
| FastAPI Backend                | Implemented |
| Optuna                         | Implemented |
| Experiment Tracking            | Implemented |
| Docker                         | In Progress |
| Final Evaluation               | In Progress |

---

## License

This assignment was developed for academic purposes as part of a Generative AI course assignment.
