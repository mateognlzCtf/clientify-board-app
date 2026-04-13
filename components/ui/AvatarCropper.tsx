'use client'

import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { X, Check } from 'lucide-react'

interface AvatarCropperProps {
  imageSrc: string
  onCrop: (blob: Blob) => void
  onCancel: () => void
}

export function AvatarCropper({ imageSrc, onCrop, onCancel }: AvatarCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  async function handleConfirm() {
    if (!croppedAreaPixels) return
    const blob = await getCroppedImage(imageSrc, croppedAreaPixels)
    if (blob) onCrop(blob)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm">
        <div className="relative h-72 bg-gray-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 py-3">
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <p className="text-xs text-gray-400 text-center mt-1">Pinch or drag to adjust</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <X size={15} /> Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Check size={15} /> Apply
          </button>
        </div>
      </div>
    </div>
  )
}

async function getCroppedImage(imageSrc: string, crop: Area): Promise<Blob | null> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = crop.width
  canvas.height = crop.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92))
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.src = src
  })
}
