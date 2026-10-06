/// <reference types="bun-types" />

declare module "*.html" {
  const content: string;
  export default content;
}

declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

interface ImportMeta {
  hot?: {
    data: Record<string, any>;
    accept: () => void;
  };
}
