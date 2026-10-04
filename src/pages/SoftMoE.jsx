import { useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:8000";

export default function SoftMoE() {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);

    const [originalImage, setOriginalImage] = useState(null);
    const [degradedImage, setDegradedImage] = useState(null);
    const [restoredImage, setRestoredImage] = useState(null);

    const [corruption, setCorruption] = useState("salt_pepper");
    const [severity, setSeverity] = useState("low");

    const [weights, setWeights] = useState(null);
    const [inferenceTime, setInferenceTime] = useState(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];

        if (!selectedFile) return;

        setFile(selectedFile);
        setPreview(URL.createObjectURL(selectedFile));

        setOriginalImage(null);
        setDegradedImage(null);
        setRestoredImage(null);

        setWeights(null);
        setInferenceTime(null);

        setError("");
    };

    const handleProcess = async () => {
        if (!file) {
            setError("Please select an image first.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const formData = new FormData();

            formData.append("file", file);
            formData.append("corruption", corruption);
            formData.append("severity", severity);

            const response = await axios.post(
                `${API_URL}/soft-mixture`,
                formData
            );

            const data = response.data;

            setOriginalImage(
                `data:image/png;base64,${data.original_image}`
            );

            setDegradedImage(
                `data:image/png;base64,${data.degraded_image}`
            );

            setRestoredImage(
                `data:image/png;base64,${data.restored_image}`
            );

            setWeights(
                data.weights
            );

            setInferenceTime(
                data.inference_time_ms
            );

        } catch (err) {
            console.error(err);

            setError(
                err.response?.data?.error ||
                "Could not connect to the backend."
            );
        } finally {
            setLoading(false);
        }
    };

    const downloadImage = () => {
        if (!restoredImage) return;

        const link = document.createElement("a");

        link.href = restoredImage;
        link.download = "soft_moe_restored.png";

        link.click();
    };

    return (
        <div className="min-h-screen p-8">

            <div className="mb-8">

                <h1 className="text-3xl font-bold text-gray-900">
                    Soft Mixture of Experts
                </h1>

                <p className="mt-2 text-gray-500">
                    The gating network distributes weights across
                    restoration experts instead of selecting only one.
                </p>

            </div>


            <div className="max-w-6xl">

                {/* Upload */}

                <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-10">

                    <div className="text-center">

                        <h2 className="text-xl font-semibold">
                            Upload Clean Image
                        </h2>

                        <p className="mt-2 text-sm text-gray-500">
                            The image will be corrupted before entering the MoE.
                        </p>

                        <label className="mt-6 inline-block">

                            <span className="cursor-pointer rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white">
                                Choose Image
                            </span>

                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                        </label>

                    </div>

                </div>


                {/* Controls */}

                {file && (

                    <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">

                        <h2 className="text-lg font-semibold">
                            Corruption Settings
                        </h2>

                        <div className="mt-5 grid gap-5 md:grid-cols-2">

                            <div>

                                <label className="mb-2 block text-sm font-medium">
                                    Corruption Type
                                </label>

                                <select
                                    value={corruption}
                                    onChange={(e) =>
                                        setCorruption(e.target.value)
                                    }
                                    className="w-full rounded-lg border px-4 py-3"
                                >
                                    <option value="salt_pepper">
                                        Salt & Pepper
                                    </option>

                                    <option value="gaussian_blur">
                                        Gaussian Blur
                                    </option>

                                    <option value="occlusion">
                                        Rectangular Occlusion
                                    </option>
                                </select>

                            </div>


                            <div>

                                <label className="mb-2 block text-sm font-medium">
                                    Severity
                                </label>

                                <select
                                    value={severity}
                                    onChange={(e) =>
                                        setSeverity(e.target.value)
                                    }
                                    className="w-full rounded-lg border px-4 py-3"
                                >
                                    <option value="low">
                                        Low
                                    </option>

                                    <option value="medium">
                                        Medium
                                    </option>

                                    <option value="high">
                                        High
                                    </option>
                                </select>

                            </div>

                        </div>


                        <button
                            onClick={handleProcess}
                            disabled={loading}
                            className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white disabled:opacity-50"
                        >
                            {loading
                                ? "Running MoE..."
                                : "Degrade & Restore"}
                        </button>

                    </div>

                )}


                {/* Results */}

                {restoredImage && (

                    <div className="mt-8">

                        <div className="flex items-center justify-between">

                            <h2 className="text-xl font-semibold">
                                Soft MoE Result
                            </h2>

                            <button
                                onClick={downloadImage}
                                className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white"
                            >
                                Download Restored
                            </button>

                        </div>


                        {/* Images */}

                        <div className="mt-5 grid gap-6 md:grid-cols-3">

                            <div className="rounded-2xl bg-white p-5 shadow-sm">

                                <h3 className="mb-3 font-semibold">
                                    Original
                                </h3>

                                <img
                                    src={originalImage}
                                    alt="Original"
                                    className="w-full rounded-xl border"
                                />

                            </div>


                            <div className="rounded-2xl bg-white p-5 shadow-sm">

                                <h3 className="mb-3 font-semibold">
                                    Degraded
                                </h3>

                                <img
                                    src={degradedImage}
                                    alt="Degraded"
                                    className="w-full rounded-xl border"
                                />

                            </div>


                            <div className="rounded-2xl bg-white p-5 shadow-sm">

                                <h3 className="mb-3 font-semibold">
                                    Restored
                                </h3>

                                <img
                                    src={restoredImage}
                                    alt="Restored"
                                    className="w-full rounded-xl border"
                                />

                            </div>

                        </div>


                        {/* Expert weights */}

                        {weights && (

                            <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">

                                <h2 className="text-lg font-semibold">
                                    Expert Weights
                                </h2>

                                <p className="mt-1 text-sm text-gray-500">
                                    Soft routing distributes contribution
                                    across all restoration branches.
                                </p>


                                <div className="mt-6 space-y-5">

                                    {Object.entries(weights).map(
                                        ([name, value]) => {

                                            const percentage =
                                                value * 100;

                                            return (

                                                <div key={name}>

                                                    <div className="mb-2 flex justify-between">

                                                        <span className="text-sm font-medium">
                                                            {name}
                                                        </span>

                                                        <span className="text-sm font-semibold">
                                                            {percentage.toFixed(2)}%
                                                        </span>

                                                    </div>

                                                    <div className="h-3 overflow-hidden rounded-full bg-gray-200">

                                                        <div
                                                            className="h-full rounded-full bg-blue-600"
                                                            style={{
                                                                width: `${percentage}%`
                                                            }}
                                                        />

                                                    </div>

                                                </div>

                                            );
                                        }
                                    )}

                                </div>

                            </div>

                        )}


                        <div className="mt-5 rounded-xl bg-gray-50 p-4">

                            <p className="text-sm text-gray-500">
                                Inference Time
                            </p>

                            <p className="font-semibold">
                                {inferenceTime} ms
                            </p>

                        </div>

                    </div>

                )}

                {error && (

                    <div className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
                        {error}
                    </div>

                )}

            </div>

        </div>
    );
}