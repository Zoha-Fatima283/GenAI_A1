import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

const ImageUploader = ({ onImageSelect }) => {
  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];

        const reader = new FileReader();

        reader.onload = () => {
          onImageSelect(file, reader.result);
        };

        reader.readAsDataURL(file);
      }
    },
    [onImageSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
    },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
        isDragActive
          ? 'border-indigo-500 bg-indigo-50/50'
          : 'border-slate-300 hover:border-slate-400'
      }`}
    >
      <input {...getInputProps()} />

      <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />

      <p className="text-sm text-slate-600 font-medium">
        Drag & drop your photo here
      </p>

      <p className="text-xs text-slate-400 mt-1">
        Supports JPG, PNG up to 10MB
      </p>
    </div>
  );
};

export default ImageUploader;