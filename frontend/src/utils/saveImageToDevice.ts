import { Capacitor, registerPlugin } from '@capacitor/core'

interface ImageSaverPlugin {
  saveImage(options: { url: string; fileName: string }): Promise<{
    uri: string
    displayName: string
    relativePath: string
  }>
}

const ImageSaver = registerPlugin<ImageSaverPlugin>('ImageSaver')

function safeFileName(title: string): string {
  const stem = title
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'synapse-visualization'

  return `${stem}-${Date.now()}`
}

export async function saveImageToDevice(url: string, title: string): Promise<string> {
  const fileName = safeFileName(title)

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    const result = await ImageSaver.saveImage({ url, fileName })
    return `Saved to ${result.relativePath}`
  }

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  return 'Download started'
}
