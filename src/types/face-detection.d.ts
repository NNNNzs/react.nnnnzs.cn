/**
 * FaceDetector API 类型声明
 * Chrome/Edge 内置的 Shape Detection API
 */

interface FaceDetectorOptions {
  /** 快速模式，优先速度而非准确度 */
  fastMode?: boolean;
  /** 最大检测人脸数 */
  maxDetectedFaces?: number;
}

interface DOMRectReadOnly {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface DetectedFace {
  boundingBox: DOMRectReadOnly;
  landmark?: Array<{ x: number; y: number; type: string }>;
}

interface FaceDetectorConstructor {
  new (options?: FaceDetectorOptions): FaceDetector;
}

interface FaceDetector {
  detect(
    image: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
  ): Promise<DetectedFace[]>;
}

declare global {
  interface Window {
    FaceDetector: FaceDetectorConstructor;
  }
}
