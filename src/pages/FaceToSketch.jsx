import React, { useState } from "react";
import axios from "axios";
import { Upload, Image as ImageIcon, Loader2, Download } from "lucide-react";

const API_URL = "http://localhost:8000";

export default function FaceToSketch() {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [result, setResult] = useState(null);
    const [style, setStyle] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const styles = [
        {
            id: 0,
            name: "Style 1",
            description: "First sketch style",
        },
        {
            id: 1,
            name: "Style 2",
            description: "Second sketch style",
        },
        {
            id: 2,
            name: "Style 3",
            description: "Third sketch style",
        },
    ];

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];

        if (!selectedFile) return;

        setFile(selectedFile);
        setPreview(URL.createObjectURL(selectedFile));
        setResult(null);
        setError(null);
    };

    const handleGenerate = async () => {
        if (!file) {
            setError("Please select a face image first.");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const formData = new FormData();

            formData.append("file", file);
            formData.append("style", style);

            const response = await axios.post(
                `${API_URL}/face-to-sketch`,
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                }
            );

            console.log("Face-to-sketch response:", response.data);

            // Backend returns:
            // {
            //     success: true,
            //     image: "<base64>",
            //     style: 0
            // }

            if (!response.data.success || !response.data.image) {
                throw new Error("Backend did not return a generated image.");
            }

            // Convert base64 response into an image URL
            const imageUrl = `data:image/png;base64,${response.data.image}`;

            setResult(imageUrl);

        } catch (err) {
            console.error("Face-to-sketch error:", err);

            if (err.response) {
                console.error("Backend response:", err.response.data);

                if (typeof err.response.data === "object") {
                    setError(
                        err.response.data.detail ||
                        "The backend returned an error while generating the sketch."
                    );
                } else {
                    setError(
                        `Backend error: ${err.response.status} ${err.response.statusText}`
                    );
                }
            } else if (err.message) {
                setError(err.message);
            } else {
                setError(
                    "Could not connect to the backend. Make sure FastAPI is running."
                );
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!result) return;

        const link = document.createElement("a");
        link.href = result;
        link.download = `generated_sketch_style_${style + 1}.png`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-8">

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">
                    Face-to-Sketch
                </h1>

                <p className="mt-2 text-gray-600">
                    Generate a facial sketch from an input face using a
                    style-conditioned generator.
                </p>
            </div>

            {/* Main Card */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

                {/* Upload */}
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-10">

                    <Upload className="mb-4 h-10 w-10 text-gray-400" />

                    <h2 className="text-lg font-semibold text-gray-800">
                        Upload a face image
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                        Select a sketch style and generate the result.
                    </p>

                    <label className="mt-5 cursor-pointer rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800">
                        Choose Image

                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </label>
                </div>

                {/* Error */}
                {error && (
                    <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* Preview */}
                {preview && (
                    <div className="mt-8">

                        <h3 className="mb-3 text-lg font-semibold text-gray-800">
                            Input Face
                        </h3>

                        <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                            <img
                                src={preview}
                                alt="Input face"
                                className="max-h-96 w-full object-contain"
                            />
                        </div>

                    </div>
                )}

                {/* Style Selection */}
                {file && (
                    <div className="mt-8">

                        <h3 className="mb-4 text-lg font-semibold text-gray-800">
                            Select Sketch Style
                        </h3>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

                            {styles.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        setStyle(item.id);
                                        setResult(null);
                                    }}
                                    className={`rounded-lg border p-4 text-left transition ${style === item.id
                                        ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200"
                                        : "border-gray-200 bg-white hover:border-gray-400"
                                        }`}
                                >

                                    <div className="flex items-center gap-3">

                                        <div
                                            className={`flex h-5 w-5 items-center justify-center rounded-full border ${style === item.id
                                                ? "border-blue-600"
                                                : "border-gray-400"
                                                }`}
                                        >
                                            {style === item.id && (
                                                <div className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                                            )}
                                        </div>

                                        <div>
                                            <p className="font-semibold text-gray-800">
                                                {item.name}
                                            </p>

                                            <p className="text-sm text-gray-500">
                                                {item.description}
                                            </p>
                                        </div>

                                    </div>

                                </button>
                            ))}

                        </div>
                    </div>
                )}

                {/* Generate Button */}
                {file && (
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={loading}
                        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >

                        {loading ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Generating Sketch...
                            </>
                        ) : (
                            <>
                                <ImageIcon className="h-5 w-5" />
                                Generate Sketch
                            </>
                        )}

                    </button>
                )}

            </div>

            {/* Result */}
            {result && (
                <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

                    <div className="mb-6 flex items-center justify-between">

                        <h2 className="text-xl font-bold text-gray-900">
                            Generated Sketch
                        </h2>

                        <button
                            type="button"
                            onClick={handleDownload}
                            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                        >
                            <Download className="h-4 w-4" />
                            Download
                        </button>

                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

                        {/* Input */}
                        <div>

                            <h3 className="mb-3 font-semibold text-gray-800">
                                Input Face
                            </h3>

                            <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                                <img
                                    src={preview}
                                    alt="Input face"
                                    className="max-h-[500px] w-full object-contain"
                                />
                            </div>

                        </div>

                        {/* Generated */}
                        <div>

                            <h3 className="mb-3 font-semibold text-gray-800">
                                Generated Sketch — Style {style + 1}
                            </h3>

                            <div className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">

                                <img
                                    src={result}
                                    alt="Generated sketch"
                                    className="max-h-[500px] w-full object-contain"
                                />

                            </div>

                        </div>

                    </div>

                </div>
            )}

        </div>
    );
}
