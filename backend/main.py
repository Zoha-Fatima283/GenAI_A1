from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from PIL import Image, ImageFilter
import numpy as np
import onnxruntime as ort
import io
import base64
import random
import time


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="GenAI Assignment API",
    version="1.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def preprocess_image(image):
    """
    PIL RGB image -> ONNX tensor

    Output:
        [1, 3, 128, 128]
    """

    image = image.resize((128, 128))

    image_np = np.array(
        image
    ).astype(np.float32) / 255.0

    # HWC -> CHW
    image_np = np.transpose(
        image_np,
        (2, 0, 1)
    )

    # Add batch dimension
    image_np = np.expand_dims(
        image_np,
        axis=0
    )

    return image_np


def tensor_to_png(tensor):
    """
    ONNX tensor -> PNG bytes
    """

    image = tensor[0]

    image = np.clip(
        image,
        0,
        1
    )

    image = (
        image * 255
    ).astype(np.uint8)

    # CHW -> HWC
    image = np.transpose(
        image,
        (1, 2, 0)
    )

    image = Image.fromarray(
        image
    )

    buffer = io.BytesIO()

    image.save(
        buffer,
        format="PNG"
    )

    buffer.seek(0)

    return buffer.getvalue()


def pil_to_png(image):
    """
    PIL image -> PNG bytes
    """

    buffer = io.BytesIO()

    image.save(
        buffer,
        format="PNG"
    )

    buffer.seek(0)

    return buffer.getvalue()


def image_to_base64(png_bytes):
    """
    PNG bytes -> base64 string
    """

    return base64.b64encode(
        png_bytes
    ).decode("utf-8")


def softmax(x):
    """
    Numerically stable softmax.
    """

    x = x - np.max(x)

    exp_x = np.exp(x)

    return exp_x / np.sum(exp_x)


# ============================================================
# CORRUPTION FUNCTIONS
# ============================================================

def apply_salt_pepper(image, severity):
    """
    Assignment corruption:

    low    -> p = 0.03
    medium -> p = 0.08
    high   -> p = 0.15
    """

    image_np = np.array(
        image
    ).copy()

    probability_map = {
        "low": 0.03,
        "medium": 0.08,
        "high": 0.15
    }

    probability = probability_map[
        severity
    ]

    random_values = np.random.rand(
        image_np.shape[0],
        image_np.shape[1]
    )

    # Pepper
    pepper_mask = (
        random_values < probability / 2
    )

    # Salt
    salt_mask = (
        random_values >
        1 - probability / 2
    )

    image_np[
        pepper_mask
    ] = 0

    image_np[
        salt_mask
    ] = 255

    return Image.fromarray(
        image_np.astype(np.uint8)
    )


def apply_gaussian_blur(image, severity):
    """
    Assignment corruption:

    low    -> kernel 3, sigma 0.7
    medium -> kernel 5, sigma 1.5
    high   -> kernel 7, sigma 2.5
    """

    settings = {
        "low": {
            "kernel": 3,
            "sigma": 0.7
        },
        "medium": {
            "kernel": 5,
            "sigma": 1.5
        },
        "high": {
            "kernel": 7,
            "sigma": 2.5
        }
    }

    config = settings[
        severity
    ]

    sigma = config["sigma"]

    # PIL GaussianBlur uses radius.
    # The assignment's sigma is used
    # as the blur strength.
    blurred = image.filter(
        ImageFilter.GaussianBlur(
            radius=sigma
        )
    )

    return blurred


def apply_occlusion(image, severity):
    """
    Assignment corruption:

    low    -> approximately 10%, 1 rectangle
    medium -> approximately 20%, 2 rectangles
    high   -> approximately 35%, 3 rectangles
    """

    image_np = np.array(
        image
    ).copy()

    height, width = image_np.shape[:2]

    coverage_map = {
        "low": 0.10,
        "medium": 0.20,
        "high": 0.35
    }

    rectangle_map = {
        "low": 1,
        "medium": 2,
        "high": 3
    }

    target_coverage = coverage_map[
        severity
    ]

    num_rectangles = rectangle_map[
        severity
    ]

    total_area = width * height

    # Area allocated to each rectangle
    area_per_rectangle = (
        total_area *
        target_coverage /
        num_rectangles
    )

    for _ in range(
        num_rectangles
    ):

        # Generate rectangle dimensions
        # with a random aspect ratio.
        aspect_ratio = random.uniform(
            0.6,
            1.6
        )

        rect_width = int(
            np.sqrt(
                area_per_rectangle *
                aspect_ratio
            )
        )

        rect_height = int(
            np.sqrt(
                area_per_rectangle /
                aspect_ratio
            )
        )

        rect_width = max(
            1,
            min(
                rect_width,
                width
            )
        )

        rect_height = max(
            1,
            min(
                rect_height,
                height
            )
        )

        x1 = random.randint(
            0,
            max(
                0,
                width - rect_width
            )
        )

        y1 = random.randint(
            0,
            max(
                0,
                height - rect_height
            )
        )

        x2 = x1 + rect_width
        y2 = y1 + rect_height

        image_np[
            y1:y2,
            x1:x2
        ] = 0

    return Image.fromarray(
        image_np.astype(np.uint8)
    )


def apply_corruption(
    image,
    corruption,
    severity
):
    """
    Shared corruption pipeline
    used by Tasks 1, 2 and 3.
    """

    valid_corruptions = [
        "salt_pepper",
        "gaussian_blur",
        "occlusion"
    ]

    valid_severities = [
        "low",
        "medium",
        "high"
    ]

    if corruption not in valid_corruptions:
        raise ValueError(
            f"Invalid corruption: {corruption}"
        )

    if severity not in valid_severities:
        raise ValueError(
            f"Invalid severity: {severity}"
        )

    if corruption == "salt_pepper":

        return apply_salt_pepper(
            image,
            severity
        )

    elif corruption == "gaussian_blur":

        return apply_gaussian_blur(
            image,
            severity
        )

    elif corruption == "occlusion":

        return apply_occlusion(
            image,
            severity
        )

    raise ValueError(
        "Unsupported corruption"
    )


def prepare_task_images(
    original_image,
    corruption,
    severity
):
    """
    Common pipeline:

    clean image
        ↓
    corruption
        ↓
    degraded image
        ↓
    ONNX tensor
    """

    degraded_image = apply_corruption(
        original_image,
        corruption,
        severity
    )

    input_tensor = preprocess_image(
        degraded_image
    )

    return (
        degraded_image,
        input_tensor
    )


def build_image_response(
    original_image,
    degraded_image,
    restored_tensor,
    corruption,
    severity,
    inference_time_ms
):
    """
    Common response format for Tasks 1–3.
    """

    original_png = pil_to_png(
        original_image.resize(
            (128, 128)
        )
    )

    degraded_png = pil_to_png(
        degraded_image.resize(
            (128, 128)
        )
    )

    restored_png = tensor_to_png(
        restored_tensor
    )

    return {
        "success": True,

        "original_image":
            image_to_base64(
                original_png
            ),

        "degraded_image":
            image_to_base64(
                degraded_png
            ),

        "restored_image":
            image_to_base64(
                restored_png
            ),

        "corruption":
            corruption,

        "severity":
            severity,

        "inference_time_ms":
            round(
                inference_time_ms,
                2
            )
    }


# ============================================================
# TASK 1
# UNIVERSAL RESTORATION MODEL
# ============================================================

print("\nLoading Task 1 model...")

universal_session = ort.InferenceSession(
    "models/universal_ae.onnx",
    providers=[
        "CPUExecutionProvider"
    ]
)

universal_input = (
    universal_session
    .get_inputs()[0]
    .name
)

universal_output = (
    universal_session
    .get_outputs()[0]
    .name
)

print(
    "Universal input:",
    universal_input
)

print(
    "Universal output:",
    universal_output
)


# ============================================================
# TASK 2
# HARD ROUTING
# ============================================================

print("\nLoading Task 2 models...")

classifier_session = ort.InferenceSession(
    "models/classifier.onnx",
    providers=[
        "CPUExecutionProvider"
    ]
)

salt_session = ort.InferenceSession(
    "models/specialist_salt_pepper.onnx",
    providers=[
        "CPUExecutionProvider"
    ]
)

blur_session = ort.InferenceSession(
    "models/specialist_gaussian_blur.onnx",
    providers=[
        "CPUExecutionProvider"
    ]
)

occ_session = ort.InferenceSession(
    "models/specialist_occlusion.onnx",
    providers=[
        "CPUExecutionProvider"
    ]
)


classifier_input = (
    classifier_session
    .get_inputs()[0]
    .name
)

classifier_output = (
    classifier_session
    .get_outputs()[0]
    .name
)

salt_input = (
    salt_session
    .get_inputs()[0]
    .name
)

salt_output = (
    salt_session
    .get_outputs()[0]
    .name
)

blur_input = (
    blur_session
    .get_inputs()[0]
    .name
)

blur_output = (
    blur_session
    .get_outputs()[0]
    .name
)

occ_input = (
    occ_session
    .get_inputs()[0]
    .name
)

occ_output = (
    occ_session
    .get_outputs()[0]
    .name
)


# ============================================================
# TASK 3
# SOFT MOE
# ============================================================

print("\nLoading Task 3 model...")

moe_session = ort.InferenceSession(
    "models/soft_moe.onnx",
    providers=[
        "CPUExecutionProvider"
    ]
)

moe_inputs = (
    moe_session
    .get_inputs()
)

moe_outputs = (
    moe_session
    .get_outputs()
)

print(
    "MoE inputs:",
    [
        x.name
        for x in moe_inputs
    ]
)

print(
    "MoE outputs:",
    [
        x.name
        for x in moe_outputs
    ]
)

moe_input = (
    moe_inputs[0].name
)

moe_output_names = [
    x.name
    for x in moe_outputs
]


# ============================================================
# TASK 4
# FACE TO SKETCH
# ============================================================

print("\nLoading Task 4 model...")

generator_session = ort.InferenceSession(
    "models/generator.onnx",
    providers=[
        "CPUExecutionProvider"
    ]
)

generator_inputs = (
    generator_session
    .get_inputs()
)

generator_outputs = (
    generator_session
    .get_outputs()
)

print(
    "Generator inputs:",
    [
        (
            x.name,
            x.shape,
            x.type
        )
        for x in generator_inputs
    ]
)

print(
    "Generator outputs:",
    [
        (
            x.name,
            x.shape,
            x.type
        )
        for x in generator_outputs
    ]
)

generator_output = (
    generator_outputs[0].name
)


# ============================================================
# STARTUP SUMMARY
# ============================================================

print(
    "\n=========================================="
)

print(
    "All ONNX models loaded successfully"
)

print(
    "==========================================\n"
)


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "ok",

        "models": {
            "universal": True,
            "classifier": True,
            "specialists": True,
            "soft_moe": True,
            "generator": True
        }
    }


# ============================================================
# TASK 1 ENDPOINT
# UNIVERSAL RESTORATION
# ============================================================

@app.post("/universal-restoration")
async def universal_restoration(
    file: UploadFile = File(...),
    corruption: str = Form(...),
    severity: str = Form(...)
):

    try:

        # ----------------------------------------------------
        # READ CLEAN IMAGE
        # ----------------------------------------------------

        contents = await file.read()

        original_image = Image.open(
            io.BytesIO(contents)
        ).convert("RGB")

        # ----------------------------------------------------
        # CORRUPT IMAGE
        # ----------------------------------------------------

        (
            degraded_image,
            input_tensor
        ) = prepare_task_images(
            original_image,
            corruption,
            severity
        )

        # ----------------------------------------------------
        # UNIVERSAL MODEL
        # ----------------------------------------------------

        start_time = time.perf_counter()

        result = universal_session.run(
            [universal_output],
            {
                universal_input:
                input_tensor
            }
        )

        inference_time_ms = (
            time.perf_counter()
            - start_time
        ) * 1000

        restored = result[0]

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return build_image_response(
            original_image,
            degraded_image,
            restored,
            corruption,
            severity,
            inference_time_ms
        )

    except Exception as e:

        print(
            "Universal restoration error:",
            e
        )

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e)
            }
        )


# ============================================================
# TASK 2 ENDPOINT
# HARD ROUTING
# ============================================================

@app.post("/hard-routing")
async def hard_routing(
    file: UploadFile = File(...),
    corruption: str = Form(...),
    severity: str = Form(...)
):

    try:

        # ----------------------------------------------------
        # READ CLEAN IMAGE
        # ----------------------------------------------------

        contents = await file.read()

        original_image = Image.open(
            io.BytesIO(contents)
        ).convert("RGB")

        # ----------------------------------------------------
        # CORRUPT IMAGE
        # ----------------------------------------------------

        (
            degraded_image,
            input_tensor
        ) = prepare_task_images(
            original_image,
            corruption,
            severity
        )

        # ----------------------------------------------------
        # CLASSIFIER
        # ----------------------------------------------------

        start_time = time.perf_counter()

        classifier_result = (
            classifier_session.run(
                [classifier_output],
                {
                    classifier_input:
                    input_tensor
                }
            )[0]
        )

        logits = classifier_result[0]

        probabilities = softmax(
            logits
        )

        class_names = [
            "clean",
            "salt_pepper",
            "gaussian_blur",
            "occlusion"
        ]

        predicted_class = int(
            np.argmax(
                probabilities
            )
        )

        predicted_corruption = (
            class_names[
                predicted_class
            ]
        )

        confidence = float(
            probabilities[
                predicted_class
            ]
        )

        # ----------------------------------------------------
        # HARD ROUTING
        # ----------------------------------------------------

        if predicted_corruption == "clean":

            restored = input_tensor

            selected_expert = "identity"

        elif predicted_corruption == "salt_pepper":

            restored = salt_session.run(
                [salt_output],
                {
                    salt_input:
                    input_tensor
                }
            )[0]

            selected_expert = (
                "salt_pepper"
            )

        elif predicted_corruption == "gaussian_blur":

            restored = blur_session.run(
                [blur_output],
                {
                    blur_input:
                    input_tensor
                }
            )[0]

            selected_expert = (
                "gaussian_blur"
            )

        elif predicted_corruption == "occlusion":

            restored = occ_session.run(
                [occ_output],
                {
                    occ_input:
                    input_tensor
                }
            )[0]

            selected_expert = (
                "occlusion"
            )

        else:

            raise RuntimeError(
                "Unknown corruption class"
            )

        inference_time_ms = (
            time.perf_counter()
            - start_time
        ) * 1000

        # ----------------------------------------------------
        # COMMON RESPONSE
        # ----------------------------------------------------

        response = build_image_response(
            original_image,
            degraded_image,
            restored,
            corruption,
            severity,
            inference_time_ms
        )

        # ----------------------------------------------------
        # HARD ROUTING INFORMATION
        # ----------------------------------------------------

        response[
            "predicted_corruption"
        ] = predicted_corruption

        response[
            "selected_expert"
        ] = selected_expert

        response[
            "confidence"
        ] = round(
            confidence,
            4
        )

        response[
            "probabilities"
        ] = {
            "clean":
                round(
                    float(probabilities[0]),
                    4
                ),

            "salt_pepper":
                round(
                    float(probabilities[1]),
                    4
                ),

            "gaussian_blur":
                round(
                    float(probabilities[2]),
                    4
                ),

            "occlusion":
                round(
                    float(probabilities[3]),
                    4
                )
        }

        return response

    except Exception as e:

        print(
            "Hard routing error:",
            e
        )

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e)
            }
        )


# ============================================================
# TASK 3 ENDPOINT
# SOFT MOE
# ============================================================

@app.post("/soft-mixture")
async def soft_mixture(
    file: UploadFile = File(...),
    corruption: str = Form(...),
    severity: str = Form(...)
):

    try:

        # ----------------------------------------------------
        # READ CLEAN IMAGE
        # ----------------------------------------------------

        contents = await file.read()

        original_image = Image.open(
            io.BytesIO(contents)
        ).convert("RGB")

        # ----------------------------------------------------
        # CORRUPT IMAGE
        # ----------------------------------------------------

        (
            degraded_image,
            input_tensor
        ) = prepare_task_images(
            original_image,
            corruption,
            severity
        )

        # ----------------------------------------------------
        # SOFT MOE
        # ----------------------------------------------------

        start_time = time.perf_counter()

        results = moe_session.run(
            None,
            {
                moe_input:
                input_tensor
            }
        )

        inference_time_ms = (
            time.perf_counter()
            - start_time
        ) * 1000

        # ----------------------------------------------------
        # OUTPUT IMAGE
        # ----------------------------------------------------

        restored = results[0]

        # ----------------------------------------------------
        # EXPERT WEIGHTS
        # ----------------------------------------------------

        if len(results) > 1:

            weights = np.asarray(
                results[1]
            )

            if weights.ndim > 1:

                weights = weights[0]

            weights = weights.tolist()

        else:

            weights = []

        # ----------------------------------------------------
        # COMMON RESPONSE
        # ----------------------------------------------------

        response = build_image_response(
            original_image,
            degraded_image,
            restored,
            corruption,
            severity,
            inference_time_ms
        )

        # ----------------------------------------------------
        # MOE WEIGHTS
        # ----------------------------------------------------

        response[
            "weights"
        ] = {
            "clean":
                (
                    float(weights[0])
                    if len(weights) > 0
                    else None
                ),

            "salt_pepper":
                (
                    float(weights[1])
                    if len(weights) > 1
                    else None
                ),

            "gaussian_blur":
                (
                    float(weights[2])
                    if len(weights) > 2
                    else None
                ),

            "occlusion":
                (
                    float(weights[3])
                    if len(weights) > 3
                    else None
                )
        }

        return response

    except Exception as e:

        print(
            "Soft MoE error:",
            e
        )

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e)
            }
        )


# ============================================================
# TASK 4 ENDPOINT
# FACE TO SKETCH
# ============================================================

@app.post("/face-to-sketch")
async def face_to_sketch(
    file: UploadFile = File(...),
    style: int = Form(...)
):

    try:

        contents = await file.read()

        image = Image.open(
            io.BytesIO(contents)
        ).convert("RGB")

        input_tensor = preprocess_image(
            image
        )

        # ----------------------------------------------------
        # STYLE INPUT
        # ----------------------------------------------------

        style_tensor = np.array(
            [style],
            dtype=np.int64
        )

        # ----------------------------------------------------
        # GENERATOR INPUTS
        # ----------------------------------------------------

        input_names = [
            x.name
            for x in generator_inputs
        ]

        feed = {}

        feed[
            input_names[0]
        ] = input_tensor

        if len(input_names) > 1:

            feed[
                input_names[1]
            ] = style_tensor

        # ----------------------------------------------------
        # GENERATOR
        # ----------------------------------------------------

        result = generator_session.run(
            [generator_output],
            feed
        )

        sketch = result[0]

        png_bytes = tensor_to_png(
            sketch
        )

        return {
            "success": True,
            "image":
                image_to_base64(
                    png_bytes
                ),
            "style":
                style
        }

    except Exception as e:

        print(
            "Face-to-sketch error:",
            e
        )

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e)
            }
        )