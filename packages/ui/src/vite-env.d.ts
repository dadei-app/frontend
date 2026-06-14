/// <reference types="vite/client" />

declare module '*.onnx' {
  const src: string;
  export default src;
}

declare module '*.onnx?url' {
  const src: string;
  export default src;
}
