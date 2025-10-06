
Upgrade overlay created. Copy files into your project:
- server/index.mjs (adds /patch, /test, CORS)
- src/lib/localAsr.ts (robust)
- src/hooks/useDebounce.ts
- vite.config.ts (test config)
- src/setupTests.ts

After copying:
npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom @testing-library/user-event
