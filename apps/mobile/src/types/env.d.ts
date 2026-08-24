/// <reference types="expo/types" />

declare const process: {
  env: NodeJS.ProcessEnv;
};

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL?: string;
  }
}
